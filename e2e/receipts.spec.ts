import { expect, test } from '@playwright/test';

test('compresses real browser images and both PDF paths without losing pages or recompressing saved JPEGs', async ({
  page
}) => {
  await page.goto('/e2e/fixtures/receipts.html');
  await page.waitForFunction(() => Boolean(window.receiptHarness));
  const result = await page.evaluate(() => window.receiptHarness.benchmark(undefined, 'image/png', true));
  expect(result.afterBytes).toBeLessThan(result.beforeBytes * 0.4);
  expect(result.pdfs!.afterBytes).toBeLessThan(result.pdfs!.beforeBytes * 0.4);
  expect(result.pdfs!.afterPages).toBe(result.pdfs!.beforePages);
  expect(result.pdfs!.afterPages).toBe(4);
  expect(result.pdfs!.singlePages).toBe(2);
  expect(result.dimensionsAfter[0] / result.dimensionsAfter[1]).toBeCloseTo(3000 / 4200, 2);
  expect((await page.evaluate(url => window.receiptHarness.optimizeAgain(url), result.url)).unchanged).toBe(true);
});

test('reducing stored receipts sends replacement bytes only on save, while cancel restores originals', async ({
  page
}) => {
  await page.goto('/e2e/fixtures/receipts.html');
  await page.getByRole('button', { name: 'Save test invoice' }).click();
  await expect(page.locator('output')).toContainText('"bytes":0');
  await page.getByRole('button', { name: 'Reduce stored attachments' }).click();
  await expect(page.getByRole('alert')).toContainText('Save the invoice');
  await page.getByRole('button', { name: 'Save test invoice' }).click();
  const saved = JSON.parse(await page.locator('output').innerText());
  expect(saved[0].id).toBe(10);
  expect(saved[0].bytes).toBe(saved[0].fileSize);
  expect(saved[0].fileType).toBe('image/jpeg');
  expect(saved[0].fileName).toBe('demo.jpg');
  expect(saved[0].retain).toBe(false);
  await page.getByRole('button', { name: 'Cancel edits' }).click();
  await page.getByRole('button', { name: 'Save test invoice' }).click();
  await expect(page.locator('output')).toContainText('"fileType":"image/png"');
  await expect(page.locator('output')).toContainText('"bytes":0');
});

test('uploading an existing JPEG keeps its encoding and filename through the full-image cropper', async ({ page }) => {
  await page.goto('/e2e/fixtures/receipts.html');
  await page.waitForFunction(() => Boolean(window.receiptHarness));
  const result = await page.evaluate(() => window.receiptHarness.benchmark());
  const bytes = Buffer.from(result.url.split(',')[1], 'base64');
  await page
    .locator('input[type=file]')
    .last()
    .setInputFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: bytes });
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save test invoice' }).click();
  const saved = JSON.parse(await page.locator('output').innerText());
  expect(saved).toHaveLength(2);
  expect(saved[1].fileType).toBe('image/jpeg');
  expect(saved[1].fileName).toBe('photo.jpg');
  expect(saved[1].bytes).toBe(bytes.length);
});
