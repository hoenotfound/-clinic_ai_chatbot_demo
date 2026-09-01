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
  await expect(frame.getByText("New Enquiry", { exact: true }).first()).toBeVisible();
  await expect(frame.getByText("Qualified", { exact: true }).first()).toBeVisible();
  await expect(frame.getByText("Appointment Requested", { exact: true }).first()).toBeVisible();
  await expect(frame.getByText("Appointment Confirmed", { exact: true }).first()).toBeVisible();
  await expect(frame.getByText("Visited", { exact: true }).first()).toBeVisible();
  await expect(frame.getByText("Won", { exact: true }).first()).toBeVisible();

  await expect(frame.getByRole("button", { name: /Nur Aisyah/ })).toBeVisible();
  await expect(frame.getByRole("button", { name: /陈慧敏 Hui Min/ })).toBeVisible();
});

test("automated follow-up demo visualises a quiet lead being re-engaged", async ({ page }) => {
  await page.goto("/");
  const frame = await openDashboard(page);

  await frame.getByRole("link", { name: "Tools" }).click();
  await expect(frame.getByRole("heading", { name: "Reconnect with enquiries automatically" })).toBeVisible();
  await expect(frame.getByRole("heading", { name: /Warm lead goes quiet/i })).toBeVisible();

  await frame.getByRole("button", { name: "Run follow-up demo" }).click();
  await expect(frame.getByText("Waiting for 2 hours of inactivity…")).toBeVisible();
  await expect(frame.getByText("Re-engagement sent ✓")).toBeVisible({ timeout: 5000 });
  await expect(frame.getByText("Automatic follow-up", { exact: true })).toBeVisible();
  await expect(frame.getByText(/Just checking in to see if you still need any help/i)).toBeVisible();
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
  await expect(liveCard).toContainText("Kuala Lumpur", { timeout: 6000 });
});
