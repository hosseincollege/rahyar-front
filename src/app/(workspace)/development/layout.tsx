'use client';

import type { ReactNode } from 'react';
import { Activity, Database, UserRoundCog } from 'lucide-react';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { SettingsTabs } from '../settings/settings-tabs';

const developmentTabRoutes = [
  { href: '/development/site-visits', label: 'developmentSiteVisits', icon: Activity },
  { href: '/development/test-data', label: 'sidebarTestData', icon: Database },
  { href: '/development/account-switching', label: 'developmentAccountSwitching', icon: UserRoundCog },
] as const;

export default function DevelopmentLayout({ children }: { children: ReactNode }) {
  const { locale } = usePreferences();
  const items = developmentTabRoutes.map(({ label, ...item }) => ({
    ...item,
    label: uiMessage(locale, label),
  }));

  return (
    <div className="space-y-5">
      <SettingsTabs items={items} ariaLabel={uiMessage(locale, 'sidebarDevelopment')} />
      {children}
    </div>
  );
}
