const crypto = require("crypto");
const http = require("http");
const Redis = require("ioredis");

function intEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const limits = {
  messagesPerIpMinute: intEnv("DEMO_MAX_MESSAGES_PER_IP_MINUTE", 10),
  messagesPerIpDay: intEnv("DEMO_MAX_MESSAGES_PER_IP_DAY", 60),
  aiHistoryMaxMessages: intEnv("DEMO_AI_HISTORY_MAX_MESSAGES", 16),
  aiHistoryMaxChars: intEnv("DEMO_AI_HISTORY_MAX_CHARS", 12000),
};

const MESSAGE_PATH = /^\/(?:ai-chatbot\/)?api\/demo\/sessions\/[^/]+\/message$/;
const localCounters = new Map();
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

function isCustomerMessageRequest(req) {
  if (req?.method !== "POST") return false;
  let pathname;
  try {
    pathname = new URL(req.url || "/", "http://localhost").pathname;
  } catch {
    return false;
  }
  return MESSAGE_PATH.test(pathname);
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

  return selected;
}

function installAiHistoryCap() {
  if (aiHistoryInstalled) return;
  const ai = require("./aiService");
  if (typeof ai.getReply !== "function") return;
  const originalGetReply = ai.getReply.bind(ai);
  ai.getReply = (messages, isFirstMessage) => originalGetReply(trimAiHistory(messages), isFirstMessage);
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
        if (!isCustomerMessageRequest(req)) return listener.call(this, req, res);
        enforceIpMessageLimits(clientIp(req))
          .then(() => listener.call(this, req, res))
          .catch((error) => {
            if (error?.statusCode === 429) return sendRateLimit(res, error);
            console.error("Demo abuse protection failed open:", error);
            return listener.call(this, req, res);
          });
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
}

module.exports = {
  limits,
  clientIp,
  isCustomerMessageRequest,
  enforceIpMessageLimits,
  trimAiHistory,
  installAbuseProtection,
  resetForTests,
};
