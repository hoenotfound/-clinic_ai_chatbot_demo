const { detectConcernMappings } = require("./clinicKnowledge");
const { buildFallbackIntentReply } = require("./fallbackIntentRules");

function languageFor(text) {
  if (/\p{Script=Han}/u.test(String(text || ""))) return "zh";
  if (/\b(saya|nak|boleh|kulit|muka|kering|kusam|jeragat|rahang)\b/i.test(String(text || ""))) return "ms";
  return "en";
}

function latestUserText(messages) {
  return String((messages || []).filter((message) => message?.role === "user").at(-1)?.content || "").trim();
}

function shouldSkipIntentLayer(text) {
  return /not interested|no longer interested|never ?mind|don['’]t want|do not want|not booking|cancel(?: it| that| my appointment)?|no thanks|tak berminat|tidak berminat|tak nak|tidak mahu|tak jadi|tidak jadi|\bbatal\b|不要了|不想做|没兴趣|沒興趣|算了|取消|不预约|不預約|is this (?:a )?real clinic|are you (?:a )?real clinic|real clinic|real appointment|real payment|actual contact|real contact|betul.*clinic|klinik.*betul|真实诊所|真實診所|真的诊所|真的診所|真实预约|真實預約|付款/i.test(text);
}

function shouldDeferToNormalFallback(text) {
  return /\bprice\b|how much|\bcost\b|harga|berapa|多少钱|多少錢|\bbook(?:ing)?\b|appointment|slot|预约|預約|hifu|pico|botox|botulinum|skin ?booster|rejuran|profhilo|pregnan|breastfeed|hamil|menyusu|怀孕|懷孕|哺乳|medication|medicine|ubat|药|藥|accutane|isotretinoin|blood thinner|antibiotic|allerg|infection|open wound|side effects?|reaction|risk|pain|swelling|rash|complain|refund|human|staff|doctor/i.test(text);
}

function buildConcernFallback(messages) {
  const latest = latestUserText(messages);
  if (!latest) return null;

  if (!shouldSkipIntentLayer(latest)) {
    const intentReply = buildFallbackIntentReply(messages);
    if (intentReply) return intentReply;
  }

  if (shouldDeferToNormalFallback(latest)) return null;
  const mappings = detectConcernMappings(latest);
  if (!mappings.length) return null;

  const services = [...new Set(mappings.flatMap((mapping) => mapping.services || []))];
  const lang = languageFor(latest);

  if (services.length === 1) {
    const service = services[0];
    if (lang === "zh") return `针对你说的这个 concern，${service} 是这里常见会讨论的 treatment 方向之一。不过是否适合你还是要让 clinician assessment 后确认。`;
    if (lang === "ms") return `Untuk concern yang you mention, ${service} memang salah satu treatment yang biasa dibincangkan. Tapi clinician masih perlu assess dulu untuk confirm suitability.`;
    return `For the concern you mentioned, ${service} is one of the treatments commonly discussed here. A clinician would still need to assess whether it suits you personally.`;
  }

  const joined = services.join(" and ");
  if (lang === "zh") return `这个 concern 可能会讨论 ${joined}，但两者处理的方向不完全一样。Clinician 需要先判断主要原因，再决定哪一个方向比较适合。`;
  if (lang === "ms") return `Untuk concern ni, ${joined} boleh jadi dua direction yang berbeza. Clinician perlu check punca utama dulu sebelum decide mana lebih sesuai.`;
  return `For this concern, ${joined} can be two different treatment directions. A clinician would need to identify the main cause before deciding which one fits better.`;
}

module.exports = { buildConcernFallback };
