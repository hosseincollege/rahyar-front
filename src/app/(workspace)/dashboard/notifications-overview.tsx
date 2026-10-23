'use client';

import { getCalendarLocale } from '@/lib/calendar';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { isAuthenticated } from '@/lib/api-client';
import {
  getLocalizedNotificationText,
  getSafeNotificationHref,
  notifyNotificationsChanged,
  notificationsApi,
  type AppNotification,
} from '@/lib/api/shared/notifications-api';
import { uiMessage } from '@/lib/ui-messages';

export function NotificationsOverview() {
  const router = useRouter();
  const { locale } = usePreferences();
  const direction = getLocaleDirection(locale);
  const message = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadSummary = useCallback(async () => {
    if (!isAuthenticated()) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    try {
      const result = await notificationsApi.getSummary();
      setItems(result.items.slice(0, 3));
      setUnreadCount(result.unreadCount);
    } catch {
      setItems([]);
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') void loadSummary();
    };
    const refreshTimer = window.setInterval(() => void loadSummary(), 60_000);
    window.addEventListener('notifications-updated', loadSummary);
    window.addEventListener('auth:login', loadSummary);
    window.addEventListener('auth:logout', loadSummary);
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener('notifications-updated', loadSummary);
      window.removeEventListener('auth:login', loadSummary);
      window.removeEventListener('auth:logout', loadSummary);
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, [loadSummary]);

  const openNotification = async (event: MouseEvent<HTMLAnchorElement>, item: AppNotification) => {
    event.preventDefault();
    if (!item.readAt) {
      try {
        await notificationsApi.markRead(item.id);
        notifyNotificationsChanged();
      } catch {
        // The dashboard remains navigable if read-state synchronization is temporarily unavailable.
      }
    }
    router.push(getSafeNotificationHref(item.href, '/dashboard/events'));
  };

  return (
    <section dir={direction} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-labelledby="dashboard-notifications-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Bell size={17} /></span>
          <div>
            <h2 id="dashboard-notifications-title" className="text-sm font-bold">{message('notificationsRecent')}</h2>
            <p className="text-xs text-muted-foreground">{unreadCount} {message('notificationsUnreadCount')}</p>
          </div>
        </div>
        <Link href="/dashboard/events" className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10">
          {message('notificationsViewAll')}<ChevronRight size={14} className={direction === 'rtl' ? 'rotate-180' : undefined} />
        </Link>
      </div>
      {items.length ? (
        <ul className="divide-y divide-border/70">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={getSafeNotificationHref(item.href, '/dashboard/events')}
                onClick={(event) => void openNotification(event, item)}
                className="flex items-start gap-3 px-4 py-3 transition hover:bg-muted/40 sm:px-5"
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.readAt ? 'bg-muted-foreground/30' : 'bg-primary'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{getLocalizedNotificationText(item.title, locale)}</span>
                  {item.body && <span className="mt-0.5 block line-clamp-1 text-xs text-muted-foreground">{getLocalizedNotificationText(item.body, locale)}</span>}
                </span>
                <time className="shrink-0 text-[11px] text-muted-foreground" dateTime={item.createdAt}>
                  {new Intl.DateTimeFormat(getCalendarLocale(locale), { dateStyle: 'short' }).format(new Date(item.createdAt))}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-6 text-center text-sm text-muted-foreground">{message('notificationsNoRecent')}</p>
      )}
    </section>
  );
}
