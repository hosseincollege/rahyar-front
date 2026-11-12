'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Clipboard, LoaderCircle, Save, Search, Sparkles, X } from 'lucide-react';
import { iranProvinces, rahcomApi, type RahcomActivity, type RahcomSystem } from '@/lib/api/rahcom/rahcom-api';
import { formatJalaliDate } from '@/lib/api/rahcom/jalali-date';

type VisitEntry = { systemId: string; issue: 'radar' | 'system' | ''; visitType: 'local' | 'no_lift' | 'with_lift' | '' };
const card = 'rounded-xl border border-border bg-card p-3 sm:p-4';
const field = 'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary';
const button = 'inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50';

export function RahcomDailyWorkflow({ date, province, items, systems, onSaved }: { date: string | null; province: string; items: RahcomActivity[]; systems: RahcomSystem[]; onSaved: () => Promise<void> }) {
  const records = useMemo(() => Object.fromEntries(['SYSTEM_CODES', 'ACTIONS_DATA', 'VISIT_PLAN', 'COMPLETION_REPORT', 'DAILY_NOTE'].map(type => [type, items.find(item => item.activityType === type && item.provinceSnapshot === province) ?? null])) as Record<'SYSTEM_CODES' | 'ACTIONS_DATA' | 'VISIT_PLAN' | 'COMPLETION_REPORT' | 'DAILY_NOTE', RahcomActivity | null>, [items, province]);
  const [entries, setEntries] = useState<VisitEntry[]>([]);
  const [systemQuery, setSystemQuery] = useState('');
  const [plan, setPlan] = useState('');
  const [report, setReport] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let savedEntries: VisitEntry[] = [];
    try {
      const parsed = JSON.parse(records.ACTIONS_DATA?.description ?? '[]');
      if (Array.isArray(parsed)) savedEntries = parsed.filter((entry): entry is VisitEntry => entry && typeof entry.systemId === 'string');
    } catch { /* Older daily records only contained a list of system codes. */ }
    if (!savedEntries.length && records.SYSTEM_CODES?.description) {
      savedEntries = records.SYSTEM_CODES.description.split(/[\s,;،؛]+/).filter(Boolean).flatMap(code => {
        const system = systems.find(item => item.systemCode.toLocaleLowerCase() === code.toLocaleLowerCase());
        return system ? [{ systemId: system.id, issue: '' as const, visitType: '' as const }] : [];
      });
    }
    setEntries(savedEntries);
    setPlan(records.VISIT_PLAN?.description ?? '');
    setReport(records.COMPLETION_REPORT?.description ?? '');
    setNote(records.DAILY_NOTE?.description ?? '');
  }, [records, systems]);

  const selectedSystems = useMemo(() => entries.map(entry => ({ entry, system: systems.find(system => system.id === entry.systemId) })).filter((row): row is { entry: VisitEntry; system: RahcomSystem } => Boolean(row.system)), [entries, systems]);
  const searchResults = useMemo(() => {
    const query = systemQuery.trim().toLocaleLowerCase();
    if (!query) return [];
    return systems.filter(system => !entries.some(entry => entry.systemId === system.id) && `${system.systemCode} ${system.systemName}`.toLocaleLowerCase().includes(query)).slice(0, 8);
  }, [systems, systemQuery, entries]);
  const jalaliDate = date ? formatJalaliDate(date) : '';
  const provinceName = iranProvinces.find(([id]) => id === province)?.[1] ?? province;

  function addSystem(system: RahcomSystem) {
    setEntries(current => [...current, { systemId: system.id, issue: '', visitType: '' }]);
    setSystemQuery('');
  }
  function patchEntry(systemId: string, patch: Partial<VisitEntry>) {
    setEntries(current => current.map(entry => entry.systemId === systemId ? { ...entry, ...patch } : entry));
  }
  function makeText(kind: 'plan' | 'report') {
    const heading = kind === 'plan' ? 'برنامه مراجعه' : 'گزارش تکمیلی';
    const lines = selectedSystems.map(({ entry, system }, index) => {
      const issue = entry.issue === 'radar' ? 'قطعی رادار' : entry.issue === 'system' ? 'قطعی کامل سامانه' : 'شرح وضعیت: …';
      const visit = entry.visitType === 'local' ? 'با نیروی محلی' : entry.visitType === 'no_lift' ? 'بدون بالابر' : entry.visitType === 'with_lift' ? 'با بالابر' : 'نوع مراجعه: …';
      const description = kind === 'plan' ? `${issue}؛ ${visit} ـ شرح اقدام: …` : `${issue}؛ ${visit} ـ اقدام و نتیجه: …`;
      return `${index + 1}. ${system.systemName} (کد ${system.systemCode})${system.announcedAxis ? `، محور ${system.announcedAxis}` : ''}\n${description}`;
    });
    return `استان ${provinceName}\nتاریخ ${jalaliDate}\n${heading}\n\n${lines.join('\n\n')}`;
  }
  async function save() {
    if (!date || !province) return;
    setSaving(true); setError('');
    try {
      await rahcomApi.saveDailyWorkflow({ date, province, systemCodes: selectedSystems.map(row => row.system.systemCode).join('\n'), actionsData: JSON.stringify(entries), visitPlan: plan, completionReport: report, dailyNote: note, excelUpdated: false });
      await onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'ذخیره اطلاعات انجام نشد.'); }
    finally { setSaving(false); }
  }
  async function copyText(kind: 'plan' | 'report', value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(kind); window.setTimeout(() => setCopied(current => current === kind ? '' : current), 1600); }
    catch { setError('کپی متن انجام نشد.'); }
  }

  return <section className="mb-5 space-y-3" dir="rtl" aria-label="ثبت برنامه روزانه اقدامات">
    <div className={card}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">ثبت برنامهٔ روزانه</h2>
          <p className="mt-1 text-xs text-muted-foreground">سامانه‌ها را پیدا و وضعیت مراجعه را مشخص کنید؛ متن‌ها از انتخاب‌های شما ساخته می‌شوند.</p>
        </div>
        <span className="inline-flex h-7 items-center rounded-full border border-border bg-background px-2.5 text-xs text-muted-foreground">{selectedSystems.length.toLocaleString('fa-IR')} سامانه</span>
      </div>

      <div className="relative">
        <div className="flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:border-primary">
          <Search size={16} className="shrink-0 text-muted-foreground" />
          <input value={systemQuery} onChange={event => setSystemQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && searchResults[0]) { event.preventDefault(); addSystem(searchResults[0]); } }} placeholder="جست‌وجو با نام یا کد سامانه" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" dir="auto" role="combobox" aria-expanded={searchResults.length > 0} aria-autocomplete="list" />
          {systemQuery && <button type="button" onClick={() => setSystemQuery('')} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted" aria-label="پاک‌کردن جست‌وجو"><X size={14} /></button>}
        </div>
        {searchResults.length > 0 && <div role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-xl border border-border bg-card p-1 shadow-xl">{searchResults.map(system => <button key={system.id} type="button" role="option" onClick={() => addSystem(system)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-start text-sm text-foreground hover:bg-accent"><span className="truncate">{system.systemName}</span><bdi dir="ltr" className="font-mono text-xs text-muted-foreground">{system.systemCode}</bdi></button>)}</div>}
      </div>

      {selectedSystems.length === 0 ? <div className="mt-3 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">برای شروع، یک سامانه را از کادر جست‌وجو انتخاب کنید.</div> : <div className="mt-3 space-y-2">
        {selectedSystems.map(({ entry, system }, index) => <article key={system.id} className="grid gap-3 rounded-lg border border-border bg-background p-3 lg:grid-cols-[minmax(190px,1.2fr)_minmax(170px,1fr)_minmax(170px,1fr)_auto] lg:items-end">
          <div className="flex min-w-0 items-center gap-2 self-center">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs tabular-nums text-muted-foreground">{(index + 1).toLocaleString('fa-IR')}</span>
            <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground" title={system.systemName}>{system.systemName}</p><bdi dir="ltr" className="font-mono text-xs text-muted-foreground">{system.systemCode}</bdi></div>
          </div>
          <label className="grid gap-1 text-xs text-muted-foreground">وضعیت سامانه<select className={field} value={entry.issue} onChange={event => patchEntry(system.id, { issue: event.target.value as VisitEntry['issue'] })}><option value="">انتخاب وضعیت</option><option value="radar">رادار قطع</option><option value="system">کل سامانه قطع</option></select></label>
          <label className="grid gap-1 text-xs text-muted-foreground">نوع مراجعه<select className={field} value={entry.visitType} onChange={event => patchEntry(system.id, { visitType: event.target.value as VisitEntry['visitType'] })}><option value="">انتخاب نوع مراجعه</option><option value="local">نیروی محلی</option><option value="no_lift">بدون بالابر</option><option value="with_lift">با بالابر</option></select></label>
          <button type="button" onClick={() => setEntries(current => current.filter(item => item.systemId !== system.id))} className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive lg:mb-0" aria-label={`حذف ${system.systemName}`} title="حذف سامانه"><X size={15} /></button>
        </article>)}
      </div>}
    </div>

    <div className="grid gap-3 xl:grid-cols-2">
      {([{ key: 'plan', label: 'متن برنامهٔ مراجعه', value: plan, set: setPlan }, { key: 'report', label: 'متن گزارش تکمیلی', value: report, set: setReport }] as const).map(box => <div key={box.key} className={card}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><label htmlFor={`actions-${box.key}`} className="text-sm font-semibold text-foreground">{box.label}</label><div className="flex items-center gap-1.5"><button type="button" onClick={() => box.set(makeText(box.key))} disabled={!selectedSystems.length} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50"><Sparkles size={14} />ساخت متن</button><button type="button" disabled={!box.value.trim()} onClick={() => void copyText(box.key, box.value)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50">{copied === box.key ? <Check size={14} /> : <Clipboard size={14} />}{copied === box.key ? 'کپی شد' : 'کپی متن'}</button></div></div>
        <textarea id={`actions-${box.key}`} maxLength={10000} value={box.value} onChange={event => box.set(event.target.value)} placeholder={`${box.label} را بنویسید یا با انتخاب سامانه‌ها بسازید…`} className="min-h-40 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm leading-6 text-foreground outline-none focus:border-primary" dir="auto" />
      </div>)}
    </div>

    <div className={card}>
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <label htmlFor="actions-daily-note" className="grid gap-2 text-sm font-semibold text-foreground">یادداشت روز<textarea id="actions-daily-note" maxLength={10000} value={note} onChange={event => setNote(event.target.value)} placeholder="یادداشت‌های مربوط به این روز…" className="min-h-24 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm font-normal leading-6 text-foreground outline-none focus:border-primary" dir="auto" /></label>
        <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end"><span className="text-xs text-muted-foreground">تاریخ انتخاب‌شده: {jalaliDate || '—'} · ذخیره در پایگاه داده</span><button type="button" disabled={!date || saving} onClick={() => void save()} className={button}>{saving ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}{saving ? 'در حال ذخیره…' : 'ذخیره تغییرات روز'}</button></div>
      </div>
    </div>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
  </section>;
}
