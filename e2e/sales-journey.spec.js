const { test, expect } = require("@playwright/test");

async function openDashboard(page) {
  await page.getByRole("tab", { name: /Clinic dashboard/i }).click();
  const frame = page.frameLocator("#reactDashboardFrame");
  await expect(frame.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();
  return frame;
}

test("appointment pipeline shows the full enquiry-to-conversion journey", async ({ page }) => {
  await page.goto("/");
  const frame = await openDashboard(page);

  await frame.getByRole("link", { name: "Pipeline" }).click();
  await expect(frame.getByRole("heading", { name: "Lead Pipeline" })).toBeVisible();

  const desktopKanban = frame.locator("main.hidden.min-h-0.flex-1.overflow-x-auto");
  for (const stage of ["New Enquiry", "Qualified", "Appointment Requested", "Appointment Confirmed", "Visited", "Won"]) {
    await expect(desktopKanban.getByRole("heading", { name: stage, exact: true })).toBeVisible();
  }

  const aisyah = frame.getByRole("button", { name: /Nur Aisyah/ });
  const huiMin = frame.getByRole("button", { name: /陈慧敏 Hui Min/ });
  await expect(aisyah).toBeVisible();
  await expect(huiMin).toBeVisible();
  await expect(aisyah).toContainText("Appointment confirmed");
  await expect(huiMin).toContainText("Appointment confirmed");

  const allBranches = frame.getByRole("button", { name: /All branches/ });
  await expect(allBranches).toContainText("2 confirmed");
});

test("automated follow-up demo visualises a quiet lead being re-engaged", async ({ page }) => {
  await page.goto("/");
  const frame = await openDashboard(page);

  await frame.getByRole("link", { name: "Tools" }).click();
  await expect(frame.getByRole("heading", { name: "Reconnect with enquiries automatically" })).toBeVisible();
  const scenario = frame.locator("section").filter({ has: frame.getByRole("heading", { name: /Warm lead goes quiet/i }) });
  await expect(scenario).toBeVisible();

  await scenario.getByRole("button", { name: "Run follow-up demo" }).click();
  await expect(scenario.getByText("Waiting for 2 hours of inactivity…")).toBeVisible();
  await expect(scenario.getByText("Re-engagement sent ✓")).toBeVisible({ timeout: 5000 });
  await expect(scenario.getByText("Automatic follow-up", { exact: true })).toBeVisible();
  await expect(scenario.getByText(/Just checking in to see if you still need any help/i)).toBeVisible();
});

test("live lead card visibly transforms from qualified to appointment requested", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "How much is HIFU?" }).click();
  await expect(page.locator("#messages")).toContainText("RM 888");

  const frame = await openDashboard(page);
  await frame.getByRole("link", { name: "Pipeline" }).click();
  await expect(frame.getByRole("heading", { name: "Lead Pipeline" })).toBeVisible();

  const liveCard = frame.getByRole("button", { name: /Demo Patient/ });
  await expect(liveCard).toBeVisible();
  await expect(liveCard).toContainText("Live from Patient View");
  await expect(liveCard).toContainText("Warm");
  await expect(liveCard).toContainText("Qualified");
  await expect(liveCard).toContainText("HIFU Skin Lifting");

  await page.getByRole("tab", { name: /Patient view/i }).click();
  await page.getByRole("button", { name: "Can I come Saturday?" }).click();
  await expect(page.locator("#messages")).toContainText(/Saturday|weekend/i);

  await page.getByRole("tab", { name: /Clinic dashboard/i }).click();
  await expect(liveCard).toContainText("Hot", { timeout: 6000 });
  await expect(liveCard).toContainText("Appointment Requested", { timeout: 6000 });
  await expect(liveCard).toContainText("Appointment requested", { timeout: 6000 });
  await expect(liveCard).toContainText("Kuala Lumpur", { timeout: 6000 });
});
