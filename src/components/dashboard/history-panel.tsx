'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, PlusCircle, RefreshCw } from 'lucide-react';
import { usePreferences, getLocaleDirection } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { getCalendarLocale } from '@/lib/calendar';
import { systemApi, type ActivityItem } from '@/lib/api/shared/system-api';

type ActivityView = 'all' | 'created';

export function HistoryPanel() {
  const { locale } = usePreferences();
  const t = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const [view, setView] = useState<ActivityView>('all');
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try { setItems(await systemApi.getActivity(50)); }
    catch { setFailed(true); }
    finally { setLoading(false); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load synchronizes this panel with its API.
  useEffect(() => { void load(); }, [load]);
  const visible = view === 'created' ? items.filter((item) => item.action === 'CREATE') : items;
  const date = (value: string) => new Intl.DateTimeFormat(getCalendarLocale(locale), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  const actionLabel = (action: string) => t(action === 'CREATE' ? 'dashboardActivityCreate' : action === 'UPDATE' ? 'dashboardActivityUpdate' : action === 'DELETE' ? 'dashboardActivityDelete' : 'dashboardActivityOther');

  return <section dir={getLocaleDirection(locale)} className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-xl font-bold text-foreground"><Activity size={21} className="text-primary" />{t('activityHistoryTitle')}</h1></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />{t('notificationsRetry')}</button></header>
    <nav aria-label={t('activityHistoryTitle')} className="flex flex-wrap gap-2"><button type="button" onClick={() => setView('all')} aria-pressed={view === 'all'} className={`rounded-xl px-4 py-2 text-sm font-medium ${view === 'all' ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-foreground'}`}>{t('activityTabAll')}</button><button type="button" onClick={() => setView('created')} aria-pressed={view === 'created'} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${view === 'created' ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-foreground'}`}><PlusCircle size={15} />{t('activityTabCreated')}</button></nav>
    {failed && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{t('activityLoadFailed')} <button type="button" onClick={() => void load()} className="ms-2 underline">{t('notificationsRetry')}</button></div>}
    <section aria-live="polite" className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><ul className="divide-y divide-border">{loading && <li className="p-8 text-center text-sm text-muted-foreground">{t('notificationsLoading')}</li>}{!loading && !failed && visible.map((item) => <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 p-4"><div className="min-w-0"><p className="font-medium text-foreground">{item.user?.name ?? '—'} · {actionLabel(item.action)}</p><p dir="ltr" className="mt-1 break-all text-xs text-muted-foreground">{item.entity}</p></div><time className="shrink-0 text-xs text-muted-foreground">{date(item.createdAt)}</time></li>)}{!loading && !failed && visible.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">{t('activityEmpty')}</li>}</ul></section>
  </section>;
}
