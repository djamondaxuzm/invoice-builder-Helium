import type { ContractDraft, ContractParty, ContractRate, ContractTerms } from '../types/contracts';

export const CONTRACT_TIME_TERMS =
  'Billable time is rounded up to the next 15-minute increment. There is no minimum charge per visit.';
export const CONTRACT_TRAVEL_TERMS =
  "Only travel required to perform the client's work is billed at 50% of the applicable hourly rate. Ordinary commuting to and from the worksite is not billed.";
export const CONTRACT_ESTIMATE_TERMS =
  'This is an estimate, not a fixed price. Final charges are based on actual billable time, materials purchased at cost, and any agreed additional charges.';
export const CONTRACT_CHANGE_TERMS =
  'Changes to the agreed work will be described in writing and signed by both parties before that changed work begins. The written change will identify the work, any resulting cost changes, and any effect on the payment schedule or completion date.';

export const newContractProjectDetails = (): NonNullable<ContractDraft['projectDetails']> => ({
  workAndMaterials: '',
  approximateStart: '',
  approximateCompletion: '',
  permitArrangements: '',
  otherArrangements: ''
});

export const defaultContractTerms = (): ContractTerms => ({
  billingSchedule: '',
  paymentTerms: 'Invoices are due within 15 days of invoice notice.',
  materialsTerms: 'Purchased materials are reimbursed at cost, without markup.',
  standardTerms: `${CONTRACT_TIME_TERMS}\n\n${CONTRACT_TRAVEL_TERMS}\n\nThe assessment and quoting fee is included on the first invoice.\n\nWe do not collect sales tax.\n\n${CONTRACT_CHANGE_TERMS}`
});

export const newContractDraft = (date: string, terms: ContractTerms = defaultContractTerms()): ContractDraft => ({
  schemaVersion: 1,
  title: '',
  date,
  projectAddress: '',
  scope: 'Work and services as discussed and agreed with the client.',
  projectDetails: newContractProjectDetails(),
  business: null,
  client: null,
  rates: [],
  assessmentRate: null,
  assessmentMultiplier: '2',
  quotedAmount: null,
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

const text = (value: unknown, max = 20000): value is string => typeof value === 'string' && value.length <= max;
const validDate = (value: unknown): value is string =>
  text(value, 10) &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
export const validateContractTerms = (value: unknown): ContractTerms => {
  if (!value || typeof value !== 'object') throw new Error('Invalid standard terms.');
  const terms = value as ContractTerms;
  if (![terms.billingSchedule, terms.paymentTerms, terms.materialsTerms, terms.standardTerms].every(v => text(v))) {
    throw new Error('Standard terms are missing or too long.');
  }
  return {
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
