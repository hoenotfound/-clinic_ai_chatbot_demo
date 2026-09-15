const test = require("node:test");
const assert = require("node:assert/strict");

process.env.AI_PROVIDER = "mock";
process.env.DEMO_INDUSTRY = "clinic";

const industry = require("../src/industryProfile");
const ai = require("../src/aiService");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("runtime industry contexts stay isolated across concurrent async work", async () => {
  const [clinic, tcm, renovation] = await Promise.all([
    industry.runWithIndustry("clinic", async () => {
      await delay(15);
      return {
        key: industry.key,
        business: industry.config.clinicName,
        reply: ai.getFallbackReply([{ role: "user", content: "How much is HIFU?" }]),
        prompt: ai._test.enhancedSystemPrompt(true),
      };
    }),
    industry.runWithIndustry("tcm", async () => {
      await delay(10);
      return {
        key: industry.key,
        business: industry.config.clinicName,
        reply: ai.getFallbackReply([{ role: "user", content: "针灸多少钱？" }]),
        prompt: ai._test.enhancedSystemPrompt(true),
      };
    }),
    industry.runWithIndustry("renovation", async () => {
      await delay(5);
      return {
        key: industry.key,
        business: industry.config.businessName,
        reply: ai.getFallbackReply([{ role: "user", content: "Kitchen cabinet how much?" }]),
        prompt: ai._test.enhancedSystemPrompt(true),
      };
    }),
  ]);

  assert.equal(clinic.key, "clinic");
  assert.match(clinic.business, /Nova Demo Aesthetic Clinic/i);
  assert.match(clinic.reply, /HIFU|RM888/i);
  assert.match(clinic.prompt, /CONCERN-TO-TREATMENT/i);
  assert.doesNotMatch(clinic.prompt, /AI-FIRST RENOVATION OVERRIDE/i);

  assert.equal(tcm.key, "tcm");
  assert.match(tcm.business, /Harmony Demo TCM Centre/i);
  assert.match(tcm.reply, /Acupuncture|RM\s*80/i);
  assert.match(tcm.prompt, /TCM FRONT-DESK BEHAVIOUR/i);
  assert.match(tcm.prompt, /CONCERN-TO-TREATMENT/i);
  assert.doesNotMatch(tcm.prompt, /HIFU|Pico Laser|AI-FIRST RENOVATION OVERRIDE/i);

  assert.equal(renovation.key, "renovation");
  assert.match(renovation.business, /Oakline Demo Renovation/i);
  assert.match(renovation.reply, /RM 6,800/i);
  assert.match(renovation.prompt, /SERVICES AND SAMPLE PRICE GUIDES/i);
  assert.match(renovation.prompt, /AI-FIRST RENOVATION OVERRIDE/i);
  assert.doesNotMatch(renovation.prompt, /CONCERN-TO-TREATMENT/i);
});

test("profile registry exposes the selector choices", () => {
  const options = industry.listIndustryProfiles();
  assert.deepEqual(options.map((item) => item.key), ["clinic", "tcm", "renovation"]);
  assert.match(options[0].label, /Aesthetic Clinic/i);
  assert.match(options[1].label, /Traditional Chinese Medicine/i);
  assert.match(options[2].label, /Home Renovation/i);
});
