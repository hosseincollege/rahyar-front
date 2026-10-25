'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { iranProvinces, rahcomApi, type RahcomSolarSnapshot, type RahcomSystem, type RahcomTrafficSnapshot } from '@/lib/api/rahcom/rahcom-api';
import { filterRahcomLtePairs, parseRahcomSolarList, tehranDateKey } from '@/lib/api/rahcom/solar-status';
import { useRahcomDate } from '@/app/(workspace)/rahcom/_shared/rahcom-date';
import { getCurrentUser } from '@/lib/api/shared/auth-api';

const normalize = (value: string) => value.trim().toLocaleLowerCase('fa').replace(/[\u200c\s_-]/g, '').replace(/[ي]/g, 'ی').replace(/[ك]/g, 'ک');
const has = (value: string, ...terms: string[]) => terms.some((term) => value.includes(term));
const defaultSolarEquipment = new Set(['LTE', 'RTR-1', 'CAM-1', 'RAD-1']);

export function RahcomAggregateList() {
  const { locale } = usePreferences();
  const { date } = useRahcomDate();
  const [systems, setSystems] = useState<RahcomSystem[]>([]);
  const [solar, setSolar] = useState<RahcomSolarSnapshot | null>(null);
  const [traffic, setTraffic] = useState<RahcomTrafficSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('isfahan');
  const [sortBy, setSortBy] = useState<'code' | 'name'>('code');
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
    Promise.all([rahcomApi.systems(), rahcomApi.solarSnapshots(), rahcomApi.trafficSnapshot()])
      .then(([systemRows, solarRows, trafficRow]) => {
        if (!active) return;
        const safeSystems = Array.isArray(systemRows) ? systemRows.filter(Boolean) : [];
        const safeSolarRows = Array.isArray(solarRows) ? solarRows.filter((item) => item && typeof item === 'object') : [];
        setSystems(safeSystems);
        setSolar([...safeSolarRows].filter((item) => item.capturedAt && tehranDateKey(item.capturedAt) === tehranDateKey(date ?? undefined)).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0] ?? null);
        setTraffic(trafficRow && typeof trafficRow === 'object' ? {
          ...trafficRow,
          headers: Array.isArray(trafficRow.headers) ? trafficRow.headers.map((header) => String(header ?? '')) : [],
          rows: Array.isArray(trafficRow.rows) ? trafficRow.rows.filter(Array.isArray).map((row) => row.map((cell) => String(cell ?? ''))) : [],
        } : null);
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : t('rahcomHistoryLoadError')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date]);

  const rows = useMemo(() => {
    const trafficHeaders = Array.isArray(traffic?.headers) ? traffic.headers.map((header) => normalize(String(header ?? ''))) : [];
    const codeIndex = trafficHeaders.findIndex((header) => has(header, 'کدسامانه', 'systemcode') || header === 'code');
    const nameIndex = trafficHeaders.findIndex((header) => has(header, 'نامسامانه', 'systemname'));
    const axisCodeIndex = trafficHeaders.findIndex((header) => has(header, 'کدمحور', 'axiscode'));
    const axisNameIndex = trafficHeaders.findIndex((header) => has(header, 'ناممحور', 'axisname'));
    const provinceIndex = trafficHeaders.findIndex((header) => has(header, 'استان', 'province'));
    const solarIndex = trafficHeaders.findIndex((header) => has(header, 'وضعیتسولار', 'سولار', 'solarstatus', 'solar'));
    const trafficIncidentIndex = trafficHeaders.findIndex((header) => has(header, 'سرقت', 'تخریب', 'تعریض', 'جابجایی', 'theft', 'damage', 'widening', 'relocation'));
    const provinceName = iranProvinces.find(([id]) => id === selectedProvince)?.[1] ?? selectedProvince;
    const belongsToProvince = (value: string) => normalize(value) === normalize(selectedProvince) || normalize(value).includes(normalize(provinceName));
    const systemByCode = new Map(systems.filter((system) => belongsToProvince(system.province)).map((system) => [normalize(system.systemCode), system]));
    const solarByCode = new Map<string, Set<string>>();
    const rawSolarEntries = solar ? [...parseRahcomSolarList(solar.downText ?? '', 'down'), ...parseRahcomSolarList(solar.unreachableText ?? '', 'unreachable')]
      .filter((entry) => defaultSolarEquipment.has(/^LTE-[12]$/i.test(entry.equipment) ? 'LTE' : entry.equipment.toUpperCase())) : [];
    const rawByCode = new Map<string, Set<string>>();
    for (const entry of rawSolarEntries) {
      const equipments = rawByCode.get(normalize(entry.site)) ?? new Set<string>();
      equipments.add(entry.equipment.toUpperCase());
      rawByCode.set(normalize(entry.site), equipments);
    }
    const singleLteOnlyCodes = new Set([...rawByCode.entries()]
      .filter(([, equipments]) => [...equipments].filter((equipment) => /^LTE-[12]$/.test(equipment)).length === 1 && [...equipments].every((equipment) => /^LTE-[12]$/.test(equipment)))
      .map(([code]) => code));
    for (const entry of filterRahcomLtePairs(rawSolarEntries)) {
      const equipment = solarByCode.get(normalize(entry.site)) ?? new Set<string>();
      equipment.add(`${entry.equipment}:${entry.state}`);
      solarByCode.set(normalize(entry.site), equipment);
    }
    const trafficByCode = new Map<string, string[]>();
    const trafficRowsByCode = new Map<string, string[]>();
    const trafficIncidentCodes = new Set<string>();
    if (traffic && codeIndex >= 0) for (const row of Array.isArray(traffic.rows) ? traffic.rows : []) {
      if (provinceIndex >= 0 && !belongsToProvince(row[provinceIndex] ?? '')) continue;
      const code = normalize(row[codeIndex] ?? '');
      if (!code) continue;
      if (!trafficRowsByCode.has(code)) trafficRowsByCode.set(code, row);
      if (trafficIncidentIndex >= 0 && row[trafficIncidentIndex]?.trim() && !/^(0|[-—–]|none|null|no incident|ندارد|نداشته|بدون\s*مورد)$/i.test(row[trafficIncidentIndex].trim())) trafficIncidentCodes.add(code);
      const status = solarIndex >= 0 ? normalize(row[solarIndex] ?? '') : '';
      if (!(status.includes('down') || status.includes('دان') || status.includes('قطع')) || singleLteOnlyCodes.has(code)) continue;
      if (!trafficByCode.has(code)) trafficByCode.set(code, row);
    }
    const systemIncidentCodes = [...systemByCode.entries()].filter(([, system]) => Boolean(system.incidentType || system.incidentDetails)).map(([code]) => code);
    const codes = new Set([...solarByCode.keys(), ...trafficByCode.keys(), ...(showTrafficIncidents ? trafficIncidentCodes : []), ...(showSystemIncidents ? systemIncidentCodes : [])].filter((code) => systemByCode.has(code) || trafficRowsByCode.has(code)));
    return [...codes].map((code) => {
      const system = systemByCode.get(code);
      const trafficRow = trafficRowsByCode.get(code);
      const systemIncident = system?.incidentType ? `${t(system.incidentType === 'THEFT' ? 'rahcomIncidentTheft' : system.incidentType === 'DAMAGE' ? 'rahcomIncidentDamage' : 'rahcomIncidentBoth')}${system.incidentDetails ? ` · ${system.incidentDetails}` : ''}` : system?.incidentDetails || '—';
      return { code, system, trafficRow, trafficSolarStatus: solarIndex >= 0 ? trafficRow?.[solarIndex]?.trim() || '' : '', equipment: [...(solarByCode.get(code) ?? [])], name: system?.systemName || (nameIndex >= 0 ? trafficRow?.[nameIndex] : '') || '—', axisCode: system?.axisCode || (axisCodeIndex >= 0 ? trafficRow?.[axisCodeIndex] : '') || '', axisName: (system?.axis || (axisNameIndex >= 0 ? trafficRow?.[axisNameIndex] : '') || '').replace(/^محور\s*/u, '').trim(), trafficIncident: trafficIncidentIndex >= 0 ? trafficRow?.[trafficIncidentIndex]?.trim() || '' : '', systemIncident };
    }).sort((a, b) => (sortBy === 'code' ? a.axisCode : a.axisName).localeCompare(sortBy === 'code' ? b.axisCode : b.axisName, locale, { numeric: true, sensitivity: 'base' }) || a.code.localeCompare(b.code));
  }, [locale, selectedProvince, showSystemIncidents, showTrafficIncidents, solar, sortBy, systems, traffic]);

  const included = (value: boolean) => <span className={value ? 'font-semibold text-primary' : 'text-muted-foreground'}>{value ? `✓ ${t('rahcomInList')}` : `— ${t('rahcomNotInList')}`}</span>;
  const tableColumnCount = 8 + Number(showTrafficIncidents) + Number(showSystemIncidents);
  return <section dir="auto" className="space-y-4">
    <p className="text-sm text-muted-foreground">{t('rahcomAggregateDescription')}</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap items-center gap-3 text-sm"><div className="inline-flex overflow-hidden rounded-lg border border-border" role="group"><button type="button" aria-pressed={sortBy === 'code'} onClick={() => setSortBy('code')} className={`px-3 py-1.5 ${sortBy === 'code' ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground'}`}>{t('rahcomAxisCode')}</button><button type="button" aria-pressed={sortBy === 'name'} onClick={() => setSortBy('name')} className={`border-s border-border px-3 py-1.5 ${sortBy === 'name' ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground'}`}>{t('rahcomAxisName')}</button></div><label className="inline-flex items-center gap-2"><input type="checkbox" checked={showTrafficIncidents} onChange={(event) => setShowTrafficIncidents(event.target.checked)} className="size-4 accent-primary" />{t('rahcomTrafficIncidentColumn')}</label><label className="inline-flex items-center gap-2"><input type="checkbox" checked={showSystemIncidents} onChange={(event) => setShowSystemIncidents(event.target.checked)} className="size-4 accent-primary" />{t('rahcomSystemIncidentColumn')}</label></div>
    <div className="overflow-x-auto rounded-2xl border border-border bg-card"><table className="w-full min-w-max text-sm"><thead className="bg-muted/50"><tr>
      {[t('rahcomRowNumber'), t('rahcomSystemCode'), t('rahcomSystemName'), t('rahcomAxisCode'), t('rahcomAxisName'), t('rahcomSolarDaily'), t('rahcomTrafficSolarStatus'), t('rahcomAggregateEquipment')].map((heading) => <th key={heading} className="p-3 text-start">{heading}</th>)}{showTrafficIncidents && <th className="p-3 text-start">{t('rahcomTrafficIncidentColumn')}</th>}{showSystemIncidents && <th className="p-3 text-start">{t('rahcomSystemIncidentColumn')}</th>}
    </tr></thead><tbody>{loading ? <tr><td colSpan={tableColumnCount} className="p-5 text-center text-muted-foreground">{t('rahcomSystemsLoading')}</td></tr> : rows.length === 0 ? <tr><td colSpan={tableColumnCount} className="p-5 text-center text-muted-foreground">{t('solarNoEntries')}</td></tr> : rows.map((row, index) => { const rawStatus = normalize(row.trafficSolarStatus); const isDown = rawStatus.includes('down') || rawStatus.includes('دان') || rawStatus.includes('قطع'); const hasTrafficIncident = Boolean(row.trafficIncident && !/^(0|[-—–]|none|null|no incident|ندارد|نداشته|بدون\s*مورد)$/i.test(row.trafficIncident)); return <tr key={row.code} className="border-t border-border"><td className="p-3 text-center tabular-nums">{(index + 1).toLocaleString(locale)}</td><td className="p-3 font-mono" dir="ltr">{row.code}</td><td className="p-3">{row.name}</td><td className="p-3 font-mono" dir="ltr">{row.axisCode || '—'}</td><td className="p-3">{row.axisName || '—'}</td><td className="p-3">{included(row.equipment.length > 0)}</td><td className={isDown ? 'font-semibold text-destructive' : 'text-primary'}>{rawStatus ? t(isDown ? 'solarStatusDown' : 'solarStatusNormal') : '—'}</td><td className="p-3" dir="ltr">{row.equipment.length ? row.equipment.map((item) => <span key={item} className="me-2 whitespace-nowrap">{item.replace(':down', ' 🔴').replace(':unreachable', ' ⚪')}</span>) : '—'}</td>{showTrafficIncidents && <td className={hasTrafficIncident ? 'font-semibold text-destructive' : 'text-muted-foreground'}>{hasTrafficIncident ? row.trafficIncident : '—'}</td>}{showSystemIncidents && <td>{row.systemIncident}</td>}</tr>; })}</tbody></table></div>
  </section>;
}
