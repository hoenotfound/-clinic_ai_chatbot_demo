const test = require("node:test");
const assert = require("node:assert/strict");

const {
  OPENING_MESSAGE,
  buildRenovationIntakePlan,
  _test: intakeHelpers,
} = require("../src/renovationIntakeFlow");
const { buildRenovationAiContext } = require("../src/renovationAiContext");
const { buildSystemPrompt } = require("../src/renovationSystemPrompt");
const { updateRenovationLead } = require("../src/renovationLeadState");
const measurementIntent = require("../src/renovationMeasurementIntent");
const { sanitizeRenovationCustomerReply } = require("../src/renovationCustomerLanguage");

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

function qualifiedWithoutBudget() {
  return [
    {
      role: "user",
      content: "Kitchen cabinet 12ft in Puchong. Wall is usable and there is one plug.",
    },
    {
      role: "assistant",
      content: "Preliminary advice: keep the plug accessible and confirm the final cabinet sizing on site.",
    },
    { role: "user", content: "Let's proceed" },
  ];
}

test("qualified renovation lead becomes measurement-ready and gets a private-marked soft close", () => {
  const plan = buildRenovationIntakePlan(qualifiedConversation());

  assert.equal(plan.state.measurementReady, true);
  assert.equal(plan.state.measurementOfferSent, false);
  assert.equal(plan.state.measurementOfferAccepted, false);
  assert.match(plan.reply, /site measurement/i);
  assert.match(plan.reply, /want me/i);
  assert.match(plan.reply, /\[\[MEASUREMENT_OFFERED\]\]/);
  assert.doesNotMatch(plan.reply, /\[\[HANDOFF\]\]/);
});

test("trusted AI context tells the model to close instead of collecting optional fields forever", () => {
  const plan = buildRenovationIntakePlan(qualifiedConversation());
  const context = buildRenovationAiContext(plan);

  assert.match(context, /Site-measurement close readiness: ready/i);
  assert.match(context, /actively offer a site measurement/i);
  assert.match(context, /Do not hand off merely because the lead is measurement-ready/i);
});

test("strong buying intent can trigger the measurement close without forcing budget", () => {
  const plan = buildRenovationIntakePlan(qualifiedWithoutBudget());
  const context = buildRenovationAiContext(plan);

  assert.equal(plan.state.measurementReady, true);
  assert.equal(plan.state.budgetKnown, false);
  assert.equal(plan.state.strongBuyingIntent, true);
  assert.match(plan.reply, /site measurement/i);
  assert.match(context, /do not block on budget/i);
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

test("timing-only Malaysian replies can accept a marked AI measurement offer", () => {
  for (const reply of [
    "Saturday afternoon can?",
    "How about next week?",
    "minggu depan boleh?",
    "星期六下午可以吗",
  ]) {
    const messages = [
      {
        role: "assistant",
        content: "I can get the team to take the next step with you.",
        measurementOffered: true,
      },
      { role: "user", content: reply },
    ];
    assert.equal(measurementIntent.measurementOfferAccepted(messages), true, reply);
  }
});

test("measurement-offer detection follows arrangement intent rather than a keyword mention", () => {
  assert.equal(
    intakeHelpers.isMeasurementOfferText("I can get the team to arrange a site measurement for you. Shall we do that?"),
    true
  );
  assert.equal(
    intakeHelpers.isMeasurementOfferText("Would you like me to explain how site measurement works?"),
    false
  );
  assert.equal(
    measurementIntent.measurementOfferAccepted([
      { role: "assistant", content: "Would you like me to explain how site measurement works?" },
      { role: "user", content: "Yes" },
    ]),
    false
  );
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

test("an affirmative-looking reply with a delay is not treated as acceptance", () => {
  const messages = qualifiedConversation();
  messages.push({ role: "assistant", content: intakeHelpers.measurementCloseQuestion("en") });
  messages.push({ role: "user", content: "Yes, but not now. Maybe later." });

  assert.equal(intakeHelpers.measurementOfferAccepted(messages), false);
});

test("service-specific qualification does not force plug questions for every cabinet type", () => {
  assert.deepEqual(intakeHelpers.requiredConstraintGroups(["Kitchen Cabinets"]), ["wall"]);
  assert.deepEqual(intakeHelpers.requiredConstraintGroups(["Built-in Wardrobes"]), ["wall"]);
  assert.deepEqual(intakeHelpers.requiredConstraintGroups(["Shoe Cabinet & Entrance Storage"]), ["wall"]);
  assert.deepEqual(intakeHelpers.requiredConstraintGroups(["TV Console & Living Room Carpentry"]), ["wall", "power"]);
  assert.deepEqual(intakeHelpers.requiredConstraintGroups(["Full-Home Custom Carpentry"]), []);
});

test("deterministic outage opening is conversational instead of the old three-field form", () => {
  assert.match(OPENING_MESSAGE, /What are you planning to build/i);
  assert.doesNotMatch(OPENING_MESSAGE, /Site photo\s*:/i);
  assert.doesNotMatch(OPENING_MESSAGE, /Rough size\s*:/i);
  assert.doesNotMatch(OPENING_MESSAGE, /Location\s*:/i);
});

test("lead state records contextual acceptance but not measurement education as booking intent", () => {
  const accepted = {
    messages: [
      { role: "user", content: "Kitchen cabinet 12ft in Puchong, budget RM10k." },
      { role: "assistant", content: "I can arrange the next step for you.", measurementOffered: true },
      { role: "user", content: "Saturday afternoon can?" },
    ],
    lead: {},
  };
  updateRenovationLead(accepted);
  assert.equal(accepted.lead.siteMeasurementIntent, true);
  assert.equal(accepted.lead.bookingIntent, true);
  assert.equal(accepted.lead.temperature, "hot");

  const educational = {
    messages: [
      { role: "user", content: "Kitchen cabinet 12ft in Puchong. How does site measurement work?" },
    ],
    lead: {},
  };
  updateRenovationLead(educational);
  assert.equal(educational.lead.siteMeasurementIntent, false);
  assert.equal(educational.lead.bookingIntent, false);
});

test("system prompt preserves Chinese and marks only actual AI measurement offers", () => {
  const prompt = buildSystemPrompt({ isFirstMessage: false });

  assert.match(prompt, /Customer: "RM10k"\nGood: "RM10k 可以作为一个很有用的预算方向/);
  assert.match(prompt, /\[\[MEASUREMENT_OFFERED\]\]/);
  assert.match(prompt, /Do NOT append \[\[MEASUREMENT_OFFERED\]\] when merely explaining/i);
  assert.doesNotMatch(prompt, /Customer: "RM10k"\nGood: "RM10k gives the team/i);
  assert.match(prompt, /Never switch from Chinese or Bahasa Malaysia to English because of a bare number or currency-only reply/i);
});

test("configured business name survives customer-language cleanup unchanged", () => {
  const reply = sanitizeRenovationCustomerReply("We are Oakline Demo Renovation & Carpentry. We focus on custom carpentry projects.");
  assert.match(reply, /Oakline Demo Renovation & Carpentry/);
  assert.match(reply, /custom cabinets projects/i);
});
