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
  Typography
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { saveAs } from 'file-saver';
import { Datepicker } from '../../shared/components/inputs/datepicker/Datepicker';
import { formatDate } from '../../shared/utils/formatFunctions';
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
  const datedInvoices = useMemo(
    () => invoices.map(invoice => ({ invoice, date: billingDate(invoice.issuedAt) })),
    [invoices]
  );
  const visible = useMemo(
    () =>
      datedInvoices
        .filter(({ date }) => date && (!from || date >= from) && (!to || date <= to))
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) ||
            a.invoice.invoiceNumber.localeCompare(b.invoice.invoiceNumber, undefined, { numeric: true })
        )
        .map(({ invoice }) => invoice),
    [datedInvoices, from, to]
  );
  const selectedIds = useMemo(() => new Set(selected), [selected]);
  const chosen = useMemo(() => invoices.filter(invoice => selectedIds.has(invoice.id!)), [invoices, selectedIds]);
  const validation =
    from && to && from > to ? 'The end date must be on or after the start date.' : billingSelectionError(chosen);
  const download = async () => {
    if (loading || exporting || validation) return;
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
          Select invoices for one business, client, and currency. Each invoice starts on its own page, followed by its
          receipt attachments. A final summary lists all subtotals and the combined balance due. Each invoice keeps its
          saved branding; the first invoice supplies the summary branding.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 1, mb: 2 }}>
          <Datepicker
            label="From date"
            format={settings.dateFormat}
            value={from}
            disabled={exporting}
            onChange={value => {
              setFrom(value ? billingDate(value) : '');
              setSelected([]);
            }}
          />
          <Datepicker
            label="To date"
            format={settings.dateFormat}
            value={to}
            disabled={exporting}
            onChange={value => {
              setTo(value ? billingDate(value) : '');
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
                    checked={selectedIds.has(invoice.id!)}
                    onChange={(_, checked) =>
                      setSelected(current =>
                        checked ? [...current, invoice.id!] : current.filter(id => id !== invoice.id)
                      )
                    }
                  />
                }
                label={`${formatDate(invoice.issuedAt, settings.dateFormat)} · ${invoice.invoiceFullNumber || invoice.invoiceNumber} · ${invoice.invoiceBusinessSnapshot?.businessName ?? ''} · ${invoice.invoiceClientSnapshot?.clientName ?? ''} · ${invoice.invoiceCurrencySnapshot?.currencyCode ?? ''}`}
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
