const test = require("node:test");
const assert = require("node:assert/strict");

const {
  OPENING_MESSAGE,
  buildRenovationIntakeReply,
  _test: intakeHelpers,
} = require("../src/renovationIntakeFlow");

const BANNED_CUSTOMER_TERMS = /\bcarpentry\b|木工/i;

test("renovation intake starts with the requested site-details template", () => {
  const reply = buildRenovationIntakeReply(
    [{ role: "user", content: "Hi" }],
    { isFirstMessage: true }
  );

  assert.equal(
    reply,
    "☀️Pls let us know :\n\nSite photo: \n\nRough size: \n\nLocation: \n\nThanks 👍"
  );
  assert.equal(reply, OPENING_MESSAGE);
  assert.doesNotMatch(reply, BANNED_CUSTOMER_TERMS);
});

test("after site basics the bot asks what cabinet the customer wants", () => {
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

test("after cabinet type the bot checks site obstructions before advising", () => {
  const messages = [
    { role: "user", content: "Hi" },
    { role: "assistant", content: OPENING_MESSAGE },
    { role: "user", content: "Rough size 12ft, location Puchong, site photo available" },
    { role: "assistant", content: "Thanks 👍 What are you looking to do?" },
    { role: "user", content: "Upper and lower kitchen cabinet" },
  ];

  const reply = buildRenovationIntakeReply(messages);
  assert.match(reply, /clear wall/i);
  assert.match(reply, /switches or plug points/i);
  assert.match(reply, /sink\/water points/i);
  assert.match(reply, /hob\/hood/i);
  assert.match(reply, /beams\/columns/i);
  assert.doesNotMatch(reply, /budget range/i);
  assert.doesNotMatch(reply, BANNED_CUSTOMER_TERMS);
});

test("after obstruction details the real obstruction question advances to preliminary advice", () => {
  const messages = [
    { role: "user", content: "Hi" },
    { role: "assistant", content: OPENING_MESSAGE },
    { role: "user", content: "Rough size 12ft, Location Puchong, site photo available" },
    { role: "assistant", content: "Thanks 👍 What are you looking to do?" },
    { role: "user", content: "Upper and lower kitchen cabinet" },
    { role: "assistant", content: intakeHelpers.obstructionQuestion("en") },
    { role: "user", content: "There are 2 plug points, a sink in the middle and no window. Wall space is otherwise clear." },
  ];

  const reply = buildRenovationIntakeReply(messages);
  assert.match(reply, /Preliminary advice/i);
  assert.match(reply, /switches\/plugs|plug/i);
  assert.match(reply, /wall length\/height/i);
  assert.match(reply, /melamine\/MFC/i);
  assert.match(reply, /plywood/i);
  assert.match(reply, /aluminium/i);
  assert.match(reply, /budget range/i);
  assert.match(reply, /measurement/i);
  assert.doesNotMatch(reply, BANNED_CUSTOMER_TERMS);
});

test("Chinese customer keeps Chinese while following the same site-first order", () => {
  const messages = [
    { role: "user", content: "你好" },
    { role: "assistant", content: OPENING_MESSAGE },
    { role: "user", content: "Site photo 有，尺寸大概 10ft，Location 在 Cheras" },
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
  assert.match(obstructionReply, /墙面够不够/);
  assert.match(obstructionReply, /switch 或 plug/);
  assert.doesNotMatch(obstructionReply, BANNED_CUSTOMER_TERMS);
});

test("site photo is helpful but does not block the text-only demo from moving forward", () => {
  const messages = [
    { role: "user", content: "Hello" },
    { role: "assistant", content: OPENING_MESSAGE },
    { role: "user", content: "Rough size: 8ft. Location: PJ." },
  ];

  const reply = buildRenovationIntakeReply(messages);
  assert.match(reply, /upper \+ lower kitchen cabinets/i);
});

test("direct site-measurement and human requests bypass intake for existing handoff rules", () => {
  assert.equal(
    buildRenovationIntakeReply(
      [{ role: "user", content: "Can your team come for site measurement Saturday?" }],
      { isFirstMessage: true }
    ),
    null
  );
  assert.equal(
    buildRenovationIntakeReply(
      [{ role: "user", content: "Can I speak to a human designer?" }],
      { isFirstMessage: true }
    ),
    null
  );
});
