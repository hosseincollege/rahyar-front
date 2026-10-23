'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { usePreferences, getLocaleDirection } from '@/components/preferences-provider';
import { accountingApi } from '@/app/(workspace)/accounting/accounting-api';
import { uiMessage } from '@/lib/ui-messages';
import type { AccountingPaymentActivity } from '@/app/(workspace)/accounting/types';

export default function AccountingPaymentsPage() {
  const { locale } = usePreferences();
  const [payments, setPayments] = useState<AccountingPaymentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async () => { setLoading(true); setError(false); try { setPayments(await accountingApi.getPayments()); } catch { setError(true); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const money = (amount: number | string, currency: string) => {
    try { return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount)); }
    catch { return `${new Intl.NumberFormat(locale).format(Number(amount))} ${currency}`; }
  };
  return <main dir={getLocaleDirection(locale)} className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold text-primary">ERP</p><h1 className="mt-1 text-xl font-bold text-foreground">{uiMessage(locale, 'accountingReceiptsPayments')}</h1></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />{uiMessage(locale, 'notificationsRetry')}</button></header>
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto"><table className="w-full text-start text-sm"><thead className="bg-muted/40 text-muted-foreground"><tr><th className="px-4 py-3">{uiMessage(locale, 'acctVoucherDate')}</th><th className="px-4 py-3">{uiMessage(locale, 'accountingInvoices')}</th><th className="px-4 py-3">{uiMessage(locale, 'sidebarSuppliers')}</th><th className="px-4 py-3">{uiMessage(locale, 'acctAmount')}</th><th className="px-4 py-3">{uiMessage(locale, 'acctMethod')}</th><th className="px-4 py-3">{uiMessage(locale, 'acctDescription')}</th></tr></thead><tbody className="divide-y divide-border">
      {loading && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">{uiMessage(locale, 'notificationsLoading')}</td></tr>}
      {error && <tr><td colSpan={6} role="alert" className="p-8 text-center text-rose-600">{uiMessage(locale, 'acctLoadFailed')}</td></tr>}
      {!loading && !error && payments.map((payment) => <tr key={payment.id}><td className="px-4 py-3 whitespace-nowrap">{new Intl.DateTimeFormat(locale).format(new Date(payment.paidAt))}</td><td className="px-4 py-3"><Link href={`/accounting/${payment.invoice.id}`} className="font-medium text-primary hover:underline"><span dir="ltr" className="font-mono text-xs">{payment.invoice.documentNumber}</span><span className="ms-2">{payment.invoice.title}</span></Link></td><td className="px-4 py-3">{payment.invoice.vendorName || '—'}</td><td className="px-4 py-3 font-semibold">{money(payment.paidAmount, payment.invoice.currency)}</td><td dir="ltr" className="px-4 py-3 text-xs">{payment.method || '—'}</td><td className="px-4 py-3 text-muted-foreground">{payment.note || payment.referenceNumber || '—'}</td></tr>)}
      {!loading && !error && !payments.length && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">{uiMessage(locale, 'notificationsEmpty')}</td></tr>}
    </tbody></table></div></section>
  </main>;
}
