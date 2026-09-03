const { bookingRuleViolation } = require("./clinicKnowledge");
const { enforceSafetyRules } = require("./safetyRules");

const BOOKING_CONTEXT = /\bbook(?:ing)?\b|appointment|slot|available|come|visit|arrange|tempah|temujanji|datang|预约|預約|有空位|想来|想來|来咨询|來諮詢/i;
const BOOKING_QUESTION = /which.*branch|weekday|weekend|what day|which day|morning|afternoon|evening|preferred.*(?:day|time)|confirm.*availability|cawangan|hari.*sesuai|哪.*(?:天|时间|時間)|什么时候|什麼時候/i;

function languageFor(text) {
  if (/\p{Script=Han}/u.test(String(text || ""))) return "zh";
  if (/\b(nak|boleh|harga|berapa|saya|cawangan|klinik|datang|ahad|sabtu|isnin|selasa|rabu|khamis|jumaat)\b/i.test(String(text || ""))) return "ms";
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

function enforceBookingRules(messages) {
  // This is the deterministic pre-provider guard used by aiService. Safety takes
  // precedence so high-risk messages can never be treated as routine booking chat.
  const safetyReply = enforceSafetyRules(messages);
  if (safetyReply) return safetyReply;

  const latest = String((messages || []).filter((message) => message?.role === "user").at(-1)?.content || "");
  if (!hasBookingContext(messages, latest)) return null;
  const violation = bookingRuleViolation(latest);
  if (!violation) return null;
  if (violation.type === "closed_day") return closedDayReply(latest);
  return null;
}

module.exports = { enforceBookingRules, _test: { hasBookingContext } };
