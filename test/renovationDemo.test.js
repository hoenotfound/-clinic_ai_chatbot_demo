const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DEMO_INDUSTRY = "renovation";
process.env.AI_PROVIDER = "mock";
process.env.SALES_CTA_LABEL = "Set up my clinic";

const industry = require("../src/industryProfile");
const clinicConfig = require("../src/clinicConfig");
const ai = require("../src/aiService");
const state = require("../src/demoState");
const { detectBudget } = require("../src/renovationLeadState");

function session(suffix) {
  return state.createSession({ channel: "whatsapp", ip: `renovation-test-${Date.now()}-${suffix}` });
}

function add(sessionState, message) {
  sessionState.lastCustomerMessageAt = 0;
  state.addCustomerMessage(sessionState, message);
}

test("renovation is selected as a first-class profile without mutating clinic configuration", () => {
  assert.equal(industry.key, "renovation");
  assert.equal(industry.config.businessName, "Oakline Demo Renovation & Carpentry");
  assert.ok(industry.config.services.some((service) => service.name === "Kitchen Cabinets"));
  assert.equal(industry.salesCtaDefault, "Set up my renovation chatbot");
  assert.equal(process.env.SALES_CTA_LABEL, "Set up my renovation chatbot");
  assert.match(clinicConfig.clinicName, /Nova Demo Aesthetic Clinic/i);
  assert.notEqual(clinicConfig.industryKey, "renovation");
});

test("renovation prompt focuses on carpentry qualification instead of medical behaviour", () => {
  const prompt = industry.buildSystemPrompt({ isFirstMessage: true });
  assert.match(prompt, /Kitchen Cabinets/);
  assert.match(prompt, /site measurement/i);
  assert.match(prompt, /budget/i);
  assert.doesNotMatch(prompt, /aesthetic-clinic front-desk/i);
  assert.doesNotMatch(prompt, /clinician decides diagnosis/i);
});

test("Gemini and Claude provider prompt stays renovation-specific", () => {
  const prompt = ai._test.enhancedSystemPrompt(true);
  assert.match(prompt, /STRUCTURED RENOVATION SALES KNOWLEDGE/i);
  assert.match(prompt, /DETERMINISTIC RENOVATION HANDOFF RULES/i);
  assert.doesNotMatch(prompt, /CONCERN-TO-TREATMENT/i);
  assert.doesNotMatch(prompt, /diagnosis/i);
  assert.doesNotMatch(prompt, /clinician/i);

  const geminiBody = ai._test.buildGeminiRequest(
    [{ role: "user", content: "Kitchen cabinet how much?" }],
    true,
    "gemini-2.5-flash"
  );
  const geminiPrompt = geminiBody.systemInstruction.parts.map((part) => part.text).join("\n");
  assert.match(geminiPrompt, /RENOVATION SALES KNOWLEDGE/i);
  assert.doesNotMatch(geminiPrompt, /clinician|diagnosis|CONCERN-TO-TREATMENT/i);
});

test("deterministic fallback gives renovation pricing and asks a useful next question", () => {
  const reply = ai.getFallbackReply([{ role: "user", content: "Kitchen cabinet how much?" }]);
  assert.match(reply, /RM 6,800/i);
  assert.match(reply, /condo|landed/i);
});

test("deterministic fallback remembers service context when the latest question is vague", () => {
  const reply = ai.getFallbackReply([
    { role: "user", content: "New condo in Puchong, I need kitchen cabinet around 12ft." },
    { role: "assistant", content: "Noted." },
    { role: "user", content: "How about the price?" },
  ]);
  assert.match(reply, /Kitchen Cabinets/i);
  assert.match(reply, /RM 6,800/i);
  assert.doesNotMatch(reply, /which area are you planning first/i);
});

test("mentioning an existing designer does not falsely trigger human handoff", () => {
  const reply = ai.getFallbackReply([
    { role: "user", content: "My designer asked me to compare kitchen cabinet price first." },
  ]);
  assert.doesNotMatch(reply, /\[\[HANDOFF\]\]/);
});

test("explicit request for a designer hands off without pretending it is a quotation request", () => {
  const leadSession = session("human-request");
  add(leadSession, "I want kitchen cabinets in Puchong. Can I speak to a designer?");
  assert.equal(leadSession.lead.humanRequest, true);
  assert.equal(leadSession.lead.quotationIntent, false);
  assert.equal(leadSession.lead.siteMeasurementIntent, false);
  assert.equal(leadSession.lead.bookingIntent, false);
  assert.equal(leadSession.lead.temperature, "hot");

  const reply = ai.getFallbackReply([{ role: "user", content: "Can I speak to a designer?" }]);
  assert.match(reply, /\[\[HANDOFF\]\]/);
});

test("site measurement intent is tracked separately and never invents availability", () => {
  const reply = ai.getFallbackReply([
    { role: "user", content: "I am in Puchong, can you come measure my house this Saturday?" },
  ]);
  assert.match(reply, /\[\[HANDOFF\]\]/);
  assert.doesNotMatch(reply, /confirmed|booked/i);

  const leadSession = session("site-intent");
  add(leadSession, "Kitchen cabinet in Puchong. Can your team come for site measurement Saturday morning?");
  assert.equal(leadSession.lead.siteMeasurementIntent, true);
  assert.equal(leadSession.lead.quotationIntent, false);
  assert.equal(leadSession.lead.bookingIntent, true);
});

test("proper quotation intent is distinct from site measurement", () => {
  const leadSession = session("quote-intent");
  add(leadSession, "New condo in Cheras. Kitchen 12ft, budget RM15k. Can you prepare a proper quotation?");
  assert.equal(leadSession.lead.quotationIntent, true);
  assert.equal(leadSession.lead.siteMeasurementIntent, false);
  assert.equal(leadSession.lead.bookingIntent, true);
  assert.equal(leadSession.lead.temperature, "hot");
});

test("technical renovation questions are escalated and marked separately", () => {
  const reply = ai.getFallbackReply([
    { role: "user", content: "Can I hack this load bearing wall and move the electrical point?" },
  ]);
  assert.match(reply, /\[\[HANDOFF\]\]/);

  const leadSession = session("technical");
  add(leadSession, "Can I hack this load bearing wall and move the electrical point?");
  assert.equal(leadSession.lead.technicalHandoff, true);
  assert.equal(leadSession.lead.quotationIntent, false);
  assert.equal(leadSession.lead.siteMeasurementIntent, false);
});

test("existing session lead detection recognizes renovation services", () => {
  const leadSession = session("service");
  add(leadSession, "I want kitchen cabinet, how much?");
  assert.ok(leadSession.lead.interests.includes("Kitchen Cabinets"));
  assert.equal(leadSession.lead.temperature, "warm");
});

test("budget extraction ignores nearby cabinet measurements", () => {
  assert.equal(detectBudget("Kitchen cabinet around 12ft. Budget RM10k."), "RM10,000");
});

test("live renovation lead separates property type from property status", () => {
  const leadSession = session("qualify");
  add(leadSession, "New condo in Puchong, kitchen cabinet around 12ft. Budget RM10k.");
  assert.ok(leadSession.lead.interests.includes("Kitchen Cabinets"));
  assert.equal(leadSession.lead.propertyType, "Condo / apartment");
  assert.equal(leadSession.lead.propertyStatus, "New project");
  assert.equal(leadSession.lead.preferredBranch, "Cheras / Kajang / Puchong");
  assert.equal(leadSession.lead.budget, "RM10,000");
  assert.equal(leadSession.lead.measurementsKnown, true);
  assert.equal(leadSession.lead.temperature, "hot");
});

test("site measurement request becomes a high-intent live lead with remembered details", () => {
  const leadSession = state.createSession({ channel: "instagram", ip: `renovation-test-${Date.now()}-site-details` });
  add(leadSession, "I want wardrobe for my condo in PJ");
  add(leadSession, "Budget around 8k. Can your team come for site measurement Saturday morning?");
  assert.equal(leadSession.lead.siteMeasurementIntent, true);
  assert.equal(leadSession.lead.bookingIntent, true);
  assert.equal(leadSession.lead.temperature, "hot");
  assert.equal(leadSession.lead.preferredBranch, "Petaling Jaya / Subang / Shah Alam");
  assert.equal(leadSession.lead.budget, "RM8,000");
  assert.match(leadSession.lead.summary, /site measurement/i);
});
