const tcm = require("./tcmConfig");
const { detectConcernMappings } = require("./tcmKnowledge");
const { serviceForText } = require("./tcmBookingIntent");

const PRICE_PATTERN = /\bprice\b|how much|\bcost\b|harga|berapa|多少钱|多少錢|价格|價格|价钱|價錢|收费|收費/i;
const ZH_NAMES = {
  "TCM Consultation": "中医问诊",
  Acupuncture: "针灸",
  Tuina: "推拿",
  Cupping: "拔罐",
  "Gua Sha": "刮痧",
  "Chinese Herbal Medicine Consultation": "中药问诊",
  "Pelvic & Posture Manual Adjustment": "骨盆与体态调理",
  "3D Facial Contour Manual Adjustment": "3D 小颜术",
};
const MS_NAMES = {
  "TCM Consultation": "Konsultasi TCM",
  Acupuncture: "Akupunktur",
  Tuina: "Tuina",
  Cupping: "Bekam / Cupping",
  "Gua Sha": "Gua Sha",
  "Chinese Herbal Medicine Consultation": "Konsultasi Herba Cina",
  "Pelvic & Posture Manual Adjustment": "Rawatan Manual Pelvis & Postur",
  "3D Facial Contour Manual Adjustment": "3D Rawatan Kontur Muka",
};

function latestUserText(messages) {
  return String((messages || []).filter((message) => message?.role === "user").at(-1)?.content || "").trim();
}

function languageFor(text) {
  if (/\p{Script=Han}/u.test(String(text || ""))) return "zh";
  if (/\b(saya|nak|boleh|sakit|bahu|leher|pinggang|tidur|perut|postur|muka)\b/i.test(String(text || ""))) return "ms";
  return "en";
}

function serviceLabel(name, lang) {
  if (lang === "zh") return ZH_NAMES[name] || name;
  if (lang === "ms") return MS_NAMES[name] || name;
  return name;
}

function priceLine(service, lang) {
  if (!service) return "";
  const name = serviceLabel(service.name, lang);
  const configured = String(service.priceRange || "").trim();
  if (!configured || /not configured/i.test(configured)) {
    if (lang === "zh") return `${name} 的实际价格需要由 team 在评估后确认，我这边先不乱报。`;
    if (lang === "ms") return `Harga sebenar untuk ${name} perlu disahkan oleh team selepas assessment.`;
    return `The team will confirm the actual price for ${name} after assessment.`;
  }
  const price = configured.replace(/^From\s+/i, "");
  if (lang === "zh") return `${name} 从 ${price} 起。`;
  if (lang === "ms") return `${name} bermula dari ${price}.`;
  return `${name} starts from ${price}.`;
}

function buildTcmConcernFallback(messages) {
  const latest = latestUserText(messages);
  if (!latest) return null;
  const mappings = detectConcernMappings(latest);
  if (!mappings.length) return null;
  const services = [...new Set(mappings.flatMap((mapping) => mapping.services || []))];
  if (!services.length) return null;
  const lang = languageFor(latest);
  const names = services.slice(0, 2).map((name) => serviceLabel(name, lang));
  const joinedNames = lang === "zh" ? names.join(" 和 ") : names.join(" and ");
  const namedService = serviceForText(latest);
  const askedPrice = PRICE_PATTERN.test(latest);

  if (namedService && !askedPrice) return null;

  const price = askedPrice && namedService ? priceLine(namedService, lang) : "";

  if (lang === "zh") {
    return `${price}${price ? " " : ""}针对你提到的情况，${joinedNames} 是这里比较常见会讨论的方向。不过实际适合哪一种，还是要让中医师了解你的情况后判断。`;
  }
  if (lang === "ms") {
    return `${price}${price ? " " : ""}Untuk concern yang anda sebut, ${joinedNames} antara servis yang biasa dibincangkan. Pengamal TCM masih perlu faham keadaan anda dulu sebelum confirm apa yang sesuai.`;
  }
  return `${price}${price ? " " : ""}For the concern you mentioned, ${joinedNames} are services the centre commonly discusses. A TCM practitioner would still need to understand your situation before deciding what is appropriate.`;
}

module.exports = { buildTcmConcernFallback, _test: { priceLine, serviceLabel } };
