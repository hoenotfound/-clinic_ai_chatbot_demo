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

  const brandTypography = await page.locator(".da-brand").evaluate((el) => {
    const title = getComputedStyle(el, "::before");
    const subtitle = getComputedStyle(el, "::after");
    return {
      titleFamily: title.fontFamily,
      titleSize: title.fontSize,
      titleWeight: title.fontWeight,
      subtitleFamily: subtitle.fontFamily,
      subtitleSize: subtitle.fontSize,
      subtitleWeight: subtitle.fontWeight,
      subtitleTracking: subtitle.letterSpacing,
    };
  });
  expect(brandTypography.titleFamily).toContain("Plus Jakarta Sans");
  expect(brandTypography.titleSize).toBe("20px");
  expect(brandTypography.titleWeight).toBe("800");
  expect(brandTypography.subtitleFamily).toContain("Plus Jakarta Sans");
  expect(brandTypography.subtitleSize).toBe("9px");
  expect(brandTypography.subtitleWeight).toBe("700");
  expect(brandTypography.subtitleTracking).toBe("1.8px");

  const footerBrandTypography = await page.locator(".subpage-footer-brand").evaluate((el) => ({
    titleFamily: getComputedStyle(el, "::before").fontFamily,
    titleWeight: getComputedStyle(el, "::before").fontWeight,
    subtitleFamily: getComputedStyle(el, "::after").fontFamily,
    subtitleWeight: getComputedStyle(el, "::after").fontWeight,
  }));
  expect(footerBrandTypography.titleFamily).toContain("Plus Jakarta Sans");
  expect(footerBrandTypography.titleWeight).toBe("800");
  expect(footerBrandTypography.subtitleFamily).toContain("Plus Jakarta Sans");
  expect(footerBrandTypography.subtitleWeight).toBe("700");

  const patientTypography = await page.locator("#patientView").evaluate((root) => {
    const read = (selector) => {
      const style = getComputedStyle(root.querySelector(selector));
      return { family: style.fontFamily, weight: style.fontWeight };
    };
    return {
      guide: read(".guide-label strong"),
      channelTitle: read(".channel-button strong"),
      channelDetail: read(".channel-button small"),
      tourTitle: read(".tour-heading div > span"),
      phoneTitle: read(".chat-title strong"),
      promptTitle: read(".prompt-panel .suggestion-chip > strong"),
    };
  });
  for (const sample of Object.values(patientTypography)) {
    expect(sample.family).toContain("Plus Jakarta Sans");
  }
  expect(patientTypography.guide.weight).toBe("700");
  expect(patientTypography.channelTitle.weight).toBe("700");
  expect(patientTypography.channelDetail.weight).toBe("400");
  expect(patientTypography.tourTitle.weight).toBe("800");
  expect(patientTypography.phoneTitle.weight).toBe("700");
  expect(patientTypography.promptTitle.weight).toBe("700");

  const trustTypography = await page.locator(".sales-cta-trust span").first().evaluate((el) => {
    const style = getComputedStyle(el);
    return { family: style.fontFamily, weight: style.fontWeight, size: style.fontSize };
  });
  expect(trustTypography.family).toContain("Plus Jakarta Sans");
  expect(trustTypography.weight).toBe("700");
  expect(trustTypography.size).toBe("10px");

  const capabilityIcons = await page.locator(".capability-icon").evaluateAll((icons) => icons.map((el) => {
    const style = getComputedStyle(el);
    const pseudo = getComputedStyle(el, "::before");
    return {
      mask: pseudo.maskImage || pseudo.webkitMaskImage,
      display: style.display,
      placeItems: style.placeItems,
    };
  }));
  expect(capabilityIcons).toHaveLength(3);
  capabilityIcons.forEach((icon) => {
    expect(icon.mask).not.toBe("none");
    expect(icon.display).toBe("grid");
    expect(icon.placeItems).toBe("center");
  });

  const leadIntelligenceCard = page.locator(".capability-card").nth(1);
  const leadCardStyle = await leadIntelligenceCard.evaluate((el) => ({
    background: getComputedStyle(el).backgroundColor,
    heading: getComputedStyle(el.querySelector("h3")).color,
  }));
  expect(leadCardStyle.background).toBe("rgb(255, 255, 255)");
  expect(leadCardStyle.heading).not.toBe("rgb(255, 255, 255)");

  const capabilityBackground = await page.locator(".capabilities-section").evaluate((el) => getComputedStyle(el, "::before").backgroundImage);
  expect(capabilityBackground).not.toBe("none");

  await page.screenshot({ path: "visual-artifacts/public-demo-desktop.png", fullPage: true });
});

test("capture and verify polished mobile demo at 360, 390 and 430px", async ({ page }) => {
  ensureDir();

  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
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

    const rootWidth = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(rootWidth.scrollWidth).toBeLessThanOrEqual(rootWidth.clientWidth);

    const promptCards = page.locator(".prompt-panel .suggestion-chip");
    await expect(promptCards).toHaveCount(4);
    const promptBoxes = await promptCards.evaluateAll((cards) => cards.map((card) => {
      const rect = card.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, right: rect.right };
    }));
    expect(Math.abs(promptBoxes[0].y - promptBoxes[1].y)).toBeLessThan(2);
    expect(promptBoxes[2].y).toBeGreaterThan(promptBoxes[0].y + 20);
    expect(Math.abs(promptBoxes[2].y - promptBoxes[3].y)).toBeLessThan(2);
    expect(Math.abs(promptBoxes[0].width - promptBoxes[1].width)).toBeLessThan(2);
    expect(Math.abs(promptBoxes[2].width - promptBoxes[3].width)).toBeLessThan(2);
    promptBoxes.forEach((box) => {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(width);
    });

    const microcopy = await page.locator("#patientView").evaluate((root) => ({
      promptLabel: parseFloat(getComputedStyle(root.querySelector(".prompt-panel .suggestion-chip > span")).fontSize),
      promptTitle: parseFloat(getComputedStyle(root.querySelector(".prompt-panel .suggestion-chip > strong")).fontSize),
      helper: parseFloat(getComputedStyle(root.querySelector(".prompt-panel .prompt-helper")).fontSize),
      channelNote: parseFloat(getComputedStyle(root.querySelector(".channel-preview-note")).fontSize),
    }));
    expect(microcopy.promptLabel).toBeGreaterThanOrEqual(9);
    expect(microcopy.promptTitle).toBeGreaterThanOrEqual(11);
    expect(microcopy.helper).toBeGreaterThanOrEqual(10);
    expect(microcopy.channelNote).toBeGreaterThanOrEqual(10);

    const mobileBrand = await page.locator(".da-brand").evaluate((el) => ({
      titleSize: getComputedStyle(el, "::before").fontSize,
      subtitleSize: getComputedStyle(el, "::after").fontSize,
    }));
    expect(mobileBrand.titleSize).toBe("14px");
    expect(mobileBrand.subtitleSize).toBe("6.3px");

    await page.screenshot({ path: `visual-artifacts/public-demo-mobile-${width}.png`, fullPage: true });
    if (width === 390) {
      await page.screenshot({ path: "visual-artifacts/public-demo-mobile.png", fullPage: true });
    }
  }
});
