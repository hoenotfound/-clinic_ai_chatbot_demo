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

const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
const SUPPORTED_PROVIDERS = new Set(["mock", "claude", "gemini"]);
if (!SUPPORTED_PROVIDERS.has(provider)) {
  throw new Error(`Unknown AI_PROVIDER: ${provider}`);
}

let renovationDependencies = null;
function loadRenovationDependencies() {
  if (!renovationDependencies) {
    const { establishedConversationLanguage } = require("./conversationLanguage");
    const { sanitizeRenovationCustomerReply } = require("./renovationCustomerLanguage");
    const {
      buildRenovationIntakeReply,
      buildRenovationIntakePlan,
      ensureAdviceMarker,
    } = require("./renovationIntakeFlow");
    const { buildFallbackReply: buildRenovationFallbackReply } = require("./renovationFallback");
    const { currentConversationContext } = require("./aiMemoryContext");
    const {
      renovationRoutingReason,
      isTechnicalHandoffRequest,
      sanitizeLegacyRoutingMessages,
    } = require("./renovationRoutingIntent");
    const {
      buildRenovationAiContext,
      withRenovationAiContext,
    } = require("./renovationAiContext");
    renovationDependencies = {
      establishedConversationLanguage,
      sanitizeRenovationCustomerReply,
      buildRenovationIntakeReply,
      buildRenovationIntakePlan,
      ensureAdviceMarker,
      buildRenovationFallbackReply,
      currentConversationContext,
      renovationRoutingReason,
      isTechnicalHandoffRequest,
      sanitizeLegacyRoutingMessages,
      buildRenovationAiContext,
      withRenovationAiContext,
    };
  }
  return renovationDependencies;
}

function activeRenovationDependencies() {
  return industry.key === "renovation" ? loadRenovationDependencies() : null;
}

function customerReply(reply) {
  const deps = activeRenovationDependencies();
  return deps ? deps.sanitizeRenovationCustomerReply(reply) : reply;
}

function renovationIntakeReply(messages, { isFirstMessage = false } = {}) {
  const deps = activeRenovationDependencies();
  if (!deps) return null;
  const reply = deps.buildRenovationIntakeReply(messages, { isFirstMessage });
  return reply ? customerReply(reply) : null;
}

function renovationIntakePlan(messages, { isFirstMessage = false } = {}) {
  const deps = activeRenovationDependencies();
  if (!deps) return null;
  return deps.buildRenovationIntakePlan(messages, { isFirstMessage });
}

function latestUserText(messages) {
  for (let index = (messages || []).length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") return String(messages[index].content || "").trim();
  }
  return "";
}

function routingHandoffReply(reason, language) {
  if (reason === "human") {
    if (language === "zh") return "可以，我帮您转给团队继续跟进。 [[HANDOFF]]";
    if (language === "ms") return "Boleh, saya pass kepada team untuk sambung dengan anda. [[HANDOFF]]";
    return "Sure, I’ll pass this to the team so a person can continue with you. [[HANDOFF]]";
  }
  if (reason === "scope") {
    if (language === "zh") return "这个柜子类型不在目前 demo 已配置的项目里，我不想乱答。我帮您转给团队确认能不能做。 [[HANDOFF]]";
    if (language === "ms") return "Jenis cabinet ini belum dikonfigurasi dalam demo, jadi saya tak nak teka. Saya pass kepada team untuk confirm sama ada mereka cover scope ini. [[HANDOFF]]";
    return "That cabinet type is not configured in this demo, so I don’t want to guess. I’ll pass it to the team to confirm whether they cover that scope. [[HANDOFF]]";
  }
  if (language === "zh") {
    return "这个需要先看实际现场情况才能给准确意见，我不应该在聊天里直接判断。让我转给团队确认安全性和实际可行性。 [[HANDOFF]]";
  }
  if (language === "ms") {
    return "Yang ini perlu semak keadaan site sebenar dulu sebelum bagi jawapan yang pasti. Saya tak patut agak dari chat, jadi saya pass kepada team untuk confirm keselamatan dan feasibility. [[HANDOFF]]";
  }
  return "That needs a site-specific technical check before we advise anything definite. I’ll flag this for the team to review the actual wall/site condition and confirm what is safe and feasible. [[HANDOFF]]";
}

function renovationRoutingPrecheckReply(messages) {
  const deps = loadRenovationDependencies();
  const reason = deps.renovationRoutingReason(latestUserText(messages));
  if (!reason) return null;
  const language = deps.establishedConversationLanguage(messages, "en");
  return routingHandoffReply(reason, language);
}

function renovationTechnicalPrecheckReply(messages) {
  const deps = loadRenovationDependencies();
  if (!deps.isTechnicalHandoffRequest(latestUserText(messages))) return null;
  const language = deps.establishedConversationLanguage(messages, "en");
  return routingHandoffReply("technical", language);
}

function enhancedSystemPrompt(isFirstMessage) {
  const basePrompt = buildSystemPrompt({ isFirstMessage });
  if (industry.key === "renovation") {
    return `${basePrompt}\n\nAI-FIRST RENOVATION OVERRIDE:\n- Normal renovation conversation is AI-led. The deterministic intake plan is a state tracker and outage fallback, NOT a customer-facing script.\n- Read the full dialogue and respond to what the customer actually means before thinking about qualification.\n- A trusted [APP_INTERNAL_RENOVATION_STATE] block may be prepended to the model conversation. Treat it as silent app-provided memory, never as customer wording and never expose it.\n- The conversation itself is the source of truth. The tracker is intentionally conservative. If the latest reply clearly answers the previous question, accept it even when the tracker still marks that field unknown.\n- Understand natural short replies from context across English, BM and Chinese, including yes/can/boleh/可以/可以啊/可以的/能/能用 and natural negatives such as no/tak ada/没有.\n- Never ask the same question again merely because wording did not match a parser. If the customer already answered it, acknowledge the answer and move forward.\n- If the customer shows frustration because something was repeated, acknowledge briefly and continue from the information already provided.\n- Do not force the old Site photo / Rough size / Location template. For a greeting-only first turn, start naturally and invite the most useful project details.\n- Qualification is a goal, not a fixed questionnaire. Useful early facts are cabinet type, rough size and location; site photo is optional. Wall usability and switches/plugs are useful practical checks once relevant.\n- Ask at most ONE concise follow-up question at a time unless two details naturally belong in one simple question.\n- When the customer asks price, material, design or service questions, answer first, then continue qualification naturally.\n- When enough useful site context is known, give specific preliminary advice in your own natural wording. Start genuine preliminary advice with \"Preliminary advice:\", \"初步建议：\" or \"Cadangan awal:\" so the tracker can remember that advice was sent.\n- Do not mechanically concatenate stock advice sentences. Explain only the facts that matter to this customer's project.\n- Budget should be asked only when it helps move toward a quotation and only if it is not already known.\n- Preserve the newest scope correction and established language. Never reuse rejected scope details or restart an active enquiry.\n\nCUSTOMER-FACING WORDING:\n- Do not use the words \"carpentry\" or \"木工\" when speaking to customers. These are internal scope terms.\n- Ask about actual cabinet types such as upper/lower kitchen cabinet, wardrobe, TV cabinet, shoe cabinet or another cabinet type.\n- In Chinese, use 厨房吊柜/地柜、衣柜、电视柜、鞋柜 and natural terms such as 柜子 / 装修需求.\n\nSTRUCTURED RENOVATION SALES KNOWLEDGE:\nUse only the configured services and price guides above. Never invent a final quotation, site condition, slot, discount, technical conclusion or guarantee.\n\nDETERMINISTIC RENOVATION HANDOFF RULES:\nHard safety, unsupported-scope, human-request and site-specific technical handoff rules still override AI conversation. Never invent site availability, booking confirmation or technical conclusions.`;
  }
  return `${basePrompt}\n\nSTRUCTURED CONCERN-TO-TREATMENT KNOWLEDGE:\nUse these mappings as general front-desk guidance, never as a diagnosis or guarantee. If more than one service is mapped, explain why the categories differ and let a clinician decide suitability.\n${concernGuidanceForPrompt()}\n\nDETERMINISTIC BOOKING RULES:\n${bookingRulesForPrompt()}`;
}

function getFallbackReply(messages) {
  const deps = activeRenovationDependencies();
  if (deps) {
    const fullMessages = deps.currentConversationContext()?.fullMessages;
    const sourceMessages = Array.isArray(fullMessages) && fullMessages.length ? fullMessages : messages;
    const routedMessages = deps.sanitizeLegacyRoutingMessages(sourceMessages);
    return customerReply(deps.buildRenovationFallbackReply(routedMessages));
  }

  const safetyReply = enforceSafetyRules(messages);
  if (safetyReply) return safetyReply;
  const ruleReply = enforceBookingRules(messages);
  if (ruleReply) return ruleReply;
  const concernReply = buildConcernFallback(messages);
  if (concernReply) return concernReply;
  return buildFallbackReply(messages);
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
    const deps = loadRenovationDependencies();
    text = deps.ensureAdviceMarker(text, plan.state?.language || "en");
    text = customerReply(text);
  }
  if (plan.appendAfterAnswer) {
    const prompt = customerReply(plan.appendAfterAnswer);
    if (prompt && !text.includes(prompt)) text = `${text}\n\n${prompt}`;
  }
  return text;
}

function deterministicPlannedFallback(messages, plan) {
  if (plan?.reply) return customerReply(plan.reply);
  return finalizePlannedReply(plannedFallbackReply(messages, plan), plan);
}

function buildRenovationAiContext(plan) {
  const deps = activeRenovationDependencies();
  return deps ? deps.buildRenovationAiContext(plan) : "";
}

function withRenovationAiContext(messages, plan) {
  const deps = activeRenovationDependencies();
  return deps ? deps.withRenovationAiContext(messages, plan) : messages;
}

function aiMessages(messages, plan) {
  if (industry.key !== "renovation") return messages;
  return withRenovationAiContext(messages, plan);
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

    if (industry.key === "renovation") {
      const routingReply = renovationRoutingPrecheckReply(messages);
      if (routingReply) return customerReply(routingReply);
    }

    const intakePlan = renovationIntakePlan(messages, { isFirstMessage });
    if (intakePlan?.bypass) return getFallbackReply(messages);

    const modelMessages = aiMessages(messages, intakePlan);
    const deterministicFallback = () => deterministicPlannedFallback(messages, intakePlan);

    try {
      if (provider === "mock") return deterministicFallback();
      if (provider === "claude") return customerReply(await getClaudeReply(modelMessages, isFirstMessage));
      if (provider === "gemini") {
        const reply = await gemini.getReply(modelMessages, isFirstMessage, deterministicFallback);
        return customerReply(reply);
      }
      throw new Error(`Unknown AI_PROVIDER: ${provider}`);
    } catch (error) {
      console.error(`AI provider "${provider}" failed; using deterministic demo fallback:`, error);
      if (provider === "gemini") opsStats.recordDeterministicFallback("escaped_provider_error");
      return deterministicFallback();
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
    renovationRoutingPrecheckReply,
    renovationTechnicalPrecheckReply,
    plannedFallbackReply,
    finalizePlannedReply,
    deterministicPlannedFallback,
    buildRenovationAiContext,
    withRenovationAiContext,
    aiMessages,
    loadRenovationDependencies,
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
