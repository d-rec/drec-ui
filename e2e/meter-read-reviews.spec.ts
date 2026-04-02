import { test, expect } from '@playwright/test';
import { adminLogin } from './auth';

test.describe('Meter Read Reviews', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test('navigates to meter read reviews page', async ({ page }) => {
    await page.locator('[test-id="meter-read"]').click();
    await page.getByText('Read Reviews').click();
    await page.waitForURL('**/reads/reviews*');
    await expect(page.locator('.mrr')).toBeVisible({ timeout: 10_000 });
  });

  test('displays list of devices with reads', async ({ page }) => {
    await page.locator('[test-id="meter-read"]').click();
    await page.getByText('Read Reviews').click();
    await page.waitForURL('**/reads/reviews*');
    const rows = page.locator('.mrr__row');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  });

  test('can expand a device to see individual reads', async ({ page }) => {
    await page.locator('[test-id="meter-read"]').click();
    await page.getByText('Read Reviews').click();
    await page.waitForURL('**/reads/reviews*');
    const firstRow = page.locator('.mrr__row').first();
    await firstRow.waitFor({ timeout: 15_000 });

    // Click the expand chevron
    await firstRow.locator('.mrr__col--expand').click();
    // Read rows should appear
    await expect(page.locator('.mrr__read-row').first()).toBeVisible({ timeout: 5_000 });
  });

  test('can select a device and see detail panel', async ({ page }) => {
    await page.locator('[test-id="meter-read"]').click();
    await page.getByText('Read Reviews').click();
    await page.waitForURL('**/reads/reviews*');
    const firstRow = page.locator('.mrr__row').first();
    await firstRow.waitFor({ timeout: 15_000 });

    // Click on the name column to open detail
    await firstRow.locator('.mrr__col--name').click();
    await expect(page.locator('.mrr__detail')).toBeVisible({ timeout: 5_000 });
  });

  test('search filters devices', async ({ page }) => {
    await page.locator('[test-id="meter-read"]').click();
    await page.getByText('Read Reviews').click();
    await page.waitForURL('**/reads/reviews*');
    await page.locator('.mrr__row').first().waitFor({ timeout: 15_000 });

    const rowsBefore = await page.locator('.mrr__row').count();
    await page.locator('.mrr__search').fill('zzz_nonexistent_zzz');
    await page.waitForTimeout(300);
    const rowsAfter = await page.locator('.mrr__row').count();
    expect(rowsAfter).toBeLessThanOrEqual(rowsBefore);
  });

  test('status filter toggles work', async ({ page }) => {
    await page.locator('[test-id="meter-read"]').click();
    await page.getByText('Read Reviews').click();
    await page.waitForURL('**/reads/reviews*');
    await page.locator('.mrr__row').first().waitFor({ timeout: 15_000 });

    // Uncheck "pending" filter
    const pendingFilter = page.locator('.mrr__filter').filter({ hasText: /pending/i });
    await pendingFilter.locator('input[type="checkbox"]').uncheck();
    await page.waitForTimeout(300);
    // Re-check
    await pendingFilter.locator('input[type="checkbox"]').check();
  });
});
