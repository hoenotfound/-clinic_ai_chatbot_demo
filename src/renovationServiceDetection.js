const renovation = require("./renovationConfig");

const EXTRA_ALIASES = {
  "Kitchen Cabinets": [
    "kitchen",
    "kitchen carpentry",
    "kitchen cabinet",
    "kitchen cabinets",
    "dapur",
    "kabinet dapur",
    "cabinet dapur",
    "厨房",
    "廚房",
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

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
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
  return text.includes(normalizedTerm);
}

function detectServiceObjects(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  return renovation.services.filter((service) =>
    termsFor(service).some((term) => containsTerm(normalized, term))
  );
}

function detectServices(text) {
  return detectServiceObjects(text).map((service) => service.name);
}

function detectService(text) {
  return detectServiceObjects(text)[0] || null;
}

module.exports = {
  detectService,
  detectServices,
  detectServiceObjects,
  normalizeText,
};