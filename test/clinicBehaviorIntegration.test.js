const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ai = require("../src/aiService");
const industryProfile = require("../src/industryProfile");
const { buildConcernFallback } = require("../src/concernFallback");

test("AI prompt includes structured concern mappings and deterministic opening days", () => {
  const prompt = ai._test.enhancedSystemPrompt(false);
  assert.match(prompt, /STRUCTURED CONCERN-TO-TREATMENT KNOWLEDGE/);
  assert.match(prompt, /double chin \/ jawline definition -> HIFU Skin Lifting/);
  assert.match(prompt, /wide jaw \/ jaw slimming -> Botulinum Toxin \/ HIFU Skin Lifting/);
  assert.match(prompt, /Closed days: Sunday/);
});

test("deterministic fallback uses the structured mappings for concern-only messages", () => {
  assert.match(buildConcernFallback([{ role: "user", content: "My skin is very dry and dull" }]), /Skin Booster/);
  const wideJaw = buildConcernFallback([{ role: "user", content: "I have a wide jaw" }]);
  assert.match(wideJaw, /Botulinum Toxin/);
  assert.match(wideJaw, /HIFU Skin Lifting/);
});

test("concern fallback defers pregnancy and medication messages to safety handling", () => {
  assert.equal(buildConcernFallback([{ role: "user", content: "I'm pregnant and my skin is dry" }]), null);
  assert.equal(buildConcernFallback([{ role: "user", content: "I'm on medication and have pigmentation" }]), null);
});

test("patient demo sources acquisition presets from the active industry profile", () => {
  const publicScript = fs.readFileSync(path.join(__dirname, "..", "public", "channel-experience.js"), "utf8");
  const dashboardBar = fs.readFileSync(path.join(__dirname, "..", "portal-react", "src", "components", "LiveAcquisitionBar.jsx"), "utf8");

  assert.equal(industryProfile.key, "clinic");
  assert.equal(industryProfile.acquisitionPresets["hifu-facebook"].label, "HIFU Facebook Ad");
  assert.equal(industryProfile.acquisitionPresets["hifu-facebook"].campaign, "HIFU Jawline Demo Campaign");
  assert.equal(industryProfile.acquisitionPresets["pico-instagram"].label, "Pico Instagram Ad");

  assert.match(publicScript, /demoConfig\.acquisitionPresets/);
  assert.match(publicScript, /clinicDemoAcquisition/);
  assert.match(dashboardBar, /Source/);
  assert.match(dashboardBar, /Campaign/);
  assert.match(dashboardBar, /Ad treatment/);
});
