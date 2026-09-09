const test = require("node:test");
const assert = require("node:assert/strict");

const {
  detectService,
  detectServices,
  detectCorrectedService,
  isUnconfiguredServiceRequest,
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

test("explicit service corrections prefer the replacement scope without treating normal detail updates as replacements", () => {
  assert.equal(detectService("actually wardrobe, not kitchen cabinet")?.name, "Built-in Wardrobes");
  assert.equal(detectService("not kitchen cabinet, actually wardrobe")?.name, "Built-in Wardrobes");
  assert.equal(detectService("wardrobe instead of kitchen cabinet")?.name, "Built-in Wardrobes");
  assert.equal(detectService("I want wardrobe, not kitchen cabinet")?.name, "Built-in Wardrobes");
  assert.equal(detectService("I don't want kitchen cabinet, I want wardrobe")?.name, "Built-in Wardrobes");
  assert.equal(detectService("I don't want kitchen cabinet. I want wardrobe.")?.name, "Built-in Wardrobes");
  assert.equal(detectService("I don't want kitchen cabinet but I want wardrobe")?.name, "Built-in Wardrobes");
  assert.equal(detectService("cancel kitchen cabinet, I want wardrobe instead")?.name, "Built-in Wardrobes");
  assert.equal(detectService("cancel kitchen cabinet. I want wardrobe instead.")?.name, "Built-in Wardrobes");
  assert.equal(detectService("tak nak kitchen cabinet, nak wardrobe")?.name, "Built-in Wardrobes");
  assert.equal(detectService("tak nak kitchen cabinet tapi nak wardrobe")?.name, "Built-in Wardrobes");
  assert.equal(detectService("不是厨房柜，是衣柜")?.name, "Built-in Wardrobes");
  assert.equal(detectCorrectedService("actually kitchen is about 12ft"), null);

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

  const multiScopeSession = {
    messages: [
      { role: "user", content: "I want kitchen cabinet and wardrobe" },
    ],
    lead: { interests: [] },
  };
  updateRenovationLead(multiScopeSession);
  assert.deepEqual(multiScopeSession.lead.interests.sort(), ["Kitchen Cabinets", "Built-in Wardrobes"].sort());

  multiScopeSession.messages.push({ role: "assistant", content: "Do you have rough measurements?" });
  multiScopeSession.messages.push({ role: "user", content: "actually kitchen is about 12ft" });
  updateRenovationLead(multiScopeSession);
  assert.deepEqual(multiScopeSession.lead.interests.sort(), ["Kitchen Cabinets", "Built-in Wardrobes"].sort());
});

test("same-message rejection plus replacement stays an active lead and preserves earlier qualification", () => {
  const session = {
    messages: [
      { role: "user", content: "I want kitchen cabinet in Puchong, budget RM15,000" },
      { role: "assistant", content: "Sure, what size is the kitchen?" },
      { role: "user", content: "I don't want kitchen cabinet, I want wardrobe" },
    ],
    lead: { interests: [] },
  };

  updateRenovationLead(session);

  assert.equal(session.lead.reducedInterest, false);
  assert.deepEqual(session.lead.interests, ["Built-in Wardrobes"]);
  assert.equal(session.lead.preferredBranch, "Cheras / Kajang / Puchong");
  assert.equal(session.lead.budget, "RM15,000");
  assert.ok(session.lead.score > 0);
  assert.notEqual(session.lead.temperature, "cold");

  const cancelSession = {
    messages: [
      { role: "user", content: "Kitchen cabinet in PJ, budget RM20k" },
      { role: "assistant", content: "Got it." },
      { role: "user", content: "cancel kitchen cabinet, I want wardrobe instead" },
    ],
    lead: { interests: [] },
  };
  updateRenovationLead(cancelSession);
  assert.equal(cancelSession.lead.reducedInterest, false);
  assert.deepEqual(cancelSession.lead.interests, ["Built-in Wardrobes"]);
  assert.equal(cancelSession.lead.preferredBranch, "Petaling Jaya / Subang / Shah Alam");
  assert.equal(cancelSession.lead.budget, "RM20,000");

  const punctuationSession = {
    messages: [
      { role: "user", content: "Kitchen cabinet in Puchong, budget RM18k" },
      { role: "assistant", content: "Noted." },
      { role: "user", content: "I don't want kitchen cabinet. I want wardrobe." },
    ],
    lead: { interests: [] },
  };
  updateRenovationLead(punctuationSession);
  assert.equal(punctuationSession.lead.reducedInterest, false);
  assert.deepEqual(punctuationSession.lead.interests, ["Built-in Wardrobes"]);
  assert.equal(punctuationSession.lead.preferredBranch, "Cheras / Kajang / Puchong");
  assert.equal(punctuationSession.lead.budget, "RM18,000");
});

test("service corrections reset old scope measurements while keeping project-level facts", () => {
  const session = {
    messages: [
      { role: "user", content: "Kitchen cabinet for my Puchong condo, around 12ft, budget RM15k" },
      { role: "assistant", content: "Noted." },
      { role: "user", content: "I don't want kitchen cabinet. I want wardrobe." },
    ],
    lead: { interests: [] },
  };

  updateRenovationLead(session);
  assert.deepEqual(session.lead.interests, ["Built-in Wardrobes"]);
  assert.equal(session.lead.preferredBranch, "Cheras / Kajang / Puchong");
  assert.equal(session.lead.propertyType, "Condo / apartment");
  assert.equal(session.lead.budget, "RM15,000");
  assert.equal(session.lead.measurementsKnown, false);

  const reply = buildFallbackReply(session.messages);
  assert.match(reply, /Built-in Wardrobes|wardrobe/i);
  assert.match(reply, /rough measurements|floor plan/i);
  assert.doesNotMatch(reply, /leave the renovation enquiry here/i);

  session.messages.push({ role: "assistant", content: reply });
  session.messages.push({ role: "user", content: "Wardrobe is about 9ft" });
  updateRenovationLead(session);
  assert.equal(session.lead.measurementsKnown, true);
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

test("unconfigured cabinet scope is caught even when mixed with a configured service or written as shorthand", () => {
  assert.equal(isUnconfiguredServiceRequest("Do you also build reception cabinets for a clinic?"), true);
  assert.equal(isUnconfiguredServiceRequest("Do you do reception cabinets?"), true);
  assert.equal(isUnconfiguredServiceRequest("Do you do office cabinets?"), true);
  assert.equal(isUnconfiguredServiceRequest("Do you do bathroom vanity?"), true);
  assert.equal(isUnconfiguredServiceRequest("Do you do kitchen cabinets and bathroom vanity?"), true);
  assert.equal(isUnconfiguredServiceRequest("office cabinets"), true);
  assert.equal(isUnconfiguredServiceRequest("bathroom vanity"), true);
  assert.equal(isUnconfiguredServiceRequest("kitchen cabinets and bathroom vanity"), true);
  assert.equal(isUnconfiguredServiceRequest("Can you make the cabinet taller?"), false);
  assert.equal(isUnconfiguredServiceRequest("Can you also make the cabinet taller?"), false);

  const reply = buildFallbackReply([
    { role: "user", content: "I want kitchen cabinet" },
    { role: "assistant", content: "Is this for a condo or landed home?" },
    { role: "user", content: "Do you also build reception cabinets for a clinic?" },
  ]);

  assert.match(reply, /\[\[HANDOFF\]\]/);
  assert.match(reply, /unlisted|listed custom-carpentry|confirm the actual scope/i);
  assert.doesNotMatch(reply, /I've got Kitchen Cabinets as the project/i);

  const mixedReply = buildFallbackReply([
    { role: "user", content: "Do you do kitchen cabinets and bathroom vanity?" },
  ]);
  assert.match(mixedReply, /\[\[HANDOFF\]\]/);
  assert.match(mixedReply, /Kitchen Cabinets/i);
  assert.match(mixedReply, /another cabinet|isn't configured|confirm/i);

  const shorthandReply = buildFallbackReply([
    { role: "user", content: "I want kitchen cabinet" },
    { role: "assistant", content: "Is this for a condo or landed home?" },
    { role: "user", content: "bathroom vanity" },
  ]);
  assert.match(shorthandReply, /\[\[HANDOFF\]\]/);
  assert.doesNotMatch(shorthandReply, /I've got Kitchen Cabinets as the project/i);

  const followUpReply = buildFallbackReply([
    { role: "user", content: "I want kitchen cabinet" },
    { role: "assistant", content: "Is this for a condo or landed home?" },
    { role: "user", content: "Can you make the cabinet taller?" },
  ]);
  assert.doesNotMatch(followUpReply, /\[\[HANDOFF\]\]/);
});

test("genuine renovation rejection stops deterministic qualification while replacement wording continues", () => {
  const rejectionReply = buildFallbackReply([
    { role: "user", content: "I want kitchen cabinets" },
    { role: "assistant", content: "Is the property a condo or landed home?" },
    { role: "user", content: "Not interested anymore, no thanks" },
  ]);
  assert.match(rejectionReply, /No problem|leave the renovation enquiry here/i);
  assert.doesNotMatch(rejectionReply, /condo|landed|budget|rough measurements|floor plan/i);
  assert.doesNotMatch(rejectionReply, /\[\[HANDOFF\]\]/);

  const replacementReply = buildFallbackReply([
    { role: "user", content: "Kitchen cabinet in Puchong condo, 12ft, budget RM15k" },
    { role: "assistant", content: "Noted." },
    { role: "user", content: "I don't want kitchen cabinet but I want wardrobe" },
  ]);
  assert.match(replacementReply, /Built-in Wardrobes|wardrobe/i);
  assert.doesNotMatch(replacementReply, /leave the renovation enquiry here/i);
});

test("repeated Gemini timeouts cool the model without poisoning individual key routes", async () => {
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
  assert.equal(failover.modelCooldown(model), null);

  assert.equal(await failover.tryPrimary(messages, false, keys, model), "healthy reply");
  assert.equal(failover.keyCooldown("key-one", model), null);
  assert.equal(failover.modelCooldown(model)?.reason, "timeout");

  await assert.rejects(
    () => failover.tryPrimary(messages, false, keys, model),
    (error) => error?.code === "GEMINI_MODEL_COOLING_DOWN"
  );
  assert.deepEqual(calls, ["key-one", "key-two", "key-one", "key-two"]);
  assert.equal(counters.gemini_timeout_cooldowns, 1);
  assert.equal(counters.gemini_model_cooldown_skips, 1);
});
