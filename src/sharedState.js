const Redis = require("ioredis");

const redisUrl = String(process.env.REDIS_URL || "").trim();
const enabled = Boolean(redisUrl);
let client = null;
let warned = false;

function rateLimitError(message) {
  const err = new Error(message);
  err.statusCode = 429;
  err.isSharedRateLimit = true;
  return err;
}

function getClient() {
  if (!enabled) return null;
  if (!client) {
    client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2500,
      enableReadyCheck: true,
    });
    client.on("error", (error) => {
      if (!warned) {
        warned = true;
        console.warn("Shared demo state unavailable; using in-memory fallback:", error.message);
      }
    });
  }
  return client;
}

async function run(operation, fallback = null) {
  if (!enabled) return fallback;
  try {
    const redis = getClient();
    if (redis.status === "wait") await redis.connect();
    return await operation(redis);
  } catch (error) {
    if (error?.isSharedRateLimit) throw error;
    if (!warned) {
      warned = true;
      console.warn("Shared demo state unavailable; using in-memory fallback:", error.message);
    }
    return fallback;
  }
}

function secondsUntilTomorrowUtc() {
  const now = new Date();
  const tomorrow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(60, Math.ceil((tomorrow - now.getTime()) / 1000) + 300);
}

async function incrementLimited(key, limit, ttlSeconds, message) {
  return run(async (redis) => {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, ttlSeconds);
    if (count > limit) throw rateLimitError(message);
    return count;
  });
}

async function enforceSessionCreationLimit(ip, limit) {
  const day = new Date().toISOString().slice(0, 10);
  return incrementLimited(
    `demo:session-create:${ip || "unknown"}:${day}`,
    limit,
    secondsUntilTomorrowUtc(),
    "You’ve reached today’s demo-session limit. Please try again later."
  );
}

async function enforceDailyMessageLimit(limit) {
  const day = new Date().toISOString().slice(0, 10);
  return incrementLimited(
    `demo:customer-messages:${day}`,
    limit,
    secondsUntilTomorrowUtc(),
    "Today’s public demo message limit has been reached. Please try again later."
  );
}

async function saveSession(session) {
  if (!session?.id) return;
  const ttl = Math.max(1, Math.ceil((session.expiresAt - Date.now()) / 1000));
  await run((redis) => redis.set(`demo:session:${session.id}`, JSON.stringify(session), "EX", ttl));
}

async function loadSession(id) {
  if (!id) return null;
  return run(async (redis) => {
    const raw = await redis.get(`demo:session:${id}`);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session.expiresAt || session.expiresAt <= Date.now()) {
      await redis.del(`demo:session:${id}`);
      return null;
    }
    return session;
  }, null);
}

module.exports = {
  enabled,
  enforceSessionCreationLimit,
  enforceDailyMessageLimit,
  saveSession,
  loadSession,
};
