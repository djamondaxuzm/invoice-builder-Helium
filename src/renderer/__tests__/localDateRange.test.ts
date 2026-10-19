import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import { DateFormat } from '../shared/enums/dateFormat';
import { formatDate, localDateRange } from '../shared/utils/formatFunctions';
import { aggregateInvoicesByCurrency } from '../shared/utils/invoiceFunctions';
import { ReportDateType } from '../shared/enums/reportDateType';
import { invoice } from './billingPeriodFixtures';

describe('local calendar ranges', () => {
  it.each(['2026-03-08', '2026-11-01', '2026-09-14'])('includes the entire selected day %s', date => {
    const range = localDateRange(date, date);
    expect(dayjs(range.from).format('YYYY-MM-DD HH:mm:ss.SSS')).toBe(`${date} 00:00:00.000`);
    expect(dayjs(range.to).format('YYYY-MM-DD HH:mm:ss.SSS')).toBe(`${date} 23:59:59.999`);
    const selected = new Date(`${date}T23:59:59.999`);
    const next = new Date(selected.getTime() + 1);
    const result = aggregateInvoicesByCurrency(
      [invoice(1, { issuedAt: selected.toISOString() }), invoice(2, { issuedAt: next.toISOString() })],
      range.from,
      range.to,
      ReportDateType.issuedAt
    );
    expect(result.USD).toBeDefined();
    // Exactly the last invoice of the selected day should remain.
    expect(result.USD.invoiceCount).toBe(1);
    expect(result.USD.issuedAt).toBe(selected.toISOString());
  });
  it.each(Object.values(DateFormat))('matches picker and printed dates for %s', pattern => {
    const date = '2026-09-23T12:30:00';
    expect(dayjs(date).format(pattern.toUpperCase())).toBe(formatDate(date, pattern));
  });
});
