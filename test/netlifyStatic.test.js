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

  assert.match(html, /id="backendStatusLabel">STARTING LIVE AI RECEPTIONIST/);
  assert.match(html, /src="\.\/backend-readiness\.js"/);
  assert.match(html, /src="\.\/dashboard\/inbox"/);
  assert.match(html, /href="\.\/cold-start\.css"/);
  assert.doesNotMatch(html, /\b(?:href|src)="\/(?!\/)/);

  const redirects = fs.readFileSync(path.join(outputRoot, "_redirects"), "utf8");
  assert.match(redirects, /\/ai-chatbot\/dashboard\/\* \/ai-chatbot\/dashboard\/index\.html 200/);
});

test("Netlify deployment config publishes only the generated static bundle", () => {
  const config = fs.readFileSync(path.join(ROOT, "netlify.toml"), "utf8");
  assert.match(config, /publish = "netlify-dist"/);
  assert.match(config, /directory = "netlify\/functions"/);
  assert.doesNotMatch(config, /onrender\.com/);
});
