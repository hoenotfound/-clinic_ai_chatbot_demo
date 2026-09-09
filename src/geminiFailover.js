function positiveIntEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function nonNegativeIntEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function createGeminiFailover({ buildPrompt, opsStats, fetchJson }) {
  const primaryTimeoutMs = positiveIntEnv("GEMINI_ATTEMPT_TIMEOUT_MS", 8000);
  const fallbackTimeoutMs = positiveIntEnv("GEMINI_FALLBACK_ATTEMPT_TIMEOUT_MS", 5000);
  const failoverBudgetMs = positiveIntEnv("GEMINI_FAILOVER_BUDGET_MS", 15000);
  const fallbackReserveMs = positiveIntEnv("GEMINI_FALLBACK_RESERVE_MS", 5500);
  const compatibilityRetryDelayMs = nonNegativeIntEnv("GEMINI_RETRY_DELAY_MS", 0);
  const keyCooldownMs = positiveIntEnv("GEMINI_KEY_COOLDOWN_MS", 60000);
  const quotaCooldownMs = positiveIntEnv("GEMINI_QUOTA_COOLDOWN_MS", 15 * 60_000);
  const modelCooldownMs = positiveIntEnv("GEMINI_MODEL_COOLDOWN_MS", 60000);
  const timeoutModelCooldownMs = positiveIntEnv("GEMINI_TIMEOUT_MODEL_COOLDOWN_MS", 30000);
  const timeoutStreakThreshold = positiveIntEnv("GEMINI_TIMEOUT_STREAK_THRESHOLD", 2);

  const keyCooldowns = new Map();
  const routeCooldowns = new Map();
  const modelCooldowns = new Map();
  const timeoutStreaks = new Map();

  function getApiKeys() {
    const candidates = [];
    if (process.env.GEMINI_API_KEYS) {
      candidates.push(...String(process.env.GEMINI_API_KEYS).split(/[\n,;]/));
    }
    candidates.push(
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4,
      process.env.GEMINI_API_KEY_5
    );
    return [...new Set(candidates.map((value) => String(value || "").trim()).filter(Boolean))];
  }

  function thinkingConfig(model) {
    const normalized = String(model || "").toLowerCase();
    if (/^gemini-2\.5-flash(?:-lite)?(?:-|$)/.test(normalized)) {
      return { thinkingConfig: { thinkingBudget: 0 } };
    }
    if (/^gemini-3(?:[.-]|$)/.test(normalized)) {
      return { thinkingConfig: { thinkingLevel: normalized.includes("flash") ? "minimal" : "low" } };
    }
    return {};
  }

  function buildRequest(messages, isFirstMessage, model, { omitThinking = false } = {}) {
    const generationConfig = { maxOutputTokens: omitThinking ? 900 : 550 };
    if (!omitThinking) Object.assign(generationConfig, thinkingConfig(model));
    return {
      systemInstruction: { parts: [{ text: buildPrompt(isFirstMessage) }] },
      contents: messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: String(message.content || "") }],
      })),
      generationConfig,
    };
  }

  function failoverBudgetError() {
    const error = new Error("Gemini failover budget exhausted.");
    error.code = "GEMINI_FAILOVER_BUDGET_EXHAUSTED";
    error.statusCode = 408;
    return error;
  }

  function noAvailableKeysError() {
    const error = new Error("All configured Gemini keys are temporarily cooling down for this model.");
    error.code = "GEMINI_NO_AVAILABLE_KEYS";
    error.statusCode = 429;
    return error;
  }

  function modelCoolingDownError(model) {
    const error = new Error(`Gemini model ${model} is temporarily cooling down.`);
    error.code = "GEMINI_MODEL_COOLING_DOWN";
    error.statusCode = 503;
    return error;
  }

  function isFailoverBudgetError(error) {
    return error?.code === "GEMINI_FAILOVER_BUDGET_EXHAUSTED";
  }

  function remainingBudgetMs(deadline) {
    if (!Number.isFinite(deadline)) return Number.POSITIVE_INFINITY;
    return Math.max(0, deadline - Date.now());
  }

  function timing(deadline, attemptTimeoutMs = primaryTimeoutMs) {
    if (!Number.isFinite(deadline)) return { timeoutMs: attemptTimeoutMs, budgetLimited: false };
    const remaining = remainingBudgetMs(deadline);
    if (remaining <= 0) throw failoverBudgetError();
    return {
      timeoutMs: Math.max(1, Math.min(attemptTimeoutMs, remaining)),
      budgetLimited: remaining <= attemptTimeoutMs,
    };
  }

  function requestTimeout(deadline) {
    return timing(deadline).timeoutMs;
  }

  function extractText(data) {
    return data.candidates?.[0]?.content?.parts
      ?.filter((part) => typeof part.text === "string")
      .map((part) => part.text)
      .join("")
      .trim() || "";
  }

  function classify(error) {
    if (error?.code === "GEMINI_FAILOVER_BUDGET_EXHAUSTED") return "budget";
    if (error?.code === "AI_REQUEST_TIMEOUT" || error?.statusCode === 408) return "timeout";
    if (error?.code === "GEMINI_NO_AVAILABLE_KEYS") return "cooldown";
    if (error?.code === "GEMINI_MODEL_COOLING_DOWN") return "model_cooldown";
    const status = Number(error?.statusCode) || 0;
    const apiStatus = String(error?.apiStatus || "").toUpperCase();
    const message = `${String(error?.message || "")} ${JSON.stringify(error?.apiDetails || [])}`.toLowerCase();
    if ((status === 404 || apiStatus === "NOT_FOUND") && /model|models\//.test(message)) return "model_not_found";
    if (status === 401 || status === 403 || /api key not valid|permission denied|unauthenticated/.test(message)) return "auth";
    if (status === 429 || apiStatus === "RESOURCE_EXHAUSTED") {
      if (/rate.?limit|requests? per|too many requests/.test(message)) return "rate_limit";
      return "quota";
    }
    if (status === 503 || apiStatus === "UNAVAILABLE") return "unavailable";
    if (/empty response/i.test(message)) return "empty";
    if (status >= 500) return "server";
    if (status === 409) return "conflict";
    if (status >= 400) return "client";
    return "other";
  }

  function isRetryable(error) {
    return ["timeout", "rate_limit", "quota", "unavailable", "model_not_found", "server", "conflict", "other"].includes(classify(error));
  }

  function isThinkingCompatibilityError(error) {
    const status = Number(error?.statusCode) || 0;
    const apiStatus = String(error?.apiStatus || "").toUpperCase();
    if (status !== 400 || (apiStatus && apiStatus !== "INVALID_ARGUMENT")) return false;
    const message = `${String(error?.message || "")} ${JSON.stringify(error?.apiDetails || [])}`.toLowerCase();
    return /thinking.?config|thinking.?level|thinking.?budget|generation.?config[^]{0,120}thinking/.test(message);
  }

  function activeCooldown(map, key) {
    const entry = map.get(key);
    if (!entry) return null;
    if (entry.until <= Date.now()) {
      map.delete(key);
      return null;
    }
    return entry;
  }

  function routeKey(key, model) {
    return `${key}\u0000${model}`;
  }

  function keyCooldown(key, model = null) {
    const global = activeCooldown(keyCooldowns, key);
    if (global || !model) return global;
    return activeCooldown(routeCooldowns, routeKey(key, model));
  }

  function modelCooldown(model) {
    return activeCooldown(modelCooldowns, model);
  }

  function resetCooldowns() {
    keyCooldowns.clear();
    routeCooldowns.clear();
    modelCooldowns.clear();
    timeoutStreaks.clear();
  }

  function cooldownSeconds(entry) {
    return entry ? Math.max(1, Math.ceil((entry.until - Date.now()) / 1000)) : 0;
  }

  function applyCooldown(key, model, error) {
    const type = classify(error);
    const route = routeKey(key, model);

    if (type === "timeout") {
      const streak = (timeoutStreaks.get(model) || 0) + 1;
      if (streak >= timeoutStreakThreshold) {
        modelCooldowns.set(model, { reason: type, until: Date.now() + timeoutModelCooldownMs });
        timeoutStreaks.delete(model);
        opsStats.recordCounter("gemini_timeout_cooldowns");
      } else {
        timeoutStreaks.set(model, streak);
      }
      return type;
    }

    if (type === "quota") {
      routeCooldowns.set(route, { reason: type, until: Date.now() + quotaCooldownMs });
    } else if (type === "rate_limit") {
      routeCooldowns.set(route, { reason: type, until: Date.now() + keyCooldownMs });
    } else if (type === "auth") {
      keyCooldowns.set(key, { reason: type, until: Date.now() + quotaCooldownMs });
    } else if (type === "unavailable") {
      modelCooldowns.set(model, { reason: type, until: Date.now() + modelCooldownMs });
    } else if (type === "model_not_found") {
      modelCooldowns.set(model, { reason: type, until: Date.now() + Math.max(modelCooldownMs, quotaCooldownMs) });
    }
    return type;
  }

  function sleep(ms) {
    return ms ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
  }

  async function request(messages, isFirstMessage, key, model, label, deadline = null, statsMeta = {}, attemptTimeoutMs = primaryTimeoutMs) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const telemetry = { keyIndex: statsMeta.keyIndex || 0, phase: statsMeta.phase || "primary", model };
    const send = async (body, requestLabel, timeoutMs) => {
      opsStats.recordGeminiAttempt(telemetry);
      const startedAt = Date.now();
      try {
        return await fetchJson(url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify(body),
        }, requestLabel, timeoutMs);
      } catch (error) {
        opsStats.recordGeminiFailure({ ...telemetry, error });
        throw error;
      } finally {
        opsStats.recordLatency("gemini_request", Date.now() - startedAt);
      }
    };

    let data;
    const body = buildRequest(messages, isFirstMessage, model);
    const firstTiming = timing(deadline, attemptTimeoutMs);
    try {
      data = await send(body, label, firstTiming.timeoutMs);
    } catch (error) {
      if (firstTiming.budgetLimited && error?.code === "AI_REQUEST_TIMEOUT") throw failoverBudgetError();
      if (Number.isFinite(deadline) && remainingBudgetMs(deadline) <= 0) throw failoverBudgetError();
      const hasThinking = Boolean(body.generationConfig?.thinkingConfig);
      if (!hasThinking || !isThinkingCompatibilityError(error)) throw error;
      console.warn(`${label} rejected thinkingConfig for ${model}; retrying once without thinkingConfig.`);
      opsStats.recordCounter("gemini_retries");
      opsStats.recordCounter("gemini_compatibility_retries");
      await sleep(compatibilityRetryDelayMs);
      const retryBody = buildRequest(messages, isFirstMessage, model, { omitThinking: true });
      const retryTiming = timing(deadline, attemptTimeoutMs);
      try {
        data = await send(retryBody, `${label} compatibility retry`, retryTiming.timeoutMs);
      } catch (retryError) {
        if (retryTiming.budgetLimited && retryError?.code === "AI_REQUEST_TIMEOUT") throw failoverBudgetError();
        throw retryError;
      }
    }

    const text = extractText(data);
    if (!text) {
      const error = new Error(`${label} returned an empty response.`);
      error.statusCode = 502;
      opsStats.recordGeminiFailure({ ...telemetry, error });
      throw error;
    }
    timeoutStreaks.delete(model);
    opsStats.recordGeminiSuccess({ ...telemetry, usageMetadata: data?.usageMetadata || {} });
    return text;
  }

  function logFailure(label, model, error, action) {
    console.warn(`${label} failed [${classify(error)}] on ${model}: ${error.message}${action ? `; ${action}` : ""}`);
  }

  function shouldRotateKey(type, { switchModelOnTimeout = false } = {}) {
    if (type === "timeout") return !switchModelOnTimeout;
    return ["quota", "rate_limit", "auth"].includes(type);
  }

  async function tryKeys(messages, isFirstMessage, keys, model, deadline, phase, attemptTimeoutMs, options = {}) {
    const cooledModel = modelCooldown(model);
    if (cooledModel) {
      opsStats.recordCounter("gemini_model_cooldown_skips");
      throw modelCoolingDownError(model);
    }

    let lastError = null;
    let attempted = 0;
    for (let index = 0; index < keys.length; index += 1) {
      if (Number.isFinite(deadline) && remainingBudgetMs(deadline) <= 0) throw failoverBudgetError();
      const cooledKey = keyCooldown(keys[index], model);
      if (cooledKey) {
        opsStats.recordCounter("gemini_key_cooldown_skips");
        console.warn(`Gemini key ${index + 1} skipped for ${model} [${cooledKey.reason}] for another ${cooldownSeconds(cooledKey)}s.`);
        continue;
      }
      if (attempted > 0) opsStats.recordCounter("gemini_key_failovers");
      attempted += 1;
      const label = phase === "fallback_model" ? `Gemini fallback model key ${index + 1}` : `Gemini key ${index + 1}`;
      try {
        return await request(messages, isFirstMessage, keys[index], model, label, deadline, { keyIndex: index + 1, phase }, attemptTimeoutMs);
      } catch (error) {
        lastError = error;
        if (isFailoverBudgetError(error) || (Number.isFinite(deadline) && remainingBudgetMs(deadline) <= 0)) throw failoverBudgetError();
        const type = applyCooldown(keys[index], model, error);

        if (!shouldRotateKey(type, options)) {
          const state = modelCooldown(model);
          if (state) {
            logFailure(label, model, error, `cooling this model for ${cooldownSeconds(state)}s and switching model`);
          } else {
            logFailure(label, model, error, "switching model without retrying the same failure on another key");
          }
          break;
        }

        const state = keyCooldown(keys[index], model);
        if (state) logFailure(label, model, error, `cooling this key/model route for ${cooldownSeconds(state)}s and rotating immediately`);
        else logFailure(label, model, error, "rotating immediately");
      }
    }
    if (!attempted) throw noAvailableKeysError();
    throw lastError || new Error(`Gemini ${phase} attempts failed.`);
  }

  function tryPrimary(messages, isFirstMessage, keys, model, deadline = null, options = {}) {
    return tryKeys(messages, isFirstMessage, keys, model, deadline, "primary", primaryTimeoutMs, options);
  }

  function tryFallback(messages, isFirstMessage, keys, model, deadline = null, options = {}) {
    return tryKeys(messages, isFirstMessage, keys, model, deadline, "fallback_model", fallbackTimeoutMs, options);
  }

  async function getReply(messages, isFirstMessage, fallbackReply) {
    const keys = getApiKeys();
    if (!keys.length) {
      console.warn("No Gemini API key is configured; using deterministic demo fallback.");
      opsStats.recordDeterministicFallback("no_gemini_key");
      return fallbackReply();
    }

    const model = String(process.env.GEMINI_MODEL || "gemini-3.6-flash").trim();
    const fallbackModel = String(process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite").trim();
    const deadline = Date.now() + failoverBudgetMs;
    const hasFallbackModel = Boolean(fallbackModel && fallbackModel !== model);
    const primaryDeadline = hasFallbackModel
      ? Math.max(Date.now() + 1, deadline - Math.min(fallbackReserveMs, Math.max(0, failoverBudgetMs - 1)))
      : deadline;

    try {
      return await tryPrimary(messages, isFirstMessage, keys, model, primaryDeadline, { switchModelOnTimeout: true });
    } catch (error) {
      if (remainingBudgetMs(deadline) <= 0) {
        console.warn("Gemini total failover time exhausted after primary attempts; using conversation-aware deterministic fallback.");
        opsStats.recordDeterministicFallback("primary_failover_budget_exhausted");
        return fallbackReply();
      }
      if (isFailoverBudgetError(error) && hasFallbackModel) {
        console.warn(`Primary Gemini time reserve exhausted; preserving ${remainingBudgetMs(deadline)}ms for the fallback model.`);
      } else {
        console.warn(`Primary Gemini path unavailable [${classify(error)}]: ${error.message}`);
      }
    }

    if (hasFallbackModel && remainingBudgetMs(deadline) > 0) {
      opsStats.recordCounter("gemini_fallback_model_uses");
      try {
        return await tryFallback(messages, isFirstMessage, keys, fallbackModel, deadline, { switchModelOnTimeout: true });
      } catch (error) {
        if (isFailoverBudgetError(error) || remainingBudgetMs(deadline) <= 0) {
          console.warn("Gemini total failover time exhausted during fallback model; using conversation-aware deterministic fallback.");
          opsStats.recordDeterministicFallback("fallback_model_budget_exhausted");
          return fallbackReply();
        }
        console.warn(`Gemini fallback model unavailable [${classify(error)}]: ${error.message}`);
      }
    }

    console.warn("Gemini unavailable after fast failover chain; using conversation-aware deterministic fallback.");
    opsStats.recordDeterministicFallback("gemini_chain_exhausted");
    return fallbackReply();
  }

  return {
    getReply,
    getApiKeys,
    thinkingConfig,
    buildRequest,
    classify,
    isRetryable,
    isThinkingCompatibilityError,
    isFailoverBudgetError,
    remainingBudgetMs,
    requestTimeout,
    request,
    tryPrimary,
    tryFallback,
    keyCooldown,
    modelCooldown,
    resetCooldowns,
  };
}

module.exports = { createGeminiFailover };
