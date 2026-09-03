const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

test("ops history persistence uses Neon without storing the raw browser visitor id", () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  delete require.cache[require.resolve("../src/opsNeonStore")];
  const store = require("../src/opsNeonStore");
  const visitorId = "visitor-test-12345678";
  const hash = store._test.visitorHash(visitorId);

  assert.equal(store.enabled, false);
  assert.notEqual(hash, visitorId);
  assert.equal(hash.length, 40);
  assert.match(hash, /^[a-f0-9]+$/);
  assert.equal(store._test.normalizeSurface("dashboard"), "dashboard");
  assert.equal(store._test.normalizeSurface("anything"), "patient");

  if (previous === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previous;
});

test("Render and Node startup wire durable ops history behind DATABASE_URL", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "package-lock.json"), "utf8"));
  const render = fs.readFileSync(path.join(ROOT, "render.yaml"), "utf8");
  const envExample = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
  const preload = fs.readFileSync(path.join(ROOT, "src", "opsPersistencePreload.js"), "utf8");
  const store = fs.readFileSync(path.join(ROOT, "src", "opsNeonStore.js"), "utf8");

  assert.equal(packageJson.dependencies["@neondatabase/serverless"], "^1.1.0");
  assert.equal(lock.packages["node_modules/@neondatabase/serverless"].version, "1.1.0");
  assert.match(packageJson.scripts.start, /opsPersistencePreload\.js/);
  assert.match(packageJson.scripts.dev, /opsPersistencePreload\.js/);
  assert.match(render, /- key: DATABASE_URL\n\s+sync: false/);
  assert.match(envExample, /DATABASE_URL=/);
  assert.match(preload, /store\.recordVisitor/);
  assert.match(preload, /store\.incrementCounters/);
  assert.match(preload, /store\.readHistory/);
  assert.match(store, /CREATE TABLE IF NOT EXISTS demo_ops_counters/);
  assert.match(store, /CREATE TABLE IF NOT EXISTS demo_ops_visitors/);
  assert.match(store, /CREATE TABLE IF NOT EXISTS demo_ops_gemini_keys/);
});
