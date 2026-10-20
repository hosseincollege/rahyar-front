'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import type { UiMessage } from '@/lib/languages/types';

const tabs: Array<{ href: string; label: UiMessage }> = [
  { href: '/settings/company', label: 'sidebarGeneral' },
  { href: '/settings/organization', label: 'sidebarOrganizationStructure' },
];

export function SettingsOrganizationTabs() {
  const pathname = usePathname();
  const { locale } = usePreferences();

  return (
    <nav dir={getLocaleDirection(locale)} aria-label={uiMessage(locale, 'settingsOrganizationWorkspace')} className="overflow-x-auto border-b border-border">
      <div className="flex min-w-max gap-1">
        {tabs.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              style={active ? { color: 'var(--primary)', borderBottomColor: 'var(--primary)' } : undefined}
              className={`inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-semibold transition-colors ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {uiMessage(locale, label)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
