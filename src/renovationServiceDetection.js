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
  return Boolean(allowBareScope) || isStandaloneScopeReply(normalized, term);
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

function detectServices(text, options) {
  return detectServiceObjects(text, options).map((service) => service.name);
}

function detectService(text, options) {
  return detectServiceObjects(text, options)[0] || null;
}

module.exports = {
  detectService,
  detectServices,
  detectServiceObjects,
  normalizeText,
  isStandaloneScopeReply,
};
