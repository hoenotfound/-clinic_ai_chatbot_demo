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

async function json(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  return { response, data: await response.json() };
}

test("server hides provider details and rate-limits staff-message abuse", async (t) => {
  const port = 32000 + (process.pid % 1000);
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "production",
      AI_PROVIDER: "mock",
      DEMO_MAX_SESSIONS_PER_IP_DAY: "99",
      DEMO_MAX_TOTAL_MESSAGES_PER_DAY: "99",
      DEMO_MIN_MESSAGE_INTERVAL_MS: "1",
      DEMO_MAX_TOTAL_MESSAGES_PER_SESSION: "10",
      DEMO_MAX_STAFF_MESSAGES_PER_SESSION: "2",
      DEMO_MIN_STAFF_MESSAGE_INTERVAL_MS: "1",
      DEMO_MAX_CONCURRENT_AI_REQUESTS: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => child.kill("SIGTERM"));

  await waitForServer(`${base}/health`);

  const health = await json(`${base}/health`);
  assert.equal(health.response.status, 200);
  assert.equal(Object.hasOwn(health.data, "aiProvider"), false);

  const config = await json(`${base}/api/demo/config`);
  assert.equal(config.response.status, 200);
  assert.equal(Object.hasOwn(config.data, "aiProvider"), false);
  assert.equal(config.data.limits.maxStaffMessagesPerSession, 2);
  assert.equal(config.data.limits.maxTotalMessagesPerSession, 10);

  const created = await json(`${base}/api/demo/sessions`, {
    method: "POST",
    body: JSON.stringify({ channel: "whatsapp" }),
  });
  assert.equal(created.response.status, 201);
  const id = created.data.session.id;

  const mode = await json(`${base}/api/demo/sessions/${encodeURIComponent(id)}/mode`, {
    method: "POST",
    body: JSON.stringify({ mode: "human" }),
  });
  assert.equal(mode.response.status, 200);

  for (const message of ["First staff reply", "Second staff reply"]) {
    await new Promise((resolve) => setTimeout(resolve, 2));
    const sent = await json(`${base}/api/demo/sessions/${encodeURIComponent(id)}/staff-message`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    assert.equal(sent.response.status, 200);
  }

  await new Promise((resolve) => setTimeout(resolve, 2));
  const blocked = await json(`${base}/api/demo/sessions/${encodeURIComponent(id)}/staff-message`, {
    method: "POST",
    body: JSON.stringify({ message: "Third staff reply" }),
  });
  assert.equal(blocked.response.status, 429);
  assert.match(blocked.data.error, /staff replies per session/i);
});
