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
process.env.GEMINI_API_KEY_1 = "renovation-measurement-provider-test-key";
delete process.env.GEMINI_API_KEY_2;
process.env.GEMINI_MODEL = "gemini-3.6-flash";
process.env.GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";

const ai = require("../src/aiService");

function successResponse(text) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  };
}

function unavailableResponse() {
  return {
    ok: false,
    status: 503,
    statusText: "Service Unavailable",
    json: async () => ({ error: { code: 503, status: "UNAVAILABLE", message: "Model temporarily unavailable" } }),
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

test("measurement education reaches Gemini instead of deterministic handoff", async () => {
  let requestBody = null;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return successResponse(
      "Site measurement is where the team checks the actual cabinet dimensions and site conditions before confirming the final layout and quotation. You don't need to book it just to understand the process."
    );
  };

  const result = await ai.getReplyResult([
    { role: "user", content: "How does site measurement work?" },
  ], true);

  assert.equal(result.source, "ai");
  assert.equal(result.degraded, false);
  assert.ok(requestBody, "expected Gemini to receive the informational question");
  const sentText = requestBody.contents.map((item) => item.parts?.[0]?.text || "").join("\n");
  assert.match(sentText, /How does site measurement work\?/i);
  assert.match(result.text, /checks the actual cabinet dimensions/i);
  assert.doesNotMatch(result.text, /\[\[HANDOFF\]\]/);
});

test("measurement education does not become a staff handoff when Gemini is unavailable", async () => {
  global.fetch = async () => unavailableResponse();

  const result = await ai.getReplyResult([
    { role: "user", content: "How does site measurement work?" },
  ], true);

  assert.equal(result.source, "deterministic");
  assert.equal(result.degraded, true);
  assert.doesNotMatch(result.text, /\[\[HANDOFF\]\]/);
});
