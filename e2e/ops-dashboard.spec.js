const { test, expect } = require("@playwright/test");

const credentials = { username: "ops-e2e", password: "ops-e2e-pass" };
const baseURL = "http://127.0.0.1:3100";

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

test("ops dashboard keeps the operational story ahead of audience detail on desktop", async ({ browser }) => {
  const context = await browser.newContext({ baseURL, httpCredentials: credentials, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await seedDemo(page.request);
  await page.goto("/ops");

  await expect(page.getByRole("heading", { name: "AI Chatbot Performance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Demo funnel" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI health" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Visitor analytics" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Performance over time" })).toBeVisible();
  await expect(page.getByText("Consultation clicks", { exact: true })).toBeVisible();
  await expect(page.getByText("Repeat rate", { exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Engage %" })).toBeVisible();
  await expect(page.locator("details.diagnostics")).not.toHaveAttribute("open", "");

  const hierarchyIsCorrect = await page.evaluate(() => {
    const primary = document.querySelector(".primary-grid");
    const audience = document.querySelector("#audienceAnalytics");
    const trends = document.querySelector(".trends-panel");
    if (!primary || !audience || !trends) return false;
    const primaryBeforeAudience = Boolean(primary.compareDocumentPosition(audience) & Node.DOCUMENT_POSITION_FOLLOWING);
    const audienceBeforeTrends = Boolean(audience.compareDocumentPosition(trends) & Node.DOCUMENT_POSITION_FOLLOWING);
    return primaryBeforeAudience && audienceBeforeTrends;
  });
  expect(hierarchyIsCorrect).toBe(true);

  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(hasOverflow).toBe(false);

  await page.screenshot({ path: "visual-artifacts/ops-dashboard.png", fullPage: true });
  await context.close();
});

test("ops dashboard uses compact KPI and visitor layouts on mobile", async ({ browser }) => {
  const context = await browser.newContext({ baseURL, httpCredentials: credentials, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/ops");

  await expect(page.getByRole("heading", { name: "AI Chatbot Performance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Visitor analytics" })).toBeVisible();
  await expect(page.locator(".kpi-card")).toHaveCount(4);
  await expect(page.locator(".audience-kpi")).toHaveCount(4);
  await expect(page.locator(".funnel-row").first()).toBeVisible();
  await expect(page.locator(".audience-privacy-chip")).toBeVisible();
  await expect(page.locator(".audience-recent-table thead")).toHaveCSS("display", "none");

  const boxes = await Promise.all([
    page.locator(".kpi-card").nth(0).boundingBox(),
    page.locator(".kpi-card").nth(1).boundingBox(),
  ]);
  expect(boxes[0]).not.toBeNull();
  expect(boxes[1]).not.toBeNull();
  expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThanOrEqual(2);

  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(hasOverflow).toBe(false);
  await context.close();
});
