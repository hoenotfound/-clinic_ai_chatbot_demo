const test = require("node:test");
const assert = require("node:assert/strict");
const { enforceTcmSafetyRules } = require("../src/tcmSafetyRules");

test("Chinese existing-medication plus herbal question routes to practitioner", () => {
  const reply = enforceTcmSafetyRules([{ role: "user", content: "我在吃药，可以配这个中药吗？" }]);
  assert.match(reply || "", /中医师|团队/);
  assert.match(reply || "", /\[\[HANDOFF\]\]/);
});

test("Chinese herbal service enquiry alone stays in front-desk flow", () => {
  const reply = enforceTcmSafetyRules([{ role: "user", content: "请问你们有中药调理吗？" }]);
  assert.equal(reply, null);
});
