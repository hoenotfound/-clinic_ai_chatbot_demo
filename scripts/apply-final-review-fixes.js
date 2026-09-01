const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);

function replace(file, from, to, label) {
  let content = read(file);
  if (content.includes(to)) return;
  if (!content.includes(from)) throw new Error(`Could not find ${label || from} in ${file}`);
  content = content.replace(from, to);
  write(file, content);
}

function insertAfter(file, marker, addition, label) {
  let content = read(file);
  if (content.includes(addition.trim())) return;
  if (!content.includes(marker)) throw new Error(`Could not find ${label || marker} in ${file}`);
  content = content.replace(marker, marker + addition);
  write(file, content);
}

// 1) Booking intent is a Hot lead business rule, not merely a scoring side effect.
replace(
  'src/demoState.js',
  '  const temperature = score >= 7 ? "hot" : score >= 3 ? "warm" : "cold";',
  '  const temperature = bookingIntent || score >= 7 ? "hot" : score >= 3 ? "warm" : "cold";',
  'temperature calculation'
);
replace(
  'src/demoState.js',
  '    customerMessageCount: 0,\n    lastCustomerMessageAt: 0,',
  '    customerMessageCount: 0,\n    lastCustomerMessageAt: 0,\n    staffMessageCount: 0,\n    lastStaffMessageAt: 0,',
  'persistent staff counters'
);
insertAfter(
  'src/demoState.js',
  'function setChannel(session, channel) {\n  if (!CHANNELS.has(channel)) {\n    const err = new Error("Unsupported demo channel.");\n    err.statusCode = 400;\n    throw err;\n  }\n  session.channel = channel;\n  touchSession(session);\n}\n',
  '\nfunction restoreSession(session) {\n  if (!session || typeof session.id !== "string") return null;\n  if (!Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) return null;\n  if (!Number.isFinite(session.staffMessageCount)) session.staffMessageCount = 0;\n  if (!Number.isFinite(session.lastStaffMessageAt)) session.lastStaffMessageAt = 0;\n  sessions.set(session.id, session);\n  return session;\n}\n',
  'restoreSession insertion point'
);
replace(
  'src/demoState.js',
  '  setChannel,\n  publicSession,',
  '  setChannel,\n  restoreSession,\n  publicSession,',
  'restoreSession export'
);

// 2) Shorter provider timeout for a sales demo.
replace(
  'src/aiService.js',
  'const configured = provider === "mock" ||\n  (provider === "claude" && Boolean(process.env.ANTHROPIC_API_KEY)) ||\n  (provider === "gemini" && Boolean(process.env.GEMINI_API_KEY));',
  'const configured = provider === "mock" ||\n  (provider === "claude" && Boolean(process.env.ANTHROPIC_API_KEY)) ||\n  (provider === "gemini" && Boolean(process.env.GEMINI_API_KEY));\n\nconst parsedTimeout = Number.parseInt(process.env.AI_REQUEST_TIMEOUT_MS || "15000", 10);\nconst AI_REQUEST_TIMEOUT_MS = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 15000;',
  'AI timeout config'
);
replace(
  'src/aiService.js',
  '  const timer = setTimeout(() => controller.abort(), 30_000);',
  '  const timer = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);',
  'AI timeout'
);

// 3) Shared Render Key Value / Redis support. Falls back to local memory if REDIS_URL is absent/unavailable.
const sharedState = `const Redis = require("ioredis");\n\nconst redisUrl = String(process.env.REDIS_URL || "").trim();\nconst enabled = Boolean(redisUrl);\nlet client = null;\nlet warned = false;\n\nfunction rateLimitError(message) {\n  const err = new Error(message);\n  err.statusCode = 429;\n  err.isSharedRateLimit = true;\n  return err;\n}\n\nfunction getClient() {\n  if (!enabled) return null;\n  if (!client) {\n    client = new Redis(redisUrl, {\n      lazyConnect: true,\n      maxRetriesPerRequest: 1,\n      connectTimeout: 2500,\n      enableReadyCheck: true,\n    });\n    client.on("error", (error) => {\n      if (!warned) {\n        warned = true;\n        console.warn("Shared demo state unavailable; using in-memory fallback:", error.message);\n      }\n    });\n  }\n  return client;\n}\n\nasync function run(operation, fallback = null) {\n  if (!enabled) return fallback;\n  try {\n    const redis = getClient();\n    if (redis.status === "wait") await redis.connect();\n    return await operation(redis);\n  } catch (error) {\n    if (error?.isSharedRateLimit) throw error;\n    if (!warned) {\n      warned = true;\n      console.warn("Shared demo state unavailable; using in-memory fallback:", error.message);\n    }\n    return fallback;\n  }\n}\n\nfunction secondsUntilTomorrowUtc() {\n  const now = new Date();\n  const tomorrow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);\n  return Math.max(60, Math.ceil((tomorrow - now.getTime()) / 1000) + 300);\n}\n\nasync function incrementLimited(key, limit, ttlSeconds, message) {\n  return run(async (redis) => {\n    const count = await redis.incr(key);\n    if (count === 1) await redis.expire(key, ttlSeconds);\n    if (count > limit) throw rateLimitError(message);\n    return count;\n  });\n}\n\nasync function enforceSessionCreationLimit(ip, limit) {\n  const day = new Date().toISOString().slice(0, 10);\n  return incrementLimited(\n    \`demo:session-create:\${ip || "unknown"}:\${day}\`,\n    limit,\n    secondsUntilTomorrowUtc(),\n    "You’ve reached today’s demo-session limit. Please try again later."\n  );\n}\n\nasync function enforceDailyMessageLimit(limit) {\n  const day = new Date().toISOString().slice(0, 10);\n  return incrementLimited(\n    \`demo:customer-messages:\${day}\`,\n    limit,\n    secondsUntilTomorrowUtc(),\n    "Today’s public demo message limit has been reached. Please try again later."\n  );\n}\n\nasync function saveSession(session) {\n  if (!session?.id) return;\n  const ttl = Math.max(1, Math.ceil((session.expiresAt - Date.now()) / 1000));\n  await run((redis) => redis.set(\`demo:session:\${session.id}\`, JSON.stringify(session), "EX", ttl));\n}\n\nasync function loadSession(id) {\n  if (!id) return null;\n  return run(async (redis) => {\n    const raw = await redis.get(\`demo:session:\${id}\`);\n    if (!raw) return null;\n    const session = JSON.parse(raw);\n    if (!session.expiresAt || session.expiresAt <= Date.now()) {\n      await redis.del(\`demo:session:\${id}\`);\n      return null;\n    }\n    return session;\n  }, null);\n}\n\nmodule.exports = {\n  enabled,\n  enforceSessionCreationLimit,\n  enforceDailyMessageLimit,\n  saveSession,\n  loadSession,\n};\n`;
write('src/sharedState.js', sharedState);

// 4) Server: persistent sessions/counters and persistent staff throttling.
insertAfter(
  'src/server.js',
  'const state = require("./demoState");\n',
  'const shared = require("./sharedState");\n',
  'shared state import'
);
replace('src/server.js', 'const staffActivity = new WeakMap();\n', '', 'WeakMap staff activity');
replace(
  'src/server.js',
  '  const current = staffActivity.get(session) || { count: 0, lastAt: 0 };\n  if (current.count >= MAX_STAFF_MESSAGES_PER_SESSION) {',
  '  const count = Number.isFinite(session.staffMessageCount) ? session.staffMessageCount : 0;\n  const lastAt = Number.isFinite(session.lastStaffMessageAt) ? session.lastStaffMessageAt : 0;\n  if (count >= MAX_STAFF_MESSAGES_PER_SESSION) {',
  'staff count lookup'
);
replace(
  'src/server.js',
  '  if (current.lastAt && now - current.lastAt < MIN_STAFF_MESSAGE_INTERVAL_MS) {',
  '  if (lastAt && now - lastAt < MIN_STAFF_MESSAGE_INTERVAL_MS) {',
  'staff throttle timestamp'
);
replace(
  'src/server.js',
  '  staffActivity.set(session, { count: current.count + 1, lastAt: now });',
  '  session.staffMessageCount = count + 1;\n  session.lastStaffMessageAt = now;',
  'staff counter persistence'
);
insertAfter(
  'src/server.js',
  'function clientIp(req) {\n  const forwarded = req.headers["x-forwarded-for"];\n  if (typeof forwarded === "string" && forwarded) return forwarded.split(",")[0].trim();\n  return req.socket.remoteAddress || "unknown";\n}\n',
  '\nasync function requireDemoSession(id) {\n  let session = state.getSession(id);\n  if (!session && shared.enabled) {\n    const stored = await shared.loadSession(id);\n    if (stored) session = state.restoreSession(stored);\n  }\n  return session || state.requireSession(id);\n}\n\nasync function persistSession(session) {\n  await shared.saveSession(session);\n}\n',
  'session persistence helpers'
);
replace(
  'src/server.js',
  '    const body = await readJson(req);\n    const session = state.createSession({ channel: body.channel, ip: clientIp(req) });\n    return sendJson(res, 201, { session: state.publicSession(session) });',
  '    const body = await readJson(req);\n    const ip = clientIp(req);\n    await shared.enforceSessionCreationLimit(ip, state.limits.maxSessionsPerIpDay);\n    const session = state.createSession({ channel: body.channel, ip });\n    await persistSession(session);\n    return sendJson(res, 201, { session: state.publicSession(session) });',
  'session creation persistence'
);
replace(
  'src/server.js',
  '  const session = state.requireSession(decodeURIComponent(match[1]));',
  '  const session = await requireDemoSession(decodeURIComponent(match[1]));',
  'persistent session retrieval'
);
replace(
  'src/server.js',
  '    state.setChannel(session, body.channel);\n    return sendJson(res, 200, { session: state.publicSession(session) });',
  '    state.setChannel(session, body.channel);\n    await persistSession(session);\n    return sendJson(res, 200, { session: state.publicSession(session) });',
  'channel persistence'
);
replace(
  'src/server.js',
  '    state.setMode(session, body.mode);\n    return sendJson(res, 200, { session: state.publicSession(session) });',
  '    state.setMode(session, body.mode);\n    await persistSession(session);\n    return sendJson(res, 200, { session: state.publicSession(session) });',
  'mode persistence'
);
replace(
  'src/server.js',
  '    enforceStaffMessageLimit(session);\n    state.addStaffMessage(session, body.message);\n    return sendJson(res, 200, { session: state.publicSession(session) });',
  '    enforceStaffMessageLimit(session);\n    state.addStaffMessage(session, body.message);\n    await persistSession(session);\n    return sendJson(res, 200, { session: state.publicSession(session) });',
  'staff persistence'
);
replace(
  'src/server.js',
  '      enforceSessionMessageCapacity(session, willUseAi ? 2 : 1);\n      state.addCustomerMessage(session, body.message);',
  '      enforceSessionMessageCapacity(session, willUseAi ? 2 : 1);\n      await shared.enforceDailyMessageLimit(state.limits.maxTotalMessagesPerDay);\n      state.addCustomerMessage(session, body.message);\n      await persistSession(session);',
  'customer persistence'
);
replace(
  'src/server.js',
  '      if (showPromotion) state.markPromotionShown(session, assistantMessage.id);\n      return sendJson(res, 200, {',
  '      if (showPromotion) state.markPromotionShown(session, assistantMessage.id);\n      await persistSession(session);\n      return sendJson(res, 200, {',
  'assistant persistence'
);
insertAfter(
  'src/server.js',
  '  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");\n',
  '  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");\n',
  'robots response header'
);

// 5) CTA and booking copy should be prospect-facing, never deployment-facing.
replace(
  'public/app.js',
  '      showToast("Add SALES_CTA_URL in Render to connect this button to your WhatsApp or sales page.");',
  '      showToast("This demo setup button is not connected yet. Please contact us to continue.");',
  'CTA fallback'
);
replace(
  'public/app.js',
  '      showToast("Hot lead detected. Open Clinic Dashboard to see what your team would see.");',
  '      showToast("Booking intent detected. Open Clinic Dashboard to see what your team would see.");',
  'booking toast'
);
replace(
  'public/app.js',
  '  else if (!dashboard) els.tourStatus.textContent = "Hot lead detected — open Clinic Dashboard";',
  '  else if (!dashboard) els.tourStatus.textContent = "Booking intent detected — open Clinic Dashboard";',
  'booking tour copy'
);

// 6) Correct historical AI/staff ownership filtering based on actual staff participation.
replace(
  'public/portal-fidelity.js',
  "    if (owner?.value === 'ai' && lead.owner !== 'AI') return false;\n    if (owner?.value === 'human' && lead.owner === 'AI') return false;",
  "    const hasStaffParticipation = Boolean(lead.messages?.some((row) => row?.[0] === 'staff'));\n    if (owner?.value === 'ai' && hasStaffParticipation) return false;\n    if (owner?.value === 'human' && !hasStaffParticipation) return false;",
  'Inbox ownership filter'
);

// 7) Temperature filter counts and views represent open pipeline leads only.
replace(
  'public/portal-demo.js',
  '  function updatePipelineFilterCounts(all) {\n    const totals = {\n      all: all.length,\n      hot: all.filter((lead) => lead.temperature === "hot").length,\n      warm: all.filter((lead) => lead.temperature === "warm").length,\n      cold: all.filter((lead) => lead.temperature === "cold").length,\n      attention: all.filter((lead) => lead.attention).length,\n    };',
  '  function updatePipelineFilterCounts(all) {\n    const open = all.filter((lead) => lead.stage !== "won");\n    const totals = {\n      all: all.length,\n      hot: open.filter((lead) => lead.temperature === "hot").length,\n      warm: open.filter((lead) => lead.temperature === "warm").length,\n      cold: open.filter((lead) => lead.temperature === "cold").length,\n      attention: open.filter((lead) => lead.attention).length,\n    };',
  'Pipeline temperature counts'
);
replace(
  'public/portal-demo.js',
  '      if (pipelineCategory === "hot" && lead.temperature !== "hot") return false;\n      if (pipelineCategory === "warm" && lead.temperature !== "warm") return false;\n      if (pipelineCategory === "cold" && lead.temperature !== "cold") return false;',
  '      if (["hot", "warm", "cold", "attention"].includes(pipelineCategory) && lead.stage === "won") return false;\n      if (pipelineCategory === "hot" && lead.temperature !== "hot") return false;\n      if (pipelineCategory === "warm" && lead.temperature !== "warm") return false;\n      if (pipelineCategory === "cold" && lead.temperature !== "cold") return false;',
  'Pipeline open temperature filters'
);

// 8) noindex metadata.
insertAfter(
  'public/index.html',
  '  <meta name="description" content="Try a live AI clinic receptionist across WhatsApp, Instagram and Messenger customer experiences." />\n',
  '  <meta name="robots" content="noindex, nofollow, noarchive" />\n',
  'robots metadata'
);

// 9) Browser E2E should fail on any unexpected browser JS/console error, not only CSP errors.
replace(
  'e2e/demo.spec.js',
  '  const cspErrors = browserErrors.filter((message) => /content security policy|refused to apply inline style|refused to execute inline/i.test(message));\n  expect(cspErrors, `CSP/browser errors: ${cspErrors.join("\\n")}`).toEqual([]);',
  '  expect(browserErrors, `Browser errors: ${browserErrors.join("\\n")}`).toEqual([]);',
  'desktop browser error assertion'
);
// Replace the second identical block if still present.
let e2e = read('e2e/demo.spec.js');
e2e = e2e.replace(
  '  const cspErrors = browserErrors.filter((message) => /content security policy|refused to apply inline style|refused to execute inline/i.test(message));\n  expect(cspErrors, `CSP/browser errors: ${cspErrors.join("\\n")}`).toEqual([]);',
  '  expect(browserErrors, `Browser errors: ${browserErrors.join("\\n")}`).toEqual([]);'
);
write('e2e/demo.spec.js', e2e);

// 10) Regression for booking-only intent becoming Hot.
insertAfter(
  'test/demoState.test.js',
  'test("booking language moves a lead to hot", () => {\n  const session = state.createSession({ channel: "whatsapp", ip: "test-hot" });\n  state.addCustomerMessage(session, "How much is HIFU? I want to book this Saturday in KL");\n  assert.equal(session.lead.temperature, "hot");\n  assert.equal(session.lead.bookingIntent, true);\n  assert.equal(session.lead.preferredBranch, "Kuala Lumpur");\n  assert.match(session.lead.interests.join(" "), /HIFU/);\n});\n',
  '\ntest("booking intent alone is treated as hot", () => {\n  const session = state.createSession({ channel: "whatsapp", ip: "test-booking-only" });\n  state.addCustomerMessage(session, "Can I book tomorrow?");\n  assert.equal(session.lead.bookingIntent, true);\n  assert.equal(session.lead.temperature, "hot");\n});\n',
  'booking-only regression test'
);

// 11) Runtime dependency and deterministic CI.
const pkg = JSON.parse(read('package.json'));
pkg.dependencies = { ...(pkg.dependencies || {}), ioredis: '^6.0.0' };
write('package.json', JSON.stringify(pkg, null, 2) + '\n');
replace('render.yaml', '    buildCommand: npm install --omit=dev', '    buildCommand: npm ci --omit=dev', 'Render deterministic install');
insertAfter(
  'render.yaml',
  '      - key: GEMINI_MODEL\n        value: gemini-2.5-flash\n',
  '      - key: AI_REQUEST_TIMEOUT_MS\n        value: 15000\n      - key: REDIS_URL\n        sync: false\n',
  'Render AI timeout/Redis env'
);
replace('render.yaml', '      - key: SALES_CTA_URL\n        sync: false', '      - key: SALES_CTA_URL\n        sync: false', 'sales CTA placeholder');

let env = read('.env.example');
if (!env.includes('AI_REQUEST_TIMEOUT_MS=')) {
  env = env.replace('GEMINI_MODEL=gemini-2.5-flash\n', 'GEMINI_MODEL=gemini-2.5-flash\nAI_REQUEST_TIMEOUT_MS=15000\n\n# Optional shared state (recommended for public deployment)\nREDIS_URL=\n');
  write('.env.example', env);
}

replace('README.md', 'npm install', 'npm install', 'README npm install marker');
let readme = read('README.md');
if (!readme.includes('Shared state (recommended for public traffic)')) {
  readme += `\n## Shared state (recommended for public traffic)\n\nSet \`REDIS_URL\` to a same-region Render Key Value internal connection string to persist demo sessions and the major IP/day counters across web-service restarts. The app deliberately falls back to in-memory state when \`REDIS_URL\` is absent or temporarily unavailable, so local development remains simple.\n\nFor a public deployment, use a paid Render Key Value instance with persistence enabled and keep external access blocked.\n`;
  write('README.md', readme);
}

let workflow = read('.github/workflows/demo-ci.yml');
workflow = workflow.replace('        run: npm install\n', '        run: npm ci\n');
if (!workflow.includes('src/sharedState.js')) {
  workflow = workflow.replace('          node --check src/aiService.js\n', '          node --check src/aiService.js\n          node --check src/sharedState.js\n');
}
write('.github/workflows/demo-ci.yml', workflow);

console.log('Final review fixes applied.');
