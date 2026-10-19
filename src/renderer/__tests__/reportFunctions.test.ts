import { describe, expect, it } from 'vitest';
import { invoice } from './billingPeriodFixtures';
import { InvoiceStatus } from '../shared/enums/invoiceStatus';
import { InvoiceType } from '../shared/enums/invoiceType';
import { InvoiceItemTaxType, InvoiceTaxType } from '../shared/enums/taxType';
import { DiscountType } from '../shared/enums/discountType';
import { PaymentType } from '../shared/enums/paymentType';
import { ReportRangeType } from '../shared/enums/reportRangeType';
import { buildReport, getReportOptions, getReportRange, reportCsv, reportDay } from '../shared/utils/reportFunctions';
import { localDateRange } from '../shared/utils/formatFunctions';
import type { Invoice } from '../shared/types/invoice';

const currency = { value: 'USD:100', code: 'USD', subunit: 100, label: 'USD' };
const today = new Date('2026-10-18T12:00:00');
const range = localDateRange('2026-10-01', '2026-10-18');
const payment = (amount: string, date = '2026-10-18', method = PaymentType.bank) => ({
  amountCents: amount,
  paidAt: date,
  paymentMethod: method
});
const report = (invoices: Invoice[], dates = range) => buildReport(invoices, dates, currency, {}, today);

describe('report calendar ranges', () => {
  it.each(['2026-03-08', '2026-11-01', '2026-10-18'])(
    'includes all of today and exactly 30 local days across %s',
    day => {
      const now = new Date(`${day}T12:00:00`);
      const dates = getReportRange(ReportRangeType.last_30_days, now);
      const start = new Date(dates.from),
        end = new Date(dates.to);
      const result = buildReport(
        [
          invoice(1, { issuedAt: new Date(start.getTime() - 1).toISOString() }),
          invoice(2, { issuedAt: start.toISOString() }),
          invoice(3, { issuedAt: end.toISOString() }),
          invoice(4, { issuedAt: new Date(end.getTime() + 1).toISOString() })
        ],
        dates,
        currency,
        {},
        now
      );
      expect(result.invoiceCount).toBe(2);
      expect(result.trend).toHaveLength(30);
      expect(result.trend[0].billed).toBe(100);
      expect(result.trend.at(-1)).toEqual({ date: day, billed: 100, payments: 0 });
      expect(result.billed).toBe(200);
    }
  );
  it('handles leap years and quarter/year boundaries', () => {
    expect(reportDay(getReportRange(ReportRangeType.last_month, new Date('2024-03-31T12:00:00')).to)).toBe(
      '2024-02-29'
    );
    const dates = getReportRange(ReportRangeType.last_quarter, new Date('2026-01-01T12:00:00'));
    expect(reportDay(dates.from)).toBe('2025-10-01');
    expect(reportDay(dates.to)).toBe('2025-12-31');
  });
  it('fills empty days and groups long ranges without losing partial-month boundaries', () => {
    const result = report(
      [
        invoice(1, { issuedAt: '2026-01-01' }),
        invoice(2, { issuedAt: '2026-01-15' }),
        invoice(3, { issuedAt: '2026-05-15' }),
        invoice(4, { issuedAt: '2026-05-16' })
      ],
      localDateRange('2026-01-15', '2026-05-15')
    );
    expect(result.monthly).toBe(true);
    expect(result.trend).toHaveLength(5);
    expect(result.trend.map(p => p.billed)).toEqual([100, 0, 0, 0, 100]);
  });
});

describe('reconciled invoice and cash reporting', () => {
  it('uses each payment date, includes old-invoice payments, and excludes manual Paid from cash', () => {
    const result = report([
      invoice(1, {
        issuedAt: '2026-10-18',
        invoicePayments: [payment('2500', '2026-10-01'), payment('7500', '2026-10-18')]
      }),
      invoice(2, {
        issuedAt: '2026-08-01',
        invoicePayments: [payment('1000', '2026-09-30'), payment('4000', '2026-10-18', PaymentType.cash)]
      }),
      invoice(3, { issuedAt: '2026-10-05', status: InvoiceStatus.paid, paidAt: '2026-10-06' })
    ]);
    expect(result.billed).toBe(200);
    expect(result.payments).toBe(140);
    expect(result.invoiceCount).toBe(2);
    expect(result.paymentRows).toHaveLength(3);
    expect(result.markedPaid).toBe(100);
    expect(result.collectionRate).toBe(100);
    expect(result.averageInvoice).toBe(100);
    expect(result.outstanding).toBe(50);
    expect(result.trend.reduce((n, p) => n + p.payments, 0)).toBe(result.payments);
    expect(result.methods.reduce((n, p) => n + p.amount, 0)).toBe(result.payments);
    expect(result.clients.reduce((n, p) => n + p.payments, 0)).toBe(result.payments);
  });
  it('never offsets another invoice with overpayment or calls a paid invoice overdue', () => {
    const result = report([
      invoice(1, { issuedAt: '2026-10-01', dueDate: '2026-10-01', invoicePayments: [payment('15000')] }),
      invoice(2, { issuedAt: '2026-10-02', dueDate: '2026-10-01' }),
      invoice(3, { issuedAt: '2026-10-03', dueDate: '2026-10-01', status: InvoiceStatus.paid }),
      invoice(4, { issuedAt: '2026-10-04', dueDate: '2026-10-18', invoicePayments: [payment('5000')] })
    ]);
    expect(result.outstanding).toBe(150);
    expect(result.credit).toBe(50);
    expect(result.overdueCount).toBe(1);
    expect(result.overdue).toBe(100);
    expect(result.collectionRate).toBe(62.5);
    expect(result.statuses.map(s => s.count)).toEqual([1, 1, 2]);
    expect(result.aging.reduce((n, p) => n + p.amount, 0)).toBe(result.outstanding);
  });
  it('retains archives, excludes quotations, uses client IDs and currency snapshots rather than names/IDs', () => {
    const rows = [
      invoice(1, { issuedAt: '2026-10-18', clientId: 1, currencyId: 10, isArchived: true }),
      invoice(2, { issuedAt: '2026-10-18', clientId: 2, currencyId: 11 }),
      invoice(3, { issuedAt: '2026-10-18', invoiceType: InvoiceType.quotation }),
      invoice(4, {
        issuedAt: '2026-10-18',
        invoiceCurrencySnapshot: { currencyCode: 'EUR', currencySubunit: 100, currencySymbol: '€' }
      }),
      invoice(5, {
        issuedAt: '2026-10-18',
        invoiceCurrencySnapshot: { currencyCode: 'USD', currencySubunit: 1000, currencySymbol: '$' }
      })
    ];
    const result = report(rows);
    expect(result.billed).toBe(200);
    expect(result.clients).toHaveLength(2);
    const options = getReportOptions(rows);
    expect(options.currencies).toHaveLength(3);
    expect(options.clients.map(c => c.label)).toEqual(['Example Client (#1)', 'Example Client (#2)']);
    expect(buildReport(rows, range, currency, { clientId: 1, businessId: 1 }, today).billed).toBe(100);
    expect(buildReport(rows, range, currency, { businessId: 999 }, today).billed).toBe(0);
  });
  it.each([1, 100, 1000])('rounds once per invoice and respects currency subunit %s', subunit => {
    const rows = Array.from({ length: 10 }, (_, index) =>
      invoice(index + 1, {
        issuedAt: '2026-10-18',
        invoiceCurrencySnapshot: { currencyCode: 'USD', currencySubunit: subunit, currencySymbol: '$' },
        invoiceItems: [
          {
            itemId: 1,
            quantity: '0.5',
            taxRate: 0,
            invoiceItemSnapshot: { parentInvoiceItemId: 1, itemName: 'Fractional', unitPriceCents: '101' }
          }
        ]
      })
    );
    const result = buildReport(rows, range, { ...currency, value: `USD:${subunit}`, subunit }, {}, today);
    expect(result.billed).toBe(510 / subunit);
    expect(result.trend.at(-1)?.billed).toBe(result.billed);
  });
  it('does not settle current balances using future payments', () => {
    const result = report([
      invoice(1, {
        issuedAt: '2026-10-01',
        status: InvoiceStatus.paid,
        invoicePayments: [payment('10000', '2026-10-20')]
      })
    ]);
    expect(result.payments).toBe(0);
    expect(result.outstanding).toBe(100);
  });
  it('warns on invalid records, does not invent payment dates, and rejects invalid ranges', () => {
    const result = report([
      invoice(1, { issuedAt: '2026-10-18', invoicePayments: [payment('2500', ''), payment('NaN')] }),
      invoice(2, { issuedAt: 'bad date' }),
      invoice(3, { invoiceCurrencySnapshot: undefined }),
      invoice(4, { issuedAt: '2026-10-18', shippingFeeCents: 'NaN' })
    ]);
    expect(result.payments).toBe(0);
    expect(result.outstanding).toBe(75);
    expect(result.warnings).toHaveLength(5);
    expect(() => report([], { from: '2026-10-20', to: '2026-10-01' })).toThrow();
    expect(() => report([], { from: 'bad', to: '2026-10-01' })).toThrow();
  });
  it('escapes CSV fields and spreadsheet formula prefixes', () => {
    expect(reportCsv([['=1+1', 'a,"b', '-client', 25, -25]])).toBe('\uFEFF"\'=1+1","a,""b","\'-client","25","-25"');
  });
  it('reconciles item-level tax separately from invoice-level tax and shipping', () => {
    const result = report([
      invoice(1, {
        issuedAt: '2026-10-18',
        discountType: DiscountType.percentage,
        discountPercent: 10,
        taxType: InvoiceTaxType.exclusive,
        taxRate: 5,
        shippingFeeCents: '500',
        invoiceItems: [
          {
            itemId: 1,
            quantity: '2',
            taxRate: 10,
            taxType: InvoiceItemTaxType.exclusive,
            invoiceItemSnapshot: { parentInvoiceItemId: 1, itemName: 'Labor', unitPriceCents: '10000' }
          }
        ]
      })
    ]);
    expect(result.items[0].amount).toBe(198);
    expect(result.billed).toBe(212);
  });
  it('keeps a partial historical backfill settled without double-counting cash or failing on a legacy null date', () => {
    const result = report([
      invoice(1, {
        issuedAt: '2026-10-18',
        status: InvoiceStatus.paid,
        invoicePayments: [payment('2500'), payment('3000', null as unknown as string)]
      })
    ]);
    expect(result.billed).toBe(100);
    expect(result.payments).toBe(25);
    expect(result.markedPaid).toBe(45);
    expect(result.outstanding).toBe(0);
    expect(result.settled).toBe(100);
    expect(result.warnings).toHaveLength(1);
  });
});
