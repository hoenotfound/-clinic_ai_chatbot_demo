const { test, expect } = require("@playwright/test");

async function openDashboard(page) {
  await page.getByRole("tab", { name: /Clinic dashboard/i }).click();
  const frame = page.frameLocator("#reactDashboardFrame");
  await expect(frame.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();
  return frame;
}

test("Contacts, Settings and Team & Access work as real dashboard pages", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/", { waitUntil: "networkidle" });
  const frame = await openDashboard(page);

  await frame.getByRole("link", { name: "Contacts" }).click();
  await expect(frame.getByRole("heading", { name: "Contacts", exact: true })).toBeVisible();
  const contactSearch = frame.getByPlaceholder("Search by name, number or social ID…");
  await contactSearch.fill("Amanda Lee");
  await expect(frame.getByRole("button", { name: /Amanda Lee/ })).toBeVisible();
  await frame.getByRole("button", { name: /Amanda Lee/ }).click();
  await expect(frame.getByRole("heading", { name: "Amanda Lee", exact: true })).toBeVisible();
  const note = frame.getByPlaceholder("Add an internal note…");
  await note.fill("Follow up after the patient checks her work schedule.");
  await frame.getByRole("button", { name: "Add demo note" }).click();
  await expect(frame.getByText("Follow up after the patient checks her work schedule.", { exact: true })).toBeVisible();

  await frame.getByRole("link", { name: "Settings" }).click();
  await expect(frame.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await frame.getByRole("button", { name: "AI receptionist" }).click();
  await expect(frame.getByRole("heading", { name: "AI receptionist", exact: true })).toBeVisible();
  await expect(frame.getByText("Appointment intent detection", { exact: true })).toBeVisible();
  await frame.getByRole("button", { name: "Channels" }).click();
  await expect(frame.getByText("WhatsApp", { exact: true })).toBeVisible();
  await expect(frame.getByText("Instagram", { exact: true })).toBeVisible();
  await expect(frame.getByText("Facebook Messenger", { exact: true })).toBeVisible();

  await frame.getByRole("link", { name: "Team & Access" }).click();
  await expect(frame.getByRole("heading", { name: "Team & Access", exact: true })).toBeVisible();
  await expect(frame.getByText("Demo Admin", { exact: true }).first()).toBeVisible();
  await expect(frame.getByText("Sarah", { exact: true }).first()).toBeVisible();
  await expect(frame.getByText("Mira", { exact: true }).first()).toBeVisible();
});

test("dashboard ignores an old session poll after a new demo starts", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "How much is HIFU?" }).click();
  await expect(page.locator("#messages")).toContainText("RM 888");
  const oldSessionId = await page.evaluate(() => sessionStorage.getItem("clinicDemoSessionId"));
  expect(oldSessionId).toBeTruthy();

  const frame = await openDashboard(page);
  const liveInbox = frame.locator('aside[aria-label="Conversation inbox"]');
  await liveInbox.getByRole("button", { name: /Demo Patient/ }).click();
  const liveThread = frame.locator('section[aria-label="Conversation with Demo Patient"]');
  await expect(liveThread).toContainText("How much is HIFU?");

  let heldOldPoll = false;
  let releaseOldPoll = null;
  await page.route(new RegExp(`/api/demo/sessions/${oldSessionId}$`), async (route) => {
    if (route.request().method() === "GET" && !heldOldPoll) {
      heldOldPoll = true;
      await new Promise((resolve) => {
        releaseOldPoll = async () => {
          await route.continue();
          resolve();
        };
      });
      return;
    }
    await route.continue();
  });

  await expect.poll(() => heldOldPoll, { timeout: 5000 }).toBe(true);

  await page.getByRole("tab", { name: /Patient view/i }).click();
  await page.locator("#newDemoButton").click();
  await expect.poll(
    () => page.evaluate(() => sessionStorage.getItem("clinicDemoSessionId")),
    { timeout: 5000 }
  ).not.toBe(oldSessionId);

  await page.getByRole("tab", { name: /Clinic dashboard/i }).click();
  await expect(liveThread.getByText("No messages yet", { exact: true })).toBeVisible({ timeout: 5000 });

  const release = releaseOldPoll;
  expect(release).toBeTruthy();
  await release();
  await page.waitForTimeout(500);

  await expect(liveThread.getByText("No messages yet", { exact: true })).toBeVisible();
  await expect(liveThread.getByText("How much is HIFU?", { exact: true })).toHaveCount(0);
});
