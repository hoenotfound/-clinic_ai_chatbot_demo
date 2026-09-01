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
  await expect(page.locator('#portalPageInbox')).toHaveClass(/active/);
}

test('dashboard scrolls, Inbox filters work and channel badges use real SVG icons', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await openDashboard(page);

  const sampleCards = page.locator('.sample-conversation-card');
  await expect(sampleCards).toHaveCount(12);
  await expect(page.locator('#dashboardChannelAvatar .channel-brand-badge svg')).toBeVisible();
  await expect(sampleCards.first().locator('.channel-brand-badge svg')).toBeVisible();

  const conversationScroll = page.locator('.portal-conversation-scroll');
  const canScroll = await conversationScroll.evaluate((el) => el.scrollHeight > el.clientHeight);
  expect(canScroll).toBe(true);
  await conversationScroll.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  expect(await conversationScroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

  await page.locator('[data-inbox-filter="attention"]').click();
  await expect(page.locator('[data-sample-id="sample-daniel"]')).toBeVisible();
  await expect(page.locator('[data-sample-id="sample-amanda"]')).not.toBeVisible();
  await expect(page.locator('#portalConversationCount')).toHaveText(/1|2/);

  await page.locator('[data-inbox-filter="all"]').click();
  await page.locator('#portalInboxChannel').selectOption('instagram');
  await expect(page.locator('[data-sample-id="sample-amanda"]')).toBeVisible();
  await expect(page.locator('[data-sample-id="sample-nur"]')).not.toBeVisible();

  await page.locator('#portalInboxChannel').selectOption('all');
  await page.locator('#portalInboxSearch').fill('pigmentation');
  await expect(page.locator('[data-sample-id="sample-amanda"]')).toBeVisible();
  await expect(page.locator('[data-sample-id="sample-nur"]')).not.toBeVisible();
  await expect(page.locator('#portalInboxFilterSummary')).toContainText('pigmentation');

  expect(browserErrors, `Browser errors: ${browserErrors.join('\n')}`).toEqual([]);
});

test('every Pipeline filter is usable and Pipeline/Analytics scrolling works', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await openDashboard(page);
  await page.locator('[data-portal-page="pipeline"]').click();
  await expect(page.locator('#portalPagePipeline')).toHaveClass(/active/);
  await expect(page.locator('#pipelineBoard .channel-brand-badge svg').first()).toBeVisible();

  const board = page.locator('#pipelineBoard');
  const boardScrollable = await board.evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(boardScrollable).toBe(true);
  await board.evaluate((el) => { el.scrollLeft = 220; });
  expect(await board.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);

  await page.locator('[data-pipeline-special="unassigned"]').click();
  await expect(page.locator('[data-pipeline-lead="sample-meiling"]')).toBeVisible();
  await expect(page.locator('[data-pipeline-lead="sample-amanda"]')).not.toBeVisible();

  await page.locator('[data-pipeline-special="noReply"]').click();
  await expect(page.locator('[data-pipeline-lead="sample-amanda"]')).toBeVisible();
  await expect(page.locator('[data-pipeline-lead="sample-nur"]')).not.toBeVisible();

  await page.locator('[data-pipeline-special="reschedule"]').click();
  await expect(page.locator('[data-pipeline-lead="sample-farah"]')).toBeVisible();
  await expect(page.locator('[data-pipeline-lead="sample-amanda"]')).not.toBeVisible();

  await page.locator('[data-pipeline-special="cancelled"]').click();
  await expect(page.locator('[data-pipeline-lead="sample-aina"]')).toBeVisible();
  await expect(page.locator('[data-pipeline-lead="sample-farah"]')).not.toBeVisible();

  await page.locator('[data-pipeline-special="overdue"]').click();
  await expect(page.locator('[data-pipeline-lead="sample-michelle"]')).toBeVisible();
  await expect(page.locator('[data-pipeline-lead="sample-jiaen"]')).toBeVisible();
  await expect(page.locator('[data-pipeline-lead="sample-nur"]')).not.toBeVisible();

  await page.locator('[data-pipeline-category="hot"]').click();
  await expect(page.locator('[data-pipeline-lead="sample-nur"]')).toBeVisible();
  await expect(page.locator('[data-pipeline-lead="sample-amanda"]')).not.toBeVisible();

  await page.locator('[data-portal-page="analytics"]').click();
  const analytics = page.locator('#portalPageAnalytics');
  await expect(analytics).toHaveClass(/active/);
  const analyticsScrollable = await analytics.evaluate((el) => el.scrollHeight > el.clientHeight);
  expect(analyticsScrollable).toBe(true);
  await analytics.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  expect(await analytics.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

  expect(browserErrors, `Browser errors: ${browserErrors.join('\n')}`).toEqual([]);
});
