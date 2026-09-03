const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const DASHBOARD_DIST = path.join(ROOT, "portal-react", "dist");
const OUTPUT_ROOT = path.join(ROOT, "netlify-dist");
const MOUNT_DIR = path.join(OUTPUT_ROOT, "ai-chatbot");
const PORTAL_DASHBOARD_PARTS = [1, 2, 3, 4].map((number) =>
  path.join(PUBLIC_DIR, `portal-dashboard-part${number}.html`)
);

function rewritePublicCss(css) {
  return css
    .replace(/url\((['"]?)\/(?!\/)/g, "url($1./")
    .replace(/@import\s+(['"])\/(?!\/)/g, "@import $1./");
}

function enhanceIndex(html) {
  const dashboardStartToken = '        <div id="dashboardView" class="view-panel" role="tabpanel">';
  const proofStartToken = '      <section class="proof-grid">';
  const dashboardStart = html.indexOf(dashboardStartToken);
  const proofStart = html.indexOf(proofStartToken, dashboardStart + dashboardStartToken.length);

  if (dashboardStart >= 0 && proofStart > dashboardStart && PORTAL_DASHBOARD_PARTS.every((part) => fs.existsSync(part))) {
    const portalDashboard = PORTAL_DASHBOARD_PARTS.map((part) => fs.readFileSync(part, "utf8")).join("");
    const replacement = `${dashboardStartToken}\n          <iframe id="reactDashboardFrame" class="react-dashboard-frame" src="/dashboard/inbox" title="Nova Demo Clinic staff portal"></iframe>\n          <div class="legacy-dashboard-hooks" aria-hidden="true">\n${portalDashboard}\n          </div>\n        </div>\n      </section>\n\n`;
    html = html.slice(0, dashboardStart) + replacement + html.slice(proofStart);
  }

  html = html.replace(/\sstyle="[^"]*"/g, "");

  if (!html.includes('/portal-demo.css')) {
    html = html.replace(
      '</head>',
      '  <link rel="stylesheet" href="/portal-demo.css" />\n' +
      '  <link rel="stylesheet" href="/portal-fidelity.css" />\n' +
      '  <link rel="stylesheet" href="/portal-fidelity-extra.css" />\n' +
      '  <link rel="stylesheet" href="/cold-start.css" />\n' +
      '</head>'
    );
  }

  if (!html.includes('/portal-data.js')) {
    html = html.replace(
      '  <script src="/app.js" defer></script>',
      '  <script src="/subpath-bootstrap.js" defer></script>\n' +
      '  <script src="/backend-readiness.js" defer></script>\n' +
      '  <script src="/portal-data.js" defer></script>\n' +
      '  <script src="/funnel-telemetry.js" defer></script>\n' +
      '  <script src="/app.js" defer></script>\n' +
      '  <script src="/portal-demo.js" defer></script>\n' +
      '  <script src="/portal-fidelity.js" defer></script>'
    );
  } else if (!html.includes('/funnel-telemetry.js')) {
    html = html.replace(
      '  <script src="/app.js" defer></script>',
      '  <script src="/funnel-telemetry.js" defer></script>\n' +
      '  <script src="/app.js" defer></script>'
    );
  }

  html = html.replace(
    '<div class="experience-status">\n              <span class="status-dot"></span>\n              <div><small>LIVE PRODUCT DEMO</small><strong>Nova Demo Aesthetic Clinic</strong></div>',
    '<div class="experience-status" aria-live="polite">\n              <span id="backendStatusDot" class="status-dot backend-starting"></span>\n              <div><small id="backendStatusLabel">STARTING LIVE AI RECEPTIONIST…</small><strong>Nova Demo Aesthetic Clinic</strong></div>'
  );

  // Convert local root-relative assets first, then add an absolute base tag.
  // This keeps every generated request under /ai-chatbot/ even when the
  // visitor opens the URL without a trailing slash.
  html = html.replace(/\b(href|src)="\/(?!\/)/g, '$1="./');
  if (!html.includes('<base href="/ai-chatbot/"')) {
    html = html.replace("<head>", '<head>\n  <base href="/ai-chatbot/" />');
  }
  return html;
}

function copyPublicFiles() {
  fs.cpSync(PUBLIC_DIR, MOUNT_DIR, { recursive: true });
  for (const file of fs.readdirSync(MOUNT_DIR)) {
    if (!file.endsWith(".css")) continue;
    const filePath = path.join(MOUNT_DIR, file);
    const css = fs.readFileSync(filePath, "utf8");
    fs.writeFileSync(filePath, rewritePublicCss(css));
  }
}

function buildNetlifyBundle() {
  if (!fs.existsSync(DASHBOARD_DIST)) {
    throw new Error("React dashboard build is missing. Run npm run build:dashboard first.");
  }

  fs.rmSync(OUTPUT_ROOT, { recursive: true, force: true });
  fs.mkdirSync(MOUNT_DIR, { recursive: true });
  copyPublicFiles();

  const sourceIndex = fs.readFileSync(path.join(PUBLIC_DIR, "index.html"), "utf8");
  fs.writeFileSync(path.join(MOUNT_DIR, "index.html"), enhanceIndex(sourceIndex));

  fs.cpSync(DASHBOARD_DIST, path.join(MOUNT_DIR, "dashboard"), { recursive: true });

  fs.writeFileSync(
    path.join(OUTPUT_ROOT, "_redirects"),
    [
      "/ai-chatbot/dashboard/* /ai-chatbot/dashboard/index.html 200",
      "",
    ].join("\n")
  );

  return { outputRoot: OUTPUT_ROOT, mountDir: MOUNT_DIR };
}

if (require.main === module) {
  const result = buildNetlifyBundle();
  console.log(`Netlify demo bundle built at ${result.mountDir}`);
}

module.exports = {
  buildNetlifyBundle,
  enhanceIndex,
  rewritePublicCss,
};