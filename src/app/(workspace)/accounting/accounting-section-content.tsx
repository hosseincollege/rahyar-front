'use client';

import { BookOpen, FileText, Landmark } from 'lucide-react';
import { usePreferences, getLocaleDirection } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import type { UiMessage } from '@/languages/types';

const icons: Partial<Record<UiMessage, typeof BookOpen>> = {
  accountingChartOfAccounts: BookOpen,
  accountingEntriesLedger: FileText,
  sidebarLedger: Landmark,
  accountingPurchaseInvoices: FileText,
  accountingReceiptsPayments: Landmark,
};

export function AccountingSectionContent({ title }: { title: UiMessage }) {
  const { locale } = usePreferences();
  const Icon = icons[title] || FileText;
  return <main dir={getLocaleDirection(locale)} className="space-y-5"><section className="rounded-2xl border border-border bg-card p-6 shadow-sm"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Icon size={21} /></span><h1 className="text-xl font-bold text-foreground">{uiMessage(locale, title)}</h1></div><div className="mt-6 rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center"><p className="mx-auto max-w-xl text-sm leading-7 text-muted-foreground">{uiMessage(locale, 'accountingNotConfigured')}</p></div></section></main>;
}
