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

async function openDashboardPage(frame, name, heading = name) {
  await frame.getByRole("link", { name, exact: true }).click();
  await expect(frame.getByRole("heading", { name: heading, exact: true }).first()).toBeVisible();
}

test("renovation profile stays industry-specific across customer view and the complete dashboard", async ({ page }) => {
  test.skip(process.env.DEMO_INDUSTRY !== "renovation", "Renovation profile only");
  const browserErrors = collectBrowserErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");

  await expect(page.getByText("Oakline Demo Renovation & Carpentry").first()).toBeVisible();

  const leadCard = page.locator(".hero-lead-card");
  const journeyCaption = page.locator(".hero-product-caption");
  await expect(leadCard).toContainText("SITE MEASUREMENT INTENT");
  await expect(leadCard).toContainText("Hot lead · Kitchen Cabinets · Puchong · Saturday");
  await expect(journeyCaption).toContainText("AI-POWERED CUSTOMER JOURNEY");
  await expect(journeyCaption).toContainText("Reply. Qualify. Hand off.");
  await expect(page.locator('link[data-hero-showcase-layout="true"]')).toHaveCount(1);
  await expect(journeyCaption).toHaveCSS("position", "relative");

  const heroLayout = await page.locator(".hero-product-card").evaluate((card) => {
    const lead = card.querySelector(".hero-lead-card").getBoundingClientRect();
    const captionLabel = card.querySelector(".hero-product-caption span").getBoundingClientRect();
    const captionHeading = card.querySelector(".hero-product-caption strong").getBoundingClientRect();
    const product = card.getBoundingClientRect();
    return {
      leadBottom: lead.bottom,
      captionLabelTop: captionLabel.top,
      captionLabelBottom: captionLabel.bottom,
      captionHeadingTop: captionHeading.top,
      captionHeadingBottom: captionHeading.bottom,
      productBottom: product.bottom,
    };
  });
  expect(heroLayout.captionLabelTop - heroLayout.leadBottom).toBeGreaterThanOrEqual(20);
  expect(heroLayout.captionHeadingTop - heroLayout.captionLabelBottom).toBeGreaterThanOrEqual(5);
  expect(heroLayout.productBottom - heroLayout.captionHeadingBottom).toBeGreaterThanOrEqual(20);

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

  // Customer-authored text must stay literal even when it contains a clinic word.
  await expect(frame.getByText(literalCustomerMessage, { exact: true }).first()).toBeVisible();
  await expect(frame.getByText("Kitchen Cabinets Demo Campaign", { exact: true }).first()).toBeVisible();

  await openDashboardPage(frame, "Pipeline", "Lead Pipeline");
  await expect(frame.getByText("Cheras / Kajang / Puchong", { exact: true }).first()).toBeVisible();

  const liveLead = frame.getByRole("button", { name: /Demo Customer/ }).first();
  await expect(liveLead).toBeVisible();
  await liveLead.click();
  await expect(frame.getByText("RM 10,000", { exact: true }).first()).toBeVisible();
  await expect(frame.getByText("Project", { exact: true }).first()).toBeVisible();
  await expect(frame.getByText("Area", { exact: true }).first()).toBeVisible();
  const closeDrawer = frame.getByRole("button", { name: "Close lead drawer" });
  await closeDrawer.evaluate((button) => button.click());
  await expect(closeDrawer).toHaveCount(0);

  await openDashboardPage(frame, "Analytics");
  await frame.getByRole("button", { name: "Filters", exact: true }).click();

  const projectSelect = frame.locator("label").filter({ hasText: /^Project/ }).locator("select");
  await expect(projectSelect.locator('option[value="Shoe Cabinet & Entrance Storage"]')).toHaveText("Shoe / Entrance Storage");
  await expect(projectSelect.locator('option[value="Study, Display & Storage Cabinets"]')).toHaveText("Study / Display / Storage");
  await projectSelect.selectOption("Shoe Cabinet & Entrance Storage");
  await expect(projectSelect).toHaveValue("Shoe Cabinet & Entrance Storage");

  const ownerSelect = frame.locator("label").filter({ hasText: /^Owner/ }).locator("select");
  await expect(ownerSelect.locator('option[value="Aina"]')).toHaveText("Aina");

  const areaSelect = frame.locator("label").filter({ hasText: /^Area/ }).locator("select");
  await expect(areaSelect.locator('option[value="Kuala Lumpur"]')).toHaveText("Kuala Lumpur");
  await expect(areaSelect.locator('option[value="Petaling Jaya / Subang / Shah Alam"]')).toHaveText("PJ / Subang / Shah Alam");
  await expect(areaSelect.locator('option[value="Cheras / Kajang / Puchong"]')).toHaveText("Cheras / Kajang / Puchong");
  await expect(frame.getByText("Site Measurements", { exact: true }).first()).toBeVisible();
  await expect(frame.getByText("Quotations / Design", { exact: true }).first()).toBeVisible();

  await openDashboardPage(frame, "Tools");
  await expect(frame.getByText("Nur Izzati · Built-in Wardrobes", { exact: true })).toBeVisible();
  await expect(frame.getByText("Customer chat preview", { exact: true })).toBeVisible();
  await expect(frame.getByText("Site-measurement reminders", { exact: true })).toBeVisible();
  await expect(frame.locator("body")).not.toContainText("Pico Laser");
  await expect(frame.locator("body")).not.toContainText("Patient chat preview");

  await openDashboardPage(frame, "Settings");
  await expect(frame.getByText("Renovation business profile", { exact: true })).toBeVisible();
  await expect(frame.getByRole("textbox", { name: "Business name" })).toHaveValue("Oakline Demo Renovation & Carpentry");
  await expect(frame.getByRole("textbox", { name: "AI assistant name" })).toHaveValue("Aiden");
  await frame.getByRole("button", { name: "AI sales assistant", exact: true }).click();
  await expect(frame.getByText("Quotation & measurement intent", { exact: true })).toBeVisible();
  await frame.getByRole("button", { name: "Promotions", exact: true }).click();
  await expect(frame.getByText("No active demo promotion", { exact: true })).toBeVisible();
  await expect(frame.locator("body")).not.toContainText("HIFU Demo Special");

  await openDashboardPage(frame, "Team & Access");
  const memberTable = frame.locator("table");
  await expect(memberTable.getByText("Amir", { exact: true })).toBeVisible();
  await expect(memberTable.getByText("Mei", { exact: true })).toBeVisible();
  await expect(memberTable.getByText("Aina", { exact: true })).toBeVisible();
  await expect(memberTable).not.toContainText("Sarah");
  await expect(memberTable).not.toContainText("Mira");

  expect(browserErrors, `Browser errors: ${browserErrors.join("\n")}`).toEqual([]);
});
