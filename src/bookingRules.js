const clinic = require("./clinicConfig");
const { bookingRuleViolation } = require("./clinicKnowledge");

const BOOKING_CONTEXT = /\bbook(?:ing)?\b|appointment|slot|available|can\s+i\s+do|want\s+to\s+do|come|visit|arrange|tempah|temujanji|boleh\s+saya\s+buat|nak\s+buat|mahu\s+buat|datang|预约|預約|我可以做|想做|有空位|想来|想來|来咨询|來諮詢/i;
const BOOKING_QUESTION = /which.*branch|weekday|weekend|what day|which day|what time|morning|afternoon|evening|preferred.*(?:day|time)|confirm.*availability|cawangan|hari.*sesuai|pukul|哪.*(?:天|时间|時間)|什么时候|什麼時候/i;

function languageFor(text) {
  if (/\p{Script=Han}/u.test(String(text || ""))) return "zh";
  if (/\b(nak|boleh|harga|berapa|saya|cawangan|klinik|datang|ahad|sabtu|isnin|selasa|rabu|khamis|jumaat|pukul|pagi|petang|malam)\b/i.test(String(text || ""))) return "ms";
  return "en";
}

function closedDayReply(text) {
  const lang = languageFor(text);
  if (lang === "zh") return "我们诊所星期日休息，所以不能安排星期日的预约。你要不要改成星期六或平日？";
  if (lang === "ms") return "Klinik tutup pada hari Ahad, jadi appointment hari Ahad tak dapat dibuat. Sabtu atau hari biasa lebih sesuai untuk anda?";
  return "We're closed on Sundays, so Sunday isn't available for appointments. Would Saturday or a weekday work better for you?";
}

function hasBookingContext(messages, latest) {
  if (BOOKING_CONTEXT.test(latest)) return true;
  const previousAssistant = [...(messages || [])]
    .reverse()
    .find((message) => message?.role === "assistant");
  return BOOKING_QUESTION.test(String(previousAssistant?.content || ""));
}

function clockToMinutes(hour, minute = 0, period = null) {
  let h = Number(hour);
  const m = Number(minute || 0);
  if (!Number.isFinite(h) || !Number.isFinite(m) || m < 0 || m > 59) return null;
  if (period) {
    const normalized = String(period).toLowerCase();
    if (h < 1 || h > 12) return null;
    if (normalized === "pm" && h !== 12) h += 12;
    if (normalized === "am" && h === 12) h = 0;
  } else if (h < 0 || h > 23) {
    return null;
  }
  return h * 60 + m;
}

function configuredOperatingWindow() {
  const text = String(clinic.hours?.general || "");
  const matches = [...text.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/gi)];
  if (matches.length < 2) return { open: 10 * 60, close: 19 * 60 };
  return {
    open: clockToMinutes(matches[0][1], matches[0][2], matches[0][3]),
    close: clockToMinutes(matches[1][1], matches[1][2], matches[1][3]),
  };
}

function extractRequestedTime(text) {
  const value = String(text || "");

  const twelveHour = value.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (twelveHour) return clockToMinutes(twelveHour[1], twelveHour[2], twelveHour[3]);

  const twentyFourHour = value.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFourHour) return clockToMinutes(twentyFourHour[1], twentyFourHour[2]);

  const malay = value.match(/pukul\s*(\d{1,2})(?::(\d{2}))?\s*(pagi|petang|malam)/i);
  if (malay) {
    const period = /petang|malam/i.test(malay[3]) ? "pm" : "am";
    return clockToMinutes(malay[1], malay[2], period);
  }

  const chinese = value.match(/(上午|早上|下午|晚上)\s*(\d{1,2})(?:[:：点點时時]\s*(\d{1,2}))?/);
  if (chinese) {
    const period = /下午|晚上/.test(chinese[1]) ? "pm" : "am";
    return clockToMinutes(chinese[2], chinese[3], period);
  }

  return null;
}

function outsideHoursReply(text) {
  const lang = languageFor(text);
  if (lang === "zh") return "诊所营业时间是星期一至六 10:00 AM–7:00 PM，所以这个时间不在营业时段内。你可以选 10am 到 7pm 之前的时间，实际 available slot 会由 clinic team 确认。";
  if (lang === "ms") return "Waktu operasi clinic ialah Isnin–Sabtu, 10:00 AM–7:00 PM, jadi masa itu di luar waktu operasi. Pilih masa antara 10am dan sebelum 7pm ya; team clinic akan confirm slot sebenar.";
  return "Our clinic hours are Monday–Saturday, 10:00 AM–7:00 PM, so that requested time is outside operating hours. Please choose a time from 10am to before 7pm; the clinic team will confirm the actual slot.";
}

function enforceBookingRules(messages) {
  const latest = String((messages || []).filter((message) => message?.role === "user").at(-1)?.content || "");
  if (!hasBookingContext(messages, latest)) return null;

  const violation = bookingRuleViolation(latest);
  if (violation?.type === "closed_day") return closedDayReply(latest);

  const requestedTime = extractRequestedTime(latest);
  if (requestedTime !== null) {
    const { open, close } = configuredOperatingWindow();
    if (Number.isFinite(open) && Number.isFinite(close) && (requestedTime < open || requestedTime >= close)) {
      return outsideHoursReply(latest);
    }
  }
  return null;
}

module.exports = {
  enforceBookingRules,
  _test: {
    hasBookingContext,
    clockToMinutes,
    configuredOperatingWindow,
    extractRequestedTime,
  },
};
