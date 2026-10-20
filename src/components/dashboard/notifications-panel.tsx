'use client';

import { getCalendarLocale } from '@/lib/calendar';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { Bell, Check, CheckCheck, Inbox, RotateCw } from 'lucide-react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import {
  getLocalizedNotificationText,
  getSafeNotificationHref,
  notifyNotificationsChanged,
  notificationsApi,
  type AppNotification,
} from '@/lib/api/shared/notifications-api';
import { isAuthenticated } from '@/lib/api-client';
import { uiMessage } from '@/lib/ui-messages';

type NotificationFilter = 'all' | 'unread';

export function NotificationsPanel() {
  const router = useRouter();
  const { locale } = usePreferences();
  const direction = getLocaleDirection(locale);
  const message = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [error, setError] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated()) {
      setItems([]);
      setUnreadCount(0);
      setNextCursor(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(false);
    try {
      const result = await notificationsApi.getList(filter);
      setItems(result.items);
      setUnreadCount(result.unreadCount);
      setNextCursor(result.nextCursor ?? null);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  const loadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result = await notificationsApi.getList(filter, nextCursor);
      setItems((current) => [...current, ...result.items]);
      setUnreadCount(result.unreadCount);
      setNextCursor(result.nextCursor ?? null);
    } catch {
      setError(true);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load synchronizes this panel with its API.
    void loadNotifications();
  }, [loadNotifications]);

  const markRead = async (item: AppNotification) => {
    if (item.readAt) return;
    try {
      const updated = await notificationsApi.markRead(item.id);
      setItems((current) => filter === 'unread'
        ? current.filter((entry) => entry.id !== item.id)
        : current.map((entry) => entry.id === item.id ? updated : entry));
      setUnreadCount((current) => Math.max(0, current - 1));
      notifyNotificationsChanged();
    } catch {
      setError(true);
    }
  };

  const openNotification = async (
    event: MouseEvent<HTMLAnchorElement>,
    item: AppNotification,
  ) => {
    event.preventDefault();
    await markRead(item);
    router.push(getSafeNotificationHref(item.href, '/dashboard'));
  };

  const markAllRead = async () => {
    if (!unreadCount || isMarkingAll) return;
    setIsMarkingAll(true);
    setError(false);
    try {
      await notificationsApi.markAllRead();
      const now = new Date().toISOString();
      setItems((current) => filter === 'unread'
        ? []
        : current.map((item) => ({ ...item, readAt: item.readAt || now })));
      setUnreadCount(0);
      notifyNotificationsChanged();
    } catch {
      setError(true);
    } finally {
      setIsMarkingAll(false);
    }
  };

  return (
    <section dir={direction} className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bell size={21} />
          </span>
          <div>
            <h1 className="text-lg font-bold">{message('notificationsTitle')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{message('notificationsDescription')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void markAllRead()}
          disabled={!unreadCount || isMarkingAll}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCheck size={16} />
          {message('notificationsMarkAllRead')}
        </button>
      </header>

      <div className="flex items-center justify-between gap-3 border-b border-border">
        <div className="flex gap-2" role="tablist" aria-label={message('notificationsTitle')}>
          {(['all', 'unread'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={`border-b-2 px-3 py-2 text-sm font-medium transition ${filter === value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {message(value === 'all' ? 'notificationsAll' : 'notificationsUnread')}
              {value === 'unread' && unreadCount > 0 && (
                <span className="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{unreadCount}</span>
              )}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void loadNotifications()} className="mb-1 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={message('notificationsRetry')}>
          <RotateCw size={16} />
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-300">
          <span>{message('notificationsLoadFailed')}</span>
          <button type="button" onClick={() => void loadNotifications()} className="font-semibold underline">{message('notificationsRetry')}</button>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground" role="status">{message('notificationsLoading')}</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
          <Inbox size={30} className="mx-auto text-muted-foreground/60" />
          <p className="mt-3 font-semibold">{filter === 'unread' ? message('notificationsEmptyUnread') : message('notificationsEmpty')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{message('notificationsDescription')}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const title = getLocalizedNotificationText(item.title, locale);
            const body = getLocalizedNotificationText(item.body, locale);
            const createdAt = new Date(item.createdAt);
            const itemContent = (
              <>
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.readAt ? 'bg-muted-foreground/30' : 'bg-primary'}`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{title}</span>
                    {!item.readAt && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">{message('notificationsUnread')}</span>}
                    {item.readAt && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{message('notificationsRead')}</span>}
                  </span>
                  {body && <span className="mt-1 block whitespace-pre-line text-sm leading-6 text-muted-foreground">{body}</span>}
                  <time className="mt-2 block text-xs text-muted-foreground" dateTime={item.createdAt}>
                    {new Intl.DateTimeFormat(getCalendarLocale(locale), { dateStyle: 'medium', timeStyle: 'short' }).format(createdAt)}
                  </time>
                </span>
              </>
            );

            return (
              <li key={item.id}>
                <article className={`flex items-start gap-3 rounded-2xl border bg-card p-4 transition-colors ${item.readAt ? 'border-border' : 'border-primary/30 bg-primary/[0.025]'}`}>
                  {item.href ? (
                    <Link
                      href={getSafeNotificationHref(item.href, '/dashboard')}
                      onClick={(event) => void openNotification(event, item)}
                      className="flex min-w-0 flex-1 items-start gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {itemContent}
                    </Link>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-start gap-3">{itemContent}</div>
                  )}
                  {!item.readAt && (
                    <button type="button" onClick={() => void markRead(item)} className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary" aria-label={message('notificationsMarkRead')} title={message('notificationsMarkRead')}>
                      <Check size={17} />
                    </button>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}
      {!isLoading && nextCursor && (
        <div className="text-center">
          <button type="button" onClick={() => void loadMore()} disabled={isLoadingMore} className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-50">
            {isLoadingMore ? message('notificationsLoading') : message('notificationsLoadMore')}
          </button>
        </div>
      )}
    </section>
  );
}
