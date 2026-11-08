import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  TextField
} from '@mui/material';
import { useEffect, useState } from 'react';
import type { ContractTerms, ContractTermsTemplate } from '../../../backend/shared/types/contracts';
import { CONTRACT_BILLABLE_TIME_TERMS } from '../../../backend/shared/utils/contracts';
import { getApi } from '../../shared/api/restApi';
import { ArbitrationFields } from './ArbitrationFields';

export const StandardTermsDialog = ({
  onClose,
  onSaved,
  onDirtyChange
}: {
  onClose: () => void;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) => {
  const [template, setTemplate] = useState<ContractTermsTemplate | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void getApi()
      .getContractTermsTemplate()
      .then(result => {
        if (!active) return;
        if (!result.success || !result.data) throw new Error(result.message || 'Could not load standard terms.');
        setTemplate(result.data);
      })
      .catch(err => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load standard terms.');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const update = <K extends keyof ContractTerms>(key: K, value: ContractTerms[K]) => {
    setTemplate(previous => (previous ? { ...previous, terms: { ...previous.terms, [key]: value } } : previous));
    onDirtyChange(true);
    setError('');
  };
  const save = async () => {
    if (!template || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await getApi().saveContractTermsTemplate(template);
      if (!result.success) throw new Error(result.message || 'Could not save standard terms.');
      onDirtyChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save standard terms.');
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>Standard terms for new contracts</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">
            These defaults apply to new contracts. Existing contracts and the draft currently open retain their own
            terms.
          </Alert>
          {busy && <LinearProgress aria-label="Loading standard terms" />}
          {error && <Alert severity="error">{error}</Alert>}
          {template && (
            <>
              <TextField
                label="Default billable time and consultation"
                multiline
                minRows={6}
                value={template.terms.billableTimeTerms ?? ''}
                disabled={busy}
                onChange={event => update('billableTimeTerms', event.target.value)}
              />
              <Button
                disabled={busy}
                sx={{ alignSelf: 'flex-start' }}
                onClick={() => update('billableTimeTerms', CONTRACT_BILLABLE_TIME_TERMS)}
              >
                Use suggested time definitions
              </Button>
              <TextField
                label="Default billing schedule (optional)"
                value={template.terms.billingSchedule}
                disabled={busy}
                onChange={event => update('billingSchedule', event.target.value)}
              />
              <TextField
                label="Default payment terms"
                multiline
                minRows={2}
                value={template.terms.paymentTerms}
                disabled={busy}
                onChange={event => update('paymentTerms', event.target.value)}
              />
              <TextField
                label="Default materials terms"
                multiline
                minRows={2}
                value={template.terms.materialsTerms}
                disabled={busy}
                onChange={event => update('materialsTerms', event.target.value)}
              />
              <TextField
                label="Default standard terms"
                multiline
                minRows={8}
                value={template.terms.standardTerms}
                disabled={busy}
                onChange={event => update('standardTerms', event.target.value)}
              />
              <ArbitrationFields
                value={template.terms.arbitration}
                disabled={busy}
                onChange={value => update('arbitration', value)}
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" disabled={busy || !template} onClick={() => void save()}>
          Save standard terms
        </Button>
      </DialogActions>
    </Dialog>
  );
};
