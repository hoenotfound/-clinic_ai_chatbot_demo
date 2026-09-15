const test = require("node:test");
const assert = require("node:assert/strict");
const { enforceTcmSafetyRules } = require("../src/tcmSafetyContext");

test("Chinese existing-medication plus herbal question routes to practitioner", () => {
  const reply = enforceTcmSafetyRules([{ role: "user", content: "我在吃药，可以配这个中药吗？" }]);
  assert.match(reply || "", /中医师|团队/);
  assert.match(reply || "", /\[\[HANDOFF\]\]/);
});

test("Chinese herbal service enquiry alone stays in front-desk flow", () => {
  const reply = enforceTcmSafetyRules([{ role: "user", content: "请问你们有中药调理吗？" }]);
  assert.equal(reply, null);
});

test("Malay ubat herba service enquiry does not look like a medicine interaction", () => {
  const reply = enforceTcmSafetyRules([{ role: "user", content: "Ada ubat herba? Harga berapa?" }]);
  assert.equal(reply, null);
});

test("Malay existing medication plus herbs still routes to practitioner", () => {
  const reply = enforceTcmSafetyRules([{ role: "user", content: "Saya tengah makan ubat darah tinggi. Boleh ambil herba sekali?" }]);
  assert.match(reply || "", /pengamal TCM|team/i);
  assert.match(reply || "", /\[\[HANDOFF\]\]/);
});

test("Malay herbal service wording cannot suppress a higher-priority safety handoff", () => {
  const reply = enforceTcmSafetyRules([{ role: "user", content: "Saya sesak nafas, ada ubat herba?" }]);
  assert.match(reply || "", /segera|perubatan|rawatan/i);
  assert.match(reply || "", /\[\[HANDOFF\]\]/);
});

test("Malay request to speak with TCM practitioner routes to human takeover", () => {
  const reply = enforceTcmSafetyRules([{ role: "user", content: "Boleh saya cakap dengan pengamal TCM?" }]);
  assert.match(reply || "", /team TCM/i);
  assert.match(reply || "", /\[\[HANDOFF\]\]/);
});

test("practitioner consultation price question stays in front-desk flow", () => {
  const reply = enforceTcmSafetyRules([{ role: "user", content: "How much is the practitioner consultation?" }]);
  assert.equal(reply, null);
});

test("Chinese practitioner consultation price question stays in front-desk flow", () => {
  const reply = enforceTcmSafetyRules([{ role: "user", content: "中医师咨询多少钱？" }]);
  assert.equal(reply, null);
});
