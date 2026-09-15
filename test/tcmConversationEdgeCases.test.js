const test = require("node:test");
const assert = require("node:assert/strict");

process.env.AI_PROVIDER = "mock";
process.env.DEMO_INDUSTRY = "clinic";

const industry = require("../src/industryProfile");
const ai = require("../src/aiService");
const { enforceTcmSafetyRules } = require("../src/tcmSafetyContext");
const { enforceTcmBookingRules } = require("../src/tcmBookingRulesContext");
const { hasTcmBookingIntent, timingFromText, servicesForText } = require("../src/tcmBookingIntent");

function tcmFallback(messages) {
  return industry.runWithIndustry("tcm", () => ai.getFallbackReply(messages));
}

test("explicit practitioner requests still hand off while informational questions stay automated", () => {
  const explicitRequests = [
    "Can I see a practitioner?",
    "Please connect me to a practitioner.",
    "I want to see a doctor.",
  ];
  for (const message of explicitRequests) {
    const reply = enforceTcmSafetyRules([{ role: "user", content: message }]);
    assert.match(reply || "", /\[\[HANDOFF\]\]/, message);
  }

  const informational = "How does the practitioner assess posture?";
  assert.equal(enforceTcmSafetyRules([{ role: "user", content: informational }]), null);

  const suitability = "Doctor said acupuncture may help. Is it safe for me?";
  const suitabilityReply = enforceTcmSafetyRules([{ role: "user", content: suitability }]);
  assert.match(suitabilityReply || "", /\[\[HANDOFF\]\]/);
});

test("fresh booking intent wins over browsing wording in the same customer message", () => {
  const message = "I want to book acupuncture, just checking if Friday 3pm in KL is available.";
  const messages = [{ role: "user", content: message }];
  assert.equal(hasTcmBookingIntent(messages), true);

  const reply = tcmFallback(messages);
  assert.match(reply, /Acupuncture/i);
  assert.match(reply, /Kuala Lumpur/i);
  assert.match(reply, /Friday, 3:00 PM/i);
  assert.match(reply, /\[\[HANDOFF\]\]/);

  const browsingOnly = [
    { role: "user", content: "I want to book acupuncture." },
    { role: "assistant", content: "Which branch and time suit you?" },
    { role: "user", content: "KL Saturday afternoon, just checking first." },
  ];
  assert.equal(hasTcmBookingIntent(browsingOnly), false);
});

test("Malay and Chinese midnight wording resolves to 12 AM and is blocked as out of hours", () => {
  assert.equal(timingFromText("Jumaat pukul 12 malam"), "Friday, 12:00 AM");
  assert.equal(timingFromText("星期五晚上12点"), "Friday, 12:00 AM");
  assert.equal(timingFromText("Jumaat pukul 12 petang"), "Friday, 12:00 PM");
  assert.equal(timingFromText("星期五下午12点"), "Friday, 12:00 PM");

  const cases = [
    ["Boleh saya buat akupunktur Jumaat pukul 12 malam di KL?", /di luar waktu operasi/i],
    ["星期五晚上12点在KL可以针灸吗？", /不在营业时段/],
  ];
  for (const [message, expected] of cases) {
    const reply = enforceTcmBookingRules([{ role: "user", content: message }]);
    assert.match(reply || "", expected, message);
    assert.doesNotMatch(reply || "", /\[\[HANDOFF\]\]/, message);
  }
});

test("generic consultation is suppressed on either side of a specific service phrase", () => {
  const normal = servicesForText("How much is acupuncture consultation?");
  assert.deepEqual(normal.map((service) => service.name), ["Acupuncture"]);

  const reversed = servicesForText("How much is consultation for acupuncture?");
  assert.deepEqual(reversed.map((service) => service.name), ["Acupuncture"]);

  const reply = tcmFallback([{ role: "user", content: "How much is consultation for acupuncture?" }]);
  assert.match(reply, /Acupuncture.*RM\s*80/i);
  assert.doesNotMatch(reply, /TCM Consultation.*RM\s*50|RM\s*50/i);

  const genuinelySeparate = servicesForText("How much are consultation and acupuncture?");
  assert.deepEqual(
    genuinelySeparate.map((service) => service.name).sort(),
    ["TCM Consultation", "Acupuncture"].sort(),
  );
});
