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

test("production timeout switches away from the model without retrying another key", async () => {
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
  assert.equal(gemini.modelCooldown("gemini-3.6-flash")?.reason, "timeout");
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

test("Gemini deployment defaults stay aligned", () => {
  const envExample = fs.readFileSync(path.join(__dirname, "..", ".env.example"), "utf8");
  const renderYaml = fs.readFileSync(path.join(__dirname, "..", "render.yaml"), "utf8");

  for (const source of [envExample, renderYaml]) {
    assert.match(source, /gemini-3\.6-flash/);
    assert.match(source, /gemini-3\.5-flash-lite/);
    assert.doesNotMatch(source, /gemini-2\.5-flash-lite/);
  }

  assert.match(envExample, /GEMINI_ATTEMPT_TIMEOUT_MS=6000/);
  assert.match(envExample, /GEMINI_FALLBACK_ATTEMPT_TIMEOUT_MS=4500/);
  assert.match(envExample, /GEMINI_FAILOVER_BUDGET_MS=16000/);
  assert.match(renderYaml, /key: GEMINI_ATTEMPT_TIMEOUT_MS\s+value: 6000/);
  assert.match(renderYaml, /key: GEMINI_FALLBACK_ATTEMPT_TIMEOUT_MS\s+value: 4500/);
  assert.match(renderYaml, /key: GEMINI_FAILOVER_BUDGET_MS\s+value: 16000/);
});
