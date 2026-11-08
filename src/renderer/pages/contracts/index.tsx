import {
  Alert,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Step,
  StepButton,
  Stepper,
  TextField,
  Typography
} from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type {
  ContractDraft,
  ContractParty,
  ContractRate,
  ContractSummary,
  SavedContract
} from '../../../backend/shared/types/contracts';
import {
  contractFeeCents,
  CONTRACT_BILLABLE_TIME_TERMS,
  CONTRACT_RETAINER_TERMS,
  newContractDraft,
  newContractProjectDetails,
  validateContractDraft
} from '../../../backend/shared/utils/contracts';
import { getApi } from '../../shared/api/restApi';
import type { Business } from '../../shared/types/business';
import type { Client } from '../../shared/types/client';
import type { Item } from '../../shared/types/item';
import type { StyleProfile } from '../../shared/types/styleProfiles';
import { getOptimizedLogoUrl } from '../../shared/utils/logoImage';
import { useAppDispatch } from '../../state/configureStore';
import { setAllowed } from '../../state/pageSlice';
import { ContractPreview, contractAmount, contractRetainerAmount } from './ContractPreview';
import { StandardTermsDialog } from './StandardTermsDialog';
import { ArbitrationFields } from './ArbitrationFields';

const steps = ['Client & project', 'Rates & fee', 'Terms', 'Review'];
const today = () => {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
};
const partySnapshot = (party: Client | Business): ContractParty => ({
  sourceId: party.id,
  name: party.name,
  address: party.address ?? '',
  email: party.email ?? '',
  phone: party.phone ?? ''
});
const rateSnapshot = (item: Item): ContractRate => ({
  sourceId: item.id,
  name: item.name,
  hourlyRate: item.amount || '0'
});
const readableDate = (date: string) => date.slice(5, 7) + '/' + date.slice(8, 10) + '/' + date.slice(0, 4);

export const ContractsPage = () => {
  const dispatch = useAppDispatch();
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [styles, setStyles] = useState<StyleProfile[]>([]);
  const [clientFilter, setClientFilter] = useState('');
  const [draft, setDraft] = useState<ContractDraft | null>(null);
  const [saved, setSaved] = useState<SavedContract | null>(null);
  const [dirty, setDirty] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showAllItems, setShowAllItems] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateDirty, setTemplateDirty] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    dispatch(setAllowed(!dirty && !templateDirty));
    return () => {
      dispatch(setAllowed(true));
    };
  }, [dirty, templateDirty, dispatch]);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    const api = getApi();
    void Promise.all([
      api.listContracts(),
      api.getAllClients(),
      api.getAllBusinesses(),
      api.getAllItems(),
      api.getAllStyleProfiles()
    ])
      .then(([list, clientList, businessList, itemList, styleList]) => {
        if (!active) return;
        if (![list, clientList, businessList, itemList, styleList].every(result => result.success))
          throw new Error('Could not load contracts or catalog. Try reopening this page.');
        setContracts(list.data ?? []);
        setClients(clientList.data ?? []);
        setBusinesses(businessList.data ?? []);
        setItems(itemList.data ?? []);
        setStyles(styleList.data ?? []);
      })
      .catch(err => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load contracts.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty || templateDirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, templateDirty]);

  const change = useCallback((patch: Partial<ContractDraft>) => {
    setDraft(previous => (previous ? { ...previous, ...patch } : previous));
    setDirty(true);
    setNotice('');
    setError('');
  }, []);
  const navigate = (action: () => void) => {
    if (dirty) setPending(() => action);
    else action();
  };
  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await getApi().getContractTermsTemplate();
      if (!result.success || !result.data) throw new Error(result.message || 'Could not load standard terms.');
      if (!mounted.current) return;
      setDraft(newContractDraft(today(), result.data.terms));
      setSaved(null);
      setDirty(false);
      setStep(0);
      setNotice('');
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Could not start a contract.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const open = async (id: number) => {
    setBusy(true);
    setError('');
    try {
      const result = await getApi().getContract(id);
      if (!result.success || !result.data) throw new Error(result.message || 'Could not open this contract.');
      if (mounted.current) {
        setDraft(result.data.draft);
        setSaved(result.data);
        setDirty(false);
        setStep(0);
        setNotice('');
      }
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Could not open this contract.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const save = async () => {
    if (!draft || busy) return;
    setError('');
    setNotice('');
    try {
      validateContractDraft(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check the contract fields.');
      return;
    }
    setBusy(true);
    try {
      const result = await getApi().saveContract({ id: saved?.id, revision: saved?.revision, draft });
      if (!result.success || !result.data)
        throw new Error(result.message || 'Could not save this contract. Your edits are still here.');
      if (!mounted.current) return;
      const record = result.data;
      setSaved(record);
      setDraft(record.draft);
      setDirty(false);
      setNotice('Contract saved.');
      const summary: ContractSummary = {
        id: record.id,
        revision: record.revision,
        title: record.title,
        date: record.date,
        clientId: record.clientId,
        clientName: record.clientName,
        signed: record.signed,
        updatedAt: record.updatedAt
      };
      setContracts(previous =>
        [summary, ...previous.filter(row => row.id !== record.id)].sort(
          (a, b) => b.date.localeCompare(a.date) || b.id - a.id
        )
      );
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Could not save the contract.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const selectBusiness = async (business: Business | null) => {
    if (!business) {
      change({ business: null });
      return;
    }
    setBusy(true);
    try {
      const logo = await getOptimizedLogoUrl(business.logo ?? undefined, business.fileType);
      if (mounted.current) change({ business: { ...partySnapshot(business), ...(logo ? { logo } : {}) } });
    } catch {
      if (mounted.current) setError('Could not load the business logo. Your draft has not been changed.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const exportPdf = async () => {
    if (!draft || busy) return;
    setBusy(true);
    setError('');
    try {
      const { createContractPdf } = await import('./createContractPdf');
      const blob = await createContractPdf(draft);
      if (!mounted.current) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download =
        (draft.title
          .replace(/[^a-z0-9 _.-]/gi, '_')
          .slice(0, 100)
          .trim() || 'Contract') + ' - draft.pdf';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      setNotice('Draft PDF exported using the current contract details.');
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Could not export this contract.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const chooseRate = (rate: ContractRate, checked: boolean) => {
    if (draft)
      change({ rates: checked ? [...draft.rates, rate] : draft.rates.filter(r => r.sourceId !== rate.sourceId) });
  };
  const projectDetails = draft?.projectDetails ?? newContractProjectDetails();
  const projectDateError = Boolean(
    projectDetails.approximateStart &&
    projectDetails.approximateCompletion &&
    projectDetails.approximateCompletion < projectDetails.approximateStart
  );
  const changeProjectDetail = (key: keyof typeof projectDetails, value: string) =>
    change({ projectDetails: { ...projectDetails, [key]: value } });
  // Include saved selections even if their catalog records are now archived/deleted.
  const availableRates = new Map<number, ContractRate>();
  items
    .filter(item => !item.isArchived && (showAllItems || /^(h|hr|hrs|hour|hours)$/i.test(item.unitName?.trim() ?? '')))
    .forEach(item => availableRates.set(item.id, rateSnapshot(item)));
  draft?.rates.forEach(rate => availableRates.set(rate.sourceId, rate));
  if (draft?.assessmentRate) availableRates.set(draft.assessmentRate.sourceId, draft.assessmentRate);
  const rateOptions = [...availableRates.values()];
  const clientOptions = clients.filter(client => !client.isArchived).map(partySnapshot);
  if (draft?.client && !clientOptions.some(client => client.sourceId === draft.client?.sourceId))
    clientOptions.push(draft.client);
  const businessOptions = businesses.filter(business => !business.isArchived).map(partySnapshot);
  if (draft?.business && !businessOptions.some(business => business.sourceId === draft.business?.sourceId))
    businessOptions.push(draft.business);
  const clientFilters = new Map(
    contracts.filter(row => row.clientId !== null).map(row => [String(row.clientId), row.clientName])
  );
  let feeError = '';
  if (draft) {
    try {
      contractFeeCents(draft.assessmentRate?.hourlyRate ?? '0', draft.assessmentMultiplier);
    } catch (err) {
      feeError = err instanceof Error ? err.message : 'Invalid multiplier.';
    }
  }
  const field = (
    key:
      | 'title'
      | 'projectAddress'
      | 'scope'
      | 'billingSchedule'
      | 'paymentTerms'
      | 'materialsTerms'
      | 'standardTerms'
      | 'billableTimeTerms'
      | 'additionalTerms',
    label: string,
    rows?: number
  ) => (
    <TextField
      label={label}
      value={draft?.[key] ?? ''}
      onChange={event => change({ [key]: event.target.value })}
      fullWidth
      multiline={Boolean(rows)}
      minRows={rows}
      disabled={busy}
    />
  );

  return (
    <Box sx={{ maxWidth: 1500, mx: 'auto', pb: 3 }}>
      <Stack
        direction="row"
        sx={{ mb: 3, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
      >
        <Typography variant="h4" color="secondary">
          Contracts
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button disabled={loading || busy} onClick={() => setTemplateOpen(true)}>
            Standard terms
          </Button>
          {draft && (
            <Button
              disabled={busy}
              onClick={() =>
                navigate(() => {
                  setDraft(null);
                  setDirty(false);
                  setError('');
                  setNotice('');
                })
              }
            >
              Contract list
            </Button>
          )}
          <Button variant="contained" disabled={loading || busy} onClick={() => navigate(start)}>
            New contract
          </Button>
        </Stack>
      </Stack>
      {(loading || busy) && <LinearProgress aria-label="Loading contracts" sx={{ mb: 2 }} />}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {notice}
        </Alert>
      )}
      {!draft && !loading && (
        <>
          <TextField
            select
            label="Client"
            value={clientFilter}
            onChange={event => setClientFilter(event.target.value)}
            sx={{ minWidth: 240, mb: 2 }}
          >
            <MenuItem value="">All clients</MenuItem>
            {[...clientFilters].map(([id, name]) => (
              <MenuItem key={id} value={id}>
                {name}
              </MenuItem>
            ))}
          </TextField>
          <Stack spacing={2}>
            {contracts
              .filter(row => !clientFilter || String(row.clientId) === clientFilter)
              .map(row => (
                <Paper key={row.id} sx={{ p: 2 }}>
                  <Stack
                    direction="row"
                    sx={{ gap: 2, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}
                  >
                    <Box>
                      <Typography variant="h6">{row.title}</Typography>
                      <Typography color="text.secondary">
                        {row.clientName || 'No client selected'} · {readableDate(row.date)}
                      </Typography>
                    </Box>
                    <Stack direction="row" sx={{ gap: 2, alignItems: 'center' }}>
                      <Chip label={row.signed ? 'Signed' : 'Not signed'} color={row.signed ? 'success' : 'default'} />
                      <Button disabled={busy} onClick={() => void open(row.id)}>
                        Open contract
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            {!contracts.length && (
              <Typography color="text.secondary">Create a contract from your client and service items.</Typography>
            )}
          </Stack>
        </>
      )}
      {draft && (
        <>
          <Stepper nonLinear activeStep={step} sx={{ mb: 3, flexWrap: 'wrap', gap: 1 }}>
            {steps.map((label, index) => (
              <Step key={label}>
                <StepButton disabled={busy} onClick={() => setStep(index)}>
                  {label}
                </StepButton>
              </Step>
            ))}
          </Stepper>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.15fr) minmax(0, 1fr)' },
              gap: 3,
              alignItems: 'start'
            }}
          >
            <Box>
              <Paper sx={{ p: { xs: 2, md: 3 } }}>
                <Stack spacing={2.5}>
                  {step === 0 && (
                    <>
                      <Typography variant="h6">Client &amp; project</Typography>
                      <Autocomplete
                        options={clientOptions}
                        value={draft.client}
                        disabled={busy}
                        isOptionEqualToValue={(a, b) => a.sourceId === b.sourceId}
                        getOptionLabel={option => option.name}
                        onChange={(_, value) => change({ client: value ? { ...value } : null })}
                        renderInput={params => <TextField {...params} label="Client" />}
                      />
                      <Autocomplete
                        options={businessOptions}
                        value={draft.business}
                        disabled={busy}
                        isOptionEqualToValue={(a, b) => a.sourceId === b.sourceId}
                        getOptionLabel={option => option.name}
                        onChange={(_, value) => {
                          const current = businesses.find(business => business.id === value?.sourceId);
                          if (current) void selectBusiness(current);
                          else if (!value) change({ business: null });
                        }}
                        renderInput={params => <TextField {...params} label="Business" />}
                      />
                      {field('title', 'Project title')}
                      <TextField
                        label="Contract date"
                        type="date"
                        value={draft.date}
                        disabled={busy}
                        slotProps={{ inputLabel: { shrink: true } }}
                        onChange={event => change({ date: event.target.value })}
                      />
                      {field('projectAddress', 'Project address')}
                      {field('scope', 'Project scope', 3)}
                      <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography color="primary">Project-specific details</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Stack spacing={2}>
                            <TextField
                              label="Agreed work and materials"
                              multiline
                              minRows={3}
                              disabled={busy}
                              value={projectDetails.workAndMaterials}
                              onChange={event => changeProjectDetail('workAndMaterials', event.target.value)}
                            />
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                              <TextField
                                label="Approximate start"
                                type="date"
                                fullWidth
                                disabled={busy}
                                slotProps={{ inputLabel: { shrink: true } }}
                                value={projectDetails.approximateStart}
                                onChange={event => changeProjectDetail('approximateStart', event.target.value)}
                              />
                              <TextField
                                label="Approximate completion"
                                type="date"
                                fullWidth
                                disabled={busy}
                                slotProps={{ inputLabel: { shrink: true } }}
                                value={projectDetails.approximateCompletion}
                                error={projectDateError}
                                helperText={
                                  projectDateError ? 'Completion cannot be before the start date.' : undefined
                                }
                                onChange={event => changeProjectDetail('approximateCompletion', event.target.value)}
                              />
                            </Stack>
                            <TextField
                              label="Permit arrangements"
                              disabled={busy}
                              value={projectDetails.permitArrangements}
                              onChange={event => changeProjectDetail('permitArrangements', event.target.value)}
                            />
                            <TextField
                              label="Access, cleanup, or other agreed details"
                              multiline
                              minRows={2}
                              disabled={busy}
                              value={projectDetails.otherArrangements}
                              onChange={event => changeProjectDetail('otherArrangements', event.target.value)}
                            />
                            <Typography variant="caption" color="text.secondary">
                              Blank details are omitted from the PDF.
                            </Typography>
                          </Stack>
                        </AccordionDetails>
                      </Accordion>
                      <TextField
                        select
                        label="Style profile"
                        value={draft.style.sourceId ?? ''}
                        disabled={busy}
                        onChange={event => {
                          const style = styles.find(profile => profile.id === Number(event.target.value));
                          if (style)
                            change({
                              style: {
                                sourceId: style.id,
                                name: style.name,
                                color: style.color || '#006400',
                                fontFamily: style.fontFamily || 'Helvetica',
                                fontSize: style.fontSize || 'medium',
                                logoSize: style.logoSize || 'medium',
                                pageFormat: style.pageFormat === 'A4' ? 'A4' : 'LETTER'
                              }
                            });
                          else if (!event.target.value) change({ style: newContractDraft(today()).style });
                        }}
                      >
                        <MenuItem value="">Default</MenuItem>
                        {styles
                          .filter(style => !style.isArchived && style.id !== draft.style.sourceId)
                          .map(style => (
                            <MenuItem key={style.id} value={style.id}>
                              {style.name}
                            </MenuItem>
                          ))}
                        {draft.style.sourceId && (
                          <MenuItem value={draft.style.sourceId}>{draft.style.name} (saved selection)</MenuItem>
                        )}
                      </TextField>
                      <TextField
                        select
                        label="Paper size"
                        value={draft.style.pageFormat}
                        disabled={busy}
                        helperText="Saved with this contract."
                        onChange={event =>
                          change({
                            style: { ...draft.style, pageFormat: event.target.value === 'A4' ? 'A4' : 'LETTER' }
                          })
                        }
                      >
                        <MenuItem value="LETTER">US Letter (8.5 × 11 in)</MenuItem>
                        <MenuItem value="A4">A4 (210 × 297 mm)</MenuItem>
                      </TextField>
                    </>
                  )}
                  {step === 1 && (
                    <>
                      <Typography variant="h6">Labor rates</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Select the services to include. Saved selections retain their agreed rates.
                      </Typography>
                      {rateOptions.map(rate => (
                        <Stack
                          direction="row"
                          key={rate.sourceId}
                          sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
                        >
                          <FormControlLabel
                            control={
                              <Checkbox
                                disabled={busy}
                                checked={draft.rates.some(r => r.sourceId === rate.sourceId)}
                                onChange={(_, checked) => chooseRate(rate, checked)}
                              />
                            }
                            label={rate.name}
                          />
                          <Typography sx={{ whiteSpace: 'nowrap' }}>{contractAmount(rate.hourlyRate)} / hr</Typography>
                        </Stack>
                      ))}
                      <FormControlLabel
                        control={
                          <Checkbox checked={showAllItems} onChange={(_, checked) => setShowAllItems(checked)} />
                        }
                        label="Show all catalog items"
                      />
                      <Divider />
                      <Typography variant="h6">Assessment &amp; quoting fee</Typography>
                      <TextField
                        select
                        label="Rate item"
                        value={draft.assessmentRate?.sourceId ?? ''}
                        disabled={busy}
                        onChange={event =>
                          change({ assessmentRate: availableRates.get(Number(event.target.value)) ?? null })
                        }
                      >
                        <MenuItem value="">Select a rate item</MenuItem>
                        {rateOptions.map(rate => (
                          <MenuItem key={rate.sourceId} value={rate.sourceId}>
                            {rate.name} · {contractAmount(rate.hourlyRate)} / hr
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        label="Multiplier"
                        type="number"
                        value={draft.assessmentMultiplier}
                        disabled={busy}
                        onChange={event => change({ assessmentMultiplier: event.target.value })}
                        error={Boolean(feeError)}
                        helperText={feeError || 'Editable for each contract.'}
                        slotProps={{ htmlInput: { min: 0, max: 10000, step: 0.25 } }}
                      />
                      <Typography variant="h5" color="primary" aria-live="polite">
                        {draft.assessmentRate
                          ? contractAmount(draft.assessmentRate.hourlyRate, draft.assessmentMultiplier)
                          : '—'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Billed on the first invoice. Add this charge when you prepare that invoice.
                      </Typography>
                      <Divider />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={draft.quotedAmount !== null}
                            disabled={busy}
                            onChange={(_, checked) => change({ quotedAmount: checked ? '' : null })}
                          />
                        }
                        label="Include a cost estimate"
                      />
                      {draft.quotedAmount !== null && (
                        <TextField
                          label="Estimated project cost (USD)"
                          helperText="An estimate, not a fixed price. Final charges reflect actual time, materials, and agreed additional charges."
                          type="number"
                          value={draft.quotedAmount}
                          disabled={busy}
                          onChange={event => change({ quotedAmount: event.target.value })}
                          slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                        />
                      )}
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={Boolean(draft.retainer)}
                            disabled={busy}
                            onChange={(_, checked) =>
                              change({
                                retainer: checked
                                  ? { policy: 'estimate-ten-percent-capped-v1', terms: CONTRACT_RETAINER_TERMS }
                                  : null
                              })
                            }
                          />
                        }
                        label="Include an upfront retainer"
                      />
                      {draft.retainer && (
                        <>
                          <Typography variant="h6" color="primary" aria-live="polite">
                            Retainer: {contractRetainerAmount(draft)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {draft.quotedAmount === null
                              ? '$500 when no estimate is given.'
                              : '10% of the estimate, capped at $1,000.'}{' '}
                            Credited to the first invoice; excess carries forward and any unused balance is refunded
                            when work ends.
                          </Typography>
                          <TextField
                            label="Retainer credit and refund terms"
                            multiline
                            minRows={3}
                            disabled={busy}
                            value={draft.retainer.terms}
                            onChange={event => change({ retainer: { ...draft.retainer!, terms: event.target.value } })}
                          />
                          <Typography variant="caption" color="text.secondary">
                            California home-improvement down payments are generally limited to the lesser of $1,000 or
                            10% of the agreed contract price. An estimate does not establish that price; confirm the
                            permitted amount before collection. Record any payment received on the invoice separately.
                          </Typography>
                        </>
                      )}
                    </>
                  )}
                  {step === 2 && (
                    <>
                      <Typography variant="h6">Terms &amp; billing</Typography>
                      {field('billableTimeTerms', 'Billable time and consultation', 8)}
                      <Button
                        size="small"
                        sx={{ alignSelf: 'flex-start' }}
                        disabled={busy}
                        onClick={() => change({ billableTimeTerms: CONTRACT_BILLABLE_TIME_TERMS })}
                      >
                        Use suggested time definitions
                      </Button>
                      {field('billingSchedule', 'Billing schedule (optional)')}
                      {field('paymentTerms', 'Payment terms', 2)}
                      {field('materialsTerms', 'Materials', 2)}
                      {field('standardTerms', 'Standard terms for this contract', 8)}
                      <ArbitrationFields
                        value={draft.arbitration}
                        disabled={busy}
                        onChange={arbitration => change({ arbitration })}
                      />
                      {field('additionalTerms', 'Additional charges / project terms', 3)}
                      <Typography variant="body2" color="text.secondary">
                        Edits apply to this contract. Other saved contracts retain their own terms.
                      </Typography>
                    </>
                  )}
                  {step === 3 && (
                    <>
                      <Typography variant="h6">Review contract</Typography>
                      <Typography>{draft.title || 'Project title needed'}</Typography>
                      <Typography>
                        {draft.business?.name || 'Business not selected'} ·{' '}
                        {draft.client?.name || 'Client not selected'}
                      </Typography>
                      <Typography>
                        Assessment fee:{' '}
                        {draft.assessmentRate
                          ? contractAmount(draft.assessmentRate.hourlyRate, draft.assessmentMultiplier)
                          : 'Rate not selected'}
                      </Typography>
                      {draft.retainer && <Typography>Retainer: {contractRetainerAmount(draft)}</Typography>}
                      <FormControlLabel
                        control={
                          <Checkbox
                            disabled={busy}
                            checked={draft.signed}
                            onChange={(_, checked) => change({ signed: checked })}
                          />
                        }
                        label="Signed"
                      />
                      <Typography variant="body2" color="text.secondary">
                        The signed toggle records status only. Both parties sign the printed agreement.
                      </Typography>
                      <Alert severity="info">
                        Exports are marked draft for review. Arbitration includes its notice and separate initials when
                        enabled. Other required California residential terms and statutory notices are not automatically
                        supplied.
                      </Alert>
                      <Button variant="contained" disabled={busy} onClick={() => void exportPdf()}>
                        Export draft PDF
                      </Button>
                    </>
                  )}
                </Stack>
              </Paper>
              <Stack direction="row" sx={{ mt: 2, flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                <Button disabled={step === 0 || busy} onClick={() => setStep(value => value - 1)}>
                  Back
                </Button>
                <Typography variant="caption" color="text.secondary">
                  {dirty ? 'Unsaved changes' : saved ? 'Saved' : 'New contract'}
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Button disabled={busy} onClick={() => void save()}>
                  Save draft
                </Button>
                {step < 3 && (
                  <Button variant="contained" disabled={busy} onClick={() => setStep(value => value + 1)}>
                    Next
                  </Button>
                )}
              </Stack>
            </Box>
            <ContractPreview draft={draft} />
          </Box>
        </>
      )}
      <Dialog open={Boolean(pending)} onClose={() => setPending(null)}>
        <DialogTitle>Discard unsaved contract changes?</DialogTitle>
        <DialogContent>Your saved contract will remain unchanged.</DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)}>Keep editing</Button>
          <Button
            color="error"
            onClick={() => {
              const action = pending;
              setPending(null);
              action?.();
            }}
          >
            Discard changes
          </Button>
        </DialogActions>
      </Dialog>
      {templateOpen && (
        <StandardTermsDialog
          onClose={() => {
            setTemplateOpen(false);
            setTemplateDirty(false);
          }}
          onSaved={() => {
            setTemplateOpen(false);
            setTemplateDirty(false);
            setNotice('Standard terms saved for new contracts.');
          }}
          onDirtyChange={setTemplateDirty}
        />
      )}
    </Box>
  );
};
