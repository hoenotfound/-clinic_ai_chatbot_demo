const { test, expect } = require("@playwright/test");
const fs = require("node:fs");

function ensureDir() {
  fs.mkdirSync("visual-artifacts", { recursive: true });
}

test("capture and verify demo-first desktop layout", async ({ page }) => {
  ensureDir();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/", { waitUntil: "networkidle" });

  const demo = await page.locator("#live-demo").boundingBox();
  const journey = await page.locator("#how-it-works").boundingBox();
  expect(demo).not.toBeNull();
  expect(journey).not.toBeNull();
  expect(demo.y).toBeLessThan(journey.y);
  await expect(page.locator(".hero-metric-card")).toHaveCount(0);
  await expect(page.locator(".hero-context-card")).toHaveCount(0);

  const heroShowcase = page.locator(".hero-showcase");
  await expect(heroShowcase).toHaveCSS("opacity", "1");
  await expect(heroShowcase).toBeVisible();
  const heroShowcaseBox = await heroShowcase.boundingBox();
  expect(heroShowcaseBox).not.toBeNull();
  expect(heroShowcaseBox.width).toBeGreaterThan(300);
  expect(heroShowcaseBox.height).toBeGreaterThan(400);

  const heroProduct = page.locator(".hero-product-card");
  await expect(heroProduct).toBeVisible();
  const heroProductState = await heroProduct.evaluate((el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const stack = document.elementsFromPoint(cx, cy).slice(0, 8).map((node) => ({
      tag: node.tagName,
      id: node.id,
      className: typeof node.className === "string" ? node.className : "",
      position: getComputedStyle(node).position,
      zIndex: getComputedStyle(node).zIndex,
      background: getComputedStyle(node).backgroundColor,
      opacity: getComputedStyle(node).opacity,
    }));
    return {
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      width: rect.width,
      height: rect.height,
      x: rect.x,
      y: rect.y,
      stack,
    };
  });
  console.log("PUBLIC_DEMO_HERO_PRODUCT", JSON.stringify(heroProductState));
  expect(heroProductState.width).toBeGreaterThan(300);
  expect(heroProductState.height).toBeGreaterThan(400);
  expect(heroProductState.backgroundImage).not.toBe("none");
  expect(heroProductState.stack.some((item) => item.className.includes("hero-product-card"))).toBeTruthy();

  await expect(page.getByRole("link", { name: "Specialties" })).toHaveAttribute("href", "https://dasmarketingsolution.com/#specialties");
  await expect(page.getByRole("link", { name: "Clients" })).toHaveAttribute("href", "https://dasmarketingsolution.com/#portfolio");
  await expect(page.getByRole("link", { name: "Results" })).toHaveAttribute("href", "https://dasmarketingsolution.com/#results");
  await expect(page.locator('.site-nav a[aria-current="page"]')).toHaveText("AI Chatbot Demo");
  await expect(page.locator(".subpage-footer")).toBeVisible();

  await page.screenshot({ path: "visual-artifacts/public-demo-desktop.png", fullPage: true });
});

test("capture and verify streamlined mobile demo order", async ({ page }) => {
  ensureDir();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle" });

  const channels = await page.locator(".channel-panel").boundingBox();
  const prompts = await page.locator(".prompt-panel").boundingBox();
  const phone = await page.locator("#phone").boundingBox();
  expect(channels).not.toBeNull();
  expect(prompts).not.toBeNull();
  expect(phone).not.toBeNull();
  expect(channels.y).toBeLessThan(prompts.y);
  expect(prompts.y).toBeLessThan(phone.y);
  await expect(page.locator(".floating-enquiry")).toBeHidden();

  await page.screenshot({ path: "visual-artifacts/public-demo-mobile.png", fullPage: true });
});
