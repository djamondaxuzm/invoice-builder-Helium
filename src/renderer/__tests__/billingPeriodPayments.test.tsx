// @vitest-environment node
import { Children, isValidElement, type ReactNode } from 'react';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { expect, it, vi } from 'vitest';
import { BillingPeriodPDF } from '../pages/invoices/BillingPeriodPDF';
import { createBillingPeriodPdf } from '../pages/invoices/createBillingPeriodPdf';
import { buildBillingPeriod } from '../shared/utils/billingPeriod';
import { InvoiceStatus } from '../shared/enums/invoiceStatus';
import { InvoiceItemTaxType } from '../shared/enums/taxType';
import { PaymentType } from '../shared/enums/paymentType';
import { DateFormat } from '../shared/enums/dateFormat';
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

const payment = (amountCents: string) => ({ amountCents, paidAt: '2026-09-01', paymentMethod: PaymentType.cash });
const partial = () =>
  invoice(3, {
    status: InvoiceStatus.partiallyPaid,
    invoicePayments: [payment('7250')],
    invoiceItems: [
      {
        ...invoice(3).invoiceItems[0],
        quantity: '1.25',
        invoiceItemSnapshot: { parentInvoiceItemId: 1, itemName: 'Service', unitPriceCents: '7500' }
      },
      ...['5299', '1599'].map((price, i) => ({
        itemId: i + 2,
        quantity: '1',
        taxRate: 9.25,
        taxType: InvoiceItemTaxType.exclusive,
        invoiceItemSnapshot: { parentInvoiceItemId: i + 2, itemName: 'Materials', unitPriceCents: price }
      }))
    ]
  });
const text = (node: ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join(' ');
  if (isValidElement<{ children?: ReactNode }>(node)) return text(node.props.children);
  return '';
};
const pageText = (period: ReturnType<typeof buildBillingPeriod>) =>
  Children.toArray(BillingPeriodPDF({ period, settings }).props.children).map(page => text(page).replace(/\s+/g, ' '));

it('reconciles fractional quantities and item taxes to the remaining balance on invoice and summary pages', async () => {
  const invoices = [invoice(1, { status: InvoiceStatus.paid }), partial()];
  const before = structuredClone(invoices);
  const period = buildBillingPeriod(invoices, settings);
  expect(period.rows[1]).toMatchObject({ total: 16911, paid: 7250, balance: 9661, paymentStatus: 'PARTIALLY PAID' });
  expect(period).toMatchObject({ total: 26911, paid: 17250, balance: 9661 });
  const pages = pageText(period);
  expect(pages[0]).toContain('PAID IN FULL');
  expect(pages[0]).toContain('Paid / settled $100.00 Balance due $0.00');
  expect(pages[1]).toContain('PARTIALLY PAID');
  expect(pages[1]).toContain('Invoice 003 total (incl. tax) $169.11 Paid / settled $72.50 Balance due $96.61');
  expect(pages[2]).toContain('003 PARTIALLY PAID 2026-09-03 $169.11 $72.50 $96.61');
  expect(pages[2]).toContain('BALANCE DUE Balance due for all 2 invoices $96.61');
  const bytes = new Uint8Array(await (await createBillingPeriodPdf(period, settings)).arrayBuffer());
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(3);
  expect(invoices).toEqual(before);
  if (process.env.BILLING_PDF_OUTPUT) {
    await mkdir(process.env.BILLING_PDF_OUTPUT, { recursive: true });
    await writeFile(resolve(process.env.BILLING_PDF_OUTPUT, 'billing-partial-payment.pdf'), bytes);
  }
}, 30000);

it.each([
  ['no dated ledger', []],
  ['incomplete dated ledger', [payment('2500')]]
])('keeps legacy marked-paid invoices settled with %s', (_, payments) => {
  const period = buildBillingPeriod(
    [invoice(1, { status: InvoiceStatus.paid, invoicePayments: payments }), invoice(2, { status: InvoiceStatus.paid })],
    settings
  );
  expect(period.rows.every(row => row.balance === 0 && row.paid === 10000)).toBe(true);
  const summary = pageText(period).at(-1)!;
  expect(summary).toContain('PAID IN FULL No payment is due for these invoices. $0.00');
  expect(period.rows[0].invoice.invoicePayments).toEqual(payments);
});

it.each([
  [[], 'UNPAID', 10000],
  [[payment('2500')], 'PARTIALLY PAID', 7500],
  [[payment('10000')], 'PAID IN FULL', 0],
  [[payment('30000')], 'CREDIT', -20000]
])(
  'derives the displayed status from recorded amounts even if the saved status is stale',
  (payments, status, balance) => {
    const period = buildBillingPeriod(
      [invoice(1, { status: InvoiceStatus.unpaid, invoicePayments: payments }), invoice(2)],
      settings
    );
    expect(period.rows[0]).toMatchObject({ paymentStatus: status, balance });
    expect(period.balance).toBe(period.rows.reduce((sum, row) => sum + row.balance, 0));
    if (balance < 0) {
      const pages = pageText(period);
      expect(pages[0]).toContain('Credit balance $200.00');
      expect(pages[2]).toContain('$100.00 $300.00 $-200.00');
      expect(pages[2]).toContain('CREDIT BALANCE Credit balance for all 2 invoices $100.00');
    }
  }
);

it('shows zero-value invoices without inventing a payment', () => {
  const zero = invoice(1, { invoiceItems: [] });
  const period = buildBillingPeriod([zero, invoice(2)], settings);
  expect(period.rows[0]).toMatchObject({ total: 0, paid: 0, balance: 0, paymentStatus: 'NO BALANCE DUE' });
});

it.each([PageFormat.a4, PageFormat.letter])(
  'renders paid and credit statements in %s with an explicit final balance',
  async pageFormat => {
    for (const credit of [false, true]) {
      const first = invoice(1, { status: InvoiceStatus.paid, invoicePayments: credit ? [payment('30000')] : [] });
      first.invoiceCustomization = {
        pageFormat,
        fontFamily: FontFamily.inter,
        fieldSortOrders: { no: 0, item: 1, unit: 2, quantity: 3, unitCost: 4, total: 5 }
      };
      const period = buildBillingPeriod([first, invoice(2, { status: InvoiceStatus.paid })], settings);
      const bytes = new Uint8Array(
        await (await createBillingPeriodPdf(period, { ...settings, dateFormat: DateFormat.MMddyyyy })).arrayBuffer()
      );
      expect((await PDFDocument.load(bytes)).getPageCount()).toBe(3);
      if (process.env.BILLING_PDF_OUTPUT)
        await writeFile(
          resolve(process.env.BILLING_PDF_OUTPUT, 'billing-' + (credit ? 'credit-' : 'paid-') + pageFormat + '.pdf'),
          bytes
        );
    }
  },
  30000
);
