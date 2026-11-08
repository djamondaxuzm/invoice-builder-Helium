export interface ContractParty {
  sourceId: number;
  name: string;
  address: string;
  email: string;
  phone: string;
  logo?: string;
}

export interface ContractRate {
  sourceId: number;
  name: string;
  hourlyRate: string;
}

export interface ContractStyle {
  sourceId?: number;
  name: string;
  color: string;
  fontFamily: string;
  pageFormat: 'LETTER' | 'A4';
  fontSize?: 'small' | 'medium' | 'large';
  logoSize?: 'small' | 'medium' | 'large';
}

export interface ContractDraft {
  schemaVersion: 1;
  title: string;
  date: string;
  projectAddress: string;
  scope: string;
  /** Optional in drafts saved before project-specific details were introduced. */
  projectDetails?: {
    workAndMaterials: string;
    approximateStart: string;
    approximateCompletion: string;
    permitArrangements: string;
    otherArrangements: string;
  };
  business: ContractParty | null;
  client: ContractParty | null;
  rates: ContractRate[];
  assessmentRate: ContractRate | null;
  assessmentMultiplier: string;
  /** Optional estimate, not a fixed price. Retain the field name for saved-draft compatibility. */
  quotedAmount: string | null;
  billingSchedule: string;
  paymentTerms: string;
  materialsTerms: string;
  standardTerms: string;
  additionalTerms: string;
  signed: boolean;
  style: ContractStyle;
}

export interface ContractSummary {
  id: number;
  revision: number;
  title: string;
  date: string;
  clientId: number | null;
  clientName: string;
  signed: boolean;
  updatedAt: string;
}

export interface SavedContract extends ContractSummary {
  draft: ContractDraft;
}

export interface SaveContractRequest {
  id?: number;
  revision?: number;
  draft: ContractDraft;
}

export type ContractTerms = Pick<
  ContractDraft,
  'billingSchedule' | 'paymentTerms' | 'materialsTerms' | 'standardTerms'
>;

export interface ContractTermsTemplate {
  revision: number;
  terms: ContractTerms;
}
