const shared = require("./sharedState");

const TIMEZONE = String(process.env.DEMO_STATS_TIMEZONE || "Asia/Kuala_Lumpur").trim() || "Asia/Kuala_Lumpur";
const ACTIVE_WINDOW_MS = 2 * 60_000;
const RETENTION_DAYS = 400;
const RETENTION_SECONDS = RETENTION_DAYS * 24 * 60 * 60;
const HISTORY_DAYS = 90;
const KEY_STATUS_WINDOW_MS = 15 * 60_000;
const SLOW_RESPONSE_MS = Math.max(500, Number.parseInt(process.env.DEMO_SLOW_RESPONSE_MS || "4000", 10) || 4000);
const LATENCY_BUCKETS_MS = [250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000, 12000, 16000, 20000, 30000, 60000];
const HISTORY_EVENTS = [
  "patient_view",
  "demo_started",
  "message_1",
  "message_3",
  "dashboard_view",
  "human_takeover",
  "journey_complete",
  "sales_cta_clicks",
];

const memory = {
  countersByDay: new Map(),
  uniqueByDay: new Map(),
  uniqueBySurfaceDay: new Map(),
  uniqueByEventDay: new Map(),
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

function recentDayKeys(count, now = new Date()) {
  const keys = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    keys.push(localDayKey(new Date(now.getTime() - (index * 24 * 60 * 60_000))));
  }
  return keys;
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

function eventUniqueSet(day, event) {
  const key = `${day}:${safeCounterName(event)}`;
  if (!memory.uniqueByEventDay.has(key)) memory.uniqueByEventDay.set(key, new Set());
  return memory.uniqueByEventDay.get(key);
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
function redisEventUniqueKey(day, event) { return `demo:ops:event:${safeCounterName(event)}:${day}`; }
function redisActiveKey(surface = "all") { return `demo:ops:active:${surface}`; }
function redisKeyStatsKey(day, keyIndex) { return `demo:ops:gemini:key:${keyIndex}:${day}`; }

function incrementMemoryCounters(day, entries) {
  const counters = dayCounters(day);
  for (const [name, amount] of entries) {
    const field = safeCounterName(name);
    const numericAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
    counters[field] = (Number(counters[field]) || 0) + numericAmount;
  }
}

function recordCounter(name, amount = 1) {
  const field = safeCounterName(name);
  const numericAmount = Number.isFinite(Number(amount)) ? Number(amount) : 1;
  const day = localDayKey();
  incrementMemoryCounters(day, [[field, numericAmount]]);

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
  const normalizedEvent = safeCounterName(event);

  uniqueSet(day).add(id);
  uniqueSet(day, normalizedSurface).add(id);
  memory.activeVisitors.set(id, now);
  if (!memory.activeBySurface.has(normalizedSurface)) memory.activeBySurface.set(normalizedSurface, new Map());
  memory.activeBySurface.get(normalizedSurface).set(id, now);

  if (normalizedEvent !== "heartbeat") {
    eventUniqueSet(day, normalizedEvent).add(id);
    recordCounter(normalizedEvent);
  }

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
    if (normalizedEvent !== "heartbeat") {
      const eventKey = redisEventUniqueKey(day, normalizedEvent);
      pipeline.pfadd(eventKey, id);
      pipeline.expire(eventKey, RETENTION_SECONDS);
    }
    pipeline.zadd(activeKey, now, id);
    pipeline.expire(activeKey, 24 * 60 * 60);
    pipeline.zadd(surfaceActiveKey, now, id);
    pipeline.expire(surfaceActiveKey, 24 * 60 * 60);
    await pipeline.exec();
  });
  return true;
}

function latencyBucketField(metric, upperMs) {
  return `${safeCounterName(metric)}_latency_bucket_le_${upperMs}`;
}

function latencyOverField(metric) {
  return `${safeCounterName(metric)}_latency_bucket_over_${LATENCY_BUCKETS_MS[LATENCY_BUCKETS_MS.length - 1]}`;
}

function latencyDataFromCounters(counters = {}, metric = "ai_response") {
  const normalized = safeCounterName(metric);
  return {
    count: Number(counters[`${normalized}_latency_count`]) || 0,
    sumMs: Number(counters[`${normalized}_latency_sum_ms`]) || 0,
    buckets: LATENCY_BUCKETS_MS.map((upperMs) => ({
      upperMs,
      count: Number(counters[latencyBucketField(normalized, upperMs)]) || 0,
    })),
    overCount: Number(counters[latencyOverField(normalized)]) || 0,
  };
}

function combineLatencyData(items = []) {
  const result = {
    count: 0,
    sumMs: 0,
    buckets: LATENCY_BUCKETS_MS.map((upperMs) => ({ upperMs, count: 0 })),
    overCount: 0,
  };
  for (const item of items) {
    if (!item) continue;
    result.count += Number(item.count) || 0;
    result.sumMs += Number(item.sumMs) || 0;
    result.overCount += Number(item.overCount) || 0;
    result.buckets.forEach((bucket, index) => {
      bucket.count += Number(item.buckets?.[index]?.count) || 0;
    });
  }
  return result;
}

function percentileFromLatencyData(data, percentile) {
  const count = Number(data?.count) || 0;
  if (!count) return 0;
  const target = Math.max(1, Math.ceil(count * percentile));
  let cumulative = 0;
  for (const bucket of data.buckets || []) {
    cumulative += Number(bucket.count) || 0;
    if (cumulative >= target) return bucket.upperMs;
  }
  return LATENCY_BUCKETS_MS[LATENCY_BUCKETS_MS.length - 1];
}

function latencyStats(data) {
  const count = Number(data?.count) || 0;
  return {
    count,
    avgMs: count ? (Number(data.sumMs) || 0) / count : 0,
    p50Ms: percentileFromLatencyData(data, 0.5),
    p95Ms: percentileFromLatencyData(data, 0.95),
  };
}

function recordLatency(metric, durationMs) {
  const normalized = safeCounterName(metric);
  const duration = Math.max(0, Math.round(Number(durationMs) || 0));
  const day = localDayKey();
  const entries = [
    [`${normalized}_latency_count`, 1],
    [`${normalized}_latency_sum_ms`, duration],
  ];
  const upper = LATENCY_BUCKETS_MS.find((value) => duration <= value);
  entries.push([upper ? latencyBucketField(normalized, upper) : latencyOverField(normalized), 1]);
  if (normalized === "ai_response" && duration >= SLOW_RESPONSE_MS) entries.push(["ai_slow_responses", 1]);
  if (normalized === "gemini_request" && duration >= SLOW_RESPONSE_MS) entries.push(["gemini_slow_requests", 1]);
  incrementMemoryCounters(day, entries);

  void shared.withRedis(async (redis) => {
    const key = redisCountersKey(day);
    const pipeline = redis.multi();
    for (const [field, amount] of entries) pipeline.hincrby(key, safeCounterName(field), amount);
    pipeline.expire(key, RETENTION_SECONDS);
    await pipeline.exec();
  });
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

function geminiErrorType(error) {
  if (isQuotaError(error)) return "quota";
  if (error?.code === "AI_REQUEST_TIMEOUT" || error?.statusCode === 408) return "timeout";
  if (/empty response/i.test(String(error?.message || ""))) return "empty";
  const status = Number(error?.statusCode) || 0;
  if (status >= 500) return "server";
  if (status >= 400) return "client";
  return "other";
}

function recordGeminiFailure({ keyIndex, model, phase = "primary", error } = {}) {
  const normalizedKeyIndex = Number(keyIndex) || 0;
  const day = localDayKey();
  const now = Date.now();
  const stats = keyStats(day, normalizedKeyIndex);
  const status = String(error?.apiStatus || error?.statusCode || error?.code || "ERROR").slice(0, 120);
  const message = String(error?.message || "Gemini request failed").slice(0, 900);
  const quotaHit = isQuotaError(error);
  const errorType = geminiErrorType(error);
  stats.failures += 1;
  stats.lastErrorAt = now;
  stats.lastErrorStatus = status;
  stats.lastErrorMessage = message;
  stats.lastModel = String(model || "").slice(0, 120);
  stats.lastPhase = String(phase || "").slice(0, 40);
  if (quotaHit) stats.quotaHits += 1;

  recordCounter("gemini_api_failures");
  recordCounter(`gemini_error_${errorType}`);
  if (errorType === "timeout") recordCounter("gemini_timeouts");
  if (quotaHit) {
    recordCounter("gemini_quota_hits");
    setMeta("gemini_last_quota_hit_at", now);
    setMeta("gemini_last_quota_message", message);
  }
  setMeta("gemini_last_error_at", now);
  setMeta("gemini_last_error_status", status);
  setMeta("gemini_last_error_type", errorType);

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

function funnelFromCounts(visitors, events = {}) {
  const total = Number(visitors) || 0;
  const stage = (name) => Number(events[name]) || 0;
  const rate = (count) => total ? (count / total) * 100 : 0;
  const stages = [
    ["Visitors", total],
    ["Demo started", stage("demo_started")],
    ["Sent 1+ message", stage("message_1")],
    ["Sent 3+ messages", stage("message_3")],
    ["Opened dashboard", stage("dashboard_view")],
    ["Human takeover", stage("human_takeover")],
    ["Completed 4/4", stage("journey_complete")],
    ["Consultation click", stage("sales_cta_clicks")],
  ];
  return {
    visitors: total,
    demoStarted: stage("demo_started"),
    message1: stage("message_1"),
    message3: stage("message_3"),
    dashboard: stage("dashboard_view"),
    takeover: stage("human_takeover"),
    completed: stage("journey_complete"),
    cta: stage("sales_cta_clicks"),
    stages: stages.map(([label, count]) => ({ label, count, rate: rate(count) })),
  };
}

function historyRow(day, counters, visitors, events = {}) {
  const dashboardVisitors = Number(events.dashboard_view) || 0;
  const ctaVisitors = Number(events.sales_cta_clicks) || 0;
  const geminiAttempts = Number(counters.gemini_api_attempts) || 0;
  const geminiSuccesses = Number(counters.gemini_api_successes) || 0;
  const aiLatencyData = latencyDataFromCounters(counters, "ai_response");
  const geminiLatencyData = latencyDataFromCounters(counters, "gemini_request");
  const aiLatency = latencyStats(aiLatencyData);
  const geminiLatency = latencyStats(geminiLatencyData);
  return {
    day,
    visitors: Number(visitors) || 0,
    patientVisitors: Number(events.patient_view) || 0,
    demoStartedVisitors: Number(events.demo_started) || 0,
    message1Visitors: Number(events.message_1) || 0,
    message3Visitors: Number(events.message_3) || 0,
    dashboardVisitors,
    takeoverVisitors: Number(events.human_takeover) || 0,
    completedVisitors: Number(events.journey_complete) || 0,
    ctaVisitors,
    sessions: Number(counters.sessions_started) || 0,
    messages: Number(counters.customer_messages) || 0,
    takeovers: Number(counters.human_takeovers) || 0,
    staffMessages: Number(counters.staff_messages) || 0,
    geminiAttempts,
    geminiSuccesses,
    geminiFailures: Number(counters.gemini_api_failures) || 0,
    retries: Number(counters.gemini_retries) || 0,
    keyFailovers: Number(counters.gemini_key_failovers) || 0,
    fallbackModelUses: Number(counters.gemini_fallback_model_uses) || 0,
    fallbackModelSuccesses: Number(counters.gemini_fallback_model_successes) || 0,
    deterministicFallbacks: Number(counters.deterministic_fallbacks) || 0,
    timeouts: Number(counters.gemini_timeouts) || 0,
    slowResponses: Number(counters.ai_slow_responses) || 0,
    slowGeminiRequests: Number(counters.gemini_slow_requests) || 0,
    busyErrors: Number(counters.demo_busy_errors) || 0,
    errorQuota: Number(counters.gemini_error_quota) || 0,
    errorTimeout: Number(counters.gemini_error_timeout) || 0,
    errorClient: Number(counters.gemini_error_client) || 0,
    errorServer: Number(counters.gemini_error_server) || 0,
    errorEmpty: Number(counters.gemini_error_empty) || 0,
    errorOther: Number(counters.gemini_error_other) || 0,
    totalTokens: Number(counters.gemini_total_tokens) || 0,
    dashboardRate: visitors ? (dashboardVisitors / visitors) * 100 : 0,
    ctaRate: visitors ? (ctaVisitors / visitors) * 100 : 0,
    aiSuccessRate: geminiAttempts ? (geminiSuccesses / geminiAttempts) * 100 : 0,
    providerErrorRate: geminiAttempts ? ((Number(counters.gemini_api_failures) || 0) / geminiAttempts) * 100 : 0,
    aiResponseAvgMs: aiLatency.avgMs,
    aiResponseP50Ms: aiLatency.p50Ms,
    aiResponseP95Ms: aiLatency.p95Ms,
    geminiRequestAvgMs: geminiLatency.avgMs,
    geminiRequestP50Ms: geminiLatency.p50Ms,
    geminiRequestP95Ms: geminiLatency.p95Ms,
    _latency: {
      aiResponse: aiLatencyData,
      geminiRequest: geminiLatencyData,
    },
  };
}

function sumRows(rows) {
  const fields = [
    "sessions", "messages", "takeovers", "staffMessages",
    "geminiAttempts", "geminiSuccesses", "geminiFailures", "retries", "keyFailovers",
    "fallbackModelUses", "fallbackModelSuccesses", "deterministicFallbacks", "timeouts",
    "slowResponses", "slowGeminiRequests", "busyErrors", "errorQuota", "errorTimeout",
    "errorClient", "errorServer", "errorEmpty", "errorOther", "totalTokens",
  ];
  return Object.fromEntries(fields.map((field) => [field, rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0)]));
}

function rangeSummaryFromParts(rows, visitors, eventTotals) {
  const sums = sumRows(rows);
  const dashboardVisitors = Number(eventTotals.dashboard_view) || 0;
  const ctaVisitors = Number(eventTotals.sales_cta_clicks) || 0;
  const aiLatency = latencyStats(combineLatencyData(rows.map((row) => row._latency?.aiResponse)));
  const geminiLatency = latencyStats(combineLatencyData(rows.map((row) => row._latency?.geminiRequest)));
  return {
    ...sums,
    visitors,
    patientVisitors: Number(eventTotals.patient_view) || 0,
    demoStartedVisitors: Number(eventTotals.demo_started) || 0,
    message1Visitors: Number(eventTotals.message_1) || 0,
    message3Visitors: Number(eventTotals.message_3) || 0,
    dashboardVisitors,
    takeoverVisitors: Number(eventTotals.human_takeover) || 0,
    completedVisitors: Number(eventTotals.journey_complete) || 0,
    ctaVisitors,
    dashboardRate: visitors ? (dashboardVisitors / visitors) * 100 : 0,
    ctaRate: visitors ? (ctaVisitors / visitors) * 100 : 0,
    messagesPerVisitor: visitors ? sums.messages / visitors : 0,
    aiSuccessRate: sums.geminiAttempts ? (sums.geminiSuccesses / sums.geminiAttempts) * 100 : 0,
    providerErrorRate: sums.geminiAttempts ? (sums.geminiFailures / sums.geminiAttempts) * 100 : 0,
    aiResponseAvgMs: aiLatency.avgMs,
    aiResponseP50Ms: aiLatency.p50Ms,
    aiResponseP95Ms: aiLatency.p95Ms,
    geminiRequestAvgMs: geminiLatency.avgMs,
    geminiRequestP50Ms: geminiLatency.p50Ms,
    geminiRequestP95Ms: geminiLatency.p95Ms,
    funnel: funnelFromCounts(visitors, eventTotals),
  };
}

function memoryRangeSummary(days, rows) {
  const visitorUnion = new Set();
  const eventUnions = Object.fromEntries(HISTORY_EVENTS.map((event) => [event, new Set()]));
  for (const day of days) {
    for (const id of uniqueSet(day)) visitorUnion.add(id);
    for (const event of HISTORY_EVENTS) {
      for (const id of eventUniqueSet(day, event)) eventUnions[event].add(id);
    }
  }
  const eventTotals = Object.fromEntries(HISTORY_EVENTS.map((event) => [event, eventUnions[event].size]));
  return rangeSummaryFromParts(rows, visitorUnion.size, eventTotals);
}

async function redisHistory(days) {
  return shared.withRedis(async (redis) => {
    const pipeline = redis.multi();
    for (const day of days) {
      pipeline.hgetall(redisCountersKey(day));
      pipeline.pfcount(redisUniqueKey(day));
      for (const event of HISTORY_EVENTS) pipeline.pfcount(redisEventUniqueKey(day, event));
    }
    const results = await pipeline.exec();
    const rows = [];
    const stride = 2 + HISTORY_EVENTS.length;
    for (let index = 0; index < days.length; index += 1) {
      const offset = index * stride;
      const counters = numericObject(results[offset]?.[1] || {});
      const visitors = Number(results[offset + 1]?.[1]) || 0;
      const events = {};
      HISTORY_EVENTS.forEach((event, eventIndex) => {
        events[event] = Number(results[offset + 2 + eventIndex]?.[1]) || 0;
      });
      rows.push(historyRow(days[index], counters, visitors, events));
    }
    return rows;
  }, null);
}

async function redisRangeSummary(days, rows) {
  return shared.withRedis(async (redis) => {
    if (!days.length) return memoryRangeSummary(days, rows);
    const pipeline = redis.multi();
    pipeline.pfcount(...days.map(redisUniqueKey));
    for (const event of HISTORY_EVENTS) pipeline.pfcount(...days.map((day) => redisEventUniqueKey(day, event)));
    const results = await pipeline.exec();
    const visitors = Number(results[0]?.[1]) || 0;
    const eventTotals = {};
    HISTORY_EVENTS.forEach((event, index) => { eventTotals[event] = Number(results[index + 1]?.[1]) || 0; });
    return rangeSummaryFromParts(rows, visitors, eventTotals);
  }, null);
}

function publicHistoryRow(row) {
  const { _latency, ...publicRow } = row;
  return publicRow;
}

async function getHistory() {
  const days = recentDayKeys(HISTORY_DAYS);
  const persistentRows = await redisHistory(days);
  const rows = persistentRows || days.map((day) => {
    const events = Object.fromEntries(HISTORY_EVENTS.map((event) => [event, eventUniqueSet(day, event).size]));
    return historyRow(day, numericObject(dayCounters(day)), uniqueSet(day).size, events);
  });
  const ranges = {};
  for (const range of [7, 30, 90]) {
    const rangeDays = days.slice(-range);
    const rangeRows = rows.slice(-range);
    ranges[String(range)] = (await redisRangeSummary(rangeDays, rangeRows)) || memoryRangeSummary(rangeDays, rangeRows);
  }
  return {
    retentionDays: RETENTION_DAYS,
    availableDays: HISTORY_DAYS,
    slowResponseMs: SLOW_RESPONSE_MS,
    daily: rows.map(publicHistoryRow),
    ranges,
  };
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
  const history = await getHistory();
  const today = history.daily[history.daily.length - 1] || {};
  const aiLatency = latencyStats(latencyDataFromCounters(counters, "ai_response"));
  const geminiLatency = latencyStats(latencyDataFromCounters(counters, "gemini_request"));
  const todayEvents = Object.fromEntries(HISTORY_EVENTS.map((event) => [event, Number(today[`${event === "sales_cta_clicks" ? "cta" : event}`]) || 0]));
  todayEvents.patient_view = Number(today.patientVisitors) || 0;
  todayEvents.demo_started = Number(today.demoStartedVisitors) || 0;
  todayEvents.message_1 = Number(today.message1Visitors) || 0;
  todayEvents.message_3 = Number(today.message3Visitors) || 0;
  todayEvents.dashboard_view = Number(today.dashboardVisitors) || 0;
  todayEvents.human_takeover = Number(today.takeoverVisitors) || 0;
  todayEvents.journey_complete = Number(today.completedVisitors) || 0;
  todayEvents.sales_cta_clicks = Number(today.ctaVisitors) || 0;

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
    funnel: funnelFromCounts(uniqueVisitors, todayEvents),
    performance: {
      slowResponseMs: SLOW_RESPONSE_MS,
      aiResponse: aiLatency,
      geminiRequest: geminiLatency,
      retries: counters.gemini_retries || 0,
      keyFailovers: counters.gemini_key_failovers || 0,
      fallbackModelUses: counters.gemini_fallback_model_uses || 0,
      timeouts: counters.gemini_timeouts || 0,
      slowResponses: counters.ai_slow_responses || 0,
      slowGeminiRequests: counters.gemini_slow_requests || 0,
      busyErrors: counters.demo_busy_errors || 0,
      providerErrorRate: (counters.gemini_api_attempts || 0)
        ? ((counters.gemini_api_failures || 0) / counters.gemini_api_attempts) * 100
        : 0,
      errors: {
        quota: counters.gemini_error_quota || 0,
        timeout: counters.gemini_error_timeout || 0,
        client: counters.gemini_error_client || 0,
        server: counters.gemini_error_server || 0,
        empty: counters.gemini_error_empty || 0,
        other: counters.gemini_error_other || 0,
      },
    },
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
      lastErrorType: meta.gemini_last_error_type || null,
      lastSuccessAt: Number(meta.gemini_last_success_at) || null,
      keys: keys.map((stats, index) => ({
        index: index + 1,
        health: keyHealth(stats),
        ...stats,
      })),
    },
    history,
  };
}

module.exports = {
  recordCounter,
  recordVisitor,
  recordLatency,
  recordGeminiAttempt,
  recordGeminiSuccess,
  recordGeminiFailure,
  recordDeterministicFallback,
  getSnapshot,
  getHistory,
  _test: {
    localDayKey,
    recentDayKeys,
    safeVisitorId,
    safeSurface,
    keyHealth,
    usageNumbers,
    isQuotaError,
    geminiErrorType,
    latencyDataFromCounters,
    latencyStats,
    funnelFromCounts,
    historyRow,
  },
};