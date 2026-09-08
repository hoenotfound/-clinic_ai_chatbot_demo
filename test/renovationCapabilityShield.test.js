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
process.env.GEMINI_API_KEY_1 = "capability-shield-test-key";
delete process.env.GEMINI_API_KEY_2;
process.env.GEMINI_MODEL = "gemini-3.6-flash";
process.env.GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";

const ai = require("../src/aiService");
const demoState = require("../src/demoState");
const {
  staffActionReason,
  hasCapabilityDisclosure,
  stripCapabilityDisclosure,
} = require("../src/renovationCapabilityShield");
const { isReferenceImageRequest } = require("../src/renovationRoutingIntent");

function successResponse(text) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  };
}

function assertNoCapabilityExposure(text) {
  assert.doesNotMatch(
    text,
    /无法|無法|不能|\b(?:can't|cannot|unable|demo|system)\b|\bas\s+an\s+ai\b/i
  );
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

test("operational requests are classified as staff actions without treating ordinary questions as actions", () => {
  assert.equal(staffActionReason("Can you send me a formal quotation PDF?"), "formal_quote");
  assert.equal(staffActionReason("Can you prepare a quotation for my kitchen cabinet?"), "formal_quote");
  assert.equal(staffActionReason("可以安排这个星期六上门量尺吗？"), "site_measurement");
  assert.equal(staffActionReason("Can you send me the payment link and invoice?"), "payment_details");
  assert.equal(staffActionReason("Please send me your brochure PDF"), "documents");

  assert.equal(staffActionReason("How much does a 12ft kitchen cabinet cost?"), null);
  assert.equal(staffActionReason("Can I get a quote for a 10ft kitchen cabinet?"), null);
  assert.equal(staffActionReason("Can you quote a 10ft kitchen cabinet?"), null);
  assert.equal(staffActionReason("What is the difference between plywood and aluminium?"), null);
  assert.equal(staffActionReason("I can send you my floor plan"), null);
});

test("ordinary quote questions remain AI-first instead of becoming a staff-form handoff", async () => {
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    return successResponse("For a 10ft kitchen cabinet, the configured starting guide is RM 6,800, with final pricing depending on material and site details.");
  };

  const reply = await ai.getReply([
    { role: "user", content: "Can I get a quote for a 10ft kitchen cabinet?" },
  ], true);

  assert.equal(fetchCalls, 1);
  assert.match(reply, /RM 6,800/);
  assert.doesNotMatch(reply, /\[\[HANDOFF\]\]/);
});

test("formal quotation requests bypass Gemini and become a natural staff follow-up", async () => {
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error("Gemini should not be called for a formal quotation fulfilment request");
  };

  const reply = await ai.getReply([
    { role: "user", content: "厨房柜10ft，在Cheras。可以给我正式报价单吗？" },
  ], true);

  assert.equal(fetchCalls, 0);
  assert.match(reply, /团队.*正式报价/);
  assert.match(reply, /\[\[HANDOFF\]\]/);
  assertNoCapabilityExposure(reply);
});

test("site-measurement scheduling requests go to staff without exposing scheduling limitations", async () => {
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error("Gemini should not be called for site-measurement scheduling");
  };

  const reply = await ai.getReply([
    { role: "user", content: "可以安排这个星期六上门量尺吗？" },
  ], true);

  assert.equal(fetchCalls, 0);
  assert.match(reply, /确认上门量尺的时间/);
  assert.match(reply, /\[\[HANDOFF\]\]/);
  assertNoCapabilityExposure(reply);
});

test("payment and document fulfilment requests go to staff while the dashboard is notified", async () => {
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error("Gemini should not be called for payment-document fulfilment");
  };

  const reply = await ai.getReply([
    { role: "user", content: "Can you send me the payment link and invoice?" },
  ], true);

  assert.equal(fetchCalls, 0);
  assert.match(reply, /team.*payment|payment.*team/i);
  assert.match(reply, /\[\[HANDOFF\]\]/);
  assertNoCapabilityExposure(reply);

  const session = demoState.createSession({ ip: "capability-shield-payment-test" });
  const stored = demoState.addAssistantMessage(session, reply);
  assert.equal(session.needsAttention, true);
  assert.doesNotMatch(stored.content, /\[\[HANDOFF\]\]/);
});

test("unsupported scope handoff no longer exposes demo configuration", async () => {
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error("Gemini should not be called for unsupported standalone scope");
  };

  const reply = await ai.getReply([
    { role: "user", content: "Pantry cabinet" },
  ], true);

  assert.equal(fetchCalls, 0);
  assert.match(reply, /team|团队|confirm/i);
  assert.match(reply, /\[\[HANDOFF\]\]/);
  assert.doesNotMatch(reply, /not configured|configured|demo/i);
});

test("mixed inbound and outbound photo messages still flag the outbound reference-image request", async () => {
  const mixed = "我有现场照片，可以发给你。你也可以发一些你们的参考图给我吗？";
  assert.equal(isReferenceImageRequest("我可以发现场照片给你吗？"), false);
  assert.equal(isReferenceImageRequest("saya ada gambar"), false);
  assert.equal(isReferenceImageRequest(mixed), true);

  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error("Gemini should not be called when outbound reference-image fulfilment is requested");
  };

  const reply = await ai.getReply([{ role: "user", content: mixed }], true);
  assert.equal(fetchCalls, 0);
  assert.match(reply, /团队会发一些参考图给你/);
  assert.match(reply, /\[\[HANDOFF\]\]/);
});

test("accidental AI or tool limitation wording is removed while useful answer content is preserved", async () => {
  assert.equal(hasCapabilityDisclosure("As an AI, I don't have access to that information."), true);
  assert.equal(hasCapabilityDisclosure("我在这里无法直接处理这个请求。"), true);
  assert.equal(hasCapabilityDisclosure("I don't know the exact warranty coverage for that hardware."), true);

  const raw = "For a wet kitchen, plywood and aluminium are worth comparing for moisture exposure. I don't know the exact warranty coverage for that hardware.";
  assert.match(stripCapabilityDisclosure(raw), /plywood and aluminium/i);
  assert.doesNotMatch(stripCapabilityDisclosure(raw), /don't know/i);

  global.fetch = async () => successResponse(raw);
  const reply = await ai.getReply([
    { role: "user", content: "Which material is better, and what is the exact warranty coverage?" },
  ], true);

  assert.match(reply, /plywood and aluminium/i);
  assert.match(reply, /confirm.*team|team.*confirm/i);
  assert.match(reply, /\[\[HANDOFF\]\]/);
  assert.doesNotMatch(reply, /as an ai|don't know|don't have access|unable|cannot/i);
});

test("renovation prompt hides operational demo limitations but stays honest when reality is explicitly questioned", () => {
  const prompt = ai._test.enhancedSystemPrompt(true);
  assert.match(prompt, /DEMO TRANSPARENCY/i);
  assert.match(prompt, /Only disclose that fact when the visitor explicitly asks/i);
  assert.match(prompt, /fictional sample business data/i);
  assert.doesNotMatch(prompt, /demo starting guide/i);
  assert.doesNotMatch(prompt, /The demo itself does not create a real appointment/i);
  assert.doesNotMatch(prompt, /No real payment, quotation, appointment or project slot can be created/i);
});

test("legitimate business-process caveats are not hidden by the capability shield", async () => {
  global.fetch = async () => successResponse(
    "The final price can only be confirmed after the actual site measurement. For now, I can give you the configured starting guide."
  );

  const reply = await ai.getReply([
    { role: "user", content: "How much for a 12ft kitchen cabinet in Puchong?" },
  ], true);

  assert.match(reply, /final price can only be confirmed after the actual site measurement/i);
  assert.doesNotMatch(reply, /\[\[HANDOFF\]\]/);
});
