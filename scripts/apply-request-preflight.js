const fs = require('fs');
const file = 'src/server.js';
let s = fs.readFileSync(file, 'utf8');

s = s.replace('const staffActivity = new WeakMap();\n', '');

const capacity = `function enforceSessionMessageCapacity(session, additionalMessages = 1) {\n  if (session.messages.length + additionalMessages > MAX_TOTAL_MESSAGES_PER_SESSION) {\n    const err = new Error(\`This demo session is limited to \${MAX_TOTAL_MESSAGES_PER_SESSION} total messages.\`);\n    err.statusCode = 429;\n    throw err;\n  }\n}\n`;
const preflight = `\nfunction preflightCustomerMessage(session, rawText) {\n  const text = typeof rawText === "string" ? rawText.replace(/\\u0000/g, "").trim() : "";\n  if (!text) {\n    const err = new Error("Please type a message first.");\n    err.statusCode = 400;\n    throw err;\n  }\n  if (session.customerMessageCount >= state.limits.maxMessages) {\n    const err = new Error(\`This demo is limited to \${state.limits.maxMessages} customer messages per session.\`);\n    err.statusCode = 429;\n    throw err;\n  }\n  const elapsed = Date.now() - (session.lastCustomerMessageAt || 0);\n  if (session.lastCustomerMessageAt && elapsed < state.limits.minMessageIntervalMs) {\n    const err = new Error("You’re sending messages a little too quickly. Please try again in a moment.");\n    err.statusCode = 429;\n    throw err;\n  }\n}\n\nfunction preflightStaffMessage(rawText) {\n  const text = typeof rawText === "string" ? rawText.replace(/\\u0000/g, "").trim() : "";\n  if (!text) {\n    const err = new Error("Please type a staff reply first.");\n    err.statusCode = 400;\n    throw err;\n  }\n}\n`;
if (!s.includes('function preflightCustomerMessage(')) {
  if (!s.includes(capacity)) throw new Error('capacity insertion point not found');
  s = s.replace(capacity, capacity + preflight);
}

s = s.replace(
  '  if (action === "staff-message") {\n    enforceStaffMessageLimit(session);',
  '  if (action === "staff-message") {\n    preflightStaffMessage(body.message);\n    enforceStaffMessageLimit(session);'
);
s = s.replace(
  '      enforceSessionMessageCapacity(session, willUseAi ? 2 : 1);\n      await shared.enforceDailyMessageLimit(state.limits.maxTotalMessagesPerDay);',
  '      enforceSessionMessageCapacity(session, willUseAi ? 2 : 1);\n      preflightCustomerMessage(session, body.message);\n      await shared.enforceDailyMessageLimit(state.limits.maxTotalMessagesPerDay);'
);

fs.writeFileSync(file, s);
console.log('request preflight applied');
