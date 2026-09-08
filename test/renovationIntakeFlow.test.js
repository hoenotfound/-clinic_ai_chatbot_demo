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

function baseKitchenConversation() {
  return [
    { role: "user", content: "Hi" },
    { role: "assistant", content: OPENING_MESSAGE },
    { role: "user", content: "Rough size: 12ft. Location: Puchong. No site photo." },
    { role: "assistant", content: "Thanks 👍 What are you looking to do?" },
    { role: "user", content: "Upper and lower kitchen cabinet" },
    { role: "assistant", content: intakeHelpers.obstructionQuestion("en", ["Kitchen Cabinets"]) },
  ];
}

test("renovation intake starts with the requested site-details template for a generic greeting", () => {
  const reply = buildRenovationIntakeReply([{ role: "user", content: "Hi" }], { isFirstMessage: true });
  assert.equal(reply, "☀️Pls let us know :\n\nSite photo: \n\nRough size: \n\nLocation: \n\nThanks 👍");
  assert.equal(reply, OPENING_MESSAGE);
  assert.doesNotMatch(reply, BANNED_CUSTOMER_TERMS);
});

test("after usable site basics the bot asks what cabinet the customer wants", () => {
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
  assert.match(reply, /something else/i);
  assert.doesNotMatch(reply, BANNED_CUSTOMER_TERMS);
});

test("after cabinet type the bot asks service-specific site constraints before advising", () => {
  const messages = [
    { role: "user", content: "Hi" },
    { role: "assistant", content: OPENING_MESSAGE },
    { role: "user", content: "Rough size 12ft, location Puchong, site photo available" },
    { role: "assistant", content: "Thanks 👍 What are you looking to do?" },
    { role: "user", content: "Upper and lower kitchen cabinet" },
  ];
  const reply = buildRenovationIntakeReply(messages);
  assert.match(reply, /switches or plug points/i);
  assert.match(reply, /sink\/water points/i);
  assert.match(reply, /hob\/hood/i);
  assert.match(reply, /fridge/i);
  assert.doesNotMatch(reply, /budget range/i);
  assert.doesNotMatch(reply, BANNED_CUSTOMER_TERMS);
});

test("one obstruction detail does not count as a complete site-condition answer", () => {
  const messages = baseKitchenConversation();
  messages.push({ role: "user", content: "There is a window." });
  const plan = buildRenovationIntakePlan(messages);
  assert.equal(plan.adviceReply, null);
  assert.match(plan.reply, /usable wall space/i);
  assert.match(plan.reply, /switches or plug points/i);
  assert.match(plan.reply, /sink\/water points/i);
  assert.doesNotMatch(plan.reply, /Preliminary advice/i);
});

test("complete kitchen constraints produce tailored preliminary advice and let the provider answer naturally", () => {
  const messages = baseKitchenConversation();
  messages.push({ role: "user", content: "The wall is clear except 2 plug points and a sink in the middle. No window." });
  const plan = buildRenovationIntakePlan(messages);
  assert.equal(plan.reply, null);
  assert.ok(plan.adviceReply);
  assert.match(plan.adviceReply, /Preliminary advice/i);
  assert.match(plan.adviceReply, /sink is in the middle/i);
  assert.match(plan.adviceReply, /2 plug points/i);
  assert.match(plan.adviceReply, /no window restriction/i);
  assert.match(plan.adviceReply, /melamine\/MFC/i);
  assert.match(plan.adviceReply, /plywood/i);
  assert.match(plan.adviceReply, /aluminium/i);
  assert.match(plan.adviceReply, /budget range/i);
  assert.doesNotMatch(plan.adviceReply, BANNED_CUSTOMER_TERMS);
  assert.equal(buildRenovationIntakeReply(messages), null);
});

test("vague size/location values are not treated as completed intake data", () => {
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
  assert.doesNotMatch(plan.reply, /I've noted the site photo/i);
});

test("a specific first price question is answered first and then continues from the next missing stage", () => {
  const messages = [{ role: "user", content: "How much for 12ft kitchen cabinet in Puchong?" }];
  const plan = buildRenovationIntakePlan(messages, { isFirstMessage: true });
  assert.equal(plan.reply, null);
  assert.equal(plan.answerFirst, true);
  assert.match(plan.directFallbackAnswer, /RM\s*6,800/i);
  assert.match(plan.appendAfterAnswer, /switches or plug points/i);
  assert.match(plan.appendAfterAnswer, /sink\/water points/i);
  assert.notEqual(plan.appendAfterAnswer, OPENING_MESSAGE);
});

test("a material question is answered before showing the missing site-details template", () => {
  const messages = [{ role: "user", content: "Do you use plywood?" }];
  const plan = buildRenovationIntakePlan(messages, { isFirstMessage: true });
  assert.equal(plan.reply, null);
  assert.equal(plan.answerFirst, true);
  assert.match(plan.directFallbackAnswer, /plywood/i);
  assert.equal(plan.appendAfterAnswer, OPENING_MESSAGE);
});

test("technical, complaint and unsupported-trade messages bypass the normal intake path", () => {
  const cases = [
    "Can I hack wall for the cabinet?",
    "The cabinet you installed is damaged and I want to complain.",
    "Do you do bathroom renovation?",
  ];
  for (const message of cases) {
    const plan = buildRenovationIntakePlan([{ role: "user", content: message }], { isFirstMessage: true });
    assert.equal(plan.bypass, true, message);
    assert.equal(plan.reply, null, message);
  }
});

test("natural technical wording with a determiner is intercepted before intake and handed to staff", () => {
  const reply = aiHelpers.renovationTechnicalPrecheckReply([
    { role: "user", content: "Can I hack this wall for the cabinet?" },
  ]);
  assert.match(reply, /site-specific technical check/i);
  assert.match(reply, /\[\[HANDOFF\]\]/);
  assert.doesNotMatch(reply, BANNED_CUSTOMER_TERMS);
});

test("service correction uses only the replacement scope for size and obstruction collection", () => {
  const messages = baseKitchenConversation();
  messages.push({ role: "user", content: "The wall is clear except 2 plug points and a sink in the middle. No window." });
  messages.push({ role: "assistant", content: "Preliminary advice: kitchen direction noted." });
  messages.push({ role: "user", content: "Actually change kitchen cabinet to wardrobe, wardrobe around 8ft." });
  const plan = buildRenovationIntakePlan(messages);
  assert.deepEqual(plan.state.serviceNames, ["Built-in Wardrobes"]);
  assert.equal(plan.state.sizeKnown, true);
  assert.ok(plan.state.missingConstraints.length > 0);
  assert.match(plan.reply, /wardrobe/i);
  assert.doesNotMatch(plan.reply, /sink\/water points/i);
  assert.equal(plan.state.facts.groups.has("plumbing"), false);
});

test("a renewed project after a genuine decline does not inherit old location or site facts", () => {
  const messages = baseKitchenConversation();
  messages.push({ role: "user", content: "The wall is clear except 2 plug points and a sink in the middle. No window." });
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

test("Chinese customer keeps Chinese while following the same adaptive site-first order", () => {
  const messages = [
    { role: "user", content: "你好" },
    { role: "assistant", content: OPENING_MESSAGE },
    { role: "user", content: "没有照片，尺寸大概 10ft，Location 在 Cheras" },
  ];
  const scopeReply = buildRenovationIntakeReply(messages);
  assert.match(scopeReply, /厨房吊柜 \+ 地柜/);
  assert.match(scopeReply, /衣柜/);
  assert.match(scopeReply, /电视柜/);
  assert.match(scopeReply, /鞋柜/);
  assert.doesNotMatch(scopeReply, BANNED_CUSTOMER_TERMS);

  messages.push({ role: "assistant", content: scopeReply });
  messages.push({ role: "user", content: "厨房吊柜和地柜" });
  const obstructionReply = buildRenovationIntakeReply(messages);
  assert.match(obstructionReply, /switch 或 plug/);
  assert.match(obstructionReply, /水槽\/水位/);
  assert.doesNotMatch(obstructionReply, BANNED_CUSTOMER_TERMS);
});

test("site photo is helpful but does not block the text-only demo from moving forward", () => {
  const messages = [
    { role: "user", content: "Hello" },
    { role: "assistant", content: OPENING_MESSAGE },
    { role: "user", content: "Rough size: 8ft. Location: PJ. No photo now." },
  ];
  const reply = buildRenovationIntakeReply(messages);
  assert.match(reply, /upper \+ lower kitchen cabinets/i);
});

test("direct site-measurement and human requests bypass intake for existing handoff rules", () => {
  assert.equal(buildRenovationIntakeReply([{ role: "user", content: "Can your team come for site measurement Saturday?" }], { isFirstMessage: true }), null);
  assert.equal(buildRenovationIntakeReply([{ role: "user", content: "Can I speak to a human designer?" }], { isFirstMessage: true }), null);
});
