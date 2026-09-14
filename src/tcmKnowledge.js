const tcm = require("./tcmConfig");

const DEFAULT_CONCERN_MAPPINGS = [
  {
    concern: "shoulder / neck tightness or discomfort",
    aliases: ["shoulder pain", "neck pain", "shoulder tight", "neck tight", "肩颈", "肩頸", "颈痛", "頸痛", "肩膀痛", "leher sakit", "bahu sakit"],
    services: ["Acupuncture", "Tuina"],
    note: "Present these only as service categories the practitioner may discuss. Do not diagnose the cause.",
  },
  {
    concern: "lower-back discomfort",
    aliases: ["lower back", "back pain", "back ache", "腰酸", "腰痛", "腰疼", "sakit belakang", "sakit pinggang"],
    services: ["Acupuncture", "Tuina"],
    note: "Do not diagnose the cause or promise pain relief.",
  },
  {
    concern: "sleep / stress concern",
    aliases: ["sleep", "insomnia", "stress", "can't sleep", "cannot sleep", "失眠", "睡不好", "压力", "壓力", "susah tidur", "stres"],
    services: ["TCM Consultation", "Acupuncture"],
    note: "Do not diagnose the reason for sleep or stress symptoms.",
  },
  {
    concern: "digestive concern",
    aliases: ["digestion", "digestive", "bloating", "stomach discomfort", "消化", "胃胀", "胃脹", "肚子胀", "肚子脹", "kembung"],
    services: ["TCM Consultation", "Chinese Herbal Medicine Consultation"],
    note: "Practitioner review is required before personalised herbal advice.",
  },
  {
    concern: "women's wellness concern",
    aliases: ["period", "menstrual", "menstruation", "经期", "經期", "月经", "月經", "senggugut", "haid"],
    services: ["TCM Consultation"],
    note: "Do not diagnose menstrual or reproductive conditions.",
  },
];

function normalise(text) {
  return String(text || "").toLowerCase();
}

function mappings() {
  return Array.isArray(tcm.concernMappings) && tcm.concernMappings.length
    ? tcm.concernMappings
    : DEFAULT_CONCERN_MAPPINGS;
}

function detectConcernMappings(text) {
  const haystack = normalise(text);
  return mappings().filter((mapping) =>
    [mapping.concern, ...(mapping.aliases || [])].some((term) => haystack.includes(normalise(term)))
  );
}

function concernGuidanceForPrompt() {
  return mappings().map((mapping) => {
    const aliases = mapping.aliases?.length ? ` | Terms: ${mapping.aliases.join(", ")}` : "";
    const note = mapping.note ? ` | Guidance: ${mapping.note}` : "";
    return `- ${mapping.concern} -> ${(mapping.services || []).join(" / ")}${aliases}${note}`;
  }).join("\n");
}

function configuredBookingRules() {
  const rules = tcm.bookingRules || {};
  return {
    openDays: Array.isArray(rules.openDays) && rules.openDays.length ? rules.openDays : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    closedDays: Array.isArray(rules.closedDays) && rules.closedDays.length ? rules.closedDays : ["Sunday"],
  };
}

function extractRequestedDay(text) {
  const lower = normalise(text);
  const days = [
    ["monday", ["monday", "isnin", "星期一", "周一", "週一"]],
    ["tuesday", ["tuesday", "selasa", "星期二", "周二", "週二"]],
    ["wednesday", ["wednesday", "rabu", "星期三", "周三", "週三"]],
    ["thursday", ["thursday", "khamis", "星期四", "周四", "週四"]],
    ["friday", ["friday", "jumaat", "星期五", "周五", "週五"]],
    ["saturday", ["saturday", "sabtu", "星期六", "周六", "週六"]],
    ["sunday", ["sunday", "ahad", "星期日", "周日", "週日"]],
  ];
  for (const [day, terms] of days) {
    if (terms.some((term) => lower.includes(term))) return day;
  }
  return null;
}

function bookingRuleViolation(text) {
  const day = extractRequestedDay(text);
  if (!day) return null;
  const rules = configuredBookingRules();
  const open = rules.openDays.map(normalise);
  const closed = rules.closedDays.map(normalise);
  if (closed.includes(day) || (open.length && !open.includes(day))) {
    return { type: "closed_day", day };
  }
  return null;
}

function bookingRulesForPrompt() {
  const rules = configuredBookingRules();
  return [
    `- Open days: ${rules.openDays.join(", ")}`,
    `- Closed days: ${rules.closedDays.join(", ")}`,
    "- Never invent appointment availability or confirm a slot as booked.",
    "- If a customer requests a closed day, explain it is closed and ask for another day.",
  ].join("\n");
}

module.exports = {
  detectConcernMappings,
  concernGuidanceForPrompt,
  extractRequestedDay,
  bookingRuleViolation,
  bookingRulesForPrompt,
};
