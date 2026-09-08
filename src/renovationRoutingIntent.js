const { detectServices } = require("./renovationServiceDetection");

const HUMAN_ROLE = "(?:human|person|staff|designer|sales(?:person)?|project\\s+manager)";
const HUMAN_REQUEST_PATTERNS = [
  new RegExp(`\\b(?:can|could|may)\\s+i\\s+(?:speak|talk|chat)\\s+(?:to|with)\\s+(?:a\\s+)?${HUMAN_ROLE}\\b`, "i"),
  new RegExp(`\\b(?:speak|talk|chat|connect)\\s+(?:me\\s+)?(?:to|with)\\s+(?:a\\s+)?${HUMAN_ROLE}\\b`, "i"),
  new RegExp(`\\b(?:i|we)\\s+(?:need|want|would\\s+like)\\s+(?:to\\s+(?:speak|talk|chat|connect)\\s+(?:to|with)\\s+)?(?:a\\s+)?${HUMAN_ROLE}\\b`, "i"),
  new RegExp(`\\b${HUMAN_ROLE}\\s+(?:please\\s+)?(?:call|contact|reply|message)\\s+me\\b`, "i"),
  /^(?:a\s+)?(?:human|designer|sales(?:person)?|project\s+manager|staff)\s+(?:please|pls)[.!?]*$/i,
  /(?:真人|人工|转人工|轉人工|找设计师|找設計師|联系顾问|聯繫顧問)/i,
  /(?:nak|mahu)\s+(?:cakap|bercakap|chat)\s+dengan\s+(?:staff|designer|sales|orang)/i,
  /(?:nak|mahu)\s+(?:staff|designer|sales)\s+(?:call|contact|hubungi)/i,
];

const TECHNICAL_REQUEST_PATTERNS = [
  /load[- ]?bearing|structural\s+(?:wall|beam|column|work|works|change|changes|issue|check)|hack(?:ing)?\s+(?:(?:this|the|a|my|our)\s+)?(?:wall|beam|column)/i,
  /\brewir(?:e|ing)\b|\belectrical\s+(?:work|works|wiring|upgrade|relocation|alteration|changes?)\b|(?:move|relocate|shift|add|remove|change)\s+(?:the\s+)?(?:switch|socket|plug|power\s*point|electrical\s*point|wiring)\b/i,
  /\bplumb(?:ing)?\s+(?:work|works|relocation|rerout(?:e|ing)|alteration|changes?)\b|(?:move|relocate|shift|reroute|change)\s+(?:the\s+)?(?:sink|water\s*point|pipe|pipes|plumbing)\b/i,
  /waterproof(?:ing)?|gas\s+(?:pipe|line)|permit|authority\s+approval|building\s+approval/i,
  /承重墙|承重牆|敲(?:这个|這個|这面|這面)?(?:墙|牆|梁|柱)|拆(?:墙|牆|梁|柱)|改电|改電|移插座|移开关|移開關|改水管|移水位|防水|煤气|煤氣|燃气|燃氣/i,
  /(?:buat|kerja)\s+(?:elektrik|pendawaian|plumbing)|(?:ubah|alih|pindah|tambah)\s+(?:pendawaian|suis|soket|plug|paip|water\s*point)|waterproof|kelulusan\s+(?:majlis|pihak\s+berkuasa)|struktur\s+(?:dinding|beam|column)/i,
];

const CUSTOMER_SENDING_IMAGE_PATTERN = /\b(?:can|could|may)\s+i\s+(?:send|share|upload)\b[^.!?]{0,80}\b(?:photo|photos|image|images|picture|pictures)\b|(?:我|我这边|我這邊)(?:可以|能)?(?:发|發|传|傳|上传|上傳).{0,20}(?:照片|图片|圖片|图|圖).{0,10}(?:给你|給你)|(?:我|我这边|我這邊)(?:有|有一(?:些|张|張)|这边有|這邊有).{0,12}(?:照片|图片|圖片|图|圖)|\b(?:boleh|dapat)\s+saya\s+(?:hantar|share|upload)\b[^.!?]{0,60}\b(?:gambar|foto)\b|\bsaya\s+(?:ada|punya)\s+(?:gambar|foto)\b/i;
const REFERENCE_IMAGE_REQUEST_PATTERNS = [
  /\b(?:can|could|would|will)\s+you\s+(?:send|share|show)\s+(?:me\s+)?[^.!?]{0,80}\b(?:photo|photos|image|images|picture|pictures|reference|references|sample|samples|design|designs)\b/i,
  /\b(?:send|share|show)\s+me\s+[^.!?]{0,80}\b(?:photo|photos|image|images|picture|pictures|reference|references|sample|samples|design|designs)\b/i,
  /\bcan\s+i\s+see\s+[^.!?]{0,80}\b(?:photo|photos|image|images|picture|pictures|reference|references|sample|samples|design|designs)\b/i,
  /\bdo\s+you\s+have\s+(?:any\s+)?[^.!?]{0,60}\b(?:photo|photos|image|images|picture|pictures|reference|references|sample|samples)\b/i,
  /(?:你|你们|你們)?(?:可以|能不能|能否|可不可以)?(?:发|發|send).{0,12}(?:我|给我|給我|看看).{0,12}(?:参考图|參考圖|图片|圖片|照片|图|圖|款式|样板|樣板)/i,
  /(?:你|你们|你們)(?:有|有没有|有沒有).{0,10}(?:参考图|參考圖|图片|圖片|照片|样板|樣板)(?:吗|嗎)?/i,
  /(?:有没有|有沒有).{0,10}(?:参考图|參考圖|图片|圖片|照片|样板|樣板)/i,
  /有.{0,10}(?:参考图|參考圖|图片|圖片|照片|样板|樣板).{0,4}(?:吗|嗎)[？?]?/i,
  /(?:给|給)我看.{0,12}(?:参考图|參考圖|图片|圖片|照片|图|圖|款式|样板|樣板)/i,
  /\b(?:boleh|dapat)\s+(?:hantar|share|bagi|tunjuk)\s+(?:saya\s+)?[^.!?]{0,60}\b(?:gambar|foto|design|contoh)\b/i,
  /\b(?:ada|punya)\s+(?:gambar|foto|contoh)(?:\s+(?:contoh|rujukan|design))?[^.!]{0,12}(?:tak|ke|kah|\?)/i,
];

const PASSIVE_ROLE_REPLACEMENTS = [
  [/\bproject\s+manager\b/gi, "project lead"],
  [/\bsalesperson\b/gi, "sales rep"],
  [/\bdesigner\b/gi, "design consultant"],
  [/\bhuman\b/gi, "person"],
];

const BENIGN_TECH_REPLACEMENTS = [
  [/\belectrical\s+outlets?\b/gi, "plug points"],
  [/\bplumbing\s+points?\b/gi, "water point"],
  [/\belectrical\b/gi, "power"],
  [/\bplumbing\b/gi, "water"],
  [/\bpendawaian\b/gi, "power point"],
  [/\bpaip\b/gi, "water point"],
  [/电线|電線/g, "power point"],
  [/水管/g, "water point"],
];

const SUPPORTED_VARIANT_REPLACEMENTS = [
  [/\bstudy\s+(?:room|area)\s+(?:cabinet|cabinets|cupboard|cupboards|built[- ]?in|built[- ]?ins)\b/gi, "study cabinet"],
  [/\b(?:cabinet|cabinets|cupboard|cupboards)\s+(?:for\s+)?(?:the\s+)?study\s+(?:room|area)\b/gi, "study cabinet"],
  [/\bkabinet\s+(?:bilik\s+)?study\b/gi, "study cabinet"],
  [/书房柜|書房櫃/g, "书柜"],
];

const GENERIC_CABINET_DESCRIPTOR_WORDS = new Set([
  "a", "an", "the", "my", "our", "this", "that", "same", "new", "custom", "some", "another", "any", "just",
  "i", "we", "you", "want", "need", "would", "like", "to", "ask", "asking", "enquire", "enquiry",
  "enquiries", "inquire", "inquiry", "inquiries", "question", "questions", "know", "learn", "more", "about",
  "looking", "for", "interested", "in", "can", "could", "do", "does", "make", "build", "provide", "offer",
  "info", "information", "hi", "hello", "hey", "me", "us", "home", "house", "have", "has", "had", "tell",
  "regarding", "regards",
]);

const GENERIC_CABINET_ENQUIRY_PATTERNS = [
  /^(?:hi|hello|hey|hai|halo)?[,.!\s]*(?:(?:i|we)\s+)?(?:want|would\s+like|need)?\s*(?:to\s+)?(?:ask|enquire|inquire|know|learn)?\s*(?:a\s+)?(?:question\s+)?(?:about|regarding)?\s*(?:custom\s+)?(?:cabinet|cabinets|cupboard|cupboards|built[- ]?ins?)[.!?\s]*$/i,
  /^(?:hi|hello|hai|halo)?[,.!\s]*(?:saya\s+)?(?:nak|mahu)?\s*(?:tanya|bertanya|enquire|inquire)?\s*(?:pasal|tentang|mengenai)?\s*(?:buat\s+)?(?:cabinet|kabinet)(?:s)?[.!?\s]*$/i,
  /^(?:你好|嗨|哈咯|哈囉)?[，,。！？!?\s]*(?:我)?(?:想|要)?(?:问|問|咨询|諮詢|了解)?(?:一下)?(?:做)?(?:柜子|櫃子|柜|櫃)(?:的)?(?:事|项目|項目|装修|裝修)?[。！？!?\s]*$/i,
];

function isExplicitHumanRequest(text) {
  const value = String(text || "").trim();
  return Boolean(value && HUMAN_REQUEST_PATTERNS.some((pattern) => pattern.test(value)));
}

function isTechnicalHandoffRequest(text) {
  const value = String(text || "").trim();
  return Boolean(value && TECHNICAL_REQUEST_PATTERNS.some((pattern) => pattern.test(value)));
}

function isReferenceImageRequest(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  const outboundRequest = REFERENCE_IMAGE_REQUEST_PATTERNS.some((pattern) => pattern.test(value));
  if (outboundRequest) return true;
  if (CUSTOMER_SENDING_IMAGE_PATTERN.test(value)) return false;
  return false;
}

function normalizeSupportedCabinetVariants(text) {
  let value = String(text || "");
  for (const [pattern, replacement] of SUPPORTED_VARIANT_REPLACEMENTS) value = value.replace(pattern, replacement);
  return value;
}

function isGenericCabinetEnquiry(text) {
  const value = String(text || "").normalize("NFKC").trim();
  return Boolean(value && GENERIC_CABINET_ENQUIRY_PATTERNS.some((pattern) => pattern.test(value)));
}

function isGenericCabinetDescriptor(descriptor) {
  const words = String(descriptor || "").toLowerCase().match(/[a-z0-9-]+/g) || [];
  return Boolean(words.length) && words.every((word) => GENERIC_CABINET_DESCRIPTOR_WORDS.has(word));
}

function isStandaloneUnconfiguredCabinetRequest(text) {
  const routedValue = normalizeSupportedCabinetVariants(text);
  const value = String(routedValue || "").normalize("NFKC").toLowerCase().trim();
  if (!value || detectServices(value).length) return false;
  if (isGenericCabinetEnquiry(value)) return false;
  if (/\b(?:this|that|same|my|our|existing)\s+(?:cabinet|cupboard|built[- ]?in)s?\b/i.test(value)) return false;
  if (/\b(?:height|width|depth|size|drawer|shelf|door|handle|hinge|finish|colour|color|modify|adjust|resize)\b/i.test(value)) return false;

  const latinBefore = value.match(/\b([a-z][a-z0-9-]*(?:\s+[a-z][a-z0-9-]*){0,3})\s+(?:cabinet|cupboard|built[- ]?in)s?\b/i);
  if (latinBefore && !isGenericCabinetDescriptor(latinBefore[1])) return true;

  const latinAfter = value.match(/\b(?:cabinet|cupboard)s?\s+(?:for\s+)?([a-z][a-z0-9-]*(?:\s+[a-z][a-z0-9-]*){0,2})\b/i);
  if (latinAfter && !isGenericCabinetDescriptor(latinAfter[1])) return true;

  if (/\bkabinet\s+[a-z][a-z0-9-]*(?:\s+[a-z][a-z0-9-]*){0,2}\b/i.test(value)) return true;
  if (/(?:想做|要做|做)?[一-鿿]{1,8}(?:柜|櫃)/.test(value) && !/(?:这个|這個|我的|同一个|同一個)(?:柜|櫃)/.test(value)) return true;
  return false;
}

function sanitizeLegacyRoutingMessages(messages) {
  const items = Array.isArray(messages) ? messages : [];
  let latestUserIndex = -1;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index]?.role === "user") {
      latestUserIndex = index;
      break;
    }
  }
  if (latestUserIndex < 0) return items;

  const original = String(items[latestUserIndex]?.content || "");
  let content = normalizeSupportedCabinetVariants(original);
  if (!isExplicitHumanRequest(original)) {
    for (const [pattern, replacement] of PASSIVE_ROLE_REPLACEMENTS) content = content.replace(pattern, replacement);
  }
  if (!isTechnicalHandoffRequest(original)) {
    for (const [pattern, replacement] of BENIGN_TECH_REPLACEMENTS) content = content.replace(pattern, replacement);
  }
  if (content === original) return items;
  return items.map((message, index) => index === latestUserIndex ? { ...message, content } : message);
}

function renovationRoutingReason(text) {
  if (isExplicitHumanRequest(text)) return "human";
  if (isTechnicalHandoffRequest(text)) return "technical";
  if (isStandaloneUnconfiguredCabinetRequest(text)) return "scope";
  if (isReferenceImageRequest(text)) return "reference_images";
  return null;
}

module.exports = {
  isExplicitHumanRequest,
  isTechnicalHandoffRequest,
  isReferenceImageRequest,
  isStandaloneUnconfiguredCabinetRequest,
  isGenericCabinetEnquiry,
  normalizeSupportedCabinetVariants,
  sanitizeLegacyRoutingMessages,
  renovationRoutingReason,
};
