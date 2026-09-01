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

function pipelineFilter(frame, label) {
  return frame.getByRole("button", { name: new RegExp(`^${label} \\d+$`) });
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

  await expect(frame.locator('[aria-label="WhatsApp"] svg').first()).toBeVisible();

  const search = frame.getByPlaceholder("Search conversations");
  await search.fill("林美玲");
  await expect(frame.getByRole("button", { name: /林美玲 Mei Ling/ })).toBeVisible();
  await expect(frame.getByRole("button", { name: /Amanda Lee/ })).toHaveCount(0);
  await search.fill("");

  const inbox = frame.locator('aside[aria-label="Conversation inbox"]');
  await inbox.getByRole("button", { name: /Needs attention/ }).click();
  await expect(inbox.getByRole("button", { name: /Daniel Wong/ })).toBeVisible();
  await inbox.getByRole("button", { name: /^All / }).click();

  const inboxSelects = inbox.locator("select");
  await inboxSelects.nth(0).selectOption("instagram");
  await expect(inbox.getByRole("button", { name: /Amanda Lee/ })).toBeVisible();
  await expect(inbox.getByRole("button", { name: /Nur Aisyah/ })).toHaveCount(0);
  await inboxSelects.nth(0).selectOption("all");
  await inboxSelects.nth(1).selectOption("human");
  await expect(inbox.getByRole("button", { name: /Daniel Wong/ })).toBeVisible();
  await inboxSelects.nth(1).selectOption("all");

  const inboxScroll = inbox.locator(':scope > div').last();
  expect(await inboxScroll.evaluate((el) => el.scrollHeight > el.clientHeight)).toBeTruthy();

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
    await pipelineFilter(frame, filter).click();
    await expect(frame.getByRole("button", { name: new RegExp(lead) }).first()).toBeVisible();
  }
  await pipelineFilter(frame, "All leads").click();
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

  await frame.getByRole("link", { name: "Inbox" }).click();
  const liveInbox = frame.locator('aside[aria-label="Conversation inbox"]');
  await liveInbox.getByRole("button", { name: /Demo Patient/ }).click();
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

  const inbox = frame.locator('aside[aria-label="Conversation inbox"]');
  await expect(inbox).toBeVisible();
  await inbox.getByRole("button", { name: /Nur Aisyah/ }).click();

  const thread = frame.locator('section[aria-label="Conversation with Nur Aisyah"]');
  await expect(thread).toBeVisible();
  await expect(thread.getByRole("heading", { name: "Nur Aisyah" })).toBeVisible();
  await thread.getByRole("button").first().click();
  await expect(inbox).toBeVisible();

  await frame.getByRole("link", { name: "Pipeline" }).click();
  await expect(frame.getByRole("heading", { name: "Lead Pipeline" })).toBeVisible();
  await expect(frame.getByRole("button", { name: /New Enquiry/ }).first()).toBeVisible();

  expect(browserErrors, `Browser errors: ${browserErrors.join("\n")}`).toEqual([]);
});
