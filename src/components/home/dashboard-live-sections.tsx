'use client';

import { getCalendarLocale } from '@/lib/calendar';
import { useCallback, useEffect, useState } from 'react';
import { Activity, Megaphone, Pin, Radio, RefreshCw } from 'lucide-react';
import { usePreferences, getLocaleDirection } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { notificationsApi, notifyNotificationsChanged, type Announcement } from '@/lib/api/shared/notifications-api';
import { systemApi, type ActivityItem, type SystemStatus } from '@/lib/api/shared/system-api';

export function DashboardLiveSections() {
  const { locale } = usePreferences();
  const t = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(false);
    const results = await Promise.allSettled([notificationsApi.getAnnouncements(), systemApi.getStatus(), systemApi.getActivity()]);
    if (results[0].status === 'fulfilled') setAnnouncements(results[0].value);
    else setError(true);
    if (results[1].status === 'fulfilled') setStatus(results[1].value);
    if (results[2].status === 'fulfilled') setActivity(results[2].value);
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const markAnnouncementRead = async (item: Announcement) => {
    setExpanded((current) => current === item.id ? null : item.id);
    if (item.notificationId && !item.readAt) {
      try { await notificationsApi.markRead(item.notificationId); notifyNotificationsChanged(); await load(); } catch { /* Dashboard remains readable if marking read fails. */ }
    }
  };
  const localDate = (value: string) => new Intl.DateTimeFormat(getCalendarLocale(locale), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  const categoryKey = (value: string) => ({ general: 'announcementCategoryGeneral', operations: 'announcementCategoryOperations', finance: 'announcementCategoryFinance', hr: 'announcementCategoryHr', technical: 'announcementCategoryTechnical' } as const)[value as 'general' | 'operations' | 'finance' | 'hr' | 'technical'] ?? 'announcementCategoryGeneral';

  return <div dir={getLocaleDirection(locale)} className="space-y-4">
    <section id="announcements" className="space-y-3">
      <header className="flex items-center gap-2 text-foreground"><Megaphone size={18} className="text-primary"/><h2 className="text-sm font-bold">{t('announcementManagementTitle')}</h2><span className="text-xs text-muted-foreground">{announcements.length}</span></header>
      {error && <button type="button" onClick={() => void load()} className="text-xs text-destructive">{t('announcementLoadFailed')} · {t('announcementRetry')}</button>}
      {!announcements.length && !error && <p className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">{t('announcementEmpty')}</p>}
      {announcements.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border border-border bg-card">
        <button type="button" onClick={() => void markAnnouncementRead(item)} className="flex w-full items-start gap-3 p-4 text-start hover:bg-muted/30">
          <Megaphone size={17} className="mt-0.5 shrink-0 text-primary"/><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="font-semibold text-foreground">{item.title}</span>{item.isPinned && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary"><Pin size={10}/>{t('announcementPinned')}</span>}{!item.readAt && item.notificationId && <i className="h-2 w-2 rounded-full bg-primary"/>}</span><span className="mt-1 block text-xs text-muted-foreground">{item.summary || localDate(item.createdAt)}</span></span></button>
        {expanded === item.id && <div className="border-t border-border px-4 py-3 text-sm leading-6 text-foreground/90"><span className="mb-2 block text-xs text-muted-foreground">{t(categoryKey(item.category))} · {localDate(item.createdAt)}</span><p className="whitespace-pre-wrap">{item.body}</p></div>}
      </article>)}
    </section>
    <div className="grid gap-4 lg:grid-cols-2">
      <section id="system-status" className="rounded-2xl border border-border bg-card p-4"><h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Radio size={17} className="text-primary"/>{t('dashboardServiceTitle')}</h2>
        {[['dashboardApi',status?.api.status],['dashboardDatabase',status?.database.status]].map(([label,value]) => <div key={label} className="flex items-center justify-between border-t border-border py-2 text-xs"><span>{t(label as Parameters<typeof uiMessage>[1])}</span><span className={value === 'online' ? 'text-emerald-500' : value === 'offline' ? 'text-destructive' : 'text-muted-foreground'}>{value === 'online' ? t('dashboardOnline') : value === 'offline' ? t('dashboardOffline') : t('dashboardChecking')}{label === 'dashboardDatabase' && status?.database.latencyMs != null ? ` · ${status.database.latencyMs} ms` : ''}</span></div>)}
      </section>
      <section id="activity-summary" className="rounded-2xl border border-border bg-card p-4"><h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Activity size={17} className="text-primary"/>{t('dashboardActivityTitle')}</h2>
        {!activity.length ? <p className="text-xs text-muted-foreground">{t('dashboardActivityEmpty')}</p> : <ul className="space-y-2">{activity.map((entry) => <li key={entry.id} className="flex items-start justify-between gap-3 border-t border-border pt-2 text-xs"><span>{entry.user?.name ?? '—'} · {t(entry.action === 'CREATE' ? 'dashboardActivityCreate' : entry.action === 'UPDATE' ? 'dashboardActivityUpdate' : entry.action === 'DELETE' ? 'dashboardActivityDelete' : 'dashboardActivityOther')} · {entry.entity}</span><time className="shrink-0 text-muted-foreground">{localDate(entry.createdAt)}</time></li>)}</ul>}
      </section>
    </div>
  </div>;
}
