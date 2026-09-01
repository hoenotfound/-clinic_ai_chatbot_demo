const { test } = require("@playwright/test");
const fs = require("node:fs");

function ensureDir() {
  fs.mkdirSync("visual-artifacts", { recursive: true });
}

test("capture redesigned public demo desktop", async ({ page }) => {
  ensureDir();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.screenshot({ path: "visual-artifacts/public-demo-desktop.png", fullPage: true });
});

test("capture redesigned public demo mobile", async ({ page }) => {
  ensureDir();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.screenshot({ path: "visual-artifacts/public-demo-mobile.png", fullPage: true });
});