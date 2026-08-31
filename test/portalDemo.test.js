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

test("production-like inbox controls and lead-details drawer are present", () => {
  const markup = dashboardMarkup();
  for (const id of ["portalInboxSearch", "portalInboxChannel", "portalInboxOwner", "portalDetailsScrim"]) {
    assert.match(markup, new RegExp(`id=["']${id}["']`));
  }
  for (const filter of ["all", "unreplied", "followup", "unread", "attention"]) {
    assert.match(markup, new RegExp(`data-inbox-filter=["']${filter}["']`));
  }
  assert.match(markup, /data-lead-details/);
  assert.match(markup, /portal-details-drawer/);
  assert.match(markup, /portal-nav-svg/);
});

test("fidelity styles retain production portal dimensions and responsive breakpoints", () => {
  const css = read("portal-fidelity.css");
  const mobileCss = read("portal-fidelity-extra.css");
  assert.match(css, /width:15rem;flex-basis:15rem/);
  assert.match(css, /grid-template-columns:24\.5rem minmax\(0,1fr\)/);
  assert.match(css, /flex-basis:19rem;min-width:19rem/);
  assert.match(css, /width:18rem;flex:0 0 18rem/);
  assert.match(css, /@media\(max-width:1023px\)/);
  assert.match(css, /@media\(max-width:767px\)/);
  assert.match(mobileCss, /portal-mobile-back/);
});

test("portal assets are wired through the server-side index enhancer", () => {
  const server = fs.readFileSync(path.join(ROOT, "src", "server.js"), "utf8");
  const index = read("index.html");
  assert.match(index, /id="dashboardView"/);
  assert.match(index, /<script src="\/app\.js" defer><\/script>/);
  assert.match(server, /PORTAL_DASHBOARD_PARTS/);
  assert.match(server, /portal-demo\.css/);
  assert.match(server, /portal-fidelity\.css/);
  assert.match(server, /portal-data\.js/);
  assert.match(server, /portal-demo\.js/);
  assert.match(server, /portal-fidelity\.js/);
  assert.match(server, /buildEnhancedIndex/);
});

test("fidelity interaction layer includes drawer, filtering and mobile thread behavior", () => {
  const js = read("portal-fidelity.js");
  assert.match(js, /details-open/);
  assert.match(js, /portalInboxSearch/);
  assert.match(js, /portalInboxChannel/);
  assert.match(js, /portalInboxOwner/);
  assert.match(js, /portal-mobile-back/);
  assert.match(js, /thread-open/);
  assert.match(js, /portal-fidelity-extra\.css/);
});
