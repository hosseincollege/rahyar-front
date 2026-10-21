'use client';

import Link from 'next/link';
import { FolderKanban, Megaphone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import type { UiMessage } from '@/lib/languages/types';

const sections: Array<{ href: string; title: UiMessage; description: UiMessage; icon: LucideIcon }> = [
  { href: '/settings/projects', title: 'projectsTitle', description: 'projectsDescription', icon: FolderKanban },
  { href: '/settings/announcements', title: 'announcementManagementTitle', description: 'announcementManagementDescription', icon: Megaphone },
];

export default function OtherSettingsPage() {
  const { locale } = usePreferences();

  return (
    <main dir={getLocaleDirection(locale)} className="grid gap-4 sm:grid-cols-2">
      {sections.map(({ href, title, description, icon: Icon }) => (
        <Link key={href} href={href} className="group rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={21} /></span>
          <h1 className="mt-4 font-bold text-foreground group-hover:text-primary">{uiMessage(locale, title)}</h1>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{uiMessage(locale, description)}</p>
        </Link>
      ))}
    </main>
  );
}
