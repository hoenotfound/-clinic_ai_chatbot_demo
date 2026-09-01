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
