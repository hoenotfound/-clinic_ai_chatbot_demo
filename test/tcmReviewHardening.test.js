const test = require("node:test");
const assert = require("node:assert/strict");

process.env.AI_PROVIDER = "mock";
process.env.DEMO_INDUSTRY = "clinic";

const industry = require("../src/industryProfile");
const ai = require("../src/aiService");
const state = require("../src/demoState");
const { serviceForText, recentService } = require("../src/tcmBookingIntent");
const { enforceTcmSafetyRules } = require("../src/tcmSafetyContext");

function tcmFallback(messages) {
  return industry.runWithIndustry("tcm", () => ai.getFallbackReply(messages));
}

test("specific TCM service beats generic consultation alias", () => {
  const acupuncture = serviceForText("How much is acupuncture consultation?");
  assert.equal(acupuncture?.name, "Acupuncture");

  const acupunctureReply = tcmFallback([{ role: "user", content: "How much is acupuncture consultation?" }]);
  assert.match(acupunctureReply, /Acupuncture.*RM\s*80/i);
  assert.doesNotMatch(acupunctureReply, /TCM Consultation.*RM\s*50/i);

  const herbal = serviceForText("How much is Chinese Herbal Medicine Consultation?");
  assert.equal(herbal?.name, "Chinese Herbal Medicine Consultation");
});

test("service corrections prefer the requested replacement across English BM and Chinese", () => {
  const cases = [
    ["Actually not acupuncture, I want Tuina", "Tuina"],
    ["Bukan akupunktur, saya nak Tuina", "Tuina"],
    ["不是针灸，我要推拿", "Tuina"],
    ["Acupuncture instead of Tuina", "Acupuncture"],
  ];

  for (const [message, expected] of cases) {
    assert.equal(serviceForText(message)?.name, expected, message);
  }
});

test("corrected TCM service replaces the live lead service and value", () => {
  const previousInterval = state.limits.minMessageIntervalMs;
  state.limits.minMessageIntervalMs = 0;
  try {
    industry.runWithIndustry("tcm", () => {
      const session = state.createSession({ ip: `tcm-correction-${Date.now()}` });
      state.addCustomerMessage(session, "I want acupuncture.");
      assert.deepEqual(session.lead.interests, ["Acupuncture"]);
      assert.equal(session.lead.estimatedValue, 80);

      state.addCustomerMessage(session, "Actually not acupuncture, I want Tuina.");
      assert.deepEqual(session.lead.interests, ["Tuina"]);
      assert.equal(session.lead.estimatedValue, 90);
    });
  } finally {
    state.limits.minMessageIntervalMs = previousInterval;
  }
});

test("explicit TCM service rejection clears stale service interest without resurrecting history", () => {
  const messages = [
    { role: "user", content: "I want acupuncture." },
    { role: "assistant", content: "Sure, I can help with acupuncture." },
    { role: "user", content: "Actually I don't want acupuncture anymore." },
    { role: "assistant", content: "No problem." },
    { role: "user", content: "KL branch." },
  ];
  assert.equal(serviceForText("Actually I don't want acupuncture anymore."), null);
  assert.equal(recentService(messages), null);

  const previousInterval = state.limits.minMessageIntervalMs;
  state.limits.minMessageIntervalMs = 0;
  try {
    industry.runWithIndustry("tcm", () => {
      const session = state.createSession({ ip: `tcm-clear-service-${Date.now()}` });
      state.addCustomerMessage(session, "I want acupuncture.");
      assert.deepEqual(session.lead.interests, ["Acupuncture"]);
      assert.equal(session.lead.estimatedValue, 80);

      state.addCustomerMessage(session, "Actually I don't want acupuncture anymore.");
      assert.deepEqual(session.lead.interests, []);
      assert.equal(session.lead.estimatedValue, 0);

      state.addCustomerMessage(session, "KL branch.");
      assert.deepEqual(session.lead.interests, []);
      assert.equal(session.lead.estimatedValue, 0);
    });
  } finally {
    state.limits.minMessageIntervalMs = previousInterval;
  }
});

test("personal medical context overrides a scheduling-shaped suitability question", () => {
  const cases = [
    "I have a heart condition. Can I do acupuncture Friday at 3pm in KL?",
    "I have neck pain. Can I do acupuncture Friday at 3pm in KL?",
    "Saya ada darah tinggi. Boleh saya buat akupunktur Jumaat 3pm di KL?",
    "我有高血压，星期五下午在KL可以针灸吗？",
  ];

  for (const message of cases) {
    const reply = enforceTcmSafetyRules([{ role: "user", content: message }]);
    assert.match(reply || "", /\[\[HANDOFF\]\]/, message);
  }
});

test("plain service scheduling without medical context stays in booking flow", () => {
  const cases = [
    "Can I do acupuncture Friday at 3pm in KL?",
    "Boleh saya buat akupunktur Jumaat 3pm di KL?",
    "星期五下午在KL可以针灸吗？",
  ];

  for (const message of cases) {
    assert.equal(enforceTcmSafetyRules([{ role: "user", content: message }]), null, message);
  }
});

test("natural Malay herbal sales enquiries stay in front-desk flow", () => {
  const cases = [
    "Saya nak ubat herba.",
    "Boleh beli ubat herba?",
    "Ada jual ubat herba tak?",
  ];

  for (const message of cases) {
    assert.equal(enforceTcmSafetyRules([{ role: "user", content: message }]), null, message);
    const reply = tcmFallback([{ role: "user", content: message }]);
    assert.match(reply, /Chinese Herbal Medicine Consultation|herba/i, message);
    assert.doesNotMatch(reply, /\[\[HANDOFF\]\]/, message);
  }
});

test("Malay herbal enquiry with real medication context still hands off", () => {
  const cases = [
    "Saya nak ubat herba, tapi saya tengah makan ubat darah.",
    "Saya nak ubat herba, I take aspirin daily.",
  ];

  for (const message of cases) {
    const reply = enforceTcmSafetyRules([{ role: "user", content: message }]);
    assert.match(reply || "", /\[\[HANDOFF\]\]/, message);
  }
});

test("public holiday appointment requests are rejected deterministically in English BM and Chinese", () => {
  const cases = [
    ["Can I book acupuncture in KL on a public holiday?", /closed on public holidays/i],
    ["Boleh book akupunktur di KL masa cuti umum?", /tutup pada cuti umum/i],
    ["公共假期可以在KL预约针灸吗？", /公共假期休息/],
  ];

  for (const [message, expected] of cases) {
    const reply = tcmFallback([{ role: "user", content: message }]);
    assert.match(reply, expected, message);
    assert.doesNotMatch(reply, /\[\[HANDOFF\]\]/, message);
  }
});

test("public holiday-only reply is rejected after the assistant asks for timing", () => {
  const reply = tcmFallback([
    { role: "user", content: "I want acupuncture." },
    { role: "assistant", content: "Which day would suit you?" },
    { role: "user", content: "Public holiday" },
  ]);
  assert.match(reply, /closed on public holidays/i);
  assert.doesNotMatch(reply, /\[\[HANDOFF\]\]/);
});

test("short Malay weekday time reply keeps Malay for booking-rule responses", () => {
  const reply = tcmFallback([
    { role: "user", content: "I want acupuncture." },
    { role: "assistant", content: "What time would suit you?" },
    { role: "user", content: "Jumaat 9pm" },
  ]);
  assert.match(reply, /Masa itu di luar waktu operasi/i);
  assert.doesNotMatch(reply, /That time is outside operating hours/i);
});
