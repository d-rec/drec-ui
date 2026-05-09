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

  // Click the "Generate evidence provenance" button.
  const genBtn = page
    .locator('button', { hasText: /(Re-)?[Gg]enerate evidence provenance/i })
    .first();
  await genBtn.scrollIntoViewIfNeeded();
  await genBtn.click();

  // Toast appears.
  await expect(
    page.locator('text=/Evidence provenance report attached/i'),
  ).toBeVisible({ timeout: 15_000 });

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
});
