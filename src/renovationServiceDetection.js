const renovation = require("./renovationConfig");

const EXTRA_ALIASES = {
  "Kitchen Cabinets": [
    "kitchen carpentry",
    "kitchen cabinet",
    "kitchen cabinets",
    "kabinet dapur",
    "cabinet dapur",
    "厨房柜",
    "廚房櫃",
    "厨柜",
    "廚櫃",
    "aluminium cabinet",
    "aluminum cabinet",
    "aliminium cabinet",
    "aluminuim cabinet",
    "aluminium kitchen",
    "aluminum kitchen",
  ],
  "Built-in Wardrobes": [
    "wardrobe",
    "wardrobes",
    "almari",
    "almari baju",
    "衣柜",
    "衣櫃",
  ],
  "TV Console & Living Room Carpentry": [
    "tv console",
    "tv cabinet",
    "living room carpentry",
    "living room cabinet",
    "电视柜",
    "電視櫃",
  ],
  "Shoe Cabinet & Entrance Storage": [
    "shoe cabinet",
    "shoe rack",
    "kabinet kasut",
    "鞋柜",
    "鞋櫃",
  ],
  "Study, Display & Storage Cabinets": [
    "study cabinet",
    "storage cabinet",
    "display cabinet",
    "书柜",
    "書櫃",
    "收纳柜",
    "收納櫃",
  ],
  "Full-Home Custom Carpentry": [
    "whole house carpentry",
    "full house carpentry",
    "full-home carpentry",
    "full home carpentry",
    "全屋木工",
    "全屋定制",
    "全屋訂製",
  ],
};

// Room-only words are useful short answers after the bot asks which carpentry area
// the customer wants, but they are too broad to classify every mention of that room
// as cabinetry. For example, "kitchen tiles" must not become a Kitchen Cabinets lead.
const CONTEXTUAL_SCOPE_ALIASES = {
  "Kitchen Cabinets": ["kitchen", "dapur", "厨房", "廚房"],
};

const NON_CARPENTRY_ROOM_PATTERN = /\b(?:tiles?|tiling|floor(?:ing)?|paint(?:ing)?|ceiling|plaster(?:ing)?|wallpaper|plumb(?:ing)?|sink|tap|faucet|pipe|electrical|wiring|renovation|wet\s*works?|masonry|jubin|lantai|siling|paip|elektrik|renovasi)\b|瓷砖|瓷磚|地砖|地磚|地板|油漆|天花|水管|水喉|电线|電線|装修|裝修|翻新/i;
const PROJECT_DETAIL_PATTERN = /\b(?:condo(?:minium)?|apartment|landed|terrace|semi[- ]?d|bungalow|commercial|office|shop|retail|puchong|cheras|kajang|petaling\s+jaya|pj|subang|shah\s+alam|kuala\s+lumpur|kl|mont\s+kiara|bukit\s+jalil|setapak)\b|\b(?:rm\s*)?\d+(?:[,.]\d+)?\s*(?:k|ft|feet|foot|mm|cm|m|meter|metre)?\b|公寓|排屋|独立屋|獨立屋|蒲种|蒲種|蕉赖|蕉賴|加影|八打灵再也|八打靈再也|吉隆坡|预算|預算|尺寸|平面图|平面圖/i;
const CARPENTRY_SCOPE_NOUN_PATTERN = /\b(?:cabinet(?:s)?|cupboard(?:s)?|carpentry|built[- ]?ins?|counter(?:s)?|vanit(?:y|ies))\b|柜|櫃|木工|收纳|收納/i;
const NEW_SCOPE_REQUEST_PATTERN = /\b(?:do|does|can|could|would)\s+(?:you|your\s+team)\s+(?:also\s+)?(?:do|build|make|provide|offer)|\b(?:i|we)\s+(?:also\s+)?(?:want|need|am\s+looking\s+for|are\s+looking\s+for)|\b(?:also\s+)?(?:need|want)\s+(?:a\s+|some\s+)?(?:new\s+)?|\b(?:ada|boleh|nak|mahu)\s+(?:buat|buatkan)?\b|(?:有做|也做|可以做|能做|想做|要做)/i;
const UNCONFIGURED_SCOPE_PHRASE_PATTERN = /\b(?:(?:reception|office|clinic|cashier|bar|laundry|altar|prayer|bathroom|toilet)\s+(?:cabinet(?:s)?|cupboard(?:s)?|counter(?:s)?|carpentry|built[- ]?ins?|vanit(?:y|ies))|(?:cabinet(?:s)?|cupboard(?:s)?|counter(?:s)?|vanit(?:y|ies))\s+(?:for\s+)?(?:reception|office|clinic|cashier|bar|laundry|altar|prayer|bathroom|toilet)|vanit(?:y|ies)\s+(?:cabinet(?:s)?|unit(?:s)?))\b|(?:接待|前台|办公室|辦公室|诊所|診所|浴室|厕所|廁所|洗衣房|神台).{0,4}(?:柜|櫃|台|收纳|收納)/i;
const KNOWN_SCOPE_REFERENCE_PATTERN = /\b(?:this|that|the|same|my|our|existing)\s+(?:cabinet(?:s)?|cupboard(?:s)?|carpentry|built[- ]?in|counter)\b|这个柜|這個櫃|同一个柜|同一個櫃|这个木工|這個木工/i;
const EXISTING_SCOPE_DETAIL_PATTERN = /\b(?:taller|shorter|wider|narrower|deeper|shallower|height|width|depth|size|drawers?|shelves?|doors?|handles?|hinges?|finish|colour|color|modify|adjust|resize|add\s+(?:a\s+)?(?:drawer|shelf|door|handle))\b|加高|加宽|加寬|改高|改宽|改寬|抽屉|抽屜|层板|層板|柜门|櫃門|颜色|顏色/i;

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termsFor(service) {
  return [
    service.name,
    ...(service.aliases || []),
    ...(EXTRA_ALIASES[service.name] || []),
  ];
}

function containsTerm(text, term) {
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return false;

  // Use loose boundaries for Latin terms so "wardrobe" does not accidentally
  // match inside another word. CJK phrases still use substring matching.
  if (/^[a-z0-9][a-z0-9 /&+.-]*$/i.test(normalizedTerm)) {
    const pattern = escapeRegex(normalizedTerm).replace(/\\ /g, "\\s+");
    return new RegExp(`(^|[^a-z0-9])${pattern}(?=$|[^a-z0-9])`, "i").test(text);
  }
  return text.includes(normalizedTerm);
}

function isStandaloneScopeReply(text, term) {
  const normalized = normalizeText(text);
  const normalizedTerm = normalizeText(term);
  if (!normalized || !normalizedTerm || NON_CARPENTRY_ROOM_PATTERN.test(normalized)) return false;
  if (normalized === normalizedTerm) return true;

  if (/[一-鿿]/.test(normalizedTerm)) {
    const termPattern = escapeRegex(normalizedTerm);
    return new RegExp(`^(?:想做|要做|做|主要做|先做|就是|就做)?\\s*${termPattern}(?:\\s*(?:先|就好|而已))?$`, "i").test(normalized);
  }

  const termPattern = escapeRegex(normalizedTerm).replace(/\\ /g, "\\s+");
  return new RegExp(
    `^(?:(?:i|we)\\s+(?:want|need)(?:\\s+to\\s+do)?\\s+|(?:want|need|doing|do|for|my|our|just|only)\\s+|(?:nak|mahu)(?:\\s+buat)?\\s+|buat\\s+)?${termPattern}(?:\\s+(?:only|first|area|please))?$`,
    "i"
  ).test(normalized);
}

function contextualAliasMatches(text, term, allowBareScope) {
  const normalized = normalizeText(text);
  if (!normalized || NON_CARPENTRY_ROOM_PATTERN.test(normalized)) return false;
  if (!containsTerm(normalized, term)) return false;
  return Boolean(allowBareScope) || isStandaloneScopeReply(normalized, term) || PROJECT_DETAIL_PATTERN.test(normalized);
}

function detectServiceObjects(text, { allowBareScope = false } = {}) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const matches = [];
  for (const service of renovation.services) {
    const strongMatch = termsFor(service).some((term) => containsTerm(normalized, term));
    const contextualMatch = (CONTEXTUAL_SCOPE_ALIASES[service.name] || [])
      .some((term) => contextualAliasMatches(normalized, term, allowBareScope));
    if (strongMatch || contextualMatch) matches.push(service);
  }
  return matches;
}

function serviceFromSegment(segment) {
  return detectServiceObjects(segment, { allowBareScope: true })[0] || null;
}

function correctedPair(targetText, rejectedText) {
  const target = serviceFromSegment(targetText);
  const rejected = serviceFromSegment(rejectedText);
  if (!target || !rejected || target.name === rejected.name) return null;
  return target;
}

function correctionSegments(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  // Wanted service is on the left.
  for (const pattern of [
    /^(.+?)\s+instead\s+of\s+(.+)$/i,
    /^(.+?)\s+rather\s+than\s+(.+)$/i,
    /^(.+?)[,;]\s*(?:not|bukan)\s+(.+)$/i,
    /^(.+?)\s+(?:not|bukan)\s+(.+)$/i,
    /^(.+?)\s*(?:而不是|而非)\s*(.+)$/i,
    /^(.+?)[,，;]\s*(?:不是|不要)\s*(.+)$/i,
  ]) {
    const match = normalized.match(pattern);
    if (match) return { targetText: normalizeText(match[1]), rejectedText: normalizeText(match[2]) };
  }

  // Wanted service is on the right.
  for (const pattern of [
    /^(?:i|we)\s+(?:don['’]?t|do\s+not)\s+want\s+(.+?)(?:[,;.!?]+\s*|\s+but\s+)(?:but\s+)?(?:i|we)\s+(?:want|need)\s+(.+?)(?:\s+instead)?[.!?]*$/i,
    /^(?:cancel|drop|remove)\s+(.+?)(?:[,;.!?]+\s*|\s+but\s+)(?:but\s+)?(?:(?:i|we)\s+)?(?:want|need)\s+(.+?)(?:\s+instead)?[.!?]*$/i,
    /^(?:change|switch)\s+(?:from\s+)?(.+?)\s+to\s+(.+?)[.!?]*$/i,
    /^(?:tak|tidak)\s+(?:nak|mahu)\s+(.+?)(?:[,;.!?]+\s*|\s+(?:tapi|tetapi)\s+)(?:(?:tapi|tetapi)\s+)?(?:saya\s+)?(?:nak|mahu)\s+(.+?)(?:\s+sebaliknya)?[.!?]*$/i,
    /^(?:not|bukan)\s+(.+?)(?:[,;.!?]+\s*|\s+(?:but|actually|instead|tapi|tetapi)\s+)(?:(?:but|actually|instead|tapi|tetapi)\s+)?(.+?)[.!?]*$/i,
    /^(?:不是|不要)\s*(.+?)[,，;。！？]\s*(?:而是|是|要|改做|改成)?\s*(.+)$/i,
  ]) {
    const match = normalized.match(pattern);
    if (match) return { targetText: normalizeText(match[2]), rejectedText: normalizeText(match[1]) };
  }

  // Direct switch/change wording where the previous service is omitted.
  for (const pattern of [
    /\b(?:switch|change)\s+(?:it\s+)?to\s+([^,.;!?]+)/i,
    /(?:改成|改做|换成|換成|应该是|應該是)\s*([^，。！？,!?]+)/i,
  ]) {
    const match = normalized.match(pattern);
    if (match) return { targetText: normalizeText(match[1]), rejectedText: null };
  }

  return null;
}

function detectCorrectedService(text) {
  const segments = correctionSegments(text);
  if (!segments) return null;
  if (segments.rejectedText) return correctedPair(segments.targetText, segments.rejectedText);
  return serviceFromSegment(segments.targetText);
}

function correctionTargetText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return normalized;
  if (!detectCorrectedService(normalized)) return normalized;
  return correctionSegments(normalized)?.targetText || normalized;
}

function isUnconfiguredServiceRequest(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;

  // A specific unlisted cabinet/carpentry noun is already enough to represent a
  // new scope in chat. This catches shorthand such as "bathroom vanity" or
  // "office cabinets" and mixed shorthand such as "kitchen cabinets + bathroom vanity".
  if (UNCONFIGURED_SCOPE_PHRASE_PATTERN.test(normalized)) return true;

  if (!NEW_SCOPE_REQUEST_PATTERN.test(normalized)) return false;

  const configuredMatches = detectServiceObjects(normalized, { allowBareScope: false });
  if (configuredMatches.length) return false;
  if (!CARPENTRY_SCOPE_NOUN_PATTERN.test(normalized)) return false;

  // Modification requests about the already-known cabinet are not new scope.
  if (KNOWN_SCOPE_REFERENCE_PATTERN.test(normalized) || EXISTING_SCOPE_DETAIL_PATTERN.test(normalized)) return false;

  // Generic unlisted scope is only escalated when the customer clearly introduces
  // an additional item; otherwise the bot can continue clarifying normally.
  return /\balso\b|也|另外|tambahan|juga/i.test(normalized);
}

function detectServices(text, options) {
  return detectServiceObjects(text, options).map((service) => service.name);
}

function detectService(text, options) {
  return detectCorrectedService(text) || detectServiceObjects(text, options)[0] || null;
}

module.exports = {
  detectService,
  detectServices,
  detectServiceObjects,
  detectCorrectedService,
  correctionTargetText,
  isUnconfiguredServiceRequest,
  normalizeText,
  isStandaloneScopeReply,
};
