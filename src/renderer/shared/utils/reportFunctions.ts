import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays,
  subMonths,
  subQuarters,
  subYears
} from 'date-fns';
import { InvoiceStatus } from '../enums/invoiceStatus';
import { InvoiceType } from '../enums/invoiceType';
import { ReportRangeType } from '../enums/reportRangeType';
import type { Invoice } from '../types/invoice';
import { localDateRange } from './formatFunctions';
import { getInvoiceItemTotal, getInvoiceTotal } from './invoiceFunctions';
import { roundMinorUnits } from '../../../backend/shared/utils/invoiceMath';

export interface ReportRange {
  from: string;
  to: string;
}
export interface ReportOption {
  value: string;
  label: string;
}
export interface ReportCurrency extends ReportOption {
  code: string;
  subunit: number;
}
export interface ReportClient {
  id: number;
  name: string;
  invoiceCount: number;
  billed: number;
  payments: number;
  outstanding: number;
  overdue: number;
  credit: number;
}
export interface ReportPayment {
  key: string;
  invoiceId: number;
  invoiceNumber: string;
  client: string;
  date: string;
  method: string;
  amount: number;
}
export interface ReportBucket {
  key: string;
  count: number;
  amount: number;
}
export interface ReportTrend {
  date: string;
  billed: number;
  payments: number;
}
export interface ReportInvoice {
  id: number;
  invoiceNumber: string;
  date: string;
  client: string;
  business: string;
  status: InvoiceStatus;
  archived: boolean;
  amount: number;
}
export interface ReportData {
  currency: ReportCurrency;
  invoiceCount: number;
  billed: number;
  payments: number;
  settled: number;
  markedPaid: number;
  periodOutstanding: number;
  outstanding: number;
  overdue: number;
  credit: number;
  overdueCount: number;
  averageInvoice: number;
  collectionRate: number;
  clients: ReportClient[];
  paymentRows: ReportPayment[];
  invoiceRows: ReportInvoice[];
  methods: ReportBucket[];
  aging: ReportBucket[];
  statuses: ReportBucket[];
  trend: ReportTrend[];
  monthly: boolean;
  items: { key: string; name: string; quantity: number; amount: number }[];
  warnings: string[];
}

export const reportDay = (value: string | Date | null | undefined): string => {
  const date = value instanceof Date ? value : typeof value === 'string' ? parseISO(value) : undefined;
  return date && Number.isFinite(date.getTime()) ? format(date, 'yyyy-MM-dd') : '';
};

export const getReportRange = (preset: ReportRangeType, now = new Date()): ReportRange => {
  switch (preset) {
    case ReportRangeType.last_30_days:
      return localDateRange(subDays(now, 29), now);
    case ReportRangeType.this_month:
      return localDateRange(startOfMonth(now), now);
    case ReportRangeType.last_month: {
      const date = subMonths(now, 1);
      return localDateRange(startOfMonth(date), endOfMonth(date));
    }
    case ReportRangeType.this_quarter:
      return localDateRange(startOfQuarter(now), now);
    case ReportRangeType.last_quarter: {
      const date = subQuarters(now, 1);
      return localDateRange(startOfQuarter(date), endOfQuarter(date));
    }
    case ReportRangeType.this_year:
      return localDateRange(startOfYear(now), now);
    case ReportRangeType.last_year: {
      const date = subYears(now, 1);
      return localDateRange(startOfYear(date), endOfYear(date));
    }
    default:
      return localDateRange(now, now);
  }
};

export const reportCurrency = (invoice: Invoice): ReportCurrency | undefined => {
  const snapshot = invoice.invoiceCurrencySnapshot;
  if (!snapshot?.currencyCode || !Number.isSafeInteger(snapshot.currencySubunit) || snapshot.currencySubunit <= 0)
    return undefined;
  const code = snapshot.currencyCode.trim().toUpperCase();
  if (!code) return undefined;
  return { value: `${code}:${snapshot.currencySubunit}`, label: code, code, subunit: snapshot.currencySubunit };
};

export const getReportOptions = (invoices: Invoice[]) => {
  const currencies = new Map<string, ReportCurrency>();
  const clients = new Map<number, ReportOption>();
  const businesses = new Map<number, ReportOption>();
  for (const invoice of invoices) {
    if (invoice.invoiceType !== InvoiceType.invoice) continue;
    const currency = reportCurrency(invoice);
    if (currency) currencies.set(currency.value, currency);
    clients.set(invoice.clientId, {
      value: String(invoice.clientId),
      label: invoice.invoiceClientSnapshot?.clientName || `Client #${invoice.clientId}`
    });
    businesses.set(invoice.businessId, {
      value: String(invoice.businessId),
      label: invoice.invoiceBusinessSnapshot?.businessName || `Business #${invoice.businessId}`
    });
  }
  const distinctLabels = (options: ReportOption[]) =>
    options
      .map(option => ({
        ...option,
        label: options.some(other => other.value !== option.value && other.label === option.label)
          ? `${option.label} (#${option.value})`
          : option.label
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  const currencyList = [...currencies.values()]
    .map(currency => ({
      ...currency,
      label: [...currencies.values()].some(other => other.code === currency.code && other.value !== currency.value)
        ? `${currency.code} (subunit ${currency.subunit})`
        : currency.code
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return {
    currencies: currencyList,
    clients: distinctLabels([...clients.values()]),
    businesses: distinctLabels([...businesses.values()])
  };
};

const money = roundMinorUnits;
const addMoney = (left: number, right: number) => money(left + right);

export const getReportTrend = (data: ReportTrend[], cumulative: boolean, subunit: number): ReportTrend[] => {
  if (!cumulative) return data;
  let billed = 0;
  let payments = 0;
  return data.map(point => {
    // Sum integer minor units so the final cumulative point exactly matches the cards.
    billed = addMoney(billed, money(point.billed * subunit));
    payments = addMoney(payments, money(point.payments * subunit));
    return { ...point, billed: billed / subunit, payments: payments / subunit };
  });
};

export const buildReport = (
  invoices: Invoice[],
  range: ReportRange,
  currency: ReportCurrency,
  filters: { clientId?: number; businessId?: number } = {},
  now = new Date()
): ReportData => {
  const from = reportDay(range.from),
    to = reportDay(range.to),
    today = reportDay(now);
  if (!from || !to || !today || from > to) throw new Error('Select a valid date range.');
  const span = differenceInCalendarDays(parseISO(to), parseISO(from));
  if (span > 36600) throw new Error('Select a date range of 100 years or less.');
  const monthly = span > 92;
  const trend = new Map<string, ReportTrend>();
  const bucketKey = (date: string) => (monthly ? `${date.slice(0, 7)}-01` : date);
  for (
    let date = monthly ? startOfMonth(parseISO(from)) : parseISO(from);
    reportDay(date) <= to;
    date = monthly ? addMonths(date, 1) : addDays(date, 1)
  ) {
    const key = reportDay(date);
    trend.set(key, { date: key, billed: 0, payments: 0 });
  }
  const clients = new Map<number, ReportClient>();
  const methods = new Map<string, ReportBucket>();
  const items = new Map<string, ReportData['items'][number]>();
  const aging = ['notDue', 'days1to30', 'days31to60', 'days61to90', 'daysOver90', 'noDueDate'].map(key => ({
    key,
    count: 0,
    amount: 0
  }));
  const statuses = ['unpaid', 'partial', 'settled'].map(key => ({ key, count: 0, amount: 0 }));
  const warnings = new Set<string>();
  const result: ReportData = {
    currency,
    invoiceCount: 0,
    billed: 0,
    payments: 0,
    settled: 0,
    markedPaid: 0,
    periodOutstanding: 0,
    outstanding: 0,
    overdue: 0,
    credit: 0,
    overdueCount: 0,
    averageInvoice: 0,
    collectionRate: 0,
    clients: [],
    paymentRows: [],
    invoiceRows: [],
    methods: [],
    aging,
    statuses,
    trend: [],
    monthly,
    items: [],
    warnings: []
  };
  const inRange = (date: string) => !!date && date >= from && date <= to;
  const seenInvoices = new Set<number>();
  for (const invoice of invoices) {
    if (
      invoice.invoiceType !== InvoiceType.invoice ||
      (filters.clientId !== undefined && invoice.clientId !== filters.clientId) ||
      (filters.businessId !== undefined && invoice.businessId !== filters.businessId)
    )
      continue;
    const invCurrency = reportCurrency(invoice);
    if (!invCurrency) {
      warnings.add(`Invoice ${invoice.invoiceFullNumber || invoice.id}: missing or invalid currency.`);
      continue;
    }
    if (invCurrency.value !== currency.value) continue;
    if (seenInvoices.has(invoice.id)) {
      warnings.add(`Invoice ${invoice.invoiceFullNumber || invoice.id}: repeated invoice row counted only once.`);
      continue;
    }
    seenInvoices.add(invoice.id);
    const name = invoice.invoiceClientSnapshot?.clientName || `Client #${invoice.clientId}`;
    const client = clients.get(invoice.clientId) ?? {
      id: invoice.clientId,
      name,
      invoiceCount: 0,
      billed: 0,
      payments: 0,
      outstanding: 0,
      overdue: 0,
      credit: 0
    };
    const issued = reportDay(invoice.issuedAt);
    let total: number;
    try {
      total = money(
        getInvoiceTotal({
          ...invoice,
          discountAmount: Number(invoice.discountAmountCents ?? 0),
          surchargeAmount: Number(invoice.surchargeAmountCents ?? 0),
          shippingFee: Number(invoice.shippingFeeCents ?? 0)
        })
      );
    } catch {
      warnings.add(
        `Invoice ${invoice.invoiceFullNumber || invoice.id}: invalid total; excluded from invoice balances.`
      );
      total = NaN;
    }
    let recorded = 0;
    let allRecorded = 0;
    invoice.invoicePayments.forEach((payment, index) => {
      const date = reportDay(payment.paidAt);
      let amount: number;
      try {
        amount = money(Number(payment.amountCents));
      } catch {
        warnings.add(`Invoice ${invoice.invoiceFullNumber || invoice.id}: invalid payment amount; payment excluded.`);
        return;
      }
      allRecorded = addMoney(allRecorded, amount);
      if (!date) {
        // Keep the known payment in the balance, but never invent its cash-flow date.
        recorded = addMoney(recorded, amount);
        warnings.add(`Invoice ${invoice.invoiceFullNumber || invoice.id}: undated payment included in balance only.`);
        return;
      }
      if (date > today) {
        warnings.add(
          `Invoice ${invoice.invoiceFullNumber || invoice.id}: future-dated payment excluded from cash received and current balances until ${date}.`
        );
        return;
      }
      recorded = addMoney(recorded, amount);
      if (!inRange(date)) return;
      result.payments = addMoney(result.payments, amount);
      client.payments = addMoney(client.payments, amount);
      const point = trend.get(bucketKey(date))!;
      point.payments = addMoney(point.payments, amount);
      const methodKey = payment.paymentMethod || 'Unspecified';
      const method = methods.get(methodKey) ?? { key: methodKey, count: 0, amount: 0 };
      method.count += 1;
      method.amount = addMoney(method.amount, amount);
      methods.set(methodKey, method);
      result.paymentRows.push({
        key: `${invoice.id}:${payment.id ?? index}`,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceFullNumber || invoice.invoiceNumber,
        client: name,
        date: payment.paidAt,
        method: methodKey,
        amount
      });
    });
    if (!issued)
      warnings.add(
        `Invoice ${invoice.invoiceFullNumber || invoice.id}: invalid issue date; excluded from invoice totals and aging.`
      );
    if (issued && Number.isFinite(total)) {
      // Manual Paid is a balance settlement, not evidence of a cash transaction.
      const manualPaid = invoice.status === InvoiceStatus.paid ? Math.max(0, total - allRecorded) : 0;
      const effectivePaid = addMoney(recorded, manualPaid);
      const outstanding = Math.max(0, total - effectivePaid);
      const credit = Math.max(0, effectivePaid - total);
      const due = invoice.dueDate ? reportDay(invoice.dueDate) : '';
      const daysLate = due ? differenceInCalendarDays(parseISO(today), parseISO(due)) : 0;
      if (invoice.dueDate && !due)
        warnings.add(`Invoice ${invoice.invoiceFullNumber || invoice.id}: invalid due date; shown under no due date.`);
      if (issued <= today) {
        result.outstanding = addMoney(result.outstanding, outstanding);
        result.credit = addMoney(result.credit, credit);
        client.outstanding = addMoney(client.outstanding, outstanding);
        client.credit = addMoney(client.credit, credit);
        if (outstanding > 0) {
          const bucket =
            aging[!due ? 5 : daysLate <= 0 ? 0 : daysLate <= 30 ? 1 : daysLate <= 60 ? 2 : daysLate <= 90 ? 3 : 4];
          bucket.count += 1;
          bucket.amount = addMoney(bucket.amount, outstanding);
          if (daysLate > 0) {
            result.overdueCount += 1;
            result.overdue = addMoney(result.overdue, outstanding);
            client.overdue = addMoney(client.overdue, outstanding);
          }
        }
      }
      if (inRange(issued)) {
        result.invoiceCount += 1;
        client.invoiceCount += 1;
        result.billed = addMoney(result.billed, total);
        result.invoiceRows.push({
          id: invoice.id,
          invoiceNumber: invoice.invoiceFullNumber || invoice.invoiceNumber,
          date: issued,
          client: name,
          business: invoice.invoiceBusinessSnapshot?.businessName || `Business #${invoice.businessId}`,
          status: invoice.status,
          archived: Boolean(invoice.isArchived),
          amount: total
        });
        client.billed = addMoney(client.billed, total);
        result.settled = addMoney(result.settled, Math.max(0, Math.min(total, effectivePaid)));
        result.markedPaid = addMoney(result.markedPaid, Math.max(0, effectivePaid - recorded));
        result.periodOutstanding = addMoney(result.periodOutstanding, outstanding);
        const status = statuses[outstanding === 0 ? 2 : effectivePaid > 0 ? 1 : 0];
        status.count += 1;
        status.amount = addMoney(status.amount, total);
        const point = trend.get(bucketKey(issued))!;
        point.billed = addMoney(point.billed, total);
        const subTotal = invoice.invoiceItems.reduce(
          (sum, item) => sum + Number(item.quantity) * Number(item.invoiceItemSnapshot.unitPriceCents),
          0
        );
        for (const item of invoice.invoiceItems) {
          const key = String(item.itemId);
          const entry = items.get(key) ?? { key, name: item.invoiceItemSnapshot.itemName, quantity: 0, amount: 0 };
          entry.quantity += Number(item.quantity);
          entry.amount += getInvoiceItemTotal({
            ...item,
            subTotal,
            unitPrice: Number(item.invoiceItemSnapshot.unitPriceCents),
            quantity: Number(item.quantity),
            invoiceItems: invoice.invoiceItems,
            discountType: invoice.discountType,
            discountAmount: Number(invoice.discountAmountCents ?? 0),
            discountPercent: invoice.discountPercent
          });
          items.set(key, entry);
        }
      }
    }
    clients.set(invoice.clientId, client);
  }
  // Convert only at the presentation boundary; all reconciliation uses integer minor units.
  const subunit = currency.subunit;
  for (const key of [
    'billed',
    'payments',
    'settled',
    'markedPaid',
    'periodOutstanding',
    'outstanding',
    'overdue',
    'credit'
  ] as const)
    result[key] /= subunit;
  result.averageInvoice = result.invoiceCount ? result.billed / result.invoiceCount : 0;
  result.collectionRate = result.billed > 0 ? (result.settled / result.billed) * 100 : 0;
  result.clients = [...clients.values()]
    .filter(c => c.invoiceCount || c.payments || c.outstanding || c.credit)
    .map(c => ({
      ...c,
      billed: c.billed / subunit,
      payments: c.payments / subunit,
      outstanding: c.outstanding / subunit,
      overdue: c.overdue / subunit,
      credit: c.credit / subunit
    }))
    .sort((a, b) => b.billed - a.billed || a.id - b.id);
  result.paymentRows = result.paymentRows
    .map(p => ({ ...p, amount: p.amount / subunit }))
    .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime() || a.key.localeCompare(b.key));
  result.invoiceRows = result.invoiceRows
    .map(row => ({ ...row, amount: row.amount / subunit }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  result.methods = [...methods.values()]
    .map(m => ({ ...m, amount: m.amount / subunit }))
    .sort((a, b) => b.amount - a.amount);
  result.aging = aging.map(a => ({ ...a, amount: a.amount / subunit }));
  result.statuses = statuses.map(s => ({ ...s, amount: s.amount / subunit }));
  result.trend = [...trend.values()].map(p => ({ ...p, billed: p.billed / subunit, payments: p.payments / subunit }));
  result.items = [...items.values()]
    .map(i => ({ ...i, amount: money(i.amount) / subunit }))
    .sort((a, b) => b.amount - a.amount);
  result.warnings = [...warnings];
  return result;
};

export const reportCsv = (rows: (string | number)[][]) =>
  '\uFEFF' +
  rows
    .map(row =>
      row
        .map(value => {
          const text = String(value);
          // Spreadsheet formula injection can originate in imported client/invoice names.
          const safe = typeof value === 'string' && /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
          return `"${safe.replace(/"/g, '""')}"`;
        })
        .join(',')
    )
    .join('\r\n');
