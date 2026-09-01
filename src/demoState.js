const crypto = require("crypto");
const clinic = require("./clinicConfig");

const CHANNELS = new Set(["whatsapp", "instagram", "facebook"]);
const sessions = new Map();
const ipCreations = new Map();
const dailyMessageCounts = new Map();

const PRICE_PATTERN = /\bprice\b|how much|\bcost\b|rm\s?\d|promo|package|harga|berapa|\bkos\b|promosi|pakej|多少钱|多少錢|价格|價格|价钱|價錢|收费|收費/i;
const INTEREST_PATTERN = /\binterested\b|want to|suitable|works?\s+for\s+me|\bresult\b|\bberminat\b|nak buat|mahu buat|sesuai|hasil|有兴趣|有興趣|想做|想了解|适合|適合|效果/i;
const CONTACT_PATTERN = /my number|call me|contact me|hubungi saya|telefon saya|nombor saya|联系我|聯繫我|打给我|打給我/i;
const BOOKING_PATTERN = /\bbook(?:ing)?\b|\bappointment\b|\bslot\b|available\s+(?:slot|appointment|time)|can\s+i\s+come|come\s+in|visit\s+(?:the\s+)?clinic|want\s+to\s+visit|\btempah\b|\btemujanji\b|janji\s+temu|ada\s+slot|boleh\s+datang|nak\s+datang|mahu\s+datang|预约|預約|约(?:个)?时间|約(?:個)?時間|有空位|可以来|可以來|想来|想來|来咨询|來諮詢/i;
const NEGATIVE_PATTERN = /not interested|no longer interested|never ?mind|don['’]t want|do not want|not booking|cancel(?: it| that| my appointment)?|no thanks|tak berminat|tidak berminat|tak nak|tidak mahu|tak jadi|tidak jadi|\bbatal\b|不要了|不想做|没兴趣|沒興趣|算了|取消|不预约|不預約/i;
const TIMING_PATTERN = /weekend|saturday|sunday|weekday|monday|tuesday|wednesday|thursday|friday|morning|afternoon|evening|night|hujung minggu|sabtu|ahad|hari biasa|isnin|selasa|rabu|khamis|jumaat|pagi|petang|malam|周末|週末|周六|週六|星期六|周日|週日|星期日|平日|工作日|星期一|星期二|星期三|星期四|星期五|早上|上午|下午|晚上/i;
const BRANCH_PATTERN = /petaling jaya|\bpj\b|kuala lumpur|\bkl\b|bukit bintang|八打灵再也|八打靈再也|吉隆坡/i;

function intEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const limits = {
  sessionMinutes: intEnv("DEMO_SESSION_MINUTES", 60),
  maxMessages: intEnv("DEMO_MAX_MESSAGES", 30),
  maxSessionsPerIpDay: intEnv("DEMO_MAX_SESSIONS_PER_IP_DAY", 20),
  maxTotalMessagesPerDay: intEnv("DEMO_MAX_TOTAL_MESSAGES_PER_DAY", 500),
  minMessageIntervalMs: intEnv("DEMO_MIN_MESSAGE_INTERVAL_MS", 900),
};

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

function touchSession(session) {
  const now = Date.now();
  session.updatedAt = now;
  session.expiresAt = now + limits.sessionMinutes * 60_000;
}

function enforceSessionCreationLimit(ip) {
  const key = `${ip || "unknown"}:${dayKey()}`;
  const count = ipCreations.get(key) || 0;
  if (count >= limits.maxSessionsPerIpDay) {
    const err = new Error("You’ve reached today’s demo-session limit. Please try again later.");
    err.statusCode = 429;
    throw err;
  }
  ipCreations.set(key, count + 1);
}

function enforceDailyMessageLimit() {
  const key = dayKey();
  const count = dailyMessageCounts.get(key) || 0;
  if (count >= limits.maxTotalMessagesPerDay) {
    const err = new Error("Today’s public demo message limit has been reached. Please try again later.");
    err.statusCode = 429;
    throw err;
  }
  dailyMessageCounts.set(key, count + 1);
}

function createSession({ channel = "whatsapp", ip = "unknown" } = {}) {
  enforceSessionCreationLimit(ip);
  const safeChannel = CHANNELS.has(channel) ? channel : "whatsapp";
  const now = Date.now();
  const session = {
    id: crypto.randomUUID(),
    channel: safeChannel,
    mode: "ai",
    messages: [],
    createdAt: now,
    updatedAt: now,
    expiresAt: now + limits.sessionMinutes * 60_000,
    customerMessageCount: 0,
    lastCustomerMessageAt: 0,
    staffMessageCount: 0,
    lastStaffMessageAt: 0,
    needsAttention: false,
    attentionReason: null,
    promotionShown: false,
    promotionAfterMessageId: null,
    lead: {
      temperature: "cold",
      score: 0,
      interests: [],
      bookingIntent: false,
      reducedInterest: false,
      preferredTiming: null,
      preferredBranch: null,
      summary: "No conversation yet.",
    },
  };
  sessions.set(session.id, session);
  return session;
}

function getSession(id) {
  const session = sessions.get(id);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(id);
    return null;
  }
  return session;
}

function requireSession(id) {
  const session = getSession(id);
  if (!session) {
    const err = new Error("This demo session has expired. Start a new demo to continue.");
    err.statusCode = 404;
    throw err;
  }
  return session;
}

function sanitizeText(text) {
  if (typeof text !== "string") return "";
  return text.replace(/\u0000/g, "").trim().slice(0, 2000);
}

function canAcceptCustomerMessage(session) {
  if (session.customerMessageCount >= limits.maxMessages) {
    const err = new Error(`This demo is limited to ${limits.maxMessages} customer messages per session.`);
    err.statusCode = 429;
    throw err;
  }
  const elapsed = Date.now() - session.lastCustomerMessageAt;
  if (session.lastCustomerMessageAt && elapsed < limits.minMessageIntervalMs) {
    const err = new Error("You’re sending messages a little too quickly. Please try again in a moment.");
    err.statusCode = 429;
    throw err;
  }
}

function appendMessage(session, role, content, source) {
  const message = {
    id: crypto.randomUUID(),
    role,
    content,
    source,
    createdAt: Date.now(),
  };
  session.messages.push(message);
  touchSession(session);
  return message;
}

function detectInterests(text) {
  const lower = String(text || "").toLowerCase();
  return clinic.services
    .filter((service) =>
      [service.name, ...service.aliases].some((term) => lower.includes(term.toLowerCase()))
    )
    .map((service) => service.name);
}

function buildNaturalSummary({ interests, bookingIntent, negativeIntentActive, preferredBranch, preferredTiming, askedPrice }) {
  const treatmentText = interests.length ? interests.join(" and ") : null;
  const branchText = preferredBranch ? ` at the ${preferredBranch} branch` : "";
  const timingText = preferredTiming ? ` (${preferredTiming.toLowerCase()})` : "";
  const visitText = `${branchText}${timingText}`;

  if (negativeIntentActive) {
    return treatmentText
      ? `The visitor asked about ${treatmentText}, but their latest intent indicates they are no longer interested in booking right now.`
      : "The visitor’s latest intent indicates they are no longer interested in booking right now.";
  }
  if (bookingIntent) {
    return treatmentText
      ? `Interested in ${treatmentText} and wants to arrange a visit${visitText}. Strong booking intent and ready for staff follow-up.`
      : `Wants to arrange a clinic visit${visitText}. Strong booking intent and ready for staff follow-up.`;
  }
  if (treatmentText) {
    return askedPrice
      ? `Interested in ${treatmentText} and has asked about pricing. No appointment intent detected yet.`
      : `Interested in ${treatmentText}. No appointment intent detected yet.`;
  }
  return "Early-stage enquiry. No specific treatment or appointment intent has been detected yet.";
}

function latestMatchingMessage(messages, pattern) {
  return [...messages].reverse().find((message) => pattern.test(message.content)) || null;
}

function isRenewedInterestMessage(text) {
  if (!text) return false;
  return BOOKING_PATTERN.test(text) ||
    PRICE_PATTERN.test(text) ||
    INTEREST_PATTERN.test(text) ||
    CONTACT_PATTERN.test(text) ||
    detectInterests(text).length > 0;
}

function updateLead(session) {
  const customerMessages = session.messages.filter((message) => message.role === "user");
  const allText = customerMessages.map((message) => message.content).join(" \n");

  let lastNegativeIndex = -1;
  for (let i = customerMessages.length - 1; i >= 0; i -= 1) {
    if (NEGATIVE_PATTERN.test(customerMessages[i].content)) {
      lastNegativeIndex = i;
      break;
    }
  }

  const messagesAfterNegative = lastNegativeIndex >= 0
    ? customerMessages.slice(lastNegativeIndex + 1)
    : customerMessages;
  const renewedAfterNegative = lastNegativeIndex < 0 || messagesAfterNegative.some((message) => isRenewedInterestMessage(message.content));
  const negativeIntentActive = lastNegativeIndex >= 0 && !renewedAfterNegative;
  const activeMessages = lastNegativeIndex >= 0 ? messagesAfterNegative : customerMessages;
  const activeText = activeMessages.map((message) => message.content).join(" \n");

  const historicalInterests = new Set(session.lead.interests);
  for (const interest of detectInterests(allText)) historicalInterests.add(interest);
  const activeInterests = detectInterests(activeText);
  const interestList = negativeIntentActive
    ? Array.from(historicalInterests)
    : activeInterests.length
      ? activeInterests
      : Array.from(historicalInterests);

  const bookingIntent = !negativeIntentActive && BOOKING_PATTERN.test(activeText);
  const askedPrice = !negativeIntentActive && PRICE_PATTERN.test(activeText);

  let score = 0;
  if (interestList.length) score += 2;
  if (askedPrice) score += 2;
  if (!negativeIntentActive && INTEREST_PATTERN.test(activeText)) score += 2;
  if (bookingIntent) score += 5;
  if (!negativeIntentActive && CONTACT_PATTERN.test(activeText)) score += 3;
  if (negativeIntentActive) score = 0;

  let preferredTiming = null;
  const latestTimingMessage = latestMatchingMessage(customerMessages, TIMING_PATTERN);
  if (latestTimingMessage) {
    const timing = latestTimingMessage.content.toLowerCase();
    if (/weekend|saturday|sunday|hujung minggu|sabtu|ahad|周末|週末|周六|週六|星期六|周日|週日|星期日/i.test(timing)) {
      preferredTiming = "Weekend";
    } else if (/weekday|monday|tuesday|wednesday|thursday|friday|hari biasa|isnin|selasa|rabu|khamis|jumaat|平日|工作日|星期一|星期二|星期三|星期四|星期五/i.test(timing)) {
      preferredTiming = "Weekday";
    }
    if (/morning|pagi|早上|上午/i.test(timing)) preferredTiming = preferredTiming ? `${preferredTiming}, morning` : "Morning";
    if (/afternoon|petang|下午/i.test(timing)) preferredTiming = preferredTiming ? `${preferredTiming}, afternoon` : "Afternoon";
    if (/evening|night|malam|晚上/i.test(timing)) preferredTiming = preferredTiming ? `${preferredTiming}, evening` : "Evening";
  }

  let preferredBranch = null;
  const latestBranchMessage = latestMatchingMessage(customerMessages, BRANCH_PATTERN);
  if (latestBranchMessage) {
    const branch = latestBranchMessage.content.toLowerCase();
    if (/petaling jaya|\bpj\b|八打灵再也|八打靈再也/i.test(branch)) preferredBranch = "Petaling Jaya";
    else if (/kuala lumpur|\bkl\b|bukit bintang|吉隆坡/i.test(branch)) preferredBranch = "Kuala Lumpur";
  }

  const temperature = bookingIntent || score >= 7 ? "hot" : score >= 3 ? "warm" : "cold";

  session.lead = {
    temperature,
    score,
    interests: interestList,
    bookingIntent,
    reducedInterest: negativeIntentActive,
    preferredTiming,
    preferredBranch,
    summary: buildNaturalSummary({
      interests: interestList,
      bookingIntent,
      negativeIntentActive,
      preferredBranch,
      preferredTiming,
      askedPrice,
    }),
  };
}

function addCustomerMessage(session, rawText) {
  canAcceptCustomerMessage(session);
  const text = sanitizeText(rawText);
  if (!text) {
    const err = new Error("Please type a message first.");
    err.statusCode = 400;
    throw err;
  }
  enforceDailyMessageLimit();
  session.customerMessageCount += 1;
  session.lastCustomerMessageAt = Date.now();
  const message = appendMessage(session, "user", text, "customer");
  updateLead(session);
  if (session.mode === "human") {
    session.needsAttention = true;
    session.attentionReason = "New customer message while staff is handling the conversation.";
  }
  return message;
}

function addAssistantMessage(session, rawText) {
  const raw = typeof rawText === "string" ? rawText : "";
  const handoff = raw.includes("[[HANDOFF]]");
  const cleanText = sanitizeText(raw.replaceAll("[[HANDOFF]]", ""));
  if (handoff) {
    session.needsAttention = true;
    session.attentionReason = "AI requested human assistance.";
  }
  return appendMessage(session, "assistant", cleanText, "ai");
}

function shouldShowPromotion(session) {
  return !session.promotionShown &&
    !session.lead.reducedInterest &&
    session.lead.interests.includes("HIFU Skin Lifting");
}

function markPromotionShown(session, messageId) {
  session.promotionShown = true;
  session.promotionAfterMessageId = messageId || null;
  touchSession(session);
}

function addStaffMessage(session, rawText) {
  const text = sanitizeText(rawText);
  if (!text) {
    const err = new Error("Please type a staff reply first.");
    err.statusCode = 400;
    throw err;
  }
  session.mode = "human";
  session.needsAttention = false;
  session.attentionReason = null;
  return appendMessage(session, "assistant", text, "staff");
}

function setMode(session, mode) {
  if (!["ai", "human"].includes(mode)) {
    const err = new Error("Mode must be ai or human.");
    err.statusCode = 400;
    throw err;
  }
  session.mode = mode;
  session.needsAttention = false;
  session.attentionReason = null;
  touchSession(session);
}

function setChannel(session, channel) {
  if (!CHANNELS.has(channel)) {
    const err = new Error("Unsupported demo channel.");
    err.statusCode = 400;
    throw err;
  }
  session.channel = channel;
  touchSession(session);
}

function restoreSession(session) {
  if (!session || typeof session.id !== "string") return null;
  if (!Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) return null;
  if (!Number.isFinite(session.staffMessageCount)) session.staffMessageCount = 0;
  if (!Number.isFinite(session.lastStaffMessageAt)) session.lastStaffMessageAt = 0;
  sessions.set(session.id, session);
  return session;
}

function publicSession(session) {
  const { score, reducedInterest, ...publicLead } = session.lead;
  return {
    id: session.id,
    channel: session.channel,
    mode: session.mode,
    messages: session.messages,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    expiresAt: session.expiresAt,
    customerMessageCount: session.customerMessageCount,
    maxMessages: limits.maxMessages,
    needsAttention: session.needsAttention,
    attentionReason: session.attentionReason,
    promotionShown: session.promotionShown,
    promotionAfterMessageId: session.promotionAfterMessageId,
    lead: publicLead,
  };
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now > session.expiresAt) sessions.delete(id);
  }

  const today = dayKey();
  for (const key of ipCreations.keys()) {
    if (!key.endsWith(`:${today}`)) ipCreations.delete(key);
  }
  for (const key of dailyMessageCounts.keys()) {
    if (key !== today) dailyMessageCounts.delete(key);
  }
}

module.exports = {
  limits,
  createSession,
  getSession,
  requireSession,
  addCustomerMessage,
  addAssistantMessage,
  addStaffMessage,
  setMode,
  setChannel,
  restoreSession,
  publicSession,
  cleanupExpiredSessions,
  updateLead,
  shouldShowPromotion,
  markPromotionShown,
};
