const { test, expect } = require("@playwright/test");

function collectBrowserErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("prospect can complete the live AI to staff journey without CSP errors", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.goto("/");

  await expect(page.getByText("Nova Demo Aesthetic Clinic").first()).toBeVisible();
  await expect(page.getByText(/please don’t enter real patient information/i)).toBeVisible();
  await expect(page.getByText(/Channel preview only/i)).toBeVisible();

  await page.getByRole("button", { name: "How much is HIFU?" }).click();
  await expect(page.locator("#messages")).toContainText("RM 888");

  await page.getByRole("button", { name: "Can I come Saturday?" }).click();
  await expect(page.locator("#leadBooking")).toHaveText("Yes");
  await expect(page.locator("#leadTemperature")).toHaveText("Hot");

  await page.getByRole("tab", { name: /Clinic dashboard/i }).click();
  await expect(page.locator("#portalPageInbox")).toHaveClass(/active/);

  const chineseLead = page.locator(".sample-conversation-card").filter({ hasText: "林美玲 Mei Ling" });
  await expect(chineseLead).toBeVisible();
  await chineseLead.click();
  await expect(page.locator("#sampleConversationPane")).toContainText("HIFU");
  await expect(page.locator("#sampleLeadPanel")).toContainText("Early enquiry");

  await page.locator('[data-portal-page="pipeline"]').click();
  await expect(page.locator("#portalPagePipeline")).toHaveClass(/active/);
  await expect(page.locator("#pipelineActiveCount")).toHaveText("12");
  await expect(page.locator("#pipelineHotCount")).toHaveText("6");
  await expect(page.locator("#pipelineValue")).toContainText("19,988");

  await page.locator('[data-portal-page="analytics"]').click();
  await expect(page.locator("#portalPageAnalytics")).toHaveClass(/active/);
  await expect(page.locator("#portalPageAnalytics")).toContainText("126");
  await expect(page.locator("#analyticsFunnel .funnel-fill")).toHaveCount(4);

  await page.locator('[data-portal-page="tools"]').click();
  await expect(page.locator("#portalPageTools")).toHaveClass(/active/);
  await expect(page.getByText("Automated follow-up").first()).toBeVisible();
  await expect(page.getByText("Automatic Lead Temperature").first()).toBeVisible();

  await page.locator('[data-portal-page="inbox"]').click();
  await page.locator("#liveConversationCard").click();
  await page.locator("#takeoverButton").click();
  await expect(page.locator("#modePill")).toContainText("Human handling");
  await page.locator("#staffInput").fill("Hi, I’m from the clinic team. I can help you from here.");
  await page.locator("#staffForm").getByRole("button", { name: "Send" }).click();
  await expect(page.locator("#staffMessages")).toContainText("I can help you from here");

  await page.getByRole("tab", { name: /Patient view/i }).click();
  await expect(page.locator("#messages")).toContainText("I can help you from here");

  const cspErrors = browserErrors.filter((message) => /content security policy|refused to apply inline style|refused to execute inline/i.test(message));
  expect(cspErrors, `CSP/browser errors: ${cspErrors.join("\n")}`).toEqual([]);
});

test("mobile dashboard opens conversation threads and returns to the list", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("tab", { name: /Clinic dashboard/i }).click();

  const shell = page.locator(".portal-shell");
  await expect(shell).toBeVisible();
  const sample = page.locator(".sample-conversation-card").filter({ hasText: "Nur Aisyah" });
  await sample.click();
  await expect(shell).toHaveClass(/thread-open/);
  await expect(page.locator("#sampleConversationPane .portal-mobile-back")).toBeVisible();
  await page.locator("#sampleConversationPane .portal-mobile-back").click();
  await expect(shell).not.toHaveClass(/thread-open/);

  const cspErrors = browserErrors.filter((message) => /content security policy|refused to apply inline style|refused to execute inline/i.test(message));
  expect(cspErrors, `CSP/browser errors: ${cspErrors.join("\n")}`).toEqual([]);
});
