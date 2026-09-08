const { detectServices } = require("./renovationServiceDetection");

const HUMAN_ROLE = "(?:human|person|staff|designer|sales(?:person)?|project\\s+manager)";
const HUMAN_REQUEST_PATTERNS = [
  new RegExp(`\\b(?:can|could|may)\\s+i\\s+(?:speak|talk|chat)\\s+(?:to|with)\\s+(?:a\\s+)?${HUMAN_ROLE}\\b`, "i"),
  new RegExp(`\\b(?:speak|talk|chat|connect)\\s+(?:me\\s+)?(?:to|with)\\s+(?:a\\s+)?${HUMAN_ROLE}\\b`, "i"),
  new RegExp(`\\b(?:i|we)\\s+(?:need|want|would\\s+like)\\s+(?:to\\s+(?:speak|talk|chat|connect)\\s+(?:to|with)\\s+)?(?:a\\s+)?${HUMAN_ROLE}\\b`, "i"),
  new RegExp(`\\b${HUMAN_ROLE}\\s+(?:please\\s+)?(?:call|contact|reply|message)\\s+me\\b`, "i"),
  /^(?:a\s+)?(?:human|designer|sales(?:person)?|project\s+manager|staff)\s+(?:please|pls)[.!?]*$/i,
  /(?:\u771f\u4eba|\u4eba\u5de5|\u8f6c\u4eba\u5de5|\u8f49\u4eba\u5de5|\u627e\u8bbe\u8ba1\u5e08|\u627e\u8a2d\u8a08\u5e2b|\u8054\u7cfb\u987e\u95ee|\u806f\u7e6b\u9867\u554f)/i,
  /(?:nak|mahu)\s+(?:cakap|bercakap|chat)\s+dengan\s+(?:staff|designer|sales|orang)/i,
  /(?:nak|mahu)\s+(?:staff|designer|sales)\s+(?:call|contact|hubungi)/i,
];

const TECHNICAL_REQUEST_PATTERNS = [
  /load[- ]?bearing|structural\s+(?:wall|beam|column|work|works|change|changes|issue|check)|hack(?:ing)?\s+(?:(?:this|the|a|my|our)\s+)?(?:wall|beam|column)/i,
  /\brewir(?:e|ing)\b|\belectrical\s+(?:work|works|wiring|upgrade|relocation|alteration|changes?)\b|(?:move|relocate|shift|add|remove|change)\s+(?:the\s+)?(?:switch|socket|plug|power\s*point|electrical\s*point|wiring)\b/i,
  /\bplumb(?:ing)?\s+(?:work|works|relocation|rerout(?:e|ing)|alteration|changes?)\b|(?:move|relocate|shift|reroute|change)\s+(?:the\s+)?(?:sink|water\s*point|pipe|pipes|plumbing)\b/i,
  /waterproof(?:ing)?|gas\s+(?:pipe|line)|permit|authority\s+approval|building\s+approval/i,
  /\u627f\u91cd\u5899|\u627f\u91cd\u7246|\u6572(?:\u8fd9\u4e2a|\u9019\u500b|\u8fd9\u9762|\u9019\u9762)?(?:\u5899|\u7246|\u6881|\u67f1)|\u62c6(?:\u5899|\u7246|\u6881|\u67f1)|\u6539\u7535|\u6539\u96fb|\u79fb\u63d2\u5ea7|\u79fb\u5f00\u5173|\u79fb\u958b\u95dc|\u6539\u6c34\u7ba1|\u79fb\u6c34\u4f4d|\u9632\u6c34|\u7164\u6c14|\u7164\u6c23|\u71c3\u6c14|\u71c3\u6c23/i,
  /(?:buat|kerja)\s+(?:elektrik|pendawaian|plumbing)|(?:ubah|alih|pindah|tambah)\s+(?:pendawaian|suis|soket|plug|paip|water\s*point)|waterproof|kelulusan\s+(?:majlis|pihak\s+berkuasa)|struktur\s+(?:dinding|beam|column)/i,
];

const PASSIVE_ROLE_REPLACEMENTS = [
  [/\bproject\s+manager\b/gi, "project lead"],
  [/\bsalesperson\b/gi, "sales rep"],
  [/\bdesigner\b/gi, "design consultant"],
  [/\bhuman\b/gi, "person"],
];

const BENIGN_TECH_REPLACEMENTS = [
  [/\belectrical\b/gi, "power"],
  [/\bplumbing\b/gi, "water service"],
  [/\bpendawaian\b/gi, "power point"],
  [/\bpaip\b/gi, "water point"],
  [/\u7535\u7ebf|\u96fb\u7dda/g, "power cable"],
  [/\u6c34\u7ba1/g, "water point"],
];

function isExplicitHumanRequest(text) {
  const value = String(text || "").trim();
  return Boolean(value && HUMAN_REQUEST_PATTERNS.some((pattern) => pattern.test(value)));
}

function isTechnicalHandoffRequest(text) {
  const value = String(text || "").trim();
  return Boolean(value && TECHNICAL_REQUEST_PATTERNS.some((pattern) => pattern.test(value)));
}

function isStandaloneUnconfiguredCabinetRequest(text) {
  const value = String(text || "").normalize("NFKC").toLowerCase().trim();
  if (!value || detectServices(value).length) return false;
  if (/\b(?:this|that|same|my|our|existing)\s+(?:cabinet|cupboard|built[- ]?in)s?\b/i.test(value)) return false;
  if (/\b(?:height|width|depth|size|drawer|shelf|door|handle|hinge|finish|colour|color|modify|adjust|resize)\b/i.test(value)) return false;

  const latinBefore = value.match(/\b([a-z][a-z0-9-]*(?:\s+[a-z][a-z0-9-]*){0,3})\s+(?:cabinet|cupboard|built[- ]?in)s?\b/i);
  if (latinBefore) {
    const descriptor = latinBefore[1].trim();
    if (!/^(?:a|an|the|my|our|this|that|same|new|custom|some|another)$/i.test(descriptor)) return true;
  }

  const latinAfter = value.match(/\b(?:cabinet|cupboard)s?\s+(?:for\s+)?([a-z][a-z0-9-]*(?:\s+[a-z][a-z0-9-]*){0,2})\b/i);
  if (latinAfter && !/^(?:me|us|this|that|same|home|house)$/i.test(latinAfter[1].trim())) return true;

  if (/\bkabinet\s+[a-z][a-z0-9-]*(?:\s+[a-z][a-z0-9-]*){0,2}\b/i.test(value)) return true;
  if (/(?:\u60f3\u505a|\u8981\u505a|\u505a)?[\u4e00-\u9fff]{1,8}(?:\u67dc|\u6ac3)/.test(value) && !/(?:\u8fd9\u4e2a|\u9019\u500b|\u6211\u7684|\u540c\u4e00\u4e2a|\u540c\u4e00\u500b)(?:\u67dc|\u6ac3)/.test(value)) return true;
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
  let content = original;
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
  return null;
}

module.exports = {
  isExplicitHumanRequest,
  isTechnicalHandoffRequest,
  isStandaloneUnconfiguredCabinetRequest,
  sanitizeLegacyRoutingMessages,
  renovationRoutingReason,
};
