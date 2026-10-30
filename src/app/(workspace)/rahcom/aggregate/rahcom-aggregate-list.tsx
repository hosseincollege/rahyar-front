'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { iranProvinces, rahcomApi, type RahcomImportedTicket, type RahcomSolarSnapshot, type RahcomSystem, type RahcomTrafficSnapshot } from '@/lib/api/rahcom/rahcom-api';
import { filterRahcomLtePairs, isRahcomIncidentValue, parseRahcomSolarList, tehranDateKey, latestRahcomSolarSnapshotsByProvince } from '@/lib/api/rahcom/solar-status';
import { useRahcomDate } from '@/app/(workspace)/rahcom/_shared/rahcom-date';
import { getCurrentUser } from '@/lib/api/shared/auth-api';

const normalize = (value: string) => value.trim().toLocaleLowerCase('fa').replace(/[\u200c\s_-]/g, '').replace(/[ي]/g, 'ی').replace(/[ك]/g, 'ک');
const has = (value: string, ...terms: string[]) => terms.some((term) => value.includes(term));
const defaultSolarEquipment = new Set(['LTE', 'RTR-1', 'CAM-1', 'RAD-1']);

export function RahcomAggregateList() {
  const { locale } = usePreferences();
  const { date } = useRahcomDate();
  const [systems, setSystems] = useState<RahcomSystem[]>([]);
  const [solar, setSolar] = useState<RahcomSolarSnapshot[]>([]);
  const [traffic, setTraffic] = useState<RahcomTrafficSnapshot | null>(null);
  const [tickets, setTickets] = useState<RahcomImportedTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('isfahan');
  const [sortBy, setSortBy] = useState<'code' | 'name'>('code');
  const [setOperation, setSetOperation] = useState<'union' | 'intersection'>('union');
  const [showTrafficIncidents, setShowTrafficIncidents] = useState(true);
  const [showSystemIncidents, setShowSystemIncidents] = useState(true);
  const t = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);

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
    Promise.all([rahcomApi.systems(selectedProvince), rahcomApi.solarSnapshots(selectedProvince), rahcomApi.trafficSnapshot(selectedProvince), rahcomApi.importedTickets(selectedProvince)])
      .then(([systemRows, solarRows, trafficRow, ticketRows]) => {
        if (!active) return;
        const safeSystems = Array.isArray(systemRows) ? systemRows.filter(Boolean) : [];
        const safeSolarRows = Array.isArray(solarRows) ? solarRows.filter((item) => item && typeof item === 'object') : [];
        setSystems(safeSystems);
        setTickets(Array.isArray(ticketRows) ? ticketRows.filter(Boolean) : []);
        setSolar(latestRahcomSolarSnapshotsByProvince(safeSolarRows, tehranDateKey(date ?? undefined)));
        setTraffic(trafficRow && typeof trafficRow === 'object' ? {
          ...trafficRow,
          headers: Array.isArray(trafficRow.headers) ? trafficRow.headers.map((header) => String(header ?? '')) : [],
          rows: Array.isArray(trafficRow.rows) ? trafficRow.rows.filter(Array.isArray).map((row) => row.map((cell) => String(cell ?? ''))) : [],
        } : null);
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : t('rahcomHistoryLoadError')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date, selectedProvince]);

  const { rows, incidentCounts } = useMemo(() => {
    const trafficHeaders = Array.isArray(traffic?.headers) ? traffic.headers.map((header) => normalize(String(header ?? ''))) : [];
    const codeIndex = trafficHeaders.findIndex((header) => has(header, 'کدسامانه', 'systemcode') || header === 'code');
    const nameIndex = trafficHeaders.findIndex((header) => has(header, 'نامسامانه', 'systemname'));
    const axisCodeIndex = trafficHeaders.findIndex((header) => has(header, 'کدمحور', 'axiscode'));
    const axisNameIndex = trafficHeaders.findIndex((header) => has(header, 'ناممحور', 'axisname'));
    const provinceIndex = trafficHeaders.findIndex((header) => has(header, 'استان', 'province'));
    const solarIndex = trafficHeaders.findIndex((header) => has(header, 'وضعیتسولار', 'سولار', 'solarstatus', 'solar'));
    const trafficIncidentIndexes = trafficHeaders.flatMap((header, index) => has(header, 'سرقت', 'تخریب', 'تعریض', 'جابجایی', 'theft', 'damage', 'widening', 'relocation') ? [index] : []);
    const provinceName = iranProvinces.find(([id]) => id === selectedProvince)?.[1] ?? selectedProvince;
    const belongsToProvince = (value: string) => selectedProvince === 'all' || normalize(value) === normalize(selectedProvince) || normalize(value).includes(normalize(provinceName));
    const systemKey = (province: string, code: string) => `${province}:${normalize(code)}`;
    const systemByCode = new Map(systems.filter((system) => belongsToProvince(system.province)).map((system) => [systemKey(system.province, system.systemCode), system]));
    const keysByCode = new Map<string, string[]>();
    for (const [key, system] of systemByCode) keysByCode.set(normalize(system.systemCode), [...(keysByCode.get(normalize(system.systemCode)) ?? []), key]);
    const resolveKey = (code: string, province?: string | null) => {
      if (province) {
        const id = iranProvinces.find(([id, label]) => normalize(id) === normalize(province) || normalize(label) === normalize(province.replace(/^استان\s*/, '')))?.[0];
        const key = id ? systemKey(id, code) : '';
        return systemByCode.has(key) ? key : '';
      }
      const candidates = keysByCode.get(normalize(code)) ?? [];
      return candidates.length === 1 ? candidates[0] : '';
    };
    const solarByCode = new Map<string, Set<string>>();
    for (const snapshot of solar) {
      const entries = filterRahcomLtePairs([...parseRahcomSolarList(snapshot.downText ?? '', 'down'), ...parseRahcomSolarList(snapshot.unreachableText ?? '', 'unreachable')]
        .filter((entry) => defaultSolarEquipment.has(/^LTE-[12]$/i.test(entry.equipment) ? 'LTE' : entry.equipment.toUpperCase())));
      for (const entry of entries) {
        const key = resolveKey(entry.site, snapshot.province ?? entry.province);
        if (!key) continue;
        const equipment = solarByCode.get(key) ?? new Set<string>();
        equipment.add(`${entry.equipment}:${entry.state}`);
        solarByCode.set(key, equipment);
      }
    }
    const trafficRowsByCode = new Map<string, string[]>();
    const trafficListCodes = new Set<string>();
    const trafficIncidentCodes = new Set<string>();
    if (traffic && codeIndex >= 0) for (const row of Array.isArray(traffic.rows) ? traffic.rows : []) {
      if (provinceIndex >= 0 && !belongsToProvince(row[provinceIndex] ?? '')) continue;
      const code = resolveKey(row[codeIndex] ?? '', provinceIndex >= 0 ? row[provinceIndex] : null);
      if (!code) continue;
      // Use the system registry as the authoritative province boundary when the
      // imported traffic sheet has no recognizable province column.
      if (!systemByCode.has(code)) continue;
      if (!trafficRowsByCode.has(code)) trafficRowsByCode.set(code, row);
      trafficListCodes.add(code);
      if (trafficIncidentIndexes.some((index) => isRahcomIncidentValue(row[index]))) trafficIncidentCodes.add(code);
    }
    const ticketCountByCode = new Map<string, number>();
    for (const ticket of tickets) {
      if (ticket.province && selectedProvince !== 'all' && ticket.province !== selectedProvince) continue;
      const code = resolveKey(ticket.systemCode || '', ticket.province);
      if (code && systemByCode.has(code)) ticketCountByCode.set(code, (ticketCountByCode.get(code) ?? 0) + 1);
    }
    const solarListCodes = new Set([...solarByCode.keys()].filter((code) => systemByCode.has(code)));
    const ticketListCodes = new Set(ticketCountByCode.keys());
    const sourceCodes = [trafficListCodes, solarListCodes, ticketListCodes];
    const systemIncidentCodes = [...systemByCode.entries()].filter(([, system]) => Boolean(system.incidentType || isRahcomIncidentValue(system.incidentDetails))).map(([code]) => code);
    const codes = new Set((setOperation === 'union'
      ? sourceCodes.flatMap((source) => [...source])
      : [...sourceCodes[0]].filter((code) => sourceCodes.every((source) => source.has(code))))
      .filter((code) => {
        if (!systemByCode.has(code)) return false;
        // Keep the incident controls available for the extra detail columns.
        if (!showTrafficIncidents && trafficIncidentCodes.has(code)) return false;
        if (!showSystemIncidents && systemIncidentCodes.includes(code)) return false;
        return true;
      }));
    const resultRows = [...codes].map((code) => {
      const system = systemByCode.get(code);
      const trafficRow = trafficRowsByCode.get(code);
      const systemIncident = system?.incidentType ? `${t(system.incidentType === 'THEFT' ? 'rahcomIncidentTheft' : system.incidentType === 'DAMAGE' ? 'rahcomIncidentDamage' : 'rahcomIncidentBoth')}${system.incidentDetails ? ` · ${system.incidentDetails}` : ''}` : system?.incidentDetails || '—';
      return { key: code, code: system?.systemCode ?? code, system, trafficRow, inTrafficList: trafficListCodes.has(code), inSolarList: solarListCodes.has(code), ticketCount: ticketCountByCode.get(code) ?? 0, trafficSolarStatus: solarIndex >= 0 ? trafficRow?.[solarIndex]?.trim() || '' : '', equipment: [...(solarByCode.get(code) ?? [])], name: system?.systemName || (nameIndex >= 0 ? trafficRow?.[nameIndex] : '') || '—', axisCode: system?.axisCode || (axisCodeIndex >= 0 ? trafficRow?.[axisCodeIndex] : '') || '', axisName: (system?.axis || (axisNameIndex >= 0 ? trafficRow?.[axisNameIndex] : '') || '').replace(/^محور\s*/u, '').trim(), trafficIncident: trafficIncidentIndexes.flatMap((index) => { const value = trafficRow?.[index]?.trim() ?? ''; return isRahcomIncidentValue(value) ? [value] : []; }).join(' · '), systemIncident };
    }).sort((a, b) => (sortBy === 'code' ? a.axisCode : a.axisName).localeCompare(sortBy === 'code' ? b.axisCode : b.axisName, locale, { numeric: true, sensitivity: 'base' }) || a.code.localeCompare(b.code));
    return { rows: resultRows, incidentCounts: { traffic: trafficIncidentCodes.size, systems: new Set(systemIncidentCodes).size } };
  }, [locale, selectedProvince, setOperation, showSystemIncidents, showTrafficIncidents, solar, sortBy, systems, tickets, traffic]);

  const included = (value: boolean) => <span className={value ? 'font-semibold text-primary' : 'text-muted-foreground'}>{value ? `✓ ${t('rahcomInList')}` : `— ${t('rahcomNotInList')}`}</span>;
  const tableColumnCount = 11 + Number(showTrafficIncidents) + Number(showSystemIncidents);
  return <section dir="auto" className="space-y-4">
    <p className="text-sm text-muted-foreground">{t('rahcomAggregateDescription')}</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap items-center gap-3 text-sm"><div className="inline-flex overflow-hidden rounded-lg border border-border" role="group" aria-label={t('rahcomAggregateOperation')}><button type="button" aria-pressed={setOperation === 'union'} onClick={() => setSetOperation('union')} className={`px-3 py-1.5 ${setOperation === 'union' ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground'}`}>{t('rahcomAggregateUnion')}</button><button type="button" aria-pressed={setOperation === 'intersection'} onClick={() => setSetOperation('intersection')} className={`border-s border-border px-3 py-1.5 ${setOperation === 'intersection' ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground'}`}>{t('rahcomAggregateIntersection')}</button></div><div className="inline-flex overflow-hidden rounded-lg border border-border" role="group"><button type="button" aria-pressed={sortBy === 'code'} onClick={() => setSortBy('code')} className={`px-3 py-1.5 ${sortBy === 'code' ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground'}`}>{t('rahcomAxisCode')}</button><button type="button" aria-pressed={sortBy === 'name'} onClick={() => setSortBy('name')} className={`border-s border-border px-3 py-1.5 ${sortBy === 'name' ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground'}`}>{t('rahcomAxisName')}</button></div><label className="inline-flex items-center gap-2"><input type="checkbox" checked={showTrafficIncidents} onChange={(event) => setShowTrafficIncidents(event.target.checked)} className="size-4 accent-primary" />{t('rahcomTrafficIncidentColumn')} ({new Intl.NumberFormat(locale).format(incidentCounts.traffic)})</label><label className="inline-flex items-center gap-2"><input type="checkbox" checked={showSystemIncidents} onChange={(event) => setShowSystemIncidents(event.target.checked)} className="size-4 accent-primary" />{t('rahcomSystemIncidentColumn')} ({new Intl.NumberFormat(locale).format(incidentCounts.systems)})</label></div>
    <div className="overflow-x-auto rounded-2xl border border-border bg-card"><table className="w-full min-w-max text-sm"><thead className="bg-muted/50"><tr>
      {[t('rahcomRowNumber'), t('rahcomSystemCode'), t('rahcomProvince'), t('rahcomSystemName'), t('rahcomAxisCode'), t('rahcomAxisName'), t('rahcomDailyTraffic'), t('rahcomSolarDaily'), t('rahcomTickets'), t('rahcomTrafficSolarStatus'), t('rahcomAggregateEquipment')].map((heading) => <th key={heading} className="p-3 text-start">{heading}</th>)}{showTrafficIncidents && <th className="p-3 text-start">{t('rahcomTrafficIncidentColumn')}</th>}{showSystemIncidents && <th className="p-3 text-start">{t('rahcomSystemIncidentColumn')}</th>}
    </tr></thead><tbody>{loading ? <tr><td colSpan={tableColumnCount} className="p-5 text-center text-muted-foreground">{t('rahcomSystemsLoading')}</td></tr> : rows.length === 0 ? <tr><td colSpan={tableColumnCount} className="p-5 text-center text-muted-foreground">{t('solarNoEntries')}</td></tr> : rows.map((row, index) => { const rawStatus = normalize(row.trafficSolarStatus); const isDown = rawStatus.includes('down') || rawStatus.includes('دان') || rawStatus.includes('قطع'); const hasTrafficIncident = Boolean(row.trafficIncident && !/^(0|[-—–]|none|null|no incident|ندارد|نداشته|بدون\s*مورد)$/i.test(row.trafficIncident)); return <tr key={row.key} className="border-t border-border"><td className="p-3 text-center tabular-nums">{(index + 1).toLocaleString(locale)}</td><td className="p-3 font-mono" dir="ltr">{row.code}</td><td className="p-3">{iranProvinces.find(([id]) => id === row.system?.province)?.[1] ?? row.system?.province}</td><td className="p-3">{row.name}</td><td className="p-3 font-mono" dir="ltr">{row.axisCode || '—'}</td><td className="p-3">{row.axisName || '—'}</td><td className="p-3">{included(row.inTrafficList)}</td><td className="p-3">{included(row.inSolarList)}</td><td className="p-3">{row.ticketCount ? new Intl.NumberFormat(locale).format(row.ticketCount) : '—'}</td><td className={isDown ? 'font-semibold text-destructive' : 'text-primary'}>{rawStatus ? t(isDown ? 'solarStatusDown' : 'solarStatusNormal') : '—'}</td><td className="p-3" dir="ltr">{row.equipment.length ? row.equipment.map((item) => { const [equipment, state] = item.split(':'); return <span key={item} className="me-3 inline-flex items-center gap-1.5 whitespace-nowrap"><bdi>{equipment}</bdi><i className={`size-3 rounded-full ${state === 'down' ? 'bg-red-600' : 'bg-gray-400'}`} title={state === 'down' ? t('solarStatusDown') : t('solarStatusUnreachable')} /></span>; }) : '—'}</td>{showTrafficIncidents && <td className={hasTrafficIncident ? 'font-semibold text-destructive' : 'text-muted-foreground'}>{hasTrafficIncident ? row.trafficIncident : '—'}</td>}{showSystemIncidents && <td>{row.systemIncident}</td>}</tr>; })}</tbody></table></div>
  </section>;
}
