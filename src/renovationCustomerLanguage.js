function sanitizeRenovationCustomerReply(reply) {
  let text = String(reply || "");
  if (!text) return text;

  // The AI-first renovation path prepends a private state block to the model context.
  // The model is instructed never to expose it, and this is a final defensive strip
  // in case a provider ever echoes the tagged block back into customer-facing text.
  text = text.replace(
    /\[APP_INTERNAL_RENOVATION_STATE\][\s\S]*?\[\/APP_INTERNAL_RENOVATION_STATE\]/gi,
    ""
  ).trim();

  // Keep the first discovery question natural for Malaysian customers. The internal
  // product can still model these as carpentry scopes, but customers should see the
  // cabinet types they actually ask for rather than trade terminology.
  text = text.replace(
    /可以，我可以先帮你了解木工装修需求和大概报价方向。你主要想做厨房柜、衣柜、电视柜、鞋柜，还是全屋木工？/g,
    "可以，我可以先了解您的需求和 Budget 方面吗？您主要想做厨房柜、衣柜、电视柜还是鞋柜？"
  );
  text = text.replace(
    /我刚才的问题重复了。你只要告诉我主要想做哪个木工区域，例如厨房柜、衣柜或全屋木工，我会直接从那里继续。/g,
    "我刚才的问题重复了。您只要告诉我主要想做哪一类，例如厨房柜、衣柜、电视柜或鞋柜，我会直接从那里继续。"
  );
  text = text.replace(
    /Boleh, saya boleh bantu faham scope carpentry dan quotation dulu\. Anda nak buat kitchen cabinet, wardrobe, TV cabinet, shoe cabinet atau full-house carpentry\?/gi,
    "Boleh, saya boleh fahamkan keperluan dan bajet anda dulu. Anda nak buat kitchen cabinet, wardrobe, TV cabinet atau shoe cabinet?"
  );
  text = text.replace(
    /Soalan saya tadi berulang\. Beritahu saya satu scope carpentry utama sahaja, contohnya kitchen cabinet, wardrobe atau full-house carpentry, dan saya teruskan dari situ\./gi,
    "Soalan saya tadi berulang. Beritahu saya jenis cabinet utama sahaja, contohnya kitchen cabinet, wardrobe, TV cabinet atau shoe cabinet, dan saya teruskan dari situ."
  );
  text = text.replace(
    /Sure, I can help narrow down the carpentry scope and quotation first\. Are you looking at kitchen cabinets, wardrobes, TV\/living-room carpentry, shoe cabinets, or full-home carpentry\?/gi,
    "Sure, I can first understand your needs and budget. Are you looking at kitchen cabinets, wardrobes, a TV cabinet, or shoe cabinets?"
  );
  text = text.replace(
    /I repeated the same question\. Just tell me the main carpentry scope once, such as kitchen cabinets, wardrobes or full-home carpentry, and I'll continue from there\./gi,
    "I repeated the same question. Just tell me the main cabinet type once, such as kitchen cabinets, wardrobes, a TV cabinet, or shoe cabinets, and I'll continue from there."
  );

  // Clean up the same uncommon trade wording if it appears in Gemini output or in
  // another deterministic reply. Specific phrases go first so the result stays natural.
  const replacements = [
    [/full[- ]home\s+carpentry/gi, "full-home custom cabinets"],
    [/full[- ]house\s+carpentry/gi, "full-house custom cabinets"],
    [/living[- ]room\s+carpentry/gi, "living-room cabinets"],
    [/custom[- ]carpentry/gi, "custom cabinets"],
    [/\bcarpentry\s+scope\b/gi, "cabinet scope"],
    [/\bscope\s+carpentry\b/gi, "cabinet scope"],
    [/\bcarpentry\s+project\b/gi, "cabinet project"],
    [/\bcarpentry\b/gi, "cabinet work"],
    [/全屋木工/g, "全屋定制"],
    [/客厅木工/g, "客厅柜"],
    [/木工装修/g, "装修"],
    [/木工项目/g, "柜子项目"],
    [/木工区域/g, "柜子项目"],
    [/木工/g, "柜子"],
  ];

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

module.exports = { sanitizeRenovationCustomerReply };
