const test = require("node:test");
const assert = require("node:assert/strict");

const previousEnv = {
  AI_PROVIDER: process.env.AI_PROVIDER,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_API_KEY_1: process.env.GEMINI_API_KEY_1,
  GEMINI_API_KEY_2: process.env.GEMINI_API_KEY_2,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  GEMINI_FALLBACK_MODEL: process.env.GEMINI_FALLBACK_MODEL,
  GEMINI_RETRY_DELAY_MS: process.env.GEMINI_RETRY_DELAY_MS,
};
const previousFetch = global.fetch;

process.env.AI_PROVIDER = "gemini";
delete process.env.GEMINI_API_KEY;
process.env.GEMINI_API_KEY_1 = "test-key-1";
process.env.GEMINI_API_KEY_2 = "test-key-2";
process.env.GEMINI_MODEL = "gemini-2.5-flash";
process.env.GEMINI_FALLBACK_MODEL = "gemini-2.5-flash-lite";
process.env.GEMINI_RETRY_DELAY_MS = "0";
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

function errorResponse(status, apiStatus = "RESOURCE_EXHAUSTED") {
  return {
    ok: false,
    status,
    statusText: status === 429 ? "Too Many Requests" : "Service Unavailable",
    json: async () => ({
      error: {
        code: status,
        status: apiStatus,
        message: "Temporary Gemini failure",
      },
    }),
  };
}

function successResponse(text) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
  };
}

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

test("Gemini prefers the two new keys and keeps the legacy key as compatibility only", () => {
  assert.deepEqual(aiService._test.getGeminiApiKeys(), ["test-key-1", "test-key-2"]);
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
    return successResponse("Recovered reply");
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

test("Gemini retries key 1, then retries key 2, and succeeds without exposing an error", async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    const key = options.headers["x-goog-api-key"];
    calls.push({ key, url });
    if (key === "key-one") return errorResponse(429);
    if (calls.filter((call) => call.key === "key-two").length === 1) return errorResponse(503, "UNAVAILABLE");
    return successResponse("Reply from key 2");
  };

  const reply = await aiService._test.tryPrimaryGeminiKeys(
    [{ role: "user", content: "Hello" }],
    false,
    ["key-one", "key-two"],
    "gemini-2.5-flash"
  );

  assert.equal(reply, "Reply from key 2");
  assert.deepEqual(calls.map((call) => call.key), ["key-one", "key-one", "key-two", "key-two"]);
});

test("Gemini exhausts both primary keys and fallback model before returning the mock reply", async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, key: options.headers["x-goog-api-key"] });
    return errorResponse(429);
  };

  const reply = await aiService.getReply(
    [{ role: "user", content: "How much is HIFU?" }],
    false
  );

  assert.match(reply, /RM 888/);
  assert.equal(calls.length, 6);
  assert.deepEqual(calls.slice(0, 4).map((call) => call.key), ["test-key-1", "test-key-1", "test-key-2", "test-key-2"]);
  assert.ok(calls.slice(0, 4).every((call) => call.url.includes("gemini-2.5-flash:generateContent")));
  assert.ok(calls.slice(4).every((call) => call.url.includes("gemini-2.5-flash-lite:generateContent")));
});
