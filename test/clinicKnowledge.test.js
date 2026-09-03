const test = require("node:test");
const assert = require("node:assert/strict");
const knowledge = require("../src/clinicKnowledge");

test("concern mapping returns configured services", () => {
  assert.deepEqual(knowledge.treatmentsForConcern("I have pigmentation and acne marks"), ["Pico Laser"]);
  assert.ok(knowledge.treatmentsForConcern("double chin").includes("HIFU Skin Lifting"));
});

test("closed clinic days are detected deterministically", () => {
  assert.equal(knowledge.extractRequestedDay("Can I come Sunday morning?"), "sunday");
  assert.equal(knowledge.isClosedDay("sunday"), true);
  assert.equal(knowledge.bookingRuleViolation("PJ Sunday morning")?.type, "closed_day");
});
