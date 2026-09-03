const http = require("http");
const { AsyncLocalStorage } = require("async_hooks");
const ops = require("./opsStats");
const store = require("./visitorAnalyticsStore");

const requestContext = new AsyncLocalStorage();
const CACHE_MS = Math.max(5_000, Number.parseInt(process.env.DEMO_OPS_HISTORY_CACHE_MS || "60000", 10) || 60_000);
const audienceCache = { value: null, expiresAt: 0, inFlight: null };

function header(req, name) {
  const value = req?.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : String(value || "");
}

function parseDevice(userAgent = "") {
  const ua = String(userAgent || "");
  const deviceType = /iPad|Tablet/i.test(ua) ? "Tablet" : /Mobi|Android|iPhone|iPod/i.test(ua) ? "Mobile" : "Desktop";
  let browser = "Other";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/Firefox\/|FxiOS\//i.test(ua)) browser = "Firefox";
  else if (/Chrome\/|CriOS\//i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua) && /Version\//i.test(ua)) browser = "Safari";

  let os = "Other";
  if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  return { deviceType, browser, os };
}

function marketingContext(req) {
  const referer = header(req, "referer");
  let page = null;
  try { if (referer) page = new URL(referer); } catch {}
  const params = page?.searchParams;
  let source = params?.get("utm_source") || "";
  if (!source && params?.get("fbclid")) source = "Facebook";
  if (!source && params?.get("gclid")) source = "Google";
  if (!source && params?.get("ttclid")) source = "TikTok";
  if (!source) source = "Direct / unknown";
  const device = parseDevice(header(req, "user-agent"));
  return {
    ...device,
    countryCode: header(req, "x-demo-geo-country-code"),
    countryName: header(req, "x-demo-geo-country-name"),
    region: header(req, "x-demo-geo-region"),
    city: header(req, "x-demo-geo-city"),
    timezone: header(req, "x-demo-geo-timezone"),
    source,
    medium: params?.get("utm_medium") || "",
    campaign: params?.get("utm_campaign") || "",
    content: params?.get("utm_content") || "",
    term: params?.get("utm_term") || "",
    landingPath: page?.pathname || "",
  };
}

function isOpsPage(req) {
  if (req?.method !== "GET") return false;
  try {
    const pathname = new URL(req.url, "http://localhost").pathname;
    return pathname === "/ops" || pathname === "/ops/" || pathname === "/ai-chatbot/ops" || pathname === "/ai-chatbot/ops/";
  } catch {
    return false;
  }
}

function installOpsAssetInjection(req, res) {
  if (!isOpsPage(req)) return;
  const originalWriteHead = res.writeHead.bind(res);
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);
  let statusCode = 200;
  let statusMessage = null;
  let buffering = true;
  const chunks = [];

  res.writeHead = function patchedWriteHead(code, messageOrHeaders, maybeHeaders) {
    statusCode = Number(code) || 200;
    let headers = maybeHeaders;
    if (typeof messageOrHeaders === "string") statusMessage = messageOrHeaders;
    else headers = messageOrHeaders;
    if (headers && typeof headers === "object") {
      for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
    }
    return res;
  };

  res.write = function patchedWrite(chunk, encoding, callback) {
    if (!buffering) return originalWrite(chunk, encoding, callback);
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    if (typeof callback === "function") callback();
    return true;
  };

  res.end = function patchedEnd(chunk, encoding, callback) {
    if (!buffering) return originalEnd(chunk, encoding, callback);
    buffering = false;
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    let body = Buffer.concat(chunks);
    const contentType = String(res.getHeader("content-type") || "").toLowerCase();
    if (statusCode === 200 && contentType.includes("text/html")) {
      const html = body.toString("utf8");
      if (!html.includes("ops-audience.js")) {
        body = Buffer.from(html.replace("</body>", '  <script src="./ops-audience.js" defer></script>\n</body>'));
      }
      res.removeHeader("content-length");
      res.setHeader("Content-Length", body.length);
    }
    if (statusMessage) originalWriteHead(statusCode, statusMessage);
    else originalWriteHead(statusCode);
    return originalEnd(body, undefined, callback);
  };
}

function installRequestContext() {
  if (http.__clinicVisitorAnalyticsWrapped) return;
  const originalCreateServer = http.createServer;
  http.createServer = function patchedCreateServer(...args) {
    const listenerIndex = typeof args[0] === "function" ? 0 : typeof args[1] === "function" ? 1 : -1;
    if (listenerIndex >= 0) {
      const listener = args[listenerIndex];
      args[listenerIndex] = function analyticsAwareListener(req, res) {
        installOpsAssetInjection(req, res);
        return requestContext.run({ req }, () => listener.call(this, req, res));
      };
    }
    return originalCreateServer.apply(this, args);
  };
  http.__clinicVisitorAnalyticsWrapped = true;
}

async function audienceState() {
  if (!store.enabled) return null;
  const now = Date.now();
  if (audienceCache.value && audienceCache.expiresAt > now) return audienceCache.value;
  if (audienceCache.inFlight) return audienceCache.inFlight;
  const days = ops._test.recentDayKeys(90);
  audienceCache.inFlight = store.readAudience(days)
    .then((value) => {
      if (value) {
        audienceCache.value = value;
        audienceCache.expiresAt = Date.now() + CACHE_MS;
      }
      return value;
    })
    .finally(() => { audienceCache.inFlight = null; });
  return audienceCache.inFlight;
}

installRequestContext();

const originalRecordVisitor = ops.recordVisitor;
ops.recordVisitor = function recordVisitorWithAudience(payload = {}) {
  const result = originalRecordVisitor(payload);
  if (!result || !store.enabled) return result;
  const req = requestContext.getStore()?.req;
  void store.recordAudienceEvent({
    day: ops._test.localDayKey(),
    visitorId: payload.visitorId,
    event: payload.event || "heartbeat",
    context: marketingContext(req),
  });
  return result;
};

const originalGetSnapshot = ops.getSnapshot;
ops.getSnapshot = async function getSnapshotWithAudience() {
  const base = await originalGetSnapshot();
  const audience = await audienceState();
  return { ...base, audience };
};

module.exports = {
  _test: { parseDevice, marketingContext, isOpsPage },
};
