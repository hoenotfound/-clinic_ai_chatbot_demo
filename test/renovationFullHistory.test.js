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
process.env.GEMINI_API_KEY_1 = "renovation-full-history-test-key";
delete process.env.GEMINI_API_KEY_2;
process.env.GEMINI_MODEL = "gemini-3.6-flash";
process.env.GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";

const ai = require("../src/aiService");
const protection = require("../src/abuseProtection");
const { OPENING_MESSAGE } = require("../src/renovationIntakeFlow");

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
    json: async () => ({
      error: {
        code: 503,
        status: "UNAVAILABLE",
        message: "Model temporarily unavailable",
      },
    }),
  };
}

function restoreEnv() {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function longQualifiedHistory() {
  const messages = [
    {
      role: "user",
      content: "Kitchen cabinet 10ft in Puchong. The wall is usable. Budget RM10000.",
    },
  ];
  for (let index = 0; index < 10; index += 1) {
    messages.push({ role: "assistant", content: `Noted ${index}.` });
    messages.push({ role: "user", content: `okay ${index}` });
  }
  return messages;
}

test.beforeEach(() => {
  ai._test.resetGeminiCooldowns();
});

test.after(() => {
  restoreEnv();
  global.fetch = previousFetch;
});

test("live history cap keeps provider turns recent while renovation qualification uses the full session", async () => {
  const messages = longQualifiedHistory();
  let requestBody = null;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return successResponse("Your core project details are already clear. I can build on those rather than asking you to repeat them.");
  };

  const result = await protection.runWithPreparedAiHistory(
    ai.getReplyResult.bind(ai),
    messages,
    false
  );

  assert.equal(result.source, "ai");
  assert.ok(requestBody, "expected Gemini request");

  const internalState = requestBody.contents[0]?.parts?.[0]?.text || "";
  assert.match(internalState, /Current cabinet scope: Kitchen Cabinets/i);
  assert.match(internalState, /Rough size: known in the conversation/i);
  assert.match(internalState, /Project location: known in the conversation/i);
  assert.doesNotMatch(
    internalState,
    /Wall usability: not yet confirmed by the conservative tracker/i,
    "the early wall answer must survive outside the capped provider history"
  );
  assert.match(internalState, /Budget: known in the conversation/i);
  assert.doesNotMatch(internalState, /Conservative next goals: cabinet type \/ scope/i);
  assert.doesNotMatch(internalState, /Conservative next goals: rough size/i);
  assert.doesNotMatch(internalState, /Conservative next goals: project location/i);

  const recentProviderHistory = requestBody.contents
    .slice(2)
    .map((item) => item.parts?.[0]?.text || "")
    .join("\n");
  assert.ok(requestBody.contents.slice(2).length <= protection.limits.aiHistoryMaxMessages);
  assert.doesNotMatch(recentProviderHistory, /RM10000/);
  assert.doesNotMatch(recentProviderHistory, /Kitchen cabinet 10ft in Puchong/);
});

test("provider failure after the history cap still falls back from full renovation qualification state", async () => {
  const messages = longQualifiedHistory();
  global.fetch = async () => unavailableResponse();

  const result = await protection.runWithPreparedAiHistory(
    ai.getReplyResult.bind(ai),
    messages,
    false
  );

  assert.equal(result.source, "deterministic");
  assert.equal(result.degraded, true);
  assert.notEqual(result.text, OPENING_MESSAGE);
  assert.doesNotMatch(result.text, /what are you planning to build/i);
  assert.doesNotMatch(result.text, /what cabinet.*planning/i);
});
