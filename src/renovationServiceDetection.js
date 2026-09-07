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
const CARPENTRY_SCOPE_NOUN_PATTERN = /\b(?:cabinet(?:s)?|carpentry|built[- ]?ins?|counter(?:s)?)\b|柜|櫃|木工|收纳|收納/i;
const NEW_SCOPE_REQUEST_PATTERN = /\b(?:do|does|can|could|would)\s+(?:you|your\s+team)\s+(?:also\s+)?(?:do|build|make|provide|offer)|\b(?:i|we)\s+(?:also\s+)?(?:want|need|am\s+looking\s+for|are\s+looking\s+for)|\b(?:also\s+)?(?:need|want)\s+(?:a\s+|some\s+)?(?:new\s+)?|\b(?:ada|boleh|nak|mahu)\s+(?:buat|buatkan)?\b|(?:有做|也做|可以做|能做|想做|要做)/i;
const UNCONFIGURED_SCOPE_HINT_PATTERN = /\b(?:reception|vanity|bathroom|toilet|laundry|altar|prayer|bar|clinic|reception\s+counter|cashier\s+counter)\b|接待|前台|浴室|厕所|廁所|洗衣|神台|祈祷|祈禱|诊所|診所/i;
const KNOWN_SCOPE_REFERENCE_PATTERN = /\b(?:this|that|the|same|my|our|existing)\s+(?:cabinet(?:s)?|carpentry|built[- ]?in)\b|这个柜|這個櫃|同一个柜|同一個櫃|这个木工|這個木工/i;

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

function detectCorrectedService(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  // Explicit replacement phrases. The wanted service is on the LEFT.
  for (const pattern of [
    /^(.+?)\s+instead\s+of\s+(.+)$/i,
    /^(.+?)\s+rather\s+than\s+(.+)$/i,
    /^(.+?)[,;]\s*(?:not|bukan)\s+(.+)$/i,
    /^(.+?)\s+(?:not|bukan)\s+(.+)$/i,
    /^(.+?)\s*(?:而不是|而非)\s*(.+)$/i,
    /^(.+?)[,，;]\s*(?:不是|不要)\s*(.+)$/i,
  ]) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const corrected = correctedPair(match[1], match[2]);
    if (corrected) return corrected;
  }

  // Explicit rejection followed by the replacement. The wanted service is on the RIGHT.
  for (const pattern of [
    /^(?:not|bukan)\s+(.+?)[,;]\s*(?:actually\s+|but\s+|instead\s+)?(.+)$/i,
    /^(?:not|bukan)\s+(.+?)\s+(?:but|actually|instead)\s+(.+)$/i,
    /^(?:不是|不要)\s*(.+?)[,，;]\s*(?:而是|是|要|改做|改成)?\s*(.+)$/i,
  ]) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const corrected = correctedPair(match[2], match[1]);
    if (corrected) return corrected;
  }

  // Direct switch/change wording can replace scope even when the old service is omitted.
  for (const pattern of [
    /\b(?:switch|change)\s+(?:it\s+)?to\s+([^,.;!?]+)/i,
    /(?:改成|改做|换成|換成|应该是|應該是)\s*([^，。！？,!?]+)/i,
  ]) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const target = serviceFromSegment(match[1]);
    if (target) return target;
  }

  return null;
}

function isUnconfiguredServiceRequest(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  if (detectServiceObjects(normalized, { allowBareScope: false }).length) return false;
  if (!CARPENTRY_SCOPE_NOUN_PATTERN.test(normalized) || !NEW_SCOPE_REQUEST_PATTERN.test(normalized)) return false;

  // A reference such as "make the cabinet taller" is a follow-up about the known
  // project, not a new service request. "Also" or a clearly unsupported cabinet
  // type, however, indicates a new scope that the configured demo cannot confirm.
  if (KNOWN_SCOPE_REFERENCE_PATTERN.test(normalized) && !/\balso\b|也|另外|tambahan|juga/i.test(normalized)) return false;
  return /\balso\b|也|另外|tambahan|juga/i.test(normalized) || UNCONFIGURED_SCOPE_HINT_PATTERN.test(normalized);
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
  isUnconfiguredServiceRequest,
  normalizeText,
  isStandaloneScopeReply,
};
