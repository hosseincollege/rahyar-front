"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertCircle, CircleDollarSign, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { usePreferences, getLocaleDirection } from "@/components/preferences-provider";
import { uiMessage } from "@/lib/ui-messages";
import { ApiClientError, humanResourcesApi } from "@/app/(workspace)/human-resources/human-resources-api";
import type { HrAccess, HrReferenceData, PayrollRecord, PayrollStatus, SavePayrollPayload } from "@/app/(workspace)/human-resources/types";

const statusKey: Record<PayrollStatus, Parameters<typeof uiMessage>[1]> = { DRAFT: "hrStatusDraft", APPROVED: "hrStatusApproved", PAID: "hrStatusPaid" };
const currentPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};
const blankForm = (period: string) => ({ employeeId: "", period, currency: "IRR", baseSalary: "", overtime: "0", allowances: "0", deductions: "0", note: "" });

export default function HrPayrollPage() {
  const { locale } = usePreferences();
  const [period, setPeriod] = useState(currentPeriod);
  const [access, setAccess] = useState<HrAccess | null>(null);
  const [references, setReferences] = useState<HrReferenceData | null>(null);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [form, setForm] = useState(blankForm(currentPeriod()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (requestedPeriod = period) => {
    setLoading(true); setError(null);
    try {
      const [currentAccess, rows] = await Promise.all([humanResourcesApi.getAccess(), humanResourcesApi.getPayroll(requestedPeriod)]);
      setAccess(currentAccess); setRecords(rows);
      setReferences(currentAccess.canManagePayroll ? await humanResourcesApi.getReferenceData() : null);
    } catch (e) { setError(e instanceof ApiClientError ? e.message : uiMessage(locale, "hrPayrollLoadFailed")); }
    finally { setLoading(false); }
  }, [locale, period]);
  useEffect(() => { void load(); }, [load]);

  const formatAmount = (amount: string | number, currency: string) => {
    const value = Number(amount);
    try { return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
    catch { return `${new Intl.NumberFormat(locale).format(value)} ${currency}`; }
  };
  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!form.employeeId) return;
    setSaving(true); setError(null);
    try {
      const payload: SavePayrollPayload = {
        employeeId: form.employeeId, period: form.period, currency: form.currency.toUpperCase(),
        baseSalary: Number(form.baseSalary), overtime: Number(form.overtime || 0),
        allowances: Number(form.allowances || 0), deductions: Number(form.deductions || 0), note: form.note || undefined,
      };
      await humanResourcesApi.savePayroll(payload);
      if (form.period === period) await load(form.period);
      else setPeriod(form.period);
    } catch (e) { setError(e instanceof ApiClientError ? e.message : uiMessage(locale, "hrPayrollSaveFailed")); }
    finally { setSaving(false); }
  };
  const transition = async (row: PayrollRecord, next: "APPROVED" | "PAID") => {
    setSaving(true); setError(null);
    try { await humanResourcesApi.updatePayrollStatus(row.id, next); await load(); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : uiMessage(locale, "hrPayrollSaveFailed")); }
    finally { setSaving(false); }
  };

  return <div dir={getLocaleDirection(locale)} className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-primary/10 p-3 text-primary"><CircleDollarSign size={21}/></span><div><h1 className="text-lg font-bold">{uiMessage(locale, "sidebarPayroll")}</h1><p className="text-xs text-muted-foreground">{uiMessage(locale, "hrPeriod")}</p></div></div>
      <label className="flex items-center gap-2 text-sm"><span>{uiMessage(locale, "hrPeriod")}</span><input type="month" value={period} onChange={(e) => { setPeriod(e.target.value); setForm((current) => ({ ...current, period: e.target.value })); }} className="rounded-lg border border-border bg-background px-3 py-2"/></label>
    </header>
    {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600"><AlertCircle size={16}/>{error}<button className="ms-auto underline" onClick={() => void load()}>{uiMessage(locale, "hrRetry")}</button></div>}
    {access?.canManagePayroll && <form onSubmit={(e) => void handleSave(e)} className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
      <select required value={form.employeeId} onChange={(e) => setForm((v) => ({ ...v, employeeId: e.target.value }))} className="rounded-xl border border-border bg-background px-3 py-2 text-sm"><option value="">{uiMessage(locale, "hrEmployee")}</option>{references?.employees.map((person) => <option key={person.id} value={person.id}>{person.firstName} {person.lastName} · {person.employeeCode}</option>)}</select>
      <label className="space-y-1 text-xs font-semibold"><span>{uiMessage(locale, "hrPeriod")}</span><input required type="month" value={form.period} onChange={(e) => setForm((v) => ({ ...v, period: e.target.value }))} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"/></label>
      <label className="space-y-1 text-xs font-semibold"><span>{uiMessage(locale, "hrCurrency")}</span><input required minLength={3} maxLength={3} value={form.currency} onChange={(e) => setForm((v) => ({ ...v, currency: e.target.value.toUpperCase() }))} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" dir="ltr"/></label>
      <label className="space-y-1 text-xs font-semibold"><span>{uiMessage(locale, "hrBaseSalary")}</span><input required min="0" step="0.01" type="number" value={form.baseSalary} onChange={(e) => setForm((v) => ({ ...v, baseSalary: e.target.value }))} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" dir="ltr"/></label>
      <label className="space-y-1 text-xs font-semibold"><span>{uiMessage(locale, "hrOvertime")}</span><input min="0" step="0.01" type="number" value={form.overtime} onChange={(e) => setForm((v) => ({ ...v, overtime: e.target.value }))} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" dir="ltr"/></label>
      <label className="space-y-1 text-xs font-semibold"><span>{uiMessage(locale, "hrAllowances")}</span><input min="0" step="0.01" type="number" value={form.allowances} onChange={(e) => setForm((v) => ({ ...v, allowances: e.target.value }))} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" dir="ltr"/></label>
      <label className="space-y-1 text-xs font-semibold"><span>{uiMessage(locale, "hrDeductions")}</span><input min="0" step="0.01" type="number" value={form.deductions} onChange={(e) => setForm((v) => ({ ...v, deductions: e.target.value }))} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" dir="ltr"/></label>
      <label className="space-y-1 text-xs font-semibold"><span>{uiMessage(locale, "hrPayrollNote")}</span><input maxLength={1000} value={form.note} onChange={(e) => setForm((v) => ({ ...v, note: e.target.value }))} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"/></label>
      <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50 lg:col-span-4"><Save size={16}/>{uiMessage(locale, "hrSavePayroll")}</button>
    </form>}
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-4"><h2 className="font-bold">{period}</h2><button disabled={loading} onClick={() => void load()} className="rounded-lg border border-border p-2 text-muted-foreground disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/></button></div>
      <div className="overflow-x-auto"><table className="w-full text-start text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-4 py-3">{uiMessage(locale, "hrEmployee")}</th><th className="px-4 py-3">{uiMessage(locale, "hrBaseSalary")}</th><th className="px-4 py-3">{uiMessage(locale, "hrOvertime")}</th><th className="px-4 py-3">{uiMessage(locale, "hrAllowances")}</th><th className="px-4 py-3">{uiMessage(locale, "hrDeductions")}</th><th className="px-4 py-3">{uiMessage(locale, "hrNetPay")}</th><th className="px-4 py-3">{uiMessage(locale, "hrPayrollNote")}</th><th className="px-4 py-3">{uiMessage(locale, "hrPayrollStatus")}</th><th className="px-4 py-3"/></tr></thead><tbody className="divide-y divide-border">{!loading && records.map((row) => <tr key={row.id}><td className="px-4 py-3 font-medium">{row.employee.firstName} {row.employee.lastName}<span className="ms-2 text-xs text-muted-foreground">{row.employee.employeeCode}</span></td><td className="px-4 py-3">{formatAmount(row.baseSalary, row.currency)}</td><td className="px-4 py-3">{formatAmount(row.overtime, row.currency)}</td><td className="px-4 py-3">{formatAmount(row.allowances, row.currency)}</td><td className="px-4 py-3">{formatAmount(row.deductions, row.currency)}</td><td className="px-4 py-3 font-bold">{formatAmount(row.netAmount, row.currency)}</td><td className="max-w-36 truncate px-4 py-3" title={row.note || ""}>{row.note || "—"}</td><td className="px-4 py-3"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{uiMessage(locale, statusKey[row.status])}</span></td><td className="px-4 py-3">{access?.canManagePayroll && row.status === "DRAFT" && <button disabled={saving} onClick={() => void transition(row, "APPROVED")} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold"><ShieldCheck size={14}/>{uiMessage(locale, "hrApprovePayroll")}</button>}{access?.canManagePayroll && row.status === "APPROVED" && <button disabled={saving} onClick={() => void transition(row, "PAID")} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold">{uiMessage(locale, "hrMarkPayrollPaid")}</button>}</td></tr>)}{!loading && records.length === 0 && <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">{uiMessage(locale, "hrNoPayrollRecords")}</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
