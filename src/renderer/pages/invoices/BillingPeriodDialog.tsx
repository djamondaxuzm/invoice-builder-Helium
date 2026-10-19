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
  ListItemButton,
  TextField,
  Stack,
  Typography
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { selectBillingRows } from '../../shared/utils/billingSelection';
import { loadInvoiceDetails } from '../../shared/utils/loadInvoiceDetails';
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
  const [clientId, setClientId] = useState('');
  const [anchor, setAnchor] = useState<number>();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    getApi()
      .getAllInvoices(InvoiceType.invoice, undefined, { attachmentMetadataOnly: true })
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
  const clients = useMemo(
    () =>
      [
        ...new Map(
          invoices.map(invoice => [
            invoice.clientId,
            { id: invoice.clientId, name: invoice.invoiceClientSnapshot?.clientName || `Client ${invoice.clientId}` }
          ])
        ).values()
      ].sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id),
    [invoices]
  );
  const visible = useMemo(
    () =>
      datedInvoices
        .filter(
          ({ invoice, date }) =>
            String(invoice.clientId) === clientId && date && (!from || date >= from) && (!to || date <= to)
        )
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) ||
            a.invoice.invoiceNumber.localeCompare(b.invoice.invoiceNumber, undefined, { numeric: true })
        )
        .map(({ invoice }) => invoice),
    [datedInvoices, from, to, clientId]
  );
  const selectedIds = useMemo(() => new Set(selected), [selected]);
  const chosen = useMemo(() => visible.filter(invoice => selectedIds.has(invoice.id!)), [visible, selectedIds]);
  const validation =
    from && to && from > to ? 'The end date must be on or after the start date.' : billingSelectionError(chosen);
  const download = async () => {
    if (loading || exporting || validation) return;
    setExporting(true);
    setError('');
    try {
      const complete: Invoice[] = [];
      // Fetch only the selected invoices, sequentially to bound image-transfer memory.
      for (const invoice of chosen) complete.push(await loadInvoiceDetails(invoice));
      const period = buildBillingPeriod(complete, settings);
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
          Choose a client, then select their invoices in date order. Click a row to select it, Ctrl-click (or Cmd-click)
          to toggle individual rows, and Shift-click to select a range. Checkboxes also toggle individual invoices. The
          PDF includes each invoice, its receipts, and a final combined summary.
        </Typography>
        <TextField
          select
          fullWidth
          label="Client"
          value={clientId}
          disabled={loading || exporting}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          onChange={event => {
            setClientId(event.target.value);
            setSelected([]);
            setAnchor(undefined);
            setError('');
          }}
        >
          <option value="">Choose a client…</option>
          {clients.map(client => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </TextField>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 1, mb: 2 }}>
          <Datepicker
            label="From date"
            format={settings.dateFormat}
            value={from}
            disabled={exporting || !clientId}
            onChange={value => {
              setFrom(value ? billingDate(value) : '');
              setSelected([]);
              setAnchor(undefined);
            }}
          />
          <Datepicker
            label="To date"
            format={settings.dateFormat}
            value={to}
            disabled={exporting || !clientId}
            onChange={value => {
              setTo(value ? billingDate(value) : '');
              setSelected([]);
              setAnchor(undefined);
            }}
          />
          <Button
            disabled={exporting || !visible.length}
            onClick={() => {
              setSelected(visible.map(invoice => invoice.id!));
              setAnchor(undefined);
            }}
          >
            Select shown
          </Button>
          <Button
            disabled={exporting || !selected.length}
            onClick={() => {
              setSelected([]);
              setAnchor(undefined);
            }}
          >
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
          <Box
            role="listbox"
            aria-label="Invoices by date"
            aria-multiselectable="true"
            sx={{ maxHeight: 420, overflowY: 'auto' }}
          >
            {!visible.length && (
              <Typography>
                {clientId ? 'No invoices in this date range.' : 'Choose a client to see their invoices.'}
              </Typography>
            )}
            {visible.map(invoice => (
              <ListItemButton
                key={invoice.id}
                role="option"
                aria-selected={selectedIds.has(invoice.id!)}
                selected={selectedIds.has(invoice.id!)}
                disabled={exporting}
                sx={{ display: 'flex', m: 0, borderBottom: 1, borderColor: 'divider', userSelect: 'none' }}
                onClick={event => {
                  const checkbox =
                    (event.target as HTMLElement).closest('input[type="checkbox"], .MuiCheckbox-root') !== null;
                  setSelected(current =>
                    selectBillingRows(
                      visible.map(row => row.id!),
                      current,
                      invoice.id!,
                      anchor,
                      { shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey, checkbox }
                    )
                  );
                  if (!event.shiftKey || anchor === undefined) setAnchor(invoice.id!);
                }}
              >
                <Checkbox
                  disabled={exporting}
                  checked={selectedIds.has(invoice.id!)}
                  tabIndex={-1}
                  slotProps={{
                    input: {
                      readOnly: true,
                      'aria-label': `${formatDate(invoice.issuedAt, settings.dateFormat)} · ${invoice.invoiceFullNumber || invoice.invoiceNumber}`
                    }
                  }}
                />
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>
                    {formatDate(invoice.issuedAt, settings.dateFormat)} · Invoice{' '}
                    {invoice.invoiceFullNumber || invoice.invoiceNumber}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {invoice.invoiceBusinessSnapshot?.businessName} · {invoice.invoiceCurrencySnapshot?.currencyCode} ·{' '}
                    {invoice.status} · {invoice.invoiceItems.length} line items · {invoice.invoiceAttachments.length}{' '}
                    receipts
                  </Typography>
                </Box>
              </ListItemButton>
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
