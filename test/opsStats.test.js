const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

async function waitForServer(url) {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw lastError || new Error("Demo test server did not start.");
}

function basic(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

async function json(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  return { response, data: await response.json() };
}

test("private operations dashboard tracks public demo interactions", async (t) => {
  const port = 34000 + (process.pid % 1000);
  const base = `http://127.0.0.1:${port}`;
  const username = "ops-admin";
  const password = "test-password-123";
  const authorization = basic(username, password);
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "production",
      AI_PROVIDER: "mock",
      REDIS_URL: "",
      DEMO_OPS_USERNAME: username,
      DEMO_OPS_PASSWORD: password,
      DEMO_STATS_TIMEZONE: "Asia/Kuala_Lumpur",
      DEMO_MAX_SESSIONS_PER_IP_DAY: "99",
      DEMO_MAX_TOTAL_MESSAGES_PER_DAY: "99",
      DEMO_MIN_MESSAGE_INTERVAL_MS: "1",
      DEMO_MAX_TOTAL_MESSAGES_PER_SESSION: "20",
      DEMO_MAX_STAFF_MESSAGES_PER_SESSION: "5",
      DEMO_MIN_STAFF_MESSAGE_INTERVAL_MS: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => child.kill("SIGTERM"));

  await waitForServer(`${base}/health`);

  const unauthenticated = await fetch(`${base}/ops`);
  assert.equal(unauthenticated.status, 401);
  assert.match(unauthenticated.headers.get("www-authenticate") || "", /Demo Operations/);

  const dashboard = await fetch(`${base}/ops`, { headers: { authorization } });
  assert.equal(dashboard.status, 200);
  assert.match(await dashboard.text(), /Demo Operations/);

  const telemetry = await json(`${base}/api/telemetry`, {
    method: "POST",
    body: JSON.stringify({
      visitorId: "visitor-test-123456",
      event: "patient_view",
      surface: "patient",
    }),
  });
  assert.equal(telemetry.response.status, 202);

  const created = await json(`${base}/api/demo/sessions`, {
    method: "POST",
    body: JSON.stringify({ channel: "whatsapp" }),
  });
  assert.equal(created.response.status, 201);
  const id = created.data.session.id;

  const channel = await json(`${base}/api/demo/sessions/${encodeURIComponent(id)}/channel`, {
    method: "POST",
    body: JSON.stringify({ channel: "instagram" }),
  });
  assert.equal(channel.response.status, 200);

  const mode = await json(`${base}/api/demo/sessions/${encodeURIComponent(id)}/mode`, {
    method: "POST",
    body: JSON.stringify({ mode: "human" }),
  });
  assert.equal(mode.response.status, 200);

  const staff = await json(`${base}/api/demo/sessions/${encodeURIComponent(id)}/staff-message`, {
    method: "POST",
    body: JSON.stringify({ message: "Hello from staff" }),
  });
  assert.equal(staff.response.status, 200);

  const customer = await json(`${base}/api/demo/sessions/${encodeURIComponent(id)}/message`, {
    method: "POST",
    body: JSON.stringify({ message: "Thank you" }),
  });
  assert.equal(customer.response.status, 200);

  const stats = await json(`${base}/api/ops/stats`, {
    headers: { authorization },
  });
  assert.equal(stats.response.status, 200);
  assert.equal(stats.data.storage, "memory");
  assert.equal(stats.data.visitors.uniqueToday, 1);
  assert.equal(stats.data.counters.patient_view, 1);
  assert.equal(stats.data.counters.sessions_started, 1);
  assert.equal(stats.data.counters.channel_switches, 1);
  assert.equal(stats.data.counters.human_takeovers, 1);
  assert.equal(stats.data.counters.staff_messages, 1);
  assert.equal(stats.data.counters.customer_messages, 1);
  assert.equal(stats.data.gemini.attempts, 0);
  assert.equal(stats.data.gemini.tokens.total, 0);
});
