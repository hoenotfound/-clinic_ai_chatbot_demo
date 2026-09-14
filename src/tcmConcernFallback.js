const { detectConcernMappings } = require("./tcmKnowledge");

function latestUserText(messages) {
  return String((messages || []).filter((message) => message?.role === "user").at(-1)?.content || "").trim();
}

function languageFor(text) {
  if (/\p{Script=Han}/u.test(String(text || ""))) return "zh";
  if (/\b(saya|nak|boleh|sakit|bahu|leher|pinggang|tidur|perut)\b/i.test(String(text || ""))) return "ms";
  return "en";
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

  if (lang === "zh") {
    return `针对你提到的情况，${names} 是这里比较常见会讨论的服务方向。不过实际适合哪一种，还是要让中医师了解你的情况后判断。`;
  }
  if (lang === "ms") {
    return `Untuk concern yang anda sebut, ${names} antara service yang biasa dibincangkan. Pengamal TCM masih perlu faham keadaan anda dulu sebelum confirm apa yang sesuai.`;
  }
  return `For the concern you mentioned, ${names} are services the centre commonly discusses. A TCM practitioner would still need to understand your situation before deciding what is appropriate.`;
}

module.exports = { buildTcmConcernFallback };
