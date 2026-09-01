const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:3100/health",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      ...process.env,
      PORT: "3100",
      NODE_ENV: "production",
      AI_PROVIDER: "mock",
      DEMO_MAX_SESSIONS_PER_IP_DAY: "99",
      DEMO_MAX_TOTAL_MESSAGES_PER_DAY: "999",
      DEMO_MIN_MESSAGE_INTERVAL_MS: "1",
      DEMO_MAX_TOTAL_MESSAGES_PER_SESSION: "99",
      DEMO_MAX_STAFF_MESSAGES_PER_SESSION: "40",
      DEMO_MIN_STAFF_MESSAGE_INTERVAL_MS: "1",
      DEMO_MAX_CONCURRENT_AI_REQUESTS: "8",
    },
  },
});
