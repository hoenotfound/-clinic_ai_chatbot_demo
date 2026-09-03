const { test, expect } = require("@playwright/test");

const credentials = { username: "ops-e2e", password: "ops-e2e-pass" };

async function seedDemo(request) {
  await request.post("/api/telemetry", {
    data: { visitorId: "ops-e2e-visitor-001", event: "patient_view", surface: "patient" },
  });
  await request.post("/api/telemetry", {
    data: { visitorId: "ops-e2e-visitor-001", event: "demo_started", surface: "patient" },
  });
  await request.post("/api/telemetry", {
    data: { visitorId: "ops-e2e-visitor-001", event: "message_1", surface: "patient" },
  });
  await request.post("/api/telemetry", {
    data: { visitorId: "ops-e2e-visitor-001", event: "dashboard_view", surface: "dashboard" },
  });
}

test("ops dashboard keeps a clear hierarchy on desktop", async ({ browser }) => {
  const context = await browser.newContext({ httpCredentials: credentials, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await seedDemo(page.request);
  await page.goto("/ops");

  await expect(page.getByRole("heading", { name: "AI Chatbot Performance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Demo funnel" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI health" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Performance over time" })).toBeVisible();
  await expect(page.locator("details.diagnostics")).not.toHaveAttribute("open", "");

  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(hasOverflow).toBe(false);

  await page.screenshot({ path: "visual-artifacts/ops-dashboard.png", fullPage: true });
  await context.close();
});

test("ops dashboard stays usable on mobile", async ({ browser }) => {
  const context = await browser.newContext({ httpCredentials: credentials, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/ops");

  await expect(page.getByRole("heading", { name: "AI Chatbot Performance" })).toBeVisible();
  await expect(page.locator(".kpi-card")).toHaveCount(4);
  await expect(page.locator(".funnel-row").first()).toBeVisible();

  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(hasOverflow).toBe(false);
  await context.close();
});
