import { test, expect } from '@playwright/test';
import { adminLogin } from './auth';

test('admin can log in and reach the dashboard', async ({ page }) => {
  await adminLogin(page);
  await expect(page).toHaveURL(/dashboard/);
});
