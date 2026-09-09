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
    "How can you prepare a quotation?",
    "Macam mana quotation disediakan?",
    "Macam mana buat quotation?",
    "Bagaimana buat quotation?",
    "Bagaimana nak sediakan quotation?",
    "正式报价的流程是怎样的？",
    "怎么做报价？",
    "怎么出报价？",
    "如何准备报价？",
    "报价怎么做？",
  ];
  for (const text of education) {
    assert.equal(isQuotationEducationQuestion(text), true, text);
    assert.equal(isFormalQuotationRequest(text), false, text);
    assert.equal(staffActionReason(text), null, text);
  }

  const ordinaryEstimate = [
    "Can I get a quote for a 10ft kitchen cabinet?",
    "Can you quote a 10ft kitchen cabinet?",
    "Could you give me a quote for a 10ft kitchen cabinet?",
    "Boleh bagi saya quotation untuk kitchen cabinet 10ft?",
  ];
  for (const text of ordinaryEstimate) {
    assert.equal(isFormalQuotationRequest(text), false, text);
    assert.equal(staffActionReason(text), null, text);
  }
});

test("formal quotation fulfilment and direct high-intent requests are classified consistently", () => {
  const requests = [
    "Please email me a formal quotation.",
    "Could you give me a quotation?",
    "Can I have a quotation?",
    "I need a quotation for this project.",
    "I need the exact price for this project.",
    "Boleh hantar quotation rasmi ke WhatsApp saya?",
    "Boleh bagi saya quotation?",
    "Saya nak quotation untuk kitchen cabinet.",
    "可以发正式报价单给我吗？",
    "请给我报价。",
  ];
  for (const text of requests) {
    assert.equal(isFormalQuotationRequest(text), true, text);
    assert.equal(staffActionReason(text), "formal_quote", text);
  }
});

test("an education clause cannot suppress a separate explicit quotation request", () => {
  const mixedRequests = [
    "How do you prepare a quotation? Please email me a formal quotation.",
    "What do you need for a quotation? I want a quotation for my kitchen.",
    "How do you prepare a quotation and could you give me a formal quotation?",
    "Macam mana quotation dibuat? Saya nak quotation juga.",
    "Macam mana quotation dibuat, boleh bagi saya quotation juga?",
    "Bagaimana buat quotation, tapi saya nak quotation juga.",
    "报价流程怎样？请给我报价。",
    "报价流程怎样，也请给我报价。",
    "怎么做报价，也请给我报价。",
  ];

  for (const text of mixedRequests) {
    assert.equal(isQuotationEducationQuestion(text), true, `education portion should still be recognized: ${text}`);
    assert.equal(isFormalQuotationRequest(text), true, text);
    assert.equal(staffActionReason(text), "formal_quote", text);
  }
});

test("formal quotation requests set the same Pipeline intent that triggers staff routing", () => {
  const requests = [
    "I need a quotation for the kitchen cabinet.",
    "Could you give me a quotation for the kitchen cabinet?",
    "Saya nak quotation untuk kitchen cabinet.",
    "Boleh bagi saya quotation untuk kitchen cabinet?",
    "厨房柜请给我报价。",
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

test("mixed education plus fulfilment also synchronizes Pipeline intent", () => {
  const text = "How do you prepare a quotation? Please email me a formal quotation for the kitchen cabinet.";
  const session = demoState.createSession({ ip: "quotation-mixed-sync" });
  demoState.addCustomerMessage(session, text);
  assert.equal(session.lead.quotationIntent, true);
  assert.equal(session.lead.bookingIntent, true);
  assert.equal(session.lead.temperature, "hot");
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

test("natural BM and Chinese quotation-process questions remain AI-first", async () => {
  const processQuestions = [
    "Bagaimana buat quotation?",
    "怎么做报价？",
  ];

  for (const text of processQuestions) {
    const session = demoState.createSession({ ip: `quotation-process-ai-${encodeURIComponent(text)}` });
    demoState.addCustomerMessage(session, text);
    assert.equal(session.lead.quotationIntent, false, text);
    assert.equal(session.lead.bookingIntent, false, text);

    let fetchCalls = 0;
    global.fetch = async () => {
      fetchCalls += 1;
      return successResponse("The quotation process starts from the project scope, rough dimensions, site details and material direction before the team confirms the proper quotation.");
    };

    const result = await ai.getReplyResult([{ role: "user", content: text }], true);
    assert.equal(fetchCalls, 1, text);
    assert.equal(result.source, "ai", text);
    assert.doesNotMatch(result.text, /\[\[HANDOFF\]\]/, text);
  }
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

test("mixed education plus fulfilment bypasses Gemini because the explicit request wins", async () => {
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error("Gemini should not be called when the same message also requests quotation fulfilment");
  };

  const text = "How do you prepare a quotation? Please email me a formal quotation for my kitchen cabinet.";
  const result = await ai.getReplyResult([{ role: "user", content: text }], true);

  assert.equal(fetchCalls, 0);
  assert.equal(result.source, "rule");
  assert.match(result.text, /\[\[HANDOFF\]\]/);
});

test("a formal quotation request after a rejection renews the lead using the shared intent", () => {
  const session = demoState.createSession({ ip: "quotation-renewal" });
  demoState.addCustomerMessage(session, "I want a kitchen cabinet in Puchong.");
  session.lastCustomerMessageAt = 0;
  demoState.addCustomerMessage(session, "No thanks, not interested now.");
  assert.equal(session.lead.reducedInterest, true);

  session.lastCustomerMessageAt = 0;
  demoState.addCustomerMessage(session, "Actually, please email me a formal quotation.");
  assert.equal(session.lead.reducedInterest, false);
  assert.equal(session.lead.quotationIntent, true);
  assert.equal(session.lead.bookingIntent, true);
});
