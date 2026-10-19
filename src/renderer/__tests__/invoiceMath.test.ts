import { describe, expect, it } from 'vitest';
import { invoice } from './billingPeriodFixtures';
import { DiscountType } from '../shared/enums/discountType';
import { InvoiceItemTaxType, InvoiceTaxType } from '../shared/enums/taxType';
import { getFinancialData, getInvoiceTotal } from '../shared/utils/invoiceFunctions';
import { allocatePayment, getPaymentBalance } from '../../backend/shared/utils/paymentAllocation';
import { InvoiceStatus } from '../shared/enums/invoiceStatus';
import { PaymentType } from '../shared/enums/paymentType';

describe('shared invoice totals', () => {
  const item = (taxType?: InvoiceItemTaxType, taxRate = 10, price = '10000', quantity = '1') => ({
    ...invoice(1).invoiceItems[0],
    taxType,
    taxRate,
    quantity,
    invoiceItemSnapshot: { ...invoice(1).invoiceItems[0].invoiceItemSnapshot, unitPriceCents: price }
  });
  it.each([
    ['exclusive invoice tax', [item()], InvoiceTaxType.exclusive, 11000],
    ['inclusive invoice tax', [item()], InvoiceTaxType.inclusive, 10000],
    ['deducted invoice tax', [item()], InvoiceTaxType.deducted, 9000],
    [
      'mixed inclusive and exclusive lines',
      [item(InvoiceItemTaxType.inclusive), item(InvoiceItemTaxType.exclusive)],
      undefined,
      21000
    ],
    ['inclusive invoice with exclusive line', [item(InvoiceItemTaxType.exclusive)], InvoiceTaxType.inclusive, 11000],
    ['exclusive invoice with inclusive line', [item(InvoiceItemTaxType.inclusive)], InvoiceTaxType.exclusive, 11000]
  ] as const)('%s agrees across PDF and reporting', (_, invoiceItems, taxType, expected) => {
    const input = { invoiceItems: [...invoiceItems], taxType, taxRate: 10 };
    expect(getInvoiceTotal(input)).toBe(expected);
    expect(getFinancialData({ ...input, invoicePayments: [] }).totalAmount).toBe(expected);
  });
  it('calculates discounts, shipping, surcharges and fractional quantities independently', () => {
    // 2.5 * $80 = $200; 10% discount => $180; 10% tax + 5% surcharge + $12 shipping => $219.
    const input = {
      invoiceItems: [item(undefined, 0, '8000', '2.5')],
      taxRate: 10,
      taxType: InvoiceTaxType.exclusive,
      discountType: DiscountType.percentage,
      discountPercent: 10,
      surchargeType: DiscountType.percentage,
      surchargePercent: 5,
      shippingFee: 1200
    };
    expect(getInvoiceTotal(input)).toBe(21900);
    expect(getFinancialData({ ...input, shippingAmount: 1200, invoicePayments: [] }).totalAmount).toBe(21900);
    expect(getInvoiceTotal({ ...input, discountType: DiscountType.fixed, discountAmount: 2000 })).toBe(21900);
  });
  it('rounds fractional cents before deciding whether an invoice is fully paid', () => {
    const data = invoice(1, {
      invoiceItems: [item(undefined, 0, '101', '0.499')],
      invoicePayments: [{ amountCents: '50', paidAt: '2026-10-18', paymentMethod: PaymentType.cash }]
    });
    expect(getPaymentBalance(data)).toEqual({ total: 50, paid: 50, remaining: 0, unrecorded: 0 });
  });
});

describe('bulk allocations', () => {
  it('allocates oldest first, preserves previous payments, skips marked-paid invoices and leaves partial balances', () => {
    const rows = [
      invoice(3),
      invoice(2, { invoicePayments: [{ amountCents: '2500', paidAt: '2026-09-01', paymentMethod: PaymentType.cash }] }),
      invoice(1),
      invoice(4, { status: InvoiceStatus.paid })
    ];
    const allocation = allocatePayment(rows, 20000);
    expect(allocation.map(row => [row.invoiceId, row.amountCents])).toEqual([
      [1, 10000],
      [2, 7500],
      [3, 2500]
    ]);
    expect(allocation[1].expectedPaidCents).toBe(2500);
  });
  it.each([0, -1, 0.5, NaN, Infinity, 10001])('rejects invalid or excessive payment %s', amount => {
    expect(() => allocatePayment([invoice(1)], amount)).toThrow();
  });
  it('rejects mixed clients, businesses, currencies, duplicates and missing dates', () => {
    expect(() => allocatePayment([invoice(1), invoice(2, { clientId: 99 })])).toThrow();
    expect(() => allocatePayment([invoice(1), invoice(2, { businessId: 99 })])).toThrow();
    expect(() =>
      allocatePayment([
        invoice(1),
        invoice(2, { invoiceCurrencySnapshot: { currencyCode: 'EUR', currencySymbol: '€', currencySubunit: 100 } })
      ])
    ).toThrow();
    expect(() => allocatePayment([invoice(1), invoice(1)])).toThrow();
    expect(() => allocatePayment([invoice(1, { issuedAt: '' })])).toThrow();
  });
  it('preserves legacy marked-paid balances but exposes only the missing recorded amount', () => {
    const data = invoice(1, {
      status: InvoiceStatus.paid,
      paidAt: undefined,
      invoicePayments: [{ amountCents: '2500', paidAt: '2026-09-01', paymentMethod: PaymentType.cash }]
    });
    expect(getPaymentBalance(data)).toEqual({ total: 10000, paid: 2500, remaining: 0, unrecorded: 7500 });
    expect(() => allocatePayment([data])).toThrow();
  });
});
