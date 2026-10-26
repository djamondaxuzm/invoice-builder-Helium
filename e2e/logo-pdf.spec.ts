import { expect, test } from '@playwright/test';
test('browser PDFs resize logo copies and embed a shared transparent logo only once', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', message => {
    if (message.type() === 'warning' || message.type() === 'error') warnings.push(message.text());
  });
  await page.goto('/e2e/fixtures/logo-pdf.html');
  await page.waitForFunction(() => Boolean(window.logoPdfHarness));
  const result = await page.evaluate(() => window.logoPdfHarness.sample());
  expect(result.dimensions).toEqual([384, 384]);
  expect(result.period.pages).toBe(4);
  expect(result.period.images).toBe(2); // One RGB logo and its transparency mask across four pages.
  expect(result.period.bytes).toBeLessThan(result.sourceBytes * 0.5);
  expect(result.single.pages).toBe(1);
  expect(result.single.images).toBe(2);
  expect(warnings.filter(text => /Buffer is not defined|Invalid image|Image should receive/.test(text))).toEqual([]);
});
