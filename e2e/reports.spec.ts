import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-18T19:00:00Z'));
});
test('shows the last day, keeps currency on range changes, filters clients, exports and renders narrow screens', async ({
  page
}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/e2e/fixtures/reports.html');
  await page.getByLabel('Currency', { exact: true }).selectOption('USD:100');
  await expect(page.getByTestId('report-billed')).toContainText('300.00 USD');
  await expect(page.getByTestId('report-payments')).toContainText('140.00 USD');
  await expect(page.getByTestId('report-outstanding')).toContainText('160.00 USD');
  const chart = page.getByTestId('report-trend');
  await expect(chart.locator('.recharts-line-dots').first().locator('circle')).toHaveCount(30);
  await page.getByLabel('Date range', { exact: true }).selectOption('1');
  await expect(page.getByLabel('Currency', { exact: true })).toHaveValue('USD:100');
  await page.getByLabel('Date range', { exact: true }).selectOption('7');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: /back/i }).click();
  await expect(page.getByLabel('Date range', { exact: true })).toHaveValue('1');
  await page.getByRole('tab', { name: 'Clients', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Clients', exact: true })).toContainText('Example Client');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  expect((await download).suggestedFilename()).toContain('Helium-clients-USD');
  await page.getByLabel('Client', { exact: true }).selectOption('9');
  await expect(page.getByTestId('report-billed')).toContainText('0.00 USD');
  await page.getByLabel('Client', { exact: true }).selectOption('');
  await page.getByRole('tab', { name: 'Payments', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Payment ledger' })).toContainText('100.00 USD');
  await expect(page.getByRole('table', { name: 'Payment ledger' })).toContainText('40.00 USD');
  await page.setViewportSize({ width: 650, height: 900 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(650);
  await expect(page.getByTestId('report-trend').locator('svg').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/reports-narrow.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('offers retry instead of presenting a load error as zero revenue', async ({ page }) => {
  await page.goto('/e2e/fixtures/reports.html?mode=error');
  await expect(page.getByRole('alert')).toContainText('Could not load invoices');
  await expect(page.getByTestId('report-billed')).toHaveCount(0);
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByTestId('report-billed')).toBeVisible();
});
test('client-first bulk payment supports range selection, partial preview, saving and refreshed balances', async ({
  page
}) => {
  await page.goto('/e2e/fixtures/reports.html?mode=billing');
  await expect(page.getByRole('button', { name: 'Record payment', exact: true })).toBeDisabled();
  await page.getByLabel('Client', { exact: true }).selectOption('2');
  const rows = page.getByRole('listbox', { name: 'Invoices by date' }).getByRole('option');
  await expect(rows).toHaveCount(3);
  await rows.nth(0).click();
  await rows.nth(2).click({ modifiers: ['Shift'] });
  await expect(page.getByText(/3 selected/)).toBeVisible();
  await page.getByRole('button', { name: 'Record payment', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Record payment across selected invoices' });
  await modal.getByLabel('Total payment (USD)').fill('150');
  await expect(modal.getByRole('table')).toContainText('50.00 USD');
  await expect(modal.getByRole('button', { name: 'Record payments', exact: true })).toBeDisabled();
  await modal.getByLabel('Payment method').selectOption('Bank');
  await page.screenshot({ path: 'test-results/payment-preview.png', fullPage: true, animations: 'disabled' });
  await modal.getByRole('button', { name: 'Record payments', exact: true }).click();
  await expect(page.getByText('Payment recorded on 2 invoices.')).toBeVisible();
  await expect(rows.nth(0)).toContainText('Outstanding: 0.00 USD');
  await expect(rows.nth(1)).toContainText('Outstanding: 50.00 USD');
  await page.getByLabel('Client', { exact: true }).selectOption('9');
  await expect(page.getByText(/0 selected/)).toBeVisible();
  await page.screenshot({ path: 'test-results/bulk-payments.png', fullPage: true });
});
test('legacy Paid opens a blank-date form with only its missing balance and cancel changes nothing', async ({
  page
}) => {
  await page.goto('/e2e/fixtures/reports.html?mode=legacy');
  await page.getByRole('button', { name: 'Add missing payment details' }).click();
  await expect(page.getByLabel('Amount', { exact: false })).toHaveValue('75');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await expect(page.getByText(/actual payment date and method/)).toBeVisible();
  await page.getByRole('button', { name: /back/i }).click();
  await expect(page.locator('output')).toHaveText('No payment changes');
  await expect(page.getByRole('switch', { name: 'Mark as paid', exact: true })).toBeChecked();
});
test('marking an unpaid invoice paid asks for details instead of changing its status immediately', async ({ page }) => {
  await page.goto('/e2e/fixtures/reports.html?mode=status');
  await page.getByRole('switch', { name: 'Mark as paid', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Record payment', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Amount', { exact: false })).toHaveValue('100');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /back/i }).click();
  await expect(page.getByRole('switch', { name: 'Mark as paid', exact: true })).not.toBeChecked();
});

test('records a confirmed historical date and partial amount without assuming today', async ({ page }) => {
  await page.goto('/e2e/fixtures/reports.html?mode=legacy');
  await page.getByRole('button', { name: 'Add missing payment details' }).click();
  await page.getByLabel('Amount', { exact: false }).fill('25');
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Bank', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /choose date/i }).click();
  await page.getByRole('gridcell', { name: '15', exact: true }).click();
  await page.getByLabel('Notes', { exact: true }).fill('Historical receipt');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('output')).toContainText('2026-10-15');
  await expect(page.locator('output')).toContainText('"paidAmount":25');
  await expect(page.locator('output')).toContainText('"paymentMethod":"Bank"');
  await expect(page.getByRole('switch', { name: 'Mark as paid', exact: true })).toBeChecked();
});

test('a rejected batch requires refresh before retrying and does not change balances', async ({ page }) => {
  await page.goto('/e2e/fixtures/reports.html?mode=billing&failBatch=1');
  await page.getByLabel('Client', { exact: true }).selectOption('2');
  const rows = page.getByRole('listbox', { name: 'Invoices by date' }).getByRole('option');
  await rows.first().click();
  await page.getByRole('button', { name: 'Record payment', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Record payment across selected invoices' });
  await modal.getByLabel('Payment method').selectOption('Bank');
  await modal.getByRole('button', { name: 'Record payments', exact: true }).click();
  await expect(modal.getByRole('alert').last()).toContainText('changed after the preview');
  await expect(modal.getByRole('button', { name: 'Record payments', exact: true })).toHaveCount(0);
  await modal.getByRole('button', { name: 'Refresh invoices' }).click();
  await expect(modal).toHaveCount(0);
  await expect(rows.first()).toContainText('Outstanding: 100.00 USD');
});
