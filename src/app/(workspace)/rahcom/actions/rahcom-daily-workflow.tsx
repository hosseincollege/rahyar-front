'use client';

import { DataTable } from '@/components/ui/data-table';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, LoaderCircle, RefreshCw, Save, Search, Trash2, Wrench, X } from 'lucide-react';
import { iranProvinces, rahcomApi, type RahcomActivity, type RahcomImportedTicket, type RahcomSolarSnapshot, type RahcomWorkflowSystem } from '@/lib/api/rahcom/rahcom-api';
import { formatJalaliDate } from '@/lib/api/rahcom/jalali-date';
import { filterRahcomLtePairs, normalizeRahcomSystemCode, normalizeRahcomSolarEquipmentColumn, parseRahcomSolarList, rahcomTicketDateKey, tehranDateKey } from '@/lib/api/rahcom/solar-status';
import { usePreferences } from '@/components/providers/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';

type VisitEntry = { systemId: string; kind?: 'system' | 'other'; subjectName?: string; issue: 'radar' | 'system' | ''; visitType: 'local' | 'no_lift' | 'with_lift' | ''; reason: string; performedBy: string; handedOverTo: string };
type WorkflowCompletion = { plan: boolean; report: boolean; note: boolean; excel: boolean };
const emptyCompletion: WorkflowCompletion = { plan: false, report: false, note: false, excel: false };
type WorkflowRecordType = 'SYSTEM_CODES' | 'ACTIONS_DATA' | 'VISIT_PLAN' | 'COMPLETION_REPORT' | 'DAILY_NOTE' | 'EXCEL_UPDATE';
const card = 'min-w-0';
const field = 'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary';
const button = 'inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50';

type EntryReferences = { entries: VisitEntry[]; codes: string[]; completed: WorkflowCompletion };

function parseEntryReferences(raw: string | undefined): EntryReferences {
  if (!raw) return { entries: [], codes: [], completed: emptyCompletion };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) || (parsed && typeof parsed === 'object' && Array.isArray((parsed as { entries?: unknown }).entries))) {
      const data = Array.isArray(parsed) ? null : parsed as { entries: unknown[]; completed?: Partial<WorkflowCompletion> };
      const list = Array.isArray(parsed) ? parsed : data?.entries ?? [];
      const unique = new Set<string>();
      const entries = list.flatMap((item): VisitEntry[] => {
        if (!item || typeof item !== 'object') return [];
        const value = item as Record<string, unknown>;
        const isOther = value.kind === 'other' && typeof value.subjectName === 'string';
        if (typeof value.systemId !== 'string' || !value.systemId.trim() || (!isOther && value.systemId.startsWith('other:')) || unique.has(value.systemId)) return [];
        unique.add(value.systemId);
        return [{
          systemId: value.systemId,
          ...(isOther ? { kind: 'other' as const, subjectName: value.subjectName as string } : {}),
          issue: value.issue === 'radar' || value.issue === 'system' ? value.issue : '',
          visitType: value.visitType === 'local' || value.visitType === 'no_lift' || value.visitType === 'with_lift' ? value.visitType : '',
          reason: typeof value.reason === 'string' ? value.reason : '',
          performedBy: typeof value.performedBy === 'string' ? value.performedBy : '',
          handedOverTo: typeof value.handedOverTo === 'string' ? value.handedOverTo : '',
        }];
      });
      const saved = data?.completed;
      return { entries, codes: [], completed: { plan: Boolean(saved?.plan), report: Boolean(saved?.report), note: Boolean(saved?.note), excel: Boolean(saved?.excel) } };
    }
  } catch { /* Older daily records stored system codes rather than JSON entries. */ }

  return { entries: [], codes: [...new Set(raw.split(/[\s,;،|]+/).map((code) => code.trim()).filter(Boolean))], completed: emptyCompletion };
}

export function RahcomDailyWorkflow({ date, province, items, onSaved, addGeneralRequest = 0 }: { date: string | null; province: string; items: RahcomActivity[]; onSaved: () => Promise<void>; addGeneralRequest?: number }) {
  const { locale } = usePreferences();
  const records = useMemo(() => Object.fromEntries(
    (['SYSTEM_CODES', 'ACTIONS_DATA', 'VISIT_PLAN', 'COMPLETION_REPORT', 'DAILY_NOTE', 'EXCEL_UPDATE'] as WorkflowRecordType[])
      .map((type) => [type, items.find((item) => item.activityType === type && item.provinceSnapshot === province) ?? null]),
  ) as Record<WorkflowRecordType, RahcomActivity | null>, [items, province]);
  const [entries, setEntries] = useState<VisitEntry[]>([]);
  const [systems, setSystems] = useState<RahcomWorkflowSystem[]>([]);
  const [solarSnapshots, setSolarSnapshots] = useState<RahcomSolarSnapshot[]>([]);
  const [tickets, setTickets] = useState<RahcomImportedTicket[]>([]);
  const [loadingSavedSystems, setLoadingSavedSystems] = useState(true);
  const [systemQuery, setSystemQuery] = useState('');
  const [searchState, setSearchState] = useState<{ query: string; results: RahcomWorkflowSystem[]; loading: boolean; failed: boolean }>({ query: '', results: [], loading: false, failed: false });
  const [plan, setPlan] = useState('');
  const [report, setReport] = useState('');
  const [note, setNote] = useState('');
  const [completed, setCompleted] = useState<WorkflowCompletion>(emptyCompletion);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');
  const [toolbarSearch, setToolbarSearch] = useState<HTMLElement | null>(null);
  const [toolbarCount, setToolbarCount] = useState<HTMLElement | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    // These nodes are stable toolbar slots rendered by RahcomActions.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToolbarSearch(document.getElementById('rahcom-actions-search'));
    setToolbarCount(document.getElementById('rahcom-actions-count'));
  }, []);

  useEffect(() => {
    let active = true;
    if (!date || !province) {
      queueMicrotask(() => { if (active) { setSolarSnapshots([]); setTickets([]); } });
      return () => { active = false; };
    }
    void Promise.all([rahcomApi.solarSnapshots(province, date), rahcomApi.importedTickets(province, date)])
      .then(([solar, imported]) => {
        if (!active) return;
        const day = tehranDateKey(date);
        setSolarSnapshots(solar.filter((item) => tehranDateKey(item.capturedAt) === day));
        setTickets(imported.filter((ticket) => rahcomTicketDateKey(ticket.createdOn, ticket.importedAt) === day));
      }).catch(() => { if (active) { setSolarSnapshots([]); setTickets([]); } });
    return () => { active = false; };
  }, [date, province]);

  useEffect(() => {
    if (dirtyRef.current) return;
    const savedReferences = parseEntryReferences(records.ACTIONS_DATA?.description ?? undefined);
    const legacyReferences = parseEntryReferences(records.SYSTEM_CODES?.description ?? undefined);
    setPlan(records.VISIT_PLAN?.description ?? '');
    setReport(records.COMPLETION_REPORT?.description ?? '');
    setNote(records.DAILY_NOTE?.description ?? '');
    setCompleted({ ...savedReferences.completed, excel: Boolean(records.EXCEL_UPDATE?.description) });
    setLoadingSavedSystems(true);
    const ids = [...new Set([...savedReferences.entries, ...legacyReferences.entries].filter((entry) => entry.kind !== 'other').map((entry) => entry.systemId))];
    const codes = [...new Set([...savedReferences.codes, ...legacyReferences.codes])];
    let active = true;
    const lookup = ids.length || codes.length
      ? rahcomApi.lookupSystems(province, ids, codes)
      : Promise.resolve([] as RahcomWorkflowSystem[]);
    void lookup.then((foundSystems) => {
      if (!active) return;
      setSystems(foundSystems);
      const byId = new Map(foundSystems.map((system) => [system.id, system]));
      const byCode = new Map(foundSystems.map((system) => [system.systemCode.trim().toLocaleLowerCase(), system]));
      const resolve = (references: EntryReferences) => {
        if (references.entries.length) return references.entries.filter((entry) => entry.kind === 'other' || byId.has(entry.systemId));
        const seen = new Set<string>();
        return references.codes.flatMap((code): VisitEntry[] => {
          const system = byCode.get(code.trim().toLocaleLowerCase());
          if (!system || seen.has(system.id)) return [];
          seen.add(system.id);
          return [{ systemId: system.id, issue: '', visitType: '', reason: '', performedBy: '', handedOverTo: '' }];
        });
      };
      const savedEntries = resolve(savedReferences);
      setEntries(savedEntries.length || !records.SYSTEM_CODES?.description ? savedEntries : resolve(legacyReferences));
    }).catch((cause: unknown) => {
      if (active) {
        setSystems([]);
        setEntries([]);
        setError(cause instanceof Error ? cause.message : 'Could not load saved systems.');
      }
    }).finally(() => { if (active) setLoadingSavedSystems(false); });
    return () => { active = false; };
  }, [province, records]);

  const query = systemQuery.trim();
  useEffect(() => {
    if (!query) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setSearchState({ query, results: [], loading: true, failed: false });
      void rahcomApi.searchSystems(province, query).then((results) => {
        if (active) setSearchState({ query, results, loading: false, failed: false });
      }).catch(() => {
        if (active) setSearchState({ query, results: [], loading: false, failed: true });
      });
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [province, query]);

  const selectedSystems = useMemo(() => entries.flatMap((entry) => {
    if (entry.kind === 'other') return [{ entry, system: { id: entry.systemId, province, systemName: entry.subjectName ?? '', systemCode: '', announcedAxis: null } }];
    const system = systems.find((item) => item.id === entry.systemId);
    return system ? [{ entry, system }] : [];
  }), [entries, province, systems]);
  const solarEquipmentByCode = useMemo(() => {
    const byCode = new Map<string, Set<string>>();
    const snapshot = [...solarSnapshots].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt) || b.createdAt.localeCompare(a.createdAt))[0];
    if (!snapshot) return byCode;
    const selectedColumns = new Set(snapshot.equipmentColumns.map((column) => normalizeRahcomSolarEquipmentColumn(column)).filter((column): column is string => Boolean(column)));
    const failedEntries = filterRahcomLtePairs([
      ...parseRahcomSolarList(snapshot.downText, 'down'),
      ...parseRahcomSolarList(snapshot.unreachableText, 'unreachable'),
    ]);
    for (const item of failedEntries) {
      const equipment = normalizeRahcomSolarEquipmentColumn(item.equipment);
      if (!equipment || !selectedColumns.has(equipment)) continue;
      const key = normalizeRahcomSystemCode(item.site);
      const values = byCode.get(key) ?? new Set<string>();
      values.add(equipment);
      byCode.set(key, values);
    }
    return byCode;
  }, [solarSnapshots]);
  const ticketTypesByCode = useMemo(() => {
    const byCode = new Map<string, Set<string>>();
    const day = tehranDateKey(date ?? undefined);
    for (const ticket of tickets) {
      if (rahcomTicketDateKey(ticket.createdOn, ticket.importedAt) !== day) continue;
      const key = normalizeRahcomSystemCode(ticket.systemCode);
      if (!key) continue;
      const values = byCode.get(key) ?? new Set<string>();
      values.add(ticket.type.trim() || ticket.summary.trim() || 'تیکت');
      byCode.set(key, values);
    }
    return byCode;
  }, [date, tickets]);
  const visibleSystems = selectedSystems;
  const searchResults = useMemo(() => searchState.query === query
    ? searchState.results.filter((system) => !entries.some((entry) => entry.systemId === system.id))
    : [], [entries, query, searchState]);
  const searchLoading = Boolean(query) && (searchState.query !== query || searchState.loading);
  const jalaliDate = date ? formatJalaliDate(date) : '';
  const provinceName = iranProvinces.find(([id]) => id === province)?.[1] ?? province;
  const dailyReportHeading = (() => {
    if (!date) return '';
    const parts = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-arabext', {
      timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).formatToParts(new Date(`${date}T12:00:00Z`));
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
    return `گزارش اکسل روزانه\n${part('weekday')} ${part('day')} ${part('month')} ماه ${part('year')}، استان ${provinceName}`;
  })();

  function addSystem(system: RahcomWorkflowSystem) {
    dirtyRef.current = true;
    setSystems((current) => current.some((item) => item.id === system.id) ? current : [...current, system]);
    setEntries((current) => [...current, { systemId: system.id, issue: '', visitType: '', reason: '', performedBy: '', handedOverTo: '' }]);
    setSystemQuery('');
  }
  function addOtherAction() {
    dirtyRef.current = true;
    setEntries((current) => [...current, { systemId: `other:${crypto.randomUUID()}`, kind: 'other', subjectName: '', issue: '', visitType: '', reason: '', performedBy: '', handedOverTo: '' }]);
  }

  useEffect(() => {
    if (addGeneralRequest > 0) addOtherAction();
  }, [addGeneralRequest]);
  function patchEntry(systemId: string, patch: Partial<VisitEntry>) {
    dirtyRef.current = true;
    setEntries((current) => current.map((entry) => entry.systemId === systemId ? { ...entry, ...patch } : entry));
  }
  function makeText(kind: 'plan' | 'report') {
    const heading = kind === 'plan' ? 'برنامه مراجعه' : 'گزارش تکمیلی';
    const lines = selectedSystems.map(({ entry, system }, index) => {
      const issue = entry.issue === 'radar' ? 'قطعی رادار' : entry.issue === 'system' ? 'قطعی سامانه' : 'شرح وضعیت: …';
      const visit = entry.visitType === 'local' ? 'با هماهنگی نیروی محلی' : entry.visitType === 'no_lift' ? 'بدون بالابر' : entry.visitType === 'with_lift' ? 'با بالابر' : 'نوع مراجعه: …';
      const details = [entry.reason && `علت مراجعه: ${entry.reason}`, entry.performedBy && `${uiMessage(locale, 'rahcomVisitor')}: ${entry.performedBy}`, entry.handedOverTo && `${uiMessage(locale, 'rahcomHandedOverTo')}: ${entry.handedOverTo}`].filter(Boolean).join('؛ ');
      const action = details || (kind === 'plan' ? 'شرح اقدام: …' : 'اقدام و نتیجه: …');
      const subject = system.systemName || 'مورد عمومی';
      const code = system.systemCode ? ` (کد سامانه: ${system.systemCode})` : '';
      return `${index + 1}. ${subject}${code}${system.announcedAxis ? `، محور: ${system.announcedAxis}` : ''}\n🔹 ${issue}؛ ${visit}؛ ${action}`;
    });
    return `استان ${provinceName}\n${heading}\n📅 ${jalaliDate}\n\n${lines.join('\n\n')}`;
  }
  async function save() {
    if (!date || !province || saving) return;
    setSaving(true);
    setError('');
    try {
      await rahcomApi.saveDailyWorkflow({ date, province, systemCodes: selectedSystems.filter((row) => row.entry.kind !== 'other').map((row) => row.system.systemCode).join('\n'), actionsData: JSON.stringify({ entries, completed }), visitPlan: plan, completionReport: report, dailyNote: note, excelUpdated: completed.excel });
      dirtyRef.current = false;
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ذخیره اطلاعات انجام نشد.');
    } finally {
      setSaving(false);
    }
  }
  async function copyText(kind: 'plan' | 'report' | 'excelHeading', value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied((current) => current === kind ? '' : current), 1600);
    } catch {
      setError('کپی متن انجام نشد.');
    }
  }

  const searchControl = <div className="relative w-full">
    <div className="flex h-9 items-center gap-2 rounded-full border border-border bg-background px-3 focus-within:border-primary">
      <Search size={16} className="shrink-0 text-muted-foreground" />
      <input value={systemQuery} onChange={(event) => setSystemQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && searchResults[0]) { event.preventDefault(); addSystem(searchResults[0]); } }} placeholder={uiMessage(locale, 'rahcomSearchSystems')} className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" dir="auto" role="combobox" aria-expanded={searchResults.length > 0} aria-controls="rahcom-system-search-results" aria-autocomplete="list" disabled={saving || loadingSavedSystems} />
      {searchLoading && <LoaderCircle size={15} className="animate-spin text-muted-foreground" aria-label="در حال جست‌وجو" />}
      {systemQuery && <button type="button" onClick={() => setSystemQuery('')} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted" aria-label="پاک کردن جست‌وجو"><X size={14} /></button>}
    </div>
    {searchResults.length > 0 && <div id="rahcom-system-search-results" role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-xl border border-border bg-card p-1 shadow-xl">{searchResults.map((system) => <button key={system.id} type="button" role="option" aria-selected={false} onClick={() => addSystem(system)} disabled={saving} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-start text-sm text-foreground hover:bg-accent disabled:opacity-50"><span className="truncate">{system.systemName}</span><bdi dir="ltr" className="font-mono text-xs text-muted-foreground">{system.systemCode}</bdi></button>)}</div>}
    {searchState.query === query && searchState.failed && <p role="alert" className="mt-2 text-xs text-destructive">جست‌وجوی سامانه ناموفق بود.</p>}
  </div>;
  return <section className="mb-5 space-y-3" dir="rtl" aria-label="ثبت برنامه روزانه اقدامات">
    {toolbarSearch && createPortal(searchControl, toolbarSearch)}
    {toolbarCount && createPortal(<span role="status" aria-label={`تعداد رکوردها: ${new Intl.NumberFormat(locale).format(selectedSystems.length)}`} title="تعداد رکوردها" className="inline-flex h-full items-center gap-1.5"><Wrench size={15} className="text-primary" aria-hidden="true" /><strong className="font-bold tabular-nums">{new Intl.NumberFormat(locale).format(selectedSystems.length)}</strong></span>, toolbarCount)}
    <div className={card}>
      {selectedSystems.length === 0 ? <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{loadingSavedSystems ? <span className="inline-flex items-center gap-2"><LoaderCircle size={15} className="animate-spin" />در حال بازیابی سامانه‌های ذخیره‌شده…</span> : 'برای شروع، یک سامانه را از کادر جست‌وجو انتخاب کنید.'}</div> : <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <DataTable className="w-full min-w-[1120px] border-separate border-spacing-0 text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>
            {['ردیف', 'کد سامانه', 'نام', 'وضعیت', 'نوع مراجعه', 'علت مراجعه', 'نفر مراجعه‌کننده', 'تحویل به', 'حذف'].map((heading, index) => <th key={`${heading}-${index}`} scope="col" className="whitespace-nowrap border-b border-border px-3 py-2.5 text-start font-semibold">{heading}</th>)}
          </tr></thead>
          <tbody>{visibleSystems.map(({ entry, system }, index) => <tr key={system.id} className="border-b border-border last:border-b-0 odd:bg-background even:bg-muted/20">
            <td className="whitespace-nowrap border-b border-border/70 px-3 py-2 text-center tabular-nums text-muted-foreground">{(index + 1).toLocaleString(locale)}</td>
            <td dir="ltr" className="whitespace-nowrap border-b border-border/70 px-3 py-2 text-center font-mono text-xs">{system.systemCode || '—'}</td>
            <td className="min-w-[14rem] max-w-[20rem] border-b border-border/70 px-2 py-2 font-medium text-foreground">{entry.kind === 'other' ? <input aria-label="نام مورد عمومی" className={field} maxLength={255} value={entry.subjectName ?? ''} disabled={saving} onChange={(event) => patchEntry(entry.systemId, { subjectName: event.target.value })} placeholder="مثلاً راهداری یا شرکت احداث گستر" /> : system.systemName}</td>
            <td className="max-w-56 border-b border-border/70 px-3 py-2 text-sm">{(() => { const code = normalizeRahcomSystemCode(system.systemCode); const equipment = [...(solarEquipmentByCode.get(code) ?? [])].map((item) => item === 'LTE' ? 'LTE' : item === 'RTR-1' ? '\u0631\u0648\u062a\u0631' : item === 'CAM-1' ? '\u062f\u0648\u0631\u0628\u06cc\u0646' : '\u0631\u0627\u062f\u0627\u0631'); return [...equipment, ...(ticketTypesByCode.get(code) ?? [])].join('\u060c ') || '\u2014'; })()}</td>
            <td className="w-48 border-b border-border/70 px-2 py-2"><select aria-label={`نوع مراجعه ${system.systemName || 'مورد عمومی'}`} className={field} value={entry.visitType} disabled={saving} onChange={(event) => patchEntry(system.id, { visitType: event.target.value as VisitEntry['visitType'] })}><option value="">انتخاب نوع مراجعه</option><option value="local">نیروی محلی</option><option value="no_lift">بدون بالابر</option><option value="with_lift">با بالابر</option></select></td>
            <td className="min-w-[13rem] border-b border-border/70 px-2 py-2"><input aria-label={`علت مراجعه ${system.systemName || 'مورد عمومی'}`} className={field} value={entry.reason} disabled={saving} onChange={(event) => patchEntry(system.id, { reason: event.target.value })} /></td>
            <td className="min-w-[11rem] border-b border-border/70 px-2 py-2"><input aria-label={`نفر مراجعه‌کننده ${system.systemName || 'مورد عمومی'}`} className={field} value={entry.performedBy} disabled={saving} onChange={(event) => patchEntry(system.id, { performedBy: event.target.value })} /></td>
            <td className="min-w-[11rem] border-b border-border/70 px-2 py-2"><input aria-label={`تحویل به ${system.systemName || 'مورد عمومی'}`} className={field} value={entry.handedOverTo} disabled={saving} onChange={(event) => patchEntry(system.id, { handedOverTo: event.target.value })} /></td>
            <td className="w-12 border-b border-border/70 px-2 py-2 text-center"><button type="button" onClick={() => { dirtyRef.current = true; setEntries((current) => current.filter((item) => item.systemId !== system.id)); }} disabled={saving} className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50" aria-label={`حذف ${system.systemName}`} title="حذف رکورد"><Trash2 size={16} /></button></td>
          </tr>)}{visibleSystems.length === 0 && selectedSystems.length > 0 && <tr><td colSpan={9} className="px-3 py-5 text-center text-muted-foreground">{'\u0628\u0627 \u0627\u06cc\u0646 \u0641\u06cc\u0644\u062a \u0645\u0648\u0631\u062f\u06cc \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.'}</td></tr>}</tbody>
        </DataTable>
      </div>}
    </div>

    <div className="grid gap-3 xl:grid-cols-4">
      {([{ key: 'plan', label: 'برنامه مراجعه', value: plan, set: setPlan }, { key: 'report', label: 'گزارش تکمیلی', value: report, set: setReport }] as const).map((box) => <div key={box.key} className={`${card} grid content-start gap-2`}>
        <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
          <label htmlFor={`actions-${box.key}`} className="text-sm font-semibold text-foreground">{box.label}</label>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => { dirtyRef.current = true; box.set(makeText(box.key)); }} disabled={saving || !selectedSystems.length} className="grid size-8 place-items-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted disabled:opacity-50" aria-label={`بازسازی ${box.label}`} title={`بازسازی ${box.label}`}><RefreshCw size={15} aria-hidden="true" /></button>
            <button type="button" disabled={saving || !box.value.trim()} onClick={() => void copyText(box.key, box.value)} className="grid size-8 place-items-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted disabled:opacity-50" aria-label={`کپی ${box.label}`} title={`کپی ${box.label}`}>{copied === box.key ? <Check size={15} /> : <Copy size={15} />}</button>
            <label className="inline-flex cursor-pointer items-center gap-1.5 px-1 text-xs text-muted-foreground"><input type="checkbox" checked={completed[box.key]} disabled={saving} onChange={(event) => { dirtyRef.current = true; setCompleted((current) => ({ ...current, [box.key]: event.target.checked })); }} className="size-4 accent-primary" />انجام شد</label>
          </div>
        </div>
        <textarea id={`actions-${box.key}`} maxLength={10000} value={box.value} disabled={saving} onChange={(event) => { dirtyRef.current = true; box.set(event.target.value); }} placeholder={`${box.label} را بنویسید یا با انتخاب سامانه‌ها بسازید…`} className="min-h-40 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm leading-6 text-foreground outline-none focus:border-primary disabled:opacity-60" dir="auto" />
      </div>)}
      <div className={`${card} grid content-start gap-2`}>
        <div className="flex min-h-9 items-center justify-between gap-2"><label htmlFor="actions-daily-note" className="text-sm font-semibold text-foreground">یادداشت</label><label className="inline-flex cursor-pointer items-center gap-1.5 px-1 text-xs text-muted-foreground"><input type="checkbox" checked={completed.note} disabled={saving} onChange={(event) => { dirtyRef.current = true; setCompleted((current) => ({ ...current, note: event.target.checked })); }} className="size-4 accent-primary" />انجام شد</label></div>
        <textarea id="actions-daily-note" maxLength={10000} value={note} disabled={saving} onChange={(event) => { dirtyRef.current = true; setNote(event.target.value); }} placeholder="یادداشت‌های مربوط به این روز…" className="min-h-40 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm leading-6 text-foreground outline-none focus:border-primary disabled:opacity-60" dir="auto" />
      </div>
      <div className={`${card} grid content-start gap-2`}>
        <div className="flex min-h-9 items-center justify-between gap-2"><h3 className="text-sm font-semibold text-foreground">اکسل گزارش روزانه</h3><div className="flex items-center gap-2"><button type="button" disabled={!dailyReportHeading} onClick={() => void copyText('excelHeading', dailyReportHeading)} aria-label="کپی عنوان اکسل گزارش روزانه" title="کپی عنوان اکسل گزارش روزانه" className="grid size-8 place-items-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted disabled:opacity-50">{copied === 'excelHeading' ? <Check size={15} /> : <Copy size={15} />}</button><label className="inline-flex cursor-pointer items-center gap-1.5 px-1 text-xs text-muted-foreground"><input type="checkbox" checked={completed.excel} disabled={saving} onChange={(event) => { dirtyRef.current = true; setCompleted((current) => ({ ...current, excel: event.target.checked })); }} className="size-4 accent-primary" />انجام شد</label></div></div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 xl:col-span-4"><button type="button" disabled={!date || saving} onClick={() => void save()} className={button}>{saving ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}{saving ? 'در حال ذخیره…' : 'ذخیره تغییرات روز'}</button></div>
    </div>    {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
  </section>;
}
