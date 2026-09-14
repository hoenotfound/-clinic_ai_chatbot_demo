const tcm = require("./tcmConfig");
const { detectConcernMappings } = require("./tcmKnowledge");
const { serviceForText } = require("./tcmBookingIntent");

const PRICE_PATTERN = /\bprice\b|how much|\bcost\b|harga|berapa|多少钱|多少錢|价格|價格|价钱|價錢|收费|收費/i;

function latestUserText(messages) {
  return String((messages || []).filter((message) => message?.role === "user").at(-1)?.content || "").trim();
}

function languageFor(text) {
  if (/\p{Script=Han}/u.test(String(text || ""))) return "zh";
  if (/\b(saya|nak|boleh|sakit|bahu|leher|pinggang|tidur|perut)\b/i.test(String(text || ""))) return "ms";
  return "en";
}

function priceLine(service, lang) {
  if (!service) return "";
  const price = String(service.priceRange || "").replace(/^From\s+/i, "");
  if (lang === "zh") return `${service.name} 从 ${price} 起。`;
  if (lang === "ms") return `${service.name} bermula dari ${price}.`;
  return `${service.name} starts from ${price}.`;
}

function buildTcmConcernFallback(messages) {
  const latest = latestUserText(messages);
  if (!latest) return null;
  const mappings = detectConcernMappings(latest);
  if (!mappings.length) return null;
  const services = [...new Set(mappings.flatMap((mapping) => mapping.services || []))];
  if (!services.length) return null;
  const lang = languageFor(latest);
  const names = services.slice(0, 2).join(" and ");
  const namedService = serviceForText(latest);
  const price = PRICE_PATTERN.test(latest) && namedService ? priceLine(namedService, lang) : "";

  if (lang === "zh") {
    return `${price}${price ? " " : ""}针对你提到的情况，${names} 是这里比较常见会讨论的服务方向。不过实际适合哪一种，还是要让中医师了解你的情况后判断。`;
  }
  if (lang === "ms") {
    return `${price}${price ? " " : ""}Untuk concern yang anda sebut, ${names} antara service yang biasa dibincangkan. Pengamal TCM masih perlu faham keadaan anda dulu sebelum confirm apa yang sesuai.`;
  }
  return `${price}${price ? " " : ""}For the concern you mentioned, ${names} are services the centre commonly discusses. A TCM practitioner would still need to understand your situation before deciding what is appropriate.`;
}

module.exports = { buildTcmConcernFallback, _test: { priceLine } };
