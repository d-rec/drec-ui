import { test, expect, Page } from '@playwright/test';
import { adminLogin } from './auth';

const PASSWORD = 'Test1234';

interface RegistrationData {
  orgType: string;
  orgTypeLabel: string;
  address: string;
}

const orgTypes: RegistrationData[] = [
  { orgType: 'Buyer', orgTypeLabel: 'Buyer', address: 'Amsterdam, NL' },
  { orgType: 'Registrant', orgTypeLabel: 'Registrant', address: 'Rotterdam, NL' },
  { orgType: 'SiteOperator', orgTypeLabel: 'Site Operator', address: 'Utrecht, NL' },
];

function makeUser(org: RegistrationData) {
  const id = Date.now() + Math.random().toString(36).slice(2, 6);
  const tag = org.orgType.toLowerCase();
  return {
    firstName: org.orgTypeLabel.split(' ')[0],
    lastName: 'Test',
    email: `${tag}-${id}@test.local`,
    phone: `+3161234${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
    orgName: `${org.orgTypeLabel} Org ${id}`,
    orgAddress: org.address,
    ...org,
  };
}

async function fillRegistrationForm(page: Page, user: ReturnType<typeof makeUser>) {
  await page.goto('/register');

  // Step 1: User info
  await page.locator('[test-id="first-name"]').fill(user.firstName);
  await page.locator('[test-id="last-name"]').fill(user.lastName);
  await page.locator('[test-id="email"]').fill(user.email);
  await page.locator('[test-id="phone-number"]').fill(user.phone);
  await page.locator('[test-id="user-info"]').click();

  // Step 2: Organization info
  await page.locator('[test-id="organization-type"]').click();
  await page.locator('mat-option').filter({ hasText: user.orgTypeLabel }).click();
  await page.locator('[test-id="organization-name"]').fill(user.orgName);
  await page.locator('[test-id="organization-address"]').fill(user.orgAddress);
  await page.locator('[test-id="next-to-password"]').click();

  // Step 3: Password
  await page.locator('[test-id="password"]').fill(PASSWORD);
  await page.locator('[test-id="confirm-password"]').fill(PASSWORD);
  await page.locator('[test-id="terms-and-conditions"]').click();
  await page.locator('[test-id="submit-registration"]').click();
}

for (const org of orgTypes) {
  test(`register a ${org.orgTypeLabel} account — created as Pending`, async ({ page }) => {
    const user = makeUser(org);
    await fillRegistrationForm(page, user);

    // After registration, auto-login is attempted but blocked because status is Pending.
    // The frontend shows "pending approval" error from the 403 response.
    await expect(
      page.locator('text=pending approval').or(page.locator('text=Pending')),
    ).toBeVisible({ timeout: 15_000 });
  });

  test(`admin approves a ${org.orgTypeLabel} account`, async ({ page, browser }) => {
    const user = makeUser(org);
    await fillRegistrationForm(page, user);

    // Wait for the pending message
    await expect(
      page.locator('text=pending approval').or(page.locator('text=Pending')),
    ).toBeVisible({ timeout: 15_000 });

    // Now log in as admin and approve the user
    const adminPage = await browser.newPage();
    await adminLogin(adminPage);

    // Navigate to admin user list and find the new user
    await adminPage.goto('/admin/user');
    await adminPage.waitForLoadState('networkidle');

    // Find the user row and click edit
    const userRow = adminPage.locator('tr', { hasText: user.email });
    await userRow.locator('[test-id="edit-user"]').click();

    // Change status to Active
    await adminPage.locator('[test-id="edit-status"]').click();
    await adminPage.locator('mat-option').filter({ hasText: 'Active' }).click();
    await adminPage.locator('[test-id="update-user"]').click();

    // Wait for update to complete
    await adminPage.waitForTimeout(1000);
    await adminPage.close();

    // Now the user should be able to log in
    await page.goto('/login');
    await page.locator('[test-id="login-username"]').fill(user.email);
    await page.locator('[test-id="login-password"]').fill(PASSWORD);
    await page.locator('[test-id="login-submit"]').click();

    if (org.orgType === 'Registrant') {
      await expect(page).toHaveURL(/apiuser|permission|dashboard/, {
        timeout: 15_000,
      });
    } else {
      await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
    }
  });
}
