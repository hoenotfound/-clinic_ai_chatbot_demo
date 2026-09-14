const test = require("node:test");
const assert = require("node:assert/strict");

process.env.AI_PROVIDER = "mock";
process.env.DEMO_INDUSTRY = "clinic";

const industry = require("../src/industryProfile");
const ai = require("../src/aiService");

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
  assert.match(reply, /Acupuncture/);
  assert.match(reply, /RM\s*80/);
  assert.doesNotMatch(reply, /HIFU|Pico|Botox|Skin Booster/i);
});

test("TCM concern fallback remains practitioner-led", () => {
  const reply = tcmFallback([{ role: "user", content: "最近肩颈一直很紧，有什么服务可以了解？" }]);
  assert.match(reply, /Acupuncture|Tuina/);
  assert.match(reply, /中医师|practitioner|pengamal/i);
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

test("TCM Sunday booking request stays within configured opening days", () => {
  const reply = tcmFallback([{ role: "user", content: "Can I book acupuncture in KL on Sunday?" }]);
  assert.match(reply, /Sunday/i);
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

test("TCM prompt uses only TCM service inventory", () => {
  const prompt = industry.runWithIndustry("tcm", () => ai._test.enhancedSystemPrompt(false));
  assert.match(prompt, /TCM FRONT-DESK BEHAVIOUR/i);
  assert.match(prompt, /Acupuncture/);
  assert.match(prompt, /Chinese Herbal Medicine Consultation/);
  assert.doesNotMatch(prompt, /HIFU Skin Lifting|Pico Laser|Botulinum Toxin|Skin Booster/);
});
