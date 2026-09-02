const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { buildNetlifyBundle } = require("../scripts/build-netlify");

const ROOT = path.join(__dirname, "..");

test("Netlify build packages the demo and dashboard under /ai-chatbot", () => {
  const { outputRoot, mountDir } = buildNetlifyBundle();
  const html = fs.readFileSync(path.join(mountDir, "index.html"), "utf8");

  assert.ok(fs.existsSync(path.join(mountDir, "dashboard", "index.html")));
  assert.ok(fs.existsSync(path.join(mountDir, "backend-readiness.js")));
  assert.ok(fs.existsSync(path.join(mountDir, "cold-start.css")));

  assert.match(html, /<base href="\/ai-chatbot\/" \/>/);
  assert.match(html, /id="backendStatusLabel">STARTING LIVE AI RECEPTIONIST/);
  assert.match(html, /src="\.\/backend-readiness\.js"/);
  assert.match(html, /src="\.\/dashboard\/inbox"/);
  assert.match(html, /href="\.\/cold-start\.css"/);

  const htmlWithoutBase = html.replace('<base href="/ai-chatbot/" />', "");
  assert.doesNotMatch(htmlWithoutBase, /\b(?:href|src)="\/(?!\/)/);

  const redirects = fs.readFileSync(path.join(outputRoot, "_redirects"), "utf8");
  assert.match(redirects, /\/ai-chatbot\/dashboard\/\* \/ai-chatbot\/dashboard\/index\.html 200/);
});

test("Netlify deployment config publishes only the generated static bundle", () => {
  const config = fs.readFileSync(path.join(ROOT, "netlify.toml"), "utf8");
  assert.match(config, /publish = "netlify-dist"/);
  assert.match(config, /directory = "netlify\/functions"/);
  assert.doesNotMatch(config, /onrender\.com/);
});

test("cold-start readiness backs off, validates config JSON and stops for manual retry", () => {
  const readiness = fs.readFileSync(path.join(ROOT, "public", "backend-readiness.js"), "utf8");
  const styles = fs.readFileSync(path.join(ROOT, "public", "cold-start.css"), "utf8");

  assert.match(readiness, /RETRY_DELAYS_MS = \[1800, 3000, 5000, 10000\]/);
  assert.match(readiness, /MAX_AUTOMATIC_ATTEMPTS = 5/);
  assert.match(readiness, /AI IS TEMPORARILY UNAVAILABLE — EXPLORE THE DASHBOARD/);
  assert.match(readiness, /backendRetryButton/);
  assert.match(readiness, /content-type/);
  assert.match(readiness, /application\/json/);
  assert.match(readiness, /typeof payload\?\.clinicName === "string"/);
  assert.match(readiness, /Array\.isArray\(payload\?\.services\)/);
  assert.match(readiness, /Number\.isFinite\(Number\(payload\.limits\.maxMessages\)\)/);
  assert.match(readiness, /waitForManualRetry/);
  assert.match(styles, /\.status-dot\.backend-unavailable/);
  assert.match(styles, /\.backend-retry-button/);
});

test("dashboard live-session polling shares one in-flight GET request", () => {
  const basePath = fs.readFileSync(path.join(ROOT, "portal-react", "src", "basePath.js"), "utf8");

  assert.match(basePath, /const inFlightSessionGets = new Map\(\)/);
  assert.match(basePath, /requestMethod\(requestInput, init\) === "GET"/);
  assert.match(basePath, /isExactSessionRead\(url, base\)/);
  assert.match(basePath, /inFlightSessionGets\.get\(url\)/);
  assert.match(basePath, /inFlightSessionGets\.set\(url, pending\)/);
  assert.match(basePath, /inFlightSessionGets\.delete\(url\)/);
  assert.match(basePath, /\(await pending\)\.clone\(\)/);
});
