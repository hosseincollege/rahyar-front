'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, ChevronDown, ChevronLeft, ChevronRight, Clock3, Eye, RefreshCw, Search, Users } from 'lucide-react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { developmentApi, type SiteVisitor, type SiteVisitorSession, type SiteVisitsRange } from '@/lib/api/development/development-api';
import { ApiError } from '@/lib/api-client';
import { uiMessage } from '@/lib/ui-messages';
import type { UiMessage } from '@/lib/languages/types';

const moduleLabels: Record<string, UiMessage> = {
  dashboard: 'sidebarDashboard', accounting: 'sidebarAccounting', commerce: 'sidebarCommercial',
  'human-resources': 'sidebarHumanResources', supply: 'testDataInventoryPurchases', statistics: 'sidebarStatistics',
  settings: 'sidebarSettings', support: 'sidebarSupport', development: 'sidebarDevelopment', home: 'sidebarDashboard',
};

export default function SiteVisitsPage() {
  const { locale } = usePreferences();
  const t = (key: UiMessage) => uiMessage(locale, key);
  const [range, setRange] = useState<SiteVisitsRange>('7d');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [visitors, setVisitors] = useState<SiteVisitor[]>([]);
  const [summary, setSummary] = useState<{ onlineVisitors: number; uniqueIps: number; sessions: number; pageViews: number } | null>(null);
  const [total, setTotal] = useState(0);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [denied, setDenied] = useState(false);
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SiteVisitorSession[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setFailed(false); setDenied(false);
    try {
      const result = await developmentApi.getSiteVisits(range, page, search);
      setAvailable(result.available); setVisitors(result.visitors); setSummary(result.summary); setTotal(result.totalVisitors);
    } catch (error) {
      setDenied(error instanceof ApiError && error.status === 403); setFailed(!(error instanceof ApiError && error.status === 403));
    } finally { setLoading(false); }
  }, [range, page, search]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!selectedIp) { setSessions([]); return; }
    let active = true; setDetailsLoading(true);
    developmentApi.getSiteVisitorDetails(selectedIp, range).then((result) => { if (active) setSessions(result.sessions); }).catch(() => { if (active) setSessions([]); }).finally(() => { if (active) setDetailsLoading(false); });
    return () => { active = false; };
  }, [selectedIp, range]);

  const duration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); const rest = seconds % 60;
    if (hours) return `${hours} ${t('siteVisitsHours')} ${minutes} ${t('siteVisitsMinutes')}`;
    if (minutes) return `${minutes} ${t('siteVisitsMinutes')} ${rest} ${t('siteVisitsSeconds')}`;
    return `${rest} ${t('siteVisitsSeconds')}`;
  };
  const date = (value: string | null) => value ? new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
  const rangeLabels: Array<[SiteVisitsRange, UiMessage]> = [['7d', 'siteVisitsRange7d'], ['30d', 'siteVisitsRange30d'], ['90d', 'siteVisitsRange90d'], ['all', 'siteVisitsRangeAll']];
  const stats: Array<[UiMessage, number, typeof Users]> = summary ? [
    ['siteVisitsOnline', summary.onlineVisitors, Users], ['siteVisitsUniqueIps', summary.uniqueIps, Eye], ['siteVisitsSessions', summary.sessions, Activity], ['siteVisitsPageViews', summary.pageViews, Clock3],
  ] : [];

  return <main dir={getLocaleDirection(locale)} className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-start">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Activity size={21} /></span>
      <div className="min-w-0 flex-1"><h1 className="text-xl font-bold text-foreground">{t('siteVisitsTitle')}</h1><p className="mt-1 text-sm leading-6 text-muted-foreground">{t('siteVisitsDescription')}</p></div>
      <button type="button" onClick={() => void load()} aria-label={t('siteVisitsRetry')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"><RefreshCw size={17} /></button>
    </header>

    {denied ? <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300">{t('developmentAccessDenied')}</p>
    : failed ? <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300">{t('siteVisitsLoadFailed')} <button className="ms-2 underline" onClick={() => void load()}>{t('siteVisitsRetry')}</button></div>
    : available === false ? <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-6 text-foreground">{t('siteVisitsVercelOnly')}</p>
    : <>
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">{stats.map(([label, value, Icon]) => <article key={label} className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon size={16} className="text-primary" />{t(label)}</div><p className="mt-2 text-2xl font-bold tabular-nums">{loading ? '—' : value.toLocaleString(locale)}</p></article>)}</section>
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center">
          <label className="relative min-w-0 flex-1"><Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={t('siteVisitsSearch')} className="h-10 w-full rounded-lg border border-border bg-background ps-9 pe-3 text-sm outline-none focus:border-primary" dir="ltr" /></label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground"><span className="shrink-0">{t('siteVisitsRange')}</span><select value={range} onChange={(event) => { setRange(event.target.value as SiteVisitsRange); setPage(1); setSelectedIp(null); }} className="h-10 min-w-32 rounded-lg border border-border bg-background px-3 text-sm text-foreground">{rangeLabels.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
        </div>
        {loading ? <p className="p-6 text-center text-sm text-muted-foreground">{t('siteVisitsLoading')}</p>
        : visitors.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">{t('siteVisitsNoVisitors')}</p>
        : <div className="divide-y divide-border">{visitors.map((visitor) => <article key={visitor.ipAddress}>
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-[minmax(8rem,1.2fr)_repeat(4,minmax(5rem,1fr))_auto] sm:items-center">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p dir="ltr" className="truncate text-sm font-semibold tabular-nums text-start">{visitor.ipAddress}</p>{visitor.online && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">{t('siteVisitsOnline')}</span>}</div><p className="mt-1 text-xs text-muted-foreground">{t('siteVisitsLastSeen')}: {date(visitor.lastSeenAt)}</p></div>
            <div className="text-xs"><span className="text-muted-foreground">{t('siteVisitsVisits')}: </span><strong>{visitor.visits.toLocaleString(locale)}</strong></div>
            <div className="text-xs"><span className="text-muted-foreground">{t('siteVisitsPageViews')}: </span><strong>{visitor.pageViews.toLocaleString(locale)}</strong></div>
            <div className="text-xs"><span className="text-muted-foreground">{t('siteVisitsTimeOnSite')}: </span><strong>{duration(visitor.durationSeconds)}</strong></div>
            <div className="flex flex-wrap gap-1">{visitor.modules.slice(0, 3).map((module) => <span key={module} className="rounded-full bg-muted px-2 py-1 text-[11px]">{t(moduleLabels[module] ?? 'sidebarDevelopment')}</span>)}{visitor.modules.length > 3 && <span className="text-xs text-muted-foreground">+{visitor.modules.length - 3}</span>}</div>
            <button type="button" onClick={() => setSelectedIp((current) => current === visitor.ipAddress ? null : visitor.ipAddress)} className="flex h-9 items-center justify-center gap-1 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted">{t(selectedIp === visitor.ipAddress ? 'siteVisitsHideDetails' : 'siteVisitsDetails')}<ChevronDown size={14} className={selectedIp === visitor.ipAddress ? 'rotate-180' : ''} /></button>
          </div>
          {selectedIp === visitor.ipAddress && <div className="space-y-3 border-t border-border bg-muted/20 p-4">{detailsLoading ? <p className="text-sm text-muted-foreground">{t('siteVisitsLoading')}</p> : sessions.length === 0 ? <p className="text-sm text-muted-foreground">{t('siteVisitsNoVisitors')}</p> : sessions.map((session) => <SessionDetails key={session.id} session={session} t={t} date={date} duration={duration} />)}</div>}
        </article>)}</div>}
        {!loading && total > 25 && <footer className="flex items-center justify-between border-t border-border p-3"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm disabled:opacity-40"><ChevronLeft size={16} />{t('siteVisitsPrevious')}</button><span className="text-xs text-muted-foreground">{t('siteVisitsPageLabel')} {page} / {Math.ceil(total / 25)}</span><button type="button" disabled={page >= Math.ceil(total / 25)} onClick={() => setPage((value) => value + 1)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm disabled:opacity-40">{t('siteVisitsNext')}<ChevronRight size={16} /></button></footer>}
      </section>
    </>}
  </main>;
}

function SessionDetails({ session, t, date, duration }: { session: SiteVisitorSession; t: (key: UiMessage) => string; date: (value: string | null) => string; duration: (seconds: number) => string }) {
  const active = !session.endedAt && Date.now() - new Date(session.lastSeenAt).getTime() < 5 * 60_000;
  return <section className="rounded-xl border border-border bg-background p-3 sm:p-4"><header className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold">{t('siteVisitsSessionStarted')}: {date(session.startedAt)}</p><span className="rounded-full bg-muted px-2 py-1 text-[11px]">{active ? t('siteVisitsSessionActive') : t('siteVisitsSessionEnded')}</span></header>
    {session.pageViews.length === 0 ? <p className="mt-3 text-xs text-muted-foreground">{t('siteVisitsNoVisitors')}</p> : <div className="mt-3 space-y-2">{session.pageViews.map((view, index) => <div key={`${view.path}-${view.enteredAt}-${index}`} className="grid gap-1 rounded-lg bg-muted/40 p-3 text-xs sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"><div className="min-w-0"><p className="truncate font-medium" dir="ltr">{view.path}</p><p className="mt-1 text-muted-foreground">{t(moduleLabels[view.moduleKey] ?? 'sidebarDevelopment')}</p></div><span className="text-muted-foreground">{date(view.enteredAt)}</span><span className="font-medium">{duration(view.durationSeconds)}</span></div>)}</div>}
  </section>;
}
