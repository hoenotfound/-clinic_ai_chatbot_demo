const test = require("node:test");
const assert = require("node:assert/strict");

const { createGeminiFailover } = require("../src/geminiFailover");

function noopOpsStats() {
  return {
    recordCounter() {},
    recordGeminiAttempt() {},
    recordGeminiSuccess() {},
    recordGeminiFailure() {},
    recordLatency() {},
    recordDeterministicFallback() {},
  };
}

test("Gemini quota failover can rotate through all five keys and succeed on key 5", async () => {
  const calls = [];
  const keys = ["key-one", "key-two", "key-three", "key-four", "key-five"];
  const gemini = createGeminiFailover({
    buildPrompt: () => "Test prompt",
    opsStats: noopOpsStats(),
    fetchJson: async (_url, options) => {
      const key = options.headers["x-goog-api-key"];
      calls.push(key);
      if (key !== "key-five") {
        const error = new Error(`Quota exhausted for ${key}`);
        error.statusCode = 429;
        error.apiStatus = "RESOURCE_EXHAUSTED";
        throw error;
      }
      return {
        candidates: [{ content: { parts: [{ text: "Reply from key five" }] } }],
        usageMetadata: { totalTokenCount: 12 },
      };
    },
  });

  const reply = await gemini.tryPrimary(
    [{ role: "user", content: "Hello" }],
    false,
    keys,
    "gemini-3.6-flash"
  );

  assert.equal(reply, "Reply from key five");
  assert.deepEqual(calls, keys);
});

test("ops snapshot exposes all five Gemini keys and keeps key 5 activity visible", async () => {
  const previousRedis = process.env.REDIS_URL;
  process.env.REDIS_URL = "";

  delete require.cache[require.resolve("../src/sharedState")];
  delete require.cache[require.resolve("../src/opsStats")];
  const opsStats = require("../src/opsStats");

  try {
    opsStats.recordGeminiAttempt({ keyIndex: 5, model: "gemini-3.6-flash", phase: "primary" });
    opsStats.recordGeminiSuccess({
      keyIndex: 5,
      model: "gemini-3.6-flash",
      phase: "primary",
      usageMetadata: { totalTokenCount: 42 },
    });

    const snapshot = await opsStats.getSnapshot();
    assert.equal(snapshot.gemini.keys.length, 5);
    assert.deepEqual(snapshot.gemini.keys.map((key) => key.index), [1, 2, 3, 4, 5]);
    assert.equal(snapshot.gemini.keys[4].health, "healthy");
    assert.equal(snapshot.gemini.keys[4].attempts, 1);
    assert.equal(snapshot.gemini.keys[4].successes, 1);
    assert.equal(snapshot.gemini.keys[4].totalTokens, 42);
  } finally {
    if (previousRedis === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previousRedis;
  }
});
