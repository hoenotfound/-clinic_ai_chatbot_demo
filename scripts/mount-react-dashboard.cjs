const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const serverPath = path.join(root, 'src', 'server.js');
const cssPath = path.join(root, 'public', 'sales-demo.css');
const renderPath = path.join(root, 'render.yaml');
let server = fs.readFileSync(serverPath, 'utf8');
let css = fs.readFileSync(cssPath, 'utf8');
let render = fs.readFileSync(renderPath, 'utf8');

function replaceOnce(source, oldText, newText, label) {
  if (!source.includes(oldText)) {
    if (source.includes(newText)) return source;
    throw new Error(`Could not find ${label}`);
  }
  return source.replace(oldText, newText);
}

server = replaceOnce(
  server,
  'const PUBLIC_DIR = path.join(__dirname, "..", "public");\n',
  'const PUBLIC_DIR = path.join(__dirname, "..", "public");\nconst DASHBOARD_DIST = path.join(__dirname, "..", "portal-react", "dist");\n',
  'PUBLIC_DIR declaration'
);

server = replaceOnce(
  server,
  '  ".ico": "image/x-icon",\n};',
  '  ".ico": "image/x-icon",\n  ".woff": "font/woff",\n  ".woff2": "font/woff2",\n};',
  'MIME font entries'
);

const oldSecurity = `function securityHeaders(res) {\n  res.setHeader("X-Content-Type-Options", "nosniff");\n  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");\n  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");\n  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");\n  if (process.env.NODE_ENV === "production") {\n    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");\n  }\n  res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");\n}`;
const newSecurity = `function securityHeaders(res, { dashboard = false } = {}) {\n  res.setHeader("X-Content-Type-Options", "nosniff");\n  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");\n  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");\n  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");\n  if (process.env.NODE_ENV === "production") {\n    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");\n  }\n  const stylePolicy = dashboard ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'";\n  const framePolicy = dashboard ? "frame-ancestors 'self'" : "frame-ancestors 'none'";\n  const imagePolicy = dashboard ? "img-src 'self' data: blob:" : "img-src 'self' data:";\n  res.setHeader("Content-Security-Policy", \`default-src 'self'; \${imagePolicy}; \${stylePolicy}; script-src 'self'; connect-src 'self'; base-uri 'self'; \${framePolicy}; form-action 'self'\`);\n}`;
server = replaceOnce(server, oldSecurity, newSecurity, 'securityHeaders');

const safeStaticMarker = 'function safeStaticPath(pathname) {';
const dashboardHelpers = `function safeDashboardPath(pathname) {\n  let decoded;\n  try { decoded = decodeURIComponent(pathname); } catch { return null; }\n  const relative = decoded.replace(/^\\/dashboard\\/?/, "");\n  if (!relative || !path.extname(relative)) return path.join(DASHBOARD_DIST, "index.html");\n  const normalized = path.normalize(relative).replace(/^(\\.\\.[/\\\\])+/, "");\n  const fullPath = path.join(DASHBOARD_DIST, normalized);\n  return fullPath.startsWith(DASHBOARD_DIST) ? fullPath : null;\n}\n\nfunction serveDashboard(req, res, pathname) {\n  if (!fs.existsSync(DASHBOARD_DIST)) {\n    securityHeaders(res, { dashboard: true });\n    const payload = Buffer.from("React dashboard has not been built yet. Run npm run build:dashboard.");\n    res.writeHead(503, {\n      "Content-Type": "text/plain; charset=utf-8",\n      "Content-Length": payload.length,\n      "Cache-Control": "no-store",\n    });\n    if (req.method === "HEAD") return res.end(), true;\n    res.end(payload);\n    return true;\n  }\n  const filePath = safeDashboardPath(pathname);\n  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;\n  securityHeaders(res, { dashboard: true });\n  const stat = fs.statSync(filePath);\n  const isIndex = path.basename(filePath) === "index.html";\n  res.writeHead(200, {\n    "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",\n    "Content-Length": stat.size,\n    "Cache-Control": isIndex ? "no-cache, max-age=0, must-revalidate" : "public, max-age=31536000, immutable",\n  });\n  if (req.method === "HEAD") return res.end(), true;\n  fs.createReadStream(filePath).pipe(res);\n  return true;\n}\n\n`;
if (!server.includes('function safeDashboardPath(pathname)')) {
  if (!server.includes(safeStaticMarker)) throw new Error('Could not find safeStaticPath marker');
  server = server.replace(safeStaticMarker, dashboardHelpers + safeStaticMarker);
}

const oldReplacement = '    const replacement = `${dashboardStartToken}\\n${portalDashboard}\\n        </div>\\n      </section>\\n\\n`;';
const newReplacement = '    const replacement = `${dashboardStartToken}\\n          <iframe id="reactDashboardFrame" class="react-dashboard-frame" src="/dashboard/inbox" title="Nova Demo Clinic staff portal"></iframe>\\n          <div class="legacy-dashboard-hooks" aria-hidden="true">\\n${portalDashboard}\\n          </div>\\n        </div>\\n      </section>\\n\\n`;';
server = replaceOnce(server, oldReplacement, newReplacement, 'dashboard replacement');

const oldRoute = '    if (url.pathname.startsWith("/api/")) {\n      return sendJson(res, 404, { error: "API route not found." });\n    }\n    if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res, url.pathname);';
const newRoute = '    if (url.pathname.startsWith("/api/")) {\n      return sendJson(res, 404, { error: "API route not found." });\n    }\n    if ((req.method === "GET" || req.method === "HEAD") && url.pathname.startsWith("/dashboard")) {\n      if (serveDashboard(req, res, url.pathname)) return;\n    }\n    if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res, url.pathname);';
server = replaceOnce(server, oldRoute, newRoute, 'dashboard server route');

const cssPatch = `\n/* React production portal mounted inside Clinic Dashboard. */\n.react-dashboard-frame { display: block; width: 100%; height: clamp(720px, 86vh, 920px); min-height: 720px; border: 0; background: #faf9f6; }\n.legacy-dashboard-hooks { display: none !important; }\n#dashboardView.active { background: #faf9f6; }\n@media (max-width: 767px) { .react-dashboard-frame { height: 82dvh; min-height: 650px; } }\n`;
if (!css.includes('.react-dashboard-frame')) css += cssPatch;

render = render.replace('buildCommand: npm ci --omit=dev', 'buildCommand: npm ci --omit=dev && npm run build:dashboard');

fs.writeFileSync(serverPath, server);
fs.writeFileSync(cssPath, css);
fs.writeFileSync(renderPath, render);
console.log('Mounted React dashboard in demo server.');
