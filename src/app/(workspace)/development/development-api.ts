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
export type TestDataModuleKey = 'settings' | 'rahcom';
export type TestDataModuleStatus = {
  moduleKey: TestDataModuleKey;
  applied: boolean;
  appliedAt: string | null;
  recordCounts: Record<string, number>;
  totalRecords: number;
};

export type SiteVisitsRange = '7d' | '30d' | '90d' | 'all';
export type SiteVisitSummary = { onlineVisitors: number; uniqueIps: number; devices: number; sessions: number; pageViews: number };
export type SiteVisitor = { id: string; visitorId: string | null; label: string | null; userAgent: string | null; ipAddress: string; ipAddresses: string[]; visits: number; pageViews: number; durationSeconds: number; modules: string[]; lastSeenAt: string | null; online: boolean };
export type SiteVisitorPageView = { path: string; moduleKey: string; enteredAt: string; leftAt: string | null; durationSeconds: number };
export type SiteVisitorSession = { id: string; ipAddress: string; startedAt: string; lastSeenAt: string; endedAt: string | null; pageViews: SiteVisitorPageView[] };

const HEADER_SWITCHER_EVENT = 'development-header-switcher-setting-changed';
const HEADER_SWITCHER_KEY_PREFIX = 'development-header-account-switcher:';

function headerSwitcherKey(userId: string) {
  return `${HEADER_SWITCHER_KEY_PREFIX}${userId}`;
}

export function isHeaderAccountSwitcherEnabled(userId?: string) {
  if (typeof window === 'undefined' || !userId) return false;
  const saved = window.localStorage.getItem(headerSwitcherKey(userId));
  return saved === null ? true : saved === 'true';
}

export function setHeaderAccountSwitcherEnabled(userId: string, enabled: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(headerSwitcherKey(userId), String(enabled));
  window.dispatchEvent(new CustomEvent(HEADER_SWITCHER_EVENT, { detail: { userId } }));
}

export function getHeaderAccountSwitcherPreferenceEvent() {
  return HEADER_SWITCHER_EVENT;
}

export function getHeaderAccountSwitcherPreferenceKey(userId: string) {
  return headerSwitcherKey(userId);
}

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
    return apiClient.post<TestDataModuleStatus>(`/development/test-data/${moduleKey}/apply`);
  },
  getSiteVisits(range: SiteVisitsRange, page: number, search: string) {
    const params = new URLSearchParams({ range, page: String(page), search });
    return apiClient.get<{ available: boolean; summary: SiteVisitSummary | null; visitors: SiteVisitor[]; page: number; pageSize: number; totalVisitors: number }>(`/development/site-visits?${params}`);
  },
  getSiteVisitorDetails(visitorKey: string, range: SiteVisitsRange) {
    const params = new URLSearchParams({ range });
    return apiClient.get<{ available: boolean; sessions: SiteVisitorSession[] }>(`/development/site-visits/${encodeURIComponent(visitorKey)}?${params}`);
  },
  labelSiteVisitorDevice(visitorId: string, label: string) {
    return apiClient.put<{ available: boolean; visitorId: string; label: string | null }>(`/development/site-visits/devices/${encodeURIComponent(visitorId)}/label`, { label });
  },
};
