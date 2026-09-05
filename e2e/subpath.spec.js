const { test, expect } = require("@playwright/test");

test("demo and React dashboard work under the /ai-chatbot mount path", async ({ page }) => {
  const browserErrors = [];
  const failedLocalResponses = [];

  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === "http://127.0.0.1:3100" && response.status() >= 400) {
      failedLocalResponses.push(`${response.status()} ${url.pathname}`);
    }
  });

  await page.goto("/ai-chatbot");
  await expect(page).toHaveURL(/\/ai-chatbot\/\?industry=clinic$/);
  await expect(page.getByRole("heading", { name: /Turn every clinic enquiry/i })).toBeVisible();

  const configResponse = await page.request.get("/ai-chatbot/api/demo/config");
  expect(configResponse.status()).toBe(200);

  await page.getByRole("button", { name: "How much is HIFU?" }).click();
  await expect(page.locator("#messages")).toContainText("RM 888");

  await page.getByRole("tab", { name: /Clinic dashboard/i }).click();
  const dashboardFrame = page.frameLocator("#reactDashboardFrame");
  await expect(dashboardFrame.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();

  const iframe = page.locator("#reactDashboardFrame");
  const iframeHandle = await iframe.elementHandle();
  const frame = await iframeHandle.contentFrame();
  expect(new URL(frame.url()).pathname).toBe("/ai-chatbot/dashboard/inbox");
  expect(new URL(frame.url()).searchParams.get("industry")).toBe("clinic");

  const inbox = dashboardFrame.locator('aside[aria-label="Conversation inbox"]');
  const liveConversation = inbox.getByRole("button", { name: /Demo Patient/ });
  await expect(liveConversation).toBeVisible();
  await liveConversation.click();
  const liveThread = dashboardFrame.locator('section[aria-label="Conversation with Demo Patient"]');
  await expect(liveThread.getByText("Hi, how much is HIFU?", { exact: true })).toBeVisible();
  await expect(liveThread).toContainText("RM 888");

  await dashboardFrame.getByRole("link", { name: "Pipeline" }).click();
  await expect(dashboardFrame.getByRole("heading", { name: "Lead Pipeline" })).toBeVisible();
  expect(new URL(frame.url()).pathname).toBe("/ai-chatbot/dashboard/pipeline");

  await frame.goto("http://127.0.0.1:3100/ai-chatbot/dashboard/settings/team?industry=clinic");
  await expect(dashboardFrame.getByRole("heading", { name: "Team & Access" })).toBeVisible();
  expect(new URL(frame.url()).pathname).toBe("/ai-chatbot/dashboard/settings/team");
  expect(new URL(frame.url()).searchParams.get("industry")).toBe("clinic");

  expect(failedLocalResponses, `Failed local responses: ${failedLocalResponses.join("\n")}`).toEqual([]);
  expect(browserErrors, `Browser errors: ${browserErrors.join("\n")}`).toEqual([]);
});
