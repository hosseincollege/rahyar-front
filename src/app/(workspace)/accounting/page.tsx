'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Receipt, Wallet, AlertCircle, Clock3, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { usePreferences, getLocaleDirection } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import type { UiMessage } from '@/languages/types';
import { accountingApi } from '@/app/(workspace)/accounting/accounting-api';
import type { AccountingDashboardSummary, AccountingListItem } from '@/app/(workspace)/accounting/types';

const emptySummary: AccountingDashboardSummary = { totalInvoices: 0, pendingReview: 0, approved: 0, rejected: 0, paid: 0, overdue: 0 };

export default function AccountingPage() {
  const { locale } = usePreferences();
  const [summary, setSummary] = useState(emptySummary);
  const [recent, setRecent] = useState<AccountingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setFailed(false);
    const [summaryResult, invoicesResult] = await Promise.allSettled([accountingApi.getDashboard(), accountingApi.getInvoices()]);
    if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value);
    if (summaryResult.status === 'rejected' || invoicesResult.status === 'rejected') setFailed(true);
    if (invoicesResult.status === 'fulfilled') setRecent(invoicesResult.value.slice(0, 5));
    setLoading(false);
  }, []);
  useEffect(() => {
    // Load the accounting summary from the authenticated accounting API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  const stats: Array<{ label: UiMessage; value: number; icon: typeof FileText; color: string; tone: string }> = [
    { label: 'accountingTotalDocuments', value: summary.totalInvoices, icon: FileText, color: 'text-primary', tone: 'bg-primary/10' },
    { label: 'accountingAwaitingReview', value: summary.pendingReview, icon: Clock3, color: 'text-amber-600 dark:text-amber-400', tone: 'bg-amber-500/10' },
    { label: 'accountingApproved', value: summary.approved, icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', tone: 'bg-emerald-500/10' },
    { label: 'accountingPaid', value: summary.paid, icon: Wallet, color: 'text-cyan-700 dark:text-cyan-300', tone: 'bg-cyan-500/10' },
    { label: 'accountingOverdue', value: summary.overdue, icon: AlertCircle, color: 'text-rose-600 dark:text-rose-400', tone: 'bg-rose-500/10' },
    { label: 'accountingRejected', value: summary.rejected, icon: Receipt, color: 'text-rose-600 dark:text-rose-400', tone: 'bg-rose-500/10' },
  ];
  return <main dir={getLocaleDirection(locale)} className="space-y-5">
    <header className="rounded-2xl border border-border bg-card p-5 shadow-sm"><p className="text-xs font-semibold tracking-wide text-primary">ERP</p><h1 className="mt-1 text-xl font-bold text-foreground">{uiMessage(locale, 'accountingOverview')}</h1></header>
    {failed && <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-600">{uiMessage(locale, 'notificationsLoadFailed')} <button onClick={() => void load()} className="ms-2 underline">{uiMessage(locale, 'notificationsRetry')}</button></div>}
    <section aria-label={uiMessage(locale, 'accountingOverview')} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{stats.map(({ label, value, icon: Icon, color, tone }) => <article key={label} className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/20"><div className="flex items-center gap-4"><span className={`grid size-11 shrink-0 place-items-center rounded-xl ${tone} ${color}`}><Icon size={20} /></span><div className="min-w-0"><p className="text-sm font-medium text-muted-foreground">{uiMessage(locale, label)}</p><p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{loading ? '—' : new Intl.NumberFormat(locale).format(value)}</p></div></div></article>)}</section>
    <section>
      <article className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold text-foreground">{uiMessage(locale, 'accountingRecentTitle')}</h2><p className="mt-1 text-sm text-muted-foreground">{uiMessage(locale, 'accountingRecentDescription')}</p></div><Receipt size={19} className="shrink-0 text-primary" /></div><div className="mt-4 divide-y divide-border">{loading && <p className="py-4 text-sm text-muted-foreground">{uiMessage(locale, 'notificationsLoading')}</p>}{!loading && recent.map((invoice) => <Link key={invoice.id} href={`/accounting/${invoice.id}`} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><span className="min-w-0"><span dir="ltr" className="block truncate text-xs font-semibold text-primary">{invoice.documentNumber}</span><span className="mt-1 block truncate text-sm font-medium text-foreground">{invoice.title}</span></span><span className="shrink-0 text-end"><span className="block text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale).format(new Date(invoice.createdAt))}</span><span className="mt-1 block text-xs font-semibold text-foreground">{new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(invoice.totalAmount)} {invoice.currency}</span></span></Link>)}{!loading && recent.length === 0 && <p className="py-5 text-center text-sm text-muted-foreground">{uiMessage(locale, 'acctVouchersEmpty')}</p>}</div></article>
    </section>
  </main>;
}
