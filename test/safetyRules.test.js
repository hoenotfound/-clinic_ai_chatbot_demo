const test = require("node:test");
const assert = require("node:assert/strict");
const { enforceSafetyRules } = require("../src/safetyRules");
const ai = require("../src/aiService");

test("pregnancy and medication suitability are handed off deterministically", () => {
  for (const text of [
    "I'm pregnant, can I do HIFU?",
    "I'm taking antibiotics and want to know if Pico is okay for me",
  ]) {
    const reply = enforceSafetyRules([{ role: "user", content: text }]);
    assert.match(reply, /\[\[HANDOFF\]\]/);
  }
});

test("photo assessment and post-treatment questions cannot fall into concern sales replies", () => {
  const photo = enforceSafetyRules([{ role: "user", content: "Can you check my photo and recommend what to do for pigmentation?" }]);
  assert.match(photo, /\[\[HANDOFF\]\]/);

  const aftercare = enforceSafetyRules([{ role: "user", content: "After my Pico treatment my face is red, is this normal?" }]);
  assert.match(aftercare, /\[\[HANDOFF\]\]/);
});

test("urgent symptoms tell the visitor to seek medical care and hand off", () => {
  const reply = enforceSafetyRules([{ role: "user", content: "I have difficulty breathing after treatment" }]);
  assert.match(reply, /urgent medical attention|medical care/i);
  assert.match(reply, /\[\[HANDOFF\]\]/);
});

test("generic side-effect questions are still allowed through to normal clinic information", () => {
  const reply = enforceSafetyRules([{ role: "user", content: "Does HIFU have side effects?" }]);
  assert.equal(reply, null);
});

test("ambiguous can-I-do wording distinguishes suitability from appointment scheduling", () => {
  assert.match(
    enforceSafetyRules([{ role: "user", content: "Can I do HIFU?" }]),
    /\[\[HANDOFF\]\]/
  );
  assert.equal(
    enforceSafetyRules([{ role: "user", content: "Can I do HIFU Saturday at PJ?" }]),
    null
  );
  assert.equal(
    enforceSafetyRules([{ role: "user", content: "Boleh saya buat HIFU Sabtu dekat PJ?" }]),
    null
  );
});

test("contraindications still override scheduling cues", () => {
  const reply = enforceSafetyRules([{ role: "user", content: "I'm pregnant, can I do HIFU Saturday at PJ?" }]);
  assert.match(reply, /\[\[HANDOFF\]\]/);
});

test("the public AI entry point applies deterministic safety before any provider reply", async () => {
  const reply = await ai.getReply([{ role: "user", content: "Can you assess my selfie and tell me if Pico is suitable?" }], true);
  assert.match(reply, /\[\[HANDOFF\]\]/);
});
