import { test, expect } from '@playwright/test';

/**
 * Verify that the SF-02 gap fields (Registration Type, Volume Evidence Type,
 * Public Funding Type, Labelling Scheme, Verification Agent, Off-Grid
 * Circumstances) are present in the device registration form.
 */

async function loginAsRegistrant(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.locator('[test-id="login-username"]').fill('evident.demo@drec.energy');
  await page.locator('[test-id="login-password"]').fill('D0ntc4r3');
  await page.locator('[test-id="login-submit"]').click();
  await page.waitForURL('**/dashboard*', { timeout: 15_000 });
}

test.describe('SF-02 fields on Add Device', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRegistrant(page);
    await page.goto('/device/add');
    await page.waitForLoadState('networkidle');
  });

  test('More Details section shows SF-02 gap fields', async ({ page }) => {
    // Click "More details" to expand the section
    const moreBtn = page.locator('[test-id="add-more"]').first();
    await expect(moreBtn).toBeVisible({ timeout: 10_000 });
    await moreBtn.click();
    await page.waitForTimeout(500);

    // Check new SF-02 fields are visible
    await expect(page.locator('mat-label', { hasText: 'Registration Type' }).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('mat-label', { hasText: 'Volume Evidence Type' }).first()).toBeVisible();
    await expect(page.locator('mat-label', { hasText: 'Verification Agent' }).first()).toBeVisible();
    await expect(page.locator('mat-label', { hasText: 'Off-Grid Circumstances' }).first()).toBeVisible();
    await expect(page.locator('mat-label', { hasText: 'Labelling Scheme' }).first()).toBeVisible();
    await expect(page.locator('mat-label', { hasText: 'Public Funding Type' }).first()).toBeVisible();
  });

  test('Registration Type dropdown has correct options', async ({ page }) => {
    const moreBtn = page.locator('[test-id="add-more"]').first();
    await expect(moreBtn).toBeVisible({ timeout: 10_000 });
    await moreBtn.click();
    await page.waitForTimeout(500);

    // Open the Registration Type dropdown
    const regTypeField = page.locator('mat-form-field', { has: page.locator('mat-label', { hasText: 'Registration Type' }) }).first();
    await regTypeField.locator('mat-select').click({ force: true });

    // Verify options
    await expect(page.getByRole('option', { name: 'New', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Change of details' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Renewal' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Transfer' })).toBeVisible();

    // Close dropdown
    await page.keyboard.press('Escape');
  });

  test('Volume Evidence Type dropdown has correct options', async ({ page }) => {
    const moreBtn = page.locator('[test-id="add-more"]').first();
    await expect(moreBtn).toBeVisible({ timeout: 10_000 });
    await moreBtn.click();
    await page.waitForTimeout(500);

    const field = page.locator('mat-form-field', { has: page.locator('mat-label', { hasText: 'Volume Evidence Type' }) }).first();
    await field.locator('mat-select').click({ force: true });

    const options = page.locator('mat-option');
    await expect(options.filter({ hasText: 'Metering data' })).toBeVisible();
    await expect(options.filter({ hasText: 'Contract sales invoice' })).toBeVisible();
    await expect(options.filter({ hasText: 'Other' })).toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('Public Funding Type dropdown has correct options', async ({ page }) => {
    const moreBtn = page.locator('[test-id="add-more"]').first();
    await expect(moreBtn).toBeVisible({ timeout: 10_000 });
    await moreBtn.click();
    await page.waitForTimeout(500);

    const field = page.locator('mat-form-field', { has: page.locator('mat-label', { hasText: 'Public Funding Type' }) }).first();
    await field.locator('mat-select').click({ force: true });

    await expect(page.getByRole('option', { name: 'No', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Investment' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Production' })).toBeVisible();

    await page.keyboard.press('Escape');
  });
});

test.describe('SF-02 fields on Edit Device', () => {
  test('edit device form shows SF-02 gap fields', async ({ page }) => {
    await loginAsRegistrant(page);
    await page.goto('/device/AllList');
    await page.waitForLoadState('networkidle');

    // Click the first edit button in the device list
    const editBtn = page.locator('[test-id="edit-device"]').first();
    if (await editBtn.isVisible({ timeout: 5_000 })) {
      await editBtn.click();
      await page.waitForLoadState('networkidle');

      // Click "More details"
      const moreBtn = page.locator('[test-id="add-more"]').first();
      if (await moreBtn.isVisible({ timeout: 5_000 })) {
        await moreBtn.click();
      }
      await page.waitForTimeout(500);

      await expect(page.locator('mat-label', { hasText: 'Registration Type' }).first()).toBeVisible({ timeout: 5_000 });
      await expect(page.locator('mat-label', { hasText: 'Volume Evidence Type' }).first()).toBeVisible();
      await expect(page.locator('mat-label', { hasText: 'Verification Agent' }).first()).toBeVisible();
    } else {
      test.skip();
    }
  });
});
