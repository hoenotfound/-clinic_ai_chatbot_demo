const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'portal-react', 'src', 'pages', 'Inbox.jsx');
let source = fs.readFileSync(file, 'utf8');
const replacements = [
  ['last_message: last?.text || "No messages yet"', 'last_message: last?.content || "No messages yet"'],
  ['source: m.source, content: m.text, created_at:', 'source: m.source, content: m.content, created_at:'],
  ['body: JSON.stringify({ text: text.trim() })', 'body: JSON.stringify({ message: text.trim() })'],
];
for (const [from, to] of replacements) {
  if (source.includes(from)) source = source.replace(from, to);
  else if (!source.includes(to)) throw new Error(`Missing adapter target: ${from}`);
}
fs.writeFileSync(file, source);
console.log('React live-session adapter fixed.');
