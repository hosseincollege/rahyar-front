'use client';

import Link from 'next/link';
import { ClipboardList, Clock3, List, MapPinned, Sun, Waypoints } from 'lucide-react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';

const sections = [
  { id: 'map', href: '/rahcom/map', title: 'rahcomMap', Icon: MapPinned },
  { id: 'actions', href: '/rahcom/actions', title: 'rahcomActions', Icon: Clock3 },
  { id: 'systems', href: '/rahcom/systems', title: 'rahcomSystemsList', Icon: List },
  { id: 'daily-traffic', href: '/rahcom/daily-traffic', title: 'rahcomDailyTraffic', Icon: ClipboardList },
  { id: 'solar-daily', href: '/rahcom/solar-daily', title: 'rahcomSolarDaily', Icon: Sun },
] as const;

export default function RahcomPage() {
  const { locale } = usePreferences();

  return (
    <main dir={getLocaleDirection(locale)} className="mx-auto max-w-5xl space-y-5">
      <header className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Waypoints size={21} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-foreground">{uiMessage(locale, 'sidebarRahkam')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{uiMessage(locale, 'sidebarNoSubmenu')}</p>
        </div>
      </header>

      <section aria-label={uiMessage(locale, 'sidebarRahkam')} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map(({ id, href, title, Icon }) => (
          <Link key={id} href={href} className="group flex min-h-36 items-start gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-accent/30">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={21} /></span>
            <span className="pt-1 font-semibold text-foreground group-hover:text-primary">{uiMessage(locale, title)}</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
