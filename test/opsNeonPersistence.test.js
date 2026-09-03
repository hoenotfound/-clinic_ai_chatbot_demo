const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const Module = require("module");

const ROOT = path.join(__dirname, "..");
const STORE_PATH = require.resolve("../src/opsNeonStore");

async function withMockedNeon(fakeSql, work) {
  const originalLoad = Module._load;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === "@neondatabase/serverless") return { neon: () => fakeSql };
    return originalLoad.call(this, request, parent, isMain);
  };
  process.env.DATABASE_URL = "postgresql://test:test@example.invalid/demo";
  delete require.cache[STORE_PATH];

  try {
    const store = require("../src/opsNeonStore");
    return await work(store);
  } finally {
    delete require.cache[STORE_PATH];
    Module._load = originalLoad;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
}

test("ops history persistence uses Neon without storing the raw browser visitor id", () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  delete require.cache[STORE_PATH];
  const store = require("../src/opsNeonStore");
  const visitorId = "visitor-test-12345678";
  const hash = store._test.visitorHash(visitorId);

  assert.equal(store.enabled, false);
  assert.notEqual(hash, visitorId);
  assert.equal(hash.length, 40);
  assert.match(hash, /^[a-f0-9]+$/);
  assert.equal(store._test.normalizeSurface("dashboard"), "dashboard");
  assert.equal(store._test.normalizeSurface("anything"), "patient");

  delete require.cache[STORE_PATH];
  if (previous === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previous;
});

test("enabled Neon visitor persistence is parameterized and deduplicates repeat heartbeats", async () => {
  const calls = [];
  const fakeSql = async (strings, ...values) => {
    calls.push({ text: strings.join("?"), values });
    return [];
  };

  await withMockedNeon(fakeSql, async (store) => {
    const visitorId = "visitor-neon-test-12345678";
    const day = "2026-09-03";
    const first = await store.recordVisitor({ day, visitorId, event: "heartbeat", surface: "patient", now: 1000 });
    assert.equal(first, true);
    assert.equal(store.enabled, true);

    const callsAfterFirst = calls.length;
    const second = await store.recordVisitor({ day, visitorId, event: "heartbeat", surface: "patient", now: 2000 });
    assert.equal(second, true);
    assert.equal(calls.length, callsAfterFirst, "repeat heartbeat should not create another Neon write for the same surface/day");

    const allValues = calls.flatMap((call) => call.values.map(String));
    assert.equal(allValues.includes(visitorId), false, "raw browser visitor id must never be sent to Neon");
    assert.equal(allValues.includes(store._test.visitorHash(visitorId)), true, "hashed visitor identity should be persisted");
    assert.equal(calls.some((call) => /INSERT INTO demo_ops_visitors/.test(call.text)), true);
  });
});

test("a transient first Neon failure remains retryable", async () => {
  let calls = 0;
  const fakeSql = async () => {
    calls += 1;
    if (calls === 1) throw new Error("temporary database failure");
    return [];
  };

  await withMockedNeon(fakeSql, async (store) => {
    const payload = {
      day: "2026-09-03",
      visitorId: "visitor-retry-test-12345678",
      event: "heartbeat",
      surface: "patient",
      now: 1000,
    };
    assert.equal(await store.recordVisitor(payload), false);
    const callsAfterFailure = calls;
    assert.equal(await store.recordVisitor({ ...payload, now: 2000 }), true);
    assert.ok(calls > callsAfterFailure, "second attempt must retry the database rather than being suppressed as already seen");
  });
});

test("Render and Node startup wire durable ops history behind DATABASE_URL", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "package-lock.json"), "utf8"));
  const render = fs.readFileSync(path.join(ROOT, "render.yaml"), "utf8");
  const envExample = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
  const loadEnv = fs.readFileSync(path.join(ROOT, "src", "loadEnv.js"), "utf8");
  const preload = fs.readFileSync(path.join(ROOT, "src", "opsPersistencePreload.js"), "utf8");
  const store = fs.readFileSync(path.join(ROOT, "src", "opsNeonStore.js"), "utf8");

  assert.equal(packageJson.dependencies["@neondatabase/serverless"], "^1.1.0");
  assert.equal(lock.packages["node_modules/@neondatabase/serverless"].version, "1.1.0");
  assert.match(packageJson.scripts.start, /^node -r \.\/src\/loadEnv\.js .*opsPersistencePreload\.js/);
  assert.match(packageJson.scripts.dev, /^node --watch -r \.\/src\/loadEnv\.js .*opsPersistencePreload\.js/);
  assert.match(render, /- key: DATABASE_URL\n\s+sync: false/);
  assert.match(envExample, /DATABASE_URL=/);
  assert.match(loadEnv, /if \(!\(key in process\.env\)\) process\.env\[key\] = value/);
  assert.match(preload, /store\.recordVisitor/);
  assert.match(preload, /store\.incrementCounters/);
  assert.match(preload, /store\.readHistory/);
  assert.match(store, /CREATE TABLE IF NOT EXISTS demo_ops_counters/);
  assert.match(store, /CREATE TABLE IF NOT EXISTS demo_ops_visitors/);
  assert.match(store, /CREATE TABLE IF NOT EXISTS demo_ops_gemini_keys/);
});
