'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clipboard, LoaderCircle, Save, Search, Sparkles, X } from 'lucide-react';
import { iranProvinces, rahcomApi, type RahcomActivity, type RahcomSystem } from '@/lib/api/rahcom/rahcom-api';
import { formatJalaliDate } from '@/lib/api/rahcom/jalali-date';

type VisitEntry = { systemId: string; issue: 'radar' | 'system' | ''; visitType: 'local' | 'no_lift' | 'with_lift' | '' };
type WorkflowRecordType = 'SYSTEM_CODES' | 'ACTIONS_DATA' | 'VISIT_PLAN' | 'COMPLETION_REPORT' | 'DAILY_NOTE';
const card = 'rounded-xl border border-border bg-card p-3 sm:p-4';
const field = 'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary';
const button = 'inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50';

function parseEntries(raw: string | undefined, systems: RahcomSystem[]): VisitEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const validSystemIds = new Set(systems.map((system) => system.id));
      const unique = new Set<string>();
      return parsed.flatMap((item): VisitEntry[] => {
        if (!item || typeof item !== 'object') return [];
        const value = item as Record<string, unknown>;
        if (typeof value.systemId !== 'string' || !validSystemIds.has(value.systemId) || unique.has(value.systemId)) return [];
        unique.add(value.systemId);
        return [{
          systemId: value.systemId,
          issue: value.issue === 'radar' || value.issue === 'system' ? value.issue : '',
          visitType: value.visitType === 'local' || value.visitType === 'no_lift' || value.visitType === 'with_lift' ? value.visitType : '',
        }];
      });
    }
  } catch { /* Older daily records stored system codes rather than JSON entries. */ }

  const systemsByCode = new Map(systems.map((system) => [system.systemCode.trim().toLocaleLowerCase(), system]));
  const seen = new Set<string>();
  return raw.split(/[\s,;،|]+/).map((code) => systemsByCode.get(code.trim().toLocaleLowerCase()))
    .flatMap((system) => {
      if (!system || seen.has(system.id)) return [];
      seen.add(system.id);
      return [{ systemId: system.id, issue: '', visitType: '' }];
    });
}

export function RahcomDailyWorkflow({ date, province, items, systems, onSaved }: { date: string | null; province: string; items: RahcomActivity[]; systems: RahcomSystem[]; onSaved: () => Promise<void> }) {
  const records = useMemo(() => Object.fromEntries(
    (['SYSTEM_CODES', 'ACTIONS_DATA', 'VISIT_PLAN', 'COMPLETION_REPORT', 'DAILY_NOTE'] as WorkflowRecordType[])
      .map((type) => [type, items.find((item) => item.activityType === type && item.provinceSnapshot === province) ?? null]),
  ) as Record<WorkflowRecordType, RahcomActivity | null>, [items, province]);
  const [entries, setEntries] = useState<VisitEntry[]>([]);
  const [systemQuery, setSystemQuery] = useState('');
  const [plan, setPlan] = useState('');
  const [report, setReport] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (dirtyRef.current) return;
    const savedEntries = parseEntries(records.ACTIONS_DATA?.description ?? undefined, systems);
    const legacyEntries = savedEntries.length || !records.SYSTEM_CODES?.description
      ? savedEntries
      : parseEntries(records.SYSTEM_CODES.description ?? undefined, systems);
    setEntries(legacyEntries);
    setPlan(records.VISIT_PLAN?.description ?? '');
    setReport(records.COMPLETION_REPORT?.description ?? '');
    setNote(records.DAILY_NOTE?.description ?? '');
  }, [records, systems]);

  const selectedSystems = useMemo(() => entries.map((entry) => ({ entry, system: systems.find((system) => system.id === entry.systemId) }))
    .filter((row): row is { entry: VisitEntry; system: RahcomSystem } => Boolean(row.system)), [entries, systems]);
  const searchResults = useMemo(() => {
    const query = systemQuery.trim().toLocaleLowerCase();
    if (!query) return [];
    return systems.filter((system) => !entries.some((entry) => entry.systemId === system.id)
      && `${system.systemCode} ${system.systemName}`.toLocaleLowerCase().includes(query)).slice(0, 8);
  }, [systems, systemQuery, entries]);
  const jalaliDate = date ? formatJalaliDate(date) : '';
  const provinceName = iranProvinces.find(([id]) => id === province)?.[1] ?? province;

  function addSystem(system: RahcomSystem) {
    dirtyRef.current = true;
    setEntries((current) => [...current, { systemId: system.id, issue: '', visitType: '' }]);
    setSystemQuery('');
  }
  function patchEntry(systemId: string, patch: Partial<VisitEntry>) {
    dirtyRef.current = true;
    setEntries((current) => current.map((entry) => entry.systemId === systemId ? { ...entry, ...patch } : entry));
  }
  function makeText(kind: 'plan' | 'report') {
    const heading = kind === 'plan' ? 'برنامه مراجعه' : 'گزارش تکمیلی';
    const lines = selectedSystems.map(({ entry, system }, index) => {
      const issue = entry.issue === 'radar' ? 'قطعی رادار' : entry.issue === 'system' ? 'قطعی سامانه' : 'شرح وضعیت: …';
      const visit = entry.visitType === 'local' ? 'با هماهنگی نیروی محلی' : entry.visitType === 'no_lift' ? 'بدون بالابر' : entry.visitType === 'with_lift' ? 'با بالابر' : 'نوع مراجعه: …';
      const action = kind === 'plan' ? 'شرح اقدام: …' : 'اقدام و نتیجه: …';
      return `${index + 1}. ${system.systemName} (کد سامانه: ${system.systemCode})${system.announcedAxis ? `، محور: ${system.announcedAxis}` : ''}\n🔹 ${issue}؛ ${visit}؛ ${action}`;
    });
    return `استان ${provinceName}\n${heading}\n📅 ${jalaliDate}\n\n${lines.join('\n\n')}`;
  }
  async function save() {
    if (!date || !province || saving) return;
    setSaving(true);
    setError('');
    try {
      await rahcomApi.saveDailyWorkflow({ date, province, systemCodes: selectedSystems.map((row) => row.system.systemCode).join('\n'), actionsData: JSON.stringify(entries), visitPlan: plan, completionReport: report, dailyNote: note, excelUpdated: false });
      dirtyRef.current = false;
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ذخیره اطلاعات انجام نشد.');
    } finally {
      setSaving(false);
    }
  }
  async function copyText(kind: 'plan' | 'report', value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied((current) => current === kind ? '' : current), 1600);
    } catch {
      setError('کپی متن انجام نشد.');
    }
  }

  return <section className="mb-5 space-y-3" dir="rtl" aria-label="ثبت برنامه روزانه اقدامات">
    <div className={card}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">ثبت برنامه روزانه</h2>
          <p className="mt-1 text-xs text-muted-foreground">سامانه‌ها را پیدا کنید و نوع مراجعه و وضعیت را مشخص کنید؛ متن‌ها از انتخاب‌های شما ساخته می‌شوند.</p>
        </div>
        <span className="inline-flex h-7 items-center rounded-full border border-border bg-background px-2.5 text-xs text-muted-foreground">{selectedSystems.length.toLocaleString('fa-IR')} سامانه</span>
      </div>

      <div className="relative">
        <div className="flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:border-primary">
          <Search size={16} className="shrink-0 text-muted-foreground" />
          <input value={systemQuery} onChange={(event) => setSystemQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && searchResults[0]) { event.preventDefault(); addSystem(searchResults[0]); } }} placeholder="جست‌وجو با نام یا کد سامانه" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" dir="auto" role="combobox" aria-expanded={searchResults.length > 0} aria-controls="rahcom-system-search-results" aria-autocomplete="list" disabled={saving} />
          {systemQuery && <button type="button" onClick={() => setSystemQuery('')} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted" aria-label="پاک کردن جست‌وجو"><X size={14} /></button>}
        </div>
        {searchResults.length > 0 && <div id="rahcom-system-search-results" role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-xl border border-border bg-card p-1 shadow-xl">{searchResults.map((system) => <button key={system.id} type="button" role="option" aria-selected={false} onClick={() => addSystem(system)} disabled={saving} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-start text-sm text-foreground hover:bg-accent disabled:opacity-50"><span className="truncate">{system.systemName}</span><bdi dir="ltr" className="font-mono text-xs text-muted-foreground">{system.systemCode}</bdi></button>)}</div>}
      </div>

      {selectedSystems.length === 0 ? <div className="mt-3 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">برای شروع، یک سامانه را از کادر جست‌وجو انتخاب کنید.</div> : <div className="mt-3 space-y-2">
        {selectedSystems.map(({ entry, system }, index) => <article key={system.id} className="grid gap-3 rounded-lg border border-border bg-background p-3 lg:grid-cols-[minmax(190px,1.2fr)_minmax(170px,1fr)_minmax(170px,1fr)_auto] lg:items-end">
          <div className="flex min-w-0 items-center gap-2 self-center">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs tabular-nums text-muted-foreground">{(index + 1).toLocaleString('fa-IR')}</span>
            <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground" title={system.systemName}>{system.systemName}</p><bdi dir="ltr" className="font-mono text-xs text-muted-foreground">{system.systemCode}</bdi></div>
          </div>
          <label className="grid gap-1 text-xs text-muted-foreground">وضعیت سامانه<select className={field} value={entry.issue} disabled={saving} onChange={(event) => patchEntry(system.id, { issue: event.target.value as VisitEntry['issue'] })}><option value="">انتخاب وضعیت</option><option value="radar">قطعی رادار</option><option value="system">قطعی کامل سامانه</option></select></label>
          <label className="grid gap-1 text-xs text-muted-foreground">نوع مراجعه<select className={field} value={entry.visitType} disabled={saving} onChange={(event) => patchEntry(system.id, { visitType: event.target.value as VisitEntry['visitType'] })}><option value="">انتخاب نوع مراجعه</option><option value="local">نیروی محلی</option><option value="no_lift">بدون بالابر</option><option value="with_lift">با بالابر</option></select></label>
          <button type="button" onClick={() => { dirtyRef.current = true; setEntries((current) => current.filter((item) => item.systemId !== system.id)); }} disabled={saving} className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50 lg:mb-0" aria-label={`حذف ${system.systemName}`} title="حذف سامانه"><X size={15} /></button>
        </article>)}
      </div>}
    </div>

    <div className="grid gap-3 xl:grid-cols-2">
      {([{ key: 'plan', label: 'متن برنامه مراجعه', value: plan, set: setPlan }, { key: 'report', label: 'متن گزارش تکمیلی', value: report, set: setReport }] as const).map((box) => <div key={box.key} className={card}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><label htmlFor={`actions-${box.key}`} className="text-sm font-semibold text-foreground">{box.label}</label><div className="flex items-center gap-1.5"><button type="button" onClick={() => { dirtyRef.current = true; box.set(makeText(box.key)); }} disabled={saving || !selectedSystems.length} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50"><Sparkles size={14} />ساخت متن</button><button type="button" disabled={saving || !box.value.trim()} onClick={() => void copyText(box.key, box.value)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50">{copied === box.key ? <Check size={14} /> : <Clipboard size={14} />}{copied === box.key ? 'کپی شد' : 'کپی متن'}</button></div></div>
        <textarea id={`actions-${box.key}`} maxLength={10000} value={box.value} disabled={saving} onChange={(event) => { dirtyRef.current = true; box.set(event.target.value); }} placeholder={`${box.label} را بنویسید یا با انتخاب سامانه‌ها بسازید…`} className="min-h-40 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm leading-6 text-foreground outline-none focus:border-primary disabled:opacity-60" dir="auto" />
      </div>)}
    </div>

    <div className={card}>
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <label htmlFor="actions-daily-note" className="grid gap-2 text-sm font-semibold text-foreground">یادداشت روز<textarea id="actions-daily-note" maxLength={10000} value={note} disabled={saving} onChange={(event) => { dirtyRef.current = true; setNote(event.target.value); }} placeholder="یادداشت‌های مربوط به این روز…" className="min-h-24 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm font-normal leading-6 text-foreground outline-none focus:border-primary disabled:opacity-60" dir="auto" /></label>
        <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end"><span className="text-xs text-muted-foreground">تاریخ انتخاب‌شده: {jalaliDate || '—'} · ذخیره در پایگاه داده</span><button type="button" disabled={!date || saving} onClick={() => void save()} className={button}>{saving ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}{saving ? 'در حال ذخیره…' : 'ذخیره تغییرات روز'}</button></div>
      </div>
    </div>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
  </section>;
}
