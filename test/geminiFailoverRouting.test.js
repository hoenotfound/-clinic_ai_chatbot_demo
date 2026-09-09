const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { createGeminiFailover } = require("../src/geminiFailover");

function makeOpsStats() {
  return {
    recordCounter() {},
    recordGeminiAttempt() {},
    recordGeminiFailure() {},
    recordGeminiSuccess() {},
    recordLatency() {},
    recordDeterministicFallback() {},
  };
}

function makeFailover(fetchJson) {
  return createGeminiFailover({
    buildPrompt: () => "test prompt",
    opsStats: makeOpsStats(),
    fetchJson,
  });
}

function restoreEnv(previous) {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test("Gemini key pool loads numbered keys through key 5 and deduplicates optional list entries", () => {
  const names = [
    "GEMINI_API_KEYS",
    "GEMINI_API_KEY",
    "GEMINI_API_KEY_1",
    "GEMINI_API_KEY_2",
    "GEMINI_API_KEY_3",
    "GEMINI_API_KEY_4",
    "GEMINI_API_KEY_5",
  ];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));

  try {
    delete process.env.GEMINI_API_KEYS;
    delete process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY_1 = "key-one";
    process.env.GEMINI_API_KEY_2 = "key-two";
    process.env.GEMINI_API_KEY_3 = "key-three";
    process.env.GEMINI_API_KEY_4 = "key-four";
    process.env.GEMINI_API_KEY_5 = "key-five";

    const gemini = makeFailover(async () => ({}));
    assert.deepEqual(gemini.getApiKeys(), [
      "key-one",
      "key-two",
      "key-three",
      "key-four",
      "key-five",
    ]);

    process.env.GEMINI_API_KEYS = "list-one, key-three\nlist-two;key-five";
    assert.deepEqual(gemini.getApiKeys(), [
      "list-one",
      "key-three",
      "list-two",
      "key-five",
      "key-one",
      "key-two",
      "key-four",
    ]);
  } finally {
    restoreEnv(previous);
  }
});

test("model-level 404 stops key rotation immediately", async () => {
  const calls = [];
  const gemini = makeFailover(async (_url, options) => {
    calls.push(options.headers["x-goog-api-key"]);
    const error = new Error(
      "Gemini request failed (404 NOT_FOUND): This model models/gemini-old is no longer available to new users."
    );
    error.statusCode = 404;
    error.apiStatus = "NOT_FOUND";
    throw error;
  });

  await assert.rejects(
    gemini.tryPrimary([{ role: "user", content: "hello" }], false, ["key-one", "key-two"], "gemini-old"),
    /no longer available/i
  );

  assert.deepEqual(calls, ["key-one"]);
  assert.equal(gemini.modelCooldown("gemini-old")?.reason, "model_not_found");
});

test("production timeout switches away from the model without retrying another key or cooling the model globally", async () => {
  const calls = [];
  const gemini = makeFailover(async (_url, options) => {
    calls.push(options.headers["x-goog-api-key"]);
    const error = new Error("Gemini key 1 timed out.");
    error.code = "AI_REQUEST_TIMEOUT";
    error.statusCode = 408;
    throw error;
  });

  await assert.rejects(
    gemini.tryPrimary(
      [{ role: "user", content: "hello" }],
      false,
      ["key-one", "key-two"],
      "gemini-3.6-flash",
      null,
      { switchModelOnTimeout: true }
    ),
    /timed out/i
  );

  assert.deepEqual(calls, ["key-one"]);
  assert.equal(gemini.modelCooldown("gemini-3.6-flash"), null);
  assert.equal(gemini.keyCooldown("key-one", "gemini-3.6-flash"), null);
});

test("getReply routes one 3.6 timeout directly to 3.5 Flash-Lite and retries 3.6 on the next request", async () => {
  const previous = {
    GEMINI_API_KEYS: process.env.GEMINI_API_KEYS,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_API_KEY_1: process.env.GEMINI_API_KEY_1,
    GEMINI_API_KEY_2: process.env.GEMINI_API_KEY_2,
    GEMINI_API_KEY_3: process.env.GEMINI_API_KEY_3,
    GEMINI_API_KEY_4: process.env.GEMINI_API_KEY_4,
    GEMINI_API_KEY_5: process.env.GEMINI_API_KEY_5,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GEMINI_FALLBACK_MODEL: process.env.GEMINI_FALLBACK_MODEL,
  };

  delete process.env.GEMINI_API_KEYS;
  process.env.GEMINI_API_KEY_1 = "key-one";
  process.env.GEMINI_API_KEY_2 = "key-two";
  delete process.env.GEMINI_API_KEY_3;
  delete process.env.GEMINI_API_KEY_4;
  delete process.env.GEMINI_API_KEY_5;
  delete process.env.GEMINI_API_KEY;
  process.env.GEMINI_MODEL = "gemini-3.6-flash";
  process.env.GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";

  const calls = [];
  let primaryAttempts = 0;
  const gemini = makeFailover(async (url, options) => {
    const key = options.headers["x-goog-api-key"];
    const model = url.includes("gemini-3.5-flash-lite") ? "gemini-3.5-flash-lite" : "gemini-3.6-flash";
    calls.push({ model, key });

    if (model === "gemini-3.6-flash") {
      primaryAttempts += 1;
      if (primaryAttempts === 1) {
        const error = new Error("Gemini key 1 timed out.");
        error.code = "AI_REQUEST_TIMEOUT";
        error.statusCode = 408;
        throw error;
      }
      return { candidates: [{ content: { parts: [{ text: "reply from 3.6" }] } }] };
    }

    return { candidates: [{ content: { parts: [{ text: "reply from 3.5 lite" }] } }] };
  });

  try {
    const firstReply = await gemini.getReply(
      [{ role: "user", content: "hello" }],
      false,
      () => "deterministic fallback"
    );
    assert.equal(firstReply, "reply from 3.5 lite");
    assert.equal(gemini.modelCooldown("gemini-3.6-flash"), null);

    const secondReply = await gemini.getReply(
      [{ role: "user", content: "hello again" }],
      false,
      () => "deterministic fallback"
    );
    assert.equal(secondReply, "reply from 3.6");
    assert.deepEqual(calls, [
      { model: "gemini-3.6-flash", key: "key-one" },
      { model: "gemini-3.5-flash-lite", key: "key-one" },
      { model: "gemini-3.6-flash", key: "key-one" },
    ]);
  } finally {
    restoreEnv(previous);
  }
});

test("quota failures still rotate API keys", async () => {
  const calls = [];
  const gemini = makeFailover(async (_url, options) => {
    const key = options.headers["x-goog-api-key"];
    calls.push(key);
    if (key === "key-one") {
      const error = new Error("Gemini quota exhausted.");
      error.statusCode = 429;
      error.apiStatus = "RESOURCE_EXHAUSTED";
      throw error;
    }
    return { candidates: [{ content: { parts: [{ text: "healthy reply" }] } }] };
  });

  const reply = await gemini.tryPrimary(
    [{ role: "user", content: "hello" }],
    false,
    ["key-one", "key-two"],
    "gemini-3.6-flash"
  );

  assert.equal(reply, "healthy reply");
  assert.deepEqual(calls, ["key-one", "key-two"]);
  assert.equal(gemini.keyCooldown("key-one", "gemini-3.6-flash")?.reason, "quota");
});

test("Gemini deployment defaults stay aligned without changing the generic provider timeout", () => {
  const envExample = fs.readFileSync(path.join(__dirname, "..", ".env.example"), "utf8");
  const renderYaml = fs.readFileSync(path.join(__dirname, "..", "render.yaml"), "utf8");

  for (const source of [envExample, renderYaml]) {
    assert.match(source, /gemini-3\.6-flash/);
    assert.match(source, /gemini-3\.5-flash-lite/);
    assert.doesNotMatch(source, /gemini-2\.5-flash-lite/);
    assert.match(source, /GEMINI_API_KEYS/);
    assert.match(source, /GEMINI_API_KEY_1/);
    assert.match(source, /GEMINI_API_KEY_2/);
    assert.match(source, /GEMINI_API_KEY_3/);
    assert.match(source, /GEMINI_API_KEY_4/);
    assert.match(source, /GEMINI_API_KEY_5/);
  }

  assert.match(envExample, /GEMINI_ATTEMPT_TIMEOUT_MS=6000/);
  assert.match(envExample, /GEMINI_FALLBACK_ATTEMPT_TIMEOUT_MS=4500/);
  assert.match(envExample, /GEMINI_FAILOVER_BUDGET_MS=16000/);
  assert.match(envExample, /AI_REQUEST_TIMEOUT_MS=4500/);
  assert.match(renderYaml, /key: GEMINI_ATTEMPT_TIMEOUT_MS\s+value: 6000/);
  assert.match(renderYaml, /key: GEMINI_FALLBACK_ATTEMPT_TIMEOUT_MS\s+value: 4500/);
  assert.match(renderYaml, /key: GEMINI_FAILOVER_BUDGET_MS\s+value: 16000/);
  assert.match(renderYaml, /key: AI_REQUEST_TIMEOUT_MS\s+value: 4500/);
});
