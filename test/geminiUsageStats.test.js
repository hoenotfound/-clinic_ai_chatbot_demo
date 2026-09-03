const test = require("node:test");
const assert = require("node:assert/strict");

const previousFetch = global.fetch;
const previousRedis = process.env.REDIS_URL;
process.env.REDIS_URL = "";

delete require.cache[require.resolve("../src/sharedState")];
delete require.cache[require.resolve("../src/opsStats")];
delete require.cache[require.resolve("../src/aiService")];
const opsStats = require("../src/opsStats");
const aiService = require("../src/aiService");

test.after(() => {
  global.fetch = previousFetch;
  if (previousRedis === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = previousRedis;
});

test("Gemini usageMetadata is accumulated into live token stats", async () => {
  global.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      candidates: [{ content: { parts: [{ text: "Tracked reply" }] } }],
      usageMetadata: {
        promptTokenCount: 120,
        candidatesTokenCount: 30,
        thoughtsTokenCount: 4,
        cachedContentTokenCount: 10,
        totalTokenCount: 154,
      },
    }),
  });

  const reply = await aiService._test.requestGemini(
    [{ role: "user", content: "Hello" }],
    false,
    "test-key",
    "gemini-2.5-flash",
    "Gemini key 1",
    null,
    { keyIndex: 1, phase: "primary" }
  );

  assert.equal(reply, "Tracked reply");
  const snapshot = await opsStats.getSnapshot();
  assert.equal(snapshot.gemini.attempts, 1);
  assert.equal(snapshot.gemini.successes, 1);
  assert.equal(snapshot.gemini.tokens.prompt, 120);
  assert.equal(snapshot.gemini.tokens.output, 30);
  assert.equal(snapshot.gemini.tokens.thoughts, 4);
  assert.equal(snapshot.gemini.tokens.cached, 10);
  assert.equal(snapshot.gemini.tokens.total, 154);
  assert.equal(snapshot.gemini.keys[0].health, "healthy");
});

test("Gemini 429 RESOURCE_EXHAUSTED is reported as a quota hit", async () => {
  global.fetch = async () => ({
    ok: false,
    status: 429,
    statusText: "Too Many Requests",
    json: async () => ({
      error: {
        code: 429,
        status: "RESOURCE_EXHAUSTED",
        message: "Quota exceeded for this project",
      },
    }),
  });

  await assert.rejects(
    aiService._test.requestGemini(
      [{ role: "user", content: "Hello again" }],
      false,
      "test-key",
      "gemini-2.5-flash",
      "Gemini key 1",
      null,
      { keyIndex: 1, phase: "primary" }
    )
  );

  const snapshot = await opsStats.getSnapshot();
  assert.equal(snapshot.gemini.quotaHits, 1);
  assert.equal(snapshot.gemini.quotaStatus, "rate_limited");
  assert.equal(snapshot.gemini.keys[0].health, "rate_limited");
  assert.match(snapshot.gemini.lastQuotaMessage || "", /quota exceeded/i);
});
