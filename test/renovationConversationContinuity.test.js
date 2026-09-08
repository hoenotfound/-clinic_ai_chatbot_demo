const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DEMO_INDUSTRY = "renovation";
process.env.AI_PROVIDER = "mock";

const industry = require("../src/industryProfile");
const ai = require("../src/aiService");
const state = require("../src/demoState");
const { detectBudget, detectServices } = require("../src/renovationLeadState");

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

test("renovation prompt keeps important config-driven FAQ, sales and guardrail knowledge", () => {
  const prompt = industry.buildSystemPrompt({ isFirstMessage: false });
  assert.match(prompt, /Can I customise the internal wardrobe layout/i);
  assert.match(prompt, /hanging sections, shelves, drawers/i);
  assert.match(prompt, /Never claim to have viewed a customer's photo, drawing or floor plan/i);
  assert.match(prompt, /Customer asks for an unconfigured service/i);
  assert.match(prompt, /Do not dismiss a lower budget/i);
  assert.match(prompt, /Customer: "4500"[\s\S]{0,160}什么时候完成/);
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

test("厨房 shorthand is recognized as kitchen cabinets by reply and lead memory", () => {
  assert.deepEqual(detectServices("厨房"), ["Kitchen Cabinets"]);
  assert.deepEqual(detectServices("想做厨房"), ["Kitchen Cabinets"]);
  assert.deepEqual(detectServices("kitchen"), ["Kitchen Cabinets"]);
  assert.deepEqual(detectServices("想了解 aliminium cabinet"), ["Kitchen Cabinets"]);

  const reply = ai.getFallbackReply([
    { role: "user", content: "你好 想了解 Aliminium Cabinet 厨" },
    { role: "assistant", content: "可以，我可以先帮你了解木工装修需求和大概报价方向。你主要想做厨房柜、衣柜、电视柜、鞋柜，还是全屋木工？" },
    { role: "user", content: "厨房" },
  ]);

  assert.match(reply, /厨房柜/);
  assert.match(reply, /condo|landed|commercial/i);
  assert.doesNotMatch(reply, /衣柜、电视柜、鞋柜|wardrobes.*TV\/living-room/i);
});

test("room words do not misclassify other renovation trades as cabinet leads", () => {
  assert.deepEqual(detectServices("Do you do kitchen tiles?"), []);
  assert.deepEqual(detectServices("Need kitchen flooring and painting"), []);
  assert.deepEqual(detectServices("厨房地砖"), []);
  assert.deepEqual(detectServices("想做厨房装修"), []);

  const leadSession = session("kitchen-tiles");
  addCustomer(leadSession, "Do you do kitchen tiles and flooring?");
  assert.equal(leadSession.lead.interests.includes("Kitchen Cabinets"), false);

  const reply = ai.getFallbackReply([{ role: "user", content: "Do you do kitchen tiles?" }]);
  assert.match(reply, /custom carpentry|cabinet/i);
  assert.match(reply, /\[\[HANDOFF\]\]/);
  assert.doesNotMatch(reply, /RM\s*6,800/i);
});

test("fallback acknowledges a repeated-detail complaint and advances instead of resetting", () => {
  const reply = ai.getFallbackReply([
    { role: "user", content: "你好 想了解 Aluminium Cabinet 厨房" },
    { role: "assistant", content: "你主要想做厨房柜、衣柜、电视柜、鞋柜，还是全屋木工？" },
    { role: "user", content: "厨房" },
    { role: "assistant", content: "你主要想做厨房柜、衣柜、电视柜、鞋柜，还是全屋木工？" },
    { role: "user", content: "我不是说了吗？" },
  ]);

  assert.match(reply, /已经说了|记住了|厨房柜/);
  assert.match(reply, /condo|landed|commercial|地区|尺寸|floor plan|预算/i);
  assert.doesNotMatch(reply, /你主要想做厨房柜、衣柜、电视柜、鞋柜，还是全屋木工/);
});

test("English frustration keeps the known kitchen context instead of restarting scope", () => {
  const reply = ai.getFallbackReply([
    { role: "user", content: "我想了解厨房柜" },
    { role: "assistant", content: "你主要想做厨房柜、衣柜、电视柜、鞋柜，还是全屋木工？" },
    { role: "user", content: "you want i repeat how many time?" },
  ]);

  assert.match(reply, /already said|Kitchen Cabinets|kitchen cabinet/i);
  assert.match(reply, /condo|landed|commercial|area|measurement|budget/i);
  assert.doesNotMatch(reply, /Are you looking at kitchen cabinets, wardrobes/i);
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
