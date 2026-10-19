import { parseISO } from 'date-fns';
import { InvoiceStatus } from '../enums/invoiceStatus';
import { InvoiceType } from '../enums/invoiceType';
import type { Invoice } from '../types/invoice';
import type { Settings } from '../types/settings';
import { getFinancialData } from './invoiceFunctions';

export const billingDate = (value: string) => {
  const date = parseISO(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const splitBillingDescription = (text: string): string[] => {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 600 || (remaining.match(/\n/g)?.length ?? 0) > 10) {
    const space = remaining.lastIndexOf(' ', 600);
    let boundary = remaining.length > 600 ? (space > 0 ? space + 1 : 600) : remaining.length;
    const lineBreaks = [...remaining.matchAll(/\n/g)];
    if (lineBreaks.length > 10) boundary = Math.min(boundary, lineBreaks[9].index! + 1);
    chunks.push(remaining.slice(0, boundary));
    remaining = remaining.slice(boundary);
  }
  chunks.push(remaining);
  return chunks;
};

export const billingSelectionError = (invoices: Invoice[]): string | undefined => {
  if (invoices.length < 2) return 'Select at least two invoices.';
  const first = invoices[0];
  if (new Set(invoices.map(invoice => invoice.id)).size !== invoices.length) return 'An invoice is selected twice.';
  if (invoices.some(invoice => invoice.id == null || invoice.invoiceType !== InvoiceType.invoice))
    return 'Only saved invoices can be included.';
  if (invoices.some(invoice => !billingDate(invoice.issuedAt))) return 'Every invoice needs a valid issue date.';
  if (invoices.some(invoice => invoice.businessId !== first.businessId || invoice.clientId !== first.clientId))
    return 'Select invoices for the same business and client.';
  const currency = first.invoiceCurrencySnapshot;
  if (
    !currency?.currencyCode ||
    !(currency.currencySubunit > 0) ||
    invoices.some(
      invoice =>
        invoice.invoiceCurrencySnapshot?.currencyCode !== currency.currencyCode ||
        invoice.invoiceCurrencySnapshot?.currencySubunit !== currency.currencySubunit
    )
  )
    return 'Select invoices with the same currency and currency subunit.';
  return undefined;
};

export const buildBillingPeriod = (invoices: Invoice[], settings: Settings) => {
  const error = billingSelectionError(invoices);
  if (error) throw new Error(error);
  const rows = [...invoices]
    .sort(
      (a, b) =>
        billingDate(a.issuedAt).localeCompare(billingDate(b.issuedAt)) ||
        a.invoiceNumber.localeCompare(b.invoiceNumber, undefined, { numeric: true }) ||
        a.id! - b.id!
    )
    .map(invoice => {
      const currency = invoice.invoiceCurrencySnapshot!;
      const financial = getFinancialData({
        storeSettings: settings,
        currencySymbol: currency.currencySymbol,
        currencyCode: currency.currencyCode,
        currencySubunit: currency.currencySubunit,
        currencyFormat: invoice.currencyFormat,
        invoiceItems: invoice.invoiceItems,
        invoicePayments: invoice.invoicePayments,
        taxRate: invoice.taxRate,
        taxType: invoice.taxType,
        discountType: invoice.discountType,
        discountAmount: Number(invoice.discountAmountCents ?? 0),
        discountPercent: invoice.discountPercent,
        surchargeType: invoice.surchargeType,
        surchargeAmount: Number(invoice.surchargeAmountCents ?? 0),
        surchargePercent: invoice.surchargePercent,
        shippingAmount: Number(invoice.shippingFeeCents ?? 0)
      });
      // Sum the displayed invoice amounts, so the statement reconciles to the PDFs.
      const total = Math.round(financial.totalAmount * currency.currencySubunit);
      const recordedPaid = Math.round(financial.totalAmountPaid * currency.currencySubunit);
      const paid = invoice.status === InvoiceStatus.paid ? Math.max(total, recordedPaid) : recordedPaid;
      if (!Number.isSafeInteger(total) || !Number.isSafeInteger(paid))
        throw new Error('An invoice has an invalid amount.');
      return { invoice, financial, total, paid };
    });
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const paid = rows.reduce((sum, row) => sum + row.paid, 0);
  const balance = total - paid;
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(paid) || !Number.isSafeInteger(balance))
    throw new Error('The billing period amount is too large.');
  return {
    rows,
    total,
    paid,
    balance,
    from: billingDate(rows[0].invoice.issuedAt),
    to: billingDate(rows[rows.length - 1].invoice.issuedAt)
  };
};
