const FORMAL_QUOTE_PATTERNS = [
  /\b(?:send|prepare|provide|issue|email|whatsapp|make|give)\b[^.!?]{0,60}\b(?:formal|official|final|proper|detailed)?\s*(?:quotation|quote)\b/i,
  /\b(?:can|could|may)\s+i\s+(?:get|have|receive)\b[^.!?]{0,50}\b(?:quotation|quote)\b/i,
  /\b(?:formal|official|final|proper|detailed)\s+(?:quotation|quote)\b/i,
  /\b(?:quotation|quote)\s+(?:pdf|file|document)\b/i,
  /(?:正式|完整|final).{0,4}(?:报价单|報價單|quotation)|(?:发|發|给|給|出|做|准备|準備).{0,12}(?:报价单|報價單|quotation)|(?:报价单|報價單|quotation).{0,10}(?:吗|嗎|可以|能不能|发|發|给|給)/i,
  /\b(?:hantar|bagi|sediakan|buat|keluarkan)\b[^.!?]{0,40}\b(?:quotation|sebut\s+harga)\b|\b(?:quotation|sebut\s+harga)\s+(?:rasmi|final)\b|\b(?:boleh|dapat)\s+saya\s+(?:dapat|terima)\b[^.!?]{0,30}\b(?:quotation|sebut\s+harga)\b/i,
];

const SITE_MEASUREMENT_PATTERNS = [
  /\b(?:book|arrange|schedule|set\s*up)\b[^.!?]{0,60}\b(?:site\s+(?:measurement|visit)|measurement|measure|site\s+visit|consultation)\b/i,
  /\b(?:can|could|would|will)\s+(?:you|your\s+team|the\s+team|designer)\s+(?:come|visit|measure)\b/i,
  /\bwhen\s+can\s+(?:you|your\s+team|the\s+team|designer)\b[^.!?]{0,40}\b(?:come|visit|measure)\b/i,
  /(?:安排|预约|預約|可以|能不能|什么时候|什麼時候).{0,20}(?:上门|上門|量尺|测量|測量|现场测量|現場測量|site\s*visit)/i,
  /(?:上门|上門|量尺|现场测量|現場測量).{0,12}(?:时间|時間|星期|周末|週末|可以|吗|嗎)/i,
  /\b(?:atur|tempah|schedule)\b[^.!?]{0,50}\b(?:site\s+measurement|site\s+visit|datang\s+ukur|ukur\s+site)\b|\b(?:bila|boleh)\b[^.!?]{0,40}\b(?:datang\s+ukur|ukur\s+site)\b/i,
];

const PAYMENT_DOCUMENT_PATTERNS = [
  /\b(?:payment|pay|deposit)\s+(?:link|details|instructions)\b/i,
  /\b(?:send|give|share|provide)\b[^.!?]{0,50}\b(?:invoice|receipt|payment\s+link|bank\s+details|bank\s+account|qr\s*code)\b/i,
  /\b(?:invoice|receipt)\b[^.!?]{0,30}\b(?:send|email|whatsapp|please|pls|can|could)\b/i,
  /\b(?:do|can|could)\s+you\s+(?:provide|issue|send)\b[^.!?]{0,30}\b(?:invoice|receipt)\b/i,
  /\bhow\s+(?:do|can)\s+i\s+(?:pay|make)\b[^.!?]{0,25}\b(?:deposit|payment)\b/i,
  /(?:付款|支付|订金|訂金).{0,10}(?:链接|連結|资料|資料|方式|怎么付|怎麼付)|(?:发票|發票|收据|收據|银行账号|銀行帳號|银行资料|銀行資料|付款链接|付款連結)/i,
  /\b(?:link\s+bayaran|butiran\s+bayaran|cara\s+bayar\s+deposit|invois|resit|akaun\s+bank|butiran\s+bank|macam\s+mana\s+bayar\s+deposit)\b/i,
];

const DOCUMENT_REQUEST_PATTERNS = [
  /\b(?:send|share|email|whatsapp|give|provide)\b[^.!?]{0,60}\b(?:brochure|catalogue|catalog|price\s*list|material\s*list|pdf|document|spec\s*sheet|warranty\s+document)\b/i,
  /\b(?:can|could|would)\s+you\s+(?:send|share)\b[^.!?]{0,60}\b(?:file|files|brochure|catalogue|catalog|pdf|document)\b/i,
  /\bdo\s+you\s+have\b[^.!?]{0,40}\b(?:brochure|catalogue|catalog|price\s*list|pdf|document)\b/i,
  /(?:发|發|给|給|send).{0,15}(?:目录|目錄|价目表|價目表|材料表|文件|PDF|保修资料|保修資料|brochure|catalogue)|(?:有没有|有沒有).{0,10}(?:目录|目錄|价目表|價目表|文件|PDF)/i,
  /\b(?:hantar|share|bagi)\b[^.!?]{0,50}\b(?:brochure|katalog|senarai\s+harga|dokumen|pdf)\b|\bada\b[^.!?]{0,20}\b(?:brochure|katalog|senarai\s+harga|dokumen|pdf)\b/i,
];

const CAPABILITY_DISCLOSURE_PATTERNS = [
  /\bas\s+an\s+ai\b/i,
  /\b(?:i|we)\s+(?:can(?:not|'t)|am\s+unable\s+to|are\s+unable\s+to|am\s+not\s+able\s+to|are\s+not\s+able\s+to)\s+(?:directly\s+)?(?:send|share|attach|upload|email|create|generate|issue|book|schedule|reserve|process|access)\b/i,
  /\b(?:i|we)\s+(?:do\s+not|don't)\s+have\s+(?:the\s+)?(?:ability|capability|access)\b/i,
  /\b(?:this|the)\s+(?:chat|demo|system|assistant)\s+(?:can(?:not|'t)|does(?:n't|\s+not))\b/i,
  /\b(?:i|we)\s+(?:do\s+not|don't)\s+know(?:\s+(?:that|this|the)\s+(?:information|answer|details?)|\s+(?:the\s+)?(?:answer|information|details?))?[.!?]*$/i,
  /\b(?:i\s+am|i'm)\s+not\s+sure(?:\s+about\s+that)?[.!?]*$/i,
  /(?:作为|身为)\s*AI/i,
  /(?:我|这里|這裡|这个聊天|這個聊天|这个系统|這個系統).{0,10}(?:无法|無法|不能).{0,16}(?:发送|發送|提供|上传|上傳|安排|预约|預約|确认|確認|处理|處理|访问|存取)/i,
  /我(?:不知道|不确定|不確定)[。.!?？]*$|我(?:没有|沒有)(?:这个|這個|相关|相關)?(?:资料|資料|信息|資訊)/i,
  /\bsaya\s+(?:tak|tidak)\s+(?:boleh|dapat)\s+(?:hantar|share|lampir|upload|buat|keluarkan|atur|tempah|proses|akses)\b/i,
  /\bsaya\s+(?:tak|tidak)\s+(?:pasti|tahu)(?:\s+tentang\s+itu)?[.!?]*$/i,
  /\b(?:sistem|chat|demo)\s+ini\s+(?:tak|tidak)\s+(?:boleh|dapat)\b/i,
];

function matchesAny(text, patterns) {
  const value = String(text || "").trim();
  return Boolean(value && patterns.some((pattern) => pattern.test(value)));
}

function staffActionReason(text) {
  if (matchesAny(text, FORMAL_QUOTE_PATTERNS)) return "formal_quote";
  if (matchesAny(text, SITE_MEASUREMENT_PATTERNS)) return "site_measurement";
  if (matchesAny(text, PAYMENT_DOCUMENT_PATTERNS)) return "payment_details";
  if (matchesAny(text, DOCUMENT_REQUEST_PATTERNS)) return "documents";
  return null;
}

function hasCapabilityDisclosure(reply) {
  return matchesAny(reply, CAPABILITY_DISCLOSURE_PATTERNS);
}

module.exports = {
  staffActionReason,
  hasCapabilityDisclosure,
  _test: {
    FORMAL_QUOTE_PATTERNS,
    SITE_MEASUREMENT_PATTERNS,
    PAYMENT_DOCUMENT_PATTERNS,
    DOCUMENT_REQUEST_PATTERNS,
    CAPABILITY_DISCLOSURE_PATTERNS,
  },
};