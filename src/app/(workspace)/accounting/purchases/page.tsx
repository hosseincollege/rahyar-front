'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, RefreshCw } from 'lucide-react';
import { usePreferences, getLocaleDirection } from '@/components/preferences-provider';
import { accountingApi } from '@/app/(workspace)/accounting/accounting-api';
import { uiMessage } from '@/lib/ui-messages';
import type { AccountingListItem } from '@/app/(workspace)/accounting/types';
import { useAccountingAccess } from '../accounting-access-context';

export default function AccountingPurchasesPage() {
  const { locale } = usePreferences();
  const { canManage } = useAccountingAccess();
  const [invoices, setInvoices] = useState<AccountingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async () => { setLoading(true); setError(false); try { setInvoices(await accountingApi.getInvoices({ vendorOnly: true })); } catch { setError(true); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const money = (amount: number, currency: string) => { try { return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount); } catch { return `${new Intl.NumberFormat(locale).format(amount)} ${currency}`; } };
  return <main dir={getLocaleDirection(locale)} className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold text-primary">ERP</p><h1 className="mt-1 text-xl font-bold text-foreground">{uiMessage(locale, 'accountingPurchaseInvoices')}</h1></div><div className="flex gap-2"><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />{uiMessage(locale, 'notificationsRetry')}</button>{canManage && <Link href="/accounting/new" className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground"><Plus size={16} />{uiMessage(locale, 'acctNewPurchase')}</Link>}</div></header>
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto"><table className="w-full text-start text-sm"><thead className="bg-muted/40 text-muted-foreground"><tr><th className="px-4 py-3">{uiMessage(locale, 'acctVoucherDate')}</th><th className="px-4 py-3">{uiMessage(locale, 'accountingInvoices')}</th><th className="px-4 py-3">{uiMessage(locale, 'sidebarSuppliers')}</th><th className="px-4 py-3">{uiMessage(locale, 'acctAmount')}</th></tr></thead><tbody className="divide-y divide-border">{loading && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">{uiMessage(locale, 'notificationsLoading')}</td></tr>}{error && <tr><td colSpan={4} role="alert" className="p-8 text-center text-rose-600">{uiMessage(locale, 'acctLoadFailed')}</td></tr>}{!loading && !error && invoices.map((invoice) => <tr key={invoice.id}><td className="px-4 py-3 whitespace-nowrap">{new Intl.DateTimeFormat(locale).format(new Date(invoice.createdAt))}</td><td className="px-4 py-3"><Link href={`/accounting/${invoice.id}`} className="font-medium text-primary hover:underline"><span dir="ltr" className="font-mono text-xs">{invoice.documentNumber}</span><span className="ms-2">{invoice.title}</span></Link></td><td className="px-4 py-3">{invoice.vendorName}</td><td className="px-4 py-3 font-semibold">{money(invoice.totalAmount, invoice.currency)}</td></tr>)}{!loading && !error && !invoices.length && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">{uiMessage(locale, 'acctVouchersEmpty')}</td></tr>}</tbody></table></div></section>
  </main>;
}
