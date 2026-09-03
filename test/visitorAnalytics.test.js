const test = require("node:test");
const assert = require("node:assert/strict");

const analytics = require("../src/visitorAnalyticsStore");

const { aggregateAudienceRows, visitorHash, safeVisitorId, publicRecentVisitor } = analytics._test;

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

test("visitor analytics use one-way hashes and reject malformed anonymous ids", () => {
  const raw = "visitor-private-example-123";
  const hash = visitorHash(raw);
  assert.equal(hash.length, 40);
  assert.notEqual(hash, raw);
  assert.equal(safeVisitorId(raw), raw);
  assert.equal(safeVisitorId("bad"), null);
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
