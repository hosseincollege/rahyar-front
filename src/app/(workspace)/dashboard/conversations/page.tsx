'use client';

import { ClipboardList, MessageCircle, Megaphone, UsersRound, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { isReducedEdition } from '@/lib/product-edition';
import { readShellVisibility } from '@/lib/module-visibility';

export default function ConversationsPage() {
  const { locale } = usePreferences();
  const [activeTab, setActiveTab] = useState<'personal' | 'group' | 'channel' | 'planning'>('personal');
  const [navigationVisibility, setNavigationVisibility] = useState(() => readShellVisibility(isReducedEdition).navigationItems ?? {});
  useEffect(() => {
    const refresh = () => setNavigationVisibility(readShellVisibility(isReducedEdition).navigationItems ?? {});
    window.addEventListener('erp-module-visibility-change', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('erp-module-visibility-change', refresh); window.removeEventListener('storage', refresh); };
  }, []);
  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    if (requestedTab === 'planning') setActiveTab('planning');
    if (requestedTab === 'search' || requestedTab === 'help') {
      window.location.replace(`/dashboard/events?tab=${requestedTab}`);
    }
  }, []);
  const tabs = [
    { id: 'personal' as const, label: 'conversationPersonal' as const, icon: UserRound },
    { id: 'group' as const, label: 'conversationGroup' as const, icon: UsersRound },
    { id: 'channel' as const, label: 'conversationChannel' as const, icon: Megaphone },
    { id: 'planning' as const, label: 'dashboardPlanning' as const, icon: ClipboardList },
  ];
  const visibleTabs = tabs.filter(({ id }) => navigationVisibility[`/dashboard/conversations?tab=${id}`] !== false);
  const availableTabs = visibleTabs.length ? visibleTabs : [tabs[0]];
  const currentTab = availableTabs.some((tab) => tab.id === activeTab) ? activeTab : availableTabs[0].id;
  const selectedTab = availableTabs.find((tab) => tab.id === currentTab)!;

  return (
    <main dir={getLocaleDirection(locale)} className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <MessageCircle size={21} className="text-primary" />
          {uiMessage(locale, 'dashboardConversation')}
        </h1>
      </header>
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto border-b border-border px-3 sm:px-5">
          <div className="flex min-w-max gap-1" role="tablist" aria-label={uiMessage(locale, 'dashboardConversation')}>
            {availableTabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                id={`conversation-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={currentTab === id}
                aria-controls="conversation-tab-panel"
                onClick={() => setActiveTab(id)}
                style={currentTab === id ? { color: 'var(--primary)', borderBottomColor: 'var(--primary)' } : undefined}
                className={`inline-flex min-h-12 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${currentTab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                <Icon size={17} />
                {uiMessage(locale, label)}
              </button>
            ))}
          </div>
        </div>
        <div
          id="conversation-tab-panel"
          role="tabpanel"
          aria-labelledby={`conversation-tab-${currentTab}`}
          className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center sm:p-8"
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <MessageCircle size={23} />
          </span>
          <p className="text-sm leading-7 text-muted-foreground">
            {currentTab === 'planning'
              ? uiMessage(locale, 'planningComingSoon')
              : uiMessage(locale, 'conversationTabEmpty').replace('{type}', uiMessage(locale, selectedTab.label))}
          </p>
        </div>
      </section>
    </main>
  );
}
