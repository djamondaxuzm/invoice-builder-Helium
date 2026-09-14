import { AmountFormat } from '../shared/enums/amountFormat';
import { DateFormat } from '../shared/enums/dateFormat';
import { InvoiceStatus } from '../shared/enums/invoiceStatus';
import { InvoiceType } from '../shared/enums/invoiceType';
import { Language } from '../shared/enums/language';
import type { Invoice } from '../shared/types/invoice';
import type { Settings } from '../shared/types/settings';

export const settings = { amountFormat: AmountFormat.enUS, dateFormat: DateFormat.yyyyMMddDash } as Settings;
export const invoice = (id: number, overrides: Partial<Invoice> = {}): Invoice => ({
  id,
  invoiceNumber: String(id).padStart(3, '0'),
  invoiceFullNumber: String(id).padStart(3, '0'),
  invoiceType: InvoiceType.invoice,
  businessId: 1,
  clientId: 2,
  currencyId: 3,
  issuedAt: `2026-09-${String(id).padStart(2, '0')}T12:00:00`,
  createdAt: '',
  updatedAt: '',
  isArchived: false,
  status: InvoiceStatus.unpaid,
  discountAmountCents: '0',
  discountPercent: 0,
  surchargeAmountCents: '0',
  surchargePercent: 0,
  shippingFeeCents: '0',
  taxRate: 0,
  invoicePayments: [],
  invoiceAttachments: [],
  invoiceItems: [
    {
      itemId: 1,
      quantity: '1',
      taxRate: 0,
      invoiceItemSnapshot: { parentInvoiceItemId: 1, itemName: 'Daily work', unitPriceCents: '10000', unitName: 'day' }
    }
  ],
  currencyFormat: '{symbol}{amount}',
  language: Language.en,
  invoiceCurrencySnapshot: { currencyCode: 'USD', currencySymbol: '$', currencySubunit: 100 },
  invoiceBusinessSnapshot: { businessName: 'Example Business', businessShortName: 'Example' },
  invoiceClientSnapshot: { clientName: 'Example Client' },
  ...overrides
});
