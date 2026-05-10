import { test, expect } from '@playwright/test';
import { adminLogin } from './auth';

/**
 * Verifies the EVIDENCE_PROVENANCE report's "Documents attached"
 * section renders multi-doc categories (Metering Evidence, Project
 * Photos) as nested per-row lists rather than comma-soup.
 *
 * Strategy: drive the registrant edit-Atsawa flow → click
 * Re-generate evidence provenance → fetch the latest doc by API
 * and assert the HTML structure.
 */
test('provenance HTML tabulates multi-doc categories', async ({ page, request }) => {
  await adminLogin(page);
  // Find Atsawa via the admin all-devices route (id 327 on local).
  // We don't actually need the form open — call the documents
  // endpoint to verify our generation produces what we expect.
  const token = await page.evaluate(() =>
    sessionStorage.getItem('access-token'),
  );
  expect(token, 'access-token in sessionStorage').toBeTruthy();

  // Open the registrant edit page directly (the route resolves the
  // device by externalId). For local Atsawa this is a known UUID.
  await page.goto('/device/edit/8b1fe0fb-0b55-40e7-9ff1-5c8907d5f9fa');
  // Wait for the form to hydrate (siteName populated).
  await expect(page.locator('input[formcontrolname="siteName"]')).toHaveValue(
    /atsawa/i,
    { timeout: 10_000 },
  );
  // Wait long enough for hydration extractors to fire (cache hits,
  // a couple of network round-trips). 5s is comfortable.
  await page.waitForTimeout(5_000);

  // Provenance auto-regenerates on Update. Add a real character to
  // siteName so hasUnsavedEditChanges returns true.
  const siteInput = page.locator('input[formcontrolname="siteName"]');
  const orig = await siteInput.inputValue();
  await siteInput.fill(`${orig}-tmp`);
  await page.waitForTimeout(500);

  const submitBtn = page.locator('button[test-id="submit-device"]');
  await submitBtn.scrollIntoViewIfNeeded();
  await submitBtn.click();

  // The submit may surface a form-vs-doc resolver dialog first
  // (extractors disagree with the form value we just typed). Cancel
  // it so the original submit returns.
  const fvdDialog = page.locator('text=/Documents disagree with the form/i');
  if (await fvdDialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await page.locator('button', { hasText: 'Apply picks & continue' }).click();
  }

  // Wait for the success toast.
  await expect(
    page.locator('text=/site .* updated/i'),
  ).toBeVisible({ timeout: 15_000 });

  // Restore the original siteName so the local DB stays clean.
  // Wait for the post-update navigation, re-open, restore.
  await page.waitForTimeout(1_500);
  await page.goto('/device/edit/8b1fe0fb-0b55-40e7-9ff1-5c8907d5f9fa');
  await expect(siteInput).toHaveValue(`${orig}-tmp`, { timeout: 10_000 });
  await page.waitForTimeout(5_000);
  await siteInput.fill(orig);
  await page.waitForTimeout(500);
  await submitBtn.scrollIntoViewIfNeeded();
  await submitBtn.click();
  if (await fvdDialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await page.locator('button', { hasText: 'Apply picks & continue' }).click();
  }
  await expect(
    page.locator('text=/site .* updated/i'),
  ).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2_000);

  // Now fetch the latest EVIDENCE_PROVENANCE doc via API and inspect
  // the body. URL pattern: /api/device/327/documents.
  const docsRes = await request.get('/api/device/327/documents', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(docsRes.ok()).toBeTruthy();
  const docs = (await docsRes.json()) as Array<{ id: number; type: string }>;
  const provs = docs.filter((d) => d.type === 'EVIDENCE_PROVENANCE');
  expect(provs.length).toBeGreaterThan(0);
  const latest = provs.sort((a, b) => b.id - a.id)[0];

  const htmlRes = await request.get(`/api/document-uploads/${latest.id}/url`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(htmlRes.ok()).toBeTruthy();
  const html = await htmlRes.text();

  // Multi-doc categories should now render with a nested <ul>, not
  // a comma-separated chain of <a> tags.
  const meteringSection = html.match(/Metering Evidence \(\d+\):.*?<\/li>/s);
  expect(meteringSection, 'metering section found').toBeTruthy();
  expect(meteringSection![0]).toContain('<ul');
  expect(meteringSection![0]).toMatch(/<li>.*Screenshot.*<\/li>/);

  const photosSection = html.match(/Project Photos \(\d+\):.*?<\/li>/s);
  expect(photosSection, 'project photos section found').toBeTruthy();
  expect(photosSection![0]).toContain('<ul');

  // Inference-helper sources should be credited (not "MANUAL").
  // SDG benefits + device description + off-taker on Atsawa all
  // come from the impact-story keyword scan.
  expect(html, 'SDGBenefits row credits Impact story').toMatch(
    /SDG Benefits[\s\S]*Impact story/i,
  );
  // Country comes from the Nominatim geocoder (Nigeria for Atsawa).
  expect(html, 'Country row credits Geocoder').toMatch(
    /Country[\s\S]*Geocoder/i,
  );
});
