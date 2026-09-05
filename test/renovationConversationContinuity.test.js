const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DEMO_INDUSTRY = "renovation";
process.env.AI_PROVIDER = "mock";

const industry = require("../src/industryProfile");
const ai = require("../src/aiService");
const state = require("../src/demoState");
const { detectBudget } = require("../src/renovationLeadState");

function session(suffix) {
  return state.createSession({
    channel: "whatsapp",
    ip: `renovation-continuity-${Date.now()}-${suffix}`,
  });
}

function addCustomer(sessionState, message) {
  sessionState.lastCustomerMessageAt = 0;
  state.addCustomerMessage(sessionState, message);
}

function chineseBudgetConversation(answer) {
  return [
    { role: "user", content: "我想做厨房柜" },
    { role: "assistant", content: "可以。你的房子是 condo 还是 landed？" },
    { role: "user", content: "condo，在 Puchong" },
    { role: "assistant", content: "好的，你的预算大概多少？" },
    { role: "user", content: answer },
  ];
}

test("renovation prompt explicitly preserves established language for number-only replies", () => {
  const prompt = industry.buildSystemPrompt({ isFirstMessage: false });
  assert.match(prompt, /most recently established language/i);
  assert.match(prompt, /number-only amount/i);
  assert.match(prompt, /4500/);
});

test("bare numbers are only treated as budget when the conversation context asks for budget", () => {
  assert.equal(detectBudget("4500"), null);
  assert.equal(detectBudget("4500", { allowBare: true }), "RM4,500");
});

test("Chinese renovation fallback keeps Chinese and advances after a numeric budget answer", () => {
  const reply = ai.getFallbackReply(chineseBudgetConversation("4500"));
  assert.match(reply, /RM4,500/);
  assert.match(reply, /收到|预算|尺寸|floor plan/);
  assert.doesNotMatch(reply, /^Sure,/i);
  assert.doesNotMatch(reply, /Are you looking at kitchen cabinets/i);
  assert.doesNotMatch(reply, /condo, landed home, or commercial unit/i);
});

test("currency shorthand does not switch an established Chinese conversation to English", () => {
  for (const answer of ["RM4500", "4.5k"]) {
    const reply = ai.getFallbackReply(chineseBudgetConversation(answer));
    assert.match(reply, /RM4,500/);
    assert.match(reply, /收到|预算|尺寸|floor plan/);
    assert.doesNotMatch(reply, /Got it, I'll note/i);
  }
});

test("short renovation tokens and measurements inherit the established customer language", () => {
  const condoReply = ai.getFallbackReply([
    { role: "user", content: "我想做厨房柜" },
    { role: "assistant", content: "你的房子是 condo 还是 landed？" },
    { role: "user", content: "condo" },
  ]);
  assert.match(condoReply, /[一-鿿]/);
  assert.doesNotMatch(condoReply, /^Sure,/i);

  const measurementReply = ai.getFallbackReply([
    { role: "user", content: "我想做厨房柜，新 condo 在 Puchong。" },
    { role: "assistant", content: "厨房大概多长？" },
    { role: "user", content: "12ft" },
  ]);
  assert.match(measurementReply, /[一-鿿]/);
  assert.doesNotMatch(measurementReply, /^Sure,/i);
});

test("an explicit request to switch to English still overrides earlier Chinese", () => {
  const reply = ai.getFallbackReply([
    { role: "user", content: "我想做厨房柜" },
    { role: "assistant", content: "可以，你的预算大概多少？" },
    { role: "user", content: "Please reply in English" },
  ]);
  assert.match(reply, /^Sure,|I can|Yes,/i);
});

test("numeric answer after a budget question is stored in renovation lead memory", () => {
  const leadSession = session("budget");
  addCustomer(leadSession, "我想做厨房柜，新 condo 在 Puchong。");
  state.addAssistantMessage(leadSession, "收到。你的预算大概多少？");
  addCustomer(leadSession, "4500");

  assert.equal(leadSession.lead.budget, "RM4,500");
  assert.ok(leadSession.lead.interests.includes("Kitchen Cabinets"));
  assert.equal(leadSession.lead.propertyType, "Condo / apartment");
  assert.equal(leadSession.lead.preferredBranch, "Cheras / Kajang / Puchong");
  assert.match(leadSession.lead.summary, /RM4,500/);
});

test("a number after a measurement question is not misclassified as budget", () => {
  const leadSession = session("measurement");
  addCustomer(leadSession, "我想做厨房柜，新 condo 在 Puchong。");
  state.addAssistantMessage(leadSession, "厨房大概多长？如果方便可以给我尺寸。 ");
  addCustomer(leadSession, "4500");

  assert.equal(leadSession.lead.budget, null);
});

test("budget acknowledgement plus a measurement question does not overwrite the stored budget", () => {
  const leadSession = session("budget-then-measurement");
  addCustomer(leadSession, "我想做厨房柜，新 condo 在 Puchong。");
  state.addAssistantMessage(leadSession, "收到。你的预算大概多少？");
  addCustomer(leadSession, "4500");
  assert.equal(leadSession.lead.budget, "RM4,500");

  state.addAssistantMessage(leadSession, "收到，我先记下预算大概 RM4,500。你有大概尺寸或 floor plan 吗？");
  addCustomer(leadSession, "3000");

  assert.equal(leadSession.lead.budget, "RM4,500");
});

test("fallback does not mistake a measurement answer for another budget just because the previous reply mentions budget", () => {
  const reply = ai.getFallbackReply([
    { role: "user", content: "我想做厨房柜，新 condo 在 Puchong。" },
    { role: "assistant", content: "你的预算大概多少？" },
    { role: "user", content: "4500" },
    { role: "assistant", content: "收到，我先记下预算大概 RM4,500。你有大概尺寸或 floor plan 吗？" },
    { role: "user", content: "3000" },
  ]);

  assert.doesNotMatch(reply, /RM3,000/);
  assert.match(reply, /[一-鿿]/);
});
