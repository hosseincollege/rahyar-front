'use client';

import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';

export default function CommercialHomePage() {
  const { locale } = usePreferences();
  const direction = getLocaleDirection(locale);
  return <main dir={direction} className="space-y-6">
    <header className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <p className="text-sm font-semibold text-primary">ERP</p>
      <h1 className="mt-2 text-2xl font-bold text-foreground">{uiMessage(locale, 'sidebarCommercial')}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">{uiMessage(locale, 'commerceOverviewDescription')}</p>
    </header>
  </main>;
}
