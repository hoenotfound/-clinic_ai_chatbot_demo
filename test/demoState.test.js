process.env.DEMO_MAX_SESSIONS_PER_IP_DAY = "99";
process.env.DEMO_MAX_TOTAL_MESSAGES_PER_DAY = "99";
process.env.DEMO_MIN_MESSAGE_INTERVAL_MS = "1";

const test = require("node:test");
const assert = require("node:assert/strict");
const state = require("../src/demoState");

test("creates isolated demo sessions", () => {
  const a = state.createSession({ channel: "whatsapp", ip: "test-a" });
  const b = state.createSession({ channel: "instagram", ip: "test-b" });
  assert.notEqual(a.id, b.id);
  assert.equal(a.channel, "whatsapp");
  assert.equal(b.channel, "instagram");
  assert.equal(a.messages.length, 0);
  assert.equal(b.messages.length, 0);
});

test("booking language moves a lead to hot", () => {
  const session = state.createSession({ channel: "whatsapp", ip: "test-hot" });
  state.addCustomerMessage(session, "How much is HIFU? I want to book this Saturday in KL");
  assert.equal(session.lead.temperature, "hot");
  assert.equal(session.lead.bookingIntent, true);
  assert.equal(session.lead.preferredBranch, "Kuala Lumpur");
  assert.match(session.lead.interests.join(" "), /HIFU/);
});

test("handoff marker is hidden and raises staff attention", () => {
  const session = state.createSession({ channel: "facebook", ip: "test-handoff" });
  state.addAssistantMessage(session, "I’ll get a team member to help. [[HANDOFF]]");
  assert.equal(session.needsAttention, true);
  assert.equal(session.messages[0].content.includes("HANDOFF"), false);
});

test("staff reply switches the conversation to human mode", () => {
  const session = state.createSession({ channel: "instagram", ip: "test-staff" });
  state.addStaffMessage(session, "Hi, I’m Sarah from the clinic. How can I help?");
  assert.equal(session.mode, "human");
  assert.equal(session.messages[0].source, "staff");
});

test("latest timing preference replaces an older one", async () => {
  const session = state.createSession({ channel: "whatsapp", ip: "test-timing" });
  state.addCustomerMessage(session, "I want Saturday in KL");
  await new Promise((resolve) => setTimeout(resolve, 2));
  state.addCustomerMessage(session, "Actually weekday in PJ please");
  assert.equal(session.lead.preferredTiming, "Weekday");
  assert.equal(session.lead.preferredBranch, "Petaling Jaya");
});

test("latest negative intent clears booking intent and downgrades the lead", async () => {
  const session = state.createSession({ channel: "whatsapp", ip: "test-negative" });
  state.addCustomerMessage(session, "How much is HIFU? I want to book Saturday in KL");
  await new Promise((resolve) => setTimeout(resolve, 2));
  state.addCustomerMessage(session, "Never mind, I am not interested anymore");
  assert.equal(session.lead.bookingIntent, false);
  assert.equal(session.lead.temperature, "cold");
  assert.match(session.lead.summary, /reduced interest/);
  await new Promise((resolve) => setTimeout(resolve, 2));
  state.addCustomerMessage(session, "One more question");
  assert.equal(session.lead.bookingIntent, false);
  assert.equal(session.lead.temperature, "cold");
});

test("returning ownership to AI clears stale attention state", async () => {
  const session = state.createSession({ channel: "instagram", ip: "test-return-ai" });
  state.setMode(session, "human");
  state.addCustomerMessage(session, "Afternoon please");
  assert.equal(session.needsAttention, true);
  state.setMode(session, "ai");
  assert.equal(session.needsAttention, false);
  assert.equal(session.attentionReason, null);
});
