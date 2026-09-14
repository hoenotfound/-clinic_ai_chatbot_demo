const tcm = require("./tcmConfig");

const BOOKING = /\bbook(?:ing)?\b|\bappointment\b|\bslot\b|can\s+i\s+come|want\s+to\s+visit|boleh\s+datang|nak\s+datang|mahu\s+datang|tempah|temujanji|预约|預約|有空位|可以来|可以來|想来|想來/i;
const BRANCH = /petaling jaya|\bpj\b|kuala lumpur|\bkl\b|八打灵再也|八打靈再也|吉隆坡/i;
const TIMING = /weekend|saturday|sunday|weekday|morning|afternoon|evening|night|sabtu|ahad|hari biasa|pagi|petang|malam|周末|週末|星期[一二三四五六日]|早上|上午|下午|晚上/i;
const BROWSING = /just checking|checking first|compare first|considering|check my schedule|tengok dulu|fikir dulu|先了解|先看看|比较一下|比較一下|考虑一下|考慮一下/i;
const PROCEEDING = /can\s+i\s+come|can\s*\??\s*$|boleh\s+(?:datang|book|tempah)|nak\s+datang|mahu\s+datang|可以吗|可以嗎|可以来|可以來|想来|想來|安排|预约|預約/i;
const PROMPT = /which branch|branch.*convenient|weekday|weekend|which day|what day|what time|preferred day|preferred time|cawangan|hari.*sesuai|masa.*sesuai|比较方便|比較方便|哪一天|预约|預約|appointment/i;

function users(messages) {
  return (messages || []).filter((message) => message?.role === "user");
}

function serviceForText(text) {
  const lower = String(text || "").toLowerCase();
  return tcm.services.find((service) => [service.name, ...(service.aliases || [])].some((term) => lower.includes(String(term).toLowerCase()))) || null;
}

function recentService(messages) {
  for (const message of [...users(messages)].reverse()) {
    const service = serviceForText(message.content);
    if (service) return service;
  }
  return null;
}

function branchFromMessages(messages) {
  for (const message of [...users(messages)].reverse()) {
    const text = String(message.content || "");
    if (/petaling jaya|\bpj\b|八打灵再也|八打靈再也/i.test(text)) return "Petaling Jaya";
    if (/kuala lumpur|\bkl\b|bukit bintang|吉隆坡/i.test(text)) return "Kuala Lumpur";
  }
  return null;
}

function timingFromText(text) {
  const value = String(text || "");
  const part = /morning|pagi|早上|上午/i.test(value) ? "morning" : /afternoon|petang|下午/i.test(value) ? "afternoon" : /evening|night|malam|晚上/i.test(value) ? "evening" : null;
  if (/saturday|sabtu|星期六|周六|週六/i.test(value)) return part ? `Saturday ${part}` : "Saturday";
  if (/sunday|ahad|星期日|周日|週日/i.test(value)) return part ? `Sunday ${part}` : "Sunday";
  if (/weekday|hari biasa|平日|工作日/i.test(value)) return part ? `Weekday, ${part}` : "Weekday";
  if (/weekend|周末|週末/i.test(value)) return part ? `Weekend, ${part}` : "Weekend";
  if (part) return part[0].toUpperCase() + part.slice(1);
  return null;
}

function timingFromMessages(messages) {
  for (const message of [...users(messages)].reverse()) {
    const timing = timingFromText(message.content);
    if (timing) return timing;
  }
  return null;
}

function previousAssistantPrompted(messages) {
  let latestUser = -1;
  for (let i = (messages || []).length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") { latestUser = i; break; }
  }
  for (let i = latestUser - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "assistant") return PROMPT.test(String(messages[i].content || ""));
  }
  return false;
}

function hasTcmBookingIntent(messages) {
  const customerMessages = users(messages);
  const latest = String(customerMessages.at(-1)?.content || "");
  const all = customerMessages.map((message) => String(message.content || "")).join(" \n");
  if (BOOKING.test(all)) return true;
  if (!latest || BROWSING.test(latest)) return false;
  if (!recentService(messages) || !branchFromMessages(messages) || !timingFromMessages(messages)) return false;
  if (!BRANCH.test(latest) && !TIMING.test(latest)) return false;
  return PROCEEDING.test(latest) || previousAssistantPrompted(messages);
}

module.exports = { BOOKING, BRANCH, TIMING, BROWSING, serviceForText, recentService, branchFromMessages, timingFromText, timingFromMessages, hasTcmBookingIntent };
