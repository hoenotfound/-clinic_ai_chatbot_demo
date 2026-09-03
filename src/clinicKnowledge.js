const clinic = require("./clinicConfig");

function normalise(text) {
  return String(text || "").toLowerCase();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function configuredConcernMappings() {
  return Array.isArray(clinic.concernMappings) ? clinic.concernMappings : [];
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
  const rules = clinic.bookingRules || {};
  return Array.isArray(rules.openDays) ? rules.openDays.map((day) => normalise(day)) : [];
}

function closedDays() {
  const rules = clinic.bookingRules || {};
  return Array.isArray(rules.closedDays) ? rules.closedDays.map((day) => normalise(day)) : [];
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
  const rules = clinic.bookingRules || {};
  const open = Array.isArray(rules.openDays) ? rules.openDays.join(", ") : "Use configured clinic hours";
  const closed = Array.isArray(rules.closedDays) && rules.closedDays.length ? rules.closedDays.join(", ") : "None specified";
  return [
    `- Open days: ${open}`,
    `- Closed days: ${closed}`,
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
