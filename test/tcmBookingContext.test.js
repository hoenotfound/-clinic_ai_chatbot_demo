const test = require("node:test");
const assert = require("node:assert/strict");

process.env.AI_PROVIDER = "mock";
process.env.DEMO_INDUSTRY = "clinic";

const industry = require("../src/industryProfile");
const ai = require("../src/aiService");

function reply(messages) {
  return industry.runWithIndustry("tcm", () => ai.getFallbackReply(messages));
}

test("prompted Sunday-only reply is rejected before a branch is known", () => {
  const result = reply([
    { role: "user", content: "I want acupuncture." },
    { role: "assistant", content: "Which day would suit you better?" },
    { role: "user", content: "Sunday" },
  ]);
  assert.match(result, /closed on Sundays|Sunday/i);
  assert.doesNotMatch(result, /\[\[HANDOFF\]\]/);
});

test("prompted out-of-hours clock reply is rejected before handoff", () => {
  const result = reply([
    { role: "user", content: "I want acupuncture." },
    { role: "assistant", content: "What time would suit you?" },
    { role: "user", content: "9pm" },
  ]);
  assert.match(result, /outside operating hours/i);
  assert.doesNotMatch(result, /\[\[HANDOFF\]\]/);
});
