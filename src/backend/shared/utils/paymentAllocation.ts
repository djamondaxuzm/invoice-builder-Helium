import { getInvoiceTotal, roundMinorUnits, type MoneyInvoiceItem, type TaxType } from './invoiceMath';

export interface PaymentInvoice {
  id?: number;
  invoiceType?: string;
  clientId?: number;
  businessId?: number;
  status?: string;
  invoiceNumber?: string;
  invoiceFullNumber?: string;
  issuedAt?: string;
  updatedAt?: string;
  invoiceCurrencySnapshot?: { currencyCode: string; currencySubunit: number };
  invoiceItems?: MoneyInvoiceItem[];
  invoicePayments?: { amountCents: string }[];
  taxRate?: number;
  taxType?: TaxType;
  discountType?: 'fixed' | 'percentage';
  discountAmountCents?: string;
  discountPercent?: number;
  shippingFeeCents?: string;
  surchargeType?: 'fixed' | 'percentage';
  surchargeAmountCents?: string;
  surchargePercent?: number;
}
export interface PaymentAllocation {
  invoiceId: number;
  amountCents: number;
  expectedTotalCents: number;
  expectedPaidCents: number;
  expectedStatus: string;
  expectedUpdatedAt: string;
}
export interface BulkPaymentRequest {
  clientId: number;
  businessId: number;
  currencyCode: string;
  currencySubunit: number;
  paidAt: string;
  paymentMethod: string;
  notes?: string;
  allocations: PaymentAllocation[];
}
export const getPaymentBalance = (invoice: PaymentInvoice) => {
  const total = roundMinorUnits(
    getInvoiceTotal({
      taxRate: invoice.taxRate ?? 0,
      taxType: invoice.taxType,
      invoiceItems: invoice.invoiceItems ?? [],
      discountType: invoice.discountType,
      discountAmount: Number(invoice.discountAmountCents ?? 0),
      discountPercent: invoice.discountPercent,
      surchargeType: invoice.surchargeType,
      surchargeAmount: Number(invoice.surchargeAmountCents ?? 0),
      surchargePercent: invoice.surchargePercent,
      shippingFee: Number(invoice.shippingFeeCents ?? 0)
    })
  );
  const paid = (invoice.invoicePayments ?? []).reduce(
    (sum, payment) => roundMinorUnits(sum + roundMinorUnits(Number(payment.amountCents))),
    0
  );
  return {
    total,
    paid,
    unrecorded: Math.max(0, total - paid),
    remaining: invoice.status === 'paid' ? 0 : Math.max(0, total - paid)
  };
};

export const allocatePayment = (invoices: PaymentInvoice[], amountCents?: number): PaymentAllocation[] => {
  if (!invoices.length) throw new Error('Select at least one invoice.');
  if (invoices.length > 500) throw new Error('Select no more than 500 invoices for one payment batch.');
  const first = invoices[0];
  const currency = first.invoiceCurrencySnapshot;
  if (!currency?.currencyCode || !Number.isSafeInteger(currency.currencySubunit) || currency.currencySubunit <= 0)
    throw new Error('The invoices need a valid currency.');
  if (new Set(invoices.map(invoice => invoice.id)).size !== invoices.length)
    throw new Error('An invoice is selected twice.');
  for (const invoice of invoices) {
    if (!Number.isSafeInteger(invoice.id) || invoice.id! <= 0 || invoice.invoiceType !== 'invoice')
      throw new Error('Only saved invoices can receive a bulk payment.');
    if (
      invoice.clientId !== first.clientId ||
      invoice.businessId !== first.businessId ||
      invoice.invoiceCurrencySnapshot?.currencyCode !== currency.currencyCode ||
      invoice.invoiceCurrencySnapshot?.currencySubunit !== currency.currencySubunit
    )
      throw new Error('Select invoices for one client, business and currency.');
    if (!invoice.issuedAt || !Number.isFinite(Date.parse(invoice.issuedAt)))
      throw new Error('Every selected invoice needs a valid issue date.');
  }
  const sorted = [...invoices].sort(
    (a, b) =>
      Date.parse(a.issuedAt!) - Date.parse(b.issuedAt!) ||
      (a.invoiceNumber ?? '').localeCompare(b.invoiceNumber ?? '', undefined, { numeric: true }) ||
      a.id! - b.id!
  );
  const balances = sorted.map(invoice => ({ invoice, ...getPaymentBalance(invoice) }));
  const available = balances.reduce((sum, row) => roundMinorUnits(sum + row.remaining), 0);
  const amount = amountCents ?? available;
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > available)
    throw new Error('Enter an amount greater than zero and no larger than the selected outstanding balance.');
  let left = amount;
  return balances.flatMap(row => {
    const allocated = Math.min(left, row.remaining);
    left -= allocated;
    return allocated
      ? [
          {
            invoiceId: row.invoice.id!,
            amountCents: allocated,
            expectedTotalCents: row.total,
            expectedPaidCents: row.paid,
            expectedStatus: row.invoice.status ?? '',
            expectedUpdatedAt: row.invoice.updatedAt ?? ''
          }
        ]
      : [];
  });
};
