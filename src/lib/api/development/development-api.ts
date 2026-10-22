import { apiClient } from '@/lib/api-client';

export type DevelopmentAccount = {
  id: string;
  username: string;
  email: string | null;
  name: string;
};

export type ImpersonationContext =
  | { isImpersonating: false }
  | {
      isImpersonating: true;
      actor: { id: string; username: string; name: string } | null;
      target: { id: string; username: string; name: string } | null;
    };

type AccessTokenResponse = { access_token: string };
export type TestDataModuleKey = 'rahcom' | 'settings';
export type TestDataModuleStatus = {
  moduleKey: TestDataModuleKey;
  applied: boolean;
  appliedAt: string | null;
  recordCounts: Record<string, number>;
  totalRecords: number;
};
export type TestDataAccountCredential = { name: string; username: string; email: string; password: string; province: string };
export type TestDataApplyResult = TestDataModuleStatus & { accounts?: TestDataAccountCredential[] };

export type SiteVisitsRange = '7d' | '30d' | '90d' | 'all';
export type SiteVisitSummary = { onlineVisitors: number; uniqueIps: number; sessions: number; pageViews: number };
export type SiteVisitor = { ipAddress: string; visits: number; pageViews: number; durationSeconds: number; modules: string[]; lastSeenAt: string | null; online: boolean };
export type SiteVisitorPageView = { path: string; moduleKey: string; enteredAt: string; leftAt: string | null; durationSeconds: number };
export type SiteVisitorSession = { id: string; startedAt: string; lastSeenAt: string; endedAt: string | null; pageViews: SiteVisitorPageView[] };

export const developmentApi = {
  getAccounts() {
    return apiClient.get<{ accounts: DevelopmentAccount[] }>('/development/accounts');
  },
  switchAccount(userId: string) {
    return apiClient.post<AccessTokenResponse>(
      `/development/accounts/${encodeURIComponent(userId)}/switch`,
    );
  },
  getImpersonationContext() {
    return apiClient.get<ImpersonationContext>('/development/impersonation');
  },
  stopImpersonation() {
    return apiClient.post<AccessTokenResponse>('/development/impersonation/stop');
  },
  getTestDataStatus() {
    return apiClient.get<{ modules: TestDataModuleStatus[] }>('/development/test-data/status');
  },
  applyTestData(moduleKey: TestDataModuleKey) {
    return apiClient.post<TestDataApplyResult>(`/development/test-data/${moduleKey}/apply`);
  },
  getSiteVisits(range: SiteVisitsRange, page: number, search: string) {
    const params = new URLSearchParams({ range, page: String(page), search });
    return apiClient.get<{ available: boolean; summary: SiteVisitSummary | null; visitors: SiteVisitor[]; page: number; pageSize: number; totalVisitors: number }>(`/development/site-visits?${params}`);
  },
  getSiteVisitorDetails(ipAddress: string, range: SiteVisitsRange) {
    const params = new URLSearchParams({ range });
    return apiClient.get<{ available: boolean; sessions: SiteVisitorSession[] }>(`/development/site-visits/${encodeURIComponent(ipAddress)}?${params}`);
  },
};
