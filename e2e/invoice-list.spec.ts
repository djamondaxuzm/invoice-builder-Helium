import { expect, test } from '@playwright/test';

for (const [width, collapsed, theme] of [
  [1440, false, 'dark'],
  [1100, false, 'dark'],
  [1100, true, 'dark'],
  [1440, false, 'light'],
  [900, false, 'dark']
] as const) {
  test('full app gutters at ' + width + '/' + theme + (collapsed ? '/collapsed' : ''), async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/e2e/fixtures/invoice-list.html?theme=' + theme);
    const panel = page.getByTestId('crud-list-panel');
    await expect(panel.locator('.MuiCard-root')).toHaveCount(18);
    if (collapsed) {
      await page.getByRole('button', { name: 'Main menu', exact: true }).click();
      await expect(page.locator('.MuiDrawer-paper').first()).toHaveCSS('width', '60px');
    }
    const geometry = async () =>
      panel.evaluate(element => {
        const outer = element.getBoundingClientRect();
        const card = element.querySelector('.MuiCard-root')!.getBoundingClientRect();
        const search = element.querySelector('input')!.closest('.MuiPaper-root')!.getBoundingClientRect();
        const action = Array.from(element.querySelectorAll('button'))
          .find(b => b.textContent?.includes('Billing period'))!
          .getBoundingClientRect();
        const drawer = document.querySelector('.MuiDrawer-paper')!.getBoundingClientRect();
        const detail = element.parentElement!.nextElementSibling!.getBoundingClientRect();
        const barWidth = element.clientWidth === element.offsetWidth ? 0 : element.offsetWidth - element.clientWidth;
        return {
          leftGap: card.x - drawer.right,
          beforeScrollbar: outer.right - barWidth - card.right,
          afterScrollbar: detail.x - outer.right,
          leftInset: card.x - outer.x,
          cardX: card.x,
          cardRight: card.right,
          searchX: search.x,
          searchRight: search.right,
          actionX: action.x,
          actionRight: action.right,
          overflowing: element.scrollWidth - element.clientWidth,
          documentOverflow: document.documentElement.scrollWidth - window.innerWidth
        };
      });
    const before = await geometry();
    expect(before.leftGap).toBeCloseTo(16, 0);
    expect(before.beforeScrollbar).toBeCloseTo(16, 0);
    expect(before.afterScrollbar).toBeCloseTo(0, 0);
    expect(before.leftInset).toBeCloseTo(0, 0);
    expect(before.overflowing).toBeLessThanOrEqual(1);
    expect(before.documentOverflow).toBeLessThanOrEqual(1);
    for (const [x, right] of [
      [before.searchX, before.searchRight],
      [before.actionX, before.actionRight]
    ]) {
      expect(x).toBeCloseTo(before.cardX, 0);
      expect(right).toBeCloseTo(before.cardRight, 0);
    }
    await panel.locator('.MuiCard-root').first().click();
    await expect(page.getByText('Invoice details 1', { exact: true })).toBeVisible();
    await panel.evaluate(e => {
      e.scrollTop = 185;
    });
    const scrolled = await geometry();
    expect(scrolled.cardX).toBeCloseTo(before.cardX, 0);
    expect(scrolled.afterScrollbar).toBeCloseTo(0, 0);
    await expect(page.getByRole('button', { name: 'Add', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('full-app-scrolled.png') });
    await panel.evaluate(e => {
      e.scrollTop = 0;
    });
    await panel.getByRole('textbox').fill('003');
    await expect(panel.locator('.MuiCard-root')).toHaveCount(1);
    const filtered = await geometry();
    expect(filtered.cardX).toBeCloseTo(before.cardX, 0);
    expect(filtered.cardRight).toBeCloseTo(before.cardRight, 0);
    await panel.getByRole('textbox').fill('');
    await panel.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Invoice number' }).click();
    await expect(panel.getByRole('combobox')).toHaveText('Invoice number');
  });
}
test('narrow catalog and mobile invoice panes do not overflow horizontally', async ({ page }) => {
  for (const [width, query] of [
    [900, '?catalog'],
    [500, '']
  ] as const) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/e2e/fixtures/invoice-list.html' + query);
    const panel = page.getByTestId('crud-list-panel');
    await expect(panel.getByRole('textbox')).toBeVisible();
    await expect(panel.getByRole('textbox')).toHaveValue('');
    const overflow = await panel.evaluate(e => ({
      panel: e.scrollWidth - e.clientWidth,
      document: document.documentElement.scrollWidth - window.innerWidth
    }));
    expect(overflow.panel).toBeLessThanOrEqual(1);
    expect(overflow.document).toBeLessThanOrEqual(1);
  }
});
