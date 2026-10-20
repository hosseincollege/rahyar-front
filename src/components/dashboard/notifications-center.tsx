'use client';

import { Suspense, useEffect, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePreferences, getLocaleDirection } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { Activity, Bell, BookOpen, History, Megaphone, Search } from 'lucide-react';
import { ActivityPanel } from './activity-panel';
import { AnnouncementsPanel } from './announcements-panel';
import { HistoryPanel } from './history-panel';
import { NotificationsPanel } from './notifications-panel';
import { SystemSearchPage } from './system-search';
import { UserGuidePage } from './user-guide';
import { notificationsApi } from '@/lib/api/shared/notifications-api';

export type DashboardCenterTab = 'notifications' | 'announcements' | 'history' | 'activity' | 'search' | 'help';

const tabs: Array<{ id: DashboardCenterTab; label: 'notifications' | 'dashboardMessages' | 'dashboardHistory' | 'dashboardActivities' | 'dashboardSearch' | 'dashboardHelp'; icon: typeof Bell }> = [
  { id: 'notifications', label: 'notifications', icon: Bell },
  { id: 'announcements', label: 'dashboardMessages', icon: Megaphone },
  { id: 'search', label: 'dashboardSearch', icon: Search },
  { id: 'history', label: 'dashboardHistory', icon: History },
  { id: 'activity', label: 'dashboardActivities', icon: Activity },
  { id: 'help', label: 'dashboardHelp', icon: BookOpen },
];

const validTabs = new Set<DashboardCenterTab>(tabs.map(({ id }) => id));

function readTabFromLocation(fallback: DashboardCenterTab): DashboardCenterTab {
  if (typeof window === 'undefined') return fallback;
  return fallback;
}

export function NotificationsCenter({ initialTab = 'notifications' }: { initialTab?: DashboardCenterTab }) {
  return (
    <Suspense fallback={<div className="min-h-32 w-full" aria-hidden="true" />}>
      <NotificationsCenterContent initialTab={initialTab} />
    </Suspense>
  );
}

function NotificationsCenterContent({ initialTab }: { initialTab: DashboardCenterTab }) {
  const { locale } = usePreferences();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const direction = getLocaleDirection(locale);
  const activeTab = requestedTab && validTabs.has(requestedTab as DashboardCenterTab)
    ? requestedTab as DashboardCenterTab
    : readTabFromLocation(initialTab);
  const message = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const [unreadBySource, setUnreadBySource] = useState<Record<string, number>>({});

  useEffect(() => {
    let mounted = true;
    const refreshUnreadCounts = () => {
      void notificationsApi.getSummary().then((summary) => {
        if (mounted) setUnreadBySource(summary.unreadBySource ?? {});
      }).catch(() => {
        if (mounted) setUnreadBySource({});
      });
    };
    refreshUnreadCounts();
    window.addEventListener('notifications-updated', refreshUnreadCounts);
    return () => {
      mounted = false;
      window.removeEventListener('notifications-updated', refreshUnreadCounts);
    };
  }, []);

  const selectTab = (tab: DashboardCenterTab) => {
    const url = new URL(window.location.href);
    url.pathname = '/dashboard/events';
    url.searchParams.set('tab', tab);
    window.history.pushState({ dashboardCenterTab: tab }, '', url);
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = tabs.findIndex(({ id }) => id === activeTab);
    const forwardKey = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    if (event.key !== forwardKey && event.key !== backwardKey && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (currentIndex + (event.key === forwardKey ? 1 : -1) + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    selectTab(nextTab.id);
    document.getElementById(`dashboard-center-tab-${nextTab.id}`)?.focus();
  };

  const renderPanel = () => {
    switch (activeTab) {
      case 'announcements': return <AnnouncementsPanel />;
      case 'history': return <HistoryPanel />;
      case 'activity': return <ActivityPanel />;
      case 'search': return <SystemSearchPage />;
      case 'help': return <UserGuidePage />;
      default: return <NotificationsPanel />;
    }
  };

  return (
    <div dir={direction} className="w-full space-y-4">
      <div className="overflow-x-auto border-b border-border">
        <div role="tablist" aria-label={message('notificationsTitle')} className="flex min-w-max gap-1">
          {tabs.map(({ id, label, icon: Icon }) => {
            const unreadCount = id === 'notifications'
              ? Object.entries(unreadBySource).filter(([source]) => source !== 'announcements').reduce((total, [, count]) => total + count, 0)
              : id === 'announcements' ? unreadBySource.announcements ?? 0 : 0;
            return (
              <button
                key={id}
                id={`dashboard-center-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                aria-controls="dashboard-center-panel"
                tabIndex={activeTab === id ? 0 : -1}
                onClick={() => selectTab(id)}
                onKeyDown={handleTabKeyDown}
                style={activeTab === id ? { color: 'var(--primary)', borderBottomColor: 'var(--primary)' } : undefined}
                className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors sm:px-4 ${activeTab === id ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                <Icon size={16} />
                {message(label)}
                {unreadCount > 0 && (
                  <span className="ms-2 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground" dir="ltr">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div id="dashboard-center-panel" role="tabpanel" aria-labelledby={`dashboard-center-tab-${activeTab}`} tabIndex={0}>
        {renderPanel()}
      </div>
    </div>
  );
}
