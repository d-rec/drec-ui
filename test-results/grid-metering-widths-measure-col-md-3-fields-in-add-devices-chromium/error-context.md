# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: grid-metering-widths.spec.ts >> measure col-md-3 fields in add-devices
- Location: e2e/grid-metering-widths.spec.ts:3:5

# Error details

```
TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('mat-form-field') to be visible

```

# Test source

```ts
  1  | import { test } from '@playwright/test';
  2  | import { adminLogin } from './auth';
  3  | test('measure col-md-3 fields in add-devices', async ({ page }) => {
  4  |   await adminLogin(page);
  5  |   await page.goto('/device/addDevice');
> 6  |   await page.waitForSelector('mat-form-field', { timeout: 15_000 });
     |              ^ TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
  7  |   await page.waitForTimeout(1500);
  8  |   const widths = await page.evaluate(() => {
  9  |     const cols = Array.from(document.querySelectorAll('.col-md-3')) as HTMLElement[];
  10 |     return cols.slice(0, 30).map(c => {
  11 |       const lbl = c.querySelector('mat-label')?.textContent?.trim() || '';
  12 |       const r = c.getBoundingClientRect();
  13 |       return { label: lbl.slice(0, 60), w: Math.round(r.width) };
  14 |     });
  15 |   });
  16 |   console.log(JSON.stringify(widths, null, 2));
  17 | });
  18 | 
```