const { test, expect } = require("@playwright/test");

function collectBrowserErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function openDashboard(page) {
  await page.getByRole("tab", { name: /Clinic dashboard/i }).click();
  const frame = page.frameLocator("#reactDashboardFrame");
  await expect(frame.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();
  return frame;
}

test("prospect completes the live journey through the React production-style portal", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.goto("/");

  await expect(page.getByText("Nova Demo Aesthetic Clinic").first()).toBeVisible();
  await expect(page.getByText(/please don’t enter real patient information/i)).toBeVisible();

  await page.getByRole("button", { name: "How much is HIFU?" }).click();
  await expect(page.locator("#messages")).toContainText("RM 888");
  await page.getByRole("button", { name: "Can I come Saturday?" }).click();
  await expect(page.locator("#messages")).toContainText(/Saturday|weekend/i);

  const frame = await openDashboard(page);

  // Actual channel SVG badge from the production ContactAvatar component.
  await expect(frame.locator('[aria-label="WhatsApp"] svg').first()).toBeVisible();

  // Inbox search + status/channel/owner filters are real React state, not demo toasts.
  const search = frame.getByPlaceholder("Search conversations");
  await search.fill("林美玲");
  await expect(frame.getByRole("button", { name: /林美玲 Mei Ling/ })).toBeVisible();
  await expect(frame.getByRole("button", { name: /Amanda Lee/ })).toHaveCount(0);
  await search.fill("");

  await frame.getByRole("button", { name: /Needs attention/ }).click();
  await expect(frame.getByRole("button", { name: /Daniel Wong/ })).toBeVisible();
  await frame.getByRole("button", { name: /^All / }).click();

  const inboxSelects = frame.locator('aside[aria-label="Conversation inbox"] select');
  await inboxSelects.nth(0).selectOption("instagram");
  await expect(frame.getByRole("button", { name: /Amanda Lee/ })).toBeVisible();
  await expect(frame.getByRole("button", { name: /Nur Aisyah/ })).toHaveCount(0);
  await inboxSelects.nth(0).selectOption("all");
  await inboxSelects.nth(1).selectOption("human");
  await expect(frame.getByRole("button", { name: /Daniel Wong/ })).toBeVisible();
  await inboxSelects.nth(1).selectOption("all");

  const inboxScroll = frame.locator('aside[aria-label="Conversation inbox"] > div').last();
  expect(await inboxScroll.evaluate((el) => el.scrollHeight > el.clientHeight)).toBeTruthy();

  // Pipeline uses the production Kanban/card geometry and every filter works.
  await frame.getByRole("link", { name: "Pipeline" }).click();
  await expect(frame.getByRole("heading", { name: "Lead Pipeline" })).toBeVisible();
  const checks = [
    ["Unassigned", "林美玲 Mei Ling"],
    ["No reply", "Amanda Lee"],
    ["Reschedule", "Farah Rahman"],
    ["Cancelled", "Sarah Lim"],
    ["Follow-up overdue", "Amanda Lee"],
    ["Needs attention", "Daniel Wong"],
  ];
  for (const [filter, lead] of checks) {
    await frame.getByRole("button", { name: new RegExp(`^${filter}`) }).click();
    await expect(frame.getByRole("button", { name: new RegExp(lead) })).toBeVisible();
  }
  await frame.getByRole("button", { name: /^All leads/ }).click();
  const desktopKanban = frame.locator("main.hidden.min-h-0.flex-1.overflow-x-auto");
  expect(await desktopKanban.evaluate((el) => el.scrollWidth > el.clientWidth)).toBeTruthy();

  await frame.getByRole("link", { name: "Analytics" }).click();
  await expect(frame.getByRole("heading", { name: "Analytics" })).toBeVisible();
  await expect(frame.getByText("126", { exact: true }).first()).toBeVisible();
  await expect(frame.getByText("Conversion Funnel")).toBeVisible();

  await frame.getByRole("link", { name: "Tools" }).click();
  await expect(frame.getByRole("heading", { name: "Reconnect with enquiries automatically" })).toBeVisible();
  await frame.getByRole("button", { name: /Automatic Lead Temperature/ }).first().click();
  await expect(frame.getByRole("heading", { name: "Prioritise the enquiries most likely to book" })).toBeVisible();

  // The React Inbox controls the same live browser session as Patient View.
  await frame.getByRole("link", { name: "Inbox" }).click();
  await frame.getByRole("button", { name: /Demo Patient/ }).click();
  await frame.getByRole("button", { name: /Take over/i }).click();
  await expect(frame.getByRole("button", { name: /Return to AI/i })).toBeVisible();
  const reply = frame.getByPlaceholder("Reply to patient…");
  await reply.fill("Hi, I’m from the clinic team. I can help you from here.");
  await reply.locator("xpath=..//button").click();
  await expect(frame.getByText("I can help you from here.")).toBeVisible();

  await page.getByRole("tab", { name: /Patient view/i }).click();
  await expect(page.locator("#messages")).toContainText("I can help you from here.");

  expect(browserErrors, `Browser errors: ${browserErrors.join("\n")}`).toEqual([]);
});

test("mobile React dashboard keeps production list-to-thread behavior", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const frame = await openDashboard(page);

  await expect(frame.locator('aside[aria-label="Conversation inbox"]')).toBeVisible();
  await frame.getByRole("button", { name: /Nur Aisyah/ }).click();
  await expect(frame.getByRole("heading", { name: "Nur Aisyah" })).toBeVisible();
  await frame.locator('section[aria-label="Conversation with Nur Aisyah"] button').first().click();
  await expect(frame.locator('aside[aria-label="Conversation inbox"]')).toBeVisible();

  await frame.getByRole("link", { name: "Pipeline" }).click();
  await expect(frame.getByRole("heading", { name: "Lead Pipeline" })).toBeVisible();
  await expect(frame.getByRole("button", { name: /New Enquiry/ })).toBeVisible();

  expect(browserErrors, `Browser errors: ${browserErrors.join("\n")}`).toEqual([]);
});
