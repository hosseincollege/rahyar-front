'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, CalendarClock, CalendarRange, ChevronLeft, ChevronRight, ClipboardList, LoaderCircle, PanelsTopLeft, Search, Sun, TriangleAlert } from 'lucide-react';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { iranProvinces, rahcomApi, type RahcomSolarSnapshot, type RahcomSystem, type RahcomTrafficSnapshot } from '@/lib/api/rahcom/rahcom-api';
import { getCurrentUser } from '@/lib/api/shared/auth-api';
import { useRahcomDate } from '@/app/(workspace)/rahcom/_shared/rahcom-date';
import { RahcomHeaderDate } from '@/app/(workspace)/rahcom/_shared/rahcom-header-date';
import { RahcomTrafficUpload } from '@/app/(workspace)/rahcom/daily-traffic/rahcom-traffic-upload';
import { isRahcomIncidentValue, latestRahcomSolarSnapshotsByProvince, rahcomProvinceFromLabel, rahcomSystemKey, parseRahcomSolarList, tehranDateKey } from '@/lib/api/rahcom/solar-status';

const pageSize = 50;
const normalizeHeader = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa').replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) >= 0x06f0 ? digit.charCodeAt(0) - 0x06f0 : digit.charCodeAt(0) - 0x0660)).replace(/[\u200c\s]/g, '');
const isMarked = (value: string) => {
  const normalized = normalizeHeader(value);
  return Boolean(normalized) && !/^(?:0+(?:\.0+)?|false|no|none|null|خیر|ندارد|نداشته|بدونمورد|[-\u2014\u2013]+)$/.test(normalized);
};
type TrafficFilter = 'solar-down' | 'traffic-down' | 'traffic-incidents' | 'system-incidents' | 'no-traffic' | 'three-day-outage' | 'over-five-day-outage';
export function RahcomDailyTraffic({ provinceFilter, showIncidents = false, onShowIncidentsChange }: { provinceFilter?: string; showIncidents?: boolean; onShowIncidentsChange?: (enabled: boolean) => void }) {
  const { locale } = usePreferences();
  const { date } = useRahcomDate();
  const [trafficSnapshot, setTrafficSnapshot] = useState<RahcomTrafficSnapshot | null>(null);
  const [trafficLoading, setTrafficLoading] = useState(true);
  const [trafficError, setTrafficError] = useState('');
  const [trafficSearch, setTrafficSearch] = useState('');
  const [trafficPage, setTrafficPage] = useState(0);
  const [systemsByCode, setSystemsByCode] = useState<Record<string, RahcomSystem>>({});
  const [solarSnapshot, setSolarSnapshot] = useState<RahcomSolarSnapshot[]>([]);
  const [selectedProvince, setSelectedProvince] = useState('isfahan');
  const [trafficFilters, setTrafficFilters] = useState<TrafficFilter[]>([]);
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
  const trafficIncidentIndexes = normalizedTrafficHeaders.flatMap((header, index) => ['سرقت', 'تخریب', 'تعریض', 'جابجایی', 'theft', 'damage', 'widening', 'relocation'].some((term) => header.includes(normalizeHeader(term))) ? [index] : []);
  const trafficSolarIndex = normalizedTrafficHeaders.findIndex((header) => header.includes('سولار') || header.includes('solar'));
  const noTrafficIndex = normalizedTrafficHeaders.findIndex((header) => header.includes('بدونتردد') || header.includes('notraffic'));
  const outageDurationIndex = normalizedTrafficHeaders.findIndex((header) => header.includes('تعدادروزقطعی') || header.includes('outagedays') || header.includes('daysofoutage'));
  const threeDayOutageIndexes = normalizedTrafficHeaders.flatMap((header, index) => (header.includes('قطعی') || header.includes('outage')) && (header.includes('سهروز') || header.includes('3روز') || header.includes('3days') || header.includes('3day')) ? [index] : []);
  const overFiveDayOutageIndexes = normalizedTrafficHeaders.flatMap((header, index) => (header.includes('قطعی') || header.includes('outage')) && (header.includes('بیشاز5') || header.includes('بالای5') || header.includes('over5') || header.includes('morethan5') || header.includes('5days')) ? [index] : []);
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
      const systemHasIncident = Boolean(system?.incidentType || isRahcomIncidentValue(system?.incidentDetails ?? ''));
      if ((trafficHasIncident || systemHasIncident) && !showIncidents) return false;
      if (trafficFilters.length === 0) return true;
      const noTrafficValue = normalizeHeader(row[noTrafficIndex] ?? '');
      const noTraffic = noTrafficIndex >= 0 && isMarked(noTrafficValue);
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
        || (trafficFilters.includes('system-incidents') && systemHasIncident)
        || (trafficFilters.includes('no-traffic') && noTraffic)
        || (trafficFilters.includes('three-day-outage') && threeDayOutage)
        || (trafficFilters.includes('over-five-day-outage') && overFiveDayOutage);
    };
    const query = trafficSearch.trim().toLocaleLowerCase(locale);
    return provinceTrafficRows.filter((row) => matchesFilter(row) && (!query || row.join(' ').toLocaleLowerCase(locale).includes(query)));
  }, [locale, noTrafficIndex, outageDurationIndex, overFiveDayOutageIndexes, provinceForView, provinceTrafficRows, showIncidents, solarStateByCode, systemsByCode, threeDayOutageIndexes, trafficCodeIndex, trafficFilters, trafficIncidentIndexes, trafficProvinceIndex, trafficSearch, trafficSolarIndex]);
  const trafficPageCount = Math.max(1, Math.ceil(filteredTrafficRows.length / pageSize));
  const visibleTrafficRows = filteredTrafficRows.slice(Math.min(trafficPage, trafficPageCount - 1) * pageSize, (Math.min(trafficPage, trafficPageCount - 1) + 1) * pageSize);
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
    const labels = new Map(equipmentStatuses.map(({ equipment, state }) => [equipment, state]));
    const failedLte = labels.has('LTE-1') || labels.has('LTE-2');
    const formatStatus = (state?: 'down' | 'unreachable') => state === 'down' ? t('solarStatusDown') : state === 'unreachable' ? t('solarStatusUnreachable') : t('solarStatusNormal');
    const lteStatuses = failedLte ? [`LTE-1: ${formatStatus(labels.get('LTE-1'))}`, `LTE-2: ${formatStatus(labels.get('LTE-2'))}`] : [];
    const otherStatuses = equipmentStatuses.filter(({ equipment }) => !/^LTE-[12]$/.test(equipment)).map(({ equipment, state }) => `${equipment}: ${formatStatus(state)}`);
    return [...lteStatuses, ...otherStatuses].join(' · ') || t('solarStatusNormal');
  };
  const toggleTrafficFilter = (filter: TrafficFilter) => {
    setTrafficPage(0);
    setTrafficFilters((current) => current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]);
  };

  return (
    <section dir={locale === 'fa' || locale === 'ar' ? 'rtl' : 'ltr'} className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <RahcomHeaderDate />
        <RahcomTrafficUpload />
        <button type="button" aria-pressed={showIncidents} aria-label={t('rahcomIncidentFilter')} title={t('rahcomIncidentFilter')} onClick={() => onShowIncidentsChange?.(!showIncidents)} style={showIncidents ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`grid size-9 place-items-center rounded-full border transition-colors ${showIncidents ? '' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}><TriangleAlert size={16} /></button>
        <label className="relative block min-w-40 max-w-sm flex-1"><Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={trafficSearch} onChange={(event) => { setTrafficSearch(event.target.value); setTrafficPage(0); }} placeholder={t('rahcomTrafficSearch')} className="h-9 w-full rounded-full border border-border bg-background ps-9 pe-3 text-sm text-foreground" /></label>
        <div className="flex flex-wrap items-center gap-1.5">
          {([
            ['solar-down', Sun, t('rahcomTrafficSolarDown')],
            ['traffic-down', TriangleAlert, `${t('rahcomTrafficImportedStatus')} · ${t('solarStatusDown')}`],
            ['traffic-incidents', ClipboardList, t('rahcomTrafficIncidentColumn')],
            ['system-incidents', PanelsTopLeft, t('rahcomSystemIncidentColumn')],
            ['no-traffic', Ban, t('rahcomTrafficNoTraffic')],
            ['three-day-outage', CalendarClock, `${t('rahcomOutageDaysColumn')} · ${new Intl.NumberFormat(locale).format(3)}`],
            ['over-five-day-outage', CalendarRange, `${t('rahcomOutageDaysColumn')} · > ${new Intl.NumberFormat(locale).format(5)}`],
          ] as const).map(([filter, Icon, label]) => <button key={filter} type="button" aria-pressed={trafficFilters.includes(filter)} aria-label={label} title={label} onClick={() => toggleTrafficFilter(filter)} style={trafficFilters.includes(filter) ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`grid size-9 place-items-center rounded-full border transition-colors ${trafficFilters.includes(filter) ? '' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}><Icon size={16} /></button>)}
        </div>
        <div role="status" aria-live="polite" aria-label={`${new Intl.NumberFormat(locale).format(filteredSystemCount)} ${t('rahcomSystemName')}`} className="ms-auto inline-flex h-9 items-center gap-2 rounded-full border border-border bg-background px-3 text-xs font-semibold tabular-nums text-foreground">
          <PanelsTopLeft size={14} className="text-primary" />{new Intl.NumberFormat(locale).format(filteredSystemCount)} {t('rahcomSystemName')}
        </div>
      </div>

      {trafficLoading ? <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground"><LoaderCircle size={16} className="animate-spin" />{t('rahcomSystemsLoading')}</div> : trafficSnapshot ? <>
          <div className="max-h-[65vh] overflow-auto rounded-xl border border-border"><table className="min-w-max text-xs"><thead className="sticky top-0 bg-muted"><tr><th className="whitespace-nowrap px-3 py-2 text-start font-semibold text-foreground">{t('rahcomTrafficSolarStatus')}</th>{trafficSnapshot.headers.map((header, index) => <th key={`${header}:${index}`} className="max-w-64 whitespace-nowrap px-3 py-2 text-start font-semibold text-foreground">{normalizeHeader(header).includes('سولار') || normalizeHeader(header).includes('solar') ? t('rahcomTrafficImportedStatus') : header}</th>)}</tr></thead><tbody>{visibleTrafficRows.length === 0 ? <tr><td colSpan={trafficSnapshot.headers.length + 1} className="p-4 text-center text-muted-foreground">{t('rahcomTrafficNoMatches')}</td></tr> : visibleTrafficRows.map((row, rowIndex) => <tr key={`${trafficPage}:${rowIndex}`} className="border-t border-border hover:bg-accent/30"><td className="max-w-64 whitespace-nowrap px-3 py-2 font-medium text-foreground">{statusForTrafficRow(row)}</td>{trafficSnapshot.headers.map((_, columnIndex) => <td key={columnIndex} className="max-w-64 truncate whitespace-nowrap px-3 py-2 text-foreground">{row[columnIndex] || '—'}</td>)}</tr>)}</tbody></table></div>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{filteredTrafficRows.length.toLocaleString('fa-IR')} {t('rahcomTrafficRows')}</span><div className="flex items-center gap-2"><button type="button" disabled={trafficPage <= 0} onClick={() => setTrafficPage((current) => Math.max(0, current - 1))} className="rounded-lg border border-border p-2 disabled:opacity-40" aria-label={t('rahcomPreviousPage')}><ChevronRight size={16} /></button><span>{(trafficPage + 1).toLocaleString('fa-IR')} / {trafficPageCount.toLocaleString('fa-IR')}</span><button type="button" disabled={trafficPage + 1 >= trafficPageCount} onClick={() => setTrafficPage((current) => Math.min(trafficPageCount - 1, current + 1))} className="rounded-lg border border-border p-2 disabled:opacity-40" aria-label={t('rahcomNextPage')}><ChevronLeft size={16} /></button></div></div>
        </> : !trafficError ? <p className="rounded-xl border border-dashed border-border bg-card p-5 text-center text-sm text-muted-foreground">{t('rahcomTrafficNoList')}</p> : <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">{trafficError}</p>}
    </section>
  );
}
