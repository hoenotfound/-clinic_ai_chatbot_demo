const clinic = require("./clinicConfig");

const DEFAULT_CONCERN_MAPPINGS = [
  {
    concern: "double chin / jawline definition",
    aliases: ["double chin", "jawline", "v shape", "v-shape", "双下巴", "雙下巴", "下颌线", "下顎線"],
    services: ["HIFU Skin Lifting"],
    note: "Discuss HIFU as a common non-surgical tightening/contouring option. Do not promise fat loss or suitability.",
  },
  {
    concern: "wide jaw / jaw slimming",
    aliases: ["wide jaw", "square jaw", "jaw slimming", "face slimming", "masseter", "瘦脸", "瘦臉", "国字脸", "國字臉"],
    services: ["Botulinum Toxin", "HIFU Skin Lifting"],
    note: "Explain that muscle-related jaw width and skin/contour concerns are different. A clinician must identify the cause before choosing treatment.",
  },
  {
    concern: "pigmentation / melasma / dark spots",
    aliases: ["pigmentation", "melasma", "dark spot", "dark spots", "jeragat", "bintik hitam", "色斑", "黑斑", "晒斑", "曬斑"],
    services: ["Pico Laser"],
    note: "Discuss Pico Laser as a commonly used option for pigmentation concerns without diagnosing the type of pigmentation.",
  },
  {
    concern: "acne marks / uneven tone",
    aliases: ["acne marks", "acne mark", "uneven tone", "parut jerawat", "痘印", "肤色不均", "膚色不均"],
    services: ["Pico Laser"],
    note: "Use the configured Pico Laser description. Do not promise scar removal or a specific number of sessions.",
  },
  {
    concern: "dry / dehydrated / dull skin",
    aliases: ["dry skin", "dry", "dehydrated", "dehydration", "dull skin", "dull", "hydration", "kusam", "kering", "干燥", "乾燥", "缺水", "暗沉"],
    services: ["Skin Booster"],
    note: "Discuss Skin Booster as a hydration/skin-quality category. Product choice and suitability remain clinician decisions.",
  },
  {
    concern: "expression lines / wrinkles",
    aliases: ["wrinkles", "frown lines", "crow's feet", "expression lines", "皱纹", "皺紋", "鱼尾纹", "魚尾紋"],
    services: ["Botulinum Toxin"],
    note: "Discuss Botulinum Toxin for selected expression-line or muscle-related concerns. Never recommend units or dosage.",
  },
];

const DEFAULT_BOOKING_RULES = {
  openDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  closedDays: ["Sunday"],
};

function normalise(text) {
  return String(text || "").toLowerCase();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function configuredConcernMappings() {
  return Array.isArray(clinic.concernMappings) && clinic.concernMappings.length
    ? clinic.concernMappings
    : DEFAULT_CONCERN_MAPPINGS;
}

function configuredBookingRules() {
  const rules = clinic.bookingRules || {};
  return {
    openDays: Array.isArray(rules.openDays) && rules.openDays.length ? rules.openDays : DEFAULT_BOOKING_RULES.openDays,
    closedDays: Array.isArray(rules.closedDays) && rules.closedDays.length ? rules.closedDays : DEFAULT_BOOKING_RULES.closedDays,
  };
}

function matchesAny(text, terms = []) {
  const haystack = normalise(text);
  return terms.some((term) => haystack.includes(normalise(term)));
}

function detectConcernMappings(text) {
  return configuredConcernMappings().filter((mapping) =>
    matchesAny(text, [mapping.concern, ...(mapping.aliases || [])])
  );
}

function treatmentsForConcern(text) {
  return unique(detectConcernMappings(text).flatMap((mapping) => mapping.services || []));
}

function concernGuidanceForPrompt() {
  return configuredConcernMappings()
    .map((mapping) => {
      const aliases = (mapping.aliases || []).length ? ` | Terms: ${(mapping.aliases || []).join(", ")}` : "";
      const note = mapping.note ? ` | Guidance: ${mapping.note}` : "";
      return `- ${mapping.concern} -> ${(mapping.services || []).join(" / ")}${aliases}${note}`;
    })
    .join("\n");
}

function openingDays() {
  return configuredBookingRules().openDays.map((day) => normalise(day));
}

function closedDays() {
  return configuredBookingRules().closedDays.map((day) => normalise(day));
}

function extractRequestedDay(text) {
  const lower = normalise(text);
  const days = [
    ["monday", ["monday", "isnin", "星期一", "周一"]],
    ["tuesday", ["tuesday", "selasa", "星期二", "周二"]],
    ["wednesday", ["wednesday", "rabu", "星期三", "周三"]],
    ["thursday", ["thursday", "khamis", "星期四", "周四"]],
    ["friday", ["friday", "jumaat", "星期五", "周五"]],
    ["saturday", ["saturday", "sabtu", "星期六", "周六", "週六"]],
    ["sunday", ["sunday", "ahad", "星期日", "周日", "週日"]],
  ];
  for (const [day, terms] of days) {
    if (terms.some((term) => lower.includes(term.toLowerCase()))) return day;
  }
  return null;
}

function isClosedDay(day) {
  if (!day) return false;
  const normalized = normalise(day);
  if (closedDays().includes(normalized)) return true;
  const open = openingDays();
  return open.length > 0 && !open.includes(normalized);
}

function bookingRuleViolation(text) {
  const day = extractRequestedDay(text);
  if (day && isClosedDay(day)) {
    return {
      type: "closed_day",
      day,
      message: `${day.charAt(0).toUpperCase()}${day.slice(1)} is outside the configured clinic opening days.`,
    };
  }
  return null;
}

function bookingRulesForPrompt() {
  const rules = configuredBookingRules();
  return [
    `- Open days: ${rules.openDays.join(", ")}`,
    `- Closed days: ${rules.closedDays.join(", ")}`,
    `- Never accept, suggest or hand off a requested appointment on a configured closed day as if it were valid.`,
    `- If a visitor requests a closed day, explain the clinic is closed that day and ask for an open-day alternative.`,
    `- Never invent an exact available time. Staff confirms actual availability.`,
  ].join("\n");
}

module.exports = {
  detectConcernMappings,
  treatmentsForConcern,
  concernGuidanceForPrompt,
  extractRequestedDay,
  isClosedDay,
  bookingRuleViolation,
  bookingRulesForPrompt,
};
