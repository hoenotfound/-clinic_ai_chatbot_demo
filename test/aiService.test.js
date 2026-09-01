const test = require("node:test");
const assert = require("node:assert/strict");

const previousEnv = {
  AI_PROVIDER: process.env.AI_PROVIDER,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
};
const previousFetch = global.fetch;

process.env.AI_PROVIDER = "gemini";
process.env.GEMINI_API_KEY = "test-key";
process.env.GEMINI_MODEL = "gemini-2.5-flash";
delete require.cache[require.resolve("../src/aiService")];
const aiService = require("../src/aiService");

test.after(() => {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  global.fetch = previousFetch;
  delete require.cache[require.resolve("../src/aiService")];
});

test("Gemini thinking config matches the model family", () => {
  assert.deepEqual(
    aiService._test.geminiThinkingConfig("gemini-2.5-flash"),
    { thinkingConfig: { thinkingBudget: 0 } }
  );
  assert.deepEqual(
    aiService._test.geminiThinkingConfig("gemini-2.5-flash-lite"),
    { thinkingConfig: { thinkingBudget: 0 } }
  );
  assert.deepEqual(
    aiService._test.geminiThinkingConfig("gemini-3.5-flash"),
    { thinkingConfig: { thinkingLevel: "minimal" } }
  );
  assert.deepEqual(
    aiService._test.geminiThinkingConfig("gemini-3.1-pro-preview"),
    { thinkingConfig: { thinkingLevel: "low" } }
  );
  assert.deepEqual(aiService._test.geminiThinkingConfig("gemini-2.0-flash"), {});
});

test("Gemini retries INVALID_ARGUMENT once without thinkingConfig", async () => {
  const calls = [];
  global.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    if (calls.length === 1) {
      return {
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          error: {
            code: 400,
            status: "INVALID_ARGUMENT",
            message: "Request contains an invalid argument.",
          },
        }),
      };
    }
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "Recovered reply" }] } }],
      }),
    };
  };

  const reply = await aiService.getReply(
    [{ role: "user", content: "Hi, how much is HIFU?" }],
    true
  );

  assert.equal(reply, "Recovered reply");
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].generationConfig.thinkingConfig, { thinkingBudget: 0 });
  assert.equal(calls[0].generationConfig.maxOutputTokens, 650);
  assert.equal("thinkingConfig" in calls[1].generationConfig, false);
  assert.equal(calls[1].generationConfig.maxOutputTokens, 2048);
});
