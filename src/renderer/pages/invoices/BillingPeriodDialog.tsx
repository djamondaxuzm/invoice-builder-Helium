import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { saveAs } from 'file-saver';
import { getApi } from '../../shared/api/restApi';
import { InvoiceType } from '../../shared/enums/invoiceType';
import type { Invoice } from '../../shared/types/invoice';
import type { Settings } from '../../shared/types/settings';
import { billingDate, billingSelectionError, buildBillingPeriod } from '../../shared/utils/billingPeriod';

export const BillingPeriodDialog = ({ onClose, settings }: { onClose: () => void; settings: Settings }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    getApi()
      .getAllInvoices(InvoiceType.invoice)
      .then(response => {
        if (cancelled) return;
        if (!response.success) throw new Error('Could not load invoices. Close this window and try again.');
        setInvoices(response.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load invoices. Close this window and try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const visible = useMemo(
    () =>
      invoices
        .filter(invoice => {
          const date = billingDate(invoice.issuedAt);
          return date && (!from || date >= from) && (!to || date <= to);
        })
        .sort(
          (a, b) =>
            billingDate(a.issuedAt).localeCompare(billingDate(b.issuedAt)) ||
            a.invoiceNumber.localeCompare(b.invoiceNumber, undefined, { numeric: true })
        ),
    [invoices, from, to]
  );
  const chosen = invoices.filter(invoice => selected.includes(invoice.id!));
  const validation =
    from && to && from > to ? 'The end date must be on or after the start date.' : billingSelectionError(chosen);
  const download = async () => {
    setExporting(true);
    setError('');
    try {
      const period = buildBillingPeriod(chosen, settings);
      const { createBillingPeriodPdf } = await import('./createBillingPeriodPdf');
      const blob = await createBillingPeriodPdf(period, settings);
      saveAs(blob, `billing-period-${period.from}-to-${period.to}.pdf`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not export the billing period. Please try again.');
    } finally {
      setExporting(false);
    }
  };
  return (
    <Dialog open onClose={exporting ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>Billing period PDF</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          Select invoices for one business, client, and currency. The PDF includes each invoice’s items and a combined
          total. Your invoices remain available individually.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 1, mb: 2 }}>
          <TextField
            label="From date"
            type="date"
            value={from}
            disabled={exporting}
            slotProps={{ inputLabel: { shrink: true } }}
            onChange={event => {
              setFrom(event.target.value);
              setSelected([]);
            }}
          />
          <TextField
            label="To date"
            type="date"
            value={to}
            disabled={exporting}
            slotProps={{ inputLabel: { shrink: true } }}
            onChange={event => {
              setTo(event.target.value);
              setSelected([]);
            }}
          />
          <Button
            disabled={exporting || !visible.length}
            onClick={() => setSelected(visible.map(invoice => invoice.id!))}
          >
            Select shown
          </Button>
          <Button disabled={exporting || !selected.length} onClick={() => setSelected([])}>
            Clear selection
          </Button>
        </Stack>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading ? (
          <CircularProgress aria-label="Loading invoices" />
        ) : (
          <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
            {!visible.length && <Typography>No invoices in this date range.</Typography>}
            {visible.map(invoice => (
              <FormControlLabel
                key={invoice.id}
                sx={{ display: 'flex', m: 0 }}
                control={
                  <Checkbox
                    disabled={exporting}
                    checked={selected.includes(invoice.id!)}
                    onChange={(_, checked) =>
                      setSelected(current =>
                        checked ? [...current, invoice.id!] : current.filter(id => id !== invoice.id)
                      )
                    }
                  />
                }
                label={`${billingDate(invoice.issuedAt)} · ${invoice.invoiceFullNumber || invoice.invoiceNumber} · ${invoice.invoiceBusinessSnapshot?.businessName ?? ''} · ${invoice.invoiceClientSnapshot?.clientName ?? ''} · ${invoice.invoiceCurrencySnapshot?.currencyCode ?? ''}`}
              />
            ))}
          </Box>
        )}
        <Typography sx={{ mt: 2 }} aria-live="polite">
          {selected.length} selected. {validation ?? 'Ready to export.'}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={exporting}>
          Close
        </Button>
        <Button variant="contained" disabled={loading || exporting || !!validation} onClick={download}>
          {exporting ? 'Creating PDF…' : 'Download PDF'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
