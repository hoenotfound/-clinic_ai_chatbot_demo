const industry = require("./industryProfile");
const {
  buildSystemPrompt,
  buildFallbackReply,
  buildConcernFallback,
  enforceBookingRules,
  enforceSafetyRules,
  concernGuidanceForPrompt,
  bookingRulesForPrompt,
} = industry;
const opsStats = require("./opsStats");
const { createGeminiFailover } = require("./geminiFailover");
const { sanitizeRenovationCustomerReply } = require("./renovationCustomerLanguage");
const { buildRenovationIntakeReply } = require("./renovationIntakeFlow");

const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
const SUPPORTED_PROVIDERS = new Set(["mock", "claude", "gemini"]);
if (!SUPPORTED_PROVIDERS.has(provider)) {
  throw new Error(`Unknown AI_PROVIDER: ${provider}`);
}

function customerReply(reply) {
  return industry.key === "renovation" ? sanitizeRenovationCustomerReply(reply) : reply;
}

function renovationIntakeReply(messages, { isFirstMessage = false } = {}) {
  if (industry.key !== "renovation") return null;
  const reply = buildRenovationIntakeReply(messages, { isFirstMessage });
  return reply ? customerReply(reply) : null;
}

function enhancedSystemPrompt(isFirstMessage) {
  const basePrompt = buildSystemPrompt({ isFirstMessage });
  if (industry.key === "renovation") {
    return `${basePrompt}\n\nCUSTOMER-FACING WORDING:\n- Do not use the words "carpentry" or "木工" when speaking to customers. These are internal scope terms and sound unnatural in normal Malaysian customer chat.\n- Ask about the actual cabinet type instead: upper/lower kitchen cabinet, wardrobe, TV cabinet, shoe cabinet or another cabinet type.\n- In Chinese, use 厨房吊柜/地柜、衣柜、电视柜、鞋柜 and natural terms such as 柜子 / 装修需求. Do not say 木工装修、木工项目、木工区域 or 全屋木工.\n\nSITE-FIRST SALES FLOW:\n- The deterministic intake flow handles the opening site-details template and the first qualification steps. Once it hands the conversation back to you, preserve that order and do not reset it.\n- Site basics first: site photo if available, rough size, and project location.\n- Then identify what the customer wants to build: upper + lower kitchen cabinets, wardrobe, TV cabinet, shoe cabinet or another cabinet type.\n- Once scope and site basics are known, check practical obstructions such as usable wall space, windows/doors, switches, plug points, plumbing/water points, hob/hood, beams or columns.\n- Give preliminary layout/material direction only from information actually supplied. Never claim to see a photo unless its contents were provided to the model.\n- Material guidance is preliminary. Compare practical options according to budget, finish, moisture exposure and use; never claim one material is universally best.\n\nSTRUCTURED RENOVATION SALES KNOWLEDGE:\nUse only the configured services and price guides above. Preserve known project context and never invent a final quotation.\n\nDETERMINISTIC RENOVATION HANDOFF RULES:\nFollow the handoff conditions above. Never invent site availability, booking confirmation or technical conclusions.`;
  }
  return `${basePrompt}\n\nSTRUCTURED CONCERN-TO-TREATMENT KNOWLEDGE:\nUse these mappings as general front-desk guidance, never as a diagnosis or guarantee. If more than one service is mapped, explain why the categories differ and let a clinician decide suitability.\n${concernGuidanceForPrompt()}\n\nDETERMINISTIC BOOKING RULES:\n${bookingRulesForPrompt()}`;
}

function getFallbackReply(messages) {
  const safetyReply = enforceSafetyRules(messages);
  if (safetyReply) return customerReply(safetyReply);
  const ruleReply = enforceBookingRules(messages);
  if (ruleReply) return customerReply(ruleReply);
  const concernReply = buildConcernFallback(messages);
  if (concernReply) return customerReply(concernReply);
  const intakeReply = renovationIntakeReply(messages, {
    isFirstMessage: (messages || []).filter((message) => message?.role === "user").length === 1 &&
      !(messages || []).some((message) => message?.role === "assistant"),
  });
  if (intakeReply) return intakeReply;
  return customerReply(buildFallbackReply(messages));
}

function fetchTimeoutMs() {
  const value = Number.parseInt(process.env.AI_REQUEST_TIMEOUT_MS || "4500", 10);
  return Number.isFinite(value) && value > 0 ? value : 4500;
}

async function fetchJson(url, options, label, timeoutMs = fetchTimeoutMs()) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data?.error?.message || data?.error?.type || `${response.status} ${response.statusText}`;
      const apiStatus = data?.error?.status ? ` ${data.error.status}` : "";
      const details = Array.isArray(data?.error?.details) && data.error.details.length
        ? ` | details: ${JSON.stringify(data.error.details).slice(0, 1200)}`
        : "";
      const error = new Error(`${label} request failed (${response.status}${apiStatus}): ${detail}${details}`);
      error.statusCode = response.status;
      error.apiStatus = data?.error?.status || null;
      error.apiDetails = Array.isArray(data?.error?.details) ? data.error.details : null;
      throw error;
    }
    return data;
  } catch (error) {
    if (controller.signal.aborted) {
      const timeoutError = new Error(`${label} timed out after ${timeoutMs}ms.`);
      timeoutError.code = "AI_REQUEST_TIMEOUT";
      timeoutError.statusCode = 408;
      timeoutError.cause = error;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function getClaudeReply(messages, isFirstMessage) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");
  const model = process.env.CLAUDE_MODEL || "claude-sonnet-5";
  const data = await fetchJson(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 650,
        thinking: { type: "disabled" },
        system: enhancedSystemPrompt(isFirstMessage),
        messages,
      }),
    },
    "Claude"
  );
  const block = data.content?.find((item) => item.type === "text");
  if (!block?.text) throw new Error("Claude returned an empty response.");
  return block.text;
}

const gemini = createGeminiFailover({
  buildPrompt: enhancedSystemPrompt,
  opsStats,
  fetchJson,
});

const configured = provider === "mock" ||
  (provider === "claude" && Boolean(process.env.ANTHROPIC_API_KEY)) ||
  (provider === "gemini" && gemini.getApiKeys().length > 0);

async function getReply(messages, isFirstMessage = false) {
  const startedAt = Date.now();
  try {
    const safetyReply = enforceSafetyRules(messages);
    if (safetyReply) return customerReply(safetyReply);

    const ruleReply = enforceBookingRules(messages);
    if (ruleReply) return customerReply(ruleReply);

    const intakeReply = renovationIntakeReply(messages, { isFirstMessage });
    if (intakeReply) return intakeReply;

    try {
      if (provider === "mock") return getFallbackReply(messages);
      if (provider === "claude") return customerReply(await getClaudeReply(messages, isFirstMessage));
      if (provider === "gemini") {
        return customerReply(await gemini.getReply(messages, isFirstMessage, () => getFallbackReply(messages)));
      }
      throw new Error(`Unknown AI_PROVIDER: ${provider}`);
    } catch (error) {
      console.error(`AI provider "${provider}" failed; using deterministic demo fallback:`, error);
      if (provider === "gemini") opsStats.recordDeterministicFallback("escaped_provider_error");
      return getFallbackReply(messages);
    }
  } finally {
    opsStats.recordLatency("ai_response", Date.now() - startedAt);
  }
}

module.exports = {
  getReply,
  getFallbackReply,
  provider,
  configured,
  _test: {
    enhancedSystemPrompt,
    customerReply,
    renovationIntakeReply,
    geminiThinkingConfig: gemini.thinkingConfig,
    buildGeminiRequest: gemini.buildRequest,
    getGeminiApiKeys: gemini.getApiKeys,
    classifyGeminiError: gemini.classify,
    isRetryableGeminiError: gemini.isRetryable,
    isFailoverBudgetError: gemini.isFailoverBudgetError,
    remainingBudgetMs: gemini.remainingBudgetMs,
    requestTimeoutMs: gemini.requestTimeout,
    requestGemini: gemini.request,
    tryPrimaryGeminiKeys: gemini.tryPrimary,
    tryFallbackGeminiModel: gemini.tryFallback,
    keyCooldown: gemini.keyCooldown,
    modelCooldown: gemini.modelCooldown,
    resetGeminiCooldowns: gemini.resetCooldowns,
  },
};