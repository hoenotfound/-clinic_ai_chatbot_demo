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
const {
  buildRenovationIntakeReply,
  buildRenovationIntakePlan,
  ensureAdviceMarker,
} = require("./renovationIntakeFlow");

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

function renovationIntakePlan(messages, { isFirstMessage = false } = {}) {
  if (industry.key !== "renovation") return null;
  return buildRenovationIntakePlan(messages, { isFirstMessage });
}

function enhancedSystemPrompt(isFirstMessage) {
  const basePrompt = buildSystemPrompt({ isFirstMessage });
  if (industry.key === "renovation") {
    return `${basePrompt}\n\nCUSTOMER-FACING WORDING:\n- Do not use the words "carpentry" or "木工" when speaking to customers. These are internal scope terms and sound unnatural in normal Malaysian customer chat.\n- Ask about the actual cabinet type instead: upper/lower kitchen cabinet, wardrobe, TV cabinet, shoe cabinet or another cabinet type.\n- In Chinese, use 厨房吊柜/地柜、衣柜、电视柜、鞋柜 and natural terms such as 柜子 / 装修需求. Do not say 木工装修、木工项目、木工区域 or 全屋木工.\n\nSITE-FIRST SALES FLOW:\n- The deterministic intake layer tracks what information is still missing. Follow its order without turning the conversation into a rigid form.\n- If the customer's first message asks a real question, answer that question first. Do not ignore a price, material or service question just to show an intake template. For that first direct answer, do not add your own qualification question because the deterministic intake layer will append the correct next site question.\n- Site basics are: site photo if available, a usable rough size, and project location. A missing photo must never block the conversation.\n- Then identify what the customer wants to build: upper + lower kitchen cabinets, wardrobe, TV cabinet, shoe cabinet or another cabinet type.\n- Once scope and site basics are known, check practical site constraints relevant to that cabinet type. Do not repeat a full generic checklist if the customer has already answered part of it.\n- When the latest customer message completes the needed site constraints, the next reply MUST give specific preliminary advice using the facts they actually supplied before asking another qualification question. Start that reply with "Preliminary advice:", "初步建议：" or "Cadangan awal:" so the flow can recognise that advice was already given.\n- Use concrete facts naturally: e.g. a sink position should affect base-cabinet planning, plug points must remain accessible, a window affects upper-cabinet width/height, a fridge needs door/ventilation clearance, and a beam/column affects cabinet sectioning. Do not merely repeat the checklist back to them.\n- Never claim to see a photo unless its actual contents were provided to the model.\n- Material guidance is preliminary. Compare practical options according to budget, finish, moisture exposure and use; never claim one material is universally best.\n- Respect the newest scope correction. Do not reuse measurements or obstruction details from a rejected cabinet scope, and do not reuse old project facts after a genuinely ended enquiry is restarted.\n\nSTRUCTURED RENOVATION SALES KNOWLEDGE:\nUse only the configured services and price guides above. Preserve current project context and never invent a final quotation.\n\nDETERMINISTIC RENOVATION HANDOFF RULES:\nFollow the handoff conditions above. Never invent site availability, booking confirmation or technical conclusions.`;
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
  return customerReply(buildFallbackReply(messages));
}

function plannedFallbackReply(messages, plan) {
  if (!plan) return getFallbackReply(messages);
  if (plan.adviceReply) {
    if (plan.answerFirst && plan.directFallbackAnswer) {
      return customerReply(`${plan.directFallbackAnswer}\n\n${plan.adviceReply}`);
    }
    return customerReply(plan.adviceReply);
  }
  if (plan.answerFirst && plan.directFallbackAnswer) return customerReply(plan.directFallbackAnswer);
  return getFallbackReply(messages);
}

function finalizePlannedReply(reply, plan) {
  let text = customerReply(reply);
  if (!plan) return text;

  if (plan.adviceReply) {
    text = ensureAdviceMarker(text, plan.state?.language || "en");
    text = customerReply(text);
  }

  if (plan.appendAfterAnswer) {
    const prompt = customerReply(plan.appendAfterAnswer);
    if (prompt && !text.includes(prompt)) text = `${text}\n\n${prompt}`;
  }
  return text;
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

    const intakePlan = renovationIntakePlan(messages, { isFirstMessage });
    if (intakePlan?.reply) return customerReply(intakePlan.reply);
    if (intakePlan?.bypass) return getFallbackReply(messages);

    try {
      if (provider === "mock") {
        return finalizePlannedReply(plannedFallbackReply(messages, intakePlan), intakePlan);
      }
      if (provider === "claude") {
        return finalizePlannedReply(await getClaudeReply(messages, isFirstMessage), intakePlan);
      }
      if (provider === "gemini") {
        const reply = await gemini.getReply(
          messages,
          isFirstMessage,
          () => plannedFallbackReply(messages, intakePlan)
        );
        return finalizePlannedReply(reply, intakePlan);
      }
      throw new Error(`Unknown AI_PROVIDER: ${provider}`);
    } catch (error) {
      console.error(`AI provider "${provider}" failed; using deterministic demo fallback:`, error);
      if (provider === "gemini") opsStats.recordDeterministicFallback("escaped_provider_error");
      return finalizePlannedReply(plannedFallbackReply(messages, intakePlan), intakePlan);
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
    renovationIntakePlan,
    plannedFallbackReply,
    finalizePlannedReply,
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