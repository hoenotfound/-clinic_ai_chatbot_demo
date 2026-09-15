const tcm = require("./tcmConfig");
const { bookingRuleViolation } = require("./tcmKnowledge");
const { hasTcmBookingIntent, clockTimeDetailsFromText } = require("./tcmBookingIntent");

const BOOKING_CONTEXT = /book|appointment|slot|available|come|visit|arrange|consultation|tempah|temujanji|datang|预约|預約|有空位|想来|想來|咨询|諮詢/i;

function latestUserText(messages) {
  return String((messages || []).filter((message) => message?.role === "user").at(-1)?.content || "");
}

function languageFor(text) {
  if (/\p{Script=Han}/u.test(String(text || ""))) return "zh";
  if (/\b(nak|boleh|saya|datang|isnin|selasa|rabu|khamis|jumaat|sabtu|ahad|pagi|petang|malam|pukul|cuti\s+umum|hari\s+kelepasan\s+am)\b/i.test(String(text || ""))) return "ms";
  return "en";
}

function configuredHours() {
  const matches = [...String(tcm.hours?.general || "").matchAll(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/gi)];
  if (matches.length < 2) return { open: 600, close: 1140 };
  const toMinutes = (match) => {
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const period = String(match[3]).toLowerCase();
    if (period === "pm" && hour !== 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;
    return hour * 60 + minute;
  };
  return { open: toMinutes(matches[0]), close: toMinutes(matches[1]) };
}

function requestedTime(text) {
  return clockTimeDetailsFromText(text)?.minutes ?? null;
}

function closureReply(lang, type) {
  if (type === "public_holiday") {
    if (lang === "zh") return "公共假期休息，所以当天不能安排预约。可以告诉我另一个方便的日期吗？";
    if (lang === "ms") return "Pusat TCM tutup pada cuti umum, jadi appointment tak boleh diatur pada hari itu. Boleh pilih hari lain yang sesuai?";
    return "The TCM centre is closed on public holidays, so an appointment can't be arranged that day. Would another day work?";
  }
  if (lang === "zh") return "我们星期日休息，所以星期日不能安排预约。星期六或平日哪一天比较方便？";
  if (lang === "ms") return "Pusat TCM tutup pada hari Ahad. Sabtu atau hari biasa lebih sesuai?";
  return "The TCM centre is closed on Sundays. Would Saturday or a weekday work better?";
}

function enforceTcmBookingRules(messages) {
  const latest = latestUserText(messages);
  if (!latest) return null;

  const violation = bookingRuleViolation(latest);
  const time = requestedTime(latest);
  const hasBookingContext = BOOKING_CONTEXT.test(latest) || hasTcmBookingIntent(messages);
  if (!hasBookingContext) return null;

  const lang = languageFor(latest);
  if (violation?.type === "closed_day" || violation?.type === "public_holiday") {
    return closureReply(lang, violation.type);
  }

  if (time !== null) {
    const { open, close } = configuredHours();
    if (time < open || time >= close) {
      if (lang === "zh") return "这个时间不在营业时段内。营业时间是星期一到星期六，10:00 AM–7:00 PM。可以换一个时间吗？";
      if (lang === "ms") return "Masa itu di luar waktu operasi. Waktu operasi Isnin hingga Sabtu ialah 10:00 AM–7:00 PM. Boleh pilih masa lain?";
      return "That time is outside operating hours. We’re open Monday–Saturday, 10:00 AM–7:00 PM. Would another time work?";
    }
  }
  return null;
}

module.exports = { enforceTcmBookingRules, _test: { configuredHours, requestedTime, languageFor, closureReply } };
