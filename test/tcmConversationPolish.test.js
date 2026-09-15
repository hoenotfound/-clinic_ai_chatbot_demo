const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";
process.env.DEMO_INDUSTRY = "clinic";

const industry = require("../src/industryProfile");
const ai = require("../src/aiService");
const state = require("../src/demoState");
const { enforceTcmSafetyRules } = require("../src/tcmSafetyContext");
const { enforceTcmBookingRules } = require("../src/tcmBookingRulesContext");
const { hasTcmBookingIntent, timingFromText, servicesForText } = require("../src/tcmBookingIntent");
const { _test: leadHelpers } = require("../src/appointmentLeadState");

function tcmFallback(messages) {
  return industry.runWithIndustry("tcm", () => ai.getFallbackReply(messages));
}

function source(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

test("unpriced TCM service replies never expose demo/configuration wording", () => {
  const reply = tcmFallback([{ role: "user", content: "骨盆trt多少钱？" }]);
  assert.match(reply, /team|评估|確認|确认/i);
  assert.doesNotMatch(reply, /not configured|配置在 demo|demo 里|demo ini/i);
  assert.doesNotMatch(reply, /RM\s*\d/i);
});

test("informational practitioner mentions do not trigger human takeover", () => {
  const cases = [
    "中医师会怎样评估骨盆？",
    "How does the practitioner assess posture?",
    "Pengamal TCM check postur macam mana?",
  ];
  for (const message of cases) {
    const safety = enforceTcmSafetyRules([{ role: "user", content: message }]);
    assert.equal(safety, null, message);
    const reply = tcmFallback([{ role: "user", content: message }]);
    assert.doesNotMatch(reply, /\[\[HANDOFF\]\]/, message);
  }
});

test("routine concern plus a clear scheduling request stays in booking flow", () => {
  const message = "I have neck pain. Can I do acupuncture Friday at 3pm in KL?";
  assert.equal(enforceTcmSafetyRules([{ role: "user", content: message }]), null);
  const reply = tcmFallback([{ role: "user", content: message }]);
  assert.match(reply, /Friday, 3:00 PM/i);
  assert.match(reply, /Kuala Lumpur/i);
  assert.match(reply, /\[\[HANDOFF\]\]/);
});

test("significant medical context still overrides a scheduling-shaped request", () => {
  const cases = [
    "I have hypertension. Can I do acupuncture Friday at 3pm in KL?",
    "Saya ada darah tinggi. Boleh saya buat akupunktur Jumaat 3pm di KL?",
    "我有高血压，星期五下午3pm在KL可以针灸吗？",
  ];
  for (const message of cases) {
    const reply = enforceTcmSafetyRules([{ role: "user", content: message }]);
    assert.match(reply || "", /\[\[HANDOFF\]\]/, message);
  }
});

test("browsing language resets old appointment intent until customer proceeds again", () => {
  const messages = [
    { role: "user", content: "I want to book acupuncture." },
    { role: "assistant", content: "Which branch and time suit you?" },
    { role: "user", content: "KL Saturday afternoon, just checking first." },
    { role: "assistant", content: "No problem." },
    { role: "user", content: "How much is Tuina?" },
  ];
  assert.equal(hasTcmBookingIntent(messages), false);
  const reply = tcmFallback(messages);
  assert.match(reply, /RM\s*90/i);
  assert.doesNotMatch(reply, /\[\[HANDOFF\]\]/);
});

test("natural opening-hour questions answer hours instead of treating the day as a preference", () => {
  const cases = [
    ["Are you open Saturday?", /open Monday.?Saturday|Saturday/i],
    ["星期六有开吗？", /有开|营业时间/],
    ["Sabtu buka tak?", /buka|Waktu operasi/i],
    ["Are you open Sunday?", /closed on Sundays|Sunday/i],
  ];
  for (const [message, expected] of cases) {
    const reply = tcmFallback([{ role: "user", content: message }]);
    assert.match(reply, expected, message);
    assert.doesNotMatch(reply, /If you decide to book|如果你决定要预约|Kalau anda decide nak book/i, message);
  }
});

test("BM Chinese and 24-hour clock formats are parsed and blocked after closing", () => {
  const cases = [
    ["Boleh saya buat akupunktur Jumaat pukul 8 malam di KL?", /di luar waktu operasi/i],
    ["星期五晚上8点在KL可以针灸吗？", /不在营业时段/],
    ["Can I do acupuncture Friday at 20:00 in KL?", /outside operating hours/i],
  ];
  for (const [message, expected] of cases) {
    const reply = enforceTcmBookingRules([{ role: "user", content: message }]);
    assert.match(reply || "", expected, message);
    assert.doesNotMatch(reply || "", /\[\[HANDOFF\]\]/, message);
  }
  assert.equal(timingFromText("Jumaat pukul 8 malam"), "Friday, 8:00 PM");
  assert.equal(timingFromText("星期五晚上8点"), "Friday, 8:00 PM");
  assert.equal(timingFromText("Friday 20:00"), "Friday, 8:00 PM");
});

test("cancelled TCM journey clears stale branch and timing and can re-engage cleanly", () => {
  const oldInterval = state.limits.minMessageIntervalMs;
  state.limits.minMessageIntervalMs = 0;
  try {
    industry.runWithIndustry("tcm", () => {
      const session = state.createSession({ ip: `tcm-polish-${Date.now()}` });
      state.addCustomerMessage(session, "I want acupuncture.");
      state.addAssistantMessage(session, "Which branch and time suit you?");
      state.addCustomerMessage(session, "KL Saturday afternoon can?");
      assert.equal(session.lead.bookingIntent, true);
      assert.equal(session.lead.preferredBranch, "Kuala Lumpur");

      state.addCustomerMessage(session, "Actually cancel, not booking anymore.");
      assert.equal(session.lead.bookingIntent, false);
      assert.equal(session.lead.reducedInterest, true);
      assert.equal(session.lead.preferredBranch, null);
      assert.equal(session.lead.preferredTiming, null);

      state.addCustomerMessage(session, "What about 小颜术?");
      assert.equal(session.lead.reducedInterest, false);
      assert.deepEqual(session.lead.interests, ["3D Facial Contour Manual Adjustment"]);
      assert.equal(session.lead.preferredBranch, null);
      assert.equal(session.lead.preferredTiming, null);
      assert.equal(session.lead.estimatedValue, null);
    });
  } finally {
    state.limits.minMessageIntervalMs = oldInterval;
  }
});

test("unpriced services use unknown lead value rather than zero", () => {
  assert.equal(leadHelpers.startingValue("Pelvic & Posture Manual Adjustment"), null);
  assert.equal(leadHelpers.startingValue("3D Facial Contour Manual Adjustment"), null);
  assert.equal(leadHelpers.startingValue("Acupuncture"), 80);

  const pipeline = source("portal-react/src/pages/Pipeline.jsx");
  const utils = source("portal-react/src/components/pipeline/pipelineUtils.js");
  assert.match(pipeline, /lead\.estimatedValue == null \? null/);
  assert.match(utils, /value === null \|\| value === undefined/);
});

test("multi-service price questions answer every named service", () => {
  const services = servicesForText("How much are acupuncture and Tuina?");
  assert.deepEqual(services.slice(0, 2).map((item) => item.name).sort(), ["Acupuncture", "Tuina"].sort());
  const reply = tcmFallback([{ role: "user", content: "How much are acupuncture and Tuina?" }]);
  assert.match(reply, /RM\s*80/i);
  assert.match(reply, /RM\s*90/i);
});

test("9D is explained as a companion step and does not invent pricing", () => {
  const info = tcmFallback([{ role: "user", content: "9D是什么？" }]);
  assert.match(info, /9D/);
  assert.match(info, /搭配|护理|紧致|保湿/);

  const price = tcmFallback([{ role: "user", content: "9D多少钱？" }]);
  assert.match(price, /9D/);
  assert.match(price, /team|确认|確認/i);
  assert.doesNotMatch(price, /RM\s*\d|demo|not configured/i);
});

test("routine service fallback sounds like a front desk rather than implementation language", () => {
  const reply = tcmFallback([{ role: "user", content: "Do you provide cupping?" }]);
  assert.match(reply, /Yes|Cupping|RM\s*60/i);
  assert.doesNotMatch(reply, /configured TCM services|configured service/i);
});

test("TCM system prompt forbids normal customer-facing demo/configuration wording", () => {
  const prompt = industry.runWithIndustry("tcm", () => ai._test.enhancedSystemPrompt(false));
  assert.match(prompt, /never tell the customer that a demo\/configuration is missing/i);
  assert.match(prompt, /informational mention.*NOT a handoff request/i);
  assert.doesNotMatch(prompt, /price has not been configured in the demo/i);
  assert.doesNotMatch(prompt, /没有配置在 demo 里/i);
});
