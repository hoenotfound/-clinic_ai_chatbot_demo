const tcm = require("./tcmConfig");

const BOOKING = /\bbook(?:ing)?\b|\bappointment\b|\bslot\b|can\s+i\s+come|want\s+to\s+visit|boleh\s+datang|nak\s+datang|mahu\s+datang|tempah|temujanji|预约|預約|有空位|可以来|可以來|想来|想來/i;
const BRANCH = /petaling jaya|\bpj\b|kuala lumpur|\bkl\b|八打灵再也|八打靈再也|吉隆坡/i;
const CLOCK_TIME = /\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:am|pm)\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\bpukul\s*(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:pagi|petang|malam)\b|(?:早上|上午|下午|晚上)\s*(?:1[0-2]|0?[1-9])\s*(?:点|點)/i;
const TIMING = /weekend|weekday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|night|tomorrow|hari biasa|isnin|selasa|rabu|khamis|jumaat|sabtu|ahad|pagi|petang|malam|esok|周末|週末|星期[一二三四五六日]|周[一二三四五六日]|週[一二三四五六日]|早上|上午|下午|晚上|明天|\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:am|pm)\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\bpukul\s*(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:pagi|petang|malam)\b|(?:早上|上午|下午|晚上)\s*(?:1[0-2]|0?[1-9])\s*(?:点|點)/i;
const BROWSING = /just checking|checking first|compare first|considering|check my schedule|tengok dulu|fikir dulu|survey dulu|先了解|先看看|比较一下|比較一下|考虑一下|考慮一下/i;
const NEGATIVE = /not interested|no longer interested|never ?mind|don['’]t want|do not want|not booking|cancel|no thanks|tak berminat|tidak berminat|tak nak|tak jadi|batal|不要了|不想做|没兴趣|沒興趣|算了|取消|不预约|不預約/i;
const PROCEEDING = /can\s+i\s+come|can\s*\??\s*$|boleh\s+(?:datang|book|tempah)|nak\s+datang|mahu\s+datang|可以吗|可以嗎|可以来|可以來|想来|想來|安排|预约|預約/i;
const SERVICE_SCHEDULING_REQUEST = /(?:can|could)\s+i\s+(?:do|have|get)|boleh\s+(?:saya\s+)?(?:buat|ambil)|(?:nak|mahu)\s+(?:buat|ambil)|可以.{0,20}(?:吗|嗎)|能.{0,20}(?:吗|嗎)/i;
const PROMPT = /which branch|branch.*convenient|weekday|weekend|which day|what day|what time|preferred day|preferred time|tell me.*branch|branch.*(?:day|time)|arrange (?:a )?visit|cawangan|hari.*sesuai|masa.*sesuai|beritahu.*(?:branch|cawangan)|比较方便|比較方便|哪一天|告诉我.*branch|告訴我.*branch|日期|时段|時段|预约|預約|appointment/i;
const GENERIC_SERVICE_TERMS = new Set(["consultation"]);
const NEGATED_SERVICE_PREFIX = /(?:\bnot|\bno|\binstead\s+of|\brather\s+than|\bdon['’]?t\s+(?:want|need)|\bdo\s+not\s+(?:want|need)|\bno\s+longer\s+(?:want|need)|\bnot\s+interested\s+in|\bno\s+longer\s+interested\s+in|\bbukan|\btak\s+nak|\btak\s+mahu|\btidak\s+mahu|\bdah\s+tak\s+nak|\btak\s+berminat(?:\s+dengan)?|\btidak\s+berminat(?:\s+dengan)?|不要|不是|不做|不想做|不想要|不需要|不再想要|不再要)\s*[,:;\-–—]*\s*$/i;
const EXTRA_SERVICE_TERMS = {
  "Pelvic & Posture Manual Adjustment": ["rawatan postur", "rawatan pelvis", "pelarasan postur", "pelarasan pelvis"],
  "3D Facial Contour Manual Adjustment": ["rawatan muka 3d", "3d muka", "muka tak simetri", "muka tidak simetri"],
};

const DAY_PATTERNS = [
  ["Monday", /monday|isnin|星期一|周一|週一/i],
  ["Tuesday", /tuesday|selasa|星期二|周二|週二/i],
  ["Wednesday", /wednesday|rabu|星期三|周三|週三/i],
  ["Thursday", /thursday|khamis|星期四|周四|週四/i],
  ["Friday", /friday|jumaat|星期五|周五|週五/i],
  ["Saturday", /saturday|sabtu|星期六|周六|週六/i],
  ["Sunday", /sunday|ahad|星期日|周日|週日/i],
];

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

function serviceTerms(service) {
  return [service.name, ...(service.aliases || []), ...(EXTRA_SERVICE_TERMS[service.name] || [])]
    .map((term) => String(term || "").trim())
    .filter(Boolean);
}

function serviceTermIsNegated(lower, index) {
  const prefix = lower.slice(Math.max(0, index - 48), index);
  return NEGATED_SERVICE_PREFIX.test(prefix);
}

function rankedServiceCandidates(text) {
  const lower = String(text || "").toLowerCase();
  if (!lower) return [];
  const candidates = [];
  for (const service of tcm.services) {
    for (const term of serviceTerms(service)) {
      const normalizedTerm = term.toLowerCase();
      let index = lower.indexOf(normalizedTerm);
      while (index >= 0) {
        if (!serviceTermIsNegated(lower, index)) {
          const isOfficialName = normalizedTerm === String(service.name || "").toLowerCase();
          const isGeneric = GENERIC_SERVICE_TERMS.has(normalizedTerm);
          const score = (isOfficialName ? 10_000 : isGeneric ? 10 : 1_000) + normalizedTerm.length;
          candidates.push({ service, score, index, length: normalizedTerm.length, isGeneric });
        }
        index = lower.indexOf(normalizedTerm, index + normalizedTerm.length);
      }
    }
  }
  candidates.sort((left, right) => right.score - left.score || right.index - left.index || right.length - left.length);
  return candidates;
}

function genericTermBelongsToSpecificService(candidate, candidates, lower) {
  if (!candidate.isGeneric) return false;
  return candidates.some((other) => {
    if (other.isGeneric || other.service.name === candidate.service.name) return false;

    const candidateEnd = candidate.index + candidate.length;
    const otherEnd = other.index + other.length;
    if (candidate.index >= other.index && candidate.index <= otherEnd + 2) return true;

    if (other.index >= candidateEnd && other.index - candidateEnd <= 24) {
      const connector = lower.slice(candidateEnd, other.index);
      return /^\s*(?:for|about|regarding|with|of|[:\-–—])\s*$/i.test(connector);
    }
    return false;
  });
}

function servicesForText(text) {
  const lower = String(text || "").toLowerCase();
  const candidates = rankedServiceCandidates(text);
  const seen = new Set();
  const services = [];
  for (const candidate of candidates) {
    if (genericTermBelongsToSpecificService(candidate, candidates, lower)) continue;
    if (seen.has(candidate.service.name)) continue;
    seen.add(candidate.service.name);
    services.push(candidate.service);
  }
  return services;
}

function serviceForText(text) {
  return servicesForText(text)[0] || null;
}

function hasExplicitServiceRejection(text) {
  const lower = String(text || "").toLowerCase();
  if (!lower) return false;
  for (const service of tcm.services) {
    for (const term of serviceTerms(service)) {
      const normalizedTerm = term.toLowerCase();
      let index = lower.indexOf(normalizedTerm);
      while (index >= 0) {
        if (serviceTermIsNegated(lower, index)) return true;
        index = lower.indexOf(normalizedTerm, index + normalizedTerm.length);
      }
    }
  }
  return false;
}

function serviceSelectionFromMessages(messages) {
  for (const message of [...users(messages)].reverse()) {
    const service = serviceForText(message.content);
    if (service) return { service, cleared: false };
    if (hasExplicitServiceRejection(message.content)) return { service: null, cleared: true };
  }
  return { service: null, cleared: false };
}

function recentService(messages) {
  return serviceSelectionFromMessages(messages).service;
}

function branchFromMessages(messages) {
  for (const message of [...users(messages)].reverse()) {
    const text = String(message.content || "");
    if (/petaling jaya|\bpj\b|八打灵再也|八打靈再也/i.test(text)) return "Petaling Jaya";
    if (/kuala lumpur|\bkl\b|bukit bintang|吉隆坡/i.test(text)) return "Kuala Lumpur";
  }
  return null;
}

function toClockLabel(minutes) {
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

function clockTimeDetailsFromText(text) {
  const value = String(text || "");

  let match = value.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i);
  if (match) {
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const period = match[3].toLowerCase();
    if (period === "pm" && hour !== 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;
    const minutes = hour * 60 + minute;
    return { minutes, label: toClockLabel(minutes) };
  }

  match = value.match(/\b(?:pukul\s*)?(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(pagi|petang|malam)\b/i);
  if (match) {
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const part = match[3].toLowerCase();
    if (part === "malam" && hour === 12) {
      hour = 0;
    } else if (part !== "pagi" && hour !== 12) {
      hour += 12;
    } else if (part === "pagi" && hour === 12) {
      hour = 0;
    }
    const minutes = hour * 60 + minute;
    return { minutes, label: toClockLabel(minutes) };
  }

  match = value.match(/(?:早上|上午|下午|晚上)\s*(1[0-2]|0?[1-9])\s*(?:点|點)(?:\s*([0-5]?\d)\s*分?)?/i);
  if (match) {
    const partMatch = value.match(/(早上|上午|下午|晚上)\s*(?:1[0-2]|0?[1-9])\s*(?:点|點)/i);
    const part = partMatch?.[1] || "";
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    if (part === "晚上" && hour === 12) {
      hour = 0;
    } else if (/下午|晚上/.test(part) && hour !== 12) {
      hour += 12;
    } else if (/早上|上午/.test(part) && hour === 12) {
      hour = 0;
    }
    const minutes = hour * 60 + minute;
    return { minutes, label: toClockLabel(minutes) };
  }

  match = value.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (match) {
    const minutes = Number(match[1]) * 60 + Number(match[2]);
    return { minutes, label: toClockLabel(minutes) };
  }

  return null;
}

function clockTimeFromText(text) {
  return clockTimeDetailsFromText(text)?.label || null;
}

function timingFromText(text) {
  const value = String(text || "");
  const clock = clockTimeFromText(value);
  const part = /morning|pagi|早上|上午/i.test(value) ? "morning" : /afternoon|petang|下午/i.test(value) ? "afternoon" : /evening|night|malam|晚上/i.test(value) ? "evening" : null;
  const suffix = clock || part;

  for (const [day, pattern] of DAY_PATTERNS) {
    if (pattern.test(value)) return suffix ? `${day}${clock ? ", " : " "}${suffix}` : day;
  }

  if (/weekday|hari biasa|平日|工作日/i.test(value)) return suffix ? `Weekday, ${suffix}` : "Weekday";
  if (/weekend|周末|週末/i.test(value)) return suffix ? `Weekend, ${suffix}` : "Weekend";
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

function hasDirectServiceSchedulingRequest(text) {
  return Boolean(serviceForText(text)) && TIMING.test(String(text || "")) && SERVICE_SCHEDULING_REQUEST.test(String(text || ""));
}

function messagesAfterLatestBrowsing(messages) {
  const customerMessages = users(messages);
  let lastBrowsing = -1;
  for (let i = customerMessages.length - 1; i >= 0; i -= 1) {
    const text = String(customerMessages[i]?.content || "");
    const freshBookingSignal = BOOKING.test(text) || hasDirectServiceSchedulingRequest(text);
    if (BROWSING.test(text) && !freshBookingSignal) {
      lastBrowsing = i;
      break;
    }
  }
  return lastBrowsing >= 0 ? customerMessages.slice(lastBrowsing + 1) : customerMessages;
}

function hasTcmBookingIntent(messages) {
  const active = activeMessages(messages);
  const customerMessages = users(active);
  const latest = String(customerMessages.at(-1)?.content || "");
  if (!latest) return false;

  const freshBookingSignal = BOOKING.test(latest) || hasDirectServiceSchedulingRequest(latest);
  if (BROWSING.test(latest) && !freshBookingSignal) return false;
  if (freshBookingSignal) return true;

  const intentMessages = messagesAfterLatestBrowsing(active);
  const intentText = intentMessages.map((message) => String(message.content || "")).join(" \n");
  if (BOOKING.test(intentText)) return true;
  if (!recentService(active) || !branchFromMessages(active) || !timingFromMessages(active)) return false;
  if (!BRANCH.test(latest) && !TIMING.test(latest)) return false;
  return PROCEEDING.test(latest) || previousAssistantPrompted(active);
}

module.exports = {
  BOOKING,
  BRANCH,
  TIMING,
  CLOCK_TIME,
  BROWSING,
  NEGATIVE,
  SERVICE_SCHEDULING_REQUEST,
  activeMessages,
  servicesForText,
  serviceForText,
  hasExplicitServiceRejection,
  serviceSelectionFromMessages,
  recentService,
  branchFromMessages,
  clockTimeDetailsFromText,
  clockTimeFromText,
  timingFromText,
  timingFromMessages,
  previousAssistantPrompted,
  hasDirectServiceSchedulingRequest,
  hasTcmBookingIntent,
};
