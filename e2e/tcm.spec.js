const { test, expect } = require("@playwright/test");

test.use({
  storageState: { cookies: [], origins: [] },
  extraHTTPHeaders: { "x-forwarded-for": "203.0.113.57" },
});

function collectBrowserErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

test("TCM is a first-class public demo profile with its own dashboard", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);

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
  await expect(frame.locator("body")).toContainText("Harmony Demo TCM");
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

test("TCM live journey accepts the exact public-tour branch and timing phrase", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.goto("/?industry=tcm");
  await expect(page.locator(".experience-status strong")).toHaveText("Harmony Demo TCM Centre");

  const input = page.locator("#customerInput");
  const send = page.getByRole("button", { name: "Send message" });

  await input.fill("请问针灸一次多少钱？");
  await send.click();
  await expect(page.locator("#messages")).toContainText("RM 80");
  await expect(page.locator("#messages")).toContainText(/branch|日期|时段/i);

  await page.waitForTimeout(1000);
  await input.fill("Saturday afternoon in KL?");
  await send.click();
  await expect(page.locator("#messages")).toContainText(/TCM team|confirm the actual|available time/i);

  const live = await page.evaluate(async () => {
    const id = sessionStorage.getItem("demoSessionId:tcm");
    const response = await fetch(`/api/demo/sessions/${encodeURIComponent(id)}`);
    return (await response.json()).session;
  });
  expect(live.lead.bookingIntent).toBe(true);
  expect(live.lead.temperature).toBe("hot");
  expect(live.lead.interests).toContain("Acupuncture");
  expect(live.lead.preferredBranch).toBe("Kuala Lumpur");
  expect(live.lead.preferredTiming).toBe("Saturday afternoon");
  expect(live.lead.estimatedValue).toBe(80);
  expect(live.lead.summary).toMatch(/Appointment intent detected/i);
  expect(live.lead.summary).not.toMatch(/clinic visit|specific treatment/i);

  await page.getByRole("tab", { name: /TCM dashboard/i }).click();
  const frame = page.frameLocator("#reactDashboardFrame");
  await expect(frame.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();
  await frame.getByRole("link", { name: "Pipeline" }).click();
  await expect(frame.getByRole("heading", { name: "Lead Pipeline" })).toBeVisible();
  const liveCard = frame.getByRole("button", { name: /Demo Patient/ }).first();
  await expect(liveCard).toContainText("Hot");
  await expect(liveCard).toContainText("Appointment Requested");
  await expect(liveCard).toContainText("Acupuncture");
  await expect(liveCard).toContainText("Kuala Lumpur");
  await expect(liveCard).toContainText("RM 80");

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
