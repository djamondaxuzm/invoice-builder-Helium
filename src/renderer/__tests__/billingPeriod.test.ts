import { describe, expect, it } from 'vitest';
import { DiscountType } from '../shared/enums/discountType';
import { InvoiceStatus } from '../shared/enums/invoiceStatus';
import { InvoiceType } from '../shared/enums/invoiceType';
import { InvoiceTaxType } from '../shared/enums/taxType';
import type { Invoice } from '../shared/types/invoice';
import {
  billingDate,
  billingSelectionError,
  buildBillingPeriod,
  splitBillingDescription
} from '../shared/utils/billingPeriod';

import { invoice, settings } from './billingPeriodFixtures';

describe('billing periods', () => {
  it('preserves oversized descriptions while splitting them into page-sized rows', () => {
    for (const description of ['Detailed service work. '.repeat(1000), 'W'.repeat(1500), 'Line\n'.repeat(100), '']) {
      const parts = splitBillingDescription(description);
      expect(parts.join('')).toBe(description);
      expect(parts.every(part => part.length <= 601)).toBe(true);
      expect(parts.every(part => (part.match(/\n/g)?.length ?? 0) <= 10)).toBe(true);
    }
  });
  it('combines 001–007 chronologically without changing the originals', () => {
    const invoices = Array.from({ length: 7 }, (_, index) => invoice(index + 1)).reverse();
    const original = structuredClone(invoices);
    const period = buildBillingPeriod(invoices, settings);
    expect(period.rows.map(row => row.invoice.invoiceNumber)).toEqual([
      '001',
      '002',
      '003',
      '004',
      '005',
      '006',
      '007'
    ]);
    expect(period).toMatchObject({ total: 70000, paid: 0, balance: 70000, from: '2026-09-01', to: '2026-09-07' });
    expect(invoices).toEqual(original);
  });
  it('includes discount, tax, shipping and surcharge using the invoice calculator', () => {
    const period = buildBillingPeriod(
      [
        invoice(1, {
          discountType: DiscountType.fixed,
          discountAmountCents: '1000',
          taxType: InvoiceTaxType.exclusive,
          taxRate: 10,
          shippingFeeCents: '500',
          surchargeType: DiscountType.fixed,
          surchargeAmountCents: '200'
        }),
        invoice(2)
      ],
      settings
    );
    expect(period.total).toBe(20600);
  });
  it('counts recorded payments and paid status without confusing total with balance', () => {
    const period = buildBillingPeriod(
      [
        invoice(1, { status: InvoiceStatus.paid }),
        invoice(2, { invoicePayments: [{ amountCents: '2500' } as Invoice['invoicePayments'][number]] })
      ],
      settings
    );
    expect(period).toMatchObject({ total: 20000, paid: 12500, balance: 7500 });
  });
  it('preserves overpayments as a credit', () => {
    const period = buildBillingPeriod(
      [invoice(1, { invoicePayments: [{ amountCents: '30000' } as Invoice['invoicePayments'][number]] }), invoice(2)],
      settings
    );
    expect(period.balance).toBe(-10000);
  });
  it('rejects mixed clients, businesses, currencies and subunits', () => {
    for (const override of [
      { clientId: 8 },
      { businessId: 8 },
      { invoiceCurrencySnapshot: { currencyCode: 'EUR', currencySymbol: '€', currencySubunit: 100 } },
      { invoiceCurrencySnapshot: { currencyCode: 'USD', currencySymbol: '$', currencySubunit: 1000 } }
    ]) {
      expect(billingSelectionError([invoice(1), invoice(2, override)])).toBeDefined();
    }
  });
  it('rejects duplicate, missing, unsaved, quotation and invalid-date selections', () => {
    for (const invoices of [
      [],
      [invoice(1)],
      [invoice(1), invoice(1)],
      [invoice(1), invoice(2, { id: undefined })],
      [invoice(1), invoice(2, { invoiceType: InvoiceType.quotation })],
      [invoice(1), invoice(2, { issuedAt: 'invalid' })]
    ]) {
      expect(() => buildBillingPeriod(invoices, settings)).toThrow();
    }
  });
  it('matches local invoice calendar dates at UTC day boundaries', () => {
    expect(billingDate('2026-09-14')).toBe('2026-09-14');
    const local = new Date(2026, 8, 14, 23, 30);
    expect(billingDate(local.toISOString())).toBe('2026-09-14');
  });
  it('rounds fractional minor units per invoice before aggregation', () => {
    const period = buildBillingPeriod(
      [
        invoice(1, { taxType: InvoiceTaxType.exclusive, taxRate: 0.005 }),
        invoice(2, { taxType: InvoiceTaxType.exclusive, taxRate: 0.005 })
      ],
      settings
    );
    expect(period.total).toBe(20002);
  });
});
