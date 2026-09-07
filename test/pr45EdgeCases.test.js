const test = require("node:test");
const assert = require("node:assert/strict");

const {
  detectService,
  detectServices,
} = require("../src/renovationServiceDetection");
const { updateRenovationLead } = require("../src/renovationLeadState");
const { buildFallbackReply } = require("../src/renovationFallback");
const { createGeminiFailover } = require("../src/geminiFailover");

test("room shorthand plus useful project details still resolves to kitchen cabinets", () => {
  assert.deepEqual(detectServices("kitchen condo Puchong"), ["Kitchen Cabinets"]);
  assert.deepEqual(detectServices("厨房 Puchong 12ft"), ["Kitchen Cabinets"]);
  assert.deepEqual(detectServices("dapur condo PJ"), ["Kitchen Cabinets"]);
  assert.deepEqual(detectServices("kitchen tiles in Puchong"), []);
});

test("explicit service corrections prefer the corrected scope", () => {
  assert.equal(detectService("actually wardrobe, not kitchen cabinet")?.name, "Built-in Wardrobes");
  assert.equal(detectService("not kitchen cabinet, actually wardrobe")?.name, "Built-in Wardrobes");
  assert.equal(detectService("不是厨房柜，是衣柜")?.name, "Built-in Wardrobes");

  const session = {
    messages: [
      { role: "user", content: "I want kitchen cabinet" },
      { role: "assistant", content: "Sure." },
      { role: "user", content: "actually wardrobe, not kitchen cabinet" },
    ],
    lead: { interests: [] },
  };

  updateRenovationLead(session);
  assert.deepEqual(session.lead.interests, ["Built-in Wardrobes"]);

  session.messages.push({ role: "user", content: "also shoe cabinet" });
  updateRenovationLead(session);
  assert.deepEqual(session.lead.interests.sort(), ["Built-in Wardrobes", "Shoe Cabinet & Entrance Storage"].sort());
  assert.equal(session.lead.interests.includes("Kitchen Cabinets"), false);
});

test("cabinet paint-finish questions stay in carpentry while real painting scope still hands off", () => {
  const finishReply = buildFallbackReply([
    { role: "user", content: "Can kitchen cabinet use paint finish?" },
  ]);
  assert.doesNotMatch(finishReply, /\[\[HANDOFF\]\]/);
  assert.match(finishReply, /Kitchen Cabinets|kitchen cabinet/i);

  const paintingReply = buildFallbackReply([
    { role: "user", content: "Do you do kitchen painting and wall painting?" },
  ]);
  assert.match(paintingReply, /\[\[HANDOFF\]\]/);
});

test("a Gemini route is cooled only after repeated timeouts, then skipped on the next message", async () => {
  const calls = [];
  const counters = {};
  const opsStats = {
    recordGeminiAttempt() {},
    recordGeminiFailure() {},
    recordGeminiSuccess() {},
    recordLatency() {},
    recordDeterministicFallback() {},
    recordCounter(name) {
      counters[name] = (counters[name] || 0) + 1;
    },
  };

  const fetchJson = async (_url, options) => {
    const key = options.headers["x-goog-api-key"];
    calls.push(key);
    if (key === "key-one") {
      const error = new Error("Timed out");
      error.code = "AI_REQUEST_TIMEOUT";
      error.statusCode = 408;
      throw error;
    }
    return {
      candidates: [{ content: { parts: [{ text: "healthy reply" }] } }],
      usageMetadata: {},
    };
  };

  const failover = createGeminiFailover({
    buildPrompt: () => "test prompt",
    opsStats,
    fetchJson,
  });
  const messages = [{ role: "user", content: "hello" }];
  const keys = ["key-one", "key-two"];
  const model = "gemini-2.5-flash";

  assert.equal(await failover.tryPrimary(messages, false, keys, model), "healthy reply");
  assert.equal(failover.keyCooldown("key-one", model), null);

  assert.equal(await failover.tryPrimary(messages, false, keys, model), "healthy reply");
  assert.equal(failover.keyCooldown("key-one", model)?.reason, "timeout");

  assert.equal(await failover.tryPrimary(messages, false, keys, model), "healthy reply");
  assert.deepEqual(calls, ["key-one", "key-two", "key-one", "key-two", "key-two"]);
  assert.equal(counters.gemini_timeout_cooldowns, 1);
});
