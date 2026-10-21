'use client';

import type { ReactNode } from 'react';
import { Building2, FolderKanban, Network, UsersRound } from 'lucide-react';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { SettingsTabs } from './settings-tabs';

const settingsTabRoutes = [
  { href: '/settings/company', activeHrefs: ['/settings'], label: 'sidebarGeneral', icon: Building2 },
  { href: '/settings/organization', label: 'settingsOrganizationWorkspace', icon: Network },
  { href: '/settings/accounts', label: 'settingsAccessWorkspace', icon: UsersRound },
  { href: '/settings/other', activeHrefs: ['/settings/projects', '/settings/announcements'], label: 'settingsOther', icon: FolderKanban },
] as const;

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const { locale } = usePreferences();
  const items = settingsTabRoutes.map(({ label, ...item }) => ({
    ...item,
    label: uiMessage(locale, label),
  }));

  return (
    <div className="space-y-5">
      <SettingsTabs items={items} />
      {children}
    </div>
  );
}
