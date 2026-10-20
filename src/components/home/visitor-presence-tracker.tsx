'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getVisitorId, getVisitorSessionId, visitorStatsApi } from '@/lib/api/shared/visitor-stats-api';

export function VisitorPresenceTracker() {
  const pathname = usePathname() || '/';
  useEffect(() => {
    const visitorId = getVisitorId();
    const sessionId = getVisitorSessionId();
    if (!visitorId || !sessionId) return;
    const pageViewId = crypto.randomUUID();
    const data = (event: 'ENTER' | 'HEARTBEAT' | 'EXIT') => ({ visitorId, sessionId, pageViewId, path: pathname, event });

    const sendHeartbeat = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      void visitorStatsApi.trackPage(data('HEARTBEAT')).catch(() => undefined);
    };

    void visitorStatsApi.trackPage(data('ENTER')).catch(() => undefined);
    const interval = window.setInterval(sendHeartbeat, 30_000);
    document.addEventListener('visibilitychange', sendHeartbeat);
    window.addEventListener('online', sendHeartbeat);
    const exit = () => { void visitorStatsApi.trackPage(data('EXIT'), true).catch(() => undefined); };
    window.addEventListener('pagehide', exit, { once: true });

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', sendHeartbeat);
      window.removeEventListener('online', sendHeartbeat);
      window.removeEventListener('pagehide', exit);
      exit();
    };
  }, [pathname]);

  return null;
}
