const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildRenovationIntakePlan,
  _test: intakeHelpers,
} = require("../src/renovationIntakeFlow");
const { buildRenovationAiContext } = require("../src/renovationAiContext");

function qualifiedConversation() {
  return [
    {
      role: "user",
      content: "Kitchen cabinet 12ft in Puchong. Wall is usable and there is one plug. Budget RM10k.",
    },
    {
      role: "assistant",
      content: "Preliminary advice: keep the plug accessible and confirm the final cabinet sizing on site.",
    },
    { role: "user", content: "Okay" },
  ];
}

test("qualified renovation lead becomes measurement-ready and gets a soft site-measurement close", () => {
  const plan = buildRenovationIntakePlan(qualifiedConversation());

  assert.equal(plan.state.measurementReady, true);
  assert.equal(plan.state.measurementOfferSent, false);
  assert.equal(plan.state.measurementOfferAccepted, false);
  assert.match(plan.reply, /site measurement/i);
  assert.match(plan.reply, /want me/i);
  assert.doesNotMatch(plan.reply, /\[\[HANDOFF\]\]/);
});

test("trusted AI context tells the model to close instead of collecting optional fields forever", () => {
  const plan = buildRenovationIntakePlan(qualifiedConversation());
  const context = buildRenovationAiContext(plan);

  assert.match(context, /Site-measurement close readiness: ready/i);
  assert.match(context, /actively offer a site measurement/i);
  assert.match(context, /Do not hand off merely because the lead is measurement-ready/i);
});

test("short contextual acceptance after the site-measurement offer triggers staff handoff", () => {
  const messages = qualifiedConversation();
  messages.push({ role: "assistant", content: intakeHelpers.measurementCloseQuestion("en") });
  messages.push({ role: "user", content: "Yes please" });

  const plan = buildRenovationIntakePlan(messages);

  assert.equal(plan.state.measurementOfferSent, true);
  assert.equal(plan.state.measurementOfferAccepted, true);
  assert.match(plan.reply, /confirm the actual site-measurement timing/i);
  assert.match(plan.reply, /\[\[HANDOFF\]\]/);
});

test("soft decline does not immediately repeat the close or hand off", () => {
  const messages = qualifiedConversation();
  messages.push({ role: "assistant", content: intakeHelpers.measurementCloseQuestion("en") });
  messages.push({ role: "user", content: "I want to think about it first" });

  const plan = buildRenovationIntakePlan(messages);

  assert.equal(plan.state.measurementOfferSent, true);
  assert.equal(plan.state.measurementOfferAccepted, false);
  assert.equal(plan.reply, null);
});

test("Chinese and BM short replies can accept the AI's measurement offer", () => {
  const chinese = [
    { role: "assistant", content: intakeHelpers.measurementCloseQuestion("zh") },
    { role: "user", content: "可以" },
  ];
  const malay = [
    { role: "assistant", content: intakeHelpers.measurementCloseQuestion("ms") },
    { role: "user", content: "boleh" },
  ];

  assert.equal(intakeHelpers.measurementOfferAccepted(chinese), true);
  assert.equal(intakeHelpers.measurementOfferAccepted(malay), true);
});
