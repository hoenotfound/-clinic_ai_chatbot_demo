const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { pathToFileURL } = require("url");

const ROOT = path.join(__dirname, "..");

function classList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    contains: (name) => values.has(name),
  };
}

function makeReadinessHarness(fetchImpl) {
  const listeners = new Map();
  const retryButton = {
    id: "",
    type: "button",
    className: "",
    textContent: "",
    hidden: true,
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
  };
  const statusParent = { appendChild() {} };
  const statusLabel = { textContent: "", parentElement: statusParent };
  const statusDot = { classList: classList() };
  const channelStatus = { textContent: "" };
  const elements = {
    backendStatusLabel: statusLabel,
    backendStatusDot: statusDot,
    channelStatusText: channelStatus,
    backendRetryButton: retryButton,
  };

  const document = {
    getElementById(id) {
      return elements[id] || null;
    },
    querySelectorAll() {
      return [];
    },
    createElement(tag) {
      assert.equal(tag, "button");
      return retryButton;
    },
  };

  const window = {
    location: { origin: "https://dasmarketingsolution.com" },
    fetch: fetchImpl,
  };

  const context = vm.createContext({
    window,
    document,
    URL,
    Response,
    AbortController,
    console,
    setTimeout(fn, ms) {
      if (ms === 22000) return { timeout: true };
      queueMicrotask(fn);
      return { sleep: true };
    },
    clearTimeout() {},
    queueMicrotask,
  });

  const source = fs.readFileSync(path.join(ROOT, "public", "backend-readiness.js"), "utf8");
  vm.runInContext(source, context, { filename: "backend-readiness.js" });

  return {
    window,
    statusLabel,
    statusDot,
    channelStatus,
    retryButton,
    clickRetry() {
      listeners.get("click")?.();
    },
  };
}

async function flushMicrotasks(rounds = 10) {
  for (let i = 0; i < rounds; i += 1) await Promise.resolve();
}

async function waitFor(predicate, message, maxTurns = 50) {
  for (let i = 0; i < maxTurns; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail(message);
}

test("cold-start readiness rejects a 200 HTML response before accepting valid config JSON", async () => {
  let calls = 0;
  const validConfig = {
    clinicName: "Nova Demo Aesthetic Clinic",
    services: [{ id: "hifu", name: "HIFU" }],
    limits: { maxMessages: 30 },
  };
  const harness = makeReadinessHarness(async () => {
    calls += 1;
    if (calls === 1) {
      return new Response("<!doctype html><title>wrong route</title>", {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return Response.json(validConfig);
  });

  const response = await harness.window.fetch("/ai-chatbot/api/demo/config");
  assert.equal(calls, 2);
  assert.deepEqual(await response.json(), validConfig);
  assert.equal(harness.statusLabel.textContent, "AI RECEPTIONIST ONLINE");
  assert.equal(harness.channelStatus.textContent, "online");
  assert.equal(harness.statusDot.classList.contains("backend-ready"), true);
  assert.equal(harness.retryButton.hidden, true);
});

test("cold-start readiness stops after five failed attempts and resumes only after Retry AI", async () => {
  let calls = 0;
  let healthy = false;
  const harness = makeReadinessHarness(async () => {
    calls += 1;
    if (!healthy) return Response.json({ error: "waking" }, { status: 503 });
    return Response.json({
      clinicName: "Nova Demo Aesthetic Clinic",
      services: [{ id: "hifu", name: "HIFU" }],
      limits: { maxMessages: 30 },
    });
  });

  const pending = harness.window.fetch("/ai-chatbot/api/demo/config");
  await waitFor(
    () => harness.statusLabel.textContent === "AI IS TEMPORARILY UNAVAILABLE — EXPLORE THE DASHBOARD",
    "readiness never entered the unavailable/manual-retry state"
  );

  assert.equal(calls, 5);
  assert.equal(harness.channelStatus.textContent, "temporarily unavailable");
  assert.equal(harness.statusDot.classList.contains("backend-unavailable"), true);
  assert.equal(harness.retryButton.hidden, false);

  await flushMicrotasks(20);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 5, "no background wake requests should continue while waiting for manual retry");

  healthy = true;
  harness.clickRetry();
  const response = await pending;
  assert.equal(calls, 6);
  assert.equal(response.ok, true);
  assert.equal(harness.statusLabel.textContent, "AI RECEPTIONIST ONLINE");
  assert.equal(harness.retryButton.hidden, true);
});

test("dashboard session polling collapses overlapping GETs into one network request", async () => {
  const originalWindow = global.window;
  const originalSessionStorage = global.sessionStorage;
  let calls = 0;
  let resolveFetch;

  try {
    global.sessionStorage = {
      getItem(key) {
        return key === "clinicDemoSessionId" ? "session-123" : null;
      },
    };
    global.window = {
      location: { pathname: "/ai-chatbot/dashboard/inbox" },
      fetch() {
        calls += 1;
        return new Promise((resolve) => {
          resolveFetch = resolve;
        });
      },
    };

    const moduleUrl = `${pathToFileURL(path.join(ROOT, "portal-react", "src", "basePath.js")).href}?test=${Date.now()}`;
    await import(moduleUrl);

    const first = global.window.fetch("/api/demo/sessions/session-123");
    const second = global.window.fetch("/api/demo/sessions/session-123");
    await flushMicrotasks();
    assert.equal(calls, 1);

    resolveFetch(Response.json({ session: { id: "session-123" } }));
    const [firstResponse, secondResponse] = await Promise.all([first, second]);
    assert.deepEqual(await firstResponse.json(), { session: { id: "session-123" } });
    assert.deepEqual(await secondResponse.json(), { session: { id: "session-123" } });

    const third = global.window.fetch("/api/demo/sessions/session-123");
    await flushMicrotasks();
    assert.equal(calls, 2, "a new poll should be allowed after the previous request has settled");
    resolveFetch(Response.json({ session: { id: "session-123" } }));
    await third;
  } finally {
    global.window = originalWindow;
    global.sessionStorage = originalSessionStorage;
  }
});
