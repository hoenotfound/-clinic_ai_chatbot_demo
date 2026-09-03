const test = require("node:test");
const assert = require("node:assert/strict");
const { enforceBookingRules, _test } = require("../src/bookingRules");

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

test("explicit appointment times outside clinic hours are rejected before the AI provider", () => {
  for (const text of [
    "Can I book PJ at 9pm?",
    "I want an appointment at 09:30",
    "Saya nak datang pukul 9 malam",
    "我想预约晚上9点",
  ]) {
    const reply = enforceBookingRules([{ role: "user", content: text }]);
    assert.match(reply, /outside operating hours|di luar waktu operasi|不在营业时段内/i);
  }
});

test("an explicit time inside clinic hours is left for staff availability confirmation", () => {
  assert.equal(enforceBookingRules([{ role: "user", content: "Can I book PJ at 6pm?" }]), null);
  assert.equal(enforceBookingRules([{ role: "user", content: "Can I come at 10:30am?" }]), null);
});

test("a short out-of-hours answer is rejected when the assistant was collecting timing", () => {
  const reply = enforceBookingRules([
    { role: "user", content: "I want to book HIFU at PJ" },
    { role: "assistant", content: "What time would you prefer?" },
    { role: "user", content: "8:30pm" },
  ]);
  assert.match(reply, /outside operating hours/i);
});

test("configured operating window is derived from clinic hours", () => {
  const window = _test.configuredOperatingWindow();
  assert.equal(window.open, 10 * 60);
  assert.equal(window.close, 19 * 60);
});
