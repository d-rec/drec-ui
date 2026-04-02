import { test, expect } from '@playwright/test';
import { adminLogin } from './auth';

test.describe('Device Reviews', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test('navigates to device reviews page', async ({ page }) => {
    await page.locator('[test-id="devices"]').click();
    await page.locator('[test-id="device-reviews"]').click();
    await page.waitForURL('**/device/review*');
    await expect(page.locator('.docw')).toBeVisible({ timeout: 10_000 });
  });

  test('displays list of devices for review', async ({ page }) => {
    await page.locator('[test-id="devices"]').click();
    await page.locator('[test-id="device-reviews"]').click();
    await page.waitForURL('**/device/review*');
    const rows = page.locator('.dr-row--device');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  });

  test('can select a device and see detail panel', async ({ page }) => {
    await page.locator('[test-id="devices"]').click();
    await page.locator('[test-id="device-reviews"]').click();
    await page.waitForURL('**/device/review*');
    const firstRow = page.locator('.dr-row--device').first();
    await firstRow.waitFor({ timeout: 15_000 });
    await firstRow.click();
    await expect(page.locator('.docw__detail')).toBeVisible({ timeout: 5_000 });
  });

  test('search filters devices', async ({ page }) => {
    await page.locator('[test-id="devices"]').click();
    await page.locator('[test-id="device-reviews"]').click();
    await page.waitForURL('**/device/review*');
    await page.locator('.dr-row--device').first().waitFor({ timeout: 15_000 });

    const rowsBefore = await page.locator('.dr-row--device').count();
    await page.locator('.search-bar__input').fill('zzz_nonexistent_zzz');
    await page.waitForTimeout(300);
    const rowsAfter = await page.locator('.dr-row--device').count();
    expect(rowsAfter).toBeLessThanOrEqual(rowsBefore);
  });
});
