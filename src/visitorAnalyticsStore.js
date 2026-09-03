const crypto = require("crypto");
const { neon } = require("@neondatabase/serverless");

const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();
const enabled = Boolean(DATABASE_URL);
const RETENTION_DAYS = 400;

let sql = null;
let schemaPromise = null;
let warned = false;

function warnOnce(error) {
  if (warned) return;
  warned = true;
  console.warn("Visitor analytics persistence unavailable; continuing without audience details:", error?.message || error);
}

function client() {
  if (!enabled) return null;
  if (!sql) sql = neon(DATABASE_URL);
  return sql;
}

function text(value, max = 160) {
  const normalized = String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return normalized ? normalized.slice(0, max) : null;
}

function dayString(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const raw = String(value);
  const iso = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? raw.slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function visitorHash(id) {
  return crypto.createHash("sha256").update(String(id || "")).digest("hex").slice(0, 40);
}

function safeVisitorId(id) {
  const normalized = String(id || "").trim().slice(0, 128);
  return /^[A-Za-z0-9._:-]{8,128}$/.test(normalized) ? normalized : null;
}

function boolFlag(event, target) {
  return event === target;
}

async function ensureSchema() {
  if (!enabled) return false;
  if (schemaPromise) return schemaPromise;
  const db = client();
  schemaPromise = (async () => {
    await db`
      CREATE TABLE IF NOT EXISTS demo_ops_audience_visitors (
        visitor_hash text PRIMARY KEY,
        first_day date NOT NULL,
        last_day date NOT NULL,
        first_seen_at bigint NOT NULL,
        last_seen_at bigint NOT NULL,
        visit_count bigint NOT NULL DEFAULT 0,
        country_code text,
        country_name text,
        region text,
        city text,
        timezone text,
        device_type text,
        browser text,
        os text,
        source text,
        medium text,
        campaign text,
        content text,
        term text,
        landing_path text,
        last_event text,
        reached_message1 boolean NOT NULL DEFAULT false,
        reached_message3 boolean NOT NULL DEFAULT false,
        reached_dashboard boolean NOT NULL DEFAULT false,
        reached_takeover boolean NOT NULL DEFAULT false,
        reached_complete boolean NOT NULL DEFAULT false,
        reached_cta boolean NOT NULL DEFAULT false
      )
    `;
    await db`
      CREATE INDEX IF NOT EXISTS demo_ops_audience_visitors_last_seen_idx
      ON demo_ops_audience_visitors (last_seen_at DESC)
    `;
    await db`
      CREATE TABLE IF NOT EXISTS demo_ops_audience_daily (
        day date NOT NULL,
        visitor_hash text NOT NULL,
        first_seen_at bigint NOT NULL,
        last_seen_at bigint NOT NULL,
        visits bigint NOT NULL DEFAULT 0,
        country_code text,
        country_name text,
        region text,
        city text,
        timezone text,
        device_type text,
        browser text,
        os text,
        source text,
        medium text,
        campaign text,
        content text,
        term text,
        landing_path text,
        last_event text,
        reached_message1 boolean NOT NULL DEFAULT false,
        reached_message3 boolean NOT NULL DEFAULT false,
        reached_dashboard boolean NOT NULL DEFAULT false,
        reached_takeover boolean NOT NULL DEFAULT false,
        reached_complete boolean NOT NULL DEFAULT false,
        reached_cta boolean NOT NULL DEFAULT false,
        PRIMARY KEY (day, visitor_hash)
      )
    `;
    await db`
      CREATE INDEX IF NOT EXISTS demo_ops_audience_daily_day_idx
      ON demo_ops_audience_daily (day)
    `;
    await Promise.all([
      db`DELETE FROM demo_ops_audience_daily WHERE day < CURRENT_DATE - ${RETENTION_DAYS}::integer`,
      db`DELETE FROM demo_ops_audience_visitors WHERE last_day < CURRENT_DATE - ${RETENTION_DAYS}::integer`,
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

function normalizedContext(context = {}) {
  return {
    countryCode: text(context.countryCode, 8),
    countryName: text(context.countryName, 100),
    region: text(context.region, 120),
    city: text(context.city, 120),
    timezone: text(context.timezone, 100),
    deviceType: text(context.deviceType, 40),
    browser: text(context.browser, 80),
    os: text(context.os, 80),
    source: text(context.source, 120),
    medium: text(context.medium, 120),
    campaign: text(context.campaign, 180),
    content: text(context.content, 180),
    term: text(context.term, 180),
    landingPath: text(context.landingPath, 300),
  };
}

async function recordAudienceEvent({ day, visitorId, event = "heartbeat", now = Date.now(), context = {} } = {}) {
  const id = safeVisitorId(visitorId);
  if (!id || !day) return false;
  const hash = visitorHash(id);
  const eventName = text(String(event || "heartbeat").toLowerCase().replace(/[^a-z0-9_:-]/g, "_"), 80) || "heartbeat";
  const values = normalizedContext(context);
  const visitIncrement = eventName === "patient_view" ? 1 : 0;
  const flags = {
    message1: boolFlag(eventName, "message_1"),
    message3: boolFlag(eventName, "message_3"),
    dashboard: boolFlag(eventName, "dashboard_view"),
    takeover: boolFlag(eventName, "human_takeover"),
    complete: boolFlag(eventName, "journey_complete"),
    cta: boolFlag(eventName, "sales_cta_clicks"),
  };

  return withDatabase(async (db) => {
    const common = [
      values.countryCode, values.countryName, values.region, values.city, values.timezone,
      values.deviceType, values.browser, values.os, values.source, values.medium,
      values.campaign, values.content, values.term, values.landingPath,
    ];
    await Promise.all([
      db`
        INSERT INTO demo_ops_audience_visitors (
          visitor_hash, first_day, last_day, first_seen_at, last_seen_at, visit_count,
          country_code, country_name, region, city, timezone, device_type, browser, os,
          source, medium, campaign, content, term, landing_path, last_event,
          reached_message1, reached_message3, reached_dashboard, reached_takeover, reached_complete, reached_cta
        ) VALUES (
          ${hash}, ${day}::date, ${day}::date, ${Math.trunc(now)}, ${Math.trunc(now)}, ${visitIncrement},
          ${common[0]}, ${common[1]}, ${common[2]}, ${common[3]}, ${common[4]}, ${common[5]}, ${common[6]}, ${common[7]},
          ${common[8]}, ${common[9]}, ${common[10]}, ${common[11]}, ${common[12]}, ${common[13]}, ${eventName},
          ${flags.message1}, ${flags.message3}, ${flags.dashboard}, ${flags.takeover}, ${flags.complete}, ${flags.cta}
        )
        ON CONFLICT (visitor_hash) DO UPDATE SET
          last_day = EXCLUDED.last_day,
          last_seen_at = GREATEST(demo_ops_audience_visitors.last_seen_at, EXCLUDED.last_seen_at),
          visit_count = demo_ops_audience_visitors.visit_count + EXCLUDED.visit_count,
          country_code = COALESCE(demo_ops_audience_visitors.country_code, EXCLUDED.country_code),
          country_name = COALESCE(demo_ops_audience_visitors.country_name, EXCLUDED.country_name),
          region = COALESCE(demo_ops_audience_visitors.region, EXCLUDED.region),
          city = COALESCE(demo_ops_audience_visitors.city, EXCLUDED.city),
          timezone = COALESCE(demo_ops_audience_visitors.timezone, EXCLUDED.timezone),
          device_type = COALESCE(demo_ops_audience_visitors.device_type, EXCLUDED.device_type),
          browser = COALESCE(demo_ops_audience_visitors.browser, EXCLUDED.browser),
          os = COALESCE(demo_ops_audience_visitors.os, EXCLUDED.os),
          source = COALESCE(demo_ops_audience_visitors.source, EXCLUDED.source),
          medium = COALESCE(demo_ops_audience_visitors.medium, EXCLUDED.medium),
          campaign = COALESCE(demo_ops_audience_visitors.campaign, EXCLUDED.campaign),
          content = COALESCE(demo_ops_audience_visitors.content, EXCLUDED.content),
          term = COALESCE(demo_ops_audience_visitors.term, EXCLUDED.term),
          landing_path = COALESCE(demo_ops_audience_visitors.landing_path, EXCLUDED.landing_path),
          last_event = EXCLUDED.last_event,
          reached_message1 = demo_ops_audience_visitors.reached_message1 OR EXCLUDED.reached_message1,
          reached_message3 = demo_ops_audience_visitors.reached_message3 OR EXCLUDED.reached_message3,
          reached_dashboard = demo_ops_audience_visitors.reached_dashboard OR EXCLUDED.reached_dashboard,
          reached_takeover = demo_ops_audience_visitors.reached_takeover OR EXCLUDED.reached_takeover,
          reached_complete = demo_ops_audience_visitors.reached_complete OR EXCLUDED.reached_complete,
          reached_cta = demo_ops_audience_visitors.reached_cta OR EXCLUDED.reached_cta
      `,
      db`
        INSERT INTO demo_ops_audience_daily (
          day, visitor_hash, first_seen_at, last_seen_at, visits,
          country_code, country_name, region, city, timezone, device_type, browser, os,
          source, medium, campaign, content, term, landing_path, last_event,
          reached_message1, reached_message3, reached_dashboard, reached_takeover, reached_complete, reached_cta
        ) VALUES (
          ${day}::date, ${hash}, ${Math.trunc(now)}, ${Math.trunc(now)}, ${visitIncrement},
          ${common[0]}, ${common[1]}, ${common[2]}, ${common[3]}, ${common[4]}, ${common[5]}, ${common[6]}, ${common[7]},
          ${common[8]}, ${common[9]}, ${common[10]}, ${common[11]}, ${common[12]}, ${common[13]}, ${eventName},
          ${flags.message1}, ${flags.message3}, ${flags.dashboard}, ${flags.takeover}, ${flags.complete}, ${flags.cta}
        )
        ON CONFLICT (day, visitor_hash) DO UPDATE SET
          first_seen_at = LEAST(demo_ops_audience_daily.first_seen_at, EXCLUDED.first_seen_at),
          last_seen_at = GREATEST(demo_ops_audience_daily.last_seen_at, EXCLUDED.last_seen_at),
          visits = demo_ops_audience_daily.visits + EXCLUDED.visits,
          country_code = COALESCE(demo_ops_audience_daily.country_code, EXCLUDED.country_code),
          country_name = COALESCE(demo_ops_audience_daily.country_name, EXCLUDED.country_name),
          region = COALESCE(demo_ops_audience_daily.region, EXCLUDED.region),
          city = COALESCE(demo_ops_audience_daily.city, EXCLUDED.city),
          timezone = COALESCE(demo_ops_audience_daily.timezone, EXCLUDED.timezone),
          device_type = COALESCE(demo_ops_audience_daily.device_type, EXCLUDED.device_type),
          browser = COALESCE(demo_ops_audience_daily.browser, EXCLUDED.browser),
          os = COALESCE(demo_ops_audience_daily.os, EXCLUDED.os),
          source = COALESCE(demo_ops_audience_daily.source, EXCLUDED.source),
          medium = COALESCE(demo_ops_audience_daily.medium, EXCLUDED.medium),
          campaign = COALESCE(demo_ops_audience_daily.campaign, EXCLUDED.campaign),
          content = COALESCE(demo_ops_audience_daily.content, EXCLUDED.content),
          term = COALESCE(demo_ops_audience_daily.term, EXCLUDED.term),
          landing_path = COALESCE(demo_ops_audience_daily.landing_path, EXCLUDED.landing_path),
          last_event = EXCLUDED.last_event,
          reached_message1 = demo_ops_audience_daily.reached_message1 OR EXCLUDED.reached_message1,
          reached_message3 = demo_ops_audience_daily.reached_message3 OR EXCLUDED.reached_message3,
          reached_dashboard = demo_ops_audience_daily.reached_dashboard OR EXCLUDED.reached_dashboard,
          reached_takeover = demo_ops_audience_daily.reached_takeover OR EXCLUDED.reached_takeover,
          reached_complete = demo_ops_audience_daily.reached_complete OR EXCLUDED.reached_complete,
          reached_cta = demo_ops_audience_daily.reached_cta OR EXCLUDED.reached_cta
      `,
    ]);
    return true;
  }, false);
}

function topBreakdown(visitors, field, limit = 8) {
  const counts = new Map();
  for (const visitor of visitors.values()) {
    const key = text(visitor[field], 120) || "Unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function sourceBreakdown(visitors, limit = 8) {
  const groups = new Map();
  for (const visitor of visitors.values()) {
    const label = text(visitor.source, 120) || "Direct / unknown";
    if (!groups.has(label)) groups.set(label, { label, visitors: 0, engaged: 0, dashboard: 0, cta: 0 });
    const row = groups.get(label);
    row.visitors += 1;
    if (visitor.reached_message1) row.engaged += 1;
    if (visitor.reached_dashboard) row.dashboard += 1;
    if (visitor.reached_cta) row.cta += 1;
  }
  return [...groups.values()]
    .sort((a, b) => b.visitors - a.visitors || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((row) => ({
      ...row,
      engagementRate: row.visitors ? (row.engaged / row.visitors) * 100 : 0,
      dashboardRate: row.visitors ? (row.dashboard / row.visitors) * 100 : 0,
      ctaRate: row.visitors ? (row.cta / row.visitors) * 100 : 0,
    }));
}

function aggregateAudienceRows(rows = [], rangeStart) {
  const visitors = new Map();
  let activeSpanTotalMs = 0;
  let activeSpanRows = 0;
  let totalVisits = 0;

  for (const row of rows) {
    totalVisits += Number(row.visits) || 0;
    const first = Number(row.first_seen_at) || 0;
    const last = Number(row.last_seen_at) || first;
    if (last >= first) {
      activeSpanTotalMs += Math.min(last - first, 8 * 60 * 60_000);
      activeSpanRows += 1;
    }
    const existing = visitors.get(row.visitor_hash) || {
      visitor_hash: row.visitor_hash,
      first_day: row.first_day,
      visits: 0,
      reached_message1: false,
      reached_message3: false,
      reached_dashboard: false,
      reached_takeover: false,
      reached_complete: false,
      reached_cta: false,
    };
    existing.first_day = existing.first_day && existing.first_day < row.first_day ? existing.first_day : row.first_day;
    existing.visits += Number(row.visits) || 0;
    for (const field of ["country_name", "region", "city", "device_type", "browser", "os", "source", "medium", "campaign"]) {
      if (!existing[field] && row[field]) existing[field] = row[field];
    }
    for (const field of ["reached_message1", "reached_message3", "reached_dashboard", "reached_takeover", "reached_complete", "reached_cta"]) {
      existing[field] = existing[field] || Boolean(row[field]);
    }
    visitors.set(row.visitor_hash, existing);
  }

  const uniqueVisitors = visitors.size;
  let newVisitors = 0;
  let engagedVisitors = 0;
  for (const visitor of visitors.values()) {
    if (String(visitor.first_day || "") >= String(rangeStart || "")) newVisitors += 1;
    if (visitor.reached_message1) engagedVisitors += 1;
  }
  const returningVisitors = Math.max(0, uniqueVisitors - newVisitors);

  const cityVisitors = new Map();
  for (const visitor of visitors.values()) {
    const label = [visitor.city, visitor.region, visitor.country_name].filter(Boolean).join(", ") || visitor.country_name || "Unknown";
    const clone = { ...visitor, city_label: label };
    cityVisitors.set(visitor.visitor_hash, clone);
  }

  return {
    totalVisits,
    uniqueVisitors,
    newVisitors,
    returningVisitors,
    repeatRate: uniqueVisitors ? (returningVisitors / uniqueVisitors) * 100 : 0,
    engagedVisitors,
    engagementRate: uniqueVisitors ? (engagedVisitors / uniqueVisitors) * 100 : 0,
    avgActiveSpanMs: activeSpanRows ? Math.round(activeSpanTotalMs / activeSpanRows) : 0,
    countries: topBreakdown(visitors, "country_name"),
    cities: topBreakdown(cityVisitors, "city_label"),
    devices: topBreakdown(visitors, "device_type"),
    browsers: topBreakdown(visitors, "browser"),
    operatingSystems: topBreakdown(visitors, "os"),
    sources: sourceBreakdown(visitors),
  };
}

function publicRecentVisitor(row) {
  const stage = row.reached_cta ? "Consultation click"
    : row.reached_complete ? "Journey complete"
      : row.reached_takeover ? "Human takeover"
        : row.reached_dashboard ? "Dashboard viewed"
          : row.reached_message3 ? "3+ messages"
            : row.reached_message1 ? "Messaged"
              : "Visited";
  return {
    id: String(row.visitor_hash || "").slice(0, 8).toUpperCase(),
    firstSeenAt: Number(row.first_seen_at) || null,
    lastSeenAt: Number(row.last_seen_at) || null,
    visits: Number(row.visit_count) || 0,
    location: [row.city, row.region, row.country_name].filter(Boolean).join(", ") || row.country_name || "Unknown",
    country: row.country_name || "Unknown",
    device: row.device_type || "Unknown",
    browser: row.browser || "Unknown",
    os: row.os || "Unknown",
    source: row.source || "Direct / unknown",
    medium: row.medium || null,
    campaign: row.campaign || null,
    landingPath: row.landing_path || null,
    stage,
    messageStage: row.reached_message3 ? "3+" : row.reached_message1 ? "1+" : "0",
  };
}

async function readAudience(days = []) {
  if (!enabled || !days.length) return null;
  const startDay = days[0];
  const endDay = days[days.length - 1];
  return withDatabase(async (db) => {
    const [dailyRows, recentRows] = await Promise.all([
      db`
        SELECT d.*, v.first_day
        FROM demo_ops_audience_daily d
        JOIN demo_ops_audience_visitors v USING (visitor_hash)
        WHERE d.day BETWEEN ${startDay}::date AND ${endDay}::date
        ORDER BY d.day ASC
      `,
      db`
        SELECT *
        FROM demo_ops_audience_visitors
        ORDER BY last_seen_at DESC
        LIMIT 50
      `,
    ]);

    const normalizedRows = dailyRows.map((row) => ({ ...row, day: dayString(row.day), first_day: dayString(row.first_day) }));
    const ranges = {};
    for (const range of [7, 30, 90]) {
      const subsetDays = days.slice(-range);
      const rangeStart = subsetDays[0];
      const allowed = new Set(subsetDays);
      ranges[String(range)] = aggregateAudienceRows(normalizedRows.filter((row) => allowed.has(row.day)), rangeStart);
    }
    return {
      ranges,
      recentVisitors: recentRows.map(publicRecentVisitor),
      retentionDays: RETENTION_DAYS,
      geoPrecision: "Approximate IP-based city/region/country from Netlify; raw IP is not stored.",
    };
  }, null);
}

module.exports = {
  enabled,
  recordAudienceEvent,
  readAudience,
  _test: {
    safeVisitorId,
    visitorHash,
    dayString,
    normalizedContext,
    aggregateAudienceRows,
    sourceBreakdown,
    publicRecentVisitor,
  },
};
