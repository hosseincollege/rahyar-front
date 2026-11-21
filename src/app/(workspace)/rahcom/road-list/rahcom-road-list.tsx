'use client';

import { RahcomToolbar } from '@/components/rahcom/toolbar';
import { DataTable } from '@/components/ui/data-table';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { Check, ChevronLeft, ChevronRight, ClipboardCopy, Download, FileUp, ListFilter, LoaderCircle, LockKeyhole, Pencil, Save, X } from 'lucide-react';
import { usePreferences, getLocaleDirection } from '@/components/providers/preferences-provider';
import { getCurrentOrganizationId } from '@/lib/api/shared/auth-api';
import { settingsApi } from '@/lib/api/settings-api';
import { apiClient } from '@/lib/api-client';
import { uiMessage } from '@/lib/ui-messages';
import { iranProvinces, rahcomApi, type RahcomRoadListSnapshot, type RahcomSolarSnapshot, type RahcomSystem, type RahcomTrafficSnapshot } from '@/lib/api/rahcom/rahcom-api';
import { useRahcomDate } from '@/app/(workspace)/rahcom/_shared/rahcom-date';
import { formatJalaliDate } from '@/lib/api/rahcom/jalali-date';
import { filterRahcomLtePairs, parseRahcomSolarList, rahcomLongOutageReasonLabel, rahcomSolarSnapshotNumber, rahcomSystemHasLongOutage, rahcomSystemKey, tehranDateKey } from '@/lib/api/rahcom/solar-status';
import { RahcomHeaderDate } from '@/app/(workspace)/rahcom/_shared/rahcom-header-date';
import { RahcomRecordSummary } from '@/app/(workspace)/rahcom/_shared/rahcom-record-summary';
import { RahcomCountCapsule } from '@/app/(workspace)/rahcom/_shared/rahcom-count-capsule';
import { RahcomInfoHeader, RahcomRowInfo } from '@/app/(workspace)/rahcom/_shared/rahcom-row-info';
import { SolarSnapshotPicker } from '@/app/(workspace)/rahcom/_shared/rahcom-section';

const PAGE_SIZE = 100;
type RoadListSystemMatch = { systemCode: string; systemName: string; systemLabel?: string };
type RoadListMatchLookup = {
  identifierIndex: number;
  stationNameIndex: number;
  systemsByAggregationCode: Map<string, RahcomSystem[]>;
  systemsByCode: Map<string, RahcomSystem>;
  trafficMatches: Map<string, RoadListSystemMatch[]>;
};
const defaultRoadListPromptBody = `از تصویر پیوست‌شده، جدول راهداری را استخراج کن و فایل اکسل را تحویل بده.

قواعد استخراج:
- عنوان ستون کدهای هشت‌رقمی را دقیقاً «کد ایستگاه» بگذار.
- عنوان ستون نام ایستگاه را دقیقاً «نام ایستگاه» بگذار.
- عنوان ستون محور را دقیقاً «محور ایستگاه» بگذار.`;
const buildRoadListFilename = (jalaliDate: string) => `road-list-${jalaliDate.replaceAll('/', '-')}.xlsx`;
const buildRoadListImagePrompt = (jalaliDate: string, body: string) => `${body.trim()}\n\nنام فایل خروجی: ${buildRoadListFilename(jalaliDate)}`;
function RoadListPromptControl({ locale, canManage, selectedDate }: { locale: string; canManage: boolean; selectedDate: string }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(defaultRoadListPromptBody);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [copyState, setCopyState] = useState<'copied' | 'failed' | null>(null);
  const promptText = buildRoadListImagePrompt(formatJalaliDate(selectedDate), body);
  const promptApiPath = () => {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) throw new Error('شناسهٔ سازمان در دسترس نیست.');
    return `/api/rahcom/road-list-prompt?organizationId=${encodeURIComponent(organizationId)}`;
  };
  const extractBody = (savedText: string) => {
    const sections = savedText.trim().split(/\n\s*\n/).filter((section) => !/road-list-.*\.xlsx/i.test(section));
    const markerIndex = sections.findIndex((section) => section.includes('قواعد استخراج:'));
    if (markerIndex >= 0) {
      const editableSections = sections.slice(0, markerIndex + 1);
      if (!editableSections.slice(0, markerIndex).join('\n\n').trim()) editableSections.unshift('از تصویر پیوست‌شده، جدول راهداری را استخراج کن و فایل اکسل را تحویل بده.');
      editableSections.push(...sections.slice(markerIndex + 1));
      return editableSections.join('\n\n').trim();
    }
    return sections.join('\n\n').trim() || defaultRoadListPromptBody;
  };
  const openPrompt = () => {
    setBody(defaultRoadListPromptBody);
    setOpen(true);
    setEditing(false);
    setError('');
    setSaved(false);
    setCopyState(null);
    setBusy(true);
    let request: Promise<{ prompt: string | null }>;
    try { request = apiClient.get<{ prompt: string | null }>(promptApiPath()); }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : 'بارگذاری پرامپت ذخیره‌شده انجام نشد.');
      setBusy(false);
      return;
    }
    void request
      .then((result) => { if (result.prompt) setBody(extractBody(result.prompt)); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'بارگذاری پرامپت ذخیره‌شده انجام نشد.'))
      .finally(() => setBusy(false));
  };
  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(promptText); setCopyState('copied'); window.setTimeout(() => setCopyState(null), 1800); }
    catch { setCopyState('failed'); }
  };
  const savePrompt = async () => {
    setBusy(true); setError('');
    try { await apiClient.put<{ saved: boolean }>(promptApiPath(), { prompt: body }); setEditing(false); setSaved(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'ذخیرهٔ پرامپت انجام نشد.'); }
    finally { setBusy(false); }
  };
  return <>
    <button type="button" onClick={openPrompt} aria-label={locale === 'fa' ? 'پرامپت' : 'Prompt'} data-toolbar-label={locale === 'fa' ? 'پرامپت' : 'Prompt'} title={locale === 'fa' ? 'پرامپت' : 'Prompt'} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground hover:border-primary hover:text-primary"><ClipboardCopy size={17} aria-hidden="true" /></button>
    {open && typeof document !== 'undefined' ? createPortal(<div className="fixed inset-0 z-[1001] flex items-center justify-center bg-transparent p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-label={locale === 'fa' ? 'پرامپت استخراج تصویر راهداری' : 'Road list image extraction prompt'} style={{ backgroundColor: 'var(--card)', opacity: 1 }} className="flex max-h-[min(86vh,54rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border text-foreground shadow-2xl">
        <header dir="rtl" className="flex shrink-0 items-center justify-start gap-3 border-b border-border px-4 py-3 sm:px-5"><div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={() => setOpen(false)} aria-label={locale === 'fa' ? 'بستن' : 'Close'} title={locale === 'fa' ? 'بستن' : 'Close'} className="grid size-9 place-items-center rounded-lg border border-border bg-background text-destructive hover:border-destructive hover:bg-destructive/10"><X size={17}/></button>
          <button type="button" disabled={busy || !promptText.trim()} onClick={() => void copyPrompt()} aria-label={locale === 'fa' ? 'کپی پرامپت' : 'Copy prompt'} title={locale === 'fa' ? 'کپی پرامپت' : 'Copy prompt'} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-foreground hover:border-primary hover:text-primary disabled:opacity-50">{copyState === 'copied' ? <Check size={16}/> : <ClipboardCopy size={16}/>}<span>{locale === 'fa' ? 'کپی متن' : 'Copy text'}</span></button>
          {canManage && <button type="button" disabled={busy} onClick={() => { setEditing((value) => !value); setError(''); setSaved(false); }} aria-label={editing ? (locale === 'fa' ? 'پایان ویرایش' : 'Stop editing') : (locale === 'fa' ? 'ویرایش پرامپت' : 'Edit prompt')} title={editing ? (locale === 'fa' ? 'پایان ویرایش' : 'Stop editing') : (locale === 'fa' ? 'ویرایش پرامپت' : 'Edit prompt')} className="grid size-9 place-items-center rounded-lg border border-border bg-background text-foreground hover:border-primary hover:text-primary disabled:opacity-50">{editing ? <Check size={16}/> : <Pencil size={16}/>}</button>}
        </div></header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {editing ? <div className="space-y-3"><textarea autoFocus dir="auto" value={body} onChange={(event) => { setBody(event.target.value); setSaved(false); }} className="min-h-[42vh] w-full resize-y rounded-xl border border-border bg-background p-4 text-sm leading-7 text-foreground outline-none focus:border-primary"/><div className="inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"><LockKeyhole size={15} aria-hidden="true"/><code dir="ltr" className="truncate font-mono">{buildRoadListFilename(formatJalaliDate(selectedDate))}</code></div></div> : <pre dir="auto" className="min-h-[50vh] whitespace-pre-wrap break-words rounded-xl border border-border bg-background p-4 text-sm leading-7 text-foreground">{promptText}</pre>}
          {busy && <div role="status" className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle size={15} className="animate-spin"/>{locale === 'fa' ? 'در حال بارگذاری…' : 'Loading…'}</div>}
          {error && <p role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}{saved && <p role="status" className="mt-3 text-sm text-primary">{locale === 'fa' ? 'پرامپت در فایل پروژه ذخیره شد.' : 'Prompt saved to the project file.'}</p>}{copyState === 'copied' && <p role="status" className="mt-3 text-sm text-primary">{locale === 'fa' ? 'متن پرامپت کپی شد.' : 'Prompt copied.'}</p>}{copyState === 'failed' && <p role="alert" className="mt-3 text-sm text-destructive">{locale === 'fa' ? 'کپی انجام نشد.' : 'Copy failed.'}</p>}
        </div>
        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">{editing && canManage && <button type="button" disabled={busy || !body.trim()} onClick={() => void savePrompt()} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy ? <LoaderCircle size={16} className="animate-spin"/> : <Save size={16}/>}<span>{locale === 'fa' ? 'ذخیره در پروژه' : 'Save to project'}</span></button>}</footer>
      </section>
    </div>, document.body) : null}
  </>;
}
const normalizeHeader = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa')
  .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\u200c\s_\-./()]/g, '');
const isRoadListAxisHeader = (value: string) => normalizeHeader(value).includes('\u0645\u062d\u0648\u0631') || normalizeHeader(value).includes('axis');
const isRoadListStationCodeHeader = (value: string) => {
  const normalized = normalizeHeader(value);
  const isCode = normalized.includes('\u06a9\u062f') || normalized.includes('code');
  const isStationIdentifier = normalized.includes('\u0627\u06cc\u0633\u062a\u06af\u0627\u0647') || normalized.includes('\u0633\u0627\u0645\u0627\u0646\u0647') || normalized.includes('\u0634\u0646\u0627\u0633') || normalized.includes('station') || normalized.includes('system') || normalized.includes('identifier');
  return isCode && (isStationIdentifier || normalized === '\u06a9\u062f' || normalized === 'code');
};
const isRoadListStationNameHeader = (value: string) => {
  const normalized = normalizeHeader(value);
  const isName = normalized.includes('\u0646\u0627\u0645') || normalized.includes('name');
  const isStationIdentifier = normalized.includes('\u0627\u06cc\u0633\u062a\u06af\u0627\u0647') || normalized.includes('\u0633\u0627\u0645\u0627\u0646\u0647') || normalized.includes('station') || normalized.includes('system');
  return isName && isStationIdentifier;
};
const canonicalRoadListHeader = (value: string) => isRoadListAxisHeader(value)
  ? '\u0645\u062d\u0648\u0631'
  : isRoadListStationCodeHeader(value)
    ? '\u06a9\u062f \u0627\u06cc\u0633\u062a\u06af\u0627\u0647'
    : isRoadListStationNameHeader(value)
      ? '\u0646\u0627\u0645 \u0627\u06cc\u0633\u062a\u06af\u0627\u0647'
      : value;
const isSolarHeader = (value: string) => normalizeHeader(value).includes(normalizeHeader('سولار')) || normalizeHeader(value).includes('solar') || normalizeHeader(value).includes(normalizeHeader('وضعیت لیست تردد')) || normalizeHeader(value).includes('trafficliststatus');
const normalizeIdentifier = (value: unknown) => String(value ?? '').normalize('NFKC')
  .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
  .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
  .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9')
  .replace(/[\u200c\s]/g, '').toLocaleUpperCase('fa');
const hasTableData = (snapshot: RahcomRoadListSnapshot) => Array.isArray(snapshot.headers)
  && Array.isArray(snapshot.rows)
  && snapshot.headers.every((header) => typeof header === 'string')
  && snapshot.rows.every((row) => Array.isArray(row));
const resolveRoadListMatch = (row: string[], lookup: RoadListMatchLookup): RoadListSystemMatch | null => {
  const identifier = lookup.identifierIndex >= 0 ? normalizeIdentifier(row[lookup.identifierIndex]) : '';
  const candidates = identifier ? lookup.trafficMatches.get(identifier) ?? [] : [];
  const systemCandidates = identifier ? lookup.systemsByAggregationCode.get(identifier) ?? [] : [];
  if (systemCandidates.length) {
    const stationName = lookup.stationNameIndex >= 0 ? normalizeIdentifier(row[lookup.stationNameIndex]) : '';
    const exactMatches = stationName
      ? systemCandidates.filter((system) => normalizeIdentifier(system.stationName) === stationName || normalizeIdentifier(system.systemName) === stationName)
      : [];
    const matchedSystem = exactMatches.length === 1
      ? exactMatches[0]
      : systemCandidates.length === 1
        ? systemCandidates[0]
        : null;
    if (!matchedSystem) return null;
    return {
      systemCode: matchedSystem.systemCode,
      systemName: matchedSystem.systemName,
      systemLabel: rahcomSystemHasLongOutage(matchedSystem)
        ? matchedSystem.longOutageReason ? rahcomLongOutageReasonLabel(matchedSystem.longOutageReason, matchedSystem.longOutageDetails) : matchedSystem.longOutageDetails || 'دلیل مشخص نشده'
        : '',
    };
  }
  const stationName = lookup.stationNameIndex >= 0 ? normalizeIdentifier(row[lookup.stationNameIndex]) : '';
  const namedCandidates = stationName
    ? candidates.filter((item) => normalizeIdentifier(item.systemName) === stationName)
    : [];
  const candidate = candidates.length === 1 ? candidates[0] : namedCandidates.length === 1 ? namedCandidates[0] : undefined;
  if (!candidate) return null;
  const system = lookup.systemsByCode.get(normalizeIdentifier(candidate.systemCode));
  return {
    ...candidate,
    systemLabel: system && rahcomSystemHasLongOutage(system)
      ? system.longOutageReason ? rahcomLongOutageReasonLabel(system.longOutageReason, system.longOutageDetails) : system.longOutageDetails || 'دلیل مشخص نشده'
      : '',
  };
};

export function RahcomRoadList() {
  const { locale } = usePreferences();
  const { date } = useRahcomDate();
  const selectedDate = date ?? tehranDateKey();
  const t = useCallback((key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key), [locale]);
  const [canView, setCanView] = useState<boolean | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [province, setProvince] = useState('');
  const [snapshot, setSnapshot] = useState<RahcomRoadListSnapshot | null>(null);
  const [traffic, setTraffic] = useState<RahcomTrafficSnapshot | null>(null);
  const [systems, setSystems] = useState<RahcomSystem[]>([]);
  const [solarSnapshots, setSolarSnapshots] = useState<RahcomSolarSnapshot[]>([]);
  const [deletingSolarSnapshotId, setDeletingSolarSnapshotId] = useState<string | null>(null);
  const [selectedSolarSnapshotId, setSelectedSolarSnapshotId] = useState('');
  const [showIncidents, setShowIncidents] = useState(true);
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const initialized = window.localStorage.getItem('rahcom-show-incidents-default-v2') === 'true';
      if (!initialized) {
        window.localStorage.setItem('rahcom-show-incidents', 'true');
        window.localStorage.setItem('rahcom-show-incidents-default-v2', 'true');
        setShowIncidents(true);
        return;
      }
      setShowIncidents(window.localStorage.getItem('rahcom-show-incidents') !== 'false');
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let active = true;
    const frame = window.requestAnimationFrame(() => {
      const organizationId = getCurrentOrganizationId();
      if (!organizationId) {
        setCanView(false);
        setLoading(false);
        return;
      }
      void Promise.all([settingsApi.getOrganizationAccess(organizationId), rahcomApi.access()])
        .then(([organizationAccess, rahcomAccess]) => {
          if (!active) return;
          setCanView(Boolean(organizationAccess.canViewRahcom));
          setCanManage(Boolean(organizationAccess.canManageRahcom));
          if (rahcomAccess.selectedProvince && rahcomAccess.selectedProvince !== 'all') setProvince(rahcomAccess.selectedProvince);
          else if (!rahcomAccess.isAdmin && rahcomAccess.province) setProvince(rahcomAccess.province);
        })
        .catch(() => { if (active) setCanView(false); })
        .finally(() => { if (active) setLoading(false); });
    });
    return () => { active = false; window.cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => {
    let active = true;
    const frame = window.requestAnimationFrame(() => {
      if (!province || canView !== true) {
        setSnapshot(null);
        setTraffic(null);
        setSystems([]);
        setSolarSnapshots([]);
        if (canView === false || (canView === true && !province))
          setLoading(false);
        return;
      }
      setSnapshot(null);
      setTraffic(null);
      setSystems([]);
      setSolarSnapshots([]);
      setLoading(true);
      setError('');
      void Promise.all([rahcomApi.roadList(province, selectedDate), rahcomApi.trafficSnapshot(province, selectedDate), rahcomApi.systems(province), rahcomApi.solarSnapshots(province, selectedDate)])
        .then(([result, trafficResult, systemRows, solarRows]) => {
          if (!active) return;
          if (result && !hasTableData(result)) {
            setSnapshot(null);
            setError(t('rahcomRoadListInvalidFile'));
            return;
          }
          setSnapshot(result);
          setSystems(systemRows);
          setSolarSnapshots(solarRows.filter((item) => tehranDateKey(item.capturedAt) === selectedDate));
          setTraffic(trafficResult && Array.isArray(trafficResult.headers) && Array.isArray(trafficResult.rows)
            ? { ...trafficResult, headers: trafficResult.headers.map((header) => String(header ?? '')), rows: trafficResult.rows.filter(Array.isArray).map((row) => row.map((cell) => String(cell ?? ''))) }
            : null);
          setPage(0);
        })
        .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : t('rahcomRoadListInvalidFile')); })
        .finally(() => { if (active) setLoading(false); });
    });
    return () => { active = false; window.cancelAnimationFrame(frame); };
  }, [province, canView, t, selectedDate]);

  const loadRoadListDates = useCallback((from: string, to: string) => province ? rahcomApi.roadListDates(province, from, to) : Promise.resolve([]), [province]);
  useEffect(() => {
    if (loading) return;
    const frame = window.requestAnimationFrame(() => {
      const root = document.documentElement;
      window.scrollTo({ left: 0, top: window.scrollY, behavior: 'instant' });
      root.scrollLeft = 0;
      document.body.scrollLeft = 0;
      const contentViewport = document.querySelector<HTMLElement>('.erp-scrollbar');
      if (contentViewport) contentViewport.scrollLeft = 0;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading, snapshot]);

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setError('');
    setMessage('');
    if (!file) return;
    if (!province) { setError(t('rahcomRoadListChooseProvince')); input.value = ''; return; }
    if (file.size > 20 * 1024 * 1024) { setError(t('rahcomRoadListFileTooLarge')); input.value = ''; return; }
    setBusy(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      let upload: Pick<RahcomRoadListSnapshot, 'province' | 'fileName' | 'sheetName' | 'headers' | 'rows'> & { listDate: string } | null = null;
      for (const sheetName of workbook.SheetNames) {
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false, blankrows: false });
        const headerIndex = matrix.findIndex((row) => {
          if (!Array.isArray(row)) return false;
          const cells = row.map((cell) => String(cell ?? ''));
          const hasProvince = cells.some((cell) => normalizeHeader(cell).includes('\u0627\u0633\u062a\u0627\u0646') || normalizeHeader(cell) === 'province');
          const hasStationCode = cells.some(isRoadListStationCodeHeader);
          const hasStationName = cells.some(isRoadListStationNameHeader);
          return hasProvince || hasStationCode && hasStationName;
        });
        if (headerIndex < 0 || !Array.isArray(matrix[headerIndex])) continue;
        const rawHeaders = matrix[headerIndex].map((value) => String(value ?? '').trim());
        if (!rawHeaders.length || rawHeaders.length > 100) continue;
        const provinceColumnIndex = rawHeaders.findIndex((header) => normalizeHeader(header).includes('\u0627\u0633\u062a\u0627\u0646') || normalizeHeader(header) === 'province');
        const stationOnlyWorkbook = provinceColumnIndex < 0
          && rawHeaders.some(isRoadListStationCodeHeader)
          && rawHeaders.some(isRoadListStationNameHeader);
        if (provinceColumnIndex < 0 && !stationOnlyWorkbook) continue;
        const headers = rawHeaders.map((value, index) => canonicalRoadListHeader(value || `${t('rahcomTrafficColumn')} ${index + 1}`));
        if (stationOnlyWorkbook) headers.push(t('rahcomProvince'));
        const rows = matrix.slice(headerIndex + 1)
          .filter((row) => Array.isArray(row) && row.some((value) => value !== '' && value !== null && value !== undefined))
          .map((row) => [
            ...rawHeaders.map((_, index) => String(row[index] ?? '').trim()),
            ...(stationOnlyWorkbook ? [province] : []),
          ]);
        if (!rows.length) throw new Error(t('rahcomRoadListInvalidFile'));
        if (rows.length > 10000) throw new Error(t('rahcomTrafficTooManyRows'));
        const payload = { province, listDate: selectedDate, fileName: file.name, sheetName, headers, rows };
        if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > 8 * 1024 * 1024) throw new Error(t('rahcomRoadListFileTooLarge'));
        upload = payload;
        break;
      }
      if (!upload) throw new Error(t('rahcomRoadListInvalidFile'));
      const saved = await rahcomApi.replaceRoadList(upload);
      if (!hasTableData(saved)) throw new Error(t('rahcomRoadListInvalidFile'));
      setSnapshot(saved);
      setPage(0);
      setMessage(t('rahcomRoadListUploadDone'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('rahcomRoadListInvalidFile'));
    } finally {
      input.value = '';
      setBusy(false);
    }
  }

  const headers = Array.isArray(snapshot?.headers) ? snapshot.headers : [];
  const stationCodeIndex = headers.findIndex((header) => {
    const normalized = normalizeHeader(header);
    return normalized.includes(normalizeHeader('\u06a9\u062f \u0627\u06cc\u0633\u062a\u06af\u0627\u0647'))
      || normalized.includes(normalizeHeader('\u06a9\u062f \u062a\u062c\u0645\u06cc\u0639'))
      || normalized.includes('stationcode')
      || normalized.includes('aggregationcode')
      || normalized.includes('aggregatecode');
  });
  const identifierIndex = stationCodeIndex >= 0 ? stationCodeIndex : headers.findIndex((header) => {
    const normalized = normalizeHeader(header);
    return normalized.includes(normalizeHeader('\u0634\u0646\u0627\u0633\u0647'))
      || normalized === 'id'
      || normalized === 'identifier';
  });
  const positionIndex = headers.findIndex((header) => normalizeHeader(header).includes('\u0645\u0648\u0642\u0639\u06cc\u062a') || normalizeHeader(header).includes('position'));
  const cityIndex = headers.findIndex((header) => normalizeHeader(header).includes('\u0634\u0647\u0631') || normalizeHeader(header) === 'city');
  const wideSingleLineIndexes = headers.flatMap((header, index) => { const normalized = normalizeHeader(header); return normalized.includes('\u0633\u0627\u0645\u0627\u0646\u0647') || normalized.includes('system') || normalized.includes('\u067e\u06cc\u0645\u0627\u0646\u06a9\u0627\u0631') || normalized.includes('contractor') ? [index] : []; });
  const systemsByCode = useMemo(() => new Map(systems.map((system) => [normalizeIdentifier(system.systemCode), system])), [systems]);
  const systemsByAggregationCode = useMemo(() => {
    const matches = new Map<string, RahcomSystem[]>();
    for (const system of systems) {
      const aggregationCode = normalizeIdentifier(system.aggregationCode);
      if (!aggregationCode) continue;
      matches.set(aggregationCode, [...(matches.get(aggregationCode) ?? []), system]);
    }
    return matches;
  }, [systems]);
  const selectedSolarSnapshot = solarSnapshots.find((item) => item.id === selectedSolarSnapshotId) ?? solarSnapshots[0];
  const deleteSolarSnapshot = async (target: RahcomSolarSnapshot) => {
    if (!canManage || deletingSolarSnapshotId) return;
    const ordinal = new Intl.NumberFormat(locale).format(rahcomSolarSnapshotNumber(target, solarSnapshots));
    if (!window.confirm(`${t('solarDeleteSnapshotConfirm')} (${ordinal})`)) return;
    setDeletingSolarSnapshotId(target.id);
    setMessage('');
    try {
      await rahcomApi.deleteSolarSnapshot(target.id);
      const remaining = solarSnapshots.filter((item) => item.id !== target.id);
      setSolarSnapshots(remaining);
      if (selectedSolarSnapshotId === target.id) setSelectedSolarSnapshotId(remaining[0]?.id ?? '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('solarLoadFailed'));
    } finally {
      setDeletingSolarSnapshotId(null);
    }
  };
  const solarStateByCode = useMemo(() => {
    const states = new Map<string, Array<{ equipment: string; state: 'down' | 'unreachable' }>>();
    const selectedColumns = new Set((selectedSolarSnapshot?.equipmentColumns ?? []).map((column) => /^LTE-[12]$/i.test(column) ? 'LTE' : column.toUpperCase()));
    if (selectedSolarSnapshot) {
      const entries = filterRahcomLtePairs([
        ...parseRahcomSolarList(selectedSolarSnapshot.downText, 'down'),
        ...parseRahcomSolarList(selectedSolarSnapshot.unreachableText, 'unreachable'),
      ]).filter(({ equipment }) => selectedColumns.has(equipment.toUpperCase()) || (/^LTE-[12]$/i.test(equipment) && selectedColumns.has('LTE')));
      for (const entry of entries) {
        const code = normalizeIdentifier(entry.site);
        const provinceKey = selectedSolarSnapshot.province ?? entry.province ?? province;
        if (!code || !provinceKey) continue;
        const key = rahcomSystemKey(provinceKey, code);
        states.set(key, [...(states.get(key) ?? []), { equipment: entry.equipment, state: entry.state }]);
      }
    }
    return states;
  }, [province, selectedSolarSnapshot]);
  const activityIndex = headers.findIndex((header) => normalizeHeader(header).includes('\u0641\u0639\u0627\u0644\u06cc\u062a') || normalizeHeader(header).includes('activity'));
  const isImportedLabelHeader = (header: string) => {
    const normalized = normalizeHeader(header);
    return normalized.includes('\u0628\u0631\u0686\u0633\u0628') || normalized.includes('label') || normalized.includes('longoutage');
  };
  const importedLabelIndexes = new Set(headers.flatMap((header, index) => isImportedLabelHeader(header) ? [index] : []));
  const axisIndexes = headers.flatMap((header, index) => normalizeHeader(header).includes('\u0645\u062d\u0648\u0631') || normalizeHeader(header).includes('axis') ? [index] : []);
  const stationNameIndex = headers.findIndex(isRoadListStationNameHeader);
  const prioritizedIndexes = [positionIndex, cityIndex, stationNameIndex, ...axisIndexes, activityIndex].filter((index, order, indexes): index is number => index >= 0 && indexes.indexOf(index) === order);
  const orderedDataIndexes = [...prioritizedIndexes, ...headers.map((_, index) => index).filter((index) => index !== identifierIndex && !importedLabelIndexes.has(index) && !prioritizedIndexes.includes(index))];
  const provinceIndex = headers.findIndex((header) => normalizeHeader(header).includes('\u0627\u0633\u062a\u0627\u0646') || normalizeHeader(header) === 'province');
  const contractorIndex = headers.findIndex((header) => {
    const normalized = normalizeHeader(header);
    return normalized.includes('\u067e\u06cc\u0645\u0627\u0646\u06a9\u0627\u0631') || normalized.includes('contractor') || normalized.includes('\u0634\u0631\u06a9\u062a') || normalized.includes('company');
  });
  const lastAxisPosition = orderedDataIndexes.reduce((last, index, position) => axisIndexes.includes(index) || index === cityIndex ? position : last, -1);
  const provincePosition = orderedDataIndexes.findIndex((index) => index === provinceIndex);
  const activityPosition = orderedDataIndexes.findIndex((index) => index === activityIndex);
  const solarInsertPosition = activityPosition >= 0
    ? activityPosition
    : provincePosition >= 0 && provincePosition > lastAxisPosition
      ? provincePosition
      : lastAxisPosition >= 0
        ? lastAxisPosition + 1
        : provincePosition >= 0
          ? provincePosition
          : orderedDataIndexes.length;
  const displayedDataColumns: Array<number | 'solar'> = [...orderedDataIndexes];
  displayedDataColumns.splice(solarInsertPosition, 0, 'solar');
  const contractorPosition = displayedDataColumns.indexOf(contractorIndex);
  const displayedProvincePosition = displayedDataColumns.indexOf(provinceIndex);
  if (contractorIndex >= 0 && displayedProvincePosition >= 0 && contractorPosition >= 0 && contractorPosition !== displayedProvincePosition + 1) {
    displayedDataColumns.splice(contractorPosition, 1);
    displayedDataColumns.splice(displayedDataColumns.indexOf(provinceIndex) + 1, 0, contractorIndex);
  }
  const trafficMatches = useMemo(() => {
    const trafficHeaders = Array.isArray(traffic?.headers) ? traffic.headers : [];
    const aggregationIndex = trafficHeaders.findIndex((header) => {
      const normalized = normalizeHeader(header);
      return normalized.includes('\u06a9\u062f\u062a\u062c\u0645\u06cc\u0639') || normalized.includes('aggregationcode') || normalized.includes('aggregatecode');
    });
    const systemCodeIndex = trafficHeaders.findIndex((header) => {
      const normalized = normalizeHeader(header);
      return normalized.includes('\u06a9\u062f\u0633\u0627\u0645\u0627\u0646\u0647') || normalized === 'systemcode';
    });
    const systemNameIndex = trafficHeaders.findIndex((header) => {
      const normalized = normalizeHeader(header);
      return normalized.includes('\u0646\u0627\u0645\u0627\u06cc\u0633\u062a\u06af\u0627\u0647') || normalized.includes('\u0646\u0627\u0645\u0633\u0627\u0645\u0627\u0646\u0647') || normalized === 'systemname';
    });
    const provinceIndex = trafficHeaders.findIndex((header) => normalizeHeader(header).includes('\u0627\u0633\u062a\u0627\u0646') || normalizeHeader(header) === 'province');
    const provinceLabel = iranProvinces.find(([id]) => id === province)?.[1] ?? province;
    const validProvinces = new Set([normalizeIdentifier(province), normalizeIdentifier(provinceLabel)]);
    const matches = new Map<string, RoadListSystemMatch[]>();
    if (aggregationIndex < 0 || systemCodeIndex < 0 || systemNameIndex < 0) return matches;
    for (const row of traffic?.rows ?? []) {
      const rowProvince = provinceIndex >= 0 ? normalizeIdentifier(row[provinceIndex]) : '';
      if (rowProvince && !validProvinces.has(rowProvince)) continue;
      const aggregationCode = normalizeIdentifier(row[aggregationIndex]);
      if (!aggregationCode) continue;
      const candidates = matches.get(aggregationCode) ?? [];
      candidates.push({ systemCode: String(row[systemCodeIndex] ?? '').trim(), systemName: String(row[systemNameIndex] ?? '').trim() });
      matches.set(aggregationCode, candidates);
    }
    return matches;
  }, [province, traffic]);
  const matchLookup: RoadListMatchLookup = { identifierIndex, stationNameIndex, systemsByAggregationCode, systemsByCode, trafficMatches };
  const getMatch = (row: string[]) => resolveRoadListMatch(row, matchLookup);
  // Road-list labels belong to the Rahcom Systems record. The traffic snapshot
  // is only used to resolve station aggregation codes to system codes.
  const getIncidentText = (match: ReturnType<typeof getMatch>) => match?.systemLabel || '\u2014';
  const rows = Array.isArray(snapshot?.rows) ? snapshot.rows : [];
  const filteredRows = showIncidents ? rows : rows.filter((row) => {
    const match = getMatch(row);
    if (!match) return true;
    const system = systemsByCode.get(normalizeIdentifier(match.systemCode));
    return !rahcomSystemHasLongOutage(system);
  });
  const visibleRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const getSolarStatuses = (match: ReturnType<typeof getMatch>) => {
    const system = match ? systemsByCode.get(normalizeIdentifier(match.systemCode)) : undefined;
    const solarProvince = system?.province ?? province;
    if (!match || !selectedSolarSnapshot || (selectedSolarSnapshot.province && selectedSolarSnapshot.province !== solarProvince)) return [];
    return solarStateByCode.get(rahcomSystemKey(solarProvince, match.systemCode)) ?? [];
  };
  const downloadExcel = () => {
    if (!snapshot) return;
    const exportHeaders = [t('rahcomRowNumber'), t('rahcomSystemName'), t('rahcomSystemCode'), ...(showIncidents ? [t('rahcomIncidentFilter')] : []), ...(identifierIndex >= 0 ? [t('rahcomRoadStationCode')] : []),
      ...displayedDataColumns.map((column) => column === 'solar' ? t('rahcomSystemSolar') : column === positionIndex ? t('rahcomRoadStationName') : column === cityIndex ? t('rahcomAxis') : isSolarHeader(headers[column]) ? t('rahcomTrafficImportedStatus') : isRoadListAxisHeader(headers[column]) ? t('rahcomAxis') : isRoadListStationCodeHeader(headers[column]) ? t('rahcomRoadStationCode') : isRoadListStationNameHeader(headers[column]) ? t('rahcomRoadStationName') : headers[column])];
    const exportRows = filteredRows.map((row, rowIndex) => {
      const match = getMatch(row);
      const solarText = getSolarStatuses(match).map(({ equipment, state }) => `${equipment}: ${t(state === 'down' ? 'solarStatusDown' : 'solarStatusUnreachable')}`).join(', ') || '\u2014';
      return [rowIndex + 1, match?.systemName || '\u2014', match?.systemCode || '\u2014', ...(showIncidents ? [getIncidentText(match)] : []), ...(identifierIndex >= 0 ? [row[identifierIndex] ?? ''] : []),
        ...displayedDataColumns.map((column) => column === 'solar' ? solarText : row[column] ?? '')];
    });
    const worksheet = XLSX.utils.aoa_to_sheet([exportHeaders, ...exportRows]);
    worksheet['!cols'] = exportHeaders.map((_, index) => ({ wch: index === 0 ? 8 : index === 1 ? 16 : 24 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Road list');
    XLSX.writeFile(workbook, `road-list-${province}-${selectedDate}.xlsx`);
  };
  if (loading && canView === null) return <main dir={getLocaleDirection(locale)} className="mx-auto w-full max-w-none rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{t('rahcomSystemsLoading')}</main>;
  if (!canView) return <main dir={getLocaleDirection(locale)} className="mx-auto w-full max-w-none rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">{uiMessage(locale, 'rahcomAccessDenied')}</main>;

  return <main dir={getLocaleDirection(locale)} className="rahcom-horizontal-overflow-page flex h-full min-h-0 min-w-0 w-full max-w-full flex-col gap-3 overflow-hidden">
    <RahcomToolbar as="header" className="rahcom-mobile-toolbar max-sm:-mb-2 flex shrink-0 flex-nowrap items-center justify-start gap-3 overflow-x-auto overflow-y-hidden pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0">
      <RahcomHeaderDate compact loadMarkedDates={loadRoadListDates} />
      {solarSnapshots.length > 0 && <SolarSnapshotPicker snapshots={solarSnapshots} selectedId={selectedSolarSnapshot?.id ?? ''} locale={locale} onSelect={setSelectedSolarSnapshotId} canDelete={canManage} deletingId={deletingSolarSnapshotId} onDelete={(item) => void deleteSolarSnapshot(item)} />}
      <RahcomCountCapsule count={filteredRows.length} />
      <div className="flex flex-nowrap items-center gap-2">
        <button type="button" aria-pressed={showIncidents} aria-label={t('rahcomIncidentFilter')} title={t('rahcomIncidentFilter')} onClick={() => { const enabled = !showIncidents; setShowIncidents(enabled); window.localStorage.setItem('rahcom-show-incidents', String(enabled)); setPage(0); }} style={showIncidents ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`grid size-9 shrink-0 place-items-center rounded-full border transition-colors ${showIncidents ? '' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}><ListFilter size={16} aria-hidden="true" /></button>
        {snapshot && <button type="button" onClick={downloadExcel} aria-label={t('solarDownloadExcel')} title={t('solarDownloadExcel')} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground hover:border-primary hover:text-primary"><Download size={16} aria-hidden="true" /></button>}
        <RoadListPromptControl locale={locale} canManage={canManage} selectedDate={selectedDate} />
        {canManage && <label data-toolbar-label={busy ? t('rahcomRoadListUploading') : t('rahcomRoadListChooseFile')} aria-label={t('rahcomRoadListChooseFile')} title={busy ? t('rahcomRoadListUploading') : t('rahcomRoadListChooseFile')} className={`relative inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-border bg-background px-3 text-sm text-foreground transition hover:border-primary hover:text-primary ${busy || !province ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
          {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <FileUp size={16} aria-hidden="true" />}
          <span className="sr-only">{busy ? t('rahcomRoadListUploading') : t('rahcomRoadListChooseFile')}</span>
          <input type="file" accept=".xlsx,.xls" disabled={busy || !province} onChange={(event) => void uploadFile(event)} className="sr-only" />
        </label>}
      </div>
    </RahcomToolbar>

    {error && <p role="alert" className="shrink-0 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="shrink-0 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-primary">{message}</p>}
    {!province ? <p className="shrink-0 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{t('rahcomRoadListChooseProvince')}</p> : loading ? <p role="status" className="shrink-0 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{t('rahcomSystemsLoading')}</p> : error ? null : !snapshot ? <p className="shrink-0 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{t('rahcomRoadListNoData')}</p> : <section className="rahcom-traffic-table-frame flex min-h-0 min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="rahcom-record-summary-bar border-b border-border px-4 py-3"><RahcomRecordSummary bare showRecordDate={false} showCount={false} locale={locale} source={t('rahcomRoadList')} fileName={snapshot.fileName} recordDate={snapshot.listDate.slice(0, 10)} count={snapshot.rowCount} savedAt={snapshot.importedAt} /></div>
      <div className="rahcom-table-scroll rahcom-contained-table-scroll min-h-0 min-w-0 w-full max-w-full flex-1 overflow-auto">
        <DataTable className="rahcom-sticky-table w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead className="bg-card text-start text-xs text-muted-foreground"><tr>
            <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold whitespace-nowrap">{t('rahcomRowNumber')}</th>
            <th scope="col" className="w-9 border-b border-border px-1 py-2.5 text-center"><RahcomInfoHeader /></th>
            <th scope="col" className="min-w-[220px] border-b border-border px-3 py-2.5 font-semibold whitespace-nowrap">{t('rahcomSystemName')}</th>
            <th scope="col" className="min-w-[120px] border-b border-border px-2 py-2.5 text-center font-semibold whitespace-nowrap">{t('rahcomSystemCode')}</th>
            {showIncidents && <th scope="col" className="min-w-[140px] max-w-[140px] border-b border-border px-2 py-2.5 text-center font-semibold whitespace-normal">{t('rahcomIncidentFilter')}</th>}
            {identifierIndex >= 0 && <th scope="col" className="min-w-[100px] border-b border-border px-2 py-2.5 text-center font-semibold whitespace-nowrap">{t('rahcomRoadStationCode')}</th>}
            {displayedDataColumns.map((column, index) => column === 'solar'
              ? <th key="solar-status" scope="col" className="min-w-[180px] border-b border-border px-3 py-2.5 text-center font-semibold whitespace-nowrap">{t('rahcomSystemSolar')}</th>
              : <th key={`${headers[column]}-${column}-${index}`} scope="col" className={`border-b border-border px-3 py-2.5 font-semibold ${positionIndex === column ? 'min-w-[240px] whitespace-nowrap' : cityIndex === column ? 'min-w-[160px] whitespace-nowrap' : wideSingleLineIndexes.includes(column) ? 'min-w-[200px] whitespace-nowrap' : 'max-w-64 whitespace-normal'}`}>{column === positionIndex ? t('rahcomRoadStationName') : column === cityIndex ? t('rahcomAxis') : isSolarHeader(headers[column]) ? t('rahcomTrafficImportedStatus') : isRoadListAxisHeader(headers[column]) ? t('rahcomAxis') : isRoadListStationCodeHeader(headers[column]) ? t('rahcomRoadStationCode') : isRoadListStationNameHeader(headers[column]) ? t('rahcomRoadStationName') : headers[column]}</th>)}
          </tr></thead>
          <tbody>{visibleRows.map((row, rowIndex) => {
            const match = getMatch(row);
            return <tr key={page * PAGE_SIZE + rowIndex} className="odd:bg-background even:bg-muted/30">
              <td className="border-b border-border/70 px-3 py-2 text-center tabular-nums text-foreground">{new Intl.NumberFormat(locale).format(page * PAGE_SIZE + rowIndex + 1)}</td>
              <td className="w-9 border-b border-border/70 px-1 py-1 text-center"><RahcomRowInfo previewBeforeCopy title={match?.systemName || match?.systemCode || `ردیف ${page * PAGE_SIZE + rowIndex + 1}`} systemCode={match?.systemCode ?? ''} system={match ? systemsByCode.get(normalizeIdentifier(match.systemCode)) ?? null : null} fields={[{ label: t('rahcomSystemName'), value: match?.systemName || '' }, { label: t('rahcomSystemCode'), value: match?.systemCode || '' }, { label: t('rahcomIncidentFilter'), value: getIncidentText(match) }, { label: t('rahcomAxisCode'), value: match ? systemsByCode.get(normalizeIdentifier(match.systemCode))?.axisCode ?? '' : '' }, ...headers.flatMap((header, columnIndex) => importedLabelIndexes.has(columnIndex) ? [] : [{ label: header, value: row[columnIndex] ?? '' }])]} /></td>
              <td className="min-w-[220px] whitespace-nowrap border-b border-border/70 px-3 py-2 align-top text-foreground">{match?.systemName || '\u2014'}</td>
              <td dir="ltr" className="min-w-[120px] whitespace-nowrap border-b border-border/70 px-2 py-2 text-center font-mono text-foreground">{match?.systemCode || '\u2014'}</td>
              {showIncidents && <td className="min-w-[140px] max-w-[140px] border-b border-border/70 px-2 py-2 text-center align-middle text-foreground">{getIncidentText(match)}</td>}
              {identifierIndex >= 0 && <td dir="ltr" className="min-w-[100px] whitespace-nowrap border-b border-border/70 px-2 py-2 text-center align-middle font-mono text-foreground">{row[identifierIndex] ?? ''}</td>}
              {displayedDataColumns.map((column, index) => column === 'solar'
                ? <td key="solar-status" className="min-w-[180px] whitespace-nowrap border-b border-border/70 px-3 py-2 text-center align-middle text-foreground">{(() => { const equipmentStatuses = getSolarStatuses(match); return equipmentStatuses.length ? <span className="inline-flex flex-nowrap items-center justify-center gap-x-3" dir="ltr">{equipmentStatuses.map(({ equipment, state }) => { const label = t(state === 'down' ? 'solarStatusDown' : 'solarStatusUnreachable'); return <span key={equipment} className="inline-flex items-center gap-1.5" aria-label={`${equipment}: ${label}`}><bdi className="font-mono text-xs">{equipment}</bdi><span className={`inline-block size-3 rounded-full ${state === 'down' ? 'bg-red-600' : 'bg-gray-400'}`} /></span>; })}</span> : '\u2014'; })()}</td>
                : <td key={`${column}-${index}`} className={`border-b border-border/70 px-3 py-2 align-top text-foreground ${positionIndex === column || cityIndex === column || wideSingleLineIndexes.includes(column) ? 'whitespace-nowrap' : 'max-w-80 whitespace-pre-wrap'}`}>{row[column] ?? ''}</td>)}
            </tr>;
          })}</tbody>
        </DataTable>
      </div>
      {pageCount > 1 && <div className="flex items-center justify-center gap-3 border-t border-border p-3 text-sm">
        <button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label={t('rahcomRoadListPreviousPage')} className="grid size-8 place-items-center rounded-full border border-border text-foreground disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight size={16} /></button>
        <span className="tabular-nums text-muted-foreground">{new Intl.NumberFormat(locale).format(page + 1)} / {new Intl.NumberFormat(locale).format(pageCount)}</span>
        <button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} aria-label={t('rahcomRoadListNextPage')} className="grid size-8 place-items-center rounded-full border border-border text-foreground disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={16} /></button>
      </div>}
    </section>}

  </main>;
}
