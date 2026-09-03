const test = require("node:test");
const assert = require("node:assert/strict");

const previousRedis = process.env.REDIS_URL;
const previousSlow = process.env.DEMO_SLOW_RESPONSE_MS;
process.env.REDIS_URL = "";
process.env.DEMO_SLOW_RESPONSE_MS = "4000";

delete require.cache[require.resolve("../src/sharedState")];
delete require.cache[require.resolve("../src/opsStats")];
const opsStats = require("../src/opsStats");

test.after(() => {
  if (previousRedis === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = previousRedis;
  if (previousSlow === undefined) delete process.env.DEMO_SLOW_RESPONSE_MS;
  else process.env.DEMO_SLOW_RESPONSE_MS = previousSlow;
});

test("funnel stages are deduplicated by visitor across the selected period", async () => {
  const visitorA = "visitor-funnel-a-12345";
  const visitorB = "visitor-funnel-b-12345";
  const visitorC = "visitor-funnel-c-12345";

  for (const event of [
    "patient_view",
    "demo_started",
    "message_1",
    "message_3",
    "dashboard_view",
    "human_takeover",
    "journey_complete",
    "sales_cta_clicks",
  ]) {
    opsStats.recordVisitor({ visitorId: visitorA, event, surface: event.includes("dashboard") ? "dashboard" : "patient" });
  }

  // Repeat events from the same browser should not increase unique funnel stages.
  opsStats.recordVisitor({ visitorId: visitorA, event: "message_1", surface: "patient" });
  opsStats.recordVisitor({ visitorId: visitorA, event: "sales_cta_clicks", surface: "dashboard" });

  for (const event of ["patient_view", "demo_started", "message_1", "dashboard_view"]) {
    opsStats.recordVisitor({ visitorId: visitorB, event, surface: event === "dashboard_view" ? "dashboard" : "patient" });
  }
  opsStats.recordVisitor({ visitorId: visitorC, event: "patient_view", surface: "patient" });

  const snapshot = await opsStats.getSnapshot();
  assert.equal(snapshot.visitors.uniqueToday, 3);
  assert.equal(snapshot.funnel.demoStarted, 2);
  assert.equal(snapshot.funnel.message1, 2);
  assert.equal(snapshot.funnel.message3, 1);
  assert.equal(snapshot.funnel.dashboard, 2);
  assert.equal(snapshot.funnel.takeover, 1);
  assert.equal(snapshot.funnel.completed, 1);
  assert.equal(snapshot.funnel.cta, 1);

  const range = snapshot.history.ranges["7"];
  assert.equal(range.visitors, 3);
  assert.equal(range.funnel.demoStarted, 2);
  assert.equal(range.funnel.cta, 1);
  assert.ok(range.funnel.stages.every((stage) => Number.isFinite(stage.rate)));
});

test("response latency exposes average P50 P95 and slow-response counters", async () => {
  for (const duration of [100, 600, 2200, 7000]) {
    opsStats.recordLatency("ai_response", duration);
  }
  for (const duration of [200, 900, 1800]) {
    opsStats.recordLatency("gemini_request", duration);
  }
  opsStats.recordCounter("gemini_retries", 2);
  opsStats.recordCounter("gemini_key_failovers", 1);
  opsStats.recordCounter("gemini_fallback_model_uses", 1);
  opsStats.recordCounter("demo_busy_errors", 1);

  const snapshot = await opsStats.getSnapshot();
  assert.equal(snapshot.performance.aiResponse.count, 4);
  assert.equal(snapshot.performance.aiResponse.avgMs, 2475);
  assert.equal(snapshot.performance.aiResponse.p50Ms, 750);
  assert.equal(snapshot.performance.aiResponse.p95Ms, 8000);
  assert.equal(snapshot.performance.slowResponses, 1);
  assert.equal(snapshot.performance.geminiRequest.count, 3);
  assert.equal(snapshot.performance.retries, 2);
  assert.equal(snapshot.performance.keyFailovers, 1);
  assert.equal(snapshot.performance.fallbackModelUses, 1);
  assert.equal(snapshot.performance.busyErrors, 1);

  const range = snapshot.history.ranges["7"];
  assert.equal(range.aiResponseP50Ms, 750);
  assert.equal(range.aiResponseP95Ms, 8000);
  assert.equal(range.retries, 2);
  assert.equal(range.keyFailovers, 1);
});

test("Gemini errors are classified for the reliability dashboard", () => {
  assert.equal(opsStats._test.geminiErrorType({ statusCode: 429, apiStatus: "RESOURCE_EXHAUSTED" }), "quota");
  assert.equal(opsStats._test.geminiErrorType({ statusCode: 408, code: "AI_REQUEST_TIMEOUT" }), "timeout");
  assert.equal(opsStats._test.geminiErrorType({ statusCode: 503 }), "server");
  assert.equal(opsStats._test.geminiErrorType({ statusCode: 400 }), "client");
  assert.equal(opsStats._test.geminiErrorType({ statusCode: 502, message: "Gemini returned an empty response." }), "empty");
  assert.equal(opsStats._test.geminiErrorType(new Error("socket closed")), "other");
});