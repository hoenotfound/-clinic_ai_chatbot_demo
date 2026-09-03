const shared = require("./sharedState");

const TIMEZONE = String(process.env.DEMO_STATS_TIMEZONE || "Asia/Kuala_Lumpur").trim() || "Asia/Kuala_Lumpur";
const ACTIVE_WINDOW_MS = 2 * 60_000;
const RETENTION_SECONDS = 35 * 24 * 60 * 60;
const KEY_STATUS_WINDOW_MS = 15 * 60_000;

const memory = {
  countersByDay: new Map(),
  uniqueByDay: new Map(),
  uniqueBySurfaceDay: new Map(),
  activeVisitors: new Map(),
  activeBySurface: new Map(),
  keyByDay: new Map(),
  metaByDay: new Map(),
};

function localDayKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function safeCounterName(name) {
  const normalized = String(name || "").trim().toLowerCase().replace(/[^a-z0-9_:-]/g, "_").slice(0, 80);
  return normalized || "unknown";
}

function safeVisitorId(id) {
  const normalized = String(id || "").trim().slice(0, 128);
  return /^[A-Za-z0-9._:-]{8,128}$/.test(normalized) ? normalized : null;
}

function safeSurface(surface) {
  const value = String(surface || "patient").toLowerCase();
  return value === "dashboard" ? "dashboard" : "patient";
}

function dayCounters(day) {
  if (!memory.countersByDay.has(day)) memory.countersByDay.set(day, {});
  return memory.countersByDay.get(day);
}

function dayMeta(day) {
  if (!memory.metaByDay.has(day)) memory.metaByDay.set(day, {});
  return memory.metaByDay.get(day);
}

function uniqueSet(day, surface = null) {
  const map = surface ? memory.uniqueBySurfaceDay : memory.uniqueByDay;
  const key = surface ? `${day}:${surface}` : day;
  if (!map.has(key)) map.set(key, new Set());
  return map.get(key);
}

function keyStats(day, keyIndex) {
  const key = `${day}:${keyIndex}`;
  if (!memory.keyByDay.has(key)) {
    memory.keyByDay.set(key, {
      attempts: 0,
      successes: 0,
      failures: 0,
      quotaHits: 0,
      promptTokens: 0,
      outputTokens: 0,
      thoughtTokens: 0,
      cachedTokens: 0,
      totalTokens: 0,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastErrorStatus: null,
      lastErrorMessage: null,
      lastModel: null,
      lastPhase: null,
    });
  }
  return memory.keyByDay.get(key);
}

function redisCountersKey(day) { return `demo:ops:counters:${day}`; }
function redisMetaKey(day) { return `demo:ops:meta:${day}`; }
function redisUniqueKey(day) { return `demo:ops:unique:${day}`; }
function redisSurfaceUniqueKey(day, surface) { return `demo:ops:unique:${surface}:${day}`; }
function redisActiveKey(surface = "all") { return `demo:ops:active:${surface}`; }
function redisKeyStatsKey(day, keyIndex) { return `demo:ops:gemini:key:${keyIndex}:${day}`; }

function recordCounter(name, amount = 1) {
  const field = safeCounterName(name);
  const numericAmount = Number.isFinite(Number(amount)) ? Number(amount) : 1;
  const day = localDayKey();
  const counters = dayCounters(day);
  counters[field] = (Number(counters[field]) || 0) + numericAmount;

  void shared.withRedis(async (redis) => {
    const key = redisCountersKey(day);
    await redis.hincrby(key, field, numericAmount);
    await redis.expire(key, RETENTION_SECONDS);
  });
}

function setMeta(field, value) {
  const day = localDayKey();
  const safeField = safeCounterName(field);
  const safeValue = String(value ?? "").slice(0, 1200);
  dayMeta(day)[safeField] = safeValue;
  void shared.withRedis(async (redis) => {
    const key = redisMetaKey(day);
    await redis.hset(key, safeField, safeValue);
    await redis.expire(key, RETENTION_SECONDS);
  });
}

function recordVisitor({ visitorId, event = "heartbeat", surface = "patient" } = {}) {
  const id = safeVisitorId(visitorId);
  if (!id) return false;
  const day = localDayKey();
  const now = Date.now();
  const normalizedSurface = safeSurface(surface);
  uniqueSet(day).add(id);
  uniqueSet(day, normalizedSurface).add(id);
  memory.activeVisitors.set(id, now);
  if (!memory.activeBySurface.has(normalizedSurface)) memory.activeBySurface.set(normalizedSurface, new Map());
  memory.activeBySurface.get(normalizedSurface).set(id, now);

  const normalizedEvent = safeCounterName(event);
  if (normalizedEvent !== "heartbeat") recordCounter(normalizedEvent);

  void shared.withRedis(async (redis) => {
    const uniqueKey = redisUniqueKey(day);
    const surfaceUniqueKey = redisSurfaceUniqueKey(day, normalizedSurface);
    const activeKey = redisActiveKey();
    const surfaceActiveKey = redisActiveKey(normalizedSurface);
    const pipeline = redis.multi();
    pipeline.pfadd(uniqueKey, id);
    pipeline.expire(uniqueKey, RETENTION_SECONDS);
    pipeline.pfadd(surfaceUniqueKey, id);
    pipeline.expire(surfaceUniqueKey, RETENTION_SECONDS);
    pipeline.zadd(activeKey, now, id);
    pipeline.expire(activeKey, 24 * 60 * 60);
    pipeline.zadd(surfaceActiveKey, now, id);
    pipeline.expire(surfaceActiveKey, 24 * 60 * 60);
    await pipeline.exec();
  });
  return true;
}

function recordGeminiAttempt({ keyIndex, model, phase = "primary" } = {}) {
  const normalizedKeyIndex = Number(keyIndex) || 0;
  const day = localDayKey();
  const stats = keyStats(day, normalizedKeyIndex);
  stats.attempts += 1;
  stats.lastModel = String(model || "").slice(0, 120);
  stats.lastPhase = String(phase || "").slice(0, 40);
  recordCounter("gemini_api_attempts");

  void shared.withRedis(async (redis) => {
    const key = redisKeyStatsKey(day, normalizedKeyIndex);
    const pipeline = redis.multi();
    pipeline.hincrby(key, "attempts", 1);
    pipeline.hset(key, "lastModel", stats.lastModel, "lastPhase", stats.lastPhase);
    pipeline.expire(key, RETENTION_SECONDS);
    await pipeline.exec();
  });
}

function usageNumbers(usageMetadata = {}) {
  return {
    promptTokens: Number(usageMetadata.promptTokenCount) || 0,
    outputTokens: Number(usageMetadata.candidatesTokenCount) || 0,
    thoughtTokens: Number(usageMetadata.thoughtsTokenCount) || 0,
    cachedTokens: Number(usageMetadata.cachedContentTokenCount) || 0,
    totalTokens: Number(usageMetadata.totalTokenCount) || 0,
  };
}

function recordGeminiSuccess({ keyIndex, model, phase = "primary", usageMetadata = {} } = {}) {
  const normalizedKeyIndex = Number(keyIndex) || 0;
  const day = localDayKey();
  const now = Date.now();
  const usage = usageNumbers(usageMetadata);
  const stats = keyStats(day, normalizedKeyIndex);
  stats.successes += 1;
  stats.promptTokens += usage.promptTokens;
  stats.outputTokens += usage.outputTokens;
  stats.thoughtTokens += usage.thoughtTokens;
  stats.cachedTokens += usage.cachedTokens;
  stats.totalTokens += usage.totalTokens;
  stats.lastSuccessAt = now;
  stats.lastModel = String(model || "").slice(0, 120);
  stats.lastPhase = String(phase || "").slice(0, 40);

  recordCounter("gemini_api_successes");
  if (phase === "fallback_model") recordCounter("gemini_fallback_model_successes");
  recordCounter("gemini_prompt_tokens", usage.promptTokens);
  recordCounter("gemini_output_tokens", usage.outputTokens);
  recordCounter("gemini_thought_tokens", usage.thoughtTokens);
  recordCounter("gemini_cached_tokens", usage.cachedTokens);
  recordCounter("gemini_total_tokens", usage.totalTokens);
  setMeta("gemini_last_success_at", now);

  void shared.withRedis(async (redis) => {
    const key = redisKeyStatsKey(day, normalizedKeyIndex);
    const pipeline = redis.multi();
    pipeline.hincrby(key, "successes", 1);
    pipeline.hincrby(key, "promptTokens", usage.promptTokens);
    pipeline.hincrby(key, "outputTokens", usage.outputTokens);
    pipeline.hincrby(key, "thoughtTokens", usage.thoughtTokens);
    pipeline.hincrby(key, "cachedTokens", usage.cachedTokens);
    pipeline.hincrby(key, "totalTokens", usage.totalTokens);
    pipeline.hset(key, "lastSuccessAt", now, "lastModel", stats.lastModel, "lastPhase", stats.lastPhase);
    pipeline.expire(key, RETENTION_SECONDS);
    await pipeline.exec();
  });
}

function isQuotaError(error) {
  return error?.statusCode === 429 || error?.apiStatus === "RESOURCE_EXHAUSTED";
}

function recordGeminiFailure({ keyIndex, model, phase = "primary", error } = {}) {
  const normalizedKeyIndex = Number(keyIndex) || 0;
  const day = localDayKey();
  const now = Date.now();
  const stats = keyStats(day, normalizedKeyIndex);
  const status = String(error?.apiStatus || error?.statusCode || error?.code || "ERROR").slice(0, 120);
  const message = String(error?.message || "Gemini request failed").slice(0, 900);
  const quotaHit = isQuotaError(error);
  stats.failures += 1;
  stats.lastErrorAt = now;
  stats.lastErrorStatus = status;
  stats.lastErrorMessage = message;
  stats.lastModel = String(model || "").slice(0, 120);
  stats.lastPhase = String(phase || "").slice(0, 40);
  if (quotaHit) stats.quotaHits += 1;

  recordCounter("gemini_api_failures");
  if (quotaHit) {
    recordCounter("gemini_quota_hits");
    setMeta("gemini_last_quota_hit_at", now);
    setMeta("gemini_last_quota_message", message);
  }
  setMeta("gemini_last_error_at", now);
  setMeta("gemini_last_error_status", status);

  void shared.withRedis(async (redis) => {
    const key = redisKeyStatsKey(day, normalizedKeyIndex);
    const pipeline = redis.multi();
    pipeline.hincrby(key, "failures", 1);
    if (quotaHit) pipeline.hincrby(key, "quotaHits", 1);
    pipeline.hset(
      key,
      "lastErrorAt", now,
      "lastErrorStatus", status,
      "lastErrorMessage", message,
      "lastModel", stats.lastModel,
      "lastPhase", stats.lastPhase
    );
    pipeline.expire(key, RETENTION_SECONDS);
    await pipeline.exec();
  });
}

function recordDeterministicFallback(reason = "gemini_unavailable") {
  recordCounter("deterministic_fallbacks");
  setMeta("last_deterministic_fallback_at", Date.now());
  setMeta("last_deterministic_fallback_reason", String(reason || "unknown").slice(0, 240));
}

function cleanupMemoryActive(now = Date.now()) {
  const cutoff = now - ACTIVE_WINDOW_MS;
  for (const [id, lastSeen] of memory.activeVisitors) {
    if (lastSeen < cutoff) memory.activeVisitors.delete(id);
  }
  for (const visitors of memory.activeBySurface.values()) {
    for (const [id, lastSeen] of visitors) {
      if (lastSeen < cutoff) visitors.delete(id);
    }
  }
}

function numericObject(raw = {}) {
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Number(value) || 0]));
}

function normalizeKeySnapshot(raw = {}) {
  const numericFields = ["attempts", "successes", "failures", "quotaHits", "promptTokens", "outputTokens", "thoughtTokens", "cachedTokens", "totalTokens"];
  const result = { ...raw };
  for (const field of numericFields) result[field] = Number(raw[field]) || 0;
  result.lastSuccessAt = raw.lastSuccessAt ? Number(raw.lastSuccessAt) : null;
  result.lastErrorAt = raw.lastErrorAt ? Number(raw.lastErrorAt) : null;
  return result;
}

function keyHealth(stats) {
  if (!stats.attempts) return "unused";
  if (stats.lastSuccessAt && (!stats.lastErrorAt || stats.lastSuccessAt >= stats.lastErrorAt)) return "healthy";
  if (stats.quotaHits && stats.lastErrorAt && Date.now() - stats.lastErrorAt <= KEY_STATUS_WINDOW_MS) return "rate_limited";
  if (stats.lastErrorAt) return "error";
  return "unknown";
}

async function redisSnapshot(day) {
  return shared.withRedis(async (redis) => {
    const cutoff = Date.now() - ACTIVE_WINDOW_MS;
    const pipeline = redis.multi();
    pipeline.zremrangebyscore(redisActiveKey(), 0, cutoff);
    pipeline.zremrangebyscore(redisActiveKey("patient"), 0, cutoff);
    pipeline.zremrangebyscore(redisActiveKey("dashboard"), 0, cutoff);
    pipeline.hgetall(redisCountersKey(day));
    pipeline.hgetall(redisMetaKey(day));
    pipeline.pfcount(redisUniqueKey(day));
    pipeline.pfcount(redisSurfaceUniqueKey(day, "patient"));
    pipeline.pfcount(redisSurfaceUniqueKey(day, "dashboard"));
    pipeline.zcard(redisActiveKey());
    pipeline.zcard(redisActiveKey("patient"));
    pipeline.zcard(redisActiveKey("dashboard"));
    pipeline.hgetall(redisKeyStatsKey(day, 1));
    pipeline.hgetall(redisKeyStatsKey(day, 2));
    const results = await pipeline.exec();
    const value = (index) => results[index]?.[1];
    return {
      counters: numericObject(value(3) || {}),
      meta: value(4) || {},
      uniqueVisitors: Number(value(5)) || 0,
      uniquePatientVisitors: Number(value(6)) || 0,
      uniqueDashboardVisitors: Number(value(7)) || 0,
      activeVisitors: Number(value(8)) || 0,
      activePatientVisitors: Number(value(9)) || 0,
      activeDashboardVisitors: Number(value(10)) || 0,
      keys: [normalizeKeySnapshot(value(11) || {}), normalizeKeySnapshot(value(12) || {})],
    };
  }, null);
}

async function getSnapshot() {
  const day = localDayKey();
  cleanupMemoryActive();
  const persistent = await redisSnapshot(day);
  const counters = persistent?.counters || numericObject(dayCounters(day));
  const meta = persistent?.meta || dayMeta(day);
  const keys = persistent?.keys || [keyStats(day, 1), keyStats(day, 2)].map((item) => ({ ...item }));
  const uniqueVisitors = persistent?.uniqueVisitors ?? uniqueSet(day).size;
  const uniquePatientVisitors = persistent?.uniquePatientVisitors ?? uniqueSet(day, "patient").size;
  const uniqueDashboardVisitors = persistent?.uniqueDashboardVisitors ?? uniqueSet(day, "dashboard").size;
  const activeVisitors = persistent?.activeVisitors ?? memory.activeVisitors.size;
  const activePatientVisitors = persistent?.activePatientVisitors ?? (memory.activeBySurface.get("patient")?.size || 0);
  const activeDashboardVisitors = persistent?.activeDashboardVisitors ?? (memory.activeBySurface.get("dashboard")?.size || 0);
  const lastQuotaAt = Number(meta.gemini_last_quota_hit_at) || null;
  const quotaRecentlyHit = Boolean(lastQuotaAt && Date.now() - lastQuotaAt <= KEY_STATUS_WINDOW_MS);

  return {
    day,
    timezone: TIMEZONE,
    generatedAt: Date.now(),
    storage: shared.enabled ? "redis" : "memory",
    visitors: {
      active: activeVisitors,
      activePatient: activePatientVisitors,
      activeDashboard: activeDashboardVisitors,
      uniqueToday: uniqueVisitors,
      uniquePatientToday: uniquePatientVisitors,
      uniqueDashboardToday: uniqueDashboardVisitors,
    },
    counters,
    gemini: {
      attempts: counters.gemini_api_attempts || 0,
      successes: counters.gemini_api_successes || 0,
      failures: counters.gemini_api_failures || 0,
      quotaHits: counters.gemini_quota_hits || 0,
      fallbackModelSuccesses: counters.gemini_fallback_model_successes || 0,
      deterministicFallbacks: counters.deterministic_fallbacks || 0,
      tokens: {
        prompt: counters.gemini_prompt_tokens || 0,
        output: counters.gemini_output_tokens || 0,
        thoughts: counters.gemini_thought_tokens || 0,
        cached: counters.gemini_cached_tokens || 0,
        total: counters.gemini_total_tokens || 0,
      },
      quotaStatus: quotaRecentlyHit ? "rate_limited" : "no_recent_limit",
      lastQuotaHitAt: lastQuotaAt,
      lastQuotaMessage: meta.gemini_last_quota_message || null,
      lastErrorAt: Number(meta.gemini_last_error_at) || null,
      lastErrorStatus: meta.gemini_last_error_status || null,
      lastSuccessAt: Number(meta.gemini_last_success_at) || null,
      keys: keys.map((stats, index) => ({
        index: index + 1,
        health: keyHealth(stats),
        ...stats,
      })),
    },
  };
}

module.exports = {
  recordCounter,
  recordVisitor,
  recordGeminiAttempt,
  recordGeminiSuccess,
  recordGeminiFailure,
  recordDeterministicFallback,
  getSnapshot,
  _test: {
    localDayKey,
    safeVisitorId,
    safeSurface,
    keyHealth,
    usageNumbers,
    isQuotaError,
  },
};
