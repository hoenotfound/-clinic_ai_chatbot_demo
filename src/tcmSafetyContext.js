const { enforceTcmSafetyRules: baseSafetyRules, _test: basePatterns } = require("./tcmSafetyRules");
const { hasDirectServiceSchedulingRequest } = require("./tcmBookingIntent");
const { detectConcernMappings } = require("./tcmKnowledge");

const EXPLICIT_HUMAN_REQUEST = /(?:can|could|may)\s+i\s+(?:speak|talk|chat)\s+(?:to|with)\s+(?:a\s+)?(?:human|staff|practitioner|doctor)|(?:i\s+)?(?:want|need)\s+(?:to\s+)?(?:speak|talk|chat)\s+(?:to|with)\s+(?:a\s+)?(?:human|staff|practitioner|doctor)|(?:boleh|nak|mahu)\s+(?:saya\s+)?(?:cakap|bercakap|jumpa|berjumpa)\s+(?:dengan\s+)?(?:pengamal(?:\s+TCM)?|doktor|staff|orang)|(?:nak|mahu)\s+(?:jumpa|cakap\s+dengan)\s+(?:pengamal(?:\s+TCM)?|doktor|staff)|真人|转人工|轉人工|找医师|找醫師|找医生|找醫生|想找中医师|想找中醫師|想跟中医师聊|想跟中醫師聊/i;
const MALAY_HERBAL_SERVICE = /(?:ada|sediakan|buat|harga|berapa|nak tahu|tanya).{0,24}(?:ubat\s+herba|herba)|(?:ubat\s+herba|herba).{0,24}(?:ada|harga|berapa|service|rawatan)/i;
const EXISTING_MEDICATION_CONTEXT = /ubat\s+cair\s+darah|ubat\s+darah|ubat\s+preskripsi|ubat\s+doktor|(?:sedang|tengah)\s+(?:makan|ambil)\s+ubat|saya\s+(?:makan|ambil)\s+ubat|campur|sekali\s+dengan/i;
const PRACTITIONER_INFO_QUERY = /(?:how much|price|cost|fee|hours?|available).{0,40}(?:practitioner|doctor)|(?:practitioner|doctor).{0,40}(?:price|cost|fee|hours?|available)|(?:中医师|中醫師|医生|醫生).{0,20}(?:多少钱|多少錢|价格|價格|收费|收費|几点|幾點)|(?:多少钱|多少錢|价格|價格|收费|收費).{0,20}(?:中医师|中醫師|医生|醫生)/i;
const SELF_REPORTED_MEDICAL_CONTEXT = /(?:\bi\s+(?:have|had|have\s+been\s+diagnosed\s+with)|\bi['’]?ve\s+got|\bdiagnosed\s+with|\bhistory\s+of|\bsuffering\s+from).{0,80}(?:condition|disease|problem|pain|blood\s+pressure|hypertension|diabetes|asthma|allerg|heart|kidney|liver|cancer|epilep|stroke)|(?:\bsaya\s+(?:ada|menghidap)|\bsaya\s+kena).{0,80}(?:penyakit|masalah|sakit|darah\s+tinggi|kencing\s+manis|asma|alahan|jantung|buah\s+pinggang|hati)|(?:我有|我患有|我被诊断|我被診斷|我以前有).{0,40}(?:疾病|病|问题|問題|高血压|高血壓|糖尿病|哮喘|过敏|過敏|心脏|心臟|肾|腎|肝|癌|中风|中風)/i;

function latestUserText(messages) {
  return String((messages || []).filter((message) => message?.role === "user").at(-1)?.content || "").trim();
}

function languageFor(text) {
  if (/\p{Script=Han}/u.test(text)) return "zh";
  if (/\b(saya|boleh|nak|mahu|pengamal|doktor)\b/i.test(text)) return "ms";
  return "en";
}

function humanReply(lang) {
  if (lang === "zh") return "可以，我帮你把这个对话转给 TCM team，让他们直接继续跟你聊。 [[HANDOFF]]";
  if (lang === "ms") return "Boleh, saya pass conversation ini kepada team TCM supaya mereka boleh sambung dengan anda di sini. [[HANDOFF]]";
  return "Sure, I’ll pass this conversation to the TCM team so they can continue with you here. [[HANDOFF]]";
}

function hasPersonalMedicalContext(text) {
  return SELF_REPORTED_MEDICAL_CONTEXT.test(text) || detectConcernMappings(text).length > 0;
}

function hasHighPrioritySafetySignal(text) {
  return [
    basePatterns.URGENT_PATTERN,
    basePatterns.COMPLAINT_PATTERN,
    basePatterns.PREGNANCY_PATTERN,
    basePatterns.PERSONAL_SUITABILITY_PATTERN,
    basePatterns.POST_TREATMENT_PATTERN,
  ].some((pattern) => pattern.test(text));
}

function mustOverrideScheduling(text) {
  const herbalServiceOnly = MALAY_HERBAL_SERVICE.test(text)
    && !EXISTING_MEDICATION_CONTEXT.test(text);
  const herbInteraction = basePatterns.HERBAL_PATTERN.test(text)
    && basePatterns.MEDICATION_PATTERN.test(text)
    && !herbalServiceOnly;
  const personalisedScheduling = basePatterns.PERSONAL_SUITABILITY_PATTERN.test(text)
    && hasPersonalMedicalContext(text);
  return herbInteraction || personalisedScheduling || [
    basePatterns.URGENT_PATTERN,
    basePatterns.COMPLAINT_PATTERN,
    basePatterns.PREGNANCY_PATTERN,
    basePatterns.POST_TREATMENT_PATTERN,
  ].some((pattern) => pattern.test(text));
}

function enforceTcmSafetyRules(messages) {
  const latest = latestUserText(messages);
  if (!latest) return null;

  if (EXPLICIT_HUMAN_REQUEST.test(latest)) return humanReply(languageFor(latest));

  const baseReply = baseSafetyRules(messages);
  if (!baseReply) return null;

  if (mustOverrideScheduling(latest)) return baseReply;
  if (hasDirectServiceSchedulingRequest(latest)) return null;
  if (hasHighPrioritySafetySignal(latest)) return baseReply;

  const benignMalayHerbalService = MALAY_HERBAL_SERVICE.test(latest)
    && !EXISTING_MEDICATION_CONTEXT.test(latest);
  if (benignMalayHerbalService) return null;

  if (PRACTITIONER_INFO_QUERY.test(latest)) return null;
  return baseReply;
}

module.exports = {
  enforceTcmSafetyRules,
  _test: {
    EXPLICIT_HUMAN_REQUEST,
    MALAY_HERBAL_SERVICE,
    EXISTING_MEDICATION_CONTEXT,
    PRACTITIONER_INFO_QUERY,
    SELF_REPORTED_MEDICAL_CONTEXT,
    hasPersonalMedicalContext,
    hasHighPrioritySafetySignal,
    mustOverrideScheduling,
  },
};
