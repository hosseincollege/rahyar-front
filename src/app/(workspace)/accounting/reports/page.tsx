'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { usePreferences, getLocaleDirection } from '@/components/preferences-provider';
import { accountingApi } from '@/app/(workspace)/accounting/accounting-api';
import { uiMessage } from '@/lib/ui-messages';
import type { AccountingTrialBalance } from '@/app/(workspace)/accounting/types';

const emptyReport: AccountingTrialBalance = { rows: [], debitTotal: 0, creditTotal: 0 };
export default function AccountingReportsPage() {
  const { locale } = usePreferences();
  const [report, setReport] = useState(emptyReport);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async () => { setLoading(true); setError(false); try { setReport(await accountingApi.getTrialBalance()); } catch { setError(true); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const format = (amount: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount);
  const balanced = Math.round(report.debitTotal * 100) === Math.round(report.creditTotal * 100);
  return <main dir={getLocaleDirection(locale)} className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold text-primary">ERP</p><h1 className="mt-1 text-xl font-bold text-foreground">{uiMessage(locale, 'sidebarFinancialReports')}</h1></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />{uiMessage(locale, 'notificationsRetry')}</button></header>
    {error ? <p role="alert" className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-600">{uiMessage(locale, 'acctLoadFailed')}</p> : <>
      <section className="grid gap-4 sm:grid-cols-2"><article className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">{uiMessage(locale, 'acctDebit')}</p><p className="mt-2 text-2xl font-bold">{loading ? '—' : format(report.debitTotal)}</p></article><article className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">{uiMessage(locale, 'acctCredit')}</p><p className="mt-2 text-2xl font-bold">{loading ? '—' : format(report.creditTotal)}</p></article></section>
      {!loading && <div role="status" className={`rounded-xl border p-3 text-sm ${balanced ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700' : 'border-amber-500/20 bg-amber-500/5 text-amber-700'}`}>{balanced ? `${uiMessage(locale, 'acctBalance')}: ${format(report.debitTotal)}` : uiMessage(locale, 'acctUnbalanced')}</div>}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto"><table className="w-full text-start text-sm"><thead className="bg-muted/40 text-muted-foreground"><tr><th className="px-4 py-3">{uiMessage(locale, 'acctCode')}</th><th className="px-4 py-3">{uiMessage(locale, 'acctName')}</th><th className="px-4 py-3">{uiMessage(locale, 'acctType')}</th><th className="px-4 py-3">{uiMessage(locale, 'acctDebit')}</th><th className="px-4 py-3">{uiMessage(locale, 'acctCredit')}</th></tr></thead><tbody className="divide-y divide-border">{report.rows.map((row) => <tr key={row.id}><td dir="ltr" className="px-4 py-3 font-mono">{row.code}</td><td className="px-4 py-3 font-medium">{row.name}</td><td className="px-4 py-3">{uiMessage(locale, ({ ASSET: 'acctAsset', LIABILITY: 'acctLiability', EQUITY: 'acctEquity', REVENUE: 'acctRevenue', EXPENSE: 'acctExpense' } as const)[row.type])}</td><td className="px-4 py-3">{format(row.debit)}</td><td className="px-4 py-3">{format(row.credit)}</td></tr>)}{!loading && !report.rows.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{uiMessage(locale, 'acctAccountsEmpty')}</td></tr>}</tbody></table></div></section>
    </>}
  </main>;
}
