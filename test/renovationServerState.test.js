const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const demoState = require("../src/demoState");

test("server preserves hidden measurement-offer state for the next AI turn without exposing it publicly", () => {
  const serverSource = fs.readFileSync(path.join(__dirname, "../src/server.js"), "utf8");

  assert.match(
    serverSource,
    /session\.messages\.map\(\(message\) => \(\{[\s\S]{0,220}measurementOffered:\s*true/,
    "server AI history must carry the persisted measurementOffered flag"
  );

  const session = demoState.createSession({ ip: "server-hidden-measurement-state-test" });
  const stored = demoState.addAssistantMessage(
    session,
    "Want me to get the team to arrange a site measurement? [[MEASUREMENT_OFFERED]]"
  );

  assert.equal(stored.measurementOffered, true);
  const publicCopy = demoState.publicSession(session);
  assert.equal("measurementOffered" in publicCopy.messages.at(-1), false);
  assert.doesNotMatch(publicCopy.messages.at(-1).content, /MEASUREMENT_OFFERED/);
});
