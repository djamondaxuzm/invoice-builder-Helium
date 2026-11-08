import type { ContractDraft, ContractParty, ContractRate, ContractTerms } from '../types/contracts';

export const CONTRACT_TIME_TERMS =
  "Each worker's separate billable work session or complete errand is rounded up once to the next 15-minute increment, then billed at its applicable rate. Travel, shopping and waiting within one continuous errand are not rounded separately. Nonbillable time is excluded before rounding. There is no additional minimum visit charge.";
export const CONTRACT_TRAVEL_TERMS =
  "Job errands and work travel are billed at 50% of each worker's applicable hourly rate. The entire job-related errand is half rate, including required travel, selecting and purchasing materials, checkout, pickup, returns and waiting. Travel between project locations is also half rate. Ordinary commuting to the first worksite and home from the last worksite is excluded.";
export const CONTRACT_ESTIMATE_TERMS =
  'This is an estimate, not a fixed price. Final charges are based on actual billable time, materials purchased at cost, and any agreed additional charges.';
export const CONTRACT_CHANGE_TERMS =
  'Changes to the agreed work will be described in writing and signed by both parties before that changed work begins. The written change will identify the work, any resulting cost changes, and any effect on the payment schedule or completion date.';
export const CONTRACT_BILLABLE_TIME_TERMS = [
  "Regular billable hours cover each worker's agreed work, preparation, substantive project coordination and cleanup. Job errands and work travel use the half rate below. Breaks and personal time are excluded.",
  CONTRACT_TRAVEL_TERMS,
  'Substantial client-requested consultation or planning, including extended calls, meetings, written exchanges, and materials research or selection performed separately from an errand, is billed at regular rates even if the work discussed never proceeds. Materials selection during an errand remains half rate. Signing this agreement provides notice; no separate warning is required. Brief scheduling, status updates and billing questions are not billable. Consultation does not authorize changes to the agreed work. Initial consultation, assessment and quoting time is billed as full-rate hourly labor on the first invoice. Each period of work is billed once at its applicable rate.',
  CONTRACT_TIME_TERMS
].join('\n\n');
export const CONTRACT_RETAINER_TERMS =
  'The retainer is due before work begins, subject to applicable down-payment limits. It is an advance toward charges, not an extra fee. Payments received are credited to the first invoice, including its consultation and assessment labor charges. Excess credit carries forward; any balance remaining after final charges is refunded when work ends.';
export const CONTRACT_CANCELLATION_TERMS =
  'Either party may cancel by written notice. Subject to statutory cancellation and refund rights, the client pays for properly billable work and agreed, non-cancelable costs incurred before receipt of notice.';
export const CONTRACT_AUTHORIZATION_TERMS =
  'The client authorizes the business identified in this agreement to perform the agreed services. This agreement and signed written changes state the entire agreement between the parties for those services.';
export const CONTRACT_LATE_CHARGE_TERMS =
  'After the 15-day payment deadline, unpaid invoice principal is subject to a simple, non-compounding late charge of 1.5% per month (18% per year), only to the extent permitted by applicable law. Late charges are not charged on prior late charges.';

// Statutory notice: California Business and Professions Code section 7191(b).
// Stored with each draft so future default changes do not rewrite existing agreements.
export const newContractArbitration = (): NonNullable<ContractDraft['arbitration']> => ({
  terms:
    'Disputes arising out of or relating to this agreement shall be resolved by binding neutral arbitration administered by the American Arbitration Association under its rules applicable to the dispute, including required consumer protections. This provision does not waive non-waivable rights or prevent complaints to the Contractors State License Board.',
  notice:
    "NOTICE: BY INITIALING IN THE SPACE BELOW YOU ARE AGREEING TO HAVE ANY DISPUTE ARISING OUT OF THE MATTERS INCLUDED IN THE 'ARBITRATION OF DISPUTES' PROVISION DECIDED BY NEUTRAL ARBITRATION AS PROVIDED BY CALIFORNIA LAW AND YOU ARE GIVING UP ANY RIGHTS YOU MIGHT POSSESS TO HAVE THE DISPUTE LITIGATED IN A COURT OR JURY TRIAL.\n\nBY INITIALING IN THE SPACE BELOW YOU ARE GIVING UP YOUR JUDICIAL RIGHTS TO DISCOVERY AND APPEAL, UNLESS THOSE RIGHTS ARE SPECIFICALLY INCLUDED IN THE 'ARBITRATION OF DISPUTES' PROVISION. IF YOU REFUSE TO SUBMIT TO ARBITRATION AFTER AGREEING TO THIS PROVISION, YOU MAY BE COMPELLED TO ARBITRATE UNDER THE AUTHORITY OF THE BUSINESS AND PROFESSIONS CODE OR OTHER APPLICABLE LAWS. YOUR AGREEMENT TO THIS ARBITRATION PROVISION IS VOLUNTARY.\n\nWE HAVE READ AND UNDERSTAND THE FOREGOING AND AGREE TO SUBMIT DISPUTES ARISING OUT OF THE MATTERS INCLUDED IN THE 'ARBITRATION OF DISPUTES' PROVISION TO NEUTRAL ARBITRATION."
});

export const newContractProjectDetails = (): NonNullable<ContractDraft['projectDetails']> => ({
  workAndMaterials: '',
  approximateStart: '',
  approximateCompletion: '',
  permitArrangements: '',
  otherArrangements: ''
});

export const defaultContractTerms = (): ContractTerms => ({
  billingSchedule: '',
  paymentTerms: 'Invoices are due within 15 days of invoice notice.\n\n' + CONTRACT_LATE_CHARGE_TERMS,
  arbitration: newContractArbitration(),
  materialsTerms:
    'Purchased materials and agreed third-party project costs are reimbursed at cost, without markup. Third-party consultant services, printing and governmental or permit fees are excluded from an estimate unless expressly included. We do not collect sales tax.',
  billableTimeTerms: CONTRACT_BILLABLE_TIME_TERMS,
  standardTerms: [CONTRACT_CHANGE_TERMS, CONTRACT_CANCELLATION_TERMS, CONTRACT_AUTHORIZATION_TERMS].join('\n\n')
});

export const newContractDraft = (date: string, terms: ContractTerms = defaultContractTerms()): ContractDraft => ({
  schemaVersion: 1,
  title: '',
  date,
  projectAddress: '',
  scope:
    'Work and services as discussed and agreed with the client. Services will be performed in accordance with generally accepted practices appropriate to the agreed work. Services outside the scope described in this agreement and signed written changes are not included.',
  projectDetails: newContractProjectDetails(),
  business: null,
  client: null,
  rates: [],
  assessmentRate: null,
  assessmentMultiplier: '2',
  quotedAmount: null,
  retainer: { policy: 'estimate-ten-percent-capped-v1', terms: CONTRACT_RETAINER_TERMS },
  ...terms,
  additionalTerms: '',
  signed: false,
  style: { name: 'Default', color: '#006400', fontFamily: 'Helvetica', pageFormat: 'LETTER' }
});

const decimal = (value: unknown): bigint => {
  if (typeof value !== 'string' || !/^\d{1,9}(?:\.\d{1,4})?$/.test(value)) {
    throw new Error('Enter a non-negative amount with up to four decimal places.');
  }
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'));
};

/** Multiply decimal strings exactly, then round half up once to currency cents. */
export const contractFeeCents = (hourlyRate: string, multiplier: string): number => {
  const units = decimal(multiplier);
  if (units > 10000n * 10000n) throw new Error('The multiplier must be 10,000 or less.');
  const cents = (decimal(hourlyRate) * units + 500000n) / 1000000n;
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('The calculated amount is too large.');
  return Number(cents);
};

/** No estimate means $500; an estimate means 10%, rounded to cents and capped at $1,000. */
export const contractRetainerCents = (draft: Pick<ContractDraft, 'quotedAmount'>): number =>
  draft.quotedAmount === null ? 50000 : Math.min(contractFeeCents(draft.quotedAmount, '0.1'), 100000);

const text = (value: unknown, max = 20000): value is string => typeof value === 'string' && value.length <= max;
const validDate = (value: unknown): value is string =>
  text(value, 10) &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
const validateArbitration = (value: ContractDraft['arbitration']) => {
  if (
    value !== undefined &&
    value !== null &&
    (typeof value !== 'object' ||
      !text(value.terms) ||
      !value.terms.trim() ||
      !text(value.notice) ||
      !value.notice.trim())
  ) {
    throw new Error('Arbitration terms and notice must both be present.');
  }
};
export const validateContractTerms = (value: unknown): ContractTerms => {
  if (!value || typeof value !== 'object') throw new Error('Invalid standard terms.');
  const terms = value as ContractTerms;
  validateArbitration(terms.arbitration);
  if (![terms.billingSchedule, terms.paymentTerms, terms.materialsTerms, terms.standardTerms].every(v => text(v))) {
    throw new Error('Standard terms are missing or too long.');
  }
  if (terms.billableTimeTerms !== undefined && !text(terms.billableTimeTerms)) {
    throw new Error('Billable time terms are invalid or too long.');
  }
  return {
    ...(terms.arbitration !== undefined ? { arbitration: terms.arbitration } : {}),
    ...(terms.billableTimeTerms !== undefined ? { billableTimeTerms: terms.billableTimeTerms } : {}),
    billingSchedule: terms.billingSchedule,
    paymentTerms: terms.paymentTerms,
    materialsTerms: terms.materialsTerms,
    standardTerms: terms.standardTerms
  };
};
const id = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const party = (value: ContractParty | null) =>
  value === null ||
  (typeof value === 'object' &&
    id(value.sourceId) &&
    text(value.name, 500) &&
    value.name.trim().length > 0 &&
    text(value.address, 2000) &&
    text(value.email, 500) &&
    text(value.phone, 100) &&
    (value.logo === undefined ||
      (text(value.logo, 4 * 1024 * 1024) && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value.logo))));
const rate = (value: ContractRate) => {
  if (!value || !id(value.sourceId) || !text(value.name, 500) || !value.name.trim()) return false;
  decimal(value.hourlyRate);
  return true;
};

/** Validate at the persistence boundary, including drafts received over IPC or HTTP. */
export const validateContractDraft = (value: unknown): ContractDraft => {
  if (!value || typeof value !== 'object') throw new Error('Invalid contract draft.');
  const d = value as ContractDraft;
  validateArbitration(d.arbitration);
  if (d.billableTimeTerms !== undefined && !text(d.billableTimeTerms)) {
    throw new Error('Billable time terms are invalid or too long.');
  }
  if (d.retainer !== undefined && d.retainer !== null) {
    if (
      typeof d.retainer !== 'object' ||
      d.retainer.policy !== 'estimate-ten-percent-capped-v1' ||
      !text(d.retainer.terms) ||
      !d.retainer.terms.trim()
    ) {
      throw new Error('Invalid retainer policy or missing credit/refund terms.');
    }
    contractRetainerCents(d);
  }
  if (d.schemaVersion !== 1 || !text(d.title, 200) || !d.title.trim() || typeof d.signed !== 'boolean') {
    throw new Error('Enter a project title for this contract.');
  }
  if (!validDate(d.date)) {
    throw new Error('Enter a valid contract date.');
  }
  if (d.projectDetails !== undefined) {
    const details = d.projectDetails;
    if (
      !details ||
      typeof details !== 'object' ||
      ![details.workAndMaterials, details.permitArrangements, details.otherArrangements].every(v => text(v))
    ) {
      throw new Error('Invalid project details.');
    }
    if (![details.approximateStart, details.approximateCompletion].every(v => v === '' || validDate(v))) {
      throw new Error('Enter valid project dates or leave them blank.');
    }
    if (
      details.approximateStart &&
      details.approximateCompletion &&
      details.approximateCompletion < details.approximateStart
    ) {
      throw new Error('Approximate completion cannot be before the start date.');
    }
  }
  if (
    ![
      d.projectAddress,
      d.scope,
      d.billingSchedule,
      d.paymentTerms,
      d.materialsTerms,
      d.standardTerms,
      d.additionalTerms
    ].every(v => text(v))
  ) {
    throw new Error('Contract text is missing or too long.');
  }
  if (!party(d.business) || !party(d.client)) throw new Error('Invalid business or client details.');
  if (
    !Array.isArray(d.rates) ||
    d.rates.length > 100 ||
    !d.rates.every(rate) ||
    new Set(d.rates.map(r => r.sourceId)).size !== d.rates.length ||
    (d.assessmentRate !== null && !rate(d.assessmentRate))
  )
    throw new Error('Invalid contract rates.');
  contractFeeCents(d.assessmentRate?.hourlyRate ?? '0', d.assessmentMultiplier);
  if (d.quotedAmount !== null) decimal(d.quotedAmount);
  if (
    !d.style ||
    !text(d.style.name, 500) ||
    !text(d.style.fontFamily, 100) ||
    !/^#[0-9a-f]{6}$/i.test(d.style.color) ||
    !['LETTER', 'A4'].includes(d.style.pageFormat) ||
    (d.style.fontSize !== undefined && !['small', 'medium', 'large'].includes(d.style.fontSize)) ||
    (d.style.logoSize !== undefined && !['small', 'medium', 'large'].includes(d.style.logoSize)) ||
    (d.style.sourceId !== undefined && !id(d.style.sourceId))
  )
    throw new Error('Invalid contract style.');
  return d;
};
