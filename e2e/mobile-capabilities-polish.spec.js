const { test, expect } = require("@playwright/test");

test("mobile CTA is centered and capability cards keep premium spacing", async ({ page }) => {
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/", { waitUntil: "networkidle" });

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

    expect(headerCta.display).toBe("inline-flex");
    expect(headerCta.alignItems).toBe("center");
    expect(headerCta.justifyContent).toBe("center");
    expect(headerCta.height).toBeGreaterThanOrEqual(43.5);

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
    expect(capabilityLayout.headingMarginBottom).toBeGreaterThanOrEqual(33);
    expect(capabilityLayout.gridGap).toBeGreaterThanOrEqual(17);
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
