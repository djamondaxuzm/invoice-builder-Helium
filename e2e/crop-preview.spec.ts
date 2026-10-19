import { expect, test } from '@playwright/test';

for (const [shape, width, height] of [
  ['wide', 4000, 1000],
  ['tall', 1000, 4000],
  ['small', 32, 24]
] as const) {
  test('fits ' + shape + ' uploads without upscaling and preserves original saved pixels', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.goto('/e2e/fixtures/crop.html?size=' + shape);
    const image = page.getByAltText('Crop image');
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
    const box = await image.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(Math.min(width, 1000));
    expect(box!.height).toBeLessThanOrEqual(Math.min(height, 480));
    expect(box!.width / box!.height).toBeCloseTo(width / height, 2);
    await page.setViewportSize({ width: 650, height: 500 });
    const resized = await image.boundingBox();
    expect(resized!.height).toBeLessThanOrEqual(280);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('output')).toHaveText(width + 'x' + height);
  });
}

test('preserves a partial crop on resize and resets to the full image', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto('/e2e/fixtures/crop.html?size=wide');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
  const handle = page.locator('.ReactCrop__drag-handle.ord-e');
  const box = await handle.boundingBox();
  const image = await page.getByAltText('Crop image').boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(image!.x + image!.width / 2, box!.y + box!.height / 2);
  await page.mouse.up();
  const before = await page.locator('.ReactCrop__crop-selection').getAttribute('style');
  await page.setViewportSize({ width: 650, height: 500 });
  expect(await page.locator('.ReactCrop__crop-selection').getAttribute('style')).toBe(before);
  await page.getByRole('button', { name: 'Use full image' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('output')).toHaveText('4000x1000');
});
