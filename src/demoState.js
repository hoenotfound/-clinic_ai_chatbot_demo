const crypto = require("crypto");
const clinic = require("./clinicConfig");

const CHANNELS = new Set(["whatsapp", "instagram", "facebook"]);
const sessions = new Map();
const ipCreations = new Map();
const dailyMessageCounts = new Map();

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
  session.updatedAt = Date.now();
  return message;
}

function detectInterests(text) {
  const lower = text.toLowerCase();
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
      ? `The visitor asked about ${treatmentText}, but their latest message indicates they are no longer interested in booking right now.`
      : "The visitor’s latest message indicates they are no longer interested in booking right now.";
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

function updateLead(session) {
  const customerMessages = session.messages.filter((message) => message.role === "user");
  const customerText = customerMessages.map((message) => message.content).join(" \n");
  const lower = customerText.toLowerCase();

  const interests = new Set(session.lead.interests);
  for (const interest of detectInterests(customerText)) interests.add(interest);

  const bookingPattern = /book|booking|appointment|slot|available|come in|visit|this weekend|saturday|sunday|tomorrow/;
  const negativeIntentPattern = /not interested|no longer interested|never ?mind|don['’]t want|do not want|not booking|cancel(?: it| that| my appointment)?|no thanks/;
  const latestIntentMessage = [...customerMessages]
    .reverse()
    .find((message) => bookingPattern.test(message.content.toLowerCase()) || negativeIntentPattern.test(message.content.toLowerCase()));
  const latestIntentLower = latestIntentMessage?.content.toLowerCase() || "";
  const negativeIntentActive = negativeIntentPattern.test(latestIntentLower);
  const bookingIntent = Boolean(latestIntentMessage) && bookingPattern.test(latestIntentLower) && !negativeIntentActive;
  const askedPrice = /price|how much|cost|rm\s?\d|promo|package/.test(lower);

  let score = 0;
  if (interests.size) score += 2;
  if (askedPrice) score += 2;
  if (/interested|want to|suitable|works? for me|result/.test(lower)) score += 2;
  if (bookingIntent) score += 5;
  if (/my number|call me|contact me/.test(lower)) score += 3;
  if (negativeIntentActive) score = 0;

  let preferredTiming = null;
  const latestTimingMessage = [...customerMessages]
    .reverse()
    .find((message) => /weekend|saturday|sunday|weekday|monday|tuesday|wednesday|thursday|friday|morning|afternoon|evening|night/i.test(message.content));
  if (latestTimingMessage) {
    const timingLower = latestTimingMessage.content.toLowerCase();
    if (/weekend|saturday|sunday/.test(timingLower)) preferredTiming = "Weekend";
    else if (/weekday|monday|tuesday|wednesday|thursday|friday/.test(timingLower)) preferredTiming = "Weekday";
    if (/morning/.test(timingLower)) preferredTiming = preferredTiming ? `${preferredTiming}, morning` : "Morning";
    if (/afternoon/.test(timingLower)) preferredTiming = preferredTiming ? `${preferredTiming}, afternoon` : "Afternoon";
    if (/evening|night/.test(timingLower)) preferredTiming = preferredTiming ? `${preferredTiming}, evening` : "Evening";
  }

  let preferredBranch = null;
  const latestBranchMessage = [...customerMessages]
    .reverse()
    .find((message) => /petaling jaya|\bpj\b|kuala lumpur|\bkl\b|bukit bintang/i.test(message.content));
  if (latestBranchMessage) {
    const branchLower = latestBranchMessage.content.toLowerCase();
    if (/petaling jaya|\bpj\b/.test(branchLower)) preferredBranch = "Petaling Jaya";
    else if (/kuala lumpur|\bkl\b|bukit bintang/.test(branchLower)) preferredBranch = "Kuala Lumpur";
  }

  const temperature = score >= 7 ? "hot" : score >= 3 ? "warm" : "cold";
  const interestList = Array.from(interests);

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
  const text = sanitizeText(rawText);
  const handoff = text.includes("[[HANDOFF]]");
  const cleanText = text.replaceAll("[[HANDOFF]]", "").trim();
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
  session.updatedAt = Date.now();
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
  session.updatedAt = Date.now();
}

function setChannel(session, channel) {
  if (!CHANNELS.has(channel)) {
    const err = new Error("Unsupported demo channel.");
    err.statusCode = 400;
    throw err;
  }
  session.channel = channel;
  session.updatedAt = Date.now();
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
  publicSession,
  cleanupExpiredSessions,
  updateLead,
  shouldShowPromotion,
  markPromotionShown,
};
