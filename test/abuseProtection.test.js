const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
delete process.env.REDIS_URL;

const protection = require("../src/abuseProtection");

function sendRequest(port, { path: requestPath, ip = "203.0.113.20" } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port,
      path: requestPath,
      method: "POST",
      headers: {
        "x-forwarded-for": ip,
        "content-type": "application/json",
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    req.on("error", reject);
    req.end("{}");
  });
}

test("AI history cap keeps only recent messages inside both message and character budgets", async () => {
  const ai = require("../src/aiService");
  const original = ai.getReply;
  let received = null;
  ai.getReply = async (messages) => {
    received = messages;
    return "ok";
  };

  protection.installAbuseProtection();

  const history = Array.from({ length: 20 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    content: `${String(index).padStart(2, "0")}:` + "x".repeat(997),
  }));
  await ai.getReply(history, false);

  assert.ok(received.length <= 16);
  assert.ok(received.reduce((sum, message) => sum + message.content.length, 0) <= 12000);
  assert.equal(received.at(-1).content, history.at(-1).content);
  assert.ok(Number(received[0].content.slice(0, 2)) >= 8, "old conversation history should be discarded first");

  ai.getReply = original;
});

test("message matcher protects both direct Render and mounted /ai-chatbot API paths only", () => {
  const request = (method, url) => ({ method, url });
  assert.equal(protection.isCustomerMessageRequest(request("POST", "/api/demo/sessions/abc/message")), true);
  assert.equal(protection.isCustomerMessageRequest(request("POST", "/ai-chatbot/api/demo/sessions/abc/message")), true);
  assert.equal(protection.isCustomerMessageRequest(request("GET", "/api/demo/sessions/abc/message")), false);
  assert.equal(protection.isCustomerMessageRequest(request("POST", "/api/demo/sessions/abc/staff-message")), false);
  assert.equal(protection.isCustomerMessageRequest(request("POST", "/api/demo/sessions")), false);
});

test("per-IP burst limiter allows 10 messages in a minute and rejects the 11th", async () => {
  protection.resetForTests();
  const now = Date.UTC(2026, 8, 2, 2, 0, 0);
  for (let index = 0; index < 10; index += 1) {
    await protection.enforceIpMessageLimits("198.51.100.10", now);
  }
  await assert.rejects(
    protection.enforceIpMessageLimits("198.51.100.10", now),
    (error) => error?.statusCode === 429 && /too quickly/i.test(error.message)
  );
  await protection.enforceIpMessageLimits("198.51.100.11", now);
});

test("per-IP daily limiter allows 60 messages across separate minutes and rejects the 61st", async () => {
  protection.resetForTests();
  const start = Date.UTC(2026, 8, 2, 0, 0, 0);
  for (let index = 0; index < 60; index += 1) {
    await protection.enforceIpMessageLimits("192.0.2.44", start + index * 61000);
  }
  await assert.rejects(
    protection.enforceIpMessageLimits("192.0.2.44", start + 60 * 61000),
    (error) => error?.statusCode === 429 && /today/i.test(error.message)
  );
});

test("HTTP preload guard blocks the 11th rapid customer-message request before the app listener", async () => {
  protection.resetForTests();
  let appCalls = 0;
  const server = http.createServer((req, res) => {
    appCalls += 1;
    res.writeHead(204);
    res.end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  try {
    for (let index = 0; index < 10; index += 1) {
      const response = await sendRequest(port, { path: "/api/demo/sessions/session-123/message" });
      assert.equal(response.status, 204);
    }
    const blocked = await sendRequest(port, { path: "/api/demo/sessions/session-123/message" });
    assert.equal(blocked.status, 429);
    assert.match(blocked.body, /too quickly/i);
    assert.equal(appCalls, 10, "blocked request must not reach the application handler");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Render startup and config include the abuse-protection defaults", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const renderYaml = fs.readFileSync(path.join(ROOT, "render.yaml"), "utf8");

  assert.match(packageJson.scripts.start, /abuseProtectionPreload\.js/);
  assert.match(packageJson.scripts.dev, /abuseProtectionPreload\.js/);
  assert.match(renderYaml, /DEMO_MAX_MESSAGES_PER_IP_MINUTE\n\s+value: 10/);
  assert.match(renderYaml, /DEMO_MAX_MESSAGES_PER_IP_DAY\n\s+value: 60/);
  assert.match(renderYaml, /DEMO_AI_HISTORY_MAX_MESSAGES\n\s+value: 16/);
  assert.match(renderYaml, /DEMO_AI_HISTORY_MAX_CHARS\n\s+value: 12000/);
});
