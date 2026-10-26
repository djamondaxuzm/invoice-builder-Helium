import { expect, test } from '@playwright/test';
for (const width of [1440, 1100, 900, 500]) {
  test('invoice list spacing and controls at width ' + width, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/e2e/fixtures/invoice-list.html');
    const panel = page.getByTestId('crud-list-panel');
    const button = panel.getByRole('button', { name: 'Billing period / payments' });
    await expect(button).toBeVisible();
    await expect(panel.locator('.MuiCard-root')).toHaveCount(18);
    const measurements = await panel.evaluate(element => {
      const outer = element.getBoundingClientRect();
      const action = element.querySelector('button')!.getBoundingClientRect();
      const search = element.querySelector('input')!.closest('.MuiPaper-root')!.getBoundingClientRect();
      const card = element.querySelector('.MuiCard-root')!.getBoundingClientRect();
      return {
        outer: { x: outer.x, right: outer.right },
        elements: [action, search, card].map(r => ({ x: r.x, right: r.right })),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight
      };
    });
    expect(measurements.scrollHeight).toBeGreaterThan(measurements.clientHeight);
    expect(measurements.scrollWidth).toBeLessThanOrEqual(measurements.clientWidth + 1);
    for (const rect of measurements.elements) {
      expect(Math.abs(rect.x - measurements.elements[0].x)).toBeLessThan(1);
      expect(Math.abs(rect.right - measurements.elements[0].right)).toBeLessThan(1);
      const left = rect.x - measurements.outer.x;
      const right = measurements.outer.right - rect.right;
      expect(left).toBeGreaterThanOrEqual(12);
      expect(right).toBeGreaterThanOrEqual(12);
      expect(Math.abs(left - right)).toBeLessThan(1);
    }
    await page.screenshot({ path: testInfo.outputPath('invoice-list.png') });
    await panel.getByRole('textbox').fill('003');
    await expect(panel.locator('.MuiCard-root')).toHaveCount(1);
    const filteredCard = await panel.locator('.MuiCard-root').boundingBox();
    expect(filteredCard!.x).toBeCloseTo(measurements.elements[0].x, 0);
    expect(filteredCard!.x + filteredCard!.width).toBeCloseTo(measurements.elements[0].right, 0);
    await panel.getByRole('textbox').fill('');
    await panel.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Invoice number' }).click();
    await expect(panel.getByRole('combobox')).toHaveText('Invoice number');
    await expect(panel.locator('.MuiCard-root')).toHaveCount(18);
  });
}

test('catalog cards still fit the shared list pane at its narrow desktop width', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto('/e2e/fixtures/invoice-list.html?catalog');
  const panel = page.getByTestId('crud-list-panel');
  await expect(panel.getByText('Example catalog item')).toHaveCount(18);
  const overflow = await panel.evaluate(element => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
