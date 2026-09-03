const ops = require("./opsStats");
const shared = require("./sharedState");
const store = require("./opsNeonStore");

if (!store.enabled) return;

const HISTORY_DAYS = 90;
const RETENTION_DAYS = 400;
const HISTORY_CACHE_MS = Math.max(5_000, Number.parseInt(process.env.DEMO_OPS_HISTORY_CACHE_MS || "60000", 10) || 60_000);
const SLOW_RESPONSE_MS = Math.max(500, Number.parseInt(process.env.DEMO_SLOW_RESPONSE_MS || "4000", 10) || 4000);
const KEY_STATUS_WINDOW_MS = 15 * 60_000;
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

const originals = {
  recordCounter: ops.recordCounter,
  recordVisitor: ops.recordVisitor,
  recordLatency: ops.recordLatency,
  recordGeminiAttempt: ops.recordGeminiAttempt,
  recordGeminiSuccess: ops.recordGeminiSuccess,
  recordGeminiFailure: ops.recordGeminiFailure,
  recordDeterministicFallback: ops.recordDeterministicFallback,
  getSnapshot: ops.getSnapshot,
  getHistory: ops.getHistory,
};

const durableCache = { value: null, expiresAt: 0, inFlight: null };

function fireAndForget(promise) {
  Promise.resolve(promise).catch(() => {});
}

function dayKey() {
  return ops._test.localDayKey();
}

function safeCounterName(name) {
  return String(name || "unknown").trim().toLowerCase().replace(/[^a-z0-9_:-]/g, "_").slice(0, 80) || "unknown";
}

function latencyBucketField(metric, upperMs) {
  return `${safeCounterName(metric)}_latency_bucket_le_${upperMs}`;
}

function latencyOverField(metric) {
  return `${safeCounterName(metric)}_latency_bucket_over_${LATENCY_BUCKETS_MS[LATENCY_BUCKETS_MS.length - 1]}`;
}

function latencyEntries(metric, durationMs) {
  const normalized = safeCounterName(metric);
  const duration = Math.max(0, Math.round(Number(durationMs) || 0));
  const entries = [
    [`${normalized}_latency_count`, 1],
    [`${normalized}_latency_sum_ms`, duration],
  ];
  const upper = LATENCY_BUCKETS_MS.find((value) => duration <= value);
  entries.push([upper ? latencyBucketField(normalized, upper) : latencyOverField(normalized), 1]);
  if (normalized === "ai_response" && duration >= SLOW_RESPONSE_MS) entries.push(["ai_slow_responses", 1]);
  if (normalized === "gemini_request" && duration >= SLOW_RESPONSE_MS) entries.push(["gemini_slow_requests", 1]);
  return entries;
}

function blankKey() {
  return {
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
  };
}

function publicHistoryRow(row) {
  const { _latency, ...publicRow } = row;
  return publicRow;
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

function combineLatency(items = []) {
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

function rangeSummary(rows, eventTotals = {}) {
  const visitors = Number(eventTotals.__visitor__) || 0;
  const sums = sumRows(rows);
  const dashboardVisitors = Number(eventTotals.dashboard_view) || 0;
  const ctaVisitors = Number(eventTotals.sales_cta_clicks) || 0;
  const aiLatency = ops._test.latencyStats(combineLatency(rows.map((row) => row._latency?.aiResponse)));
  const geminiLatency = ops._test.latencyStats(combineLatency(rows.map((row) => row._latency?.geminiRequest)));
  const funnelEvents = Object.fromEntries(HISTORY_EVENTS.map((event) => [event, Number(eventTotals[event]) || 0]));
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
    funnel: ops._test.funnelFromCounts(visitors, funnelEvents),
  };
}

async function buildDurableState() {
  const days = ops._test.recentDayKeys(HISTORY_DAYS);
  const raw = await store.readHistory(days);
  if (!raw) return null;

  const rows = days.map((day) => {
    const events = raw.eventsByDay[day] || {};
    return ops._test.historyRow(
      day,
      raw.countersByDay[day] || {},
      Number(events.__visitor__) || 0,
      Object.fromEntries(HISTORY_EVENTS.map((event) => [event, Number(events[event]) || 0]))
    );
  });
  const ranges = {};
  for (const range of [7, 30, 90]) {
    ranges[String(range)] = rangeSummary(rows.slice(-range), raw.rangeEvents[String(range)] || {});
  }

  return {
    history: {
      retentionDays: RETENTION_DAYS,
      availableDays: HISTORY_DAYS,
      slowResponseMs: SLOW_RESPONSE_MS,
      daily: rows.map(publicHistoryRow),
      ranges,
    },
    rows,
    counters: raw.countersByDay[days[days.length - 1]] || {},
    events: raw.eventsByDay[days[days.length - 1]] || {},
    surfaces: raw.surfacesByDay[days[days.length - 1]] || { patient: 0, dashboard: 0 },
    meta: raw.meta || {},
    keys: raw.keys || [],
  };
}

async function durableState() {
  const now = Date.now();
  if (durableCache.value && durableCache.expiresAt > now) return durableCache.value;
  if (durableCache.inFlight) return durableCache.inFlight;
  durableCache.inFlight = buildDurableState()
    .then((value) => {
      if (value) {
        durableCache.value = value;
        durableCache.expiresAt = Date.now() + HISTORY_CACHE_MS;
      }
      return value;
    })
    .finally(() => { durableCache.inFlight = null; });
  return durableCache.inFlight;
}

function noteDurableWrite() {
  // Intentionally do not invalidate a warm history cache on each telemetry write.
  // This keeps /ops reads isolated from live chat traffic; history may lag by at most the configured cache window.
}

ops.recordCounter = function recordCounterPersistent(name, amount = 1) {
  const result = originals.recordCounter(name, amount);
  fireAndForget(store.incrementCounters(dayKey(), [[name, amount]]));
  noteDurableWrite();
  return result;
};

ops.recordVisitor = function recordVisitorPersistent(payload = {}) {
  const result = originals.recordVisitor(payload);
  if (!result) return result;
  const day = dayKey();
  const normalizedEvent = safeCounterName(payload.event || "heartbeat");
  fireAndForget(store.recordVisitor({ day, ...payload }));
  if (normalizedEvent !== "heartbeat") fireAndForget(store.incrementCounters(day, [[normalizedEvent, 1]]));
  noteDurableWrite();
  return result;
};

ops.recordLatency = function recordLatencyPersistent(metric, durationMs) {
  const result = originals.recordLatency(metric, durationMs);
  fireAndForget(store.incrementCounters(dayKey(), latencyEntries(metric, durationMs)));
  noteDurableWrite();
  return result;
};

ops.recordGeminiAttempt = function recordGeminiAttemptPersistent(payload = {}) {
  const result = originals.recordGeminiAttempt(payload);
  const day = dayKey();
  fireAndForget(store.incrementCounters(day, [["gemini_api_attempts", 1]]));
  fireAndForget(store.recordGeminiAttempt({ day, ...payload }));
  noteDurableWrite();
  return result;
};

ops.recordGeminiSuccess = function recordGeminiSuccessPersistent(payload = {}) {
  const result = originals.recordGeminiSuccess(payload);
  const day = dayKey();
  const now = Date.now();
  const usage = ops._test.usageNumbers(payload.usageMetadata || {});
  const entries = [
    ["gemini_api_successes", 1],
    ["gemini_prompt_tokens", usage.promptTokens],
    ["gemini_output_tokens", usage.outputTokens],
    ["gemini_thought_tokens", usage.thoughtTokens],
    ["gemini_cached_tokens", usage.cachedTokens],
    ["gemini_total_tokens", usage.totalTokens],
  ];
  if (payload.phase === "fallback_model") entries.push(["gemini_fallback_model_successes", 1]);
  fireAndForget(store.incrementCounters(day, entries));
  fireAndForget(store.setMeta(day, "gemini_last_success_at", now));
  fireAndForget(store.recordGeminiSuccess({ day, ...payload, usage, now }));
  noteDurableWrite();
  return result;
};

ops.recordGeminiFailure = function recordGeminiFailurePersistent(payload = {}) {
  const result = originals.recordGeminiFailure(payload);
  const day = dayKey();
  const now = Date.now();
  const error = payload.error;
  const quotaHit = ops._test.isQuotaError(error);
  const errorType = ops._test.geminiErrorType(error);
  const status = String(error?.apiStatus || error?.statusCode || error?.code || "ERROR").slice(0, 120);
  const message = String(error?.message || "Gemini request failed").slice(0, 900);
  const entries = [["gemini_api_failures", 1], [`gemini_error_${errorType}`, 1]];
  if (errorType === "timeout") entries.push(["gemini_timeouts", 1]);
  if (quotaHit) entries.push(["gemini_quota_hits", 1]);
  fireAndForget(store.incrementCounters(day, entries));
  fireAndForget(store.setMeta(day, "gemini_last_error_at", now));
  fireAndForget(store.setMeta(day, "gemini_last_error_status", status));
  fireAndForget(store.setMeta(day, "gemini_last_error_type", errorType));
  if (quotaHit) {
    fireAndForget(store.setMeta(day, "gemini_last_quota_hit_at", now));
    fireAndForget(store.setMeta(day, "gemini_last_quota_message", message));
  }
  fireAndForget(store.recordGeminiFailure({ day, ...payload, quotaHit, status, message, now }));
  noteDurableWrite();
  return result;
};

ops.recordDeterministicFallback = function recordDeterministicFallbackPersistent(reason = "gemini_unavailable") {
  const result = originals.recordDeterministicFallback(reason);
  const day = dayKey();
  const now = Date.now();
  fireAndForget(store.incrementCounters(day, [["deterministic_fallbacks", 1]]));
  fireAndForget(store.setMeta(day, "last_deterministic_fallback_at", now));
  fireAndForget(store.setMeta(day, "last_deterministic_fallback_reason", String(reason || "unknown").slice(0, 240)));
  noteDurableWrite();
  return result;
};

ops.getHistory = async function getHistoryPersistent() {
  const durable = await durableState();
  return durable?.history || originals.getHistory();
};

ops.getSnapshot = async function getSnapshotPersistent() {
  const base = await originals.getSnapshot();
  const durable = await durableState();
  if (!durable) return base;

  const counters = durable.counters;
  const events = durable.events;
  const meta = durable.meta;
  const visitorCount = Number(events.__visitor__) || 0;
  const funnelEvents = Object.fromEntries(HISTORY_EVENTS.map((event) => [event, Number(events[event]) || 0]));
  const aiLatency = ops._test.latencyStats(ops._test.latencyDataFromCounters(counters, "ai_response"));
  const geminiLatency = ops._test.latencyStats(ops._test.latencyDataFromCounters(counters, "gemini_request"));
  const lastQuotaAt = Number(meta.gemini_last_quota_hit_at) || null;
  const quotaRecentlyHit = Boolean(lastQuotaAt && Date.now() - lastQuotaAt <= KEY_STATUS_WINDOW_MS);
  const keys = [1, 2].map((keyIndex) => {
    const stats = durable.keys.find((item) => item.keyIndex === keyIndex) || blankKey();
    const { keyIndex: _keyIndex, ...publicStats } = stats;
    return { index: keyIndex, health: ops._test.keyHealth(publicStats), ...publicStats };
  });

  return {
    ...base,
    // Keep the legacy value so the existing UI correctly shows "History saved".
    // durableStorage identifies the actual long-term backend for future UI/API consumers.
    storage: "redis",
    durableStorage: "neon",
    liveStorage: shared.enabled ? "redis" : "memory",
    visitors: {
      ...base.visitors,
      uniqueToday: visitorCount,
      uniquePatientToday: Number(durable.surfaces.patient) || 0,
      uniqueDashboardToday: Number(durable.surfaces.dashboard) || 0,
    },
    counters,
    funnel: ops._test.funnelFromCounts(visitorCount, funnelEvents),
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
      keys,
    },
    history: durable.history,
  };
};
