const { bookingRuleViolation } = require("./clinicKnowledge");

function languageFor(text) {
  if (/\p{Script=Han}/u.test(String(text || ""))) return "zh";
  if (/\b(nak|boleh|harga|berapa|saya|cawangan|klinik|datang|ahad|sabtu|isnin|selasa|rabu|khamis|jumaat)\b/i.test(String(text || ""))) return "ms";
  return "en";
}

function closedDayReply(text, violation) {
  const lang = languageFor(text);
  const day = violation?.day || "that day";
  if (lang === "zh") {
    return `我们诊所星期日休息，所以不能安排星期日的预约。你要不要改成星期六或平日？`;
  }
  if (lang === "ms") {
    return `Klinik tutup pada hari Ahad, jadi appointment hari Ahad tak dapat dibuat. Sabtu atau hari biasa lebih sesuai untuk anda?`;
  }
  return `We're closed on Sundays, so I can't treat Sunday as an available appointment day. Would Saturday or a weekday work better for you?`;
}

function enforceBookingRules(messages) {
  const latest = String((messages || []).filter((message) => message?.role === "user").at(-1)?.content || "");
  const violation = bookingRuleViolation(latest);
  if (!violation) return null;
  if (violation.type === "closed_day") return closedDayReply(latest, violation);
  return null;
}

module.exports = { enforceBookingRules };
