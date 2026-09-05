const { test, expect } = require("@playwright/test");

function collectBrowserErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function sendCustomerMessage(page, message) {
  const input = page.locator("#customerInput");
  await expect(input).toBeEnabled();
  await input.fill(message);
  await page.locator("#customerSendButton").click();
  await expect(page.locator("#messages")).toContainText(message);
  await expect(input).toBeEnabled();
}

test("renovation profile stays industry-specific across customer view and dashboard", async ({ page }) => {
  test.skip(process.env.DEMO_INDUSTRY !== "renovation", "Renovation profile only");
  const browserErrors = collectBrowserErrors(page);
  await page.goto("/");

  await expect(page.getByText("Oakline Demo Renovation & Carpentry").first()).toBeVisible();

  const facebookAcquisition = page.locator('[data-acquisition-key="hifu-facebook"]');
  await expect(facebookAcquisition).toContainText("Kitchen Cabinets Facebook Ad");
  await facebookAcquisition.click();
  await expect.poll(async () => page.evaluate(() => JSON.parse(sessionStorage.getItem("clinicDemoAcquisition") || "null"))).toMatchObject({
    key: "hifu-facebook",
    campaign: "Kitchen Cabinets Demo Campaign",
    treatment: "Kitchen Cabinets",
    channel: "facebook",
  });

  const priceChip = page.locator(".prompt-panel .suggestion-chip").filter({ hasText: "Kitchen cabinet price?" });
  await expect(priceChip).toHaveCount(1);
  await expect(priceChip).toHaveAttribute("data-message", "Hi, kitchen cabinet how much?");
  await priceChip.click();
  await expect(page.locator("#messages")).toContainText("RM 6,800");

  await sendCustomerMessage(page, "New condo in Puchong, kitchen around 12ft. Budget RM10k.");
  const literalCustomerMessage = "Do you also build reception cabinets for a clinic?";
  await sendCustomerMessage(page, literalCustomerMessage);

  await page.getByRole("tab", { name: /Sales dashboard/i }).click();
  const frame = page.frameLocator("#reactDashboardFrame");
  await expect(frame.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();

  // Industry presentation copy must never rewrite customer-authored text.
  await expect(frame.getByText(literalCustomerMessage, { exact: true }).first()).toBeVisible();
  await expect(frame.getByText("Kitchen Cabinets Demo Campaign", { exact: true }).first()).toBeVisible();

  await frame.getByRole("link", { name: "Pipeline" }).click();
  await expect(frame.getByRole("heading", { name: "Lead Pipeline" })).toBeVisible();
  await expect(frame.getByText("Cheras / Kajang / Puchong", { exact: true }).first()).toBeVisible();

  const liveLead = frame.getByRole("button", { name: /Demo Customer/ }).first();
  await expect(liveLead).toBeVisible();
  await liveLead.click();
  await expect(frame.getByText("RM 10,000", { exact: true }).first()).toBeVisible();
  const closeDrawer = frame.getByRole("button", { name: "Close lead drawer" });
  await closeDrawer.click({ force: true });
  await expect(closeDrawer).toHaveCount(0);

  await frame.getByRole("link", { name: "Analytics" }).click();
  await expect(frame.getByRole("heading", { name: "Analytics" })).toBeVisible();
  await frame.getByRole("button", { name: "Filters" }).click();

  const projectSelect = frame.locator("label").filter({ hasText: /^Project/ }).locator("select");
  await expect(projectSelect.locator('option[value="Shoe Cabinet & Entrance Storage"]')).toHaveText("Shoe / Entrance Storage");
  await expect(projectSelect.locator('option[value="Study, Display & Storage Cabinets"]')).toHaveText("Study / Display / Storage");
  await projectSelect.selectOption("Shoe Cabinet & Entrance Storage");
  await expect(projectSelect).toHaveValue("Shoe Cabinet & Entrance Storage");

  const ownerSelect = frame.locator("label").filter({ hasText: /^Owner/ }).locator("select");
  await expect(ownerSelect.locator('option[value="Aina"]')).toHaveText("Aina");

  const areaSelect = frame.locator("label").filter({ hasText: /^Area/ }).locator("select");
  await expect(areaSelect.locator('option[value="Kuala Lumpur"]')).toHaveText("KL / Cheras / Kajang");
  await expect(areaSelect.locator('option[value="Petaling Jaya"]')).toHaveText("PJ / Subang / Puchong / Shah Alam");

  expect(browserErrors, `Browser errors: ${browserErrors.join("\n")}`).toEqual([]);
});
