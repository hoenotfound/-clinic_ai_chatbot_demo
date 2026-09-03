const crypto = require("crypto");
const { neon } = require("@neondatabase/serverless");

const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();
const enabled = Boolean(DATABASE_URL);
const RETENTION_DAYS = 400;

let sql = null;
let schemaPromise = null;
let warned = false;
let seenDay = null;
const seenVisitorSurfaces = new Set();

function warnOnce(error) {
  if (warned) return;
  warned = true;
  console.warn("Ops Neon persistence unavailable; using Redis/memory fallback:", error?.message || error);
}

function client() {
  if (!enabled) return null;
  if (!sql) sql = neon(DATABASE_URL);
  return sql;
}

async function ensureSchema() {
  if (!enabled) return false;
  if (schemaPromise) return schemaPromise;
  const db = client();
  schemaPromise = (async () => {
    await db`
      CREATE TABLE IF NOT EXISTS demo_ops_counters (
        day date NOT NULL,
        name text NOT NULL,
        value bigint NOT NULL DEFAULT 0,
        PRIMARY KEY (day, name)
      )
    `;
    await db`
      CREATE TABLE IF NOT EXISTS demo_ops_meta (
        day date NOT NULL,
        name text NOT NULL,
        value text NOT NULL,
        PRIMARY KEY (day, name)
      )
    `;
    await db`
      CREATE TABLE IF NOT EXISTS demo_ops_visitors (
        day date NOT NULL,
        visitor_hash text NOT NULL,
        surface text NOT NULL,
        event text NOT NULL,
        first_seen_at bigint NOT NULL,
        last_seen_at bigint NOT NULL,
        PRIMARY KEY (day, visitor_hash, surface, event)
      )
    `;
    await db`
      CREATE INDEX IF NOT EXISTS demo_ops_visitors_day_event_idx
      ON demo_ops_visitors (day, event)
    `;
    await db`
      CREATE TABLE IF NOT EXISTS demo_ops_gemini_keys (
        day date NOT NULL,
        key_index integer NOT NULL,
        attempts bigint NOT NULL DEFAULT 0,
        successes bigint NOT NULL DEFAULT 0,
        failures bigint NOT NULL DEFAULT 0,
        quota_hits bigint NOT NULL DEFAULT 0,
        prompt_tokens bigint NOT NULL DEFAULT 0,
        output_tokens bigint NOT NULL DEFAULT 0,
        thought_tokens bigint NOT NULL DEFAULT 0,
        cached_tokens bigint NOT NULL DEFAULT 0,
        total_tokens bigint NOT NULL DEFAULT 0,
        last_success_at bigint,
        last_error_at bigint,
        last_error_status text,
        last_error_message text,
        last_model text,
        last_phase text,
        PRIMARY KEY (day, key_index)
      )
    `;
    await Promise.all([
      db`DELETE FROM demo_ops_counters WHERE day < CURRENT_DATE - ${RETENTION_DAYS}::integer`,
      db`DELETE FROM demo_ops_meta WHERE day < CURRENT_DATE - ${RETENTION_DAYS}::integer`,
      db`DELETE FROM demo_ops_visitors WHERE day < CURRENT_DATE - ${RETENTION_DAYS}::integer`,
      db`DELETE FROM demo_ops_gemini_keys WHERE day < CURRENT_DATE - ${RETENTION_DAYS}::integer`,
    ]);
    return true;
  })().catch((error) => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}

async function withDatabase(work, fallback = null) {
  if (!enabled) return fallback;
  try {
    await ensureSchema();
    return await work(client());
  } catch (error) {
    warnOnce(error);
    return fallback;
  }
}

function safeVisitorId(id) {
  const normalized = String(id || "").trim().slice(0, 128);
  return /^[A-Za-z0-9._:-]{8,128}$/.test(normalized) ? normalized : null;
}

function visitorHash(id) {
  return crypto.createHash("sha256").update(String(id || "")).digest("hex").slice(0, 40);
}

function normalizeSurface(surface) {
  return String(surface || "patient").toLowerCase() === "dashboard" ? "dashboard" : "patient";
}

function normalizeName(name) {
  return String(name || "unknown").trim().toLowerCase().replace(/[^a-z0-9_:-]/g, "_").slice(0, 80) || "unknown";
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
}

async function incrementCounters(day, entries = []) {
  const merged = new Map();
  for (const [name, amount] of entries) {
    const field = normalizeName(name);
    merged.set(field, (merged.get(field) || 0) + numeric(amount));
  }
  const rows = Array.from(merged, ([name, value]) => ({ name, value })).filter((row) => row.value !== 0);
  if (!rows.length) return true;
  return withDatabase(async (db) => {
    const payload = JSON.stringify(rows);
    await db`
      INSERT INTO demo_ops_counters (day, name, value)
      SELECT ${day}::date, item.name, item.value
      FROM jsonb_to_recordset(${payload}::jsonb) AS item(name text, value bigint)
      ON CONFLICT (day, name)
      DO UPDATE SET value = demo_ops_counters.value + EXCLUDED.value
    `;
    return true;
  }, false);
}

async function setMeta(day, name, value) {
  const field = normalizeName(name);
  const safeValue = String(value ?? "").slice(0, 1200);
  return withDatabase(async (db) => {
    await db`
      INSERT INTO demo_ops_meta (day, name, value)
      VALUES (${day}::date, ${field}, ${safeValue})
      ON CONFLICT (day, name)
      DO UPDATE SET value = EXCLUDED.value
    `;
    return true;
  }, false);
}

async function recordVisitor({ day, visitorId, event = "heartbeat", surface = "patient", now = Date.now() } = {}) {
  const id = safeVisitorId(visitorId);
  if (!id || !day) return false;
  const hash = visitorHash(id);
  const normalizedSurface = normalizeSurface(surface);
  const normalizedEvent = normalizeName(event);

  if (seenDay !== day) {
    seenDay = day;
    seenVisitorSurfaces.clear();
  }
  const seenKey = `${hash}:${normalizedSurface}`;
  const firstSurfaceWrite = !seenVisitorSurfaces.has(seenKey);
  if (firstSurfaceWrite) seenVisitorSurfaces.add(seenKey);
  if (normalizedEvent === "heartbeat" && !firstSurfaceWrite) return true;

  return withDatabase(async (db) => {
    const rows = [
      { surface: "all", event: "__visitor__" },
      { surface: normalizedSurface, event: "__surface__" },
    ];
    if (normalizedEvent !== "heartbeat") rows.push({ surface: normalizedSurface, event: normalizedEvent });
    const payload = JSON.stringify(rows);
    await db`
      INSERT INTO demo_ops_visitors (day, visitor_hash, surface, event, first_seen_at, last_seen_at)
      SELECT ${day}::date, ${hash}, item.surface, item.event, ${numeric(now)}, ${numeric(now)}
      FROM jsonb_to_recordset(${payload}::jsonb) AS item(surface text, event text)
      ON CONFLICT (day, visitor_hash, surface, event)
      DO UPDATE SET last_seen_at = GREATEST(demo_ops_visitors.last_seen_at, EXCLUDED.last_seen_at)
    `;
    return true;
  }, false);
}

async function recordGeminiAttempt({ day, keyIndex, model, phase }) {
  const index = Math.max(0, numeric(keyIndex));
  return withDatabase(async (db) => {
    await db`
      INSERT INTO demo_ops_gemini_keys (day, key_index, attempts, last_model, last_phase)
      VALUES (${day}::date, ${index}, 1, ${String(model || "").slice(0, 120)}, ${String(phase || "primary").slice(0, 40)})
      ON CONFLICT (day, key_index)
      DO UPDATE SET
        attempts = demo_ops_gemini_keys.attempts + 1,
        last_model = EXCLUDED.last_model,
        last_phase = EXCLUDED.last_phase
    `;
    return true;
  }, false);
}

async function recordGeminiSuccess({ day, keyIndex, model, phase, usage = {}, now = Date.now() }) {
  const index = Math.max(0, numeric(keyIndex));
  return withDatabase(async (db) => {
    await db`
      INSERT INTO demo_ops_gemini_keys (
        day, key_index, successes, prompt_tokens, output_tokens, thought_tokens,
        cached_tokens, total_tokens, last_success_at, last_model, last_phase
      ) VALUES (
        ${day}::date, ${index}, 1, ${numeric(usage.promptTokens)}, ${numeric(usage.outputTokens)},
        ${numeric(usage.thoughtTokens)}, ${numeric(usage.cachedTokens)}, ${numeric(usage.totalTokens)},
        ${numeric(now)}, ${String(model || "").slice(0, 120)}, ${String(phase || "primary").slice(0, 40)}
      )
      ON CONFLICT (day, key_index)
      DO UPDATE SET
        successes = demo_ops_gemini_keys.successes + 1,
        prompt_tokens = demo_ops_gemini_keys.prompt_tokens + EXCLUDED.prompt_tokens,
        output_tokens = demo_ops_gemini_keys.output_tokens + EXCLUDED.output_tokens,
        thought_tokens = demo_ops_gemini_keys.thought_tokens + EXCLUDED.thought_tokens,
        cached_tokens = demo_ops_gemini_keys.cached_tokens + EXCLUDED.cached_tokens,
        total_tokens = demo_ops_gemini_keys.total_tokens + EXCLUDED.total_tokens,
        last_success_at = EXCLUDED.last_success_at,
        last_model = EXCLUDED.last_model,
        last_phase = EXCLUDED.last_phase
    `;
    return true;
  }, false);
}

async function recordGeminiFailure({ day, keyIndex, model, phase, quotaHit, status, message, now = Date.now() }) {
  const index = Math.max(0, numeric(keyIndex));
  return withDatabase(async (db) => {
    await db`
      INSERT INTO demo_ops_gemini_keys (
        day, key_index, failures, quota_hits, last_error_at, last_error_status,
        last_error_message, last_model, last_phase
      ) VALUES (
        ${day}::date, ${index}, 1, ${quotaHit ? 1 : 0}, ${numeric(now)}, ${String(status || "ERROR").slice(0, 120)},
        ${String(message || "Gemini request failed").slice(0, 900)}, ${String(model || "").slice(0, 120)},
        ${String(phase || "primary").slice(0, 40)}
      )
      ON CONFLICT (day, key_index)
      DO UPDATE SET
        failures = demo_ops_gemini_keys.failures + 1,
        quota_hits = demo_ops_gemini_keys.quota_hits + EXCLUDED.quota_hits,
        last_error_at = EXCLUDED.last_error_at,
        last_error_status = EXCLUDED.last_error_status,
        last_error_message = EXCLUDED.last_error_message,
        last_model = EXCLUDED.last_model,
        last_phase = EXCLUDED.last_phase
    `;
    return true;
  }, false);
}

async function rangeEventCounts(db, startDay, endDay) {
  const rows = await db`
    SELECT event, COUNT(DISTINCT visitor_hash)::bigint AS count
    FROM demo_ops_visitors
    WHERE day BETWEEN ${startDay}::date AND ${endDay}::date
      AND event <> '__surface__'
    GROUP BY event
  `;
  return Object.fromEntries(rows.map((row) => [row.event, Number(row.count) || 0]));
}

async function readHistory(days = []) {
  if (!days.length) return null;
  const startDay = days[0];
  const endDay = days[days.length - 1];
  return withDatabase(async (db) => {
    const ranges = [7, 30, 90].map((range) => {
      const subset = days.slice(-range);
      return { range, start: subset[0], end: subset[subset.length - 1] };
    });
    const [counterRows, visitorRows, metaRows, keyRows, ...rangeRows] = await Promise.all([
      db`
        SELECT day::text AS day, name, value
        FROM demo_ops_counters
        WHERE day BETWEEN ${startDay}::date AND ${endDay}::date
      `,
      db`
        SELECT day::text AS day, event, surface, COUNT(DISTINCT visitor_hash)::bigint AS count
        FROM demo_ops_visitors
        WHERE day BETWEEN ${startDay}::date AND ${endDay}::date
        GROUP BY day, event, surface
      `,
      db`
        SELECT name, value
        FROM demo_ops_meta
        WHERE day = ${endDay}::date
      `,
      db`
        SELECT *
        FROM demo_ops_gemini_keys
        WHERE day = ${endDay}::date
        ORDER BY key_index
      `,
      ...ranges.map((item) => rangeEventCounts(db, item.start, item.end)),
    ]);

    const countersByDay = Object.fromEntries(days.map((day) => [day, {}]));
    for (const row of counterRows) countersByDay[row.day][row.name] = Number(row.value) || 0;

    const eventsByDay = Object.fromEntries(days.map((day) => [day, {}]));
    const surfacesByDay = Object.fromEntries(days.map((day) => [day, { patient: 0, dashboard: 0 }]));
    for (const row of visitorRows) {
      const count = Number(row.count) || 0;
      if (row.event === "__surface__") {
        if (row.surface === "patient" || row.surface === "dashboard") surfacesByDay[row.day][row.surface] = count;
      } else {
        eventsByDay[row.day][row.event] = count;
      }
    }

    const meta = Object.fromEntries(metaRows.map((row) => [row.name, row.value]));
    const keys = keyRows.map((row) => ({
      attempts: Number(row.attempts) || 0,
      successes: Number(row.successes) || 0,
      failures: Number(row.failures) || 0,
      quotaHits: Number(row.quota_hits) || 0,
      promptTokens: Number(row.prompt_tokens) || 0,
      outputTokens: Number(row.output_tokens) || 0,
      thoughtTokens: Number(row.thought_tokens) || 0,
      cachedTokens: Number(row.cached_tokens) || 0,
      totalTokens: Number(row.total_tokens) || 0,
      lastSuccessAt: row.last_success_at ? Number(row.last_success_at) : null,
      lastErrorAt: row.last_error_at ? Number(row.last_error_at) : null,
      lastErrorStatus: row.last_error_status || null,
      lastErrorMessage: row.last_error_message || null,
      lastModel: row.last_model || null,
      lastPhase: row.last_phase || null,
      keyIndex: Number(row.key_index) || 0,
    }));

    return {
      countersByDay,
      eventsByDay,
      surfacesByDay,
      meta,
      keys,
      rangeEvents: Object.fromEntries(ranges.map((item, index) => [String(item.range), rangeRows[index] || {}])),
    };
  }, null);
}

module.exports = {
  enabled,
  incrementCounters,
  setMeta,
  recordVisitor,
  recordGeminiAttempt,
  recordGeminiSuccess,
  recordGeminiFailure,
  readHistory,
  _test: { safeVisitorId, visitorHash, normalizeSurface, normalizeName },
};
