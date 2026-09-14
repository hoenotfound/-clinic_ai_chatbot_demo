const { test, expect } = require("@playwright/test");

test.use({ storageState: { cookies: [], origins: [] } });

test("TCM is a first-class public demo profile with its own dashboard", async ({ page }) => {
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await page.goto("/");
  const picker = page.locator("[data-industry-picker]");
  await expect(picker).toBeVisible();
  await expect(picker.locator('[data-industry="tcm"]')).toContainText("Traditional Chinese Medicine");

  await picker.locator('[data-industry="tcm"]').click();
  await expect(page).toHaveURL(/industry=tcm/);
  await expect(page.getByRole("button", { name: "Switch demo industry" })).toContainText("Traditional Chinese Medicine");
  await expect(page.locator(".experience-status strong")).toHaveText("Harmony Demo TCM Centre");
  await expect(page.locator("#patientTab strong")).toHaveText("Patient View");
  await expect(page.locator("#dashboardTab strong")).toHaveText("TCM Dashboard");
  await expect(page.locator(".prompt-panel")).toContainText("针灸多少钱");

  await expect(page.locator("#reactDashboardFrame")).toHaveAttribute("src", /industry=tcm/);
  const frame = page.frameLocator("#reactDashboardFrame");
  await expect(frame.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();
  await expect(frame.locator("body")).toContainText("Harmony Demo TCM Centre");
  await expect(frame.locator("body")).toContainText("Acupuncture");

  const config = await page.evaluate(async () => {
    const response = await fetch("/api/demo/config?industry=tcm");
    return response.json();
  });
  expect(config.industryKey).toBe("tcm");
  expect(config.businessName).toMatch(/Harmony Demo TCM Centre/i);
  expect(config.services.some((service) => service.name === "Acupuncture")).toBe(true);
  expect(config.services.some((service) => /HIFU|Pico/i.test(service.name))).toBe(false);
  expect(config.availableIndustries.map((item) => item.key)).toEqual(["clinic", "tcm", "renovation"]);

  expect(browserErrors).toEqual([]);
});

test("TCM has a separate session from the aesthetic clinic demo", async ({ page }) => {
  await page.goto("/?industry=tcm");
  await expect(page.locator(".experience-status strong")).toHaveText("Harmony Demo TCM Centre");
  await expect.poll(async () => page.evaluate(() => sessionStorage.getItem("demoSessionId:tcm"))).not.toBeNull();
  const tcmSession = await page.evaluate(() => sessionStorage.getItem("demoSessionId:tcm"));

  await page.getByRole("button", { name: "Switch demo industry" }).click();
  await page.locator('[data-industry="clinic"]').click();
  await expect(page).toHaveURL(/industry=clinic/);
  await expect.poll(async () => page.evaluate(() => sessionStorage.getItem("demoSessionId:clinic"))).not.toBeNull();
  const clinicSession = await page.evaluate(() => sessionStorage.getItem("demoSessionId:clinic"));

  expect(tcmSession).toBeTruthy();
  expect(clinicSession).toBeTruthy();
  expect(clinicSession).not.toBe(tcmSession);
});
