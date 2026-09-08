const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  buildRenovationIntakePlan,
  _test: intakeHelpers,
} = require("../src/renovationIntakeFlow");
const { buildRenovationAiContext } = require("../src/renovationAiContext");
const { buildSystemPrompt } = require("../src/renovationSystemPrompt");

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

test("natural acceptance can include timing or scheduling details", () => {
  const messages = qualifiedConversation();
  messages.push({
    role: "assistant",
    content: "I can get the team to arrange a site measurement for you. Shall we do that?",
  });
  messages.push({ role: "user", content: "Yes, Saturday afternoon please" });

  const plan = buildRenovationIntakePlan(messages);

  assert.equal(plan.state.measurementOfferSent, true);
  assert.equal(plan.state.measurementOfferAccepted, true);
  assert.match(plan.reply, /\[\[HANDOFF\]\]/);
});

test("measurement-offer detection follows sales intent rather than one exact canned sentence", () => {
  assert.equal(
    intakeHelpers.isMeasurementOfferText("I can get the team to arrange a site measurement for you. Shall we do that?"),
    true
  );
  assert.equal(
    intakeHelpers.isMeasurementOfferText("Would you like me to explain how site measurement works?"),
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

test("Chinese and BM replies can accept the AI's measurement offer with natural extra details", () => {
  const chinese = [
    { role: "assistant", content: intakeHelpers.measurementCloseQuestion("zh") },
    { role: "user", content: "可以，星期六下午" },
  ];
  const malay = [
    { role: "assistant", content: intakeHelpers.measurementCloseQuestion("ms") },
    { role: "user", content: "boleh next week" },
  ];

  assert.equal(intakeHelpers.measurementOfferAccepted(chinese), true);
  assert.equal(intakeHelpers.measurementOfferAccepted(malay), true);
});

test("system prompt preserves Chinese after a currency-only budget reply", () => {
  const prompt = buildSystemPrompt({ isFirstMessage: false });

  assert.match(prompt, /Customer: "RM10k"\nGood: "RM10k 可以作为一个很有用的预算方向/);
  assert.doesNotMatch(prompt, /Customer: "RM10k"\nGood: "RM10k gives the team/i);
  assert.match(prompt, /Never switch from Chinese or Bahasa Malaysia to English because of a bare number or currency-only reply/i);
});

test("normal configured provider paths remain AI-generated; deterministic copy is fallback-only", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/aiService.js"), "utf8");

  assert.match(source, /if \(provider === "claude"\)[\s\S]{0,220}getClaudeReply\(modelMessages, isFirstMessage\)/);
  assert.match(source, /if \(provider === "gemini"\)[\s\S]{0,220}gemini\.getReply\(modelMessages, isFirstMessage, deterministicFallback\)/);
  assert.match(source, /if \(provider === "mock"\) return shieldRenovationCapabilityDisclosure\(messages, deterministicFallback\(\)\)/);

  const prompt = buildSystemPrompt({ isFirstMessage: false });
  assert.match(prompt, /Compose each normal customer-facing reply yourself from the live conversation/i);
  assert.match(prompt, /guardrails, not a script/i);
});
