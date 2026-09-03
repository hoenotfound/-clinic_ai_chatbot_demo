const test = require("node:test");
const assert = require("node:assert/strict");

const previousRedis = process.env.REDIS_URL;
process.env.REDIS_URL = "";
delete require.cache[require.resolve("../src/sharedState")];
delete require.cache[require.resolve("../src/opsStats")];
const opsStats = require("../src/opsStats");

test.after(() => {
  if (previousRedis === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = previousRedis;
});

test("historical ops data keeps daily visitor, engagement and Gemini trends", async () => {
  opsStats.recordVisitor({ visitorId: "visitor-history-0001", event: "patient_view", surface: "patient" });
  opsStats.recordVisitor({ visitorId: "visitor-history-0001", event: "dashboard_view", surface: "dashboard" });
  opsStats.recordVisitor({ visitorId: "visitor-history-0002", event: "patient_view", surface: "patient" });
  opsStats.recordVisitor({ visitorId: "visitor-history-0002", event: "sales_cta_clicks", surface: "patient" });
  opsStats.recordCounter("sessions_started");
  opsStats.recordCounter("customer_messages", 2);
  opsStats.recordGeminiAttempt({ keyIndex: 1, model: "gemini-2.5-flash" });
  opsStats.recordGeminiSuccess({
    keyIndex: 1,
    model: "gemini-2.5-flash",
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
  });

  const snapshot = await opsStats.getSnapshot();
  const today = snapshot.history.daily.at(-1);
  const sevenDays = snapshot.history.ranges["7"];

  assert.equal(snapshot.history.retentionDays, 400);
  assert.equal(snapshot.history.daily.length, 90);
  assert.equal(today.day, snapshot.day);
  assert.equal(today.visitors, 2);
  assert.equal(today.patientVisitors, 2);
  assert.equal(today.dashboardVisitors, 1);
  assert.equal(today.ctaVisitors, 1);
  assert.equal(today.sessions, 1);
  assert.equal(today.messages, 2);
  assert.equal(today.totalTokens, 15);
  assert.equal(today.aiSuccessRate, 100);
  assert.equal(sevenDays.visitors, 2);
  assert.equal(sevenDays.dashboardVisitors, 1);
  assert.equal(sevenDays.ctaVisitors, 1);
  assert.equal(sevenDays.dashboardRate, 50);
  assert.equal(sevenDays.ctaRate, 50);
  assert.equal(sevenDays.messagesPerVisitor, 1);
});
