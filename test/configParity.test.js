const test = require("node:test");
const assert = require("node:assert/strict");

const clinic = require("../src/clinicConfig");
const { buildSystemPrompt } = require("../src/systemPrompt");

const PRODUCTION_CONFIG_KEYS = [
  "clinicName",
  "aiAssistantName",
  "branches",
  "hours",
  "contact",
  "introMessage",
  "automatedFollowUp",
  "leadScoring",
  "promotions",
  "services",
  "serviceAliases",
  "faqs",
  "closingPlaybook",
  "tone",
  "messagingStyle",
  "sop",
  "escalation",
  "guardrails",
];

test("demo clinic config mirrors the production chatbot config schema", () => {
  for (const key of PRODUCTION_CONFIG_KEYS) {
    assert.ok(Object.prototype.hasOwnProperty.call(clinic, key), `missing config key: ${key}`);
  }

  assert.equal(clinic.clinicName, "Nova Demo Aesthetic Clinic");
  assert.equal(clinic.aiAssistantName, "Avery");
  assert.equal(clinic.assistantName, clinic.aiAssistantName);
  assert.ok(Array.isArray(clinic.services) && clinic.services.length >= 4);
  assert.ok(Array.isArray(clinic.guardrails) && clinic.guardrails.length >= 10);
  assert.ok(Array.isArray(clinic.escalation.outOfScopeTriggers));
  assert.ok(clinic.messagingStyle.includes("LENGTH:"));
  assert.ok(clinic.closingPlaybook.includes("GENERAL APPROACH:"));
  assert.ok(clinic.sop.includes("MEDICAL QUESTIONS:"));
});

test("production-style prompt consumes the configurable behaviour sections", () => {
  const prompt = buildSystemPrompt({ isFirstMessage: true });

  assert.match(prompt, /Nova Demo Aesthetic Clinic/);
  assert.match(prompt, /WRITING STYLE/);
  assert.match(prompt, /STANDARD OPERATING PROCEDURES/);
  assert.match(prompt, /CONSULTATION \/ CONVERSION GUIDANCE/);
  assert.match(prompt, /CONFIGURED HUMAN-HANDOFF CONDITIONS/);
  assert.match(prompt, /COMMON TERMS VISITORS USE/);
  assert.match(prompt, /NON-NEGOTIABLE RULES/);
  assert.match(prompt, /\[\[HANDOFF\]\]/);
  assert.match(prompt, /first reply/i);
});

test("aesthetic clinic prompt prioritizes realistic and intelligent front-desk behaviour", () => {
  const prompt = buildSystemPrompt({ isFirstMessage: false });

  assert.match(prompt, /Understand what the visitor is actually asking and answer that first/i);
  assert.match(prompt, /Never ask again for a concern, treatment, branch, timing preference/i);
  assert.match(prompt, /give the price immediately/i);
  assert.match(prompt, /Identify EVERY clear question or request/i);
  assert.match(prompt, /Answer all clear parts of a multi-part message/i);
  assert.match(prompt, /SILENT CONVERSATION MEMORY/i);
  assert.match(prompt, /newest explicit correction wins/i);
  assert.match(prompt, /INTENT-AWARE CONVERSION BEHAVIOUR/i);
  assert.match(prompt, /OBJECTION HANDLING/i);
  assert.match(prompt, /BOOKING FLOW:/);
  assert.match(prompt, /GENERAL TREATMENT INFORMATION VS MEDICAL HANDOFF:/);
  assert.match(prompt, /does not automatically require a handoff/i);
  assert.match(prompt, /do NOT repeat that disclaimer in normal service, pricing, promotion, branch, consultation or FAQ answers/i);
  assert.match(prompt, /Use normal "you\/your" by default/i);
  assert.match(prompt, /commercially intelligent, medically cautious/i);
});

test("public demo config remains fictional and does not copy the supplied real clinic identity", () => {
  const serialized = JSON.stringify(clinic);
  assert.doesNotMatch(serialized, /Beleco Clinic/i);
  assert.doesNotMatch(serialized, /belecoclinic/i);
  assert.doesNotMatch(serialized, /\+6011-679\s*1463/i);
  assert.doesNotMatch(serialized, /Jalan Radin Bagus/i);
  assert.match(serialized, /fictional|demo/i);
});
