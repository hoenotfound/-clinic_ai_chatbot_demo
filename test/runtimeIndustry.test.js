const test = require("node:test");
const assert = require("node:assert/strict");

process.env.AI_PROVIDER = "mock";
process.env.DEMO_INDUSTRY = "clinic";

const industry = require("../src/industryProfile");
const ai = require("../src/aiService");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("runtime industry contexts stay isolated across concurrent async work", async () => {
  const [clinic, renovation] = await Promise.all([
    industry.runWithIndustry("clinic", async () => {
      await delay(15);
      return {
        key: industry.key,
        business: industry.config.clinicName,
        reply: ai.getFallbackReply([{ role: "user", content: "How much is HIFU?" }]),
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
  assert.doesNotMatch(clinic.prompt, /STRUCTURED RENOVATION SALES KNOWLEDGE/i);

  assert.equal(renovation.key, "renovation");
  assert.match(renovation.business, /Oakline Demo Renovation/i);
  assert.match(renovation.reply, /RM 6,800/i);
  assert.match(renovation.prompt, /STRUCTURED RENOVATION SALES KNOWLEDGE/i);
  assert.doesNotMatch(renovation.prompt, /CONCERN-TO-TREATMENT/i);
});

test("profile registry exposes the selector choices", () => {
  const options = industry.listIndustryProfiles();
  assert.deepEqual(options.map((item) => item.key), ["clinic", "renovation"]);
  assert.match(options[0].label, /Aesthetic Clinic/i);
  assert.match(options[1].label, /Home Renovation/i);
});
