const { test, expect } = require("@playwright/test");

test("selected Meta ad source follows the live visitor into the clinic dashboard", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });

  const hifuAd = page.locator('[data-acquisition-key="hifu-facebook"]');
  await expect(hifuAd).toBeVisible();
  await hifuAd.click();

  await expect(page.locator('.channel-button[data-channel="facebook"]')).toHaveClass(/active/);
  const acquisition = await page.evaluate(() => JSON.parse(sessionStorage.getItem("clinicDemoAcquisition") || "null"));
  expect(acquisition).toMatchObject({
    key: "hifu-facebook",
    source: "Meta Ads",
    campaign: "HIFU Jawline Demo Campaign",
    treatment: "HIFU Skin Lifting",
    channel: "facebook",
  });

  await page.getByRole("tab", { name: /Clinic dashboard/i }).click();
  const frame = page.frameLocator("#reactDashboardFrame");
  await expect(frame.getByText("Live visitor", { exact: true })).toBeVisible();
  await expect(frame.getByText("Meta Ads", { exact: true })).toBeVisible();
  await expect(frame.getByText("HIFU Jawline Demo Campaign", { exact: true })).toBeVisible();
  await expect(frame.getByText("HIFU Skin Lifting", { exact: true }).first()).toBeVisible();
});

test("acquisition source cannot be changed after the patient conversation has started", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });

  await page.locator('[data-acquisition-key="organic-whatsapp"]').click();
  await page.getByRole("button", { name: "How much is HIFU?" }).click();
  await expect(page.locator("#messages")).toContainText("RM 888");

  await page.locator('[data-acquisition-key="pico-instagram"]').click();
  const acquisition = await page.evaluate(() => JSON.parse(sessionStorage.getItem("clinicDemoAcquisition") || "null"));
  expect(acquisition.key).toBe("organic-whatsapp");
});
