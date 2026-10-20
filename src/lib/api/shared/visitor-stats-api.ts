import { apiClient } from '@/lib/api-client';

const VISITOR_API_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://rahyar-back-piuy.vercel.app'
    : 'http://localhost:3016')
).replace(/\/+$/, '');

export type VisitorStats = {
  enabled: boolean;
  daily: number;
  weekly: number;
  monthly: number;
  yearly: number;
  online: number;
  uniqueIps: number;
  visits: number;
};

let fallbackVisitorId: string | null = null;
const VISITOR_ID_KEY = 'erp-visitor-id';
const SESSION_ID_KEY = 'erp-visitor-session-id';
const disabledStats = { enabled: false, daily: 0, weekly: 0, monthly: 0, yearly: 0, online: 0, uniqueIps: 0, visits: 0, today: 0, week: 0, month: 0, year: 0 };

function isLocalRuntime() {
  if (process.env.NODE_ENV !== 'production') return true;
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

function createVisitorId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

export function getVisitorId() {
  if (typeof window === 'undefined') return null;
  if (fallbackVisitorId) return fallbackVisitorId;
  try {
    const saved = window.localStorage.getItem(VISITOR_ID_KEY);
    if (saved && /^[0-9a-f-]{36}$/i.test(saved)) {
      fallbackVisitorId = saved;
      return saved;
    }
    fallbackVisitorId = createVisitorId();
    window.localStorage.setItem(VISITOR_ID_KEY, fallbackVisitorId);
    return fallbackVisitorId;
  } catch {
    fallbackVisitorId = createVisitorId();
    return fallbackVisitorId;
  }
}

export function getVisitorSessionId() {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (saved && /^[0-9a-f-]{36}$/i.test(saved)) return saved;
    const created = createVisitorId();
    window.sessionStorage.setItem(SESSION_ID_KEY, created);
    return created;
  } catch { return createVisitorId(); }
}

export const visitorStatsApi = {
  get: () => isLocalRuntime() ? Promise.resolve<VisitorStats>(disabledStats) : apiClient.get<VisitorStats>(`${VISITOR_API_URL}/settings/public-stats`, { cache: 'no-store' }),
  recordPageVisit: () => isLocalRuntime() ? Promise.resolve({ success: true }) : apiClient.post<{ success: boolean }>(`${VISITOR_API_URL}/settings/public-track`, {}),
  trackPage: (data: { visitorId: string; sessionId: string; pageViewId: string; path: string; event: 'ENTER' | 'HEARTBEAT' | 'EXIT' }, keepalive = false) =>
    isLocalRuntime() ? Promise.resolve({ success: true }) : apiClient.post<{ success: boolean }>(`${VISITOR_API_URL}/settings/public-presence`, data, { keepalive }),
};
