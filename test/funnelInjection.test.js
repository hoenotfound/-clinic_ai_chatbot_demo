const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { enhanceIndex } = require("../scripts/build-netlify");

const ROOT = path.join(__dirname, "..");

test("Netlify enhanced demo loads funnel telemetry before app.js", () => {
  const source = fs.readFileSync(path.join(ROOT, "public", "index.html"), "utf8");
  const html = enhanceIndex(source);
  const funnelIndex = html.indexOf("funnel-telemetry.js");
  const appIndex = html.indexOf("app.js");
  assert.ok(funnelIndex >= 0, "funnel telemetry script should be injected");
  assert.ok(appIndex > funnelIndex, "funnel telemetry must load before app.js so fetch calls are observed");
  assert.match(html, /base href="\/ai-chatbot\/"/);
});