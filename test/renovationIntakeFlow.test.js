const test = require("node:test");
const assert = require("node:assert/strict");

const {
  OPENING_MESSAGE,
  buildRenovationIntakeReply,
  buildRenovationIntakePlan,
  _test: intakeHelpers,
} = require("../src/renovationIntakeFlow");
const { _test: aiHelpers } = require("../src/aiService");

const BANNED_CUSTOMER_TERMS = /\bcarpentry\b|木工/i;
const LEGACY_FORM = /Site photo\s*:|Rough size\s*:|Location\s*:/i;
const COMPLETE_KITCHEN_CONSTRAINTS = "The wall is clear, no window, no door, 2 plug points, sink in the middle, no hob or hood, fridge on the right, no beam or column.";

function baseKitchenConversation() {
  return [
    { role: "user", content: "Hi" },
    { role: "assistant", content: OPENING_MESSAGE },
    { role: "user", content: "Rough size: 12ft. Location: Puchong. No site photo." },
    { role: "assistant", content: "Thanks 👍 What are you looking to do?" },
    { role: "user", content: "Upper and lower kitchen cabinet" },
  ];
}

test("renovation fallback starts conversationally instead of showing the retired three-field form", () => {
  const reply = buildRenovationIntakeReply([{ role: "user", content: "Hi" }], { isFirstMessage: true });
  assert.equal(reply, OPENING_MESSAGE);
  assert.match(reply, /kitchen cabinet|wardrobe|TV cabinet/i);
  assert.doesNotMatch(reply, LEGACY_FORM);
  assert.doesNotMatch(reply, BANNED_CUSTOMER_TERMS);
});

test("after useful size and location context the fallback asks what cabinet the customer wants", () => {
  const messages = [
    { role: "user", content: "Hi" },
    { role: "assistant", content: OPENING_MESSAGE },
    { role: "user", content: "Site photo available. Rough size: 12ft. Location: Puchong." },
  ];
  const reply = buildRenovationIntakeReply(messages);
  assert.match(reply, /upper \+ lower kitchen cabinets/i);
  assert.match(reply, /wardrobe cabinet/i);
  assert.match(reply, /TV cabinet/i);
  assert.match(reply, /shoe cabinet/i);
  assert.doesNotMatch(reply, BANNED_CUSTOMER_TERMS);
});

test("kitchen qualification requires usable wall context without forcing a plug question", () => {
  const plan = buildRenovationIntakePlan(baseKitchenConversation());
  assert.deepEqual(plan.state.missingConstraints, ["wall"]);
  assert.match(plan.reply, /wall space usable/i);
  assert.doesNotMatch(plan.reply, /switches or plug points/i);
  assert.doesNotMatch(plan.reply, /sink\/water points|hob\/hood|fridge|beam|column/i);
});

test("TV cabinet qualification still requires both wall and power context", () => {
  const plan = buildRenovationIntakePlan([
    { role: "user", content: "TV cabinet around 8ft in PJ." },
  ], { isFirstMessage: true });
  assert.deepEqual(new Set(plan.state.missingConstraints), new Set(["wall", "power"]));
  assert.match(plan.reply, /wall space usable/i);
  assert.match(plan.reply, /switches or plug points/i);
});

test("unrelated volunteered site details do not falsely complete the required wall check", () => {
  const messages = baseKitchenConversation();
  messages.push({ role: "user", content: "There is a window and one plug." });
  const plan = buildRenovationIntakePlan(messages);
  assert.deepEqual(plan.state.missingConstraints, ["wall"]);
  assert.equal(plan.adviceReply, null);
  assert.match(plan.reply, /wall space usable/i);
});

test("short contextual wall answers are understood from the preceding question", () => {
  const messages = baseKitchenConversation();
  messages.push({ role: "assistant", content: "Got it. Is the wall space usable for the cabinet?" });
  messages.push({ role: "user", content: "yes" });
  const plan = buildRenovationIntakePlan(messages);
  assert.deepEqual(plan.state.missingConstraints, []);
  assert.equal(plan.reply, null);
  assert.ok(plan.adviceReply);
  assert.match(plan.adviceReply, /Preliminary advice/i);
});

test("service-specific required checks stay narrow", () => {
  assert.deepEqual(intakeHelpers.requiredConstraintGroups(["Kitchen Cabinets"]), ["wall"]);
  assert.deepEqual(intakeHelpers.requiredConstraintGroups(["Built-in Wardrobes"]), ["wall"]);
  assert.deepEqual(new Set(intakeHelpers.requiredConstraintGroups(["TV Console & Living Room Carpentry"])), new Set(["wall", "power"]));
  assert.deepEqual(intakeHelpers.requiredConstraintGroups(["Shoe Cabinet & Entrance Storage"]), ["wall"]);
  assert.deepEqual(intakeHelpers.requiredConstraintGroups(["Study, Display & Storage Cabinets"]), ["wall"]);
  assert.deepEqual(intakeHelpers.requiredConstraintGroups(["Full-Home Custom Carpentry"]), []);
});

test("volunteered kitchen details are remembered and used in tailored preliminary advice", () => {
  const messages = baseKitchenConversation();
  messages.push({ role: "user", content: COMPLETE_KITCHEN_CONSTRAINTS });
  const plan = buildRenovationIntakePlan(messages);
  assert.equal(plan.reply, null);
  assert.ok(plan.adviceReply);
  assert.match(plan.adviceReply, /Preliminary advice/i);
  assert.match(plan.adviceReply, /sink is in the middle/i);
  assert.match(plan.adviceReply, /2 plug points/i);
  assert.match(plan.adviceReply, /melamine\/MFC/i);
  assert.match(plan.adviceReply, /plywood/i);
  assert.match(plan.adviceReply, /aluminium/i);
  assert.match(plan.adviceReply, /budget range/i);
  assert.doesNotMatch(plan.adviceReply, BANNED_CUSTOMER_TERMS);
});

test("vague size and location values are not treated as completed intake data", () => {
  const messages = [
    { role: "user", content: "Hi" },
    { role: "assistant", content: OPENING_MESSAGE },
    { role: "user", content: "Rough size: not sure. Location: not sure. I don't have a site photo." },
  ];
  const plan = buildRenovationIntakePlan(messages);
  assert.equal(plan.state.sizeKnown, false);
  assert.equal(plan.state.hasLocation, false);
  assert.equal(plan.state.photoStatus, "unavailable");
  assert.match(plan.reply, /rough size and location/i);
  assert.match(plan.reply, /No site photo is okay/i);
});

test("a specific first price question is answered first and then asks only the relevant kitchen check", () => {
  const plan = buildRenovationIntakePlan([
    { role: "user", content: "How much for 12ft kitchen cabinet in Puchong?" },
  ], { isFirstMessage: true });
  assert.equal(plan.reply, null);
  assert.equal(plan.answerFirst, true);
  assert.match(plan.directFallbackAnswer, /RM\s*6,800/i);
  assert.match(plan.appendAfterAnswer, /wall space usable/i);
  assert.doesNotMatch(plan.appendAfterAnswer, /switches or plug points/i);
  assert.doesNotMatch(plan.appendAfterAnswer, LEGACY_FORM);
});

test("a first material question is answered before a conversational scope follow-up", () => {
  const plan = buildRenovationIntakePlan([
    { role: "user", content: "Do you use plywood?" },
  ], { isFirstMessage: true });
  assert.equal(plan.reply, null);
  assert.equal(plan.answerFirst, true);
  assert.match(plan.directFallbackAnswer, /plywood/i);
  assert.equal(plan.appendAfterAnswer, OPENING_MESSAGE);
  assert.doesNotMatch(plan.appendAfterAnswer, LEGACY_FORM);
});

test("technical, complaint and unsupported-trade messages bypass normal intake", () => {
  for (const message of [
    "Can I hack wall for the cabinet?",
    "The cabinet you installed is damaged and I want to complain.",
    "Do you do bathroom renovation?",
  ]) {
    const plan = buildRenovationIntakePlan([{ role: "user", content: message }], { isFirstMessage: true });
    assert.equal(plan.bypass, true, message);
    assert.equal(plan.reply, null, message);
  }
});

test("natural technical wording is intercepted and handed to staff", () => {
  const reply = aiHelpers.renovationTechnicalPrecheckReply([
    { role: "user", content: "Can I hack this wall for the cabinet?" },
  ]);
  assert.match(reply, /site-specific technical check/i);
  assert.match(reply, /\[\[HANDOFF\]\]/);
  assert.doesNotMatch(reply, BANNED_CUSTOMER_TERMS);
});

test("service correction uses only the replacement scope for qualification", () => {
  const messages = baseKitchenConversation();
  messages.push({ role: "user", content: COMPLETE_KITCHEN_CONSTRAINTS });
  messages.push({ role: "assistant", content: "Preliminary advice: kitchen direction noted." });
  messages.push({ role: "user", content: "Actually change kitchen cabinet to wardrobe, wardrobe around 8ft." });
  const plan = buildRenovationIntakePlan(messages);
  assert.deepEqual(plan.state.serviceNames, ["Built-in Wardrobes"]);
  assert.equal(plan.state.sizeKnown, true);
  assert.deepEqual(plan.state.missingConstraints, ["wall"]);
  assert.match(plan.reply, /wall/i);
  assert.doesNotMatch(plan.reply, /switch|plug|sink\/water points/i);
  assert.equal(plan.state.facts.groups.has("plumbing"), false);
});

test("a renewed project after a genuine decline does not inherit stale project facts", () => {
  const messages = baseKitchenConversation();
  messages.push({ role: "user", content: COMPLETE_KITCHEN_CONSTRAINTS });
  messages.push({ role: "assistant", content: "Preliminary advice: kitchen direction noted." });
  messages.push({ role: "user", content: "Not interested anymore." });
  messages.push({ role: "assistant", content: "No problem, we'll stop here." });
  messages.push({ role: "user", content: "Actually I changed my mind. I want wardrobe, around 8ft." });
  const plan = buildRenovationIntakePlan(messages);
  assert.deepEqual(plan.state.serviceNames, ["Built-in Wardrobes"]);
  assert.equal(plan.state.sizeKnown, true);
  assert.equal(plan.state.hasLocation, false);
  assert.equal(plan.state.facts.groups.has("plumbing"), false);
  assert.match(plan.reply, /location/i);
});

test("an early budget is remembered and deterministic advice does not ask for it twice", () => {
  const messages = [
    { role: "user", content: "Kitchen cabinet 12ft in Puchong. Budget RM15k. Wall is usable." },
  ];
  const plan = buildRenovationIntakePlan(messages, { isFirstMessage: true });
  assert.equal(plan.state.budgetKnown, true);
  assert.ok(plan.adviceReply);
  assert.match(plan.adviceReply, /budget you already shared/i);
  assert.doesNotMatch(plan.adviceReply, /What budget range are you aiming for/i);
});

test("Chinese customer stays in Chinese and kitchen qualification asks only the relevant wall check", () => {
  const messages = [
    { role: "user", content: "你好" },
    { role: "assistant", content: "你好 👋 你想做哪一种柜子？厨房柜、衣柜、电视柜、鞋柜，还是其他？" },
    { role: "user", content: "厨房吊柜和地柜，尺寸大概 10ft，Location 在 Cheras" },
  ];
  const reply = buildRenovationIntakeReply(messages);
  assert.match(reply, /墙/);
  assert.doesNotMatch(reply, /switch 或 plug/);
  assert.doesNotMatch(reply, /水槽|水位|hob|hood|冰箱|梁柱/);
  assert.doesNotMatch(reply, BANNED_CUSTOMER_TERMS);
});

test("site photo remains optional and does not block a text-only enquiry", () => {
  const messages = [
    { role: "user", content: "Hello" },
    { role: "assistant", content: OPENING_MESSAGE },
    { role: "user", content: "Rough size: 8ft. Location: PJ. No photo now." },
  ];
  const reply = buildRenovationIntakeReply(messages);
  assert.match(reply, /upper \+ lower kitchen cabinets/i);
});

test("direct site-measurement and human requests remain hard handoff routes", () => {
  assert.equal(buildRenovationIntakeReply([{ role: "user", content: "Can your team come for site measurement Saturday?" }], { isFirstMessage: true }), null);
  assert.equal(buildRenovationIntakeReply([{ role: "user", content: "Can I speak to a human designer?" }], { isFirstMessage: true }), null);
});