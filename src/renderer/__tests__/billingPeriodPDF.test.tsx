// @vitest-environment node
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { expect, it, vi } from 'vitest';
import { createBillingPeriodPdf } from '../pages/invoices/createBillingPeriodPdf';
import { buildBillingPeriod } from '../shared/utils/billingPeriod';
import { invoice, settings } from './billingPeriodFixtures';

vi.mock('../assets/roboto/Roboto-Regular.ttf', () => ({
  default: resolve('src/renderer/assets/roboto/Roboto-Regular.ttf')
}));
vi.mock('../assets/roboto/Roboto-Bold.ttf', () => ({ default: resolve('src/renderer/assets/roboto/Roboto-Bold.ttf') }));

it('exports all seven daily invoices to a valid paginated PDF', async () => {
  const period = buildBillingPeriod(
    Array.from({ length: 7 }, (_, index) => invoice(index + 1)),
    settings
  );
  const blob = await createBillingPeriodPdf(period, settings);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const document = await PDFDocument.load(bytes);
  expect(document.getPageCount()).toBeGreaterThan(0);
  expect(document.getTitle()).toBe('Billing period 2026-09-01 to 2026-09-07');
  // Optional evidence output for visual inspection without leaving files in normal test runs.
  if (process.env.BILLING_PDF_OUTPUT) {
    await mkdir(process.env.BILLING_PDF_OUTPUT, { recursive: true });
    await writeFile(resolve(process.env.BILLING_PDF_OUTPUT, 'billing-period-sample.pdf'), bytes);
  }
}, 30000);

it('paginates long invoices and long item descriptions', async () => {
  const longInvoice = invoice(1);
  longInvoice.invoiceItems = Array.from({ length: 80 }, (_, index) => ({
    ...longInvoice.invoiceItems[0],
    id: index + 1,
    invoiceItemSnapshot: {
      ...longInvoice.invoiceItems[0].invoiceItemSnapshot,
      itemName: `Work item ${index + 1}: Detailed consultation and implementation for a multi-day client engagement.`
    }
  }));
  const period = buildBillingPeriod([longInvoice, invoice(2)], settings);
  const blob = await createBillingPeriodPdf(period, settings);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(2);
  if (process.env.BILLING_PDF_OUTPUT)
    await writeFile(resolve(process.env.BILLING_PDF_OUTPUT, 'billing-period-long.pdf'), bytes);
}, 30000);

it('allows a single oversized description to continue onto another page', async () => {
  const longInvoice = invoice(1);
  longInvoice.invoiceItems[0].invoiceItemSnapshot.itemName = 'Long service description. '.repeat(1500);
  const period = buildBillingPeriod([longInvoice, invoice(2)], settings);
  const blob = await createBillingPeriodPdf(period, settings);
  const document = await PDFDocument.load(await blob.arrayBuffer());
  expect(document.getPageCount()).toBeGreaterThan(2);
}, 30000);
