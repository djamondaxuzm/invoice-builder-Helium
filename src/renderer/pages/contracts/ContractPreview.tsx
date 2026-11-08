import { Box, Divider, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import type { ContractDraft } from '../../../backend/shared/types/contracts';
import {
  contractFeeCents,
  contractRetainerCents,
  CONTRACT_ESTIMATE_TERMS
} from '../../../backend/shared/utils/contracts';

export const contractMoney = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export const contractAmount = (rate: string, multiplier = '1') => {
  try {
    return contractMoney(contractFeeCents(rate, multiplier));
  } catch {
    return '—';
  }
};

export const contractRetainerAmount = (draft: ContractDraft) => {
  try {
    return contractMoney(contractRetainerCents(draft));
  } catch {
    return 'Enter a valid estimate';
  }
};

export const ContractPreview = ({ draft }: { draft: ContractDraft }) => {
  const section = (title: string, children: ReactNode) => (
    <Box sx={{ mt: 2.5 }}>
      <Typography sx={{ color: draft.style.color, fontWeight: 600, mb: 0.7, fontSize: 14 }}>{title}</Typography>
      <Divider sx={{ borderColor: '#cbd8cb', mb: 1 }} />
      {children}
    </Box>
  );
  const font = draft.style.fontFamily === 'Times-Roman' ? 'Georgia, serif' : draft.style.fontFamily;
  return (
    <Box component="aside" aria-label="Contract document preview" sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        Document preview · {draft.style.pageFormat === 'LETTER' ? 'US Letter' : 'A4'}
      </Typography>
      <Box
        sx={{
          mt: 1,
          p: { xs: 2, lg: 3 },
          bgcolor: '#fff',
          color: '#222',
          fontFamily: font,
          overflowWrap: 'anywhere',
          '& p': { fontFamily: 'inherit', fontSize: 12, whiteSpace: 'pre-wrap' }
        }}
      >
        <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ color: draft.style.color, fontWeight: 600 }}>
              {draft.business?.name || 'Your business'}
            </Typography>
            <Typography>{draft.business?.address}</Typography>
            <Typography>{[draft.business?.email, draft.business?.phone].filter(Boolean).join(' · ')}</Typography>
          </Box>
          {draft.business?.logo && (
            <Box
              component="img"
              src={draft.business.logo}
              alt="Business logo"
              sx={{ width: 64, height: 64, objectFit: 'contain', flexShrink: 0 }}
            />
          )}
        </Stack>
        <Typography component="h2" sx={{ fontFamily: 'inherit', fontSize: 24, mt: 2, color: draft.style.color }}>
          Work &amp; billing agreement
        </Typography>
        <Typography sx={{ mt: 1 }}>
          {draft.client?.name || 'Select a client'}
          {draft.title ? ' · ' + draft.title : ''}
        </Typography>
        <Typography>
          {draft.date ? draft.date.slice(5, 7) + '/' + draft.date.slice(8) + '/' + draft.date.slice(0, 4) : ''}
        </Typography>
        {section(
          'Project',
          <>
            <Typography>{draft.scope}</Typography>
            <Typography>{draft.projectAddress}</Typography>
            <Typography>{draft.projectDetails?.workAndMaterials}</Typography>
            {draft.projectDetails?.approximateStart && (
              <Typography>
                Approximate start: {draft.projectDetails.approximateStart.slice(5, 7)}/
                {draft.projectDetails.approximateStart.slice(8, 10)}/{draft.projectDetails.approximateStart.slice(0, 4)}
              </Typography>
            )}
            {draft.projectDetails?.approximateCompletion && (
              <Typography>
                Approximate completion: {draft.projectDetails.approximateCompletion.slice(5, 7)}/
                {draft.projectDetails.approximateCompletion.slice(8, 10)}/
                {draft.projectDetails.approximateCompletion.slice(0, 4)}
              </Typography>
            )}
            {draft.projectDetails?.permitArrangements && (
              <Typography>Permits: {draft.projectDetails.permitArrangements}</Typography>
            )}
            <Typography>{draft.projectDetails?.otherArrangements}</Typography>
          </>
        )}
        {section(
          'Rates & billable time',
          <>
            {draft.rates.map(rate => (
              <Stack key={rate.sourceId} direction="row" sx={{ my: 1, justifyContent: 'space-between', gap: 1 }}>
                <Typography>{rate.name}</Typography>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ whiteSpace: 'nowrap' }}>{contractAmount(rate.hourlyRate)} / hr</Typography>
                  <Typography>Half-rate time: {contractAmount(rate.hourlyRate, '0.5')} / hr</Typography>
                </Box>
              </Stack>
            ))}
            {!draft.rates.length && <Typography>No labor rates selected.</Typography>}
            {draft.billableTimeTerms && <Typography sx={{ mt: 2 }}>{draft.billableTimeTerms}</Typography>}
          </>
        )}
        {section(
          'Charges & payment',
          <>
            <Typography>
              Consultation &amp; assessment:{' '}
              {draft.assessmentRate
                ? contractAmount(draft.assessmentRate.hourlyRate, draft.assessmentMultiplier)
                : 'Select a rate item'}
            </Typography>
            {draft.assessmentRate && (
              <Typography>
                {draft.assessmentRate.name} ({contractAmount(draft.assessmentRate.hourlyRate)} / hr) ×{' '}
                {draft.assessmentMultiplier}
              </Typography>
            )}
            <Typography>Billed as full-rate hourly labor on the first invoice.</Typography>
            {draft.quotedAmount !== null && (
              <Typography sx={{ mt: 2 }}>
                Estimated project cost: {contractAmount(draft.quotedAmount)}. {CONTRACT_ESTIMATE_TERMS}
              </Typography>
            )}
            {draft.retainer && (
              <>
                <Typography sx={{ mt: 2, fontWeight: 600 }}>
                  Upfront retainer: {contractRetainerAmount(draft)}
                </Typography>
                <Typography>
                  {draft.quotedAmount === null ? '$500; no estimate given.' : '10% of the estimate, capped at $1,000.'}
                </Typography>
                <Typography>{draft.retainer.terms}</Typography>
              </>
            )}
            <Typography sx={{ mt: 2 }}>{draft.materialsTerms}</Typography>
            <Typography sx={{ mt: 1 }}>{draft.billingSchedule}</Typography>
            <Typography>{draft.paymentTerms}</Typography>
            <Typography sx={{ mt: 2 }}>{draft.standardTerms}</Typography>
            {draft.additionalTerms && <Typography sx={{ mt: 2 }}>{draft.additionalTerms}</Typography>}
          </>
        )}
        {draft.arbitration &&
          section(
            'ARBITRATION OF DISPUTES',
            <>
              <Typography sx={{ fontWeight: 700, textTransform: 'uppercase' }}>{draft.arbitration.terms}</Typography>
              <Typography sx={{ mt: 2, fontWeight: 700, textTransform: 'uppercase' }}>
                {draft.arbitration.notice}
              </Typography>
              <Typography sx={{ mt: 2 }}>Business initials: __________ Client initials: __________</Typography>
            </>
          )}
        <Stack direction="row" spacing={3} sx={{ mt: 5 }}>
          {['For ' + (draft.business?.name || 'the business'), 'Client'].map(label => (
            <Box key={label} sx={{ width: '50%', pt: 1, borderTop: '1px solid #888' }}>
              <Typography>{label}</Typography>
              <Typography sx={{ mt: 2 }}>Printed name: __________</Typography>
              <Typography sx={{ mt: 1 }}>Date: _________________</Typography>
            </Box>
          ))}
        </Stack>
        <Typography sx={{ mt: 3, color: '#666' }}>DRAFT PREVIEW · Terms under review</Typography>
      </Box>
    </Box>
  );
};
