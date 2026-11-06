'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { iranProvinces, rahcomApi, type RahcomImportedTicket, type RahcomRoadListSnapshot, type RahcomSolarSnapshot, type RahcomSystem, type RahcomTrafficSnapshot } from '@/lib/api/rahcom/rahcom-api';
import { filterRahcomLtePairs, isRahcomIncidentValue, parseRahcomSolarList, tehranDateKey, latestRahcomSolarSnapshotsByProvince, rahcomTicketDateKey } from '@/lib/api/rahcom/solar-status';
import { useRahcomDate } from '@/app/(workspace)/rahcom/_shared/rahcom-date';
import { rahcomZoneForSystem } from '@/lib/api/rahcom/rahcom-axes';

const normalize = (value: string) => value.trim().toLocaleLowerCase('fa').replace(/[\u200c\s_-]/g, '').replace(/[ي]/g, 'ی').replace(/[ك]/g, 'ک');
const has = (value: string, ...terms: string[]) => terms.some((term) => value.includes(term));
const defaultSolarEquipment = new Set(['LTE', 'RTR-1', 'CAM-1', 'RAD-1']);

type AxisSource = 'traffic' | 'zones';
type AggregateSources = { traffic: boolean; road: boolean; solar: boolean; tickets: boolean };

export function RahcomAggregateList({ onSystemCountChange, selectedProvince, axisSource, showIncidents, setOperation, sources }: { onSystemCountChange: (count: number) => void; selectedProvince: string; axisSource: AxisSource; showIncidents: boolean; setOperation: 'union' | 'intersection'; sources: AggregateSources }) {
  const { locale } = usePreferences();
  const { date } = useRahcomDate();
  const [systems, setSystems] = useState<RahcomSystem[]>([]);
  const [solar, setSolar] = useState<RahcomSolarSnapshot[]>([]);
  const [traffic, setTraffic] = useState<RahcomTrafficSnapshot | null>(null);
  const [roadList, setRoadList] = useState<RahcomRoadListSnapshot | null>(null);
  const [tickets, setTickets] = useState<RahcomImportedTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const t = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([rahcomApi.systems(selectedProvince), rahcomApi.solarSnapshots(selectedProvince, date ?? undefined), rahcomApi.trafficSnapshot(selectedProvince, date ?? undefined), rahcomApi.importedTickets(selectedProvince, date ?? undefined), selectedProvince === 'all' ? Promise.resolve(null) : rahcomApi.roadList(selectedProvince, date ?? tehranDateKey())])
      .then(([systemRows, solarRows, trafficRow, ticketRows, roadRow]) => {
        if (!active) return;
        const safeSystems = Array.isArray(systemRows) ? systemRows.filter(Boolean) : [];
        const safeSolarRows = Array.isArray(solarRows) ? solarRows.filter((item) => item && typeof item === 'object') : [];
        setSystems(safeSystems);
        setTickets(Array.isArray(ticketRows) ? ticketRows.filter((ticket) => ticket && rahcomTicketDateKey(ticket.createdOn, ticket.importedAt) === tehranDateKey(date ?? undefined)) : []);
        setRoadList(roadRow && typeof roadRow === 'object' ? roadRow : null);
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

  const rows = useMemo(() => {
    const trafficHeaders = Array.isArray(traffic?.headers) ? traffic.headers.map((header) => normalize(String(header ?? ''))) : [];
    const codeIndex = trafficHeaders.findIndex((header) => has(header, 'کدسامانه', 'systemcode') || header === 'code');
    const nameIndex = trafficHeaders.findIndex((header) => has(header, 'نامسامانه', 'systemname'));
    const axisCodeIndex = trafficHeaders.findIndex((header) => has(header, 'کدمحور', 'axiscode'));
    const axisNameIndex = trafficHeaders.findIndex((header) => has(header, 'ناممحور', 'axisname'));
    const provinceIndex = trafficHeaders.findIndex((header) => has(header, 'استان', 'province'));
    const trafficIncidentIndexes = trafficHeaders.flatMap((header, index) => has(header, 'سرقت', 'تخریب', 'تعریض', 'جابجایی', 'theft', 'damage', 'widening', 'relocation') ? [index] : []);
    const provinceName = iranProvinces.find(([id]) => id === selectedProvince)?.[1] ?? selectedProvince;
    const normalizeTrafficText = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa').replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) >= 0x06f0 ? digit.charCodeAt(0) - 0x06f0 : digit.charCodeAt(0) - 0x0660)).replace(/[\u200c\s]/g, '');
    const crmIndex = traffic?.headers?.findIndex((header) => { const key = normalizeTrafficText(header); return key.includes('crm') && (key.includes(normalizeTrafficText('\u062a\u0631\u062f\u062f')) || key.includes('traffic')) && (key.includes(normalizeTrafficText('\u0644\u062d\u0638\u0647\u0627\u06cc')) || key.includes('realtime') || key.includes('real-time')); }) ?? -1;
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
    const trafficNoRealtimeCodes = new Set<string>();
    const roadListCodes = new Set<string>();
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
      const crmValue = normalizeTrafficText(crmIndex >= 0 ? row[crmIndex] ?? '' : '');
      if (crmIndex >= 0 && (crmValue.includes(normalizeTrafficText('\u0628\u062f\u0648\u0646 \u062a\u0631\u062f\u062f')) || crmValue.includes('notraffic') || crmValue.includes('norealtime'))) trafficNoRealtimeCodes.add(code);
      if (trafficIncidentIndexes.some((index) => isRahcomIncidentValue(row[index]))) trafficIncidentCodes.add(code);
    }
    const ticketCountByCode = new Map<string, number>();
    const ticketTitlesByCode = new Map<string, string[]>();
    for (const ticket of tickets) {
      if (ticket.province && selectedProvince !== 'all' && ticket.province !== selectedProvince) continue;
      const code = resolveKey(ticket.systemCode || '', ticket.province);
      if (code && systemByCode.has(code)) {
        ticketCountByCode.set(code, (ticketCountByCode.get(code) ?? 0) + 1);
        const titles = ticketTitlesByCode.get(code) ?? [];
        const title = ticket.summary?.trim() || ticket.ticketCode?.trim();
        if (title && !titles.includes(title)) titles.push(title);
        ticketTitlesByCode.set(code, titles);
      }
    }
    const solarListCodes = new Set([...solarByCode.keys()].filter((code) => systemByCode.has(code)));
    const ticketListCodes = new Set(ticketCountByCode.keys());
    const roadHeaders = Array.isArray(roadList?.headers) ? roadList.headers.map((header) => normalize(String(header ?? ''))) : [];
    const stationCodeIndex = roadHeaders.findIndex((header) => header.includes('stationcode') || header.includes('stationid') || header.includes('کدایستگاه') || header.includes('کدتجمیع'));
    const roadActivityIndex = roadHeaders.findIndex((header) => header.includes('activity') || header.includes('\u0641\u0639\u0627\u0644\u06cc\u062a'));
    const trafficAggregationIndex = trafficHeaders.findIndex((header) => header.includes('aggregationcode') || header.includes('aggregatecode') || header.includes('کدتجمیع'));
    const roadActivityByCode = new Map<string, string>();
    if (roadList && traffic && stationCodeIndex >= 0 && trafficAggregationIndex >= 0 && codeIndex >= 0) {
      const keysByAggregationCode = new Map<string, string>();
      for (const row of traffic.rows ?? []) {
        const aggregateCode = normalize(row[trafficAggregationIndex] ?? '');
        const key = resolveKey(row[codeIndex] ?? '', provinceIndex >= 0 ? row[provinceIndex] : null);
        if (aggregateCode && key && !keysByAggregationCode.has(aggregateCode)) keysByAggregationCode.set(aggregateCode, key);
      }
      for (const row of Array.isArray(roadList.rows) ? roadList.rows : []) {
        const key = keysByAggregationCode.get(normalize(row[stationCodeIndex] ?? ''));
        if (key) {
          roadListCodes.add(key);
          if (roadActivityIndex >= 0) roadActivityByCode.set(key, row[roadActivityIndex]?.trim() ?? '');
        }
      }
    }
    const allSourceCodes = { traffic: trafficListCodes, road: roadListCodes, solar: solarListCodes, tickets: ticketListCodes };
    const sourceCodes = (Object.keys(allSourceCodes) as Array<keyof AggregateSources>).filter((source) => sources[source]).map((source) => allSourceCodes[source]);
    const codes = new Set((sourceCodes.length === 0 ? [] : setOperation === 'union'
      ? sourceCodes.flatMap((source) => [...source])
      : [...sourceCodes[0]].filter((code) => sourceCodes.every((source) => source.has(code))))
      .filter((code) => {
        if (!systemByCode.has(code)) return false;
        if (!showIncidents && trafficIncidentCodes.has(code)) return false;
        return true;
      }));
    const resultRows = [...codes].map((code) => {
      const system = systemByCode.get(code);
      const trafficRow = trafficRowsByCode.get(code);
            const axisCode = system?.axisCode || (axisCodeIndex >= 0 ? trafficRow?.[axisCodeIndex] : '') || '';
      const trafficAxisName = (system?.announcedAxis || (axisNameIndex >= 0 ? trafficRow?.[axisNameIndex] : '') || '').replace(/^محور\s*/u, '').trim();
      const axisName = axisSource === 'traffic' ? trafficAxisName : rahcomZoneForSystem(system ?? {});
      return { key: code, code: system?.systemCode ?? code, system, trafficRow, trafficNoRealtime: trafficNoRealtimeCodes.has(code), roadActivity: roadActivityByCode.get(code) ?? '', solarEquipment: [...(solarByCode.get(code) ?? [])], ticketTitles: ticketTitlesByCode.get(code) ?? [], name: system?.systemName || (nameIndex >= 0 ? trafficRow?.[nameIndex] : '') || '\u2014', axisCode, axisName };
    }).sort((a, b) => a.axisName.localeCompare(b.axisName, locale, { numeric: true, sensitivity: 'base' }) || a.code.localeCompare(b.code));
    return resultRows;
  }, [axisSource, locale, roadList, selectedProvince, setOperation, showIncidents, sources, solar, systems, tickets, traffic]);

  const tableColumnCount = 6 + Number(sources.traffic) + Number(sources.road) + Number(sources.solar) + Number(sources.tickets);
  useEffect(() => { onSystemCountChange(rows.length); }, [onSystemCountChange, rows.length]);
  return <section dir="auto" className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
    {error && <p role="alert" className="shrink-0 text-sm text-destructive">{error}</p>}
    <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-card"><table className="rahcom-sticky-table w-full min-w-max text-sm"><thead className="bg-muted/50"><tr>
      <th className="p-3 text-start">{t('rahcomRowNumber')}</th><th className="p-3 text-start">{t('rahcomSystemCode')}</th><th className="p-3 text-start">{t('rahcomProvince')}</th><th className="p-3 text-start">{t('rahcomSystemName')}</th><th className="p-3 text-start">{t('rahcomAxisCode')}</th><th className="p-3 text-start">{t(axisSource === 'zones' ? 'rahcomZoneAxisColumn' : 'rahcomAxisName')}</th>
      {sources.traffic && <th className="p-3 text-start">{locale === 'fa' ? '\u062a\u0631\u062f\u062f \u0644\u062d\u0638\u0647\u0627\u06cc CRM' : t('rahcomDailyTraffic')}</th>}{sources.road && <th className="p-3 text-start">{t('rahcomRoadList')}</th>}{sources.tickets && <th className="p-3 text-start">{t('rahcomTickets')}</th>}{sources.solar && <th className="p-3 text-start">{t('rahcomSystemSolar')}</th>}
    </tr></thead><tbody>{loading ? <tr><td colSpan={tableColumnCount} className="p-5 text-center text-muted-foreground">{t('rahcomSystemsLoading')}</td></tr> : rows.length === 0 ? <tr><td colSpan={tableColumnCount} className="p-5 text-center text-muted-foreground">{t('solarNoEntries')}</td></tr> : rows.map((row, index) => <tr key={row.key} className="border-t border-border"><td className="p-3 text-center tabular-nums">{(index + 1).toLocaleString(locale)}</td><td className="p-3 font-mono" dir="ltr">{row.code}</td><td className="p-3">{iranProvinces.find(([id]) => id === row.system?.province)?.[1] ?? row.system?.province}</td><td className="p-3">{row.name}</td><td className="p-3 font-mono" dir="ltr">{row.axisCode || '\u2014'}</td><td className="p-3">{row.axisName || '\u2014'}</td>{sources.traffic && <td className="p-3">{row.trafficNoRealtime ? locale === 'fa' ? '\u0628\u062f\u0648\u0646 \u062a\u0631\u062f\u062f' : t('rahcomTrafficNoRealtimeTraffic') : '\u2014'}</td>}{sources.road && <td className="p-3">{row.roadActivity || '\u2014'}</td>}{sources.tickets && <td className="max-w-72 p-3">{row.ticketTitles.length ? row.ticketTitles.join(' \u00b7 ') : '\u2014'}</td>}{sources.solar && <td className="p-3">{row.solarEquipment.length ? <span className="inline-flex flex-nowrap items-center gap-3 whitespace-nowrap" dir="ltr">{row.solarEquipment.map((item) => { const [equipment, state] = item.split(':'); const statusLabel = t(state === 'down' ? 'solarStatusDown' : 'solarStatusUnreachable'); return <span key={item} className="inline-flex items-center gap-1.5" title={`${equipment}: ${statusLabel}`} aria-label={`${equipment}: ${statusLabel}`}><bdi className="font-mono text-xs">{equipment}</bdi><span className={`inline-block size-3 rounded-full ${state === 'down' ? 'bg-red-600' : 'bg-gray-400'}`} /></span>; })}</span> : '\u2014'}</td>}</tr>)}</tbody></table></div>
  </section>;
}
