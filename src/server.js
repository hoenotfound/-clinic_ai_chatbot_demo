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
const shared = require("./sharedState");
const ai = require("./aiService");

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const DASHBOARD_DIST = path.join(__dirname, "..", "portal-react", "dist");
const PUBLIC_MOUNT_PATH = "/ai-chatbot";
const PORTAL_DASHBOARD_PARTS = [1, 2, 3, 4].map((number) =>
  path.join(PUBLIC_DIR, `portal-dashboard-part${number}.html`)
);
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
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function intEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function stripPublicMountPath(pathname) {
  if (pathname === PUBLIC_MOUNT_PATH) return "/";
  if (pathname.startsWith(`${PUBLIC_MOUNT_PATH}/`)) {
    return pathname.slice(PUBLIC_MOUNT_PATH.length) || "/";
  }
  return pathname;
}

const MAX_CONCURRENT_AI_REQUESTS = intEnv("DEMO_MAX_CONCURRENT_AI_REQUESTS", 8);
const MAX_TOTAL_MESSAGES_PER_SESSION = intEnv("DEMO_MAX_TOTAL_MESSAGES_PER_SESSION", 60);
const MAX_STAFF_MESSAGES_PER_SESSION = intEnv("DEMO_MAX_STAFF_MESSAGES_PER_SESSION", 20);
const MIN_STAFF_MESSAGE_INTERVAL_MS = intEnv("DEMO_MIN_STAFF_MESSAGE_INTERVAL_MS", 700);
let activeAiRequests = 0;

function demoBusyError() {
  const err = new Error("The live demo is busy right now. Please try your message again in a moment.");
  err.statusCode = 429;
  return err;
}

function acquireAiSlot() {
  if (activeAiRequests >= MAX_CONCURRENT_AI_REQUESTS) throw demoBusyError();
  activeAiRequests += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeAiRequests = Math.max(0, activeAiRequests - 1);
  };
}

function enforceSessionMessageCapacity(session, additionalMessages = 1) {
  if (session.messages.length + additionalMessages > MAX_TOTAL_MESSAGES_PER_SESSION) {
    const err = new Error(`This demo session is limited to ${MAX_TOTAL_MESSAGES_PER_SESSION} total messages.`);
    err.statusCode = 429;
    throw err;
  }
}

function preflightCustomerMessage(session, rawText) {
  const text = typeof rawText === "string" ? rawText.replace(/\u0000/g, "").trim() : "";
  if (!text) {
    const err = new Error("Please type a message first.");
    err.statusCode = 400;
    throw err;
  }
  if (session.customerMessageCount >= state.limits.maxMessages) {
    const err = new Error(`This demo is limited to ${state.limits.maxMessages} customer messages per session.`);
    err.statusCode = 429;
    throw err;
  }
  const elapsed = Date.now() - (session.lastCustomerMessageAt || 0);
  if (session.lastCustomerMessageAt && elapsed < state.limits.minMessageIntervalMs) {
    const err = new Error("You’re sending messages a little too quickly. Please try again in a moment.");
    err.statusCode = 429;
    throw err;
  }
}

function preflightStaffMessage(rawText) {
  const text = typeof rawText === "string" ? rawText.replace(/\u0000/g, "").trim() : "";
  if (!text) {
    const err = new Error("Please type a staff reply first.");
    err.statusCode = 400;
    throw err;
  }
}

function enforceStaffMessageLimit(session) {
  enforceSessionMessageCapacity(session, 1);
  const now = Date.now();
  const count = Number.isFinite(session.staffMessageCount) ? session.staffMessageCount : 0;
  const lastAt = Number.isFinite(session.lastStaffMessageAt) ? session.lastStaffMessageAt : 0;
  if (count >= MAX_STAFF_MESSAGES_PER_SESSION) {
    const err = new Error(`This demo is limited to ${MAX_STAFF_MESSAGES_PER_SESSION} staff replies per session.`);
    err.statusCode = 429;
    throw err;
  }
  if (lastAt && now - lastAt < MIN_STAFF_MESSAGE_INTERVAL_MS) {
    const err = new Error("Staff replies are being sent a little too quickly. Please try again in a moment.");
    err.statusCode = 429;
    throw err;
  }
  session.staffMessageCount = count + 1;
  session.lastStaffMessageAt = now;
}

function securityHeaders(res, { dashboard = false } = {}) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  const stylePolicy = dashboard ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'";
  const framePolicy = dashboard ? "frame-ancestors 'self'" : "frame-ancestors 'none'";
  const imagePolicy = dashboard ? "img-src 'self' data: blob:" : "img-src 'self' data:";
  res.setHeader("Content-Security-Policy", `default-src 'self'; ${imagePolicy}; ${stylePolicy}; script-src 'self'; connect-src 'self'; base-uri 'self'; ${framePolicy}; form-action 'self'`);
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

async function requireDemoSession(id) {
  let session = state.getSession(id);
  if (!session && shared.enabled) {
    const stored = await shared.loadSession(id);
    if (stored) session = state.restoreSession(stored);
  }
  return session || state.requireSession(id);
}

async function persistSession(session) {
  await shared.saveSession(session);
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
    limits: {
      ...state.limits,
      maxTotalMessagesPerSession: MAX_TOTAL_MESSAGES_PER_SESSION,
      maxStaffMessagesPerSession: MAX_STAFF_MESSAGES_PER_SESSION,
    },
  };
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, ai.configured ? 200 : 503, {
      ok: ai.configured,
      configured: ai.configured,
    });
  }
  if (req.method === "GET" && url.pathname === "/api/demo/config") {
    return sendJson(res, 200, publicConfig());
  }
  if (req.method === "POST" && url.pathname === "/api/demo/sessions") {
    const body = await readJson(req);
    const ip = clientIp(req);
    await shared.enforceSessionCreationLimit(ip, state.limits.maxSessionsPerIpDay);
    const session = state.createSession({ channel: body.channel, ip });
    await persistSession(session);
    return sendJson(res, 201, { session: state.publicSession(session) });
  }

  const match = url.pathname.match(/^\/api\/demo\/sessions\/([^/]+)(?:\/(channel|mode|staff-message|message))?$/);
  if (!match) return false;
  const session = await requireDemoSession(decodeURIComponent(match[1]));
  const action = match[2] || null;

  if (req.method === "GET" && !action) {
    return sendJson(res, 200, { session: state.publicSession(session) });
  }
  if (req.method !== "POST" || !action) return false;
  const body = await readJson(req);

  if (action === "channel") {
    state.setChannel(session, body.channel);
    await persistSession(session);
    return sendJson(res, 200, { session: state.publicSession(session) });
  }
  if (action === "mode") {
    state.setMode(session, body.mode);
    await persistSession(session);
    return sendJson(res, 200, { session: state.publicSession(session) });
  }
  if (action === "staff-message") {
    preflightStaffMessage(body.message);
    enforceStaffMessageLimit(session);
    state.addStaffMessage(session, body.message);
    await persistSession(session);
    return sendJson(res, 200, { session: state.publicSession(session) });
  }
  if (action === "message") {
    const willUseAi = session.mode === "ai";
    const releaseAiSlot = willUseAi ? acquireAiSlot() : null;
    try {
      enforceSessionMessageCapacity(session, willUseAi ? 2 : 1);
      preflightCustomerMessage(session, body.message);
      await shared.enforceDailyMessageLimit(state.limits.maxTotalMessagesPerDay);
      state.addCustomerMessage(session, body.message);
      await persistSession(session);
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
        console.error("AI service escaped its fallback boundary; using deterministic demo fallback:", aiError);
        reply = ai.getFallbackReply(history);
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
      await persistSession(session);
      return sendJson(res, 200, {
        session: state.publicSession(session),
        aiReplied: !degraded,
        degraded,
        promotion: showPromotion ? clinic.promotion : null,
      });
    } finally {
      releaseAiSlot?.();
    }
  }
  return false;
}

function safeDashboardPath(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  const relative = decoded.replace(/^\/dashboard\/?/, "");
  if (!relative || !path.extname(relative)) return path.join(DASHBOARD_DIST, "index.html");
  const normalized = path.normalize(relative).replace(/^(\.\.[/\\])+/, "");
  const fullPath = path.join(DASHBOARD_DIST, normalized);
  return fullPath.startsWith(DASHBOARD_DIST) ? fullPath : null;
}

function buildDashboardIndex(filePath, mountPath = "") {
  const baseHref = `${mountPath}/dashboard/`;
  let html = fs.readFileSync(filePath, "utf8");
  if (html.includes("<base ")) {
    html = html.replace(/<base\s+href="[^"]*"\s*\/?>/, `<base href="${baseHref}" />`);
  } else {
    html = html.replace("<head>", `<head>\n    <base href="${baseHref}" />`);
  }
  return html;
}

function serveDashboard(req, res, pathname, mountPath = "") {
  if (!fs.existsSync(DASHBOARD_DIST)) {
    securityHeaders(res, { dashboard: true });
    const payload = Buffer.from("React dashboard has not been built yet. Run npm run build:dashboard.");
    res.writeHead(503, {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Length": payload.length,
      "Cache-Control": "no-store",
    });
    if (req.method === "HEAD") return res.end(), true;
    res.end(payload);
    return true;
  }
  const filePath = safeDashboardPath(pathname);
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
  securityHeaders(res, { dashboard: true });
  const isIndex = path.basename(filePath) === "index.html";

  if (isIndex) {
    const payload = Buffer.from(buildDashboardIndex(filePath, mountPath));
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": payload.length,
      "Cache-Control": "no-cache, max-age=0, must-revalidate",
    });
    if (req.method === "HEAD") return res.end(), true;
    res.end(payload);
    return true;
  }

  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    "Content-Length": stat.size,
    "Cache-Control": "public, max-age=31536000, immutable",
  });
  if (req.method === "HEAD") return res.end(), true;
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function safeStaticPath(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  const requested = decoded === "/" ? "/index.html" : decoded;
  const normalized = path.normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const fullPath = path.join(PUBLIC_DIR, normalized);
  return fullPath.startsWith(PUBLIC_DIR) ? fullPath : null;
}

function buildEnhancedIndex(filePath) {
  let html = fs.readFileSync(filePath, "utf8");
  const dashboardStartToken = '        <div id="dashboardView" class="view-panel" role="tabpanel">';
  const proofStartToken = '      <section class="proof-grid">';
  const dashboardStart = html.indexOf(dashboardStartToken);
  const proofStart = html.indexOf(proofStartToken, dashboardStart + dashboardStartToken.length);

  if (dashboardStart >= 0 && proofStart > dashboardStart && PORTAL_DASHBOARD_PARTS.every((part) => fs.existsSync(part))) {
    const portalDashboard = PORTAL_DASHBOARD_PARTS.map((part) => fs.readFileSync(part, "utf8")).join("");
    const replacement = `${dashboardStartToken}\n          <iframe id="reactDashboardFrame" class="react-dashboard-frame" src="/dashboard/inbox" title="Nova Demo Clinic staff portal"></iframe>\n          <div class="legacy-dashboard-hooks" aria-hidden="true">\n${portalDashboard}\n          </div>\n        </div>\n      </section>\n\n`;
    html = html.slice(0, dashboardStart) + replacement + html.slice(proofStart);
  }

  // Keep the strict style CSP. The dashboard uses CSS classes instead of inline
  // style attributes, and this guard prevents a future sample fragment from
  // accidentally reintroducing CSP-blocked inline styling.
  html = html.replace(/\sstyle="[^"]*"/g, "");

  if (!html.includes('/portal-demo.css')) {
    html = html.replace('</head>', '  <link rel="stylesheet" href="/portal-demo.css" />\n  <link rel="stylesheet" href="/portal-fidelity.css" />\n  <link rel="stylesheet" href="/portal-fidelity-extra.css" />\n</head>');
  }
  if (!html.includes('/portal-data.js')) {
    html = html.replace(
      '  <script src="/app.js" defer></script>',
      '  <script src="/subpath-bootstrap.js" defer></script>\n  <script src="/portal-data.js" defer></script>\n  <script src="/app.js" defer></script>\n  <script src="/portal-demo.js" defer></script>\n  <script src="/portal-fidelity.js" defer></script>'
    );
  }

  // Use document-relative local assets so the same HTML works at both `/` on
  // Render and `/ai-chatbot/` when reverse-proxied through the company domain.
  html = html.replace(/\b(href|src)="\/(?!\/)/g, '$1="./');
  return html;
}

function rewritePublicCss(css) {
  return css
    .replace(/url\((['"]?)\/(?!\/)/g, 'url($1./')
    .replace(/@import\s+(['"])\/(?!\/)/g, '@import $1./');
}

function serveStatic(req, res, pathname) {
  let filePath = safeStaticPath(pathname);
  if (!filePath) return false;
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    filePath = path.join(PUBLIC_DIR, "index.html");
  }
  securityHeaders(res);

  if (path.basename(filePath) === "index.html") {
    const payload = Buffer.from(buildEnhancedIndex(filePath));
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": payload.length,
      "Cache-Control": "no-cache, max-age=0, must-revalidate",
    });
    if (req.method === "HEAD") {
      res.end();
      return true;
    }
    res.end(payload);
    return true;
  }

  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".css") {
    const payload = Buffer.from(rewritePublicCss(fs.readFileSync(filePath, "utf8")));
    res.writeHead(200, {
      "Content-Type": MIME[extension],
      "Content-Length": payload.length,
      "Cache-Control": "no-cache, max-age=0, must-revalidate",
    });
    if (req.method === "HEAD") {
      res.end();
      return true;
    }
    res.end(payload);
    return true;
  }

  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    "Content-Type": MIME[extension] || "application/octet-stream",
    "Content-Length": stat.size,
    "Cache-Control": "no-cache, max-age=0, must-revalidate",
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
    const mountedRequest = url.pathname === PUBLIC_MOUNT_PATH || url.pathname.startsWith(`${PUBLIC_MOUNT_PATH}/`);

    if ((req.method === "GET" || req.method === "HEAD") && url.pathname === PUBLIC_MOUNT_PATH) {
      securityHeaders(res);
      res.writeHead(308, {
        Location: `${PUBLIC_MOUNT_PATH}/`,
        "Cache-Control": "no-cache, max-age=0, must-revalidate",
      });
      return res.end();
    }

    url.pathname = stripPublicMountPath(url.pathname);

    const handled = await handleApi(req, res, url);
    if (handled !== false) return;
    if (url.pathname.startsWith("/api/")) {
      return sendJson(res, 404, { error: "API route not found." });
    }
    if ((req.method === "GET" || req.method === "HEAD") && url.pathname.startsWith("/dashboard")) {
      if (serveDashboard(req, res, url.pathname, mountedRequest ? PUBLIC_MOUNT_PATH : "")) return;
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
  console.log("AI provider configured:", ai.configured);
});
