'use client';

import { FileText } from 'lucide-react';
import { usePreferences, getLocaleDirection } from '@/components/providers/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';

export default function RahcomInvoicesPage() {
  const { locale } = usePreferences();
  return <main dir={getLocaleDirection(locale)} className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden">
    <header className="flex min-h-12 shrink-0 items-center gap-2 rounded-2xl border border-border bg-card px-4">
      <FileText size={18} className="text-primary" aria-hidden="true" />
      <h1 className="text-sm font-semibold">{uiMessage(locale, 'accountingInvoices')}</h1>
    </header>
    <section className="grid min-h-40 flex-1 place-items-center rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
      {uiMessage(locale, 'reportsNoData')}
    </section>
  </main>;
}
