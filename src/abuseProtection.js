const crypto = require("crypto");
const http = require("http");
const Redis = require("ioredis");
const { runWithConversationContext } = require("./aiMemoryContext");
const { establishedConversationLanguage, languageLabel } = require("./conversationLanguage");

function intEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const limits = {
  messagesPerIpMinute: intEnv("DEMO_MAX_MESSAGES_PER_IP_MINUTE", 10),
  messagesPerIpDay: intEnv("DEMO_MAX_MESSAGES_PER_IP_DAY", 60),
  telemetryPerIpMinute: intEnv("DEMO_MAX_TELEMETRY_PER_IP_MINUTE", 120),
  aiHistoryMaxMessages: intEnv("DEMO_AI_HISTORY_MAX_MESSAGES", 16),
  aiHistoryMaxChars: intEnv("DEMO_AI_HISTORY_MAX_CHARS", 12000),
};

const MESSAGE_PATH = /^\/(?:ai-chatbot\/)?api\/demo\/sessions\/([^/]+)\/message$/;
const TELEMETRY_PATH = /^\/(?:ai-chatbot\/)?api\/telemetry$/;
const localCounters = new Map();
const sessionQueues = new Map();
let redis = null;
let redisWarned = false;
let httpInstalled = false;
let aiHistoryInstalled = false;

function rateLimitError(message) {
  const error = new Error(message);
  error.statusCode = 429;
  return error;
}

function clientIp(req) {
  const forwarded = req?.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req?.socket?.remoteAddress || "unknown";
}

function ipKey(ip) {
  return crypto.createHash("sha256").update(String(ip || "unknown")).digest("hex").slice(0, 24);
}

function minuteWindow(now = Date.now()) {
  return Math.floor(now / 60000);
}

function dayWindow(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

function incrementLocal(key, limit, ttlMs, message, now = Date.now()) {
  const current = localCounters.get(key);
  const entry = !current || current.expiresAt <= now
    ? { count: 0, expiresAt: now + ttlMs }
    : current;
  entry.count += 1;
  localCounters.set(key, entry);
  if (entry.count > limit) throw rateLimitError(message);
  return entry.count;
}

function getRedis() {
  const redisUrl = String(process.env.REDIS_URL || "").trim();
  if (!redisUrl) return null;
  if (!redis) {
    redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2500,
      enableReadyCheck: true,
    });
    redis.on("error", (error) => {
      if (!redisWarned) {
        redisWarned = true;
        console.warn("Demo abuse-limit Redis unavailable; using in-memory fallback:", error.message);
      }
    });
  }
  return redis;
}

async function incrementRedis(key, limit, ttlSeconds, message) {
  const client = getRedis();
  if (!client) return null;
  try {
    if (client.status === "wait") await client.connect();
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, ttlSeconds);
    if (count > limit) throw rateLimitError(message);
    return count;
  } catch (error) {
    if (error?.statusCode === 429) throw error;
    if (!redisWarned) {
      redisWarned = true;
      console.warn("Demo abuse-limit Redis unavailable; using in-memory fallback:", error.message);
    }
    return null;
  }
}

async function incrementWithFallback({ redisKey, localKey, limit, redisTtlSeconds, localTtlMs, message }) {
  const redisCount = await incrementRedis(redisKey, limit, redisTtlSeconds, message);
  if (redisCount !== null) return redisCount;
  return incrementLocal(localKey, limit, localTtlMs, message);
}

async function enforceIpMessageLimits(ip, now = Date.now()) {
  const identity = ipKey(ip);
  const minute = minuteWindow(now);
  const day = dayWindow(now);

  await incrementWithFallback({
    redisKey: `demo:message-ip-minute:${identity}:${minute}`,
    localKey: `minute:${identity}:${minute}`,
    limit: limits.messagesPerIpMinute,
    redisTtlSeconds: 120,
    localTtlMs: 120000,
    message: "You’re sending demo messages too quickly. Please wait a moment and try again.",
  });

  await incrementWithFallback({
    redisKey: `demo:message-ip-day:${identity}:${day}`,
    localKey: `day:${identity}:${day}`,
    limit: limits.messagesPerIpDay,
    redisTtlSeconds: 172800,
    localTtlMs: 172800000,
    message: "You’ve reached today’s demo-message limit. Please try again tomorrow.",
  });
}

async function enforceIpTelemetryLimit(ip, now = Date.now()) {
  const identity = ipKey(ip);
  const minute = minuteWindow(now);
  return incrementWithFallback({
    redisKey: `demo:telemetry-ip-minute:${identity}:${minute}`,
    localKey: `telemetry-minute:${identity}:${minute}`,
    limit: limits.telemetryPerIpMinute,
    redisTtlSeconds: 120,
    localTtlMs: 120000,
    message: "Telemetry rate limit exceeded.",
  });
}

function requestPath(req) {
  try {
    return new URL(req?.url || "/", "http://localhost").pathname;
  } catch {
    return "";
  }
}

function isCustomerMessageRequest(req) {
  return req?.method === "POST" && MESSAGE_PATH.test(requestPath(req));
}

function isTelemetryRequest(req) {
  return req?.method === "POST" && TELEMETRY_PATH.test(requestPath(req));
}

function sessionIdForRequest(req) {
  if (req?.method !== "POST") return null;
  const match = requestPath(req).match(MESSAGE_PATH);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function serializeSessionRequest(sessionId, operation) {
  if (!sessionId) return Promise.resolve().then(operation);
  const previous = sessionQueues.get(sessionId) || Promise.resolve();
  const next = previous.catch(() => {}).then(operation);
  sessionQueues.set(sessionId, next);
  return next.finally(() => {
    if (sessionQueues.get(sessionId) === next) sessionQueues.delete(sessionId);
  });
}

function sendRateLimit(res, error) {
  if (res.headersSent || res.writableEnded) return;
  const payload = JSON.stringify({ error: error.message });
  res.writeHead(429, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  });
  res.end(payload);
}

function trimAiHistory(messages, {
  maxMessages = limits.aiHistoryMaxMessages,
  maxChars = limits.aiHistoryMaxChars,
} = {}) {
  if (!Array.isArray(messages) || !messages.length) return [];
  const selected = [];
  let chars = 0;

  for (let index = messages.length - 1; index >= 0 && selected.length < maxMessages; index -= 1) {
    const message = messages[index] || {};
    const content = String(message.content || "");
    const remaining = maxChars - chars;
    if (remaining <= 0) break;
    const safeContent = content.length > remaining ? content.slice(0, remaining) : content;
    selected.unshift({ ...message, content: safeContent });
    chars += safeContent.length;
  }

  while (selected.length > 1 && selected[0]?.role !== "user") selected.shift();
  return selected;
}

function buildConversationMemory(messages) {
  const fullMessages = Array.isArray(messages) ? messages : [];
  const language = establishedConversationLanguage(fullMessages);
  const facts = [`- Established customer language: ${languageLabel(language)}`];

  try {
    const industry = require("./industryProfile");
    const demoState = require("./demoState");
    const memorySession = { messages: fullMessages, lead: {} };
    const lead = demoState.updateLead(memorySession) || {};

    if (Array.isArray(lead.interests) && lead.interests.length) {
      facts.push(`- ${industry.key === "renovation" ? "Project interests" : "Treatments discussed"}: ${lead.interests.join(", ")}`);
    }
    if (industry.key === "renovation") {
      if (lead.propertyType) facts.push(`- Property type: ${lead.propertyType}`);
      if (lead.propertyStatus) facts.push(`- Property status: ${lead.propertyStatus}`);
      if (lead.preferredBranch) facts.push(`- Project area: ${lead.preferredBranch}`);
      if (lead.budget) facts.push(`- Latest budget: ${lead.budget}`);
      if (lead.measurementsKnown) facts.push("- Measurements or floor-plan context has been provided");
      if (lead.timelineMentioned) facts.push("- Customer has mentioned a project timeline or move-in timing");
      if (lead.preferredTiming) facts.push(`- Timing preference: ${lead.preferredTiming}`);
      if (lead.siteMeasurementIntent) facts.push("- Customer has shown site-measurement intent");
      if (lead.quotationIntent) facts.push("- Customer has requested quotation-related follow-up");
      if (lead.technicalHandoff) facts.push("- A site-specific technical question requires staff follow-up");
    } else {
      if (lead.preferredBranch) facts.push(`- Preferred branch: ${lead.preferredBranch}`);
      if (lead.preferredTiming) facts.push(`- Preferred timing: ${lead.preferredTiming}`);
      if (lead.bookingIntent) facts.push("- Customer has shown booking intent");
    }
  } catch (error) {
    console.warn("Could not build structured demo conversation memory:", error.message);
  }

  return facts.join("\n");
}

function installAiHistoryCap() {
  if (aiHistoryInstalled) return;
  const ai = require("./aiService");
  if (typeof ai.getReply !== "function") return;
  const originalGetReply = ai.getReply.bind(ai);
  ai.getReply = (messages, isFirstMessage) => {
    const fullMessages = Array.isArray(messages) ? messages : [];
    const context = {
      fullMessages,
      memory: buildConversationMemory(fullMessages),
      language: establishedConversationLanguage(fullMessages),
    };
    return runWithConversationContext(context, () => originalGetReply(trimAiHistory(fullMessages), isFirstMessage));
  };
  aiHistoryInstalled = true;
}

function installHttpRateLimit() {
  if (httpInstalled) return;
  const originalCreateServer = http.createServer;

  http.createServer = function protectedCreateServer(...args) {
    const listenerIndex = args.findIndex((arg) => typeof arg === "function");
    if (listenerIndex >= 0) {
      const listener = args[listenerIndex];
      args[listenerIndex] = function protectedRequestListener(req, res) {
        const ip = clientIp(req);
        const guard = isCustomerMessageRequest(req)
          ? enforceIpMessageLimits(ip)
          : isTelemetryRequest(req)
            ? enforceIpTelemetryLimit(ip)
            : null;
        if (!guard) return listener.call(this, req, res);

        const invoke = async () => {
          try {
            await guard;
          } catch (error) {
            if (error?.statusCode === 429) return sendRateLimit(res, error);
            console.error("Demo abuse protection failed open:", error);
          }
          return listener.call(this, req, res);
        };

        const sessionId = sessionIdForRequest(req);
        const operation = sessionId ? serializeSessionRequest(sessionId, invoke) : invoke();
        operation.catch((error) => {
          console.error("Demo request listener failed:", error);
        });
        return operation;
      };
    }
    return originalCreateServer.apply(this, args);
  };

  httpInstalled = true;
}

function installAbuseProtection() {
  installAiHistoryCap();
  installHttpRateLimit();
}

function resetForTests() {
  localCounters.clear();
  sessionQueues.clear();
}

module.exports = {
  limits,
  clientIp,
  isCustomerMessageRequest,
  isTelemetryRequest,
  sessionIdForRequest,
  serializeSessionRequest,
  enforceIpMessageLimits,
  enforceIpTelemetryLimit,
  trimAiHistory,
  buildConversationMemory,
  installAbuseProtection,
  resetForTests,
};
