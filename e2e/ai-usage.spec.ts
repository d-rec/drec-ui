import { expect, test } from '@playwright/test';
import { adminLogin } from './auth';

test('admin ai-usage page renders summary', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await adminLogin(page);
  await page.goto('/admin/ai-usage');

  await expect(page.getByRole('heading', { name: 'AI Usage' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('Month to date')).toBeVisible();
  await expect(page.getByText('By endpoint (this month)')).toBeVisible();

  // Wait for the refresh to populate (loading indicator gone, table or empty row visible).
  await expect(page.locator('.aiu__loading')).toHaveCount(0, { timeout: 15_000 });

  // Either real data or the empty-state row.
  const hasRow = await page
    .locator('.aiu__table tbody tr')
    .first()
    .isVisible();
  expect(hasRow).toBeTruthy();

  // Surface any 401 / 403 from the endpoint.
  expect(errors.filter((e) => /usage|401|403/i.test(e))).toEqual([]);
});
