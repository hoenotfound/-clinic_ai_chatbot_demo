const tcm = require("./tcmConfig");

const BOOKING = /\bbook(?:ing)?\b|\bappointment\b|\bslot\b|can\s+i\s+come|want\s+to\s+visit|boleh\s+datang|nak\s+datang|mahu\s+datang|tempah|temujanji|预约|預約|有空位|可以来|可以來|想来|想來/i;
const BRANCH = /petaling jaya|\bpj\b|kuala lumpur|\bkl\b|八打灵再也|八打靈再也|吉隆坡/i;
const CLOCK_TIME = /\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:am|pm)\b/i;
const TIMING = /weekend|saturday|sunday|weekday|morning|afternoon|evening|night|tomorrow|sabtu|ahad|hari biasa|pagi|petang|malam|esok|周末|週末|星期[一二三四五六日]|早上|上午|下午|晚上|明天|\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:am|pm)\b/i;
const BROWSING = /just checking|checking first|compare first|considering|check my schedule|tengok dulu|fikir dulu|先了解|先看看|比较一下|比較一下|考虑一下|考慮一下/i;
const NEGATIVE = /not interested|no longer interested|never ?mind|don['’]t want|do not want|not booking|cancel|no thanks|tak berminat|tidak berminat|tak nak|tak jadi|batal|不要了|不想做|没兴趣|沒興趣|算了|取消|不预约|不預約/i;
const PROCEEDING = /can\s+i\s+come|can\s*\??\s*$|boleh\s+(?:datang|book|tempah)|nak\s+datang|mahu\s+datang|可以吗|可以嗎|可以来|可以來|想来|想來|安排|预约|預約/i;
const PROMPT = /which branch|branch.*convenient|weekday|weekend|which day|what day|what time|preferred day|preferred time|tell me.*branch|branch.*(?:day|time)|arrange (?:a )?visit|cawangan|hari.*sesuai|masa.*sesuai|beritahu.*(?:branch|cawangan)|比较方便|比較方便|哪一天|告诉我.*branch|告訴我.*branch|日期|时段|時段|预约|預約|appointment/i;

function users(messages) {
  return (messages || []).filter((message) => message?.role === "user");
}

function activeMessages(messages) {
  const items = messages || [];
  let lastNegative = -1;
  for (let i = items.length - 1; i >= 0; i -= 1) {
    if (items[i]?.role === "user" && NEGATIVE.test(String(items[i].content || ""))) {
      lastNegative = i;
      break;
    }
  }
  return lastNegative >= 0 ? items.slice(lastNegative + 1) : items;
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

function clockTimeFromText(text) {
  const match = String(text || "").match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = String(match[2] || "00").padStart(2, "0");
  return `${hour}:${minute} ${match[3].toUpperCase()}`;
}

function timingFromText(text) {
  const value = String(text || "");
  const clock = clockTimeFromText(value);
  const part = /morning|pagi|早上|上午/i.test(value) ? "morning" : /afternoon|petang|下午/i.test(value) ? "afternoon" : /evening|night|malam|晚上/i.test(value) ? "evening" : null;
  const suffix = clock || part;
  if (/saturday|sabtu|星期六|周六|週六/i.test(value)) return suffix ? `Saturday${clock ? ", " : " "}${suffix}` : "Saturday";
  if (/sunday|ahad|星期日|周日|週日/i.test(value)) return suffix ? `Sunday${clock ? ", " : " "}${suffix}` : "Sunday";
  if (/weekday|hari biasa|平日|工作日/i.test(value)) return suffix ? `Weekday${clock ? ", " : ", "}${suffix}` : "Weekday";
  if (/weekend|周末|週末/i.test(value)) return suffix ? `Weekend${clock ? ", " : ", "}${suffix}` : "Weekend";
  if (/tomorrow|esok|明天/i.test(value)) return suffix ? `Tomorrow${clock ? ", " : " "}${suffix}` : "Tomorrow";
  if (clock) return clock;
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
  const active = activeMessages(messages);
  const customerMessages = users(active);
  const latest = String(customerMessages.at(-1)?.content || "");
  const all = customerMessages.map((message) => String(message.content || "")).join(" \n");
  if (!latest || BROWSING.test(latest)) return false;
  if (BOOKING.test(all)) return true;
  if (!recentService(active) || !branchFromMessages(active) || !timingFromMessages(active)) return false;
  if (!BRANCH.test(latest) && !TIMING.test(latest)) return false;
  return PROCEEDING.test(latest) || previousAssistantPrompted(active);
}

module.exports = { BOOKING, BRANCH, TIMING, CLOCK_TIME, BROWSING, NEGATIVE, serviceForText, recentService, branchFromMessages, clockTimeFromText, timingFromText, timingFromMessages, hasTcmBookingIntent };
