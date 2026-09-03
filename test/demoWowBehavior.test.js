const test = require("node:test");
const assert = require("node:assert/strict");

const previousEnv = {
  AI_PROVIDER: process.env.AI_PROVIDER,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_API_KEY_1: process.env.GEMINI_API_KEY_1,
  GEMINI_API_KEY_2: process.env.GEMINI_API_KEY_2,
};
const previousFetch = global.fetch;

process.env.AI_PROVIDER = "gemini";
delete process.env.GEMINI_API_KEY;
process.env.GEMINI_API_KEY_1 = "wow-test-key";
delete process.env.GEMINI_API_KEY_2;
delete require.cache[require.resolve("../src/aiService")];

const ai = require("../src/aiService");
const clinic = require("../src/clinicConfig");
const { buildSystemPrompt } = require("../src/systemPrompt");

function successResponse(text = "provider reply") {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  };
}

test.after(() => {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  global.fetch = previousFetch;
  delete require.cache[require.resolve("../src/aiService")];
});

test("configured Gemini never receives a message that deterministic clinical safety must intercept", async () => {
  let providerCalls = 0;
  global.fetch = async () => {
    providerCalls += 1;
    return successResponse();
  };

  const reply = await ai.getReply([
    { role: "user", content: "I'm pregnant and taking antibiotics. Can I do HIFU?" },
  ], true);

  assert.match(reply, /\[\[HANDOFF\]\]/);
  assert.equal(providerCalls, 0, "clinical safety should run before any Gemini request");
});

test("booking-style can-I-do wording stays in the booking flow when it includes clear scheduling cues", () => {
  const reply = ai.getFallbackReply([
    { role: "user", content: "Can I do HIFU Saturday at PJ?" },
  ]);

  assert.match(reply, /HIFU/i);
  assert.match(reply, /Petaling Jaya/i);
  assert.match(reply, /Saturday/i);
  assert.match(reply, /\[\[HANDOFF\]\]/);
  assert.doesNotMatch(reply, /advise you directly|guessing from chat/i);
});

test("compound fallback answers price and comfort before completing the booking handoff", () => {
  const reply = ai.getFallbackReply([
    { role: "user", content: "How much is HIFU, is it painful, and can I come Saturday at PJ?" },
  ]);

  assert.match(reply, /RM 888/);
  assert.match(reply, /comfort varies/i);
  assert.match(reply, /Petaling Jaya/i);
  assert.match(reply, /Saturday/i);
  assert.match(reply, /\[\[HANDOFF\]\]/);
});

test("fallback remembers the treatment for a bare follow-up question", () => {
  const reply = ai.getFallbackReply([
    { role: "user", content: "I'm looking at HIFU for my jawline" },
    { role: "assistant", content: "HIFU is commonly used for lifting and jawline definition." },
    { role: "user", content: "how long?" },
  ]);

  assert.match(reply, /HIFU/i);
  assert.match(reply, /45.?75/i);
});

test("latest branch correction overrides the older preference", () => {
  const reply = ai.getFallbackReply([
    { role: "user", content: "I want HIFU at PJ" },
    { role: "assistant", content: "Would weekday or weekend suit you better?" },
    { role: "user", content: "Actually KL, Saturday" },
  ]);

  assert.match(reply, /Kuala Lumpur/i);
  assert.match(reply, /Saturday/i);
  assert.doesNotMatch(reply, /Petaling Jaya/i);
});

test("budget objection keeps treatment context and stays low pressure", () => {
  const reply = ai.getFallbackReply([
    { role: "user", content: "How much is HIFU?" },
    { role: "assistant", content: "HIFU starts from RM 888." },
    { role: "user", content: "That's too expensive, I need to think" },
  ]);

  assert.match(reply, /RM 888/);
  assert.match(reply, /complimentary/i);
  assert.match(reply, /no pressure/i);
  assert.doesNotMatch(reply, /book now|limited slot|hurry/i);
});

test("promotion response feels like a clinic reply instead of breaking the demo illusion", () => {
  const reply = ai.getFallbackReply([{ role: "user", content: "Any HIFU promo now?" }]);
  assert.match(reply, /HIFU Lifting Special/i);
  assert.match(reply, /RM 888/);
  assert.doesNotMatch(reply, /fictional|software demo|fake|countdown/i);
});

test("price comparison answers both services while explaining they are not interchangeable", () => {
  const reply = ai.getFallbackReply([
    { role: "user", content: "Which is cheaper, HIFU or Pico?" },
  ]);

  assert.match(reply, /RM 888/);
  assert.match(reply, /RM 388/);
  assert.match(reply, /different concerns|different|berbeza|不一样/i);
});

test("normal clinic FAQs and promotions do not contain unnecessary demo chatter", () => {
  const normalFaqs = clinic.faqs.filter((faq) => !/deposit|payment/i.test(faq.q));
  for (const faq of normalFaqs) {
    assert.doesNotMatch(faq.a, /fictional|product demo|software demo|no real appointment/i);
  }
  for (const promotion of clinic.promotions) {
    assert.doesNotMatch(`${promotion.name} ${promotion.caption}`, /fictional|demo offer|software demo/i);
  }
});

test("system prompt explicitly requires memory, multi-part completeness and intent-aware conversion", () => {
  const prompt = buildSystemPrompt({ isFirstMessage: false });

  assert.match(prompt, /SILENT CONVERSATION MEMORY/i);
  assert.match(prompt, /newest explicit correction wins/i);
  assert.match(prompt, /Identify EVERY clear question or request/i);
  assert.match(prompt, /answer all clear parts of a multi-part message/i);
  assert.match(prompt, /INTENT-AWARE CONVERSION BEHAVIOUR/i);
  assert.match(prompt, /OBJECTION HANDLING/i);
  assert.match(prompt, /recap the useful known details/i);
  assert.match(prompt, /do NOT repeat that disclaimer in normal service, pricing, promotion, branch, consultation or FAQ answers/i);
});

test("unconfigured treatment questions stay honest without inventing a service", () => {
  const reply = ai.getFallbackReply([
    { role: "user", content: "Do you do lip filler?" },
  ]);

  assert.match(reply, /don’t have confirmed details|don't have confirmed details/i);
  assert.match(reply, /HIFU|Pico Laser/i);
  assert.doesNotMatch(reply, /RM\s?\d+.*filler|filler.*RM\s?\d+/i);
});
