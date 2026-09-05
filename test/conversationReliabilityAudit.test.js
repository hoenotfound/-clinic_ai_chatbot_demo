const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { languageSignal, establishedConversationLanguage } = require("../src/conversationLanguage");
const { runWithConversationContext } = require("../src/aiMemoryContext");
const industry = require("../src/industryProfile");
const { updateRenovationLead, detectBudget, detectPropertyType, detectArea } = require("../src/renovationLeadState");
const abuse = require("../src/abuseProtection");

function message(role, content) {
  return { role, content };
}

test("language detection treats shorthand as neutral but recognises clear language switches", () => {
  assert.equal(languageSignal("PJ"), null);
  assert.equal(languageSignal("RM4500"), null);
  assert.equal(languageSignal("Saturday"), null);
  assert.equal(languageSignal("HIFU"), null);
  assert.equal(languageSignal("Please reply in English"), "en");
  assert.equal(languageSignal("可以用中文吗"), "zh");
  assert.equal(languageSignal("boleh saya datang sabtu"), "ms");
});

test("clinic fallback keeps Chinese and Bahasa Malaysia across neutral short replies", () => {
  const chinese = industry.runWithIndustry("clinic", () => industry.buildFallbackReply([
    message("user", "我想做 HIFU"),
    message("assistant", "可以，你比较方便哪个 branch？"),
    message("user", "PJ"),
  ]));
  assert.match(chinese, /[\p{Script=Han}]/u);
  assert.match(chinese, /Petaling Jaya|PJ/i);

  const malay = industry.runWithIndustry("clinic", () => industry.buildFallbackReply([
    message("user", "saya nak buat HIFU"),
    message("assistant", "Branch mana lebih convenient untuk you?"),
    message("user", "PJ"),
  ]));
  assert.match(malay, /Boleh|branch mana|Okay|you/i);

  const englishSwitch = industry.runWithIndustry("clinic", () => industry.buildFallbackReply([
    message("user", "我想做 HIFU"),
    message("assistant", "可以，你比较方便哪个 branch？"),
    message("user", "Please reply in English"),
  ]));
  assert.match(englishSwitch, /Tell me|What would|Sure|Which|English|treatment/i);
});

test("booking-rule replies also inherit established Chinese for neutral timing answers", () => {
  const reply = industry.runWithIndustry("clinic", () => industry.enforceBookingRules([
    message("user", "我想预约 HIFU"),
    message("assistant", "你想什么时候来？"),
    message("user", "8pm"),
  ]));
  assert.match(reply, /[\p{Script=Han}]/u);
  assert.match(reply, /10:00 AM|7:00 PM/);
});

test("renovation lead corrections use the newest explicit value", () => {
  const session = {
    messages: [
      message("user", "我想做厨房柜，new landed in Puchong，预算 RM10k"),
      message("assistant", "收到。"),
      message("user", "其实是 condo，地点改 PJ，预算改成 RM15k"),
    ],
    lead: {},
  };
  const lead = updateRenovationLead(session);
  assert.equal(lead.propertyType, "Condo / apartment");
  assert.equal(lead.preferredBranch, "Petaling Jaya / Subang / Shah Alam");
  assert.equal(lead.budget, "RM15,000");
});

test("same-message corrections and measurements do not corrupt renovation budget/property memory", () => {
  assert.equal(detectPropertyType("不是 landed，是 condo"), "Condo / apartment");
  assert.equal(detectPropertyType("landed, sorry condo, actually landed"), "Landed house");
  assert.equal(detectArea("Puchong, actually PJ, sorry Puchong"), "Cheras / Kajang / Puchong");
  assert.equal(detectBudget("budget RM10k, kitchen size 3000mm"), "RM10,000");
});

test("structured memory retains corrected renovation facts beyond the AI history window", () => {
  const messages = [
    message("user", "我想做厨房柜，new landed in Puchong，预算 RM10k"),
    message("assistant", "收到。"),
    message("user", "其实是 condo，地点改 PJ，预算改成 RM15k"),
  ];
  for (let index = 0; index < 20; index += 1) {
    messages.push(message(index % 2 === 0 ? "assistant" : "user", index % 2 === 0 ? "好的" : "ok"));
  }

  const memory = industry.runWithIndustry("renovation", () => abuse.buildConversationMemory(messages));
  assert.match(memory, /Simplified Chinese/);
  assert.match(memory, /Condo \/ apartment/);
  assert.match(memory, /Petaling Jaya \/ Subang \/ Shah Alam/);
  assert.match(memory, /RM15,000/);

  const prompt = industry.runWithIndustry("renovation", () => runWithConversationContext(
    { fullMessages: messages, memory },
    () => industry.buildSystemPrompt({ isFirstMessage: false })
  ));
  assert.match(prompt, /SILENT STRUCTURED CONVERSATION MEMORY/);
  assert.match(prompt, /RM15,000/);
});

test("same-session message work is serialized while different sessions can proceed independently", async () => {
  abuse.resetForTests();
  const order = [];
  let releaseFirst;
  const gate = new Promise((resolve) => { releaseFirst = resolve; });

  const first = abuse.serializeSessionRequest("session-a", async () => {
    order.push("a1-start");
    await gate;
    order.push("a1-end");
  });
  const second = abuse.serializeSessionRequest("session-a", async () => {
    order.push("a2");
  });
  const other = abuse.serializeSessionRequest("session-b", async () => {
    order.push("b1");
  });

  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(order, ["a1-start", "b1"]);
  releaseFirst();
  await Promise.all([first, second, other]);
  assert.deepEqual(order, ["a1-start", "b1", "a1-end", "a2"]);
});

test("cold-start script contains an industry-aware renovation assistant status", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "public", "backend-readiness.js"), "utf8");
  assert.match(source, /AI RENOVATION ASSISTANT/);
  assert.match(source, /selectedIndustry/);
});

test("neutral replies inherit the last established language from the full conversation", () => {
  assert.equal(establishedConversationLanguage([
    message("user", "我想了解厨房柜"),
    message("assistant", "预算多少？"),
    message("user", "4500"),
  ]), "zh");
});