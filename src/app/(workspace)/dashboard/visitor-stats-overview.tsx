'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, RefreshCw, Users } from 'lucide-react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { visitorStatsApi, type VisitorStats } from '@/lib/api/shared/visitor-stats-api';

export function VisitorStatsOverview() {
  const { locale } = usePreferences();
  const t = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const [stats, setStats] = useState<VisitorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const next = await visitorStatsApi.get();
      setStats(next);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const items = [
    ['dashboardVisitorsOnline', stats?.online],
    ['dashboardVisitorsToday', stats?.daily],
    ['dashboardVisitorsWeek', stats?.weekly],
    ['dashboardVisitorsMonth', stats?.monthly],
    ['dashboardVisitorsYear', stats?.yearly],
  ] as const;

  return (
    <section dir={getLocaleDirection(locale)} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <header className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Eye size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-foreground">{t('dashboardVisitorsTitle')}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('dashboardVisitorsDescription')}</p>
        </div>
        {failed && <button type="button" onClick={() => void load()} aria-label={t('dashboardVisitorsRetry')} title={t('dashboardVisitorsRetry')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><RefreshCw size={16} /></button>}
      </header>
      {failed ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{t('dashboardVisitorsUnavailable')}</p>
      ) : stats && !stats.enabled ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm leading-6 text-foreground">{t('siteVisitsVercelOnly')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {items.map(([key, value], index) => (
            <div key={key} className="min-w-0 rounded-xl border border-border/70 bg-background/60 p-3">
              <p className="flex items-center gap-1.5 text-xs leading-5 text-muted-foreground">{index === 0 && <Users size={13} className="shrink-0 text-primary" />}{t(key)}</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{loading ? '—' : (value ?? 0).toLocaleString(locale)}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
