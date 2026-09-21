// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { expect, it, vi } from 'vitest';
import { createBillingPeriodPdf } from '../pages/invoices/createBillingPeriodPdf';
import { buildBillingPeriod } from '../shared/utils/billingPeriod';
import { InvoiceItemTaxType } from '../shared/enums/taxType';
import { invoice, settings } from './billingPeriodFixtures';
vi.mock('../assets/roboto/Roboto-Regular.ttf', () => ({
  default: resolve('src/renderer/assets/roboto/Roboto-Regular.ttf')
}));
vi.mock('../assets/roboto/Roboto-Bold.ttf', () => ({ default: resolve('src/renderer/assets/roboto/Roboto-Bold.ttf') }));
vi.mock('../assets/inter/Inter_18pt-Regular.ttf', () => ({
  default: resolve('src/renderer/assets/inter/Inter_18pt-Regular.ttf')
}));
vi.mock('../assets/inter/Inter_18pt-Bold.ttf', () => ({
  default: resolve('src/renderer/assets/inter/Inter_18pt-Bold.ttf')
}));
it('adds receipt pages without counting receipts as charges or modifying invoices', async () => {
  const first = invoice(1);
  first.customerNotes = 'Completed work and delivered materials.';
  first.invoiceItems[0].taxType = InvoiceItemTaxType.exclusive;
  first.invoiceItems[0].taxRate = 10;
  first.invoicePayments = [{ amountCents: '2500' } as (typeof first.invoicePayments)[number]];
  const data = new Uint8Array(await readFile(resolve('src/renderer/assets/icon.png')));
  first.invoiceAttachments = [{ fileName: 'receipt.png', fileSize: data.length, fileType: 'image/png', data }];
  const period = buildBillingPeriod([invoice(2), first], settings);
  expect(period.total).toBe(21000);
  expect(period.balance).toBe(18500);
  const before = structuredClone(period);
  const pdf = await PDFDocument.load(await (await createBillingPeriodPdf(period, settings)).arrayBuffer());
  expect(pdf.getPageCount()).toBe(4); // invoice, receipt, invoice, summary
  expect(period).toEqual(before);
}, 30000);
it('reports unsupported attachments instead of silently dropping them', async () => {
  const first = invoice(1);
  first.invoiceAttachments = [
    { fileName: 'receipt.pdf', fileSize: 3, fileType: 'application/pdf', data: new Uint8Array([1, 2, 3]) }
  ];
  await expect(createBillingPeriodPdf(buildBillingPeriod([first, invoice(2)], settings), settings)).rejects.toThrow(
    'unsupported attachment'
  );
});
