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
  GEMINI_FAILOVER_BUDGET_MS: process.env.GEMINI_FAILOVER_BUDGET_MS,
  GEMINI_ATTEMPT_TIMEOUT_MS: process.env.GEMINI_ATTEMPT_TIMEOUT_MS,
  GEMINI_FALLBACK_ATTEMPT_TIMEOUT_MS: process.env.GEMINI_FALLBACK_ATTEMPT_TIMEOUT_MS,
  GEMINI_KEY_COOLDOWN_MS: process.env.GEMINI_KEY_COOLDOWN_MS,
  GEMINI_QUOTA_COOLDOWN_MS: process.env.GEMINI_QUOTA_COOLDOWN_MS,
  GEMINI_MODEL_COOLDOWN_MS: process.env.GEMINI_MODEL_COOLDOWN_MS,
  AI_REQUEST_TIMEOUT_MS: process.env.AI_REQUEST_TIMEOUT_MS,
};
const previousFetch = global.fetch;

process.env.AI_PROVIDER = "gemini";
delete process.env.GEMINI_API_KEY;
process.env.GEMINI_API_KEY_1 = "test-key-1";
process.env.GEMINI_API_KEY_2 = "test-key-2";
process.env.GEMINI_MODEL = "gemini-2.5-flash";
process.env.GEMINI_FALLBACK_MODEL = "gemini-2.5-flash-lite";
process.env.GEMINI_RETRY_DELAY_MS = "0";
process.env.GEMINI_ATTEMPT_TIMEOUT_MS = "25";
process.env.GEMINI_FALLBACK_ATTEMPT_TIMEOUT_MS = "20";
process.env.GEMINI_FAILOVER_BUDGET_MS = "90";
process.env.GEMINI_KEY_COOLDOWN_MS = "100";
process.env.GEMINI_QUOTA_COOLDOWN_MS = "200";
process.env.GEMINI_MODEL_COOLDOWN_MS = "100";
process.env.AI_REQUEST_TIMEOUT_MS = "25";
delete require.cache[require.resolve("../src/aiService")];
const aiService = require("../src/aiService");

test.beforeEach(() => {
  aiService._test.resetGeminiCooldowns();
});

test.after(() => {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  global.fetch = previousFetch;
  delete require.cache[require.resolve("../src/aiService")];
});

function errorResponse(status, apiStatus = "RESOURCE_EXHAUSTED", message = "Temporary Gemini failure") {
  return {
    ok: false,
    status,
    statusText: status === 429 ? "Too Many Requests" : "Service Unavailable",
    json: async () => ({
      error: {
        code: status,
        status: apiStatus,
        message,
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

test("fallback answers configured clinic prices directly without demo chatter", () => {
  const reply = aiService.getFallbackReply([{ role: "user", content: "How much is HIFU?" }]);
  assert.match(reply, /RM 888/);
  assert.match(reply, /HIFU/i);
  assert.doesNotMatch(reply, /demo|fictional|sample/i);
});

test("fallback mirrors Chinese for a Pico price enquiry", () => {
  const reply = aiService.getFallbackReply([{ role: "user", content: "皮秒多少钱？" }]);
  assert.match(reply, /Pico Laser/);
  assert.match(reply, /RM 388/);
  assert.match(reply, /起/);
});

test("fallback treats concern-only messages as context instead of resetting", () => {
  const reply = aiService.getFallbackReply([{ role: "user", content: "double chin" }]);
  assert.match(reply, /HIFU/i);
  assert.match(reply, /jawline|lifting|tightening/i);
  assert.doesNotMatch(reply, /what would you like to improve/i);
});

test("fallback finishes a booking handoff when branch and timing are already supplied", () => {
  const reply = aiService.getFallbackReply([{ role: "user", content: "nak buat hifu weekend, PJ" }]);
  assert.match(reply, /Petaling Jaya/i);
  assert.match(reply, /weekend/i);
  assert.match(reply, /\[\[HANDOFF\]\]/);
  assert.doesNotMatch(reply, /which branch|branch mana/i);
});

test("fallback remembers the branch and asks only for the missing booking preference", () => {
  const reply = aiService.getFallbackReply([
    { role: "user", content: "I want to book HIFU" },
    { role: "assistant", content: "Which branch is more convenient for you?" },
    { role: "user", content: "PJ" },
  ]);
  assert.match(reply, /Petaling Jaya/i);
  assert.match(reply, /weekday|weekend/i);
  assert.doesNotMatch(reply, /which branch/i);
  assert.doesNotMatch(reply, /\[\[HANDOFF\]\]/);
});

test("fallback hands personalized medical suitability to staff", () => {
  const reply = aiService.getFallbackReply([{ role: "user", content: "I'm pregnant, can I do HIFU?" }]);
  assert.match(reply, /clinic team/i);
  assert.match(reply, /\[\[HANDOFF\]\]/);
});

test("fallback answers general side-effect questions without automatic handoff", () => {
  const reply = aiService.getFallbackReply([{ role: "user", content: "Does HIFU have side effects?" }]);
  assert.match(reply, /vary|clinician/i);
  assert.doesNotMatch(reply, /\[\[HANDOFF\]\]/);
});

test("fallback escalates urgent post-treatment symptoms", () => {
  const reply = aiService.getFallbackReply([{ role: "user", content: "I did HIFU yesterday and now I have severe pain" }]);
  assert.match(reply, /urgent medical attention|medical care/i);
  assert.match(reply, /\[\[HANDOFF\]\]/);
});

test("Gemini thinking config matches the model family", () => {
  assert.deepEqual(aiService._test.geminiThinkingConfig("gemini-2.5-flash"), { thinkingConfig: { thinkingBudget: 0 } });
  assert.deepEqual(aiService._test.geminiThinkingConfig("gemini-2.5-flash-lite"), { thinkingConfig: { thinkingBudget: 0 } });
  assert.deepEqual(aiService._test.geminiThinkingConfig("gemini-3.5-flash"), { thinkingConfig: { thinkingLevel: "minimal" } });
  assert.deepEqual(aiService._test.geminiThinkingConfig("gemini-3.1-pro-preview"), { thinkingConfig: { thinkingLevel: "low" } });
  assert.deepEqual(aiService._test.geminiThinkingConfig("gemini-2.0-flash"), {});
});

test("Gemini prefers the two configured rotation keys and keeps legacy compatibility separate", () => {
  assert.deepEqual(aiService._test.getGeminiApiKeys(), ["test-key-1", "test-key-2"]);
});

test("Gemini retries INVALID_ARGUMENT once without thinkingConfig", async () => {
  const calls = [];
  global.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    if (calls.length === 1) {
      return errorResponse(400, "INVALID_ARGUMENT", "Request contains an invalid argument.");
    }
    return successResponse("Recovered reply");
  };

  const reply = await aiService.getReply([{ role: "user", content: "Hi, how much is HIFU?" }], true);

  assert.equal(reply, "Recovered reply");
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].generationConfig.thinkingConfig, { thinkingBudget: 0 });
  assert.equal(calls[0].generationConfig.maxOutputTokens, 550);
  assert.equal("thinkingConfig" in calls[1].generationConfig, false);
  assert.equal(calls[1].generationConfig.maxOutputTokens, 900);
});

test("Gemini rotates immediately from a quota-limited key instead of retrying the same key", async () => {
  const calls = [];
  global.fetch = async (_url, options) => {
    const key = options.headers["x-goog-api-key"];
    calls.push(key);
    if (key === "key-one") return errorResponse(429);
    return successResponse("Reply from key 2");
  };

  const reply = await aiService._test.tryPrimaryGeminiKeys(
    [{ role: "user", content: "Hello" }],
    false,
    ["key-one", "key-two"],
    "gemini-2.5-flash"
  );

  assert.equal(reply, "Reply from key 2");
  assert.deepEqual(calls, ["key-one", "key-two"]);
  assert.equal(aiService._test.keyCooldown("key-one")?.reason, "quota");
});

test("Gemini cooldown skips a known exhausted key on the next customer message", async () => {
  const calls = [];
  global.fetch = async (_url, options) => {
    const key = options.headers["x-goog-api-key"];
    calls.push(key);
    if (key === "key-one") return errorResponse(429);
    return successResponse("healthy key reply");
  };

  await aiService._test.tryPrimaryGeminiKeys(
    [{ role: "user", content: "first" }],
    false,
    ["key-one", "key-two"],
    "gemini-2.5-flash"
  );
  await aiService._test.tryPrimaryGeminiKeys(
    [{ role: "user", content: "second" }],
    false,
    ["key-one", "key-two"],
    "gemini-2.5-flash"
  );

  assert.deepEqual(calls, ["key-one", "key-two", "key-two"]);
});

test("Gemini model-unavailable error switches to Flash-Lite without wasting the second primary key", async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, key: options.headers["x-goog-api-key"] });
    if (url.includes("gemini-2.5-flash:generateContent")) {
      return errorResponse(503, "UNAVAILABLE", "Model temporarily unavailable");
    }
    return successResponse("Reply from Flash-Lite");
  };

  const reply = await aiService.getReply([{ role: "user", content: "How much is HIFU?" }], false);

  assert.equal(reply, "Reply from Flash-Lite");
  assert.equal(calls.filter((call) => call.url.includes("gemini-2.5-flash:generateContent")).length, 1);
  assert.equal(calls.filter((call) => call.url.includes("gemini-2.5-flash-lite:generateContent")).length, 1);
});

test("Gemini quota exhaustion uses one attempt per key then falls back without wasting calls on Flash-Lite", async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, key: options.headers["x-goog-api-key"] });
    return errorResponse(429);
  };

  const reply = await aiService.getReply([{ role: "user", content: "How much is HIFU?" }], false);

  assert.match(reply, /RM 888/);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call.key), ["test-key-1", "test-key-2"]);
  assert.ok(calls.every((call) => call.url.includes("gemini-2.5-flash:generateContent")));
});

test("Gemini rotates after hung requests while respecting the shared failover budget", async () => {
  let calls = 0;
  global.fetch = async (_url, options) => {
    calls += 1;
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const error = new Error("aborted by test timeout");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    });
  };

  const startedAt = Date.now();
  const reply = await aiService.getReply([{ role: "user", content: "How much is HIFU?" }], false);
  const elapsedMs = Date.now() - startedAt;

  assert.match(reply, /RM 888/);
  assert.ok(calls >= 2, `expected the failover chain to reach another attempt, got ${calls}`);
  assert.ok(calls <= 4, `expected the shared budget to cap attempts, got ${calls}`);
  assert.ok(elapsedMs < 300, `expected the 90ms test budget to fall back quickly, got ${elapsedMs}ms`);
});