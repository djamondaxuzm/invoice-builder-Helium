import { Box, Button, FormControlLabel, Switch } from '@mui/material';
import { memo, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { getPaymentBalance } from '../../../../backend/shared/utils/paymentAllocation';
import { InvoiceStatus } from '../../../shared/enums/invoiceStatus';
import { InvoiceType } from '../../../shared/enums/invoiceType';
import type { InvoiceFromData, PaymentForm } from '../../../shared/types/invoice';
import { localDateRange } from '../../../shared/utils/formatFunctions';
import { AddPaymentDropdown } from './Dropdowns/AddPaymentDropdown';

interface Props {
  invoiceForm?: InvoiceFromData;
  onArchivedChanged: (value: boolean) => void;
  onStatusChanged: (status: InvoiceStatus) => void;
  onRecordPayment: (payment: PaymentForm) => void;
}
const StatusSelectorComponent: FC<Props> = ({ invoiceForm, onArchivedChanged, onStatusChanged, onRecordPayment }) => {
  const { t } = useTranslation();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const balance = useMemo(() => {
    try {
      return getPaymentBalance(invoiceForm ?? {});
    } catch {
      return { total: NaN, paid: NaN, remaining: NaN, unrecorded: NaN };
    }
  }, [invoiceForm]);
  const paymentData = useMemo(
    () => ({
      paidAmount: balance.unrecorded / (invoiceForm?.invoiceCurrencySnapshot?.currencySubunit || 1),
      paidAt: invoiceForm?.status === InvoiceStatus.paid ? '' : localDateRange(new Date(), new Date()).from
    }),
    [balance.unrecorded, invoiceForm?.invoiceCurrencySnapshot?.currencySubunit, invoiceForm?.status]
  );
  const automaticStatus = () =>
    invoiceForm?.invoiceType === InvoiceType.quotation
      ? InvoiceStatus.open
      : balance.paid >= balance.total && balance.total >= 0
        ? InvoiceStatus.paid
        : balance.paid > 0
          ? InvoiceStatus.partiallyPaid
          : InvoiceStatus.unpaid;
  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'end', gap: 1 }}>
        <FormControlLabel
          control={
            <Switch
              checked={invoiceForm?.status === InvoiceStatus.closed}
              onChange={e => onStatusChanged(e.target.checked ? InvoiceStatus.closed : automaticStatus())}
            />
          }
          label={t('invoices.markAsClosed')}
        />
        {invoiceForm?.invoiceType === InvoiceType.invoice && (
          <>
            <FormControlLabel
              control={
                <Switch
                  checked={invoiceForm.status === InvoiceStatus.paid}
                  disabled={!Number.isFinite(balance.total)}
                  onChange={e => {
                    if (e.target.checked && balance.unrecorded > 0) setPaymentOpen(true);
                    else onStatusChanged(automaticStatus());
                  }}
                />
              }
              label={t('invoices.markAsPaid')}
            />
            {invoiceForm.status === InvoiceStatus.paid && balance.unrecorded > 0 && (
              <Button onClick={() => setPaymentOpen(true)}>Add missing payment details</Button>
            )}
          </>
        )}
        <FormControlLabel
          control={
            <Switch checked={invoiceForm?.isArchived ?? false} onChange={e => onArchivedChanged(e.target.checked)} />
          }
          label={t('common.archived')}
        />
      </Box>
      <AddPaymentDropdown
        isOpen={paymentOpen}
        data={paymentData}
        onClose={() => setPaymentOpen(false)}
        title={invoiceForm?.status === InvoiceStatus.paid ? 'Add missing payment details' : 'Record payment'}
        helperText={
          invoiceForm?.status === InvoiceStatus.paid
            ? 'Enter the actual payment date and method. Only the amount without payment records is prefilled. Existing payments stay intact and the invoice remains settled. Save the invoice afterward to store these details.'
            : 'Confirm the amount, actual payment date and method. Save the invoice afterward to store the payment.'
        }
        maxAmount={paymentData.paidAmount}
        requireMethodSelection
        decimalScale={Math.max(0, Math.ceil(Math.log10(invoiceForm?.invoiceCurrencySnapshot?.currencySubunit || 1)))}
        onClick={payment => {
          onRecordPayment(payment);
          setPaymentOpen(false);
        }}
      />
    </>
  );
};
export const StatusSelector = memo(StatusSelectorComponent);
