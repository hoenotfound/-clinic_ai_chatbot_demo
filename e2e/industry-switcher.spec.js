const { test, expect } = require("@playwright/test");

test.use({ storageState: { cookies: [], origins: [] } });

test("first-time industry chooser switches between isolated renovation and clinic demos", async ({ page }) => {
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await page.goto("/");

  const picker = page.locator("[data-industry-picker]");
  await expect(picker).toBeVisible();
  await expect(picker.getByRole("heading", { name: "Choose an industry to explore" })).toBeVisible();
  await expect(picker.locator('[data-industry="clinic"]')).toContainText("Aesthetic Clinic");
  await expect(picker.locator('[data-industry="renovation"]')).toContainText("Home Renovation & Carpentry");

  await picker.locator('[data-industry="renovation"]').click();
  await expect(page).toHaveURL(/industry=renovation/);
  await expect(page.getByRole("button", { name: "Switch demo industry" })).toContainText("Home Renovation & Carpentry");
  await expect(page.locator(".experience-status strong")).toHaveText("Oakline Demo Renovation & Carpentry");
  await expect(page.locator("#patientTab strong")).toHaveText("Customer View");
  await expect(page.locator("#dashboardTab strong")).toHaveText("Sales Dashboard");

  const renovationSessionId = await expect.poll(async () => page.evaluate(() => sessionStorage.getItem("clinicDemoSessionId"))).not.toBeNull();
  const renovationId = await page.evaluate(() => sessionStorage.getItem("clinicDemoSessionId"));
  expect(renovationId).toBeTruthy();
  await expect(page.locator("#reactDashboardFrame")).toHaveAttribute("src", /industry=renovation/);
  await expect(page.frameLocator("#reactDashboardFrame").getByText("Oakline Demo Renovation", { exact: false }).first()).toBeVisible();

  await page.getByRole("button", { name: "Switch demo industry" }).click();
  await expect(page.locator("[data-industry-picker]")).toBeVisible();
  await expect(page.locator('[data-industry="renovation"] .industry-picker-current')).toHaveText("Current");
  await page.locator('[data-industry="clinic"]').click();

  await expect(page).toHaveURL(/industry=clinic/);
  await expect(page.getByRole("button", { name: "Switch demo industry" })).toContainText("Aesthetic Clinic");
  await expect(page.locator(".experience-status strong")).toHaveText("Nova Demo Aesthetic Clinic");
  await expect(page.locator("#patientTab strong")).toHaveText("Patient View");
  await expect(page.locator("#dashboardTab strong")).toHaveText("Clinic Dashboard");
  await expect(page.locator("#reactDashboardFrame")).toHaveAttribute("src", /industry=clinic/);

  const clinicId = await expect.poll(async () => page.evaluate(() => sessionStorage.getItem("clinicDemoSessionId"))).not.toBeNull();
  const clinicSessionId = await page.evaluate(() => sessionStorage.getItem("clinicDemoSessionId"));
  expect(clinicSessionId).toBeTruthy();
  expect(clinicSessionId).not.toBe(renovationId);

  const configs = await page.evaluate(async () => {
    const [clinicResponse, renovationResponse] = await Promise.all([
      fetch("/api/demo/config?industry=clinic"),
      fetch("/api/demo/config?industry=renovation"),
    ]);
    return [await clinicResponse.json(), await renovationResponse.json()];
  });
  expect(configs[0].industryKey).toBe("clinic");
  expect(configs[0].businessName).toMatch(/Nova Demo Aesthetic Clinic/i);
  expect(configs[1].industryKey).toBe("renovation");
  expect(configs[1].businessName).toMatch(/Oakline Demo Renovation/i);

  expect(browserErrors).toEqual([]);
});
