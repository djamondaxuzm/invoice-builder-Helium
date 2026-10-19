import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { Provider } from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material';
import { store } from '../../src/renderer/state/configureStore';
import { setSettings } from '../../src/renderer/state/pageSlice';
import { invoice, settings } from '../../src/renderer/__tests__/billingPeriodFixtures';
import { InvoiceStatus } from '../../src/renderer/shared/enums/invoiceStatus';
import { PaymentType } from '../../src/renderer/shared/enums/paymentType';
import type { BulkPaymentRequest } from '../../src/backend/shared/utils/paymentAllocation';
import type { InvoiceFromData, PaymentForm } from '../../src/renderer/shared/types/invoice';
import '../../src/renderer/i18n';

const mode = new URLSearchParams(location.search).get('mode');
let calls = 0;
let paymentCalls = 0;
let rows =
  mode === 'billing'
    ? [
        invoice(3),
        invoice(1),
        invoice(2),
        invoice(4, { clientId: 9, invoiceClientSnapshot: { clientName: 'Other Client' } })
      ]
    : [
        invoice(1, {
          issuedAt: '2026-10-18T23:59:59',
          invoicePayments: [{ amountCents: '4000', paidAt: '2026-10-18', paymentMethod: PaymentType.bank }]
        }),
        invoice(2, {
          issuedAt: '2026-08-01',
          invoicePayments: [{ amountCents: '10000', paidAt: '2026-10-18', paymentMethod: PaymentType.cash }]
        }),
        invoice(3, { issuedAt: '2026-10-18', status: InvoiceStatus.paid }),
        invoice(4, { issuedAt: '2026-10-18', currencyId: 99 }),
        invoice(5, {
          issuedAt: '2026-10-18',
          clientId: 9,
          invoiceClientSnapshot: { clientName: 'Other Client' },
          invoiceCurrencySnapshot: { currencyCode: 'EUR', currencySymbol: '€', currencySubunit: 100 }
        })
      ];
if (mode === 'audit') {
  const first = invoice(1, {
    issuedAt: '2026-01-01',
    invoicePayments: [{ amountCents: '2500', paidAt: '2026-10-18', paymentMethod: PaymentType.bank }]
  });
  rows = [
    first,
    first,
    invoice(2, {
      issuedAt: '2026-10-18',
      shippingFeeCents: '10000',
      isArchived: true,
      invoicePayments: [
        { amountCents: '7500', paidAt: '2026-10-18', paymentMethod: PaymentType.cash },
        { amountCents: '5000', paidAt: '2026-10-21', paymentMethod: PaymentType.cash }
      ]
    }),
    invoice(3, { issuedAt: '2026-10-19', shippingFeeCents: '20000' })
  ];
}
window.electronAPI = {
  getAllInvoices: async () => {
    calls += 1;
    return mode === 'error' && calls === 1 ? { success: false } : { success: true, data: rows };
  },
  recordBulkPayment: async (request: BulkPaymentRequest) => {
    paymentCalls += 1;
    if (location.search.includes('failBatch') && paymentCalls === 1)
      return { success: false, message: 'An invoice changed after the preview.' };
    rows = rows.map(row => {
      const allocation = request.allocations.find(a => a.invoiceId === row.id);
      if (!allocation) return row;
      return {
        ...row,
        status:
          allocation.amountCents + allocation.expectedPaidCents >= allocation.expectedTotalCents
            ? InvoiceStatus.paid
            : InvoiceStatus.partiallyPaid,
        invoicePayments: [
          ...row.invoicePayments,
          {
            amountCents: String(allocation.amountCents),
            paidAt: request.paidAt,
            paymentMethod: request.paymentMethod as PaymentType
          }
        ]
      };
    });
    return { success: true, data: { invoiceIds: request.allocations.map(a => a.invoiceId) } };
  }
} as unknown as typeof window.electronAPI;
store.dispatch(setSettings(settings));
const { ReportsPage } = await import('../../src/renderer/pages/reports');
const { BillingPeriodDialog } = await import('../../src/renderer/pages/invoices/BillingPeriodDialog');
const { StatusSelector } = await import('../../src/renderer/pages/invoices/Form/StatusSelector');
const Fixture = () => {
  const [draft, setDraft] = useState<InvoiceFromData>(() =>
    invoice(
      1,
      mode === 'legacy'
        ? {
            status: InvoiceStatus.paid,
            paidAt: undefined,
            invoicePayments: [{ id: 50, amountCents: '2500', paidAt: '2026-09-01', paymentMethod: PaymentType.cash }]
          }
        : {}
    )
  );
  const [lastPayment, setLastPayment] = useState<PaymentForm>();
  return (
    <Provider store={store}>
      <ThemeProvider theme={createTheme()}>
        <div style={{ padding: 24 }}>
          {mode === 'billing' ? (
            <BillingPeriodDialog settings={settings} onClose={() => {}} />
          ) : mode === 'legacy' || mode === 'status' ? (
            <>
              <StatusSelector
                invoiceForm={draft}
                onArchivedChanged={() => {}}
                onStatusChanged={status => setDraft({ ...draft, status })}
                onRecordPayment={payment => setLastPayment(payment)}
              />
              <output>{lastPayment ? JSON.stringify(lastPayment) : 'No payment changes'}</output>
            </>
          ) : (
            <ReportsPage />
          )}
        </div>
      </ThemeProvider>
    </Provider>
  );
};
createRoot(document.getElementById('root')!).render(<Fixture />);
