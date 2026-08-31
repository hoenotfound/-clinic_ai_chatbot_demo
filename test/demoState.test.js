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

test("Bahasa Malaysia booking language is detected", () => {
  const session = state.createSession({ channel: "whatsapp", ip: "test-bm" });
  state.addCustomerMessage(session, "Berapa harga HIFU? Saya nak datang Sabtu di KL");
  assert.equal(session.lead.temperature, "hot");
  assert.equal(session.lead.bookingIntent, true);
  assert.equal(session.lead.preferredTiming, "Weekend");
  assert.equal(session.lead.preferredBranch, "Kuala Lumpur");
  assert.match(session.lead.interests.join(" "), /HIFU/);
});

test("Chinese booking language and treatment aliases are detected", () => {
  const session = state.createSession({ channel: "instagram", ip: "test-cn" });
  state.addCustomerMessage(session, "我想做皮秒，可以预约星期六在PJ吗？");
  assert.equal(session.lead.temperature, "hot");
  assert.equal(session.lead.bookingIntent, true);
  assert.equal(session.lead.preferredTiming, "Weekend");
  assert.equal(session.lead.preferredBranch, "Petaling Jaya");
  assert.match(session.lead.interests.join(" "), /Pico Laser/);
});

test("handoff marker is hidden and raises staff attention", () => {
  const session = state.createSession({ channel: "facebook", ip: "test-handoff" });
  state.addAssistantMessage(session, "I’ll get a team member to help. [[HANDOFF]]");
  assert.equal(session.needsAttention, true);
  assert.equal(session.messages[0].content.includes("HANDOFF"), false);
});

test("handoff is still detected when the marker appears after the visible text limit", () => {
  const session = state.createSession({ channel: "facebook", ip: "test-long-handoff" });
  state.addAssistantMessage(session, `${"x".repeat(2300)} [[HANDOFF]]`);
  assert.equal(session.needsAttention, true);
  assert.equal(session.messages[0].content.length, 2000);
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
  assert.match(session.lead.summary, /no longer interested/);
  await new Promise((resolve) => setTimeout(resolve, 2));
  state.addCustomerMessage(session, "One more question");
  assert.equal(session.lead.bookingIntent, false);
  assert.equal(session.lead.temperature, "cold");
});

test("clear renewed interest after a negative intent reactivates the lead", async () => {
  const session = state.createSession({ channel: "whatsapp", ip: "test-renewed" });
  state.addCustomerMessage(session, "I want HIFU but never mind, I am not interested anymore");
  assert.equal(session.lead.temperature, "cold");
  await new Promise((resolve) => setTimeout(resolve, 2));
  state.addCustomerMessage(session, "Actually how much is Pico?");
  assert.equal(session.lead.temperature, "warm");
  assert.equal(session.lead.bookingIntent, false);
  assert.deepEqual(session.lead.interests, ["Pico Laser"]);
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

test("promotion appears only after HIFU interest and only once", async () => {
  const session = state.createSession({ channel: "whatsapp", ip: "test-promo" });
  state.addCustomerMessage(session, "I have pigmentation. What can I do?");
  assert.equal(state.shouldShowPromotion(session), false);
  await new Promise((resolve) => setTimeout(resolve, 2));
  state.addCustomerMessage(session, "What about HIFU for my jawline?");
  assert.equal(state.shouldShowPromotion(session), true);
  const reply = state.addAssistantMessage(session, "HIFU may be relevant for that concern.");
  state.markPromotionShown(session, reply.id);
  assert.equal(state.shouldShowPromotion(session), false);
  assert.equal(session.promotionAfterMessageId, reply.id);
});

test("conversation summary is customer-friendly rather than a raw signal dump", () => {
  const session = state.createSession({ channel: "whatsapp", ip: "test-summary" });
  state.addCustomerMessage(session, "I want HIFU and I want to book Saturday in KL");
  assert.match(session.lead.summary, /Interested in HIFU Skin Lifting/);
  assert.match(session.lead.summary, /Strong booking intent/);
  assert.equal(session.lead.summary.includes("latest:"), false);
});

test("public session hides the internal numeric lead score", () => {
  const session = state.createSession({ channel: "facebook", ip: "test-public-lead" });
  state.addCustomerMessage(session, "How much is HIFU?");
  const publicView = state.publicSession(session);
  assert.equal(Object.hasOwn(publicView.lead, "score"), false);
});

test("active conversation extends the session expiry window", async () => {
  const session = state.createSession({ channel: "whatsapp", ip: "test-expiry" });
  const originalExpiry = session.expiresAt;
  await new Promise((resolve) => setTimeout(resolve, 2));
  state.addCustomerMessage(session, "Hi");
  assert.ok(session.expiresAt > originalExpiry);
});
