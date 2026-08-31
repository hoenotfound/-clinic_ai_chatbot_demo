const http = require("http");
const fs = require("fs");
const path = require("path");
const clinic = require("./clinicConfig");

function loadDotEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();
const state = require("./demoState");
const ai = require("./aiService");

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function securityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
}

function sendJson(res, status, body) {
  securityHeaders(res);
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function sendError(res, err) {
  const status = err.statusCode || 500;
  if (status >= 500) console.error(err);
  sendJson(res, status, { error: status >= 500 ? "Something went wrong. Please try again." : err.message });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 32 * 1024) {
        const err = new Error("Request body is too large.");
        err.statusCode = 413;
        reject(err);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        const err = new Error("Invalid JSON request body.");
        err.statusCode = 400;
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function publicConfig() {
  return {
    clinicName: clinic.clinicName,
    assistantName: clinic.assistantName,
    branches: clinic.branches,
    services: clinic.services.map(({ aliases, ...service }) => service),
    promotion: clinic.promotion,
    salesCta: {
      label: process.env.SALES_CTA_LABEL || "Set up my clinic",
      url: process.env.SALES_CTA_URL || "",
    },
    aiProvider: ai.provider,
    limits: state.limits,
  };
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, ai.configured ? 200 : 503, {
      ok: ai.configured,
      aiProvider: ai.provider,
      configured: ai.configured,
    });
  }
  if (req.method === "GET" && url.pathname === "/api/demo/config") {
    return sendJson(res, 200, publicConfig());
  }
  if (req.method === "POST" && url.pathname === "/api/demo/sessions") {
    const body = await readJson(req);
    const session = state.createSession({ channel: body.channel, ip: clientIp(req) });
    return sendJson(res, 201, { session: state.publicSession(session) });
  }

  const match = url.pathname.match(/^\/api\/demo\/sessions\/([^/]+)(?:\/(channel|mode|staff-message|message))?$/);
  if (!match) return false;
  const session = state.requireSession(decodeURIComponent(match[1]));
  const action = match[2] || null;

  if (req.method === "GET" && !action) {
    return sendJson(res, 200, { session: state.publicSession(session) });
  }
  if (req.method !== "POST" || !action) return false;
  const body = await readJson(req);

  if (action === "channel") {
    state.setChannel(session, body.channel);
    return sendJson(res, 200, { session: state.publicSession(session) });
  }
  if (action === "mode") {
    state.setMode(session, body.mode);
    return sendJson(res, 200, { session: state.publicSession(session) });
  }
  if (action === "staff-message") {
    state.addStaffMessage(session, body.message);
    return sendJson(res, 200, { session: state.publicSession(session) });
  }
  if (action === "message") {
    state.addCustomerMessage(session, body.message);
    if (session.mode === "human") {
      return sendJson(res, 200, { session: state.publicSession(session), aiReplied: false });
    }
    const history = session.messages.map((message) => ({ role: message.role, content: message.content }));
    const isFirstMessage = session.customerMessageCount === 1;
    let reply;
    let degraded = false;
    try {
      reply = await ai.getReply(history, isFirstMessage);
    } catch (aiError) {
      degraded = true;
      console.error("AI provider failed while handling a demo message:", aiError);
      reply = "Sorry, I’m having a little trouble replying right now. Please try again in a moment 🙂";
    }

    // Staff may take over while the model request is still in flight. In that
    // case, discard the generated reply so human ownership is respected.
    if (session.mode === "human") {
      return sendJson(res, 200, {
        session: state.publicSession(session),
        aiReplied: false,
        cancelledByTakeover: true,
      });
    }

    if (isFirstMessage) reply = `${clinic.introMessage}\n\n${reply}`;
    const assistantMessage = state.addAssistantMessage(session, reply);
    const showPromotion = !degraded && !session.needsAttention && state.shouldShowPromotion(session);
    if (showPromotion) state.markPromotionShown(session, assistantMessage.id);
    return sendJson(res, 200, {
      session: state.publicSession(session),
      aiReplied: !degraded,
      degraded,
      promotion: showPromotion ? clinic.promotion : null,
    });
  }
  return false;
}

function safeStaticPath(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  const requested = decoded === "/" ? "/index.html" : decoded;
  const normalized = path.normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const fullPath = path.join(PUBLIC_DIR, normalized);
  return fullPath.startsWith(PUBLIC_DIR) ? fullPath : null;
}

function serveStatic(req, res, pathname) {
  let filePath = safeStaticPath(pathname);
  if (!filePath) return false;
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    filePath = path.join(PUBLIC_DIR, "index.html");
  }
  securityHeaders(res);
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    "Content-Length": stat.size,
    "Cache-Control": path.basename(filePath) === "index.html" ? "no-cache" : "public, max-age=3600",
  });
  if (req.method === "HEAD") {
    res.end();
    return true;
  }
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    const handled = await handleApi(req, res, url);
    if (handled !== false) return;
    if (url.pathname.startsWith("/api/")) {
      return sendJson(res, 404, { error: "API route not found." });
    }
    if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res, url.pathname);
    sendJson(res, 404, { error: "Not found." });
  } catch (err) {
    if (!res.headersSent) sendError(res, err);
  }
});

setInterval(state.cleanupExpiredSessions, 10 * 60_000).unref();

server.listen(PORT, () => {
  console.log(`Clinic AI demo running on port ${PORT}`);
  console.log(`AI provider: ${ai.provider}`);
});
