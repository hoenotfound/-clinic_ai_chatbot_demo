const test = require("node:test");
const assert = require("node:assert/strict");

process.env.AI_PROVIDER = "mock";
process.env.DEMO_INDUSTRY = "clinic";

const tcm = require("../src/tcmConfig");
const { buildTcmSystemPrompt } = require("../src/tcmSystemPrompt");
const { serviceForText } = require("../src/tcmBookingIntent");
const { detectConcernMappings } = require("../src/tcmKnowledge");
const { enforceTcmSafetyRules } = require("../src/tcmSafetyContext");
const industry = require("../src/industryProfile");
const ai = require("../src/aiService");

function tcmFallback(content) {
  return industry.runWithIndustry("tcm", () => ai.getFallbackReply([{ role: "user", content }]));
}

test("TCM profile recognises pelvic posture and 3D facial service terms", () => {
  const pelvicTerms = ["盆骨", "骨盆trt", "骨盆前倾", "posture adjustment"];
  for (const term of pelvicTerms) {
    assert.equal(serviceForText(term)?.name, "Pelvic & Posture Manual Adjustment", term);
  }

  const facialTerms = ["小颜术", "3D小颜术", "大小脸", "9D逆龄抗衰"];
  for (const term of facialTerms) {
    assert.equal(serviceForText(term)?.name, "3D Facial Contour Manual Adjustment", term);
  }
});

test("TCM concern knowledge maps posture and facial concerns without diagnosing", () => {
  const posture = detectConcernMappings("久坐以后小腹凸，感觉骨盆前倾");
  assert.ok(posture.some((item) => item.services?.includes("Pelvic & Posture Manual Adjustment")));

  const facial = detectConcernMappings("我有大小脸，下颚线也很模糊");
  assert.ok(facial.some((item) => item.services?.includes("3D Facial Contour Manual Adjustment")));
});

test("TCM system prompt contains supplied service knowledge but not the source shop name", () => {
  const prompt = buildTcmSystemPrompt();
  assert.match(prompt, /KKM-certified TCM practitioner/i);
  assert.match(prompt, /25\+ years/i);
  assert.match(prompt, /1,000\+ posture adjustment cases/i);
  assert.match(prompt, /骨盆前倾/);
  assert.match(prompt, /3D小颜术|3D 小颜术/);
  assert.match(prompt, /habitual one-sided chewing/i);
  assert.match(prompt, /9D/);
  assert.match(prompt, /one overall adjustment\/service price/i);
  assert.match(prompt, /postpartum customers/i);
  assert.match(prompt, /results vary/i);
  assert.doesNotMatch(prompt, /Neutro\s+Sense/i);
  assert.doesNotMatch(JSON.stringify(tcm), /Neutro\s+Sense/i);
});

test("pelvic posture fallback explains assessment and manual approach in Chinese", () => {
  const reply = tcmFallback("骨盆trt是什么？");
  assert.match(reply, /1对1/);
  assert.match(reply, /徒手/);
  assert.match(reply, /骨盆/);
  assert.doesNotMatch(reply, /This service starts|manual techniques/i);
  assert.doesNotMatch(reply, /Neutro\s+Sense/i);
});

test("3D facial fallback explains manual adjustment and optional 9D in Chinese", () => {
  const reply = tcmFallback("小颜术是什么？");
  assert.match(reply, /3D/);
  assert.match(reply, /徒手/);
  assert.match(reply, /9D/);
  assert.match(reply, /紧致|保湿|提亮/);
  assert.doesNotMatch(reply, /starts with an assessment|manual techniques/i);
});

test("new service price questions do not invent an amount", () => {
  const pelvic = tcmFallback("骨盆trt多少钱？");
  assert.match(pelvic, /价格目前没有配置|评估后确认/);
  assert.doesNotMatch(pelvic, /RM\s*\d/i);

  const facial = tcmFallback("小颜术多少钱？");
  assert.match(facial, /价格目前没有配置|评估后确认/);
  assert.doesNotMatch(facial, /RM\s*\d/i);
});

test("new TCM services keep personalised medical suitability behind practitioner handoff", () => {
  const cases = [
    "I have a heart condition. Can I do pelvic adjustment?",
    "Saya ada darah tinggi. Boleh saya buat rawatan postur?",
    "我有高血压，可以做骨盆调理吗？",
    "我有高血压，可以做小颜术吗？",
  ];

  for (const message of cases) {
    const reply = enforceTcmSafetyRules([{ role: "user", content: message }]);
    assert.match(reply || "", /\[\[HANDOFF\]\]/, message);
  }
});

test("plain scheduling-shaped new-service requests can continue without false medical handoff", () => {
  const cases = [
    "Can I do pelvic adjustment Friday at 3pm in KL?",
    "Boleh saya buat rawatan postur Jumaat 3pm di KL?",
    "星期五下午在KL可以做小颜术吗？",
  ];

  for (const message of cases) {
    assert.equal(enforceTcmSafetyRules([{ role: "user", content: message }]), null, message);
  }
});

test("configured practice claims stay exact and are not tied to the source brand", () => {
  assert.equal(tcm.practiceProfile.practitionerCredential, "KKM-certified TCM practitioner");
  assert.equal(tcm.practiceProfile.clinicalExperience, "25+ years of clinical and manual-adjustment experience");
  assert.equal(tcm.practiceProfile.postureCaseExperience, "1,000+ posture adjustment cases");
});
