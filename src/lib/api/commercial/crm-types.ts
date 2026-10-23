export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'DISQUALIFIED';

export interface CrmLead {
  id: string;
  topic: string;
  firstName: string | null;
  lastName: string;
  companyName: string | null;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  estimatedRevenue: number | string | null;
  status: LeadStatus;
  createdAt: string;
  updatedAt: string;
  convertedAccountId: string | null;
  convertedContactId: string | null;
  convertedOppId: string | null;
}

export interface CreateCrmLeadInput {
  topic: string;
  firstName?: string;
  lastName: string;
  companyName?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  source?: string;
  estimatedRevenue?: number;
}

export interface QualifyLeadResult {
  lead: CrmLead;
  account: { id: string; name: string | null } | null;
  contact: { id: string; name: string };
  opportunity: { id: string; name: string };
}
