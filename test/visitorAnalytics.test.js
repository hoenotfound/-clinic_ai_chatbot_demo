const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");

const STORE_PATH = require.resolve("../src/visitorAnalyticsStore");

function loadStoreWithoutDatabase() {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  delete require.cache[STORE_PATH];
  const store = require("../src/visitorAnalyticsStore");
  if (previous === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previous;
  return store;
}

async function withMockedNeon(fakeSql, work) {
  const originalLoad = Module._load;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === "@neondatabase/serverless") return { neon: () => fakeSql };
    return originalLoad.call(this, request, parent, isMain);
  };
  process.env.DATABASE_URL = "postgresql://test:test@example.invalid/demo";
  delete require.cache[STORE_PATH];
  try {
    const store = require("../src/visitorAnalyticsStore");
    return await work(store);
  } finally {
    delete require.cache[STORE_PATH];
    Module._load = originalLoad;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
}

const analytics = loadStoreWithoutDatabase();
const { aggregateAudienceRows, visitorHash, safeVisitorId, publicRecentVisitor, dayString } = analytics._test;

test("visitor analytics aggregate total visits, unique/new/returning and source conversion", () => {
  const rows = [
    {
      day: "2026-09-02",
      visitor_hash: "visitor-a",
      first_day: "2026-09-01",
      first_seen_at: 1_000,
      last_seen_at: 181_000,
      visits: 2,
      country_name: "Malaysia",
      region: "Selangor",
      city: "Petaling Jaya",
      device_type: "Mobile",
      browser: "Safari",
      os: "iOS",
      source: "Facebook",
      reached_message1: true,
      reached_message3: true,
      reached_dashboard: true,
      reached_takeover: false,
      reached_complete: false,
      reached_cta: true,
    },
    {
      day: "2026-09-02",
      visitor_hash: "visitor-b",
      first_day: "2026-09-02",
      first_seen_at: 2_000,
      last_seen_at: 62_000,
      visits: 1,
      country_name: "Malaysia",
      region: "Kuala Lumpur",
      city: "Kuala Lumpur",
      device_type: "Desktop",
      browser: "Chrome",
      os: "Windows",
      source: "Google",
      reached_message1: false,
      reached_message3: false,
      reached_dashboard: false,
      reached_takeover: false,
      reached_complete: false,
      reached_cta: false,
    },
  ];

  const result = aggregateAudienceRows(rows, "2026-09-02");
  assert.equal(result.totalVisits, 3);
  assert.equal(result.uniqueVisitors, 2);
  assert.equal(result.newVisitors, 1);
  assert.equal(result.returningVisitors, 1);
  assert.equal(result.engagedVisitors, 1);
  assert.equal(result.sources[0].label, "Facebook");
  assert.equal(result.sources[0].visitors, 1);
  assert.equal(result.sources[0].engagementRate, 100);
  assert.equal(result.sources[0].dashboardRate, 100);
  assert.equal(result.sources[0].ctaRate, 100);
  assert.equal(result.devices.reduce((sum, item) => sum + item.count, 0), 2);
});

test("visitor analytics normalize PostgreSQL date values to stable day keys", () => {
  assert.equal(dayString(new Date("2026-09-02T00:00:00.000Z")), "2026-09-02");
  assert.equal(dayString("2026-09-03"), "2026-09-03");
  assert.equal(dayString("2026-09-03T12:34:56.000Z"), "2026-09-03");
});

test("visitor analytics use one-way hashes and reject malformed anonymous ids", () => {
  const raw = "visitor-private-example-123";
  const hash = visitorHash(raw);
  assert.equal(hash.length, 40);
  assert.notEqual(hash, raw);
  assert.equal(safeVisitorId(raw), raw);
  assert.equal(safeVisitorId("bad"), null);
});

test("enabled audience persistence writes hashed identity and parameterized context", async () => {
  const calls = [];
  const fakeSql = async (strings, ...values) => {
    calls.push({ text: strings.join("?"), values });
    return [];
  };

  await withMockedNeon(fakeSql, async (store) => {
    const visitorId = "visitor-audience-neon-12345678";
    const saved = await store.recordAudienceEvent({
      day: "2026-09-03",
      visitorId,
      event: "message_1",
      now: 1_788_000_000_000,
      context: {
        countryCode: "MY",
        countryName: "Malaysia",
        region: "Selangor",
        city: "Petaling Jaya",
        deviceType: "Mobile",
        browser: "Chrome",
        os: "Android",
        source: "Facebook",
        campaign: "demo-september",
      },
    });
    assert.equal(saved, true);
    assert.equal(store.enabled, true);
    assert.equal(calls.some((call) => /INSERT INTO demo_ops_audience_visitors/.test(call.text)), true);
    assert.equal(calls.some((call) => /INSERT INTO demo_ops_audience_daily/.test(call.text)), true);
    const allValues = calls.flatMap((call) => call.values.map(String));
    assert.equal(allValues.includes(visitorId), false, "raw browser visitor id must never be sent to Neon");
    assert.equal(allValues.includes(store._test.visitorHash(visitorId)), true, "hashed visitor identity should be persisted");
    assert.equal(allValues.includes("Petaling Jaya"), true);
    assert.equal(allValues.includes("demo-september"), true);
  });
});

test("enabled audience reader handles Date rows and builds selected-period metrics", async () => {
  const fakeSql = async (strings) => {
    const query = strings.join("?");
    if (/FROM demo_ops_audience_daily d/.test(query)) {
      return [{
        day: new Date("2026-09-03T00:00:00.000Z"),
        visitor_hash: "hash-a",
        first_day: new Date("2026-09-02T00:00:00.000Z"),
        first_seen_at: 1_000,
        last_seen_at: 61_000,
        visits: 2,
        country_name: "Malaysia",
        region: "Selangor",
        city: "Petaling Jaya",
        device_type: "Mobile",
        browser: "Chrome",
        os: "Android",
        source: "Facebook",
        reached_message1: true,
        reached_message3: false,
        reached_dashboard: true,
        reached_takeover: false,
        reached_complete: false,
        reached_cta: false,
      }];
    }
    if (/FROM demo_ops_audience_visitors\s+ORDER BY last_seen_at/.test(query)) {
      return [{
        visitor_hash: "1234567890abcdef1234567890abcdef12345678",
        first_seen_at: 1_000,
        last_seen_at: 61_000,
        visit_count: 2,
        country_name: "Malaysia",
        region: "Selangor",
        city: "Petaling Jaya",
        device_type: "Mobile",
        browser: "Chrome",
        os: "Android",
        source: "Facebook",
        reached_message1: true,
        reached_dashboard: true,
      }];
    }
    return [];
  };

  await withMockedNeon(fakeSql, async (store) => {
    const days = ["2026-09-01", "2026-09-02", "2026-09-03"];
    const audience = await store.readAudience(days);
    assert.equal(audience.ranges["7"].totalVisits, 2);
    assert.equal(audience.ranges["7"].uniqueVisitors, 1);
    assert.equal(audience.ranges["7"].returningVisitors, 0);
    assert.equal(audience.ranges["7"].sources[0].label, "Facebook");
    assert.equal(audience.recentVisitors[0].location, "Petaling Jaya, Selangor, Malaysia");
  });
});

test("recent visitor output exposes anonymous operational context only", () => {
  const row = publicRecentVisitor({
    visitor_hash: "1234567890abcdef1234567890abcdef12345678",
    first_seen_at: 1000,
    last_seen_at: 2000,
    visit_count: 4,
    country_name: "Malaysia",
    region: "Selangor",
    city: "Petaling Jaya",
    device_type: "Mobile",
    browser: "Chrome",
    os: "Android",
    source: "Instagram",
    campaign: "demo-september",
    reached_message1: true,
    reached_message3: true,
    reached_dashboard: true,
    reached_takeover: true,
    reached_complete: false,
    reached_cta: false,
  });

  assert.equal(row.id, "12345678");
  assert.equal(row.location, "Petaling Jaya, Selangor, Malaysia");
  assert.equal(row.messageStage, "3+");
  assert.equal(row.stage, "Human takeover");
  assert.equal("ip" in row, false);
  assert.equal("visitor_hash" in row, false);
});
