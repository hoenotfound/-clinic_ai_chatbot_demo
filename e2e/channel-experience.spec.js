const { test, expect } = require("@playwright/test");
const fs = require("node:fs");

function ensureDir() {
  fs.mkdirSync("visual-artifacts", { recursive: true });
}

async function selectChannel(page, channel, experience) {
  const button = page.locator(`.channel-button[data-channel="${channel}"]`);
  await button.click();
  await expect(button).toHaveClass(/active/);
  await expect(page.locator("#phone")).toHaveAttribute("data-channel-experience", experience);
}

test("Patient View renders recognisable channel-specific messaging chrome", async ({ page }) => {
  ensureDir();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/", { waitUntil: "networkidle" });

  const phone = page.locator("#phone");
  await expect(phone).toHaveClass(/native-channel-ui/);
  await expect(phone).toHaveAttribute("data-channel-experience", "whatsapp");
  await expect(page.locator('link[data-channel-experience="styles"]')).toHaveCount(1);
  await expect(phone.locator(".channel-header-actions .channel-header-action")).toHaveCount(3);
  await expect(phone.locator(".composer-input-shell")).toBeVisible();
  await expect(phone.locator(".composer-inline-action")).toHaveCount(2);
  await expect(page.locator("#customerInput")).toHaveAttribute("placeholder", "Message");

  const whatsappStyles = await phone.evaluate((element) => {
    const style = getComputedStyle(element);
    const header = getComputedStyle(element.querySelector(".chat-header"));
    return {
      accent: style.getPropertyValue("--channel-accent").trim(),
      headerBackground: header.backgroundColor,
      radius: style.borderRadius,
    };
  });
  expect(whatsappStyles.accent).toBe("#008069");
  expect(whatsappStyles.headerBackground).toBe("rgb(247, 248, 250)");

  await page.screenshot({ path: "visual-artifacts/channel-whatsapp-desktop.png", fullPage: false });

  await selectChannel(page, "instagram", "instagram");
  await expect(page.locator("#customerInput")).toHaveAttribute("placeholder", "Message...");
  await expect(phone.locator(".composer-inline-action")).toHaveCount(3);
  const instagramAccent = await phone.evaluate((element) => getComputedStyle(element).getPropertyValue("--channel-accent").trim());
  expect(instagramAccent).toBe("#262626");

  await page.screenshot({ path: "visual-artifacts/channel-instagram-desktop.png", fullPage: false });

  await selectChannel(page, "facebook", "facebook");
  await expect(page.locator("#customerInput")).toHaveAttribute("placeholder", "Aa");
  await expect(phone.locator(".composer-inline-action")).toHaveCount(2);
  const messengerAccent = await phone.evaluate((element) => getComputedStyle(element).getPropertyValue("--channel-accent").trim());
  expect(messengerAccent).toBe("#0a7cff");

  await page.screenshot({ path: "visual-artifacts/channel-messenger-desktop.png", fullPage: false });
});

test("channel experience stays inside a narrow mobile viewport", async ({ page }) => {
  ensureDir();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/", { waitUntil: "networkidle" });

  const phone = page.locator("#phone");
  await expect(phone).toHaveClass(/native-channel-ui/);

  const layout = await page.evaluate(() => {
    const phoneRect = document.getElementById("phone").getBoundingClientRect();
    const channelButtons = Array.from(document.querySelectorAll(".channel-button")).map((button) => button.getBoundingClientRect());
    return {
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      phoneLeft: phoneRect.left,
      phoneRight: phoneRect.right,
      phoneWidth: phoneRect.width,
      channelButtonsFit: channelButtons.every((rect) => rect.left >= 0 && rect.right <= window.innerWidth),
    };
  });

  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewport);
  expect(layout.phoneLeft).toBeGreaterThanOrEqual(0);
  expect(layout.phoneRight).toBeLessThanOrEqual(layout.viewport);
  expect(layout.phoneWidth).toBeLessThanOrEqual(layout.viewport);
  expect(layout.channelButtonsFit).toBeTruthy();

  await selectChannel(page, "instagram", "instagram");
  await expect(phone.locator(".channel-header-actions")).toBeVisible();

  await selectChannel(page, "facebook", "facebook");
  await expect(phone.locator(".composer-input-shell")).toBeVisible();

  await page.screenshot({ path: "visual-artifacts/channel-messenger-mobile.png", fullPage: true });
});

test("Instagram and Messenger keep the outgoing bubble right-aligned while waiting for the AI reply", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route(/\/api\/demo\/sessions\/[^/]+\/message$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  await page.goto("/", { waitUntil: "networkidle" });

  for (const [channel, experience] of [["instagram", "instagram"], ["facebook", "facebook"]]) {
    await selectChannel(page, channel, experience);
    const input = page.locator("#customerInput");
    await input.fill("How much is HIFU?");
    await page.getByRole("button", { name: "Send message" }).click();

    const outgoing = page.locator("#messages .message-row.user:not(.channel-seen-row)").last();
    await expect(outgoing).toContainText("How much is HIFU?");
    await expect(page.locator("#typingIndicator")).not.toHaveClass(/hidden/);
    await expect(page.locator("#messages .channel-seen-row")).toBeVisible();
    await expect(outgoing.locator(".channel-seen, .channel-seen-avatar")).toHaveCount(0);

    const alignment = await outgoing.evaluate((row) => {
      const bubble = row.querySelector(".message-bubble");
      const rowRect = row.getBoundingClientRect();
      const bubbleRect = bubble.getBoundingClientRect();
      return {
        gapFromRight: Math.abs(rowRect.right - bubbleRect.right),
        bubbleLeft: bubbleRect.left,
        rowCenter: rowRect.left + rowRect.width / 2,
      };
    });
    expect(alignment.gapFromRight).toBeLessThan(2);
    expect(alignment.bubbleLeft).toBeGreaterThan(alignment.rowCenter);

    await expect(page.locator("#messages")).toContainText("RM 888");
  }
});