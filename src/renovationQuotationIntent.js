const QUOTATION_EDUCATION_PATTERNS = [
  /\bhow\s+(?:do|does|would|can)\s+(?:(?:you|your\s+team|the\s+team)\s+)?(?:prepare|make|create|issue|do)\b[^.!?]{0,70}\b(?:quotation|quote)\b/i,
  /\bhow\s+(?:does|do)\b[^.!?]{0,35}\b(?:quotation|quote)\b[^.!?]{0,35}\b(?:work|process)\b/i,
  /\b(?:quotation|quote)\b[^.!?]{0,35}\b(?:process|procedure|requirements?|works?)\b/i,
  /\bwhat\b[^.!?]{0,50}\b(?:need|required|information|details|documents?)\b[^.!?]{0,45}\b(?:quotation|quote)\b/i,
  /\bwhat\b[^.!?]{0,40}\b(?:quotation|quote)\b[^.!?]{0,45}\b(?:need|required|based\s+on)\b/i,
  /\bmacam\s+mana\b[^.!?]{0,55}\b(?:quotation|sebut\s+harga)\b[^.!?]{0,30}\b(?:dibuat|disediakan|proses|berfungsi)?/i,
  /\b(?:quotation|sebut\s+harga)\b[^.!?]{0,35}\b(?:proses|cara|syarat|perlukan|perlu)\b/i,
  /\bapa\b[^.!?]{0,45}\b(?:perlu|perlukan|maklumat|butiran|dokumen)\b[^.!?]{0,45}\b(?:quotation|sebut\s+harga)\b/i,
  /(?:报价|報價|报价单|報價單).{0,18}(?:流程|怎么|怎麼|如何|怎样|怎樣|需要什么|需要什麼|要什么|要什麼|需要哪些|要哪些)/i,
  /(?:怎么|怎麼|如何|怎样|怎樣).{0,18}(?:准备|準備|制作|製作|出|做).{0,10}(?:报价|報價|报价单|報價單)/i,
  /(?:报价|報價).{0,12}(?:根据什么|根據什麼|看什么|看什麼|需要哪些资料|需要哪些資料)/i,
];

const FORMAL_QUOTE_PATTERNS = [
  /\b(?:send|prepare|issue|email|whatsapp|make)\b[^.!?]{0,60}\b(?:quotation|quote)\b/i,
  /\b(?:formal|official|final|proper|detailed|exact)\s+(?:price|quotation|quote)\b/i,
  /\b(?:quotation|quote)\s+(?:pdf|file|document)\b/i,
  /\b(?:i|we)\s+(?:need|want|would\s+like)\s+(?:a\s+)?(?:quotation|quote)\b/i,
  /\b(?:nak|mahu|perlukan)\s+(?:quotation|sebut\s+harga)\b/i,
  /(?:正式|完整|final).{0,4}(?:报价单|報價單|quotation)|(?:发|發|给|給|出|做|准备|準備).{0,12}(?:报价单|報價單)|(?:报价单|報價單).{0,10}(?:吗|嗎|可以|能不能|发|發|给|給)/i,
  /(?:给我|給我|我要|我想要|需要).{0,6}(?:报价|報價|报价单|報價單)|(?:出|做).{0,4}(?:报价|報價)/i,
  /\b(?:hantar|sediakan|buat|keluarkan)\b[^.!?]{0,40}\b(?:quotation|sebut\s+harga)\b|\b(?:quotation|sebut\s+harga)\s+(?:rasmi|final)\b/i,
];

function matchesAny(text, patterns) {
  const value = String(text || "").trim();
  return Boolean(value && patterns.some((pattern) => pattern.test(value)));
}

function isQuotationEducationQuestion(text) {
  return matchesAny(text, QUOTATION_EDUCATION_PATTERNS);
}

function isFormalQuotationRequest(text) {
  const value = String(text || "").trim();
  if (!value || isQuotationEducationQuestion(value)) return false;
  return matchesAny(value, FORMAL_QUOTE_PATTERNS);
}

module.exports = {
  isQuotationEducationQuestion,
  isFormalQuotationRequest,
  _test: {
    QUOTATION_EDUCATION_PATTERNS,
    FORMAL_QUOTE_PATTERNS,
  },
};