const test = require("node:test");
const assert = require("node:assert/strict");

const { buildFallbackReply } = require("../src/renovationFallback");
const { sanitizeRenovationCustomerReply } = require("../src/renovationCustomerLanguage");

const BANNED_CUSTOMER_TERMS = /\bcarpentry\b|木工/i;

test("Chinese renovation discovery question uses natural cabinet wording", () => {
  const raw = buildFallbackReply([{ role: "user", content: "你好" }]);
  const reply = sanitizeRenovationCustomerReply(raw);

  assert.equal(
    reply,
    "可以，我可以先了解您的需求和 Budget 方面吗？您主要想做厨房柜、衣柜、电视柜还是鞋柜？"
  );
  assert.doesNotMatch(reply, BANNED_CUSTOMER_TERMS);
});

test("customer-facing cleanup removes carpentry and 木工 terminology in all supported languages", () => {
  const samples = [
    "This demo is configured for custom carpentry and full-home carpentry.",
    "Boleh, scope carpentry ini termasuk living-room carpentry.",
    "这是全屋木工和客厅木工项目，也可以谈木工装修需求。",
  ];

  for (const sample of samples) {
    const reply = sanitizeRenovationCustomerReply(sample);
    assert.doesNotMatch(reply, BANNED_CUSTOMER_TERMS, reply);
  }
});

test("English and BM discovery questions ask about needs and budget without trade jargon", () => {
  const english = sanitizeRenovationCustomerReply(
    "Sure, I can help narrow down the carpentry scope and quotation first. Are you looking at kitchen cabinets, wardrobes, TV/living-room carpentry, shoe cabinets, or full-home carpentry?"
  );
  assert.equal(
    english,
    "Sure, I can first understand your needs and budget. Are you looking at kitchen cabinets, wardrobes, a TV cabinet, or shoe cabinets?"
  );
  assert.doesNotMatch(english, BANNED_CUSTOMER_TERMS);

  const malay = sanitizeRenovationCustomerReply(
    "Boleh, saya boleh bantu faham scope carpentry dan quotation dulu. Anda nak buat kitchen cabinet, wardrobe, TV cabinet, shoe cabinet atau full-house carpentry?"
  );
  assert.equal(
    malay,
    "Boleh, saya boleh fahamkan keperluan dan bajet anda dulu. Anda nak buat kitchen cabinet, wardrobe, TV cabinet atau shoe cabinet?"
  );
  assert.doesNotMatch(malay, BANNED_CUSTOMER_TERMS);
});
