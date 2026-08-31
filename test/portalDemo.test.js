const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

function read(name) {
  return fs.readFileSync(path.join(PUBLIC, name), "utf8");
}

function dashboardMarkup() {
  return [1, 2, 3, 4]
    .map((number) => read(`portal-dashboard-part${number}.html`))
    .join("");
}

test("production-style demo portal includes every live dashboard hook exactly once", () => {
  const markup = dashboardMarkup();
  const ids = [
    "dashboardChannelAvatar",
    "conversationTime",
    "conversationPreview",
    "conversationChannelTag",
    "conversationTempTag",
    "staffChannelLabel",
    "modePill",
    "takeoverButton",
    "attentionBanner",
    "attentionReason",
    "staffMessages",
    "staffEmptyState",
    "staffForm",
    "staffInput",
    "staffSendButton",
    "staffComposerNotice",
    "leadTemperature",
    "leadScore",
    "temperatureBadge",
    "leadSummary",
    "leadTreatment",
    "leadBooking",
    "leadBranch",
    "leadTiming",
    "pipelineNew",
    "pipelineWarm",
    "pipelineHot",
  ];

  for (const id of ids) {
    const matches = markup.match(new RegExp(`id=["']${id}["']`, "g")) || [];
    assert.equal(matches.length, 1, `${id} should appear exactly once`);
  }
});

test("demo portal exposes Inbox, Pipeline, Analytics and Tools views", () => {
  const markup = dashboardMarkup();
  for (const id of ["portalPageInbox", "portalPagePipeline", "portalPageAnalytics", "portalPageTools"]) {
    assert.match(markup, new RegExp(`id=["']${id}["']`));
  }
  assert.match(markup, /Sample demo data/);
  assert.match(markup, /Automated follow-up/);
  assert.match(markup, /Automatic Lead Temperature/);
});

test("sample conversation history mixes English, Bahasa Malaysia and Chinese", () => {
  const data = read("portal-data.js");
  assert.match(data, /language: "EN"/);
  assert.match(data, /language: "BM"/);
  assert.match(data, /language: "中文"/);
  assert.match(data, /Amanda Lee/);
  assert.match(data, /Nur Aisyah/);
  assert.match(data, /林美玲 Mei Ling/);
  assert.match(data, /Siti Hajar/);
});

test("portal assets are wired through the server-side index enhancer", () => {
  const server = fs.readFileSync(path.join(ROOT, "src", "server.js"), "utf8");
  const index = read("index.html");
  assert.match(index, /id="dashboardView"/);
  assert.match(index, /<script src="\/app\.js" defer><\/script>/);
  assert.match(server, /PORTAL_DASHBOARD_PARTS/);
  assert.match(server, /portal-demo\.css/);
  assert.match(server, /portal-data\.js/);
  assert.match(server, /portal-demo\.js/);
  assert.match(server, /buildEnhancedIndex/);
});
