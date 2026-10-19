import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography
} from '@mui/material';
import { useMemo, useRef, useState } from 'react';
import { parseISO } from 'date-fns';
import { allocatePayment } from '../../../backend/shared/utils/paymentAllocation';
import { getApi } from '../../shared/api/restApi';
import { Datepicker } from '../../shared/components/inputs/datepicker/Datepicker';
import { PaymentType } from '../../shared/enums/paymentType';
import type { Invoice } from '../../shared/types/invoice';
import type { Settings } from '../../shared/types/settings';
import { formatDate, localDateRange } from '../../shared/utils/formatFunctions';
import { reportCurrency } from '../../shared/utils/reportFunctions';
import { ReportTable } from '../reports/ReportTable';
import { reportFormatter } from '../reports/formatReport';

export const BulkPaymentDialog = ({
  invoices,
  settings,
  onClose,
  onSaved,
  onRefresh
}: {
  invoices: Invoice[];
  settings: Settings;
  onClose: () => void;
  onSaved: (count: number) => void;
  onRefresh: () => void;
}) => {
  const initial = useMemo(() => {
    try {
      return { rows: allocatePayment(invoices) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [invoices]);
  const currency = reportCurrency(invoices[0]);
  const total = initial.rows?.reduce((sum, row) => sum + row.amountCents, 0) ?? 0;
  const [amount, setAmount] = useState(String(total / (currency?.subunit || 1)));
  const [paidAt, setPaidAt] = useState(localDateRange(new Date(), new Date()).from);
  const [method, setMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const submitting = useRef(false);
  const allocation = useMemo(() => {
    try {
      const value = Number(amount) * (currency?.subunit || 1);
      if (!Number.isFinite(value) || Math.abs(value - Math.round(value)) > 0.000001)
        throw new Error('Use whole currency subunits.');
      return { rows: allocatePayment(invoices, Math.round(value)) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [invoices, amount, currency?.subunit]);
  const money = currency ? reportFormatter(currency, settings.amountFormat) : String;
  const valid = !!allocation.rows?.length && !!method && Number.isFinite(parseISO(paidAt).getTime());
  const save = async () => {
    if (!valid || !currency || submitting.current || needsRefresh || !allocation.rows) return;
    submitting.current = true;
    setSaving(true);
    setError('');
    try {
      const response = await getApi().recordBulkPayment({
        clientId: invoices[0].clientId,
        businessId: invoices[0].businessId,
        currencyCode: invoices[0].invoiceCurrencySnapshot!.currencyCode,
        currencySubunit: currency.subunit,
        paidAt,
        paymentMethod: method,
        notes,
        allocations: allocation.rows
      });
      if (!response.success) throw new Error(response.message || 'Could not record the payments.');
      onSaved(response.data?.invoiceIds.length ?? allocation.rows.length);
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : 'Could not confirm the payment result.') +
          ' Refresh the invoices before trying again.'
      );
      setNeedsRefresh(true);
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };
  return (
    <Dialog open fullWidth maxWidth="md" onClose={saving ? undefined : onClose}>
      <DialogTitle>Record payment across selected invoices</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          {invoices[0].invoiceClientSnapshot?.clientName} · {invoices[0].invoiceBusinessSnapshot?.businessName} ·{' '}
          {currency?.label}
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          The amount is allocated to the oldest selected invoices first. Review each allocation below. Paid invoices are
          skipped. Saving records these payments together immediately.
        </Alert>
        <Box component="fieldset" disabled={saving || needsRefresh} sx={{ border: 0, p: 0, m: 0 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2, mb: 2 }}>
            <TextField
              label={`Total payment (${currency?.code ?? ''})`}
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              slotProps={{
                htmlInput: { min: 0, max: total / (currency?.subunit || 1), step: 1 / (currency?.subunit || 1) }
              }}
            />
            <Datepicker
              label="Payment date"
              required
              format={settings.dateFormat}
              value={paidAt}
              onChange={value => setPaidAt(value ?? '')}
              disabled={saving || needsRefresh}
            />
            <TextField
              select
              label="Payment method"
              value={method}
              onChange={e => setMethod(e.target.value)}
              slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
            >
              <option value="">Choose a method…</option>
              {Object.values(PaymentType).map(value => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </TextField>
          </Box>
          <TextField
            label="Payment notes (optional)"
            fullWidth
            value={notes}
            onChange={e => setNotes(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 10000 } }}
          />
        </Box>
        {(initial.error || allocation.error || error) && (
          <Alert severity="error" sx={{ my: 2 }}>
            {error || allocation.error || initial.error}
          </Alert>
        )}
        <ReportTable
          label="Payment allocation preview"
          columns={['Invoice', 'Issue date', 'Outstanding before', 'Payment', 'Remaining after']}
          rows={(allocation.rows ?? []).map(row => {
            const invoice = invoices.find(invoice => invoice.id === row.invoiceId)!;
            const before = row.expectedTotalCents - row.expectedPaidCents;
            return {
              key: String(row.invoiceId),
              cells: [
                invoice.invoiceFullNumber || invoice.invoiceNumber,
                formatDate(invoice.issuedAt, settings.dateFormat),
                money(before / currency!.subunit),
                money(row.amountCents / currency!.subunit),
                money((before - row.amountCents) / currency!.subunit)
              ]
            };
          })}
        />
        <Typography sx={{ mt: 1 }}>
          {allocation.rows?.length ?? 0} invoices will receive a payment. Total:{' '}
          {money((allocation.rows ?? []).reduce((sum, row) => sum + row.amountCents, 0) / (currency?.subunit || 1))}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        {needsRefresh ? (
          <Button onClick={onRefresh}>Refresh invoices</Button>
        ) : (
          <Button variant="contained" disabled={saving || !valid || !!initial.error} onClick={save}>
            {saving ? 'Saving payments…' : 'Record payments'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
