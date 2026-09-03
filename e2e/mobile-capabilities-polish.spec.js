const { test, expect } = require("@playwright/test");

test("public demo stays polished and usable across phone widths", async ({ page }) => {
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const headerCta = await page.locator(".header-audit-button").evaluate((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        display: style.display,
        alignItems: style.alignItems,
        justifyContent: style.justifyContent,
        lineHeight: style.lineHeight,
        height: rect.height,
      };
    });

    expect(["flex", "inline-flex"]).toContain(headerCta.display);
    expect(headerCta.alignItems).toBe("center");
    expect(headerCta.justifyContent).toBe("center");
    expect(headerCta.height).toBeGreaterThanOrEqual(43.5);

    await expect(page.locator("[data-acquisition-selector]")).toBeVisible();
    const sourceCards = page.locator("[data-acquisition-selector] .suggestion-chip");
    await expect(sourceCards).toHaveCount(4);

    const sourceLayout = await sourceCards.evaluateAll((buttons) => buttons.map((button) => {
      const card = button.getBoundingClientRect();
      const kicker = button.querySelector(":scope > span")?.getBoundingClientRect();
      const title = button.querySelector(":scope > strong")?.getBoundingClientRect();
      const style = getComputedStyle(button);
      return {
        x: card.x,
        y: card.y,
        width: card.width,
        height: card.height,
        display: style.display,
        kickerBottom: kicker?.bottom ?? 0,
        titleTop: title?.top ?? 0,
        titleBottom: title?.bottom ?? 0,
      };
    }));

    sourceLayout.forEach((card) => {
      expect(card.display).toBe("flex");
      expect(card.width).toBeGreaterThan(120);
      expect(card.height).toBeGreaterThanOrEqual(83.5);
      expect(card.kickerBottom).toBeLessThanOrEqual(card.titleTop + 1);
      expect(card.titleBottom).toBeLessThanOrEqual(card.y + card.height + 1);
    });
    expect(Math.abs(sourceLayout[0].y - sourceLayout[1].y)).toBeLessThanOrEqual(2);
    expect(Math.abs(sourceLayout[2].y - sourceLayout[3].y)).toBeLessThanOrEqual(2);
    expect(sourceLayout[2].y).toBeGreaterThan(sourceLayout[0].y + 20);

    const keyDemoControls = await page.evaluate(() => {
      const box = (selector) => {
        const element = document.querySelector(selector);
        const rect = element?.getBoundingClientRect();
        return rect ? { width: rect.width, height: rect.height } : null;
      };
      return {
        patientTab: box("#patientTab"),
        dashboardTab: box("#dashboardTab"),
        channel: box(".channel-button"),
        sample: box(".prompt-panel .suggestion-chip"),
        phone: box("#phone"),
      };
    });

    expect(keyDemoControls.patientTab?.height || 0).toBeGreaterThanOrEqual(44);
    expect(keyDemoControls.dashboardTab?.height || 0).toBeGreaterThanOrEqual(44);
    expect(keyDemoControls.channel?.height || 0).toBeGreaterThanOrEqual(44);
    expect(keyDemoControls.sample?.height || 0).toBeGreaterThanOrEqual(70);
    expect(keyDemoControls.phone?.width || width + 1).toBeLessThanOrEqual(width - 12);

    const capabilityLayout = await page.locator(".capabilities-section").evaluate((section) => {
      const heading = section.querySelector(".section-heading");
      const grid = section.querySelector(".capability-grid");
      const card = section.querySelector(".capability-card");
      const icon = card.querySelector(".capability-icon");
      const label = card.querySelector(":scope > span");
      const title = card.querySelector("h3");
      const copy = card.querySelector("p");
      const cardStyle = getComputedStyle(card);
      const iconStyle = getComputedStyle(icon);

      return {
        sectionPaddingTop: parseFloat(getComputedStyle(section).paddingTop),
        sectionPaddingBottom: parseFloat(getComputedStyle(section).paddingBottom),
        headingMarginBottom: parseFloat(getComputedStyle(heading).marginBottom),
        gridGap: parseFloat(getComputedStyle(grid).rowGap),
        cardDisplay: cardStyle.display,
        cardPaddingTop: parseFloat(cardStyle.paddingTop),
        cardRadius: parseFloat(cardStyle.borderTopLeftRadius),
        iconWidth: parseFloat(iconStyle.width),
        iconMarginBottom: parseFloat(iconStyle.marginBottom),
        labelSize: parseFloat(getComputedStyle(label).fontSize),
        titleSize: parseFloat(getComputedStyle(title).fontSize),
        copySize: parseFloat(getComputedStyle(copy).fontSize),
        copyLineHeight: parseFloat(getComputedStyle(copy).lineHeight),
      };
    });

    expect(capabilityLayout.sectionPaddingTop).toBeGreaterThanOrEqual(71);
    expect(capabilityLayout.sectionPaddingBottom).toBeGreaterThanOrEqual(71);
    expect(capabilityLayout.headingMarginBottom).toBeGreaterThanOrEqual(29);
    expect(capabilityLayout.gridGap).toBeGreaterThanOrEqual(15);
    expect(capabilityLayout.cardDisplay).toBe("block");
    expect(capabilityLayout.cardPaddingTop).toBeGreaterThanOrEqual(23);
    expect(capabilityLayout.cardRadius).toBeGreaterThanOrEqual(21);
    expect(capabilityLayout.iconWidth).toBeGreaterThanOrEqual(49);
    expect(capabilityLayout.iconMarginBottom).toBeGreaterThanOrEqual(17);
    expect(capabilityLayout.labelSize).toBeGreaterThanOrEqual(10);
    expect(capabilityLayout.titleSize).toBeGreaterThanOrEqual(20);
    expect(capabilityLayout.copySize).toBeGreaterThanOrEqual(13);
    expect(capabilityLayout.copyLineHeight).toBeGreaterThan(capabilityLayout.copySize * 1.5);

    const rootWidth = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(rootWidth.scrollWidth).toBeLessThanOrEqual(rootWidth.clientWidth);
  }
});
