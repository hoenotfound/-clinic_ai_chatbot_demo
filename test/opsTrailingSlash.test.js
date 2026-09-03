const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

async function waitForServer(url) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Demo test server did not start.");
}

function basic(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

test("private ops page works with a trailing slash", async (t) => {
  const port = 35000 + (process.pid % 1000);
  const base = `http://127.0.0.1:${port}`;
  const authorization = basic("ops-admin", "test-password-123");
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "production",
      AI_PROVIDER: "mock",
      REDIS_URL: "",
      DEMO_OPS_USERNAME: "ops-admin",
      DEMO_OPS_PASSWORD: "test-password-123",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => child.kill("SIGTERM"));

  await waitForServer(`${base}/health`);
  const page = await fetch(`${base}/ops/`, { headers: { authorization } });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Demo Operations/);

  const css = await fetch(`${base}/ops/ops.css`);
  assert.equal(css.status, 200);
  assert.match(css.headers.get("content-type") || "", /text\/css/);

  const script = await fetch(`${base}/ops/ops.js`);
  assert.equal(script.status, 200);
  assert.match(script.headers.get("content-type") || "", /javascript/);
  assert.match(await script.text(), /document\.createElement\("base"\)/);
});
