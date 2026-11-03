'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CircleOff, LoaderCircle, TriangleAlert } from 'lucide-react';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { iranProvinces, rahcomApi, type RahcomSolarSnapshot, type RahcomSystem, type RahcomTrafficSnapshot } from '@/lib/api/rahcom/rahcom-api';
import { getCurrentUser } from '@/lib/api/shared/auth-api';
import { useRahcomDate } from '@/app/(workspace)/rahcom/_shared/rahcom-date';
import { RahcomHeaderDate } from '@/app/(workspace)/rahcom/_shared/rahcom-header-date';
import { RahcomRecordSummary } from '@/app/(workspace)/rahcom/_shared/rahcom-record-summary';
import { RahcomCountCapsule } from '@/app/(workspace)/rahcom/_shared/rahcom-count-capsule';
import { RahcomTrafficUpload } from '@/app/(workspace)/rahcom/daily-traffic/rahcom-traffic-upload';
import { isRahcomIncidentValue, latestRahcomSolarSnapshotsByProvince, rahcomProvinceFromLabel, rahcomSystemKey, parseRahcomSolarList, tehranDateKey } from '@/lib/api/rahcom/solar-status';
const normalizeHeader = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa').replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) >= 0x06f0 ? digit.charCodeAt(0) - 0x06f0 : digit.charCodeAt(0) - 0x0660)).replace(/[\u200c\s]/g, '');
const isMarked = (value: string) => {
  const normalized = normalizeHeader(value);
  return Boolean(normalized) && !/^(?:0+(?:\.0+)?|false|no|none|null|خیر|ندارد|نداشته|بدونمورد|[-\u2014\u2013]+)$/.test(normalized);
};
type TrafficFilter = 'solar-down' | 'traffic-down' | 'traffic-incidents' | 'system-incidents' | 'no-traffic' | 'three-day-outage' | 'over-five-day-outage';
export function RahcomDailyTraffic({ provinceFilter, showIncidents = true, solarSnapshotPicker, onShowIncidentsChange }: { provinceFilter?: string; showIncidents?: boolean; solarSnapshotPicker?: ReactNode; onShowIncidentsChange?: (enabled: boolean) => void }) {
  const { locale } = usePreferences();
  const { date } = useRahcomDate();
  const [trafficSnapshot, setTrafficSnapshot] = useState<RahcomTrafficSnapshot | null>(null);
  const [trafficLoading, setTrafficLoading] = useState(true);
  const [trafficError, setTrafficError] = useState('');
  const [systemsByCode, setSystemsByCode] = useState<Record<string, RahcomSystem>>({});
  const [solarSnapshot, setSolarSnapshot] = useState<RahcomSolarSnapshot[]>([]);
  const [selectedProvince, setSelectedProvince] = useState('isfahan');
  const [trafficFilters, setTrafficFilters] = useState<TrafficFilter[]>(['no-traffic']);
  const t = useCallback((key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key), [locale]);

  useEffect(() => {
    const userId = getCurrentUser()?.id;
    const key = `rahyar-selected-province:${userId || 'current'}`;
    setSelectedProvince(window.localStorage.getItem(key) || 'isfahan');
    const onProvinceChange = (event: Event) => { const value = (event as CustomEvent<{ province?: string }>).detail?.province; if (value) setSelectedProvince(value); };
    const onStorage = (event: StorageEvent) => { if (event.key === key) setSelectedProvince(event.newValue || 'isfahan'); };
    window.addEventListener('rahyar:province-change', onProvinceChange);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('rahyar:province-change', onProvinceChange); window.removeEventListener('storage', onStorage); };
  }, []);

  const loadTrafficSnapshot = useCallback(async () => {
    setTrafficLoading(true);
    try { setTrafficSnapshot(await rahcomApi.trafficSnapshot(provinceFilter ?? selectedProvince, date ?? undefined)); setTrafficError(''); }
    catch (reason) { setTrafficError(reason instanceof Error ? reason.message : t('rahcomTrafficLoadFailed')); }
    finally { setTrafficLoading(false); }
  }, [t, provinceFilter, selectedProvince, date]);

  useEffect(() => { void loadTrafficSnapshot(); }, [loadTrafficSnapshot]);
  useEffect(() => {
    window.addEventListener('rahyar:traffic-snapshot-changed', loadTrafficSnapshot);
    return () => window.removeEventListener('rahyar:traffic-snapshot-changed', loadTrafficSnapshot);
  }, [loadTrafficSnapshot]);

  const loadTrafficDatesForCalendar = useCallback((from: string, to: string) => rahcomApi.trafficSnapshotDates(provinceFilter ?? selectedProvince, from, to), [provinceFilter, selectedProvince]);

  const loadSolarSnapshot = useCallback(async () => {
    try { setSolarSnapshot(latestRahcomSolarSnapshotsByProvince(await rahcomApi.solarSnapshots(provinceFilter ?? selectedProvince, date ?? undefined), tehranDateKey(date ?? undefined))); }
    catch { setSolarSnapshot([]); }
  }, [date, provinceFilter, selectedProvince]);
  useEffect(() => { void loadSolarSnapshot(); }, [loadSolarSnapshot]);
  useEffect(() => {
    window.addEventListener('rahyar:solar-snapshots-changed', loadSolarSnapshot);
    return () => window.removeEventListener('rahyar:solar-snapshots-changed', loadSolarSnapshot);
  }, [loadSolarSnapshot]);

  useEffect(() => {
    if (!trafficSnapshot) { setSystemsByCode({}); return; }
    let active = true;
    void rahcomApi.systems((provinceFilter ?? selectedProvince)).then((systems) => {
      if (active) {
        const index: Record<string, RahcomSystem> = {};
        const counts = new Map<string, number>();
        for (const system of systems) { const code = system.systemCode.trim().toUpperCase(); counts.set(code, (counts.get(code) ?? 0) + 1); index[rahcomSystemKey(system.province, code)] = system; }
        for (const system of systems) { const code = system.systemCode.trim().toUpperCase(); if (counts.get(code) === 1) index[code] = system; }
        setSystemsByCode(index);
      }
    }).catch(() => { if (active) setSystemsByCode({}); });
    return () => { active = false; };
  }, [provinceFilter, selectedProvince, trafficSnapshot?.id]);

  const trafficRows = trafficSnapshot?.rows ?? [];
  const normalizedTrafficHeaders = (trafficSnapshot?.headers ?? []).map(normalizeHeader);
  const trafficProvinceIndex = normalizedTrafficHeaders.findIndex((header) => header.includes('استان') || header.includes('province'));
  const trafficCodeIndex = normalizedTrafficHeaders.findIndex((header) => header.includes('کدسامانه') || header.includes('systemcode') || header === 'code');
  const trafficSystemNameIndex = normalizedTrafficHeaders.findIndex((header) => header.includes('\u0646\u0627\u0645\u0633\u0627\u0645\u0627\u0646\u0647') || header.includes('\u0646\u0627\u0645\u0627\u06cc\u0633\u062a\u06af\u0627\u0647') || header.includes('systemname') || header.includes('stationname'));
  const outageDurationIndex = normalizedTrafficHeaders.findIndex((header) => header.includes('تعدادروزقطعی') || header.includes('outagedays') || header.includes('daysofoutage'));
  const trafficAxisCodeIndex = normalizedTrafficHeaders.findIndex((header) => header.includes('\u06a9\u062f\u0645\u062d\u0648\u0631') || header.includes('axiscode'));
  const trafficAxisNameIndex = normalizedTrafficHeaders.findIndex((header) => header.includes('\u0646\u0627\u0645\u0645\u062d\u0648\u0631') || header.includes('axisname'));
  const trafficCrmIndex = normalizedTrafficHeaders.findIndex((header) => header.includes('crm') && (header.includes(normalizeHeader('\u062a\u0631\u062f\u062f')) || header.includes('traffic')) && (header.includes(normalizeHeader('\u0644\u062d\u0638\u0647\u0627\u06cc')) || header.includes('realtime') || header.includes('real-time')));
  const trafficSolarColumnIndex = normalizedTrafficHeaders.findIndex((header) => header.includes('\u0633\u0648\u0644\u0627\u0631') || header.includes('solar') || header.includes(normalizeHeader('\u0648\u0636\u0639\u06cc\u062a \u0644\u06cc\u0633\u062a \u062a\u0631\u062f\u062f')) || header.includes('trafficliststatus'));
  const trafficTicketIssueIndex = normalizedTrafficHeaders.findIndex((header) => header.includes(normalizeHeader('\u0645\u0634\u06a9\u0644 \u062a\u06cc\u06a9\u062a')) || header.includes('ticketproblem') || header.includes('ticketissue'));
  const orderedTrafficColumnIndexes = useMemo(() => {
    const prioritized = [trafficCodeIndex, trafficSystemNameIndex, outageDurationIndex, trafficAxisCodeIndex, trafficAxisNameIndex].filter((index) => index >= 0 && index !== trafficSolarColumnIndex);
    const prioritizedSet = new Set(prioritized);
    return [...prioritized, ...normalizedTrafficHeaders.map((_, index) => index).filter((index) => !prioritizedSet.has(index) && index !== trafficSolarColumnIndex)];
  }, [normalizedTrafficHeaders, outageDurationIndex, trafficAxisCodeIndex, trafficAxisNameIndex, trafficCodeIndex, trafficSolarColumnIndex, trafficSystemNameIndex]);
  const trafficIncidentIndexes = normalizedTrafficHeaders.flatMap((header, index) => ['سرقت', 'تخریب', 'تعریض', 'جابجایی', 'theft', 'damage', 'widening', 'relocation'].some((term) => header.includes(normalizeHeader(term))) ? [index] : []);
  const trafficSolarIndex = normalizedTrafficHeaders.findIndex((header) => header.includes('سولار') || header.includes('solar'));
  const threeDayOutageIndexes = normalizedTrafficHeaders.flatMap((header, index) => (header.includes('قطعی') || header.includes('outage')) && (header.includes('سهروز') || header.includes('3روز') || header.includes('3days') || header.includes('3day')) ? [index] : []);
  const overFiveDayOutageIndexes = normalizedTrafficHeaders.flatMap((header, index) => (header.includes('قطعی') || header.includes('outage')) && (header.includes('بیشاز5') || header.includes('بالای5') || header.includes('over5') || header.includes('morethan5') || header.includes('5days')) ? [index] : []);
  const latestDataIndex = normalizedTrafficHeaders.findIndex((header) => (header.includes(normalizeHeader('\u0622\u062e\u0631\u06cc\u0646')) && header.includes(normalizeHeader('\u0627\u0631\u0633\u0627\u0644'))) || (header.includes('last') && (header.includes('data') || header.includes('update') || header.includes('sync'))));
  const trafficDisplayIncidentIndexes = trafficIncidentIndexes.filter((index) => {
    const header = normalizedTrafficHeaders[index];
    return header.includes(normalizeHeader('\u0633\u0631\u0642\u062a')) || header.includes(normalizeHeader('\u062a\u062e\u0631\u06cc\u0628')) || header.includes('theft') || header.includes('damage');
  });
  const trafficDisplayColumns = useMemo<Array<number | 'solarStatus'>>(() => {
    const columns: Array<number | 'solarStatus'> = [trafficCrmIndex].filter((index) => index >= 0);
    const movedIndexes = new Set([...trafficDisplayIncidentIndexes, latestDataIndex, trafficCrmIndex, trafficSolarColumnIndex]);
    let solarStatusAdded = false;
    let importedSolarStatusAdded = false;
    let incidentColumnsAdded = false;
    const addImportedSolarStatus = () => {
      if (importedSolarStatusAdded || trafficSolarColumnIndex < 0) return;
      columns.push(trafficSolarColumnIndex);
      importedSolarStatusAdded = true;
    };
    const addIncidentColumns = () => {
      if (incidentColumnsAdded) return;
      for (const index of trafficDisplayIncidentIndexes) {
        if (index === trafficProvinceIndex || index === trafficSolarColumnIndex) continue;
        columns.push(index);
        if (index === trafficTicketIssueIndex) addImportedSolarStatus();
      }
      incidentColumnsAdded = true;
    };
    const addSolarStatus = () => {
      if (!solarStatusAdded) { columns.push('solarStatus'); solarStatusAdded = true; }
    };
    const addBeforeProvince = () => {
      addIncidentColumns();
      if (latestDataIndex >= 0 && latestDataIndex !== trafficProvinceIndex && latestDataIndex !== trafficSolarColumnIndex) columns.push(latestDataIndex);
    };
    for (const index of orderedTrafficColumnIndexes) {
      if (index === trafficAxisCodeIndex) addSolarStatus();
      if (index === trafficProvinceIndex) addBeforeProvince();
      if (index === trafficSystemNameIndex) {
        columns.push(index);
        addIncidentColumns();
        continue;
      }
      if (index === trafficSolarColumnIndex || movedIndexes.has(index)) continue;
      columns.push(index);
      if (index === trafficTicketIssueIndex) addImportedSolarStatus();
    }
    if (!solarStatusAdded) addSolarStatus();
    if (!incidentColumnsAdded) addIncidentColumns();
    if (!importedSolarStatusAdded) addImportedSolarStatus();
    return columns;
  }, [orderedTrafficColumnIndexes, trafficDisplayIncidentIndexes, trafficProvinceIndex, trafficAxisCodeIndex, trafficCrmIndex, trafficSolarColumnIndex, trafficSystemNameIndex, trafficTicketIssueIndex, latestDataIndex]);
  const provinceForView = provinceFilter ?? selectedProvince;
  const selectedProvinceName = iranProvinces.find(([id]) => id === provinceForView)?.[1] ?? provinceForView;
  const provinceTrafficRows = useMemo(() => {
    const province = provinceForView;
    if (province === 'all') return trafficRows;
    const codes = new Set(Object.keys(systemsByCode));
    const codeIndex = normalizedTrafficHeaders.findIndex((header) => header.includes('کدسامانه') || header.includes('systemcode') || header === 'code');
    return trafficRows.filter((row) => {
      const provinceMatches = trafficProvinceIndex >= 0 && normalizeHeader(row[trafficProvinceIndex] ?? '').includes(normalizeHeader(selectedProvinceName));
      const codeMatches = codeIndex >= 0 && codes.has((row[codeIndex] ?? '').trim().toUpperCase());
      return provinceMatches || codeMatches;
    });
  }, [normalizedTrafficHeaders, provinceForView, selectedProvinceName, systemsByCode, trafficProvinceIndex, trafficRows]);
  const solarStateByCode = useMemo(() => {
    const grouped = new Map<string, Array<{ equipment: string; state: 'down' | 'unreachable' }>>();
    for (const snapshot of solarSnapshot) {
      for (const entry of [...parseRahcomSolarList(snapshot.downText, 'down'), ...parseRahcomSolarList(snapshot.unreachableText, 'unreachable')]) {
        const key = rahcomSystemKey(snapshot.province ?? entry.province ?? '', entry.site);
        const values = grouped.get(key) ?? [];
        values.push({ equipment: entry.equipment, state: entry.state });
        grouped.set(key, values);
      }
    }
    return grouped;
  }, [solarSnapshot]);
  const filteredTrafficRows = useMemo(() => {
    const rowSystem = (row: string[]) => {
      const code = (row[trafficCodeIndex] ?? '').trim().toUpperCase();
      const rawProvince = trafficProvinceIndex >= 0 ? row[trafficProvinceIndex] ?? '' : '';
      const rowProvince = rahcomProvinceFromLabel(rawProvince) ?? (provinceForView !== 'all' ? provinceForView : undefined);
      return rowProvince ? systemsByCode[rahcomSystemKey(rowProvince, code)] ?? systemsByCode[code] : systemsByCode[code];
    };
    const matchesFilter = (row: string[]) => {
      const code = (row[trafficCodeIndex] ?? '').trim().toUpperCase();
      const system = rowSystem(row);
      const rowProvince = system?.province ?? (trafficProvinceIndex >= 0 ? rahcomProvinceFromLabel(row[trafficProvinceIndex] ?? '') : null) ?? (provinceForView !== 'all' ? provinceForView : null);
      const solarIsDown = Boolean(rowProvince && (solarStateByCode.get(rahcomSystemKey(rowProvince, code)) ?? []).some(({ state }) => state === 'down'));
      const trafficStatus = normalizeHeader(row[trafficSolarIndex] ?? '');
      const trafficListIsDown = /(down|دان|قطع)/.test(trafficStatus);
      const trafficHasIncident = trafficIncidentIndexes.some((index) => isRahcomIncidentValue(row[index] ?? ''));
      if (trafficHasIncident && !showIncidents) return false;
      if (trafficFilters.length === 0) return true;
      const noRealtimeTrafficValue = normalizeHeader(trafficCrmIndex >= 0 ? row[trafficCrmIndex] ?? '' : '');
      const noTraffic = trafficCrmIndex >= 0 && (noRealtimeTrafficValue.includes(normalizeHeader('\u0628\u062f\u0648\u0646 \u062a\u0631\u062f\u062f')) || noRealtimeTrafficValue.includes('notraffic') || noRealtimeTrafficValue.includes('norealtime'));
      const durationText = String(row[outageDurationIndex] ?? '').replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) >= 0x06f0 ? digit.charCodeAt(0) - 0x06f0 : digit.charCodeAt(0) - 0x0660));
      const duration = Number.parseFloat(durationText.replace(/[^0-9.]/g, ''));
      const threeDayOutage = (Number.isFinite(duration) && duration === 3) || threeDayOutageIndexes.some((index) => {
        const value = normalizeHeader(row[index] ?? '');
        return isMarked(value);
      });
      const durationLabel = normalizeHeader(durationText);
      const overFiveDayOutage = (Number.isFinite(duration) && duration > 5) || /(بیشاز5|بالای5|بیشازپنج|بالایپنج|over5|morethan5)/.test(durationLabel) || overFiveDayOutageIndexes.some((index) => {
        const value = normalizeHeader(row[index] ?? '');
        return isMarked(value);
      });
      return (trafficFilters.includes('solar-down') && solarIsDown)
        || (trafficFilters.includes('traffic-down') && trafficListIsDown)
        || (trafficFilters.includes('traffic-incidents') && trafficHasIncident)
        || (trafficFilters.includes('no-traffic') && noTraffic)
        || (trafficFilters.includes('three-day-outage') && threeDayOutage)
        || (trafficFilters.includes('over-five-day-outage') && overFiveDayOutage);
    };
    return provinceTrafficRows.filter(matchesFilter);
  }, [locale, outageDurationIndex, overFiveDayOutageIndexes, provinceForView, provinceTrafficRows, showIncidents, solarStateByCode, systemsByCode, threeDayOutageIndexes, trafficCodeIndex, trafficCrmIndex, trafficFilters, trafficIncidentIndexes, trafficProvinceIndex, trafficSolarIndex]);
  const filteredSystemCount = useMemo(() => new Set(filteredTrafficRows.flatMap((row) => {
    const code = (row[trafficCodeIndex] ?? '').trim().toUpperCase();
    if (!code) return [];
    const province = trafficProvinceIndex >= 0 ? rahcomProvinceFromLabel(row[trafficProvinceIndex] ?? '') : null;
    return [province ? rahcomSystemKey(province, code) : code];
  })).size, [filteredTrafficRows, trafficCodeIndex, trafficProvinceIndex]);
  const statusForTrafficRow = (row: string[]) => {
    const code = (row[trafficCodeIndex] ?? '').trim().toUpperCase();
    if (!code) return '\u2014';
    const rawProvince = trafficProvinceIndex >= 0 ? row[trafficProvinceIndex] : '';
    const rowProvince = rahcomProvinceFromLabel(rawProvince ?? '') ?? (provinceForView !== 'all' ? provinceForView : systemsByCode[code]?.province);
    const snapshot = solarSnapshot.find((item) => item.province === rowProvince);
    if (!snapshot || !rowProvince) return t('rahcomTrafficSolarSnapshotMissing');
    const equipmentStatuses = solarStateByCode.get(rahcomSystemKey(rowProvince, code)) ?? [];
    if (!equipmentStatuses.length) return t('solarStatusNormal');
    return <span className="inline-flex flex-nowrap items-center justify-center gap-3 whitespace-nowrap" dir="ltr">{equipmentStatuses.map(({ equipment, state }) => {
      const label = t(state === 'down' ? 'solarStatusDown' : 'solarStatusUnreachable');
      return <span key={equipment} className="inline-flex items-center gap-1.5" title={`${equipment}: ${label}`} aria-label={`${equipment}: ${label}`}><bdi className="font-mono text-xs">{equipment}</bdi><span className={`inline-block size-3 rounded-full ${state === 'down' ? 'bg-red-600' : 'bg-gray-400'}`} /></span>;
    })}</span>;
  };
  const toggleTrafficFilter = () => {
    setTrafficFilters((current) => current.includes('no-traffic') ? [] : ['no-traffic']);
  };

  return (
    <section dir={locale === 'fa' || locale === 'ar' ? 'rtl' : 'ltr'} className="space-y-4">
      <div className="flex flex-wrap items-center justify-start gap-2">
        <RahcomHeaderDate loadMarkedDates={loadTrafficDatesForCalendar} />
        {solarSnapshotPicker}
        <RahcomCountCapsule count={filteredSystemCount} />
        <RahcomTrafficUpload />
        <button type="button" aria-pressed={showIncidents} aria-label={t('rahcomIncidentFilter')} title={t('rahcomIncidentFilter')} onClick={() => onShowIncidentsChange?.(!showIncidents)} style={showIncidents ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`grid size-9 place-items-center rounded-full border transition-colors ${showIncidents ? '' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}><TriangleAlert size={16} /></button>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" aria-pressed={trafficFilters.includes('no-traffic')} aria-label={t('rahcomTrafficNoRealtimeTraffic')} title={t('rahcomTrafficNoRealtimeTraffic')} onClick={toggleTrafficFilter} style={trafficFilters.includes('no-traffic') ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`grid size-9 place-items-center rounded-full border transition-colors ${trafficFilters.includes('no-traffic') ? '' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}><CircleOff size={16} /></button>
        </div>
      </div>

      {trafficLoading ? <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground"><LoaderCircle size={16} className="animate-spin" />{t('rahcomSystemsLoading')}</div> : trafficSnapshot ? <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3"><RahcomRecordSummary bare showRecordDate={false} showCount={false} locale={locale} source={t('rahcomDailyTraffic')} fileName={trafficSnapshot.fileName} recordDate={trafficSnapshot.snapshotDate.slice(0, 10)} count={trafficSnapshot.rowCount} savedAt={trafficSnapshot.createdAt} /></div>
          <div className="max-h-[68vh] overflow-auto"><table className="w-full min-w-max text-xs"><thead className="sticky top-0 z-10 bg-muted"><tr><th scope="col" className="whitespace-nowrap px-3 py-2 text-center font-semibold text-foreground">{t('rahcomRowNumber')}</th>{trafficDisplayColumns.map((column) => column === 'solarStatus' ? <th key="solar-status" className="whitespace-nowrap px-3 py-2 text-center font-semibold text-foreground">{t('rahcomSystemSolar')}</th> : <th key={column} className="max-w-64 whitespace-nowrap px-3 py-2 text-center font-semibold text-foreground">{column === trafficSolarColumnIndex ? t('rahcomTrafficImportedStatus') : trafficSnapshot.headers[column]}</th>)}</tr></thead><tbody>{filteredTrafficRows.length === 0 ? <tr><td colSpan={trafficDisplayColumns.length + 1} className="p-4 text-center text-muted-foreground">{t('rahcomTrafficNoMatches')}</td></tr> : filteredTrafficRows.map((row, rowIndex) => <tr key={rowIndex} className="border-t border-border hover:bg-accent/30"><td className="whitespace-nowrap px-3 py-2 text-center tabular-nums text-foreground">{new Intl.NumberFormat(locale).format(rowIndex + 1)}</td>{trafficDisplayColumns.map((column) => column === 'solarStatus' ? <td key="solar-status" className="whitespace-nowrap px-3 py-2 text-center font-medium text-foreground">{statusForTrafficRow(row)}</td> : <td key={column} className="max-w-64 truncate whitespace-nowrap px-3 py-2 text-center text-foreground">{row[column] || '—'}</td>)}</tr>)}</tbody></table></div>
        </section> : !trafficError ? <p className="rounded-xl border border-dashed border-border bg-card p-5 text-center text-sm text-muted-foreground">{t('rahcomTrafficNoList')}</p> : <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">{trafficError}</p>}
    </section>
  );
}
