'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { ChevronLeft, ChevronRight, ClipboardList, Download, FileUp, LoaderCircle, PanelsTopLeft, TriangleAlert } from 'lucide-react';
import { usePreferences, getLocaleDirection } from '@/components/preferences-provider';
import { getCurrentOrganizationId } from '@/lib/api/shared/auth-api';
import { settingsApi } from '@/app/(workspace)/settings/settings-api';
import { uiMessage } from '@/lib/ui-messages';
import { iranProvinces, rahcomApi, type RahcomRoadListSnapshot, type RahcomSolarSnapshot, type RahcomSystem, type RahcomTrafficSnapshot } from '@/lib/api/rahcom/rahcom-api';
import { useRahcomDate } from '@/app/(workspace)/rahcom/_shared/rahcom-date';
import { filterRahcomLtePairs, isRahcomIncidentValue, parseRahcomSolarList, rahcomSystemKey, tehranDateKey } from '@/lib/api/rahcom/solar-status';
import { RahcomHeaderDate } from '@/app/(workspace)/rahcom/_shared/rahcom-header-date';
import { RahcomRecordSummary } from '@/app/(workspace)/rahcom/_shared/rahcom-record-summary';
import { RahcomCountCapsule } from '@/app/(workspace)/rahcom/_shared/rahcom-count-capsule';
import { SolarSnapshotPicker } from '@/app/(workspace)/rahcom/_shared/rahcom-section';

const PAGE_SIZE = 100;
const normalizeHeader = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa')
  .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\u200c\s_\-./()]/g, '');
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
  const [selectedSolarSnapshotId, setSelectedSolarSnapshotId] = useState('');
  const [incidentSource, setIncidentSource] = useState<'traffic' | 'systems'>('traffic');
  const [showIncidentRows, setShowIncidentRows] = useState(false);
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) { setCanView(false); setLoading(false); return; }
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
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!province || canView !== true) { setSnapshot(null); setTraffic(null); setSystems([]); setSolarSnapshots([]); return; }
    let active = true;
    setSnapshot(null);
    setTraffic(null);
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
    return () => { active = false; };
  }, [province, canView, t, selectedDate]);

  const loadRoadListDates = useCallback((from: string, to: string) => province ? rahcomApi.roadListDates(province, from, to) : Promise.resolve([]), [province]);
  useEffect(() => { setSelectedSolarSnapshotId((current) => solarSnapshots.some((snapshot) => snapshot.id === current) ? current : solarSnapshots[0]?.id ?? ''); }, [solarSnapshots]);

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
        const headerIndex = matrix.findIndex((row) => Array.isArray(row) && row.some((cell) => {
          const normalized = normalizeHeader(String(cell ?? ''));
          return normalized.includes('\u0627\u0633\u062a\u0627\u0646') || normalized === 'province';
        }));
        if (headerIndex < 0 || !Array.isArray(matrix[headerIndex])) continue;
        const rawHeaders = matrix[headerIndex].map((value) => String(value ?? '').trim());
        if (!rawHeaders.length || rawHeaders.length > 100) continue;
        const headers = rawHeaders.map((value, index) => value || `${t('rahcomTrafficColumn')} ${index + 1}`);
        const rows = matrix.slice(headerIndex + 1)
          .filter((row) => Array.isArray(row) && row.some((value) => value !== '' && value !== null && value !== undefined))
          .map((row) => headers.map((_, index) => String(row[index] ?? '').trim()));
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
  const identifierIndex = headers.findIndex((header) => {
    const normalized = normalizeHeader(header);
    return normalized.includes(normalizeHeader('\u0634\u0646\u0627\u0633\u0647'))
      || normalized.includes(normalizeHeader('\u06a9\u062f \u0627\u06cc\u0633\u062a\u06af\u0627\u0647'))
      || normalized.includes(normalizeHeader('\u06a9\u062f \u062a\u062c\u0645\u06cc\u0639'))
      || normalized === 'id'
      || normalized === 'stationcode'
      || normalized === 'aggregationcode';
  });
  const positionIndex = headers.findIndex((header) => normalizeHeader(header).includes('\u0645\u0648\u0642\u0639\u06cc\u062a') || normalizeHeader(header).includes('position'));
  const cityIndex = headers.findIndex((header) => normalizeHeader(header).includes('\u0634\u0647\u0631') || normalizeHeader(header) === 'city');
  const wideSingleLineIndexes = headers.flatMap((header, index) => { const normalized = normalizeHeader(header); return normalized.includes('\u0633\u0627\u0645\u0627\u0646\u0647') || normalized.includes('system') || normalized.includes('\u067e\u06cc\u0645\u0627\u0646\u06a9\u0627\u0631') || normalized.includes('contractor') ? [index] : []; });
  const incidentIndexes = (traffic?.headers ?? []).flatMap((header, index) => { const normalized = normalizeHeader(header); return ['\u0633\u0631\u0642\u062a', '\u062a\u062e\u0631\u06cc\u0628', 'theft', 'damage'].some((term) => normalized.includes(normalizeHeader(term))) ? [index] : []; });
  const systemsByCode = useMemo(() => new Map(systems.map((system) => [normalizeIdentifier(system.systemCode), system])), [systems]);
  const selectedSolarSnapshot = solarSnapshots.find((item) => item.id === selectedSolarSnapshotId) ?? solarSnapshots[0];
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
  const prioritizedIndexes = [positionIndex, cityIndex, activityIndex].filter((index, order, indexes): index is number => index >= 0 && indexes.indexOf(index) === order);
  const orderedDataIndexes = [...prioritizedIndexes, ...headers.map((_, index) => index).filter((index) => index !== identifierIndex && !prioritizedIndexes.includes(index))];
  const axisIndexes = headers.flatMap((header, index) => normalizeHeader(header).includes('\u0645\u062d\u0648\u0631') || normalizeHeader(header).includes('axis') ? [index] : []);
  const provinceIndex = headers.findIndex((header) => normalizeHeader(header).includes('\u0627\u0633\u062a\u0627\u0646') || normalizeHeader(header) === 'province');
  const contractorIndex = headers.findIndex((header) => {
    const normalized = normalizeHeader(header);
    return normalized.includes('\u067e\u06cc\u0645\u0627\u0646\u06a9\u0627\u0631') || normalized.includes('contractor') || normalized.includes('\u0634\u0631\u06a9\u062a') || normalized.includes('company');
  });
  const lastAxisPosition = orderedDataIndexes.reduce((last, index, position) => axisIndexes.includes(index) ? position : last, -1);
  const provincePosition = orderedDataIndexes.findIndex((index) => index === provinceIndex);
  const solarInsertPosition = provincePosition >= 0 && provincePosition > lastAxisPosition ? provincePosition : lastAxisPosition >= 0 ? lastAxisPosition + 1 : provincePosition >= 0 ? provincePosition : orderedDataIndexes.length;
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
    const incidentIndexes = trafficHeaders.flatMap((header, index) => { const normalized = normalizeHeader(header); return ['\u0633\u0631\u0642\u062a', '\u062a\u062e\u0631\u06cc\u0628', 'theft', 'damage'].some((term) => normalized.includes(normalizeHeader(term))) ? [index] : []; });
    const provinceLabel = iranProvinces.find(([id]) => id === province)?.[1] ?? province;
    const validProvinces = new Set([normalizeIdentifier(province), normalizeIdentifier(provinceLabel)]);
    const matches = new Map<string, Array<{ systemCode: string; systemName: string; trafficIncident: string }>>();
    if (aggregationIndex < 0 || systemCodeIndex < 0 || systemNameIndex < 0) return matches;
    for (const row of traffic?.rows ?? []) {
      const rowProvince = provinceIndex >= 0 ? normalizeIdentifier(row[provinceIndex]) : '';
      if (rowProvince && !validProvinces.has(rowProvince)) continue;
      const aggregationCode = normalizeIdentifier(row[aggregationIndex]);
      if (!aggregationCode) continue;
      const candidates = matches.get(aggregationCode) ?? [];
      const trafficIncident = incidentIndexes.filter((index) => isRahcomIncidentValue(row[index])).map((index) => String(trafficHeaders[index] ?? '').trim()).filter(Boolean).join('، ');
      candidates.push({ systemCode: String(row[systemCodeIndex] ?? '').trim(), systemName: String(row[systemNameIndex] ?? '').trim(), trafficIncident });
      matches.set(aggregationCode, candidates);
    }
    return matches;
  }, [province, traffic]);
  const getMatch = (row: string[]) => {
    const identifier = identifierIndex >= 0 ? normalizeIdentifier(row[identifierIndex]) : '';
    const candidates = identifier ? trafficMatches.get(identifier) ?? [] : [];
    return candidates.length === 1 ? candidates[0] : null;
  };
  const getIncidentText = (match: ReturnType<typeof getMatch>) => {
    if (incidentSource === 'traffic') return match?.trafficIncident || '\u2014';
    const system = match ? systemsByCode.get(normalizeIdentifier(match.systemCode)) : undefined;
    if (!system) return '\u2014';
    if (system.incidentType) return t(system.incidentType === 'WIDENING_RELOCATION' ? 'solarWideningRelocation' : system.incidentType === 'THEFT' ? 'rahcomIncidentTheft' : system.incidentType === 'DAMAGE' ? 'rahcomIncidentDamage' : 'rahcomIncidentBoth');
    return isRahcomIncidentValue(system.incidentDetails) ? system.incidentDetails || t('rahcomIncidentBoth') : '\u2014';
  };
  const filteredRows = useMemo(() => {
    const rows = Array.isArray(snapshot?.rows) ? snapshot.rows : [];
    if (!showIncidentRows) return rows;
    return rows.filter((row) => getIncidentText(getMatch(row)) !== '\u2014');
  }, [snapshot, showIncidentRows, incidentSource, trafficMatches, identifierIndex, systemsByCode, t]);
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
    const exportHeaders = [t('rahcomRowNumber'), t('rahcomSystemCode'), ...(identifierIndex >= 0 ? [headers[identifierIndex]] : []), t('rahcomSystemName'),
      ...displayedDataColumns.map((column) => column === 'solar' ? t('rahcomSystemSolar') : isSolarHeader(headers[column]) ? t('rahcomTrafficImportedStatus') : headers[column])];
    const exportRows = filteredRows.map((row, rowIndex) => {
      const match = getMatch(row);
      const solarText = getSolarStatuses(match).map(({ equipment, state }) => `${equipment}: ${t(state === 'down' ? 'solarStatusDown' : 'solarStatusUnreachable')}`).join(', ') || '\u2014';
      return [rowIndex + 1, match?.systemCode || '\u2014', ...(identifierIndex >= 0 ? [row[identifierIndex] ?? ''] : []), match?.systemName || '\u2014',
        ...displayedDataColumns.map((column) => column === 'solar' ? solarText : row[column] ?? '')];
    });
    const worksheet = XLSX.utils.aoa_to_sheet([exportHeaders, ...exportRows]);
    worksheet['!cols'] = exportHeaders.map((_, index) => ({ wch: index === 0 ? 8 : index === 1 ? 16 : 24 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Road list');
    XLSX.writeFile(workbook, `road-list-${province}-${selectedDate}.xlsx`);
  };
  if (loading && canView === null) return <main dir={getLocaleDirection(locale)} className="mx-auto max-w-6xl rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{t('rahcomSystemsLoading')}</main>;
  if (!canView) return <main dir={getLocaleDirection(locale)} className="mx-auto max-w-6xl rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">{uiMessage(locale, 'rahcomAccessDenied')}</main>;

  return <main dir={getLocaleDirection(locale)} className="mx-auto max-w-6xl space-y-4">
    <header className="flex flex-wrap justify-start gap-3">
      <RahcomHeaderDate loadMarkedDates={loadRoadListDates} />
      {solarSnapshots.length > 0 && <SolarSnapshotPicker snapshots={solarSnapshots} selectedId={selectedSolarSnapshotId} locale={locale} onSelect={setSelectedSolarSnapshotId} />}
      <RahcomCountCapsule count={filteredRows.length} />
      <div className="inline-flex h-9 overflow-hidden rounded-full border border-border bg-background" role="group" aria-label={t('rahcomIncidentFilter')}>
        <button type="button" aria-pressed={incidentSource === 'traffic'} aria-label={t('rahcomTrafficIncidentColumn')} title={t('rahcomTrafficIncidentColumn')} onClick={() => { setIncidentSource('traffic'); setPage(0); }} className="grid size-9 place-items-center" style={incidentSource === 'traffic' ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' } : undefined}><ClipboardList size={16} /></button>
        <button type="button" aria-pressed={incidentSource === 'systems'} aria-label={t('rahcomSystemIncidentColumn')} title={t('rahcomSystemIncidentColumn')} onClick={() => { setIncidentSource('systems'); setPage(0); }} className="grid size-9 place-items-center border-s border-border" style={incidentSource === 'systems' ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' } : undefined}><PanelsTopLeft size={16} /></button>
      </div>
      <button type="button" aria-pressed={showIncidentRows} aria-label={`${t('rahcomIncidentFilter')} · ${t(incidentSource === 'traffic' ? 'rahcomTrafficIncidentColumn' : 'rahcomSystemIncidentColumn')}`} title={`${t('rahcomIncidentFilter')} · ${t(incidentSource === 'traffic' ? 'rahcomTrafficIncidentColumn' : 'rahcomSystemIncidentColumn')}`} onClick={() => { setShowIncidentRows((current) => !current); setPage(0); }} style={showIncidentRows ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`grid size-9 shrink-0 place-items-center rounded-full border transition-colors ${showIncidentRows ? '' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}><TriangleAlert size={16} /></button>
      <div className="flex flex-wrap items-center gap-2">
        {snapshot && <button type="button" onClick={downloadExcel} aria-label={t('solarDownloadExcel')} title={t('solarDownloadExcel')} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground hover:border-primary hover:text-primary"><Download size={16} aria-hidden="true" /></button>}
        {canManage && <label aria-label={t('rahcomRoadListChooseFile')} title={t('rahcomRoadListChooseFile')} className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-border bg-background px-3 text-sm text-foreground transition hover:border-primary hover:text-primary ${busy || !province ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
          {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <FileUp size={16} aria-hidden="true" />}
          <span>{busy ? t('rahcomRoadListUploading') : t('rahcomRoadListChooseFile')}</span>
          <input type="file" accept=".xlsx,.xls" disabled={busy || !province} onChange={(event) => void uploadFile(event)} className="sr-only" />
        </label>}
      </div>
    </header>

    {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-primary">{message}</p>}
    {!province ? <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{t('rahcomRoadListChooseProvince')}</p> : loading ? <p role="status" className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{t('rahcomSystemsLoading')}</p> : error ? null : !snapshot ? <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{t('rahcomRoadListNoData')}</p> : <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3"><RahcomRecordSummary bare showRecordDate={false} showCount={false} locale={locale} source={t('rahcomRoadList')} fileName={snapshot.fileName} recordDate={snapshot.listDate.slice(0, 10)} count={snapshot.rowCount} savedAt={snapshot.importedAt} /></div>
      <div className="max-h-[68vh] overflow-auto">
        <table className="w-max min-w-max border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-muted text-start text-xs text-muted-foreground"><tr>
            <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold whitespace-nowrap">{t('rahcomRowNumber')}</th>
            <th scope="col" className="min-w-[100px] border-b border-border px-2 py-2.5 text-center font-semibold whitespace-nowrap">{t('rahcomSystemCode')}</th>
            {identifierIndex >= 0 && <th scope="col" className="min-w-[88px] border-b border-border px-2 py-2.5 text-center font-semibold whitespace-nowrap">{headers[identifierIndex]}</th>}
            <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold whitespace-nowrap">{t('rahcomSystemName')}</th>
            {displayedDataColumns.map((column, index) => column === 'solar'
              ? <th key="solar-status" scope="col" className="min-w-[180px] border-b border-border px-3 py-2.5 text-center font-semibold whitespace-nowrap">{t('rahcomSystemSolar')}</th>
              : <th key={`${headers[column]}-${column}-${index}`} scope="col" className={`border-b border-border px-3 py-2.5 font-semibold ${positionIndex === column ? 'min-w-[240px] whitespace-nowrap' : cityIndex === column ? 'min-w-[160px] whitespace-nowrap' : wideSingleLineIndexes.includes(column) ? 'min-w-[200px] whitespace-nowrap' : 'max-w-64 whitespace-normal'}`}>{isSolarHeader(headers[column]) ? t('rahcomTrafficImportedStatus') : headers[column]}</th>)}
          </tr></thead>
          <tbody>{visibleRows.map((row, rowIndex) => {
            const match = getMatch(row);
            return <tr key={page * PAGE_SIZE + rowIndex} className="odd:bg-background even:bg-muted/30">
              <td className="border-b border-border/70 px-3 py-2 text-center tabular-nums text-foreground">{new Intl.NumberFormat(locale).format(page * PAGE_SIZE + rowIndex + 1)}</td>
              <td dir="ltr" className="min-w-[100px] whitespace-nowrap border-b border-border/70 px-2 py-2 text-center font-mono text-foreground">{match?.systemCode || '—'}</td>
              {identifierIndex >= 0 && <td className="min-w-[88px] whitespace-nowrap border-b border-border/70 px-2 py-2 text-center align-middle text-foreground">{row[identifierIndex] ?? ''}</td>}
              <td className="min-w-[280px] whitespace-nowrap border-b border-border/70 px-3 py-2 align-top text-foreground">{match?.systemName || '—'}</td>
              {displayedDataColumns.map((column, index) => column === 'solar'
                ? <td key="solar-status" className="min-w-[180px] whitespace-nowrap border-b border-border/70 px-3 py-2 text-center align-middle text-foreground">{(() => { const equipmentStatuses = getSolarStatuses(match); return equipmentStatuses.length ? <span className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1" dir="ltr">{equipmentStatuses.map(({ equipment, state }) => { const label = t(state === 'down' ? 'solarStatusDown' : 'solarStatusUnreachable'); return <span key={equipment} className="inline-flex items-center gap-1.5" title={`${equipment}: ${label}`} aria-label={`${equipment}: ${label}`}><bdi className="font-mono text-xs">{equipment}</bdi><span className={`inline-block size-3 rounded-full ${state === 'down' ? 'bg-red-600' : 'bg-gray-400'}`} /></span>; })}</span> : '\u2014'; })()}</td>
                : <td key={`${column}-${index}`} className={`border-b border-border/70 px-3 py-2 align-top text-foreground ${positionIndex === column || cityIndex === column || wideSingleLineIndexes.includes(column) ? 'whitespace-nowrap' : 'max-w-80 whitespace-pre-wrap'}`}>{row[column] ?? ''}</td>)}
            </tr>;
          })}</tbody>
        </table>
      </div>
      {pageCount > 1 && <div className="flex items-center justify-center gap-3 border-t border-border p-3 text-sm">
        <button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label={t('rahcomRoadListPreviousPage')} className="grid size-8 place-items-center rounded-full border border-border text-foreground disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight size={16} /></button>
        <span className="tabular-nums text-muted-foreground">{new Intl.NumberFormat(locale).format(page + 1)} / {new Intl.NumberFormat(locale).format(pageCount)}</span>
        <button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} aria-label={t('rahcomRoadListNextPage')} className="grid size-8 place-items-center rounded-full border border-border text-foreground disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={16} /></button>
      </div>}
    </section>}
  </main>;
}
