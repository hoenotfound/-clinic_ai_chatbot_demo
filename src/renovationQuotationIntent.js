const QUOTATION_EDUCATION_PATTERNS = [
  /\bhow\s+(?:do|does|would|can)\s+(?:(?:you|your\s+team|the\s+team)\s+)?(?:prepare|make|create|issue|do)\b[^.!?]{0,70}\b(?:quotation|quote)\b/i,
  /\bhow\s+(?:does|do)\b[^.!?]{0,35}\b(?:quotation|quote)\b[^.!?]{0,35}\b(?:work|process)\b/i,
  /\b(?:quotation|quote)\b[^.!?]{0,35}\b(?:process|procedure|requirements?|works?)\b/i,
  /\bwhat\b[^.!?]{0,50}\b(?:need|required|information|details|documents?)\b[^.!?]{0,45}\b(?:quotation|quote)\b/i,
  /\bwhat\b[^.!?]{0,40}\b(?:quotation|quote)\b[^.!?]{0,45}\b(?:need|required|based\s+on)\b/i,
  /\b(?:macam\s+mana|bagaimana)\b[^.!?]{0,55}\b(?:buat|sediakan|prepare|create|keluarkan)\b[^.!?]{0,25}\b(?:quotation|sebut\s+harga)\b/i,
  /\b(?:macam\s+mana|bagaimana)\b[^.!?]{0,55}\b(?:quotation|sebut\s+harga)\b[^.!?]{0,30}\b(?:dibuat|disediakan|proses|berfungsi)?/i,
  /\b(?:quotation|sebut\s+harga)\b[^.!?]{0,35}\b(?:proses|cara|syarat|perlukan|perlu)\b/i,
  /\bapa\b[^.!?]{0,45}\b(?:perlu|perlukan|maklumat|butiran|dokumen)\b[^.!?]{0,45}\b(?:quotation|sebut\s+harga)\b/i,
  /(?:报价|報價|报价单|報價單).{0,18}(?:流程|怎么|怎麼|如何|怎样|怎樣|需要什么|需要什麼|要什么|要什麼|需要哪些|要哪些)/i,
  /(?:怎么|怎麼|如何|怎样|怎樣).{0,18}(?:准备|準備|制作|製作|出|做).{0,10}(?:报价|報價|报价单|報價單)/i,
  /(?:报价|報價).{0,12}(?:根据什么|根據什麼|看什么|看什麼|需要哪些资料|需要哪些資料)/i,
];

const FORMAL_QUOTE_PATTERNS = [
  /\b(?:send|prepare|issue|email|whatsapp|make|create)\b[^.!?]{0,60}\b(?:quotation|quote)\b/i,
  /\b(?:formal|official|final|proper|detailed|exact)\s+(?:price|quotation|quote)\b/i,
  /\b(?:quotation|quote)\s+(?:pdf|file|document)\b/i,
  /\b(?:i|we)\s+(?:need|want|would\s+like)\s+(?:a\s+)?(?:quotation|quote)\b/i,
  /\b(?:nak|mahu|perlukan)\s+(?:quotation|sebut\s+harga)\b/i,
  /\b(?:hantar|sediakan|buat|keluarkan)\b[^.!?]{0,40}\b(?:quotation|sebut\s+harga)\b|\b(?:quotation|sebut\s+harga)\s+(?:rasmi|final)\b/i,
  /(?:正式|完整|final).{0,4}(?:报价单|報價單|quotation)|(?:发|發|给|給|出|做|准备|準備).{0,12}(?:报价单|報價單)|(?:报价单|報價單).{0,10}(?:吗|嗎|可以|能不能|发|發|给|給)/i,
  /(?:给我|給我|我要|我想要|需要).{0,6}(?:报价|報價|报价单|報價單)|(?:出|做).{0,4}(?:报价|報價)/i,
];

const NATURAL_DIRECT_QUOTE_REQUEST_PATTERNS = [
  /\b(?:can|could|would)\s+you\s+(?:give|provide)\s+(?:me\s+)?(?:a\s+)?(?:quotation|quote)\b/i,
  /\b(?:can|could|may)\s+i\s+have\s+(?:a\s+)?(?:quotation|quote)\b/i,
  /\b(?:boleh\s+)?bagi\s+(?:saya\s+)?(?:quotation|sebut\s+harga)\b/i,
];

const EXPLICIT_QUOTE_REQUEST_PATTERNS = [
  /^(?:please|pls|kindly)\b[^.!?]{0,25}\b(?:send|prepare|issue|email|whatsapp|make|create)\b[^.!?]{0,60}\b(?:quotation|quote)\b/i,
  /^(?:can|could|would)\s+you\s+(?:send|issue|email|whatsapp)\b[^.!?]{0,60}\b(?:quotation|quote)\b/i,
  /\b(?:and|also|then)\s+(?:please|pls|can|could|would)\s+(?:you\s+)?(?:send|prepare|issue|email|whatsapp|make|create|give|provide)\b[^.!?]{0,60}\b(?:quotation|quote)\b/i,
  /\b(?:send|issue|email|whatsapp)\b[^.!?]{0,30}\b(?:me\s+)?(?:a\s+)?(?:formal\s+|official\s+|proper\s+|detailed\s+)?(?:quotation|quote)\b/i,
  /\b(?:i|we)\s+(?:need|want|would\s+like)\s+(?:a\s+)?(?:quotation|quote)\b/i,
  /\b(?:can|could|may)\s+i\s+have\s+(?:a\s+)?(?:quotation|quote)\b/i,
  /\b(?:nak|mahu|perlukan)\s+(?:quotation|sebut\s+harga)\b/i,
  /\b(?:boleh\s+)?(?:hantar|sediakan|buat|keluarkan|bagi)\b[^.!?]{0,35}\b(?:saya\s+)?(?:quotation|sebut\s+harga)\b/i,
  /(?:请|請|麻烦|麻煩)?(?:发|發|给|給|出|做|准备|準備).{0,12}(?:报价|報價|报价单|報價單)|(?:给我|給我|我要|我想要|需要).{0,6}(?:报价|報價|报价单|報價單)/i,
];

const EDUCATION_FULFILMENT_OVERRIDE_PATTERNS = [
  /\b(?:please|pls|kindly)\b[^.!?]{0,25}\b(?:send|prepare|issue|email|whatsapp|give|provide)\b[^.!?]{0,60}\b(?:quotation|quote)\b/i,
  /\b(?:can|could|would)\s+you\s+(?:send|issue|email|whatsapp|give|provide)\b[^.!?]{0,60}\b(?:quotation|quote)\b/i,
  /\b(?:i|we)\s+(?:need|want|would\s+like)\s+(?:a\s+)?(?:quotation|quote)\b/i,
  /\b(?:can|could|may)\s+i\s+have\s+(?:a\s+)?(?:quotation|quote)\b/i,
  /\b(?:saya\s+)?(?:nak|mahu|perlukan)\s+(?:quotation|sebut\s+harga)\b/i,
  /\b(?:boleh\s+)?(?:hantar|bagi)\b[^.!?]{0,35}\b(?:saya\s+)?(?:quotation|sebut\s+harga)\b/i,
  /(?:请|請|麻烦|麻煩).{0,8}(?:发|發|给|給|准备|準備).{0,12}(?:报价|報價|报价单|報價單)|(?:给我|給我|我要|我想要|需要).{0,6}(?:报价|報價|报价单|報價單)/i,
];

const ROUGH_ESTIMATE_CONTEXT_PATTERNS = [
  /\b(?:quotation|quote|sebut\s+harga)\b[^.!?]{0,60}\b\d+(?:\.\d+)?\s*(?:ft|feet|foot|mm|cm|m|meter|metre|kaki)s?\b/i,
  /\b\d+(?:\.\d+)?\s*(?:ft|feet|foot|mm|cm|m|meter|metre|kaki)s?\b[^.!?]{0,60}\b(?:quotation|quote|sebut\s+harga)\b/i,
];

function matchesAny(text, patterns) {
  const value = String(text || "").trim();
  return Boolean(value && patterns.some((pattern) => pattern.test(value)));
}

function quotationClauses(text) {
  return String(text || "")
    .split(/[.!?。！？；;\n]+/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isQuotationEducationQuestion(text) {
  return matchesAny(text, QUOTATION_EDUCATION_PATTERNS);
}

function isRoughEstimateContext(text) {
  return matchesAny(text, ROUGH_ESTIMATE_CONTEXT_PATTERNS);
}

function clauseHasFormalQuotationRequest(clause) {
  const formal = matchesAny(clause, FORMAL_QUOTE_PATTERNS);
  const naturalDirect = matchesAny(clause, NATURAL_DIRECT_QUOTE_REQUEST_PATTERNS);
  if (!formal && !naturalDirect) return false;

  // Natural "give/have/bagi quotation" wording is a staff-follow-up signal on its own,
  // but when it is tied directly to a dimension it behaves like the rough-price
  // questions that the AI should answer first.
  if (!formal && naturalDirect && isRoughEstimateContext(clause)) return false;

  // Process/education wording wins over ambiguous action verbs such as "buat quotation"
  // or "怎么做报价". A real fulfilment request still wins when it is stated separately
  // or explicitly in the same clause.
  if (isQuotationEducationQuestion(clause)) {
    return naturalDirect || matchesAny(clause, EDUCATION_FULFILMENT_OVERRIDE_PATTERNS);
  }

  return true;
}

function isFormalQuotationRequest(text) {
  const value = String(text || "").trim();
  if (!value) return false;

  const clauses = quotationClauses(value);
  if (clauses.some(clauseHasFormalQuotationRequest)) return true;

  // Whole-message fallback exists only for a mixed education + fulfilment request
  // that punctuation/clause splitting cannot isolate. Keep pure process questions
  // AI-first even when they contain verbs that can also be used as action requests.
  if (!isQuotationEducationQuestion(value)) return false;
  if (isRoughEstimateContext(value)) return false;
  return matchesAny(value, NATURAL_DIRECT_QUOTE_REQUEST_PATTERNS) ||
    matchesAny(value, EDUCATION_FULFILMENT_OVERRIDE_PATTERNS);
}

module.exports = {
  isQuotationEducationQuestion,
  isFormalQuotationRequest,
  _test: {
    QUOTATION_EDUCATION_PATTERNS,
    FORMAL_QUOTE_PATTERNS,
    NATURAL_DIRECT_QUOTE_REQUEST_PATTERNS,
    EXPLICIT_QUOTE_REQUEST_PATTERNS,
    EDUCATION_FULFILMENT_OVERRIDE_PATTERNS,
    ROUGH_ESTIMATE_CONTEXT_PATTERNS,
    quotationClauses,
    isRoughEstimateContext,
    clauseHasFormalQuotationRequest,
  },
};
