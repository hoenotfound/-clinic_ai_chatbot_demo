const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const {
  isExplicitHumanRequest,
  isTechnicalHandoffRequest,
  isStandaloneUnconfiguredCabinetRequest,
  sanitizeLegacyRoutingMessages,
} = require("../src/renovationRoutingIntent");
const {
  detectKnownBudget,
  hasKnownBudget,
} = require("../src/renovationBudgetContext");
const {
  buildRenovationIntakePlan,
  OPENING_MESSAGE,
} = require("../src/renovationIntakeFlow");
const { _test: aiHelpers } = require("../src/aiService");

const COMPLETE_KITCHEN_CONSTRAINTS = "The wall is clear, no window, no door, 2 plug points, sink in the middle, no hob or hood, fridge on the right, no beam or column.";

test("ordinary electrical and plumbing site facts do not trigger technical handoff", () => {
  assert.equal(isTechnicalHandoffRequest("There are 2 electrical outlets on the wall."), false);
  assert.equal(isTechnicalHandoffRequest("The plumbing point is under the sink."), false);
  assert.equal(aiHelpers.renovationTechnicalPrecheckReply([{ role: "user", content: "There are 2 electrical outlets on the wall." }]), null);

  assert.equal(isTechnicalHandoffRequest("Can I hack this wall?"), true);
  assert.equal(isTechnicalHandoffRequest("Can you relocate the plumbing point?"), true);
  assert.equal(isTechnicalHandoffRequest("Boleh buat pendawaian sekali?"), true);

  const routed = sanitizeLegacyRoutingMessages([
    { role: "user", content: "The plumbing point is under the sink and there are 2 electrical outlets." },
  ]);
  assert.doesNotMatch(routed[0].content, /\belectrical\b|\bplumbing\b/i);
});

test("benign site-condition wording continues through the intake instead of bypassing", () => {
  const messages = [
    { role: "user", content: "Hi" },
    { role: "assistant", content: OPENING_MESSAGE },
    { role: "user", content: "Rough size 12ft, Location Puchong." },
    { role: "assistant", content: "What are you looking to do?" },
    { role: "user", content: "Upper and lower kitchen cabinet" },
    { role: "assistant", content: "Tell me about the wall and service points." },
    { role: "user", content: "There are 2 electrical outlets and the plumbing point is under the sink." },
  ];
  const plan = buildRenovationIntakePlan(messages);
  assert.equal(plan.bypass, false);
  assert.ok(plan.reply);
  assert.doesNotMatch(plan.reply, /technical check|HANDOFF/i);
});

test("unlisted standalone cabinet types hand off instead of repeating the cabinet question", () => {
  for (const text of ["Pantry cabinet", "Kitchen island cabinet", "I want a pantry cabinet"]) {
    assert.equal(isStandaloneUnconfiguredCabinetRequest(text), true, text);
    const plan = buildRenovationIntakePlan([{ role: "user", content: text }], { isFirstMessage: true });
    assert.equal(plan.bypass, true, text);
    const reply = aiHelpers.renovationRoutingPrecheckReply([{ role: "user", content: text }]);
    assert.match(reply, /not configured|confirm whether/i, text);
    assert.match(reply, /\[\[HANDOFF\]\]/, text);
  }

  assert.equal(isStandaloneUnconfiguredCabinetRequest("Kitchen cabinet"), false);
  assert.equal(isStandaloneUnconfiguredCabinetRequest("Wardrobe"), false);
});

test("human handoff requires actual request intent and accepts natural short requests", () => {
  assert.equal(isExplicitHumanRequest("I need a designer"), true);
  assert.equal(isExplicitHumanRequest("Designer please"), true);
  assert.equal(isExplicitHumanRequest("Can I speak to a project manager?"), true);
  assert.equal(isExplicitHumanRequest("My designer already gave me the layout."), false);
  assert.equal(isExplicitHumanRequest("My project manager already gave me the plan."), false);
  assert.equal(isExplicitHumanRequest("The salesperson sent the colour options."), false);

  const passivePlan = buildRenovationIntakePlan([
    { role: "user", content: "My project manager already gave me the plan. I need kitchen cabinets." },
  ], { isFirstMessage: true });
  assert.equal(passivePlan.bypass, false);
  assert.equal(passivePlan.reply, OPENING_MESSAGE);

  for (const text of ["I need a designer", "Designer please"]) {
    const reply = aiHelpers.renovationRoutingPrecheckReply([{ role: "user", content: text }]);
    assert.match(reply, /\[\[HANDOFF\]\]/, text);
  }
});

test("price amounts are not treated as budget without budget context", () => {
  assert.equal(detectKnownBudget([{ role: "user", content: "Is the RM6,800 price inclusive of countertop?" }]), null);
  assert.equal(hasKnownBudget([{ role: "user", content: "Is the RM6,800 price inclusive of countertop?" }]), false);
  assert.equal(detectKnownBudget([{ role: "user", content: "Budget RM15k" }]), "RM15,000");
  assert.equal(detectKnownBudget([
    { role: "assistant", content: "What budget range are you aiming for?" },
    { role: "user", content: "4500" },
  ]), "RM4,500");
});

test("a price-first enquiry still asks for budget later when no real budget was supplied", () => {
  const messages = [
    { role: "user", content: "Is the RM6,800 price inclusive for a 12ft kitchen cabinet in Puchong?" },
    { role: "assistant", content: "The final quotation depends on the actual scope." },
    { role: "user", content: COMPLETE_KITCHEN_CONSTRAINTS },
  ];
  const plan = buildRenovationIntakePlan(messages);
  assert.equal(plan.state.budgetKnown, false);
  assert.ok(plan.adviceReply);
  assert.match(plan.adviceReply, /What budget range are you aiming for/i);
});

test("clinic startup does not eagerly load renovation-only conversation modules", () => {
  const repoRoot = path.resolve(__dirname, "..");
  const script = `
    process.env.DEMO_INDUSTRY = "clinic";
    process.env.AI_PROVIDER = "mock";
    require("./src/aiService");
    const forbidden = [
      "renovationIntakeFlow.js",
      "renovationIntakeFlowBase.js",
      "renovationCustomerLanguage.js",
      "renovationRoutingIntent.js",
      "renovationFallback.js"
    ];
    const loaded = Object.keys(require.cache).filter((entry) => forbidden.some((name) => entry.endsWith(name)));
    if (loaded.length) {
      console.error(loaded.join("\\n"));
      process.exit(1);
    }
  `;
  execFileSync(process.execPath, ["-e", script], {
    cwd: repoRoot,
    env: { ...process.env, DEMO_INDUSTRY: "clinic", AI_PROVIDER: "mock" },
    stdio: "pipe",
  });
});
