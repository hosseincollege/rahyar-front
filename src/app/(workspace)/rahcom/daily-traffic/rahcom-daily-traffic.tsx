'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ChevronLeft, ChevronRight, FileSpreadsheet, LoaderCircle, Mail, Search, Users, Wrench } from 'lucide-react';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { iranProvinces, rahcomApi, type RahcomActivity, type RahcomSolarSnapshot, type RahcomSystem, type RahcomTrafficSnapshot } from '@/lib/api/rahcom/rahcom-api';
import { getCurrentUser } from '@/lib/api/shared/auth-api';
import { formatJalaliDate } from '@/lib/api/rahcom/jalali-date';
import { useRahcomDate } from '@/app/(workspace)/rahcom/_shared/rahcom-date';
import { RahcomTrafficUpload } from './rahcom-traffic-upload';
import { latestRahcomSolarSnapshotsByProvince, rahcomProvinceFromLabel, rahcomSystemKey, parseRahcomSolarList, tehranDateKey } from '@/lib/api/rahcom/solar-status';

const pageSize = 50;
const normalizeHeader = (value: string) => value.trim().toLocaleLowerCase('fa').replace(/[\u200c\s]/g, '');
function uploadedAt(value: string) {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23', timeZone: 'Asia/Tehran' }).format(new Date(value));
}

export function RahcomDailyTraffic({ canManage = false, provinceFilter }: { canManage?: boolean; provinceFilter?: string }) {
  const router = useRouter();
  const { locale } = usePreferences();
  const { date } = useRahcomDate();
  const [items, setItems] = useState<RahcomActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trafficSnapshot, setTrafficSnapshot] = useState<RahcomTrafficSnapshot | null>(null);
  const [trafficLoading, setTrafficLoading] = useState(true);
  const [trafficError, setTrafficError] = useState('');
  const [trafficSearch, setTrafficSearch] = useState('');
  const [trafficPage, setTrafficPage] = useState(0);
  const [repairProvince, setRepairProvince] = useState('');
  const [systemsByCode, setSystemsByCode] = useState<Record<string, RahcomSystem>>({});
  const [systemsIndexLoaded, setSystemsIndexLoaded] = useState(false);
  const [solarSnapshot, setSolarSnapshot] = useState<RahcomSolarSnapshot[]>([]);
  const [selectedProvince, setSelectedProvince] = useState('isfahan');
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

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    if (!date) {
      setItems([]);
      setLoading(false);
      return () => { active = false; };
    }
    void rahcomApi.activities(date, undefined, provinceFilter && provinceFilter !== 'all' ? provinceFilter : undefined)
      .then((rows) => { if (active) setItems(rows); })
      .catch((reason: unknown) => {
        if (active) {
          setItems([]);
          setError(reason instanceof Error ? reason.message : t('rahcomHistoryLoadError'));
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date, provinceFilter, t]);

  const loadTrafficSnapshot = useCallback(async () => {
    setTrafficLoading(true);
    try { setTrafficSnapshot(await rahcomApi.trafficSnapshot(provinceFilter ?? selectedProvince)); setTrafficError(''); }
    catch (reason) { setTrafficError(reason instanceof Error ? reason.message : t('rahcomTrafficLoadFailed')); }
    finally { setTrafficLoading(false); }
  }, [t, provinceFilter, selectedProvince]);

  useEffect(() => { void loadTrafficSnapshot(); }, [loadTrafficSnapshot]);
  useEffect(() => {
    window.addEventListener('rahyar:traffic-snapshot-changed', loadTrafficSnapshot);
    return () => window.removeEventListener('rahyar:traffic-snapshot-changed', loadTrafficSnapshot);
  }, [loadTrafficSnapshot]);

  const loadSolarSnapshot = useCallback(async () => {
    try { setSolarSnapshot(latestRahcomSolarSnapshotsByProvince(await rahcomApi.solarSnapshots(provinceFilter ?? selectedProvince), tehranDateKey(date ?? undefined))); }
    catch { setSolarSnapshot([]); }
  }, [date, provinceFilter, selectedProvince]);
  useEffect(() => { void loadSolarSnapshot(); }, [loadSolarSnapshot]);
  useEffect(() => {
    window.addEventListener('rahyar:solar-snapshots-changed', loadSolarSnapshot);
    return () => window.removeEventListener('rahyar:solar-snapshots-changed', loadSolarSnapshot);
  }, [loadSolarSnapshot]);

  useEffect(() => {
    if (!trafficSnapshot) { setSystemsByCode({}); setSystemsIndexLoaded(false); return; }
    let active = true;
    void rahcomApi.systems((provinceFilter ?? selectedProvince)).then((systems) => {
      if (active) {
        const index: Record<string, RahcomSystem> = {};
        const counts = new Map<string, number>();
        for (const system of systems) { const code = system.systemCode.trim().toUpperCase(); counts.set(code, (counts.get(code) ?? 0) + 1); index[rahcomSystemKey(system.province, code)] = system; }
        for (const system of systems) { const code = system.systemCode.trim().toUpperCase(); if (counts.get(code) === 1) index[code] = system; }
        setSystemsByCode(index);
        setSystemsIndexLoaded(true);
      }
    }).catch(() => { if (active) { setSystemsByCode({}); setSystemsIndexLoaded(true); } });
    return () => { active = false; };
  }, [provinceFilter, selectedProvince, trafficSnapshot?.id]);

  const totals = useMemo(() => ({
    emails: items.filter((item) => item.activityType === 'EMAIL_SENT').reduce((sum, item) => sum + item.quantity, 0),
    visits: items.filter((item) => item.activityType === 'SYSTEM_VISIT').length,
    other: items.filter((item) => item.activityType === 'OTHER').reduce((sum, item) => sum + item.quantity, 0),
  }), [items]);

  const trafficRows = trafficSnapshot?.rows ?? [];
  const normalizedTrafficHeaders = (trafficSnapshot?.headers ?? []).map(normalizeHeader);
  const trafficProvinceIndex = normalizedTrafficHeaders.findIndex((header) => header.includes('استان') || header.includes('province'));
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
  const filteredTrafficRows = useMemo(() => {
    const query = trafficSearch.trim().toLocaleLowerCase(locale);
    if (!query) return provinceTrafficRows;
    return provinceTrafficRows.filter((row) => row.join(' ').toLocaleLowerCase(locale).includes(query));
  }, [locale, provinceTrafficRows, trafficSearch]);
  const trafficPageCount = Math.max(1, Math.ceil(filteredTrafficRows.length / pageSize));
  const visibleTrafficRows = filteredTrafficRows.slice(Math.min(trafficPage, trafficPageCount - 1) * pageSize, (Math.min(trafficPage, trafficPageCount - 1) + 1) * pageSize);
  const solarColumnIndex = normalizedTrafficHeaders.findIndex((header) => header.includes('سولار') || header.includes('solar'));
  const savedDownCount = trafficSnapshot ? trafficRows.filter((row) => /^(down|دان|قطع|قطعی)$/i.test(row[solarColumnIndex] ?? '')).length : 0;
  const savedNoTrafficCount = trafficSnapshot ? trafficRows.filter((row) => /بدون\s*تردد/i.test(row[normalizedTrafficHeaders.findIndex((header) => header.includes('بدونتردد') && header.includes('سهروز'))] ?? '')).length : 0;
  const repairProvinceIndex = normalizedTrafficHeaders.findIndex((header) => header.includes('استان'));
  const repairCodeIndex = normalizedTrafficHeaders.findIndex((header) => header.includes('کدسامانه') || header.includes('systemcode') || header === 'code');
  const repairAxisCodeIndex = normalizedTrafficHeaders.findIndex((header) => header.includes('کدمحور'));
  const repairSolarIndex = solarColumnIndex;
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
  const statusForTrafficRow = (row: string[]) => {
    const code = (row[repairCodeIndex] ?? '').trim().toUpperCase();
    if (!code) return '\u2014';
    const rawProvince = repairProvinceIndex >= 0 ? row[repairProvinceIndex] : '';
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
  const repairGroups = useMemo(() => {
    const groups = new Map<string, Array<{ code: string; axisCode: string; row: string[]; system: RahcomSystem | null }>>();
    if (repairProvinceIndex < 0 || repairCodeIndex < 0 || repairSolarIndex < 0) return [];
    for (const row of trafficRows) {
      const solar = (row[repairSolarIndex] ?? '').trim().toLocaleLowerCase('fa').replace(/[\u200c\s]/g, '');
      if (!['down', 'دان', 'قطع', 'قطعی'].includes(solar)) continue;
      const province = (row[repairProvinceIndex] ?? '').trim() || '—';
      const code = (row[repairCodeIndex] ?? '').trim();
      const axisCode = repairAxisCodeIndex >= 0 ? (row[repairAxisCodeIndex] ?? '').trim() : '';
      if (!code) continue;
      const items = groups.get(province) ?? [];
      items.push({ code, axisCode, row, system: systemsByCode[rahcomSystemKey(rahcomProvinceFromLabel(province) ?? '', code)] ?? null });
      groups.set(province, items);
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, locale));
  }, [locale, repairAxisCodeIndex, repairCodeIndex, repairProvinceIndex, repairSolarIndex, systemsByCode, trafficRows]);
  const shownRepairGroups = repairProvince ? repairGroups.filter(([name]) => name === repairProvince) : repairGroups;

  function openRepairAction(system: RahcomSystem) {
    window.sessionStorage.setItem('rahyar-rahcom-focus-system', system.id);
    router.push('/rahcom/actions');
  }

  return (
    <section dir={locale === 'fa' || locale === 'ar' ? 'rtl' : 'ltr'} className="space-y-4">
      {canManage && <RahcomTrafficUpload />}
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Activity size={20} /></span>
          <div><h2 className="font-bold text-foreground">{t('rahcomDailyTraffic')}</h2><p className="mt-1 text-xs text-muted-foreground">{date ? formatJalaliDate(date) : t('rahcomInvalidJalaliDate')}</p></div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {([
          [t('rahcomEmailSent'), totals.emails, Mail],
          [t('rahcomSystemVisit'), totals.visits, Users],
          [t('rahcomOther'), totals.other, Activity],
        ] as const).map(([label, value, Icon]) => (
          <article key={label} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={18} /></span>
            <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold tabular-nums text-foreground">{value.toLocaleString('fa-IR')}</p></div>
          </article>
        ))}
      </div>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileSpreadsheet size={19} /></span><div><h2 className="font-bold text-foreground">{t('rahcomTrafficList')}</h2><p className="mt-1 text-xs text-muted-foreground">{trafficSnapshot ? `${trafficSnapshot.fileName} · ${trafficSnapshot.sheetName} · ${uploadedAt(trafficSnapshot.createdAt)}` : t('rahcomTrafficNoList')}</p></div></div>
          {trafficSnapshot && <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-muted px-3 py-1.5 text-foreground">{t('rahcomTrafficRows')}: {trafficSnapshot.rowCount.toLocaleString('fa-IR')}</span><span className="rounded-full bg-destructive/10 px-3 py-1.5 text-destructive">{t('rahcomTrafficSolarDown')}: {savedDownCount.toLocaleString('fa-IR')}</span><span className="rounded-full bg-muted px-3 py-1.5 text-muted-foreground">{t('rahcomTrafficNoTraffic')}: {savedNoTrafficCount.toLocaleString('fa-IR')}</span></div>}
        </div>

        {trafficSnapshot && <section className="space-y-3 rounded-xl border border-destructive/20 bg-destructive/[0.03] p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2"><Wrench size={17} className="text-destructive" /><h3 className="font-semibold text-foreground">{t('rahcomTrafficRepairList')}</h3><span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">{repairGroups.reduce((sum, [, rows]) => sum + rows.length, 0).toLocaleString('fa-IR')}</span></div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">{t('rahcomProvince')}<select value={repairProvince} onChange={(event) => setRepairProvince(event.target.value)} className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="">{t('rahcomTrafficAllProvinces')}</option>{repairGroups.map(([name]) => <option key={name} value={name}>{name}</option>)}</select></label>
          </div>
          {shownRepairGroups.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">{t('rahcomTrafficNoDownSystems')}</p> : <div className="space-y-2">{shownRepairGroups.map(([provinceName, rows]) => <details key={provinceName} className="group rounded-xl border border-border bg-card">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 font-semibold text-foreground"><span>{provinceName}</span><span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs text-destructive">{rows.length.toLocaleString('fa-IR')} {t('rahcomTrafficSolarDown')}</span></summary>
            <div className="overflow-x-auto border-t border-border"><table className="w-full min-w-[46rem] text-xs"><thead className="bg-muted/50"><tr><th className="p-3 text-start">{t('rahcomSystemCode')}</th><th className="p-3 text-start">{t('rahcomAxisCode')}</th><th className="p-3 text-start">{t('rahcomSystemName')}</th><th className="p-3 text-start">{t('rahcomAxis')}</th><th className="p-3 text-start">{t('rahcomTrafficImportedStatus')}</th><th className="p-3 text-start">{t('rahcomTrafficSolarStatus')}</th><th className="p-3 text-start">{t('rahcomActions')}</th></tr></thead><tbody>{rows.map(({ code, axisCode, row, system }, index) => <tr key={`${provinceName}:${code}:${index}`} className="border-t border-border"><td className="p-3 font-mono" dir="ltr">{code}</td><td className="p-3 font-mono" dir="ltr">{axisCode || '—'}</td><td className="p-3">{system?.systemName ?? '—'}</td><td className="p-3">{system?.axis ?? '—'}</td><td className="p-3 font-semibold text-destructive">{row[repairSolarIndex] || 'Down'}</td><td className="p-3">{statusForTrafficRow(row)}</td><td className="p-3">{canManage && system ? <button type="button" onClick={() => openRepairAction(system)} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-semibold text-primary-foreground"><Wrench size={14} />{t('rahcomTrafficLogRepair')}</button> : canManage && systemsIndexLoaded && !system ? <span className="text-muted-foreground">{t('rahcomTrafficSystemNotInRahcom')}</span> : '—'}</td></tr>)}</tbody></table></div>
          </details>)}</div>}
        </section>}

        {trafficLoading ? <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><LoaderCircle size={16} className="animate-spin" />{t('rahcomSystemsLoading')}</div> : trafficSnapshot ? <>
          <label className="relative block max-w-sm"><Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={trafficSearch} onChange={(event) => { setTrafficSearch(event.target.value); setTrafficPage(0); }} placeholder={t('rahcomTrafficSearch')} className="h-10 w-full rounded-lg border border-border bg-background ps-9 pe-3 text-sm text-foreground" /></label>
          <div className="max-h-[65vh] overflow-auto rounded-xl border border-border"><table className="min-w-max text-xs"><thead className="sticky top-0 bg-muted"><tr>{trafficSnapshot.headers.map((header, index) => <th key={`${header}:${index}`} className="max-w-64 whitespace-nowrap px-3 py-2 text-start font-semibold text-foreground">{normalizeHeader(header).includes('سولار') || normalizeHeader(header).includes('solar') ? t('rahcomTrafficImportedStatus') : header}</th>)}<th className="whitespace-nowrap px-3 py-2 text-start font-semibold text-foreground">{t('rahcomTrafficSolarStatus')}</th></tr></thead><tbody>{visibleTrafficRows.length === 0 ? <tr><td colSpan={trafficSnapshot.headers.length + 1} className="p-4 text-center text-muted-foreground">{t('rahcomTrafficNoMatches')}</td></tr> : visibleTrafficRows.map((row, rowIndex) => <tr key={`${trafficPage}:${rowIndex}`} className="border-t border-border hover:bg-accent/30">{trafficSnapshot.headers.map((_, columnIndex) => <td key={columnIndex} className="max-w-64 truncate whitespace-nowrap px-3 py-2 text-foreground">{row[columnIndex] || '—'}</td>)}<td className="max-w-64 whitespace-nowrap px-3 py-2 text-foreground">{statusForTrafficRow(row)}</td></tr>)}</tbody></table></div>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{filteredTrafficRows.length.toLocaleString('fa-IR')} {t('rahcomTrafficRows')}</span><div className="flex items-center gap-2"><button type="button" disabled={trafficPage <= 0} onClick={() => setTrafficPage((current) => Math.max(0, current - 1))} className="rounded-lg border border-border p-2 disabled:opacity-40" aria-label={t('rahcomPreviousPage')}><ChevronRight size={16} /></button><span>{(trafficPage + 1).toLocaleString('fa-IR')} / {trafficPageCount.toLocaleString('fa-IR')}</span><button type="button" disabled={trafficPage + 1 >= trafficPageCount} onClick={() => setTrafficPage((current) => Math.min(trafficPageCount - 1, current + 1))} className="rounded-lg border border-border p-2 disabled:opacity-40" aria-label={t('rahcomNextPage')}><ChevronLeft size={16} /></button></div></div>
        </> : !trafficError ? <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">{t('rahcomTrafficNoList')}</p> : null}
      </section>

      {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><LoaderCircle size={17} className="animate-spin" />{t('rahcomSystemsLoading')}</div> : items.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">{t('rahcomNoActivities')}</p> : (
          <ol className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm text-foreground">{t(item.activityType === 'EMAIL_SENT' ? 'rahcomEmailSent' : item.activityType === 'SYSTEM_VISIT' ? 'rahcomSystemVisit' : 'rahcomOther')}</strong>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{item.quantity.toLocaleString('fa-IR')}</span>
                  </div>
                  {(item.system?.systemName || item.systemNameSnapshot) && <p className="mt-1 text-sm text-foreground">{item.system?.systemName ?? item.systemNameSnapshot}</p>}
                  {item.description && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.description}</p>}
                </div>
                {item.performedBy && <span className="text-xs text-muted-foreground">{t('rahcomPerformedBy')}: {item.performedBy}</span>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
