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

const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
const SUPPORTED_PROVIDERS = new Set(["mock", "claude", "gemini"]);
if (!SUPPORTED_PROVIDERS.has(provider)) {
  throw new Error(`Unknown AI_PROVIDER: ${provider}`);
}

function getGeminiApiKeys() {
  const newKeys = [process.env.GEMINI_API_KEY_1, process.env.GEMINI_API_KEY_2]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const uniqueNewKeys = [...new Set(newKeys)];
  if (uniqueNewKeys.length) return uniqueNewKeys;

  const legacy = String(process.env.GEMINI_API_KEY || "").trim();
  return legacy ? [legacy] : [];
}

const configured = provider === "mock" ||
  (provider === "claude" && Boolean(process.env.ANTHROPIC_API_KEY)) ||
  (provider === "gemini" && getGeminiApiKeys().length > 0);

const parsedTimeout = Number.parseInt(process.env.AI_REQUEST_TIMEOUT_MS || "15000", 10);
const AI_REQUEST_TIMEOUT_MS = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 15000;
const parsedRetryDelay = Number.parseInt(process.env.GEMINI_RETRY_DELAY_MS || "250", 10);
const GEMINI_RETRY_DELAY_MS = Number.isFinite(parsedRetryDelay) && parsedRetryDelay >= 0 ? parsedRetryDelay : 250;
const parsedFailoverBudget = Number.parseInt(process.env.GEMINI_FAILOVER_BUDGET_MS || "12000", 10);
const GEMINI_FAILOVER_BUDGET_MS = Number.isFinite(parsedFailoverBudget) && parsedFailoverBudget > 0
  ? parsedFailoverBudget
  : 12000;

function enhancedSystemPrompt(isFirstMessage) {
  const basePrompt = buildSystemPrompt({ isFirstMessage });
  if (industry.key === "renovation") {
    return `${basePrompt}\n\nSTRUCTURED RENOVATION SALES KNOWLEDGE:\nUse these mappings only as business sales guidance. Never invent an exact quotation, site condition, material suitability, availability, structural conclusion, electrical/plumbing conclusion or guarantee. When site-specific judgement is required, hand the enquiry to staff.\n${concernGuidanceForPrompt()}\n\nDETERMINISTIC RENOVATION HANDOFF RULES:\n${bookingRulesForPrompt()}`;
  }
  return `${basePrompt}\n\nSTRUCTURED CONCERN-TO-TREATMENT KNOWLEDGE:\nUse these mappings as general front-desk guidance, never as a diagnosis or guarantee. If more than one service is mapped, explain why the categories differ and let a clinician decide suitability.\n${concernGuidanceForPrompt()}\n\nDETERMINISTIC BOOKING RULES:\n${bookingRulesForPrompt()}`;
}

function getFallbackReply(messages) {
  const safetyReply = enforceSafetyRules(messages);
  if (safetyReply) return safetyReply;
  const ruleReply = enforceBookingRules(messages);
  if (ruleReply) return ruleReply;
  const concernReply = buildConcernFallback(messages);
  if (concernReply) return concernReply;
  return buildFallbackReply(messages);
}

function failoverBudgetError() {
  const error = new Error("Gemini failover budget exhausted.");
  error.code = "GEMINI_FAILOVER_BUDGET_EXHAUSTED";
  error.statusCode = 408;
  return error;
}

function isFailoverBudgetError(error) {
  return error?.code === "GEMINI_FAILOVER_BUDGET_EXHAUSTED";
}

function remainingBudgetMs(deadline) {
  if (!Number.isFinite(deadline)) return Number.POSITIVE_INFINITY;
  return Math.max(0, deadline - Date.now());
}

function requestTiming(deadline) {
  if (!Number.isFinite(deadline)) {
    return { timeoutMs: AI_REQUEST_TIMEOUT_MS, budgetLimited: false };
  }
  const remaining = remainingBudgetMs(deadline);
  if (remaining <= 0) throw failoverBudgetError();
  return {
    timeoutMs: Math.max(1, Math.min(AI_REQUEST_TIMEOUT_MS, remaining)),
    budgetLimited: remaining <= AI_REQUEST_TIMEOUT_MS,
  };
}

function requestTimeoutMs(deadline) {
  return requestTiming(deadline).timeoutMs;
}

async function fetchJson(url, options, label, timeoutMs = AI_REQUEST_TIMEOUT_MS) {
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

function geminiThinkingConfig(model) {
  const normalized = String(model || "").toLowerCase();
  if (/^gemini-2\.5-flash(?:-lite)?(?:-|$)/.test(normalized)) {
    return { thinkingConfig: { thinkingBudget: 0 } };
  }
  if (/^gemini-3(?:[.-]|$)/.test(normalized)) {
    return {
      thinkingConfig: {
        thinkingLevel: normalized.includes("flash") ? "minimal" : "low",
      },
    };
  }
  return {};
}

function buildGeminiRequest(messages, isFirstMessage, model, { omitThinking = false } = {}) {
  const contents = messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: String(message.content || "") }],
  }));
  const generationConfig = {
    maxOutputTokens: omitThinking ? 2048 : 650,
  };
  if (!omitThinking) Object.assign(generationConfig, geminiThinkingConfig(model));

  return {
    systemInstruction: {
      parts: [{ text: enhancedSystemPrompt(isFirstMessage) }],
    },
    contents,
    generationConfig,
  };
}

function extractGeminiText(data) {
  return data.candidates?.[0]?.content?.parts
    ?.filter((part) => typeof part.text === "string")
    .map((part) => part.text)
    .join("")
    .trim() || "";
}

function isRetryableGeminiError(error) {
  if (!error?.statusCode) return true;
  return error.statusCode === 408 || error.statusCode === 409 || error.statusCode === 429 || error.statusCode >= 500;
}

function sleep(ms) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestGemini(messages, isFirstMessage, apiKey, model, label, deadline = null, statsMeta = {}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const requestOptions = (body) => ({
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });
  const telemetry = {
    keyIndex: statsMeta.keyIndex || 0,
    phase: statsMeta.phase || "primary",
    model,
  };
  const trackedFetch = async (body, requestLabel, timeoutMs) => {
    opsStats.recordGeminiAttempt(telemetry);
    const startedAt = Date.now();
    try {
      return await fetchJson(url, requestOptions(body), requestLabel, timeoutMs);
    } catch (error) {
      opsStats.recordGeminiFailure({ ...telemetry, error });
      throw error;
    } finally {
      opsStats.recordLatency("gemini_request", Date.now() - startedAt);
    }
  };

  let data;
  const primaryBody = buildGeminiRequest(messages, isFirstMessage, model);
  const primaryTiming = requestTiming(deadline);
  try {
    data = await trackedFetch(primaryBody, label, primaryTiming.timeoutMs);
  } catch (error) {
    if (primaryTiming.budgetLimited && error?.code === "AI_REQUEST_TIMEOUT") throw failoverBudgetError();
    if (Number.isFinite(deadline) && remainingBudgetMs(deadline) <= 0) throw failoverBudgetError();
    const hasThinkingConfig = Boolean(primaryBody.generationConfig?.thinkingConfig);
    const isInvalidArgument = error.statusCode === 400 &&
      (error.apiStatus === "INVALID_ARGUMENT" || /invalid argument/i.test(error.message));
    if (!hasThinkingConfig || !isInvalidArgument) throw error;

    console.warn(`${label} rejected thinkingConfig for model "${model}"; retrying without it.`);
    opsStats.recordCounter("gemini_retries");
    opsStats.recordCounter("gemini_compatibility_retries");
    const fallbackBody = buildGeminiRequest(messages, isFirstMessage, model, { omitThinking: true });
    const compatibilityTiming = requestTiming(deadline);
    try {
      data = await trackedFetch(
        fallbackBody,
        `${label} compatibility retry`,
        compatibilityTiming.timeoutMs
      );
    } catch (compatibilityError) {
      if (compatibilityTiming.budgetLimited && compatibilityError?.code === "AI_REQUEST_TIMEOUT") {
        throw failoverBudgetError();
      }
      throw compatibilityError;
    }
  }

  const text = extractGeminiText(data);
  if (!text) {
    const error = new Error(`${label} returned an empty response.`);
    error.statusCode = 502;
    opsStats.recordGeminiFailure({ ...telemetry, error });
    throw error;
  }
  opsStats.recordGeminiSuccess({ ...telemetry, usageMetadata: data?.usageMetadata || {} });
  return text;
}

async function tryPrimaryGeminiKeys(messages, isFirstMessage, keys, model, deadline = null) {
  let lastError = null;
  for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
    if (Number.isFinite(deadline) && remainingBudgetMs(deadline) <= 0) throw failoverBudgetError();
    if (keyIndex > 0) opsStats.recordCounter("gemini_key_failovers");
    const label = `Gemini key ${keyIndex + 1}`;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        return await requestGemini(
          messages,
          isFirstMessage,
          keys[keyIndex],
          model,
          label,
          deadline,
          { keyIndex: keyIndex + 1, phase: "primary" }
        );
      } catch (error) {
        lastError = error;
        if (isFailoverBudgetError(error) || (Number.isFinite(deadline) && remainingBudgetMs(deadline) <= 0)) {
          throw failoverBudgetError();
        }
        const retry = attempt === 1 && isRetryableGeminiError(error);
        console.warn(`${label} attempt ${attempt} failed: ${error.message}${retry ? "; retrying once" : ""}`);
        if (!retry) break;
        opsStats.recordCounter("gemini_retries");
        const delay = Number.isFinite(deadline)
          ? Math.min(GEMINI_RETRY_DELAY_MS, remainingBudgetMs(deadline))
          : GEMINI_RETRY_DELAY_MS;
        await sleep(delay);
      }
    }
  }
  throw lastError || new Error("All Gemini primary-key attempts failed.");
}

async function tryFallbackGeminiModel(messages, isFirstMessage, keys, fallbackModel, deadline = null) {
  let lastError = null;
  for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
    if (Number.isFinite(deadline) && remainingBudgetMs(deadline) <= 0) throw failoverBudgetError();
    if (keyIndex > 0) opsStats.recordCounter("gemini_key_failovers");
    try {
      return await requestGemini(
        messages,
        isFirstMessage,
        keys[keyIndex],
        fallbackModel,
        `Gemini fallback model key ${keyIndex + 1}`,
        deadline,
        { keyIndex: keyIndex + 1, phase: "fallback_model" }
      );
    } catch (error) {
      lastError = error;
      if (isFailoverBudgetError(error) || (Number.isFinite(deadline) && remainingBudgetMs(deadline) <= 0)) {
        throw failoverBudgetError();
      }
      console.warn(`Gemini fallback model key ${keyIndex + 1} failed: ${error.message}`);
    }
  }
  throw lastError || new Error("Gemini fallback model failed.");
}

async function getGeminiReply(messages, isFirstMessage) {
  const keys = getGeminiApiKeys();
  if (!keys.length) {
    console.warn("No Gemini API key is configured; using deterministic demo fallback.");
    opsStats.recordDeterministicFallback("no_gemini_key");
    return getFallbackReply(messages);
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const fallbackModel = String(process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite").trim();
  const deadline = Date.now() + GEMINI_FAILOVER_BUDGET_MS;

  try {
    return await tryPrimaryGeminiKeys(messages, isFirstMessage, keys, model, deadline);
  } catch (primaryError) {
    if (isFailoverBudgetError(primaryError) || remainingBudgetMs(deadline) <= 0) {
      console.warn("Gemini failover budget exhausted; using deterministic demo fallback.");
      opsStats.recordDeterministicFallback("primary_failover_budget_exhausted");
      return getFallbackReply(messages);
    }
    console.warn(`All primary Gemini attempts failed: ${primaryError.message}`);
  }

  if (fallbackModel && fallbackModel !== model && remainingBudgetMs(deadline) > 0) {
    opsStats.recordCounter("gemini_fallback_model_uses");
    try {
      return await tryFallbackGeminiModel(messages, isFirstMessage, keys, fallbackModel, deadline);
    } catch (fallbackError) {
      if (isFailoverBudgetError(fallbackError) || remainingBudgetMs(deadline) <= 0) {
        console.warn("Gemini failover budget exhausted during fallback model; using deterministic demo fallback.");
        opsStats.recordDeterministicFallback("fallback_model_budget_exhausted");
        return getFallbackReply(messages);
      }
      console.warn(`Gemini fallback model exhausted: ${fallbackError.message}`);
    }
  }

  console.warn("Gemini unavailable after failover chain; using deterministic demo fallback.");
  opsStats.recordDeterministicFallback("gemini_chain_exhausted");
  return getFallbackReply(messages);
}

async function getReply(messages, isFirstMessage = false) {
  const startedAt = Date.now();
  try {
    const safetyReply = enforceSafetyRules(messages);
    if (safetyReply) return safetyReply;

    const ruleReply = enforceBookingRules(messages);
    if (ruleReply) return ruleReply;

    try {
      if (provider === "mock") return getFallbackReply(messages);
      if (provider === "claude") return await getClaudeReply(messages, isFirstMessage);
      if (provider === "gemini") return await getGeminiReply(messages, isFirstMessage);
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
    geminiThinkingConfig,
    buildGeminiRequest,
    getGeminiApiKeys,
    isRetryableGeminiError,
    isFailoverBudgetError,
    remainingBudgetMs,
    requestTimeoutMs,
    requestGemini,
    tryPrimaryGeminiKeys,
    tryFallbackGeminiModel,
  },
};
