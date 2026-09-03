const test = require("node:test");
const assert = require("node:assert/strict");
const { enforceBookingRules } = require("../src/bookingRules");

test("Sunday booking request is rejected before the AI provider", () => {
  const reply = enforceBookingRules([{ role: "user", content: "Can I book PJ Sunday morning?" }]);
  assert.match(reply, /closed on Sundays/i);
  assert.match(reply, /Saturday|weekday/i);
});

test("short Sunday answer is rejected when previous assistant was collecting booking timing", () => {
  const reply = enforceBookingRules([
    { role: "user", content: "I want to book HIFU" },
    { role: "assistant", content: "Would weekday or weekend work better for you?" },
    { role: "user", content: "Sunday morning" },
  ]);
  assert.match(reply, /Sunday isn't available/i);
});

test("general Sunday opening-hours question is left to normal clinic FAQ handling", () => {
  const reply = enforceBookingRules([{ role: "user", content: "Are you open Sunday?" }]);
  assert.equal(reply, null);
});
