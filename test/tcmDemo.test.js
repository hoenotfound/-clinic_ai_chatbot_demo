const test = require("node:test");
const assert = require("node:assert/strict");

process.env.AI_PROVIDER = "mock";
process.env.DEMO_INDUSTRY = "clinic";

const industry = require("../src/industryProfile");
const ai = require("../src/aiService");
const state = require("../src/demoState");
const { enforceTcmSafetyRules } = require("../src/tcmSafetyContext");

function tcmFallback(messages) {
  return industry.runWithIndustry("tcm", () => ai.getFallbackReply(messages));
}

test("TCM profile is independent from aesthetic clinic knowledge", () => {
  const profile = industry.getIndustryProfile("tcm");
  assert.equal(profile.key, "tcm");
  assert.equal(profile.config.clinicName, "Harmony Demo TCM Centre");
  assert.ok(profile.config.services.some((service) => service.name === "Acupuncture"));
  assert.ok(profile.config.services.some((service) => service.name === "Tuina"));
  assert.equal(profile.config.services.some((service) => /HIFU|Pico|Botulinum/i.test(service.name)), false);
});

test("TCM fallback answers Chinese acupuncture pricing without aesthetic leakage", () => {
  const reply = tcmFallback([{ role: "user", content: "请问针灸一次多少钱？" }]);
  assert.match(reply, /针灸/);
  assert.match(reply, /RM\s*80/);
  assert.doesNotMatch(reply, /HIFU|Pico|Botox|Skin Booster/i);
});

test("TCM concern fallback remains practitioner-led", () => {
  const reply = tcmFallback([{ role: "user", content: "最近肩颈一直很紧，有什么服务可以了解？" }]);
  assert.match(reply, /针灸|推拿/);
  assert.match(reply, /中医师|practitioner|pengamal/i);
});

test("TCM compound concern and price question answers both parts", () => {
  const reply = tcmFallback([{ role: "user", content: "最近肩颈很紧，针灸多少钱？" }]);
  assert.match(reply, /RM\s*80/);
  assert.match(reply, /针灸/);
  assert.match(reply, /推拿|中医师/i);
});

test("TCM booking flow remembers branch and timing then hands off", () => {
  const messages = [
    { role: "user", content: "I want acupuncture." },
    { role: "assistant", content: "Sure. Which branch is more convenient?" },
    { role: "user", content: "KL, Saturday afternoon can?" },
  ];
  const reply = tcmFallback(messages);
  assert.match(reply, /Acupuncture/i);
  assert.match(reply, /Kuala Lumpur/i);
  assert.match(reply, /Saturday afternoon/i);
  assert.match(reply, /\[\[HANDOFF\]\]/);
});

test("public tour phrase Saturday afternoon in KL becomes appointment intent after scheduling prompt", () => {
  const messages = [
    { role: "user", content: "How much is acupuncture?" },
    { role: "assistant", content: "If you'd like to arrange a visit, tell me the branch and day/time that suit you." },
    { role: "user", content: "Saturday afternoon in KL?" },
  ];
  const reply = tcmFallback(messages);
  assert.match(reply, /Kuala Lumpur/i);
  assert.match(reply, /Saturday afternoon/i);
  assert.match(reply, /\[\[HANDOFF\]\]/);
});

test("TCM Sunday booking request stays within configured opening days", () => {
  const reply = tcmFallback([{ role: "user", content: "Can I book acupuncture in KL on Sunday?" }]);
  assert.match(reply, /Sunday/i);
  assert.doesNotMatch(reply, /\[\[HANDOFF\]\]/);
});

test("contextual Sunday reply after a booking prompt still enforces closed day", () => {
  const messages = [
    { role: "user", content: "I want acupuncture." },
    { role: "assistant", content: "Tell me the branch and day/time that suit you." },
    { role: "user", content: "KL, Sunday can?" },
  ];
  const reply = tcmFallback(messages);
  assert.match(reply, /closed on Sundays|Sunday/i);
  assert.doesNotMatch(reply, /\[\[HANDOFF\]\]/);
});

test("TCM direct practitioner request routes to human takeover", () => {
  const reply = tcmFallback([{ role: "user", content: "Can I speak with a TCM practitioner?" }]);
  assert.match(reply, /TCM team|practitioner/i);
  assert.match(reply, /\[\[HANDOFF\]\]/);
});

test("TCM normal service enquiry does not unnecessarily trigger handoff", () => {
  const reply = tcmFallback([{ role: "user", content: "Do you provide cupping?" }]);
  assert.match(reply, /Cupping/i);
  assert.doesNotMatch(reply, /\[\[HANDOFF\]\]/);
});

test("Chinese herbal medicine service enquiry is not mistaken for a medication interaction", () => {
  const reply = tcmFallback([{ role: "user", content: "Do you provide Chinese herbal medicine?" }]);
  assert.match(reply, /Chinese Herbal Medicine Consultation|herbal/i);
  assert.doesNotMatch(reply, /\[\[HANDOFF\]\]/);
});

test("Malay ubat herba enquiry answers configured consultation price without handoff", () => {
  const reply = tcmFallback([{ role: "user", content: "Ada ubat herba? Harga berapa?" }]);
  assert.match(reply, /Konsultasi Herba Cina|herba/i);
  assert.match(reply, /RM\s*50/);
  assert.doesNotMatch(reply, /\[\[HANDOFF\]\]/);
});

test("practitioner consultation price enquiry stays in front-desk flow", () => {
  const reply = tcmFallback([{ role: "user", content: "How much is the practitioner consultation?" }]);
  assert.match(reply, /TCM Consultation/i);
  assert.match(reply, /RM\s*50/);
  assert.doesNotMatch(reply, /\[\[HANDOFF\]\]/);
});

test("herbal medicine plus existing medication still routes to practitioner", () => {
  const reply = tcmFallback([{ role: "user", content: "I take regular medication. Can I take Chinese herbs with it?" }]);
  assert.match(reply, /practitioner|TCM team/i);
  assert.match(reply, /\[\[HANDOFF\]\]/);
});

test("booking phrase can I take the 3pm slot is not treated as medical suitability", () => {
  const safety = enforceTcmSafetyRules([{ role: "user", content: "Can I take the 3pm slot?" }]);
  assert.equal(safety, null);
  const reply = tcmFallback([{ role: "user", content: "Can I take the 3pm slot?" }]);
  assert.doesNotMatch(reply, /personalised advice/i);
});

test("service plus scheduling wording stays in booking flow across English BM and Chinese", () => {
  const cases = [
    ["Can I do acupuncture Friday at 3pm in KL?", /Friday, 3:00 PM/i],
    ["Boleh saya buat akupunktur Jumaat 3pm di KL?", /Friday, 3:00 PM/i],
    ["星期五下午在KL可以针灸吗？", /Friday afternoon/i],
  ];

  for (const [message, timingPattern] of cases) {
    const safety = enforceTcmSafetyRules([{ role: "user", content: message }]);
    assert.equal(safety, null, message);
    const reply = tcmFallback([{ role: "user", content: message }]);
    assert.match(reply, timingPattern, message);
    assert.match(reply, /\[\[HANDOFF\]\]/, message);
    assert.doesNotMatch(reply, /personalised advice|nasihat peribadi|个人情况判断/, message);
  }
});

test("medical safety still overrides a scheduling-shaped acupuncture request", () => {
  const message = "I'm pregnant. Can I do acupuncture Friday at 3pm in KL?";
  const reply = enforceTcmSafetyRules([{ role: "user", content: message }]);
  assert.match(reply || "", /practitioner|TCM team/i);
  assert.match(reply || "", /\[\[HANDOFF\]\]/);
});

test("TCM lead state promotes prompted branch and timing response to appointment intent", () => {
  const previousInterval = state.limits.minMessageIntervalMs;
  state.limits.minMessageIntervalMs = 0;
  try {
    industry.runWithIndustry("tcm", () => {
      const session = state.createSession({ ip: `tcm-intent-${Date.now()}` });
      state.addCustomerMessage(session, "I want acupuncture.");
      state.addAssistantMessage(session, "Sure. Which branch and preferred day or time suit you?");
      state.addCustomerMessage(session, "KL, Saturday afternoon can?");
      assert.equal(session.lead.bookingIntent, true);
      assert.equal(session.lead.temperature, "hot");
      assert.equal(session.lead.preferredBranch, "Kuala Lumpur");
      assert.equal(session.lead.preferredTiming, "Saturday afternoon");
      assert.equal(session.lead.estimatedValue, 80);
      assert.match(session.lead.summary, /Appointment intent detected/i);
      assert.doesNotMatch(session.lead.summary, /clinic visit|specific treatment/i);
    });
  } finally {
    state.limits.minMessageIntervalMs = previousInterval;
  }
});

test("TCM lead stores exact AM/PM timing in appointment context", () => {
  const previousInterval = state.limits.minMessageIntervalMs;
  state.limits.minMessageIntervalMs = 0;
  try {
    industry.runWithIndustry("tcm", () => {
      const session = state.createSession({ ip: `tcm-clock-${Date.now()}` });
      state.addCustomerMessage(session, "I want acupuncture.");
      state.addAssistantMessage(session, "Which branch and preferred day or time suit you?");
      state.addCustomerMessage(session, "KL, Saturday at 3pm can?");
      assert.equal(session.lead.bookingIntent, true);
      assert.equal(session.lead.preferredBranch, "Kuala Lumpur");
      assert.equal(session.lead.preferredTiming, "Saturday, 3:00 PM");
    });
  } finally {
    state.limits.minMessageIntervalMs = previousInterval;
  }
});

test("TCM lead preserves individual weekday names in English BM and Chinese", () => {
  const previousInterval = state.limits.minMessageIntervalMs;
  state.limits.minMessageIntervalMs = 0;
  try {
    const cases = [
      ["KL, Friday afternoon can?", "Friday afternoon"],
      ["KL, Jumaat 3pm boleh?", "Friday, 3:00 PM"],
      ["KL，星期五下午可以吗？", "Friday afternoon"],
    ];

    for (const [message, expectedTiming] of cases) {
      industry.runWithIndustry("tcm", () => {
        const session = state.createSession({ ip: `tcm-weekday-${Date.now()}-${Math.random()}` });
        state.addCustomerMessage(session, "I want acupuncture.");
        state.addAssistantMessage(session, "Which branch and preferred day or time suit you?");
        state.addCustomerMessage(session, message);
        assert.equal(session.lead.bookingIntent, true, message);
        assert.equal(session.lead.preferredBranch, "Kuala Lumpur", message);
        assert.equal(session.lead.preferredTiming, expectedTiming, message);
      });
    }
  } finally {
    state.limits.minMessageIntervalMs = previousInterval;
  }
});

test("TCM branch and timing browsing response does not become appointment intent", () => {
  const previousInterval = state.limits.minMessageIntervalMs;
  state.limits.minMessageIntervalMs = 0;
  try {
    industry.runWithIndustry("tcm", () => {
      const session = state.createSession({ ip: `tcm-browse-${Date.now()}` });
      state.addCustomerMessage(session, "How much is acupuncture?");
      state.addAssistantMessage(session, "If you'd like to arrange a visit, tell me the branch and day/time that suit you.");
      state.addCustomerMessage(session, "KL, Saturday afternoon, just checking first.");
      assert.equal(session.lead.bookingIntent, false);
      assert.notEqual(session.lead.temperature, "hot");
    });
  } finally {
    state.limits.minMessageIntervalMs = previousInterval;
  }
});

test("TCM lead stores customer-stated concern separately from service", () => {
  industry.runWithIndustry("tcm", () => {
    const session = state.createSession({ ip: `tcm-concern-${Date.now()}` });
    state.addCustomerMessage(session, "最近肩颈很紧，想了解针灸。");
    assert.match(session.lead.concern || "", /shoulder|neck/i);
    assert.deepEqual(session.lead.interests, ["Acupuncture"]);
    assert.equal(session.lead.estimatedValue, 80);
  });
});

test("TCM prompt uses only TCM service inventory", () => {
  const prompt = industry.runWithIndustry("tcm", () => ai._test.enhancedSystemPrompt(false));
  assert.match(prompt, /TCM FRONT-DESK BEHAVIOUR/i);
  assert.match(prompt, /Acupuncture/);
  assert.match(prompt, /Chinese Herbal Medicine Consultation/);
  assert.doesNotMatch(prompt, /HIFU Skin Lifting|Pico Laser|Botulinum Toxin|Skin Booster/);
});
