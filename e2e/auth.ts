import { Page } from '@playwright/test';

export async function adminLogin(page: Page) {
  await page.goto('/login');
  await page.locator('[test-id="login-username"]').fill('admin@drec.local');
  await page.locator('[test-id="login-password"]').fill('Admin1234!');
  await page.locator('[test-id="login-submit"]').click();
  await page.waitForURL('**/dashboard*', { timeout: 10_000 });
}
