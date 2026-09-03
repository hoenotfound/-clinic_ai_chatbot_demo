const test = require("node:test");
const assert = require("node:assert/strict");
const { SOURCES, getAcquisitionSource } = require("../src/acquisitionSources");

test("demo acquisition sources include Meta, organic and referral journeys", () => {
  assert.ok(SOURCES.some((item) => item.source === "Meta Ads" && item.campaign));
  assert.ok(SOURCES.some((item) => item.source === "Organic"));
  assert.ok(SOURCES.some((item) => item.source === "Referral"));
});

test("unknown acquisition source falls back safely", () => {
  assert.equal(getAcquisitionSource("missing").key, "organic-whatsapp");
});
