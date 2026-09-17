// @vitest-environment node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { expect, it, vi } from 'vitest';
import { createBillingPeriodPdf } from '../pages/invoices/createBillingPeriodPdf';
import { buildBillingPeriod } from '../shared/utils/billingPeriod';
import { FontFamily } from '../shared/enums/fontFamily';
import { PageFormat } from '../shared/enums/pageFormat';
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

it.each([FontFamily.inter, FontFamily.helvetica, FontFamily.timesRoman, FontFamily.courier])(
  'embeds the saved logo once and uses the %s style on a compact letter statement',
  async fontFamily => {
    const first = invoice(1);
    const logo = process.env.BILLING_LOGO_SAMPLE
      ? await readFile(process.env.BILLING_LOGO_SAMPLE)
      : await readFile(resolve('src/renderer/assets/icon.png'));
    first.invoiceBusinessSnapshot = {
      ...first.invoiceBusinessSnapshot!,
      businessLogo: new Uint8Array(logo),
      businessFileType: 'image/png',
      businessName: 'Northline Studio',
      businessRole: 'Design & consulting',
      businessAddress: '100 Market Street, Seattle, WA',
      businessEmail: 'hello@example.com'
    };
    first.invoiceCustomization = {
      color: '#216365',
      fontFamily,
      pageFormat: PageFormat.letter,
      fieldSortOrders: { no: 0, item: 1, unit: 2, quantity: 3, unitCost: 4, total: 5 }
    };
    const period = buildBillingPeriod([first, ...Array.from({ length: 6 }, (_, i) => invoice(i + 2))], settings);
    const before = structuredClone(period);
    const bytes = new Uint8Array(await (await createBillingPeriodPdf(period, settings)).arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPage(0).getWidth()).toBe(612);
    expect(doc.getPage(0).getHeight()).toBe(792);
    const images = doc.context
      .enumerateIndirectObjects()
      .filter(([, obj]) => obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'));
    expect(images.length).toBeGreaterThan(0);
    expect(images.length).toBeLessThanOrEqual(2); // A transparent PNG may have an alpha mask.
    expect(period).toEqual(before);
    if (process.env.BILLING_PDF_OUTPUT && fontFamily === FontFamily.inter) {
      await mkdir(process.env.BILLING_PDF_OUTPUT, { recursive: true });
      await writeFile(resolve(process.env.BILLING_PDF_OUTPUT, 'billing-period-branded.pdf'), bytes);
    }
  },
  30000
);

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
