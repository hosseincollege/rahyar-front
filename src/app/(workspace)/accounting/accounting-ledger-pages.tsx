'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, RefreshCw, X } from 'lucide-react';
import { usePreferences, getLocaleDirection } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import type { UiMessage } from '@/languages/types';
import { accountingApi } from '@/app/(workspace)/accounting/accounting-api';
import type { AccountingAccount, AccountingAccountType, AccountingLedgerLine, AccountingVoucher } from '@/app/(workspace)/accounting/types';
import { useAccountingAccess } from './accounting-access-context';

type Mode = 'accounts' | 'vouchers' | 'ledger';
type LineDraft = { accountId: string; debit: string; credit: string; description: string };
const accountTypes: AccountingAccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
const typeKey: Record<AccountingAccountType, 'acctAsset' | 'acctLiability' | 'acctEquity' | 'acctRevenue' | 'acctExpense'> = { ASSET: 'acctAsset', LIABILITY: 'acctLiability', EQUITY: 'acctEquity', REVENUE: 'acctRevenue', EXPENSE: 'acctExpense' };

export function AccountingLedgerPage({ mode }: { mode: Mode }) {
  const { locale } = usePreferences();
  const { canManage } = useAccountingAccess();
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [vouchers, setVouchers] = useState<AccountingVoucher[]>([]);
  const [ledger, setLedger] = useState<AccountingLedgerLine[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [validationError, setValidationError] = useState<UiMessage | null>(null);
  const [notice, setNotice] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountingAccountType>('ASSET');
  const [date, setDate] = useState(() => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10); });
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([{ accountId: '', debit: '', credit: '', description: '' }, { accountId: '', debit: '', credit: '', description: '' }]);
  const t = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const fmt = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
  const debitTotal = useMemo(() => lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0), [lines]);
  const creditTotal = useMemo(() => lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0), [lines]);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      if (mode === 'accounts') setAccounts(await accountingApi.getAccounts());
      if (mode === 'vouchers') {
        const [nextAccounts, nextVouchers] = await Promise.all([accountingApi.getAccounts(), accountingApi.getVouchers()]);
        setAccounts(nextAccounts); setVouchers(nextVouchers);
      }
      if (mode === 'ledger') {
        const [nextAccounts, nextLedger] = await Promise.all([accountingApi.getAccounts(), accountingApi.getLedger(selectedAccount || undefined)]);
        setAccounts(nextAccounts); setLedger(nextLedger);
      }
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [mode, selectedAccount]);
  useEffect(() => { void load(); }, [load]);

  async function submitAccount(event: FormEvent) {
    event.preventDefault(); setNotice(''); setError(false); setSaveError(false); setValidationError(null);
    if (!/^[0-9A-Za-z._-]{1,24}$/.test(code.trim())) { setValidationError('acctCodeInvalid'); return; }
    if (!name.trim()) { setValidationError('acctNameRequired'); return; }
    setSaving(true);
    try { await accountingApi.createAccount({ code, name, type: accountType }); setCode(''); setName(''); setNotice(t('acctSaved')); await load(); }
    catch { setSaveError(true); }
    finally { setSaving(false); }
  }

  async function submitVoucher(event: FormEvent) {
    event.preventDefault(); setNotice(''); setError(false); setSaveError(false); setValidationError(null);
    if (Number.isNaN(Date.parse(date))) { setValidationError('acctDateInvalid'); return; }
    if (lines.length < 2) { setValidationError('acctLineRequired'); return; }
    if (lines.some((line) => !line.accountId || (Number(line.debit) || 0) + (Number(line.credit) || 0) <= 0)) { setValidationError('acctPositiveLine'); return; }
    if (lines.some((line) => Boolean(Number(line.debit)) === Boolean(Number(line.credit)))) { setValidationError('acctLineSide'); return; }
    if (Math.round(debitTotal * 100) !== Math.round(creditTotal * 100)) { setValidationError('acctUnbalanced'); return; }
    setSaving(true);
    try {
      await accountingApi.createVoucher({ date, description, lines: lines.map((line) => ({ accountId: line.accountId, debit: Number(line.debit) || 0, credit: Number(line.credit) || 0, description: line.description || undefined })) });
      setDescription(''); setLines([{ accountId: '', debit: '', credit: '', description: '' }, { accountId: '', debit: '', credit: '', description: '' }]);
      setNotice(t('acctSaved')); await load();
    } catch { setSaveError(true); }
    finally { setSaving(false); }
  }

  async function postVoucher(id: string) {
    if (!window.confirm(t('acctPostConfirm'))) return;
    setSaving(true); setError(false); setSaveError(false);
    try { await accountingApi.postVoucher(id); await load(); }
    catch { setSaveError(true); }
    finally { setSaving(false); }
  }

  const title = mode === 'accounts' ? 'accountingChartOfAccounts' : mode === 'vouchers' ? 'accountingEntriesLedger' : 'sidebarLedger';
  const accountLabel = (account: Pick<AccountingAccount, 'code' | 'name'>) => `${account.code} · ${account.name}`;

  return <main dir={getLocaleDirection(locale)} className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold text-primary">ERP</p><h1 className="mt-1 text-xl font-bold text-foreground">{t(title)}</h1></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />{t('notificationsRetry')}</button></header>
    {error && <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-600">{t('acctLoadFailed')}</div>}
    {saveError && <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-600">{t('acctSaveFailed')}</div>}
    {validationError && <div role="alert" className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-700">{t(validationError)}</div>}
    {notice && <div role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-700">{notice}</div>}

    {mode === 'accounts' && <>
      {canManage && <form onSubmit={submitAccount} className="grid gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-sm font-medium text-foreground"><span>{t('acctCode')}</span><input required maxLength={24} value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono" /></label>
        <label className="space-y-1 text-sm font-medium text-foreground"><span>{t('acctName')}</span><input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-background px-3" /></label>
        <label className="space-y-1 text-sm font-medium text-foreground"><span>{t('acctType')}</span><select value={accountType} onChange={(e) => setAccountType(e.target.value as AccountingAccountType)} className="h-10 w-full rounded-xl border border-border bg-background px-3">{accountTypes.map((type) => <option key={type} value={type}>{t(typeKey[type])}</option>)}</select></label>
        <button disabled={saving} className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Plus size={16} />{t('acctCreate')}</button>
      </form>}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto"><table className="w-full text-start text-sm"><thead className="bg-muted/40 text-muted-foreground"><tr><th className="px-4 py-3">{t('acctCode')}</th><th className="px-4 py-3">{t('acctName')}</th><th className="px-4 py-3">{t('acctType')}</th></tr></thead><tbody className="divide-y divide-border">{!loading && accounts.map((account) => <tr key={account.id}><td dir="ltr" className="px-4 py-3 font-mono">{account.code}</td><td className="px-4 py-3 font-medium text-foreground">{account.name}</td><td className="px-4 py-3 text-muted-foreground">{t(typeKey[account.type])}</td></tr>)}{!loading && !accounts.length && <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">{t('acctAccountsEmpty')}</td></tr>}</tbody></table></div></section>
    </>}

    {mode === 'vouchers' && <>
      {canManage && <form onSubmit={submitVoucher} className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm font-medium"><span>{t('acctVoucherDate')}</span><input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-background px-3" /></label><label className="space-y-1 text-sm font-medium"><span>{t('acctDescription')}</span><input required maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-background px-3" /></label></div>
        <div className="space-y-3">{lines.map((line, index) => <div key={index} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[minmax(180px,1fr)_minmax(150px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_auto]">
          <select required aria-label={t('acctSelectAccount')} value={line.accountId} onChange={(e) => setLines((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, accountId: e.target.value } : row))} className="h-10 min-w-0 rounded-lg border border-border bg-background px-2"><option value="">{t('acctSelectAccount')}</option>{accounts.filter((account) => account.isActive).map((account) => <option key={account.id} value={account.id}>{accountLabel(account)}</option>)}</select>
          <input aria-label={t('acctDescription')} placeholder={t('acctDescription')} value={line.description} onChange={(e) => setLines((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, description: e.target.value } : row))} className="h-10 min-w-0 rounded-lg border border-border bg-background px-2" />
          <input aria-label={t('acctDebit')} type="number" min="0" step="0.01" value={line.debit} onChange={(e) => setLines((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, debit: e.target.value, credit: e.target.value ? '' : row.credit } : row))} placeholder={t('acctDebit')} className="h-10 min-w-0 rounded-lg border border-border bg-background px-2" />
          <input aria-label={t('acctCredit')} type="number" min="0" step="0.01" value={line.credit} onChange={(e) => setLines((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, credit: e.target.value, debit: e.target.value ? '' : row.debit } : row))} placeholder={t('acctCredit')} className="h-10 min-w-0 rounded-lg border border-border bg-background px-2" />
          {lines.length > 2 && <button type="button" aria-label={t('acctRemoveLine')} onClick={() => setLines((current) => current.filter((_, rowIndex) => rowIndex !== index))} className="grid size-10 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted"><X size={16} /></button>}
        </div>)}</div>
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-4 text-sm"><span>{t('acctDebit')}: <b>{fmt(debitTotal)}</b></span><span>{t('acctCredit')}: <b>{fmt(creditTotal)}</b></span><span className={Math.round(debitTotal * 100) === Math.round(creditTotal * 100) ? 'text-emerald-600' : 'text-amber-600'}>{t('acctBalance')}: {fmt(Math.abs(debitTotal - creditTotal))}</span>{Math.round(debitTotal * 100) !== Math.round(creditTotal * 100) && <span className="text-amber-600">{t('acctUnbalanced')}</span>}</div><div className="flex gap-2"><button type="button" onClick={() => setLines((current) => [...current, { accountId: '', debit: '', credit: '', description: '' }])} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm"><Plus size={15} />{t('acctAddLine')}</button><button disabled={saving || accounts.length === 0} className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{t('acctAddVoucher')}</button></div></div>
      </form>}
      <section className="space-y-3">{!loading && !vouchers.length && <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{t('acctVouchersEmpty')}</div>}{vouchers.map((voucher) => <article key={voucher.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span dir="ltr" className="font-mono font-bold text-primary">{voucher.number}</span><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{voucher.status === 'POSTED' ? t('acctPosted') : t('acctDraft')}</span></div><p className="mt-1 text-sm font-medium">{voucher.description}</p><p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { timeZone: 'UTC' }).format(new Date(voucher.date))}</p></div>{canManage && voucher.status === 'DRAFT' && <button type="button" disabled={saving} onClick={() => void postVoucher(voucher.id)} className="h-9 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">{t('acctPost')}</button>}</div><div className="mt-4 overflow-x-auto"><table className="w-full text-start text-xs"><thead className="text-muted-foreground"><tr><th className="py-2">{t('acctCode')} · {t('acctName')}</th><th className="py-2">{t('acctDebit')}</th><th className="py-2">{t('acctCredit')}</th></tr></thead><tbody className="divide-y divide-border">{voucher.lines.map((line, i) => <tr key={line.id || i}><td className="py-2">{line.account && accountLabel(line.account)}</td><td className="py-2">{fmt(line.debit)}</td><td className="py-2">{fmt(line.credit)}</td></tr>)}</tbody></table></div></article>)}</section>
    </>}

    {mode === 'ledger' && <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="border-b border-border p-4"><label className="block max-w-md space-y-1 text-sm font-medium"><span>{t('acctSelectAccount')}</span><select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-background px-3"><option value="">{t('acctSelectAccount')}</option>{accounts.map((account) => <option key={account.id} value={account.id}>{accountLabel(account)}</option>)}</select></label></div><div className="overflow-x-auto"><table className="w-full text-start text-sm"><thead className="bg-muted/40 text-muted-foreground"><tr><th className="px-4 py-3">{t('acctVoucherDate')}</th><th className="px-4 py-3">{t('acctDescription')}</th><th className="px-4 py-3">{t('acctCode')} · {t('acctName')}</th><th className="px-4 py-3">{t('acctDebit')}</th><th className="px-4 py-3">{t('acctCredit')}</th></tr></thead><tbody className="divide-y divide-border">{ledger.map((row) => <tr key={row.id}><td className="px-4 py-3 whitespace-nowrap">{new Intl.DateTimeFormat(locale, { timeZone: 'UTC' }).format(new Date(row.voucher.date))}</td><td className="px-4 py-3"><span dir="ltr" className="font-mono text-xs">{row.voucher.number}</span><div className="text-xs text-muted-foreground">{row.description || row.voucher.description}</div></td><td className="px-4 py-3">{accountLabel(row.account)}</td><td className="px-4 py-3">{fmt(row.debit)}</td><td className="px-4 py-3">{fmt(row.credit)}</td></tr>)}{!loading && !ledger.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{t('acctLedgerEmpty')}</td></tr>}</tbody></table></div></section>}
  </main>;
}
