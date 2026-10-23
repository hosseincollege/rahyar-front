"use client";

import { getCalendarLocale } from '@/lib/calendar';
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarDays, Clock3, LogIn, LogOut, RefreshCw, Save } from "lucide-react";
import { usePreferences, getLocaleDirection } from "@/components/preferences-provider";
import { uiMessage } from "@/lib/ui-messages";
import { ApiClientError, humanResourcesApi } from "@/app/(workspace)/human-resources/human-resources-api";
import type { AttendanceRecord, AttendanceStatus, HrAccess, HrReferenceData } from "@/app/(workspace)/human-resources/types";

const STATUS_KEYS: Record<AttendanceStatus, Parameters<typeof uiMessage>[1]> = {
  PRESENT: "hrStatusPresent", ABSENT: "hrStatusAbsent", LATE: "hrStatusLate", REMOTE: "hrStatusRemote", HALF_DAY: "hrStatusHalfDay",
};
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function HrAttendancePage() {
  const { locale } = usePreferences();
  const [date, setDate] = useState(today);
  const [access, setAccess] = useState<HrAccess | null>(null);
  const [references, setReferences] = useState<HrReferenceData | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ employeeId: "", status: "PRESENT" as AttendanceStatus, checkInAt: "", checkOutAt: "", note: "" });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [currentAccess, rows] = await Promise.all([humanResourcesApi.getAccess(), humanResourcesApi.getAttendance(date)]);
      setAccess(currentAccess); setRecords(rows);
      setReferences(currentAccess.canManageAttendance ? await humanResourcesApi.getReferenceData() : null);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : uiMessage(locale, "hrAttendanceLoadFailed"));
    } finally { setLoading(false); }
  }, [date, locale]);
  useEffect(() => { void load(); }, [load]);

  const ownRecord = useMemo(() => records.find((row) => row.employeeId === access?.employeeId), [records, access?.employeeId]);
  const checkAction = async (action: "in" | "out") => {
    setSaving(true); setError(null);
    try { if (action === "in") await humanResourcesApi.checkIn(); else await humanResourcesApi.checkOut(); await load(); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : uiMessage(locale, "hrAttendanceLoadFailed")); }
    finally { setSaving(false); }
  };
  const saveManual = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!form.employeeId) return;
    setSaving(true); setError(null);
    try {
      await humanResourcesApi.saveAttendance({
        employeeId: form.employeeId, workDate: date, status: form.status, note: form.note || undefined,
        checkInAt: form.checkInAt ? new Date(form.checkInAt).toISOString() : undefined,
        checkOutAt: form.checkOutAt ? new Date(form.checkOutAt).toISOString() : undefined,
      });
      setForm((v) => ({ ...v, checkInAt: "", checkOutAt: "", note: "" })); await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : uiMessage(locale, "hrAttendanceLoadFailed")); }
    finally { setSaving(false); }
  };
  const statusLabel = (status: AttendanceStatus) => uiMessage(locale, STATUS_KEYS[status]);
  const formatTime = (value?: string | null) => value ? new Intl.DateTimeFormat(getCalendarLocale(locale), { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";

  return <div dir={getLocaleDirection(locale)} className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-primary/10 p-3 text-primary"><CalendarDays size={21}/></span><div><h1 className="text-lg font-bold">{uiMessage(locale, "sidebarAttendance")}</h1><p className="text-xs text-muted-foreground">{uiMessage(locale, "hrAttendanceState")}</p></div></div>
      <label className="flex items-center gap-2 text-sm"><span>{uiMessage(locale, "hrDate")}</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2"/></label>
    </header>
    {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600"><AlertCircle size={16}/>{error}<button className="ms-auto underline" onClick={() => void load()}>{uiMessage(locale, "hrRetry")}</button></div>}
    {date === today() && access?.employeeId && <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <Clock3 className="text-primary" size={20}/><span className="me-auto text-sm font-semibold">{ownRecord?.checkInAt ? `${uiMessage(locale, "hrArrivalTime")}: ${formatTime(ownRecord.checkInAt)}` : uiMessage(locale, "hrAttendanceEmpty")}</span>
      {!ownRecord?.checkInAt && <button disabled={saving} onClick={() => void checkAction("in")} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"><LogIn size={16}/>{uiMessage(locale, "hrCheckIn")}</button>}
      {ownRecord?.checkInAt && !ownRecord.checkOutAt && <button disabled={saving} onClick={() => void checkAction("out")} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"><LogOut size={16}/>{uiMessage(locale, "hrCheckOut")}</button>}
      {ownRecord?.checkOutAt && <span className="text-sm text-muted-foreground">{uiMessage(locale, "hrDepartureTime")}: {formatTime(ownRecord.checkOutAt)}</span>}
    </section>}
    {access?.canManageAttendance && <form onSubmit={(e) => void saveManual(e)} className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6">
      <select required value={form.employeeId} onChange={(e) => setForm((v) => ({ ...v, employeeId: e.target.value }))} className="rounded-xl border border-border bg-background px-3 py-2 text-sm"><option value="">{uiMessage(locale, "hrEmployee")}</option>{references?.employees.map((person) => <option key={person.id} value={person.id}>{person.firstName} {person.lastName} · {person.employeeCode}</option>)}</select>
      <select value={form.status} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value as AttendanceStatus }))} className="rounded-xl border border-border bg-background px-3 py-2 text-sm"><option value="PRESENT">{statusLabel("PRESENT")}</option><option value="ABSENT">{statusLabel("ABSENT")}</option><option value="LATE">{statusLabel("LATE")}</option><option value="REMOTE">{statusLabel("REMOTE")}</option><option value="HALF_DAY">{statusLabel("HALF_DAY")}</option></select>
      <input type="datetime-local" aria-label={uiMessage(locale, "hrArrivalTime")} value={form.checkInAt} onChange={(e) => setForm((v) => ({ ...v, checkInAt: e.target.value }))} className="rounded-xl border border-border bg-background px-3 py-2 text-sm"/>
      <input type="datetime-local" aria-label={uiMessage(locale, "hrDepartureTime")} value={form.checkOutAt} onChange={(e) => setForm((v) => ({ ...v, checkOutAt: e.target.value }))} className="rounded-xl border border-border bg-background px-3 py-2 text-sm"/>
      <input value={form.note} onChange={(e) => setForm((v) => ({ ...v, note: e.target.value }))} placeholder={uiMessage(locale, "hrPayrollNote")} className="rounded-xl border border-border bg-background px-3 py-2 text-sm"/>
      <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"><Save size={16}/>{uiMessage(locale, "hrAttendanceSave")}</button>
    </form>}
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-4"><h2 className="font-bold">{new Intl.DateTimeFormat(getCalendarLocale(locale), { dateStyle: "full" }).format(new Date(`${date}T12:00:00`))}</h2><button disabled={loading} onClick={() => void load()} className="rounded-lg border border-border p-2 text-muted-foreground disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/></button></div>
      <div className="overflow-x-auto"><table className="w-full text-start text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-4 py-3">{uiMessage(locale, "hrEmployee")}</th><th className="px-4 py-3">{uiMessage(locale, "hrBranch")}</th><th className="px-4 py-3">{uiMessage(locale, "hrDepartment")}</th><th className="px-4 py-3">{uiMessage(locale, "hrArrivalTime")}</th><th className="px-4 py-3">{uiMessage(locale, "hrDepartureTime")}</th><th className="px-4 py-3">{uiMessage(locale, "hrAttendanceState")}</th></tr></thead><tbody className="divide-y divide-border">{!loading && records.map((row) => <tr key={row.id}><td className="px-4 py-3 font-medium">{row.employee.firstName} {row.employee.lastName}<span className="ms-2 text-xs text-muted-foreground">{row.employee.employeeCode}</span></td><td className="px-4 py-3">{row.employee.branch?.name || "—"}</td><td className="px-4 py-3">{row.employee.department?.name || "—"}</td><td className="px-4 py-3">{formatTime(row.checkInAt)}</td><td className="px-4 py-3">{formatTime(row.checkOutAt)}</td><td className="px-4 py-3"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{statusLabel(row.status)}</span></td></tr>)}{!loading && records.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">{uiMessage(locale, "hrAttendanceEmpty")}</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
