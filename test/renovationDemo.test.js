const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DEMO_INDUSTRY = "renovation";
process.env.AI_PROVIDER = "mock";

require("../src/industryDemoPreload");

const config = require("../src/clinicConfig");
const { buildSystemPrompt } = require("../src/systemPrompt");
const ai = require("../src/aiService");
const state = require("../src/demoState");

test("renovation mode swaps the public business configuration without changing clinic default code", () => {
  assert.equal(config.industryKey, "renovation");
  assert.equal(config.clinicName, "Oakline Demo Renovation & Carpentry");
  assert.ok(config.services.some((service) => service.name === "Kitchen Cabinets"));
  assert.equal(process.env.SALES_CTA_LABEL, "Set up my renovation chatbot");
});

test("renovation prompt focuses on carpentry qualification instead of medical behaviour", () => {
  const prompt = buildSystemPrompt({ isFirstMessage: true });
  assert.match(prompt, /Kitchen Cabinets/);
  assert.match(prompt, /site measurement/i);
  assert.match(prompt, /budget/i);
  assert.doesNotMatch(prompt, /aesthetic-clinic front-desk/i);
  assert.doesNotMatch(prompt, /clinician decides diagnosis/i);
});

test("deterministic fallback gives renovation pricing and asks a useful next question", () => {
  const reply = ai.getFallbackReply([
    { role: "user", content: "Kitchen cabinet how much?" },
  ]);
  assert.match(reply, /RM 6,800/i);
  assert.match(reply, /condo|landed/i);
});

test("site measurement intent hands the lead to staff rather than inventing availability", () => {
  const reply = ai.getFallbackReply([
    { role: "user", content: "I am in Puchong, can you come measure my house this Saturday?" },
  ]);
  assert.match(reply, /\[\[HANDOFF\]\]/);
  assert.doesNotMatch(reply, /confirmed|booked/i);
});

test("technical renovation questions are escalated", () => {
  const reply = ai.getFallbackReply([
    { role: "user", content: "Can I hack this load bearing wall and move the electrical point?" },
  ]);
  assert.match(reply, /\[\[HANDOFF\]\]/);
});

test("existing session lead detection recognizes renovation services", () => {
  const session = state.createSession({ channel: "whatsapp", ip: `renovation-test-${Date.now()}-service` });
  state.addCustomerMessage(session, "I want kitchen cabinet, how much?");
  assert.ok(session.lead.interests.includes("Kitchen Cabinets"));
  assert.equal(session.lead.temperature, "warm");
});

test("live renovation lead remembers project, property, area and budget", () => {
  const session = state.createSession({ channel: "whatsapp", ip: `renovation-test-${Date.now()}-qualify` });
  state.addCustomerMessage(session, "New condo in Puchong, kitchen cabinet around 12ft. Budget RM10k.");
  assert.ok(session.lead.interests.includes("Kitchen Cabinets"));
  assert.equal(session.lead.propertyType, "New project");
  assert.equal(session.lead.preferredBranch, "Cheras / Kajang / Puchong");
  assert.equal(session.lead.budget, "RM10,000");
  assert.equal(session.lead.measurementsKnown, true);
  assert.equal(session.lead.temperature, "hot");
});

test("site measurement request becomes high-intent live lead", () => {
  const session = state.createSession({ channel: "instagram", ip: `renovation-test-${Date.now()}-site` });
  state.addCustomerMessage(session, "I want wardrobe for my condo in PJ");
  session.lastCustomerMessageAt = 0;
  state.addCustomerMessage(session, "Budget around 8k. Can your team come for site measurement Saturday morning?");
  assert.equal(session.lead.bookingIntent, true);
  assert.equal(session.lead.temperature, "hot");
  assert.equal(session.lead.preferredBranch, "Petaling Jaya / Subang / Shah Alam");
  assert.match(session.lead.summary, /site measurement|staff follow-up/i);
});
