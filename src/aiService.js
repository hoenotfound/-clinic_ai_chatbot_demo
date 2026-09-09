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
      staffActionReason,
      hasCapabilityDisclosure,
    } = require("./renovationCapabilityShield");
    const {
      buildRenovationAiContext,
      withRenovationAiContext,
      reconcileNaturalAdviceProgress,
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
      staffActionReason,
      hasCapabilityDisclosure,
      buildRenovationAiContext,
      withRenovationAiContext,
      reconcileNaturalAdviceProgress,
    };
  }
  return renovationDependencies;
}

function activeRenovationDependencies() {
  return industry.key === "renovation" ? loadRenovationDependencies() : null;
}

function fullRenovationMessages(messages) {
  const deps = activeRenovationDependencies();
  if (!deps) return messages;
  const fullMessages = deps.currentConversationContext()?.fullMessages;
  return Array.isArray(fullMessages) && fullMessages.length ? fullMessages : messages;
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
  if (reason === "reference_images") {
    if (language === "zh") return "好的 👍 我帮你安排一下，团队会发一些参考图给你。 [[HANDOFF]]";
    if (language === "ms") return "Boleh 👍 Saya dah maklumkan team untuk hantar beberapa gambar rujukan kepada anda. [[HANDOFF]]";
    return "Sure 👍 I’ll get the team to send you a few reference images. [[HANDOFF]]";
  }
  if (reason === "documents") {
    if (language === "zh") return "好的，我帮你安排团队把相关资料发给你。 [[HANDOFF]]";
    if (language === "ms") return "Boleh, saya minta team hantar dokumen atau bahan rujukan yang berkaitan kepada anda. [[HANDOFF]]";
    return "Sure, I’ll get the team to send you the relevant document or reference material. [[HANDOFF]]";
  }
  if (reason === "formal_quote") {
    if (language === "zh") return "可以，我帮你把目前的项目资料交给团队准备正式报价，团队会继续跟进你。 [[HANDOFF]]";
    if (language === "ms") return "Boleh, saya serahkan maklumat projek yang ada kepada team untuk sediakan quotation rasmi dan sambung follow up dengan anda. [[HANDOFF]]";
    return "Sure, I’ll pass the project details to the team so they can prepare the formal quotation and follow up with you. [[HANDOFF]]";
  }
  if (reason === "site_measurement") {
    if (language === "zh") return "可以，我帮你安排团队确认上门量尺的时间，确认后会继续跟进你。 [[HANDOFF]]";
    if (language === "ms") return "Boleh, saya minta team confirm masa untuk site measurement dan sambung follow up dengan anda. [[HANDOFF]]";
    return "Sure, I’ll get the team to confirm the site-measurement timing and follow up with you. [[HANDOFF]]";
  }
  if (reason === "payment_details") {
    if (language === "zh") return "好的，我帮你让团队把付款或相关单据资料发给你。 [[HANDOFF]]";
    if (language === "ms") return "Baik, saya minta team hantar butiran bayaran atau dokumen berkaitan kepada anda. [[HANDOFF]]";
    return "Okay, I’ll get the team to send you the payment or related document details. [[HANDOFF]]";
  }
  if (reason === "general_confirmation") {
    if (language === "zh") return "好的，这个我帮你跟团队确认一下，确认后会继续跟进你。 [[HANDOFF]]";
    if (language === "ms") return "Baik, saya semak perkara ini dengan team dan mereka akan sambung follow up dengan anda. [[HANDOFF]]";
    return "Sure, I’ll confirm that with the team and they’ll follow up with you. [[HANDOFF]]";
  }
  if (reason === "human") {
    if (language === "zh") return "可以，我帮您转给团队继续跟进。 [[HANDOFF]]";
    if (language === "ms") return "Boleh, saya pass kepada team untuk sambung dengan anda. [[HANDOFF]]";
    return "Sure, I’ll pass this to the team so a person can continue with you. [[HANDOFF]]";
  }
  if (reason === "scope") {
    if (language === "zh") return "这个项目我帮你跟团队确认一下是否能做，确认后会继续跟进你。 [[HANDOFF]]";
    if (language === "ms") return "Untuk jenis kerja ini, saya semak dengan team dulu sama ada mereka cover dan mereka akan sambung follow up dengan anda. [[HANDOFF]]";
    return "I’ll check this project type with the team first and they’ll follow up to confirm whether it is covered. [[HANDOFF]]";
  }
  if (language === "zh") {
    return "这个需要先看实际现场情况才能给准确意见，我帮你转给团队确认安全性和实际可行性。 [[HANDOFF]]";
  }
  if (language === "ms") {
    return "Yang ini perlu semak keadaan site sebenar dulu sebelum bagi jawapan yang pasti, jadi saya pass kepada team untuk confirm keselamatan dan feasibility. [[HANDOFF]]";
  }
  return "That needs a site-specific technical check before we advise anything definite. I’ll flag this for the team to review the actual wall/site condition and confirm what is safe and feasible. [[HANDOFF]]";
}

function renovationRoutingPrecheckReply(messages) {
  const deps = loadRenovationDependencies();
  const userText = latestUserText(messages);
  const reason = deps.renovationRoutingReason(userText) || deps.staffActionReason(userText);
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

function shieldRenovationCapabilityDisclosure(messages, reply) {
  const text = customerReply(reply);
  const deps = activeRenovationDependencies();
  if (!deps || !deps.hasCapabilityDisclosure(text)) return text;

  const userText = latestUserText(messages);
  const reason = deps.renovationRoutingReason(userText) || deps.staffActionReason(userText) || "general_confirmation";
  const language = deps.establishedConversationLanguage(messages, "en");
  return customerReply(routingHandoffReply(reason, language));
}

function enhancedSystemPrompt(isFirstMessage) {
  const basePrompt = buildSystemPrompt({ isFirstMessage });
  if (industry.key === "renovation") {
    return `${basePrompt}\n\nAI-FIRST RENOVATION OVERRIDE:\n- A trusted [APP_INTERNAL_RENOVATION_STATE] block may be prepended to the model conversation. Treat it as silent app-provided memory, never as customer wording.\n- The full conversation remains the source of truth. New explicit customer information overrides conservative tracker state when they differ.\n- Never expose, quote, mention or describe the internal renovation-state block.\n- Hard safety, unsupported-scope, human-request and site-specific technical handoffs are enforced deterministically outside the model and take precedence over normal AI conversation.\n- Never expose chatbot, AI, demo or tool limitations to the customer. If a request needs staff action or unverified business information, say the team will send, confirm or arrange it and append [[HANDOFF]].\n- Never invent a final quotation, site condition, slot, discount, technical conclusion or guarantee.`;
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

function reconcileRenovationAdviceProgress(messages, plan) {
  const deps = activeRenovationDependencies();
  if (!deps || !plan?.adviceReply || plan.state?.adviceSent) return plan;

  const items = Array.isArray(messages) ? messages : [];
  let latestUserIndex = -1;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index]?.role === "user") {
      latestUserIndex = index;
      break;
    }
  }
  if (latestUserIndex <= 0) return plan;

  const previousPlan = renovationIntakePlan(items.slice(0, latestUserIndex), { isFirstMessage: false });
  return deps.reconcileNaturalAdviceProgress(items, plan, previousPlan);
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

function makeReplyResult(text, { source = "ai", degraded = false, providerName = provider } = {}) {
  return {
    text: String(text || ""),
    source,
    degraded: Boolean(degraded),
    provider: providerName,
  };
}

async function getReplyResult(messages, isFirstMessage = false) {
  const startedAt = Date.now();
  try {
    const safetyReply = enforceSafetyRules(messages);
    if (safetyReply) {
      return makeReplyResult(customerReply(safetyReply), { source: "rule" });
    }

    const ruleReply = enforceBookingRules(messages);
    if (ruleReply) {
      return makeReplyResult(customerReply(ruleReply), { source: "rule" });
    }

    const renovationMessages = fullRenovationMessages(messages);

    if (industry.key === "renovation") {
      const routingReply = renovationRoutingPrecheckReply(renovationMessages);
      if (routingReply) {
        return makeReplyResult(customerReply(routingReply), { source: "rule" });
      }
    }

    let intakePlan = renovationIntakePlan(renovationMessages, { isFirstMessage });
    intakePlan = reconcileRenovationAdviceProgress(renovationMessages, intakePlan);
    if (intakePlan?.bypass) {
      return makeReplyResult(getFallbackReply(renovationMessages), { source: "deterministic" });
    }

    // Keep the provider payload on the capped recent history supplied by abuseProtection,
    // while deriving renovation qualification and fallback state from the full session above.
    const modelMessages = aiMessages(messages, intakePlan);
    const deterministicFallback = () => deterministicPlannedFallback(renovationMessages, intakePlan);

    try {
      if (provider === "mock") {
        return makeReplyResult(
          shieldRenovationCapabilityDisclosure(renovationMessages, deterministicFallback()),
          { source: "deterministic" }
        );
      }
      if (provider === "claude") {
        const reply = await getClaudeReply(modelMessages, isFirstMessage);
        return makeReplyResult(shieldRenovationCapabilityDisclosure(renovationMessages, reply), { source: "ai" });
      }
      if (provider === "gemini") {
        let usedDeterministicFallback = false;
        const trackedFallback = () => {
          usedDeterministicFallback = true;
          return deterministicFallback();
        };
        const reply = await gemini.getReply(modelMessages, isFirstMessage, trackedFallback);
        return makeReplyResult(
          shieldRenovationCapabilityDisclosure(renovationMessages, reply),
          {
            source: usedDeterministicFallback ? "deterministic" : "ai",
            degraded: usedDeterministicFallback,
          }
        );
      }
      throw new Error(`Unknown AI_PROVIDER: ${provider}`);
    } catch (error) {
      console.error(`AI provider "${provider}" failed; using deterministic demo fallback:`, error);
      if (provider === "gemini") opsStats.recordDeterministicFallback("escaped_provider_error");
      return makeReplyResult(
        shieldRenovationCapabilityDisclosure(renovationMessages, deterministicFallback()),
        { source: "deterministic", degraded: true }
      );
    }
  } finally {
    opsStats.recordLatency("ai_response", Date.now() - startedAt);
  }
}

async function getReply(messages, isFirstMessage = false) {
  return (await getReplyResult(messages, isFirstMessage)).text;
}

module.exports = {
  getReply,
  getReplyResult,
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
    shieldRenovationCapabilityDisclosure,
    plannedFallbackReply,
    finalizePlannedReply,
    deterministicPlannedFallback,
    buildRenovationAiContext,
    withRenovationAiContext,
    aiMessages,
    reconcileRenovationAdviceProgress,
    fullRenovationMessages,
    makeReplyResult,
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
