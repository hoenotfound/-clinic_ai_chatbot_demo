const test = require("node:test");
const assert = require("node:assert/strict");

const previousEnv = {
  DEMO_INDUSTRY: process.env.DEMO_INDUSTRY,
  AI_PROVIDER: process.env.AI_PROVIDER,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_API_KEY_1: process.env.GEMINI_API_KEY_1,
  GEMINI_API_KEY_2: process.env.GEMINI_API_KEY_2,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  GEMINI_FALLBACK_MODEL: process.env.GEMINI_FALLBACK_MODEL,
};
const previousFetch = global.fetch;

process.env.DEMO_INDUSTRY = "renovation";
process.env.AI_PROVIDER = "gemini";
delete process.env.GEMINI_API_KEY;
process.env.GEMINI_API_KEY_1 = "quotation-intent-test-key";
delete process.env.GEMINI_API_KEY_2;
process.env.GEMINI_MODEL = "gemini-3.6-flash";
process.env.GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";

const ai = require("../src/aiService");
const demoState = require("../src/demoState");
const { staffActionReason } = require("../src/renovationCapabilityShield");
const {
  isQuotationEducationQuestion,
  isFormalQuotationRequest,
} = require("../src/renovationQuotationIntent");

function successResponse(text) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  };
}

function restoreEnv() {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test.beforeEach(() => {
  ai._test.resetGeminiCooldowns();
});

test.after(() => {
  restoreEnv();
  global.fetch = previousFetch;
});

test("quotation education stays separate from formal fulfilment intent in EN, BM and Chinese", () => {
  const education = [
    "How do you prepare a quotation?",
    "Macam mana quotation disediakan?",
    "正式报价的流程是怎样的？",
  ];
  for (const text of education) {
    assert.equal(isQuotationEducationQuestion(text), true, text);
    assert.equal(isFormalQuotationRequest(text), false, text);
    assert.equal(staffActionReason(text), null, text);
  }

  const ordinaryEstimate = [
    "Can I get a quote for a 10ft kitchen cabinet?",
    "Can you quote a 10ft kitchen cabinet?",
  ];
  for (const text of ordinaryEstimate) {
    assert.equal(isFormalQuotationRequest(text), false, text);
    assert.equal(staffActionReason(text), null, text);
  }
});

test("formal quotation fulfilment is classified consistently in EN, BM and Chinese", () => {
  const requests = [
    "Please email me a formal quotation.",
    "Boleh hantar quotation rasmi ke WhatsApp saya?",
    "可以发正式报价单给我吗？",
  ];
  for (const text of requests) {
    assert.equal(isQuotationEducationQuestion(text), false, text);
    assert.equal(isFormalQuotationRequest(text), true, text);
    assert.equal(staffActionReason(text), "formal_quote", text);
  }
});

test("formal quotation requests set the same Pipeline intent that triggers staff routing", () => {
  const requests = [
    "Please email me a formal quotation for the kitchen cabinet.",
    "Boleh hantar quotation rasmi untuk kitchen cabinet ke WhatsApp saya?",
    "厨房柜可以发正式报价单给我吗？",
  ];

  for (const [index, text] of requests.entries()) {
    const session = demoState.createSession({ ip: `quotation-sync-${index}` });
    demoState.addCustomerMessage(session, text);
    assert.equal(session.lead.quotationIntent, true, text);
    assert.equal(session.lead.bookingIntent, true, text);
    assert.equal(session.lead.temperature, "hot", text);
    assert.match(session.lead.summary, /proper quotation/i, text);
  }
});

test("quotation education remains AI-first and does not create Pipeline quotation intent", async () => {
  const session = demoState.createSession({ ip: "quotation-education-ai" });
  demoState.addCustomerMessage(session, "How do you prepare a quotation?");
  assert.equal(session.lead.quotationIntent, false);
  assert.equal(session.lead.bookingIntent, false);

  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    return successResponse("We normally narrow down the scope, measurements, material direction and site details before the team prepares the proper quotation.");
  };

  const result = await ai.getReplyResult([
    { role: "user", content: "How do you prepare a quotation?" },
  ], true);

  assert.equal(fetchCalls, 1);
  assert.equal(result.source, "ai");
  assert.doesNotMatch(result.text, /\[\[HANDOFF\]\]/);
});

test("formal quotation fulfilment bypasses Gemini and matches the lead intent classifier", async () => {
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error("Gemini should not be called for formal quotation fulfilment");
  };

  const text = "Please email me a formal quotation for my 12ft kitchen cabinet.";
  const result = await ai.getReplyResult([{ role: "user", content: text }], true);

  assert.equal(fetchCalls, 0);
  assert.equal(result.source, "rule");
  assert.match(result.text, /team.*formal quotation|formal quotation.*team/i);
  assert.match(result.text, /\[\[HANDOFF\]\]/);

  const session = demoState.createSession({ ip: "quotation-routing-sync" });
  demoState.addCustomerMessage(session, text);
  assert.equal(session.lead.quotationIntent, true);
  assert.equal(session.lead.bookingIntent, true);
});

test("a formal quotation request after a soft rejection renews the lead using the shared intent", () => {
  const session = demoState.createSession({ ip: "quotation-renewal" });
  demoState.addCustomerMessage(session, "I want a kitchen cabinet in Puchong.");
  demoState.addCustomerMessage(session, "No thanks, not interested now.");
  assert.equal(session.lead.reducedInterest, true);

  demoState.addCustomerMessage(session, "Actually, please email me a formal quotation.");
  assert.equal(session.lead.reducedInterest, false);
  assert.equal(session.lead.quotationIntent, true);
  assert.equal(session.lead.bookingIntent, true);
});