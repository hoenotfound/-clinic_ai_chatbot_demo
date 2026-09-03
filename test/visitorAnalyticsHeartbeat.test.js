const test = require("node:test");
const assert = require("node:assert/strict");

const PRELOAD_PATH = require.resolve("../src/visitorAnalyticsPreload");

test("audience persistence throttles repeated heartbeats to five-minute intervals", () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  delete require.cache[PRELOAD_PATH];

  try {
    const preload = require("../src/visitorAnalyticsPreload");
    const lastPersistedAt = 1_000;
    assert.equal(preload._test.heartbeatDue(lastPersistedAt, lastPersistedAt + 299_999), false);
    assert.equal(preload._test.heartbeatDue(lastPersistedAt, lastPersistedAt + 300_000), true);
  } finally {
    delete require.cache[PRELOAD_PATH];
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});
