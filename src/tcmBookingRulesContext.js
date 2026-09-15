const { enforceTcmBookingRules: baseBookingRules, _test: bookingHelpers } = require("./tcmBookingRules");
const { bookingRuleViolation } = require("./tcmKnowledge");
const { previousAssistantPrompted } = require("./tcmBookingIntent");

function latestUserText(messages) {
  return String((messages || []).filter((message) => message?.role === "user").at(-1)?.content || "");
}

function languageFor(text) {
  if (/\p{Script=Han}/u.test(text)) return "zh";
  if (/\b(isnin|selasa|rabu|khamis|jumaat|sabtu|ahad|pagi|petang|malam|boleh|saya|cuti\s+umum|hari\s+kelepasan\s+am)\b/i.test(text)) return "ms";
  return "en";
}

function closureReply(lang, type) {
  if (type === "public_holiday") {
    if (lang === "zh") return "TCM centre 公共假期休息，所以当天不能安排预约。可以告诉我另一个方便的日期吗？";
    if (lang === "ms") return "Pusat TCM tutup pada cuti umum, jadi appointment tak boleh diatur pada hari itu. Boleh pilih hari lain yang sesuai?";
    return "The TCM centre is closed on public holidays, so an appointment can't be arranged that day. Would another day work?";
  }
  if (lang === "zh") return "我们星期日休息，所以星期日不能安排预约。星期六或平日哪一天比较方便？";
  if (lang === "ms") return "Pusat TCM tutup pada hari Ahad. Sabtu atau hari biasa lebih sesuai?";
  return "The TCM centre is closed on Sundays. Would Saturday or a weekday work better?";
}

function outsideHoursReply(lang) {
  if (lang === "zh") return "这个时间不在营业时段内。团队会根据营业时间跟你确认其他时间。";
  if (lang === "ms") return "Masa itu di luar waktu operasi. Team akan confirm pilihan masa lain dengan anda.";
  return "That time is outside operating hours. The team can confirm another available time with you.";
}

function enforceTcmBookingRules(messages) {
  const baseReply = baseBookingRules(messages);
  if (baseReply) return baseReply;
  if (!previousAssistantPrompted(messages)) return null;

  const latest = latestUserText(messages);
  if (!latest) return null;
  const lang = languageFor(latest);
  const violation = bookingRuleViolation(latest);
  if (violation?.type === "closed_day" || violation?.type === "public_holiday") {
    return closureReply(lang, violation.type);
  }

  const time = bookingHelpers.requestedTime(latest);
  if (time !== null) {
    const { open, close } = bookingHelpers.configuredHours();
    if (time < open || time >= close) return outsideHoursReply(lang);
  }
  return null;
}

module.exports = { enforceTcmBookingRules };
