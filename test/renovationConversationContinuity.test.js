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
  const messages = [
    { role: "user", content: "我想做厨房柜" },
    { role: "assistant", content: "可以。你的房子是 condo 还是 landed？" },
    { role: "user", content: "condo，在 Puchong" },
    { role: "assistant", content: "好的，你的预算大概多少？" },
    { role: "user", content: "4500" },
  ];

  const reply = ai.getFallbackReply(messages);
  assert.match(reply, /RM4,500/);
  assert.match(reply, /收到|预算|尺寸|floor plan/);
  assert.doesNotMatch(reply, /^Sure,/i);
  assert.doesNotMatch(reply, /Are you looking at kitchen cabinets/i);
  assert.doesNotMatch(reply, /condo, landed home, or commercial unit/i);
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
