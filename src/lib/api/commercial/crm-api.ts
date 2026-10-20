import { apiClient } from '@/lib/api-client';
import type {
  CreateCrmLeadInput,
  CrmLead,
  LeadStatus,
  QualifyLeadResult,
} from '@/types/crm';

export const crmApi = {
  listLeads(status?: LeadStatus): Promise<CrmLead[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return apiClient.get<CrmLead[]>(`/crm/leads${query}`);
  },

  createLead(input: CreateCrmLeadInput): Promise<CrmLead> {
    return apiClient.post<CrmLead, CreateCrmLeadInput>('/crm/leads', input);
  },

  markLeadContacted(id: string): Promise<CrmLead> {
    return apiClient.patch<CrmLead, { status: LeadStatus }>(
      `/crm/leads/${encodeURIComponent(id)}/status`,
      { status: 'CONTACTED' },
    );
  },

  qualifyLead(id: string): Promise<QualifyLeadResult> {
    return apiClient.post<QualifyLeadResult>(
      `/crm/leads/${encodeURIComponent(id)}/qualify`,
    );
  },
};
