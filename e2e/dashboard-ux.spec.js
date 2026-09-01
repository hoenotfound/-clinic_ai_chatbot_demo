const { test, expect } = require('@playwright/test');

function collectBrowserErrors(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function openDashboard(page) {
  await page.goto('/');
  await page.getByRole('tab', { name: /Clinic dashboard/i }).click();
  const frame = page.frameLocator('#reactDashboardFrame');
  await expect(frame.getByRole('heading', { name: 'Inbox', exact: true })).toBeVisible();
  return frame;
}

function pipelineFilter(frame, label) {
  return frame.getByRole('button', { name: new RegExp(`^${label} \\d+$`) });
}

test('React Inbox scrolls, filters work and channel badges use real SVG icons', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  const frame = await openDashboard(page);
  const inbox = frame.locator('aside[aria-label="Conversation inbox"]');

  await expect(inbox.getByRole('button', { name: /Amanda Lee/ })).toBeVisible();
  await expect(inbox.getByRole('button', { name: /Nur Aisyah/ })).toBeVisible();
  await expect(inbox.locator('[aria-label="WhatsApp"] svg').first()).toBeVisible();
  await expect(inbox.locator('[aria-label="Instagram"] svg').first()).toBeVisible();

  const conversationScroll = inbox.locator(':scope > div').last();
  expect(await conversationScroll.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await conversationScroll.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  expect(await conversationScroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

  await inbox.getByRole('button', { name: /Needs attention/ }).click();
  await expect(inbox.getByRole('button', { name: /Daniel Wong/ })).toBeVisible();
  await expect(inbox.getByRole('button', { name: /Amanda Lee/ })).toHaveCount(0);

  await inbox.getByRole('button', { name: /^All / }).click();
  const selects = inbox.locator('select');
  await selects.nth(0).selectOption('instagram');
  await expect(inbox.getByRole('button', { name: /Amanda Lee/ })).toBeVisible();
  await expect(inbox.getByRole('button', { name: /Nur Aisyah/ })).toHaveCount(0);

  await selects.nth(0).selectOption('all');
  await inbox.getByPlaceholder('Search conversations').fill('pigmentation');
  await expect(inbox.getByRole('button', { name: /Amanda Lee/ })).toBeVisible();
  await expect(inbox.getByRole('button', { name: /Nur Aisyah/ })).toHaveCount(0);

  expect(browserErrors, `Browser errors: ${browserErrors.join('\n')}`).toEqual([]);
});

test('React Pipeline filters are usable and Analytics remains scrollable', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  const frame = await openDashboard(page);

  await frame.getByRole('link', { name: 'Pipeline' }).click();
  await expect(frame.getByRole('heading', { name: 'Lead Pipeline' })).toBeVisible();
  await expect(frame.locator('[aria-label="WhatsApp"] svg').first()).toBeVisible();

  const desktopKanban = frame.locator('main.hidden.min-h-0.flex-1.overflow-x-auto');
  expect(await desktopKanban.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await desktopKanban.evaluate((el) => { el.scrollLeft = 220; });
  expect(await desktopKanban.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);

  const checks = [
    ['Unassigned', '林美玲 Mei Ling'],
    ['No reply', 'Amanda Lee'],
    ['Reschedule', 'Farah Rahman'],
    ['Cancelled', 'Sarah Lim'],
    ['Follow-up overdue', 'Amanda Lee'],
    ['Needs attention', 'Daniel Wong'],
    ['Hot', 'Nur Aisyah'],
  ];

  for (const [filter, lead] of checks) {
    await pipelineFilter(frame, filter).click();
    await expect(frame.getByRole('button', { name: new RegExp(lead) }).first()).toBeVisible();
  }

  await pipelineFilter(frame, 'All leads').click();
  await frame.getByRole('link', { name: 'Analytics' }).click();
  await expect(frame.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  await expect(frame.getByText('Conversion Funnel')).toBeVisible();
  await expect(frame.getByText('System Health')).toBeVisible();

  expect(browserErrors, `Browser errors: ${browserErrors.join('\n')}`).toEqual([]);
});

test('embedded Clinic Dashboard stays mobile friendly at 360, 390 and 430px', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);

  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const frame = await openDashboard(page);

    const iframeBox = await page.locator('#reactDashboardFrame').boundingBox();
    expect(iframeBox).not.toBeNull();
    expect(iframeBox.width).toBeGreaterThan(width - 50);
    expect(iframeBox.width).toBeLessThanOrEqual(width);

    const mobileNav = frame.getByRole('navigation', { name: 'Mobile dashboard navigation' });
    await expect(mobileNav).toBeVisible();
    const navBox = await mobileNav.boundingBox();
    expect(navBox.width).toBeGreaterThan(width - 60);
    expect(navBox.height).toBeLessThanOrEqual(72);
    await expect(mobileNav.getByRole('button', { name: 'More dashboard pages' })).toBeVisible();

    const inbox = frame.locator('aside[aria-label="Conversation inbox"]');
    const inboxBox = await inbox.boundingBox();
    expect(inboxBox.width).toBeGreaterThan(width - 60);

    await inbox.getByRole('button', { name: /Amanda Lee/ }).click();
    await expect(inbox).toBeHidden();
    await expect(frame.getByRole('button', { name: 'Back to conversations' })).toBeVisible();
    await frame.getByRole('button', { name: 'Back to conversations' }).click();
    await expect(inbox).toBeVisible();

    await mobileNav.getByRole('button', { name: 'More dashboard pages' }).click();
    const moreMenu = frame.locator('#mobileMoreMenu');
    await expect(moreMenu).toBeVisible();
    await expect(moreMenu.getByRole('link', { name: 'Tools' })).toBeVisible();
    await expect(moreMenu.getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
    await expect(moreMenu.getByRole('link', { name: 'Team & Access' })).toBeVisible();
    await moreMenu.getByRole('link', { name: 'Team & Access' }).click();
    await expect(frame.getByRole('heading', { name: 'Team & Access' })).toBeVisible();

    const mobileMembers = frame.locator('section[aria-label="Mobile workspace members"]');
    await expect(mobileMembers).toBeVisible();
    await expect(mobileMembers.locator('[data-mobile-member-card]')).toHaveCount(3);
    await expect(mobileMembers.locator('[data-mobile-member-card]').first()).toBeVisible();
    await expect(frame.locator('table')).toBeHidden();

    const teamWidth = await frame.locator('html').evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(teamWidth.scrollWidth).toBeLessThanOrEqual(teamWidth.clientWidth);

    await mobileNav.getByRole('link', { name: 'Pipeline', exact: true }).click();
    await expect(frame.getByRole('heading', { name: 'Lead Pipeline' })).toBeVisible();
    await expect(frame.locator('main.md\\:hidden')).toBeVisible();

    await mobileNav.getByRole('link', { name: 'Analytics', exact: true }).click();
    await expect(frame.getByRole('heading', { name: 'Analytics' })).toBeVisible();

    const rootWidth = await frame.locator('html').evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(rootWidth.scrollWidth).toBeLessThanOrEqual(rootWidth.clientWidth);
  }

  expect(browserErrors, `Browser errors: ${browserErrors.join('\n')}`).toEqual([]);
});
