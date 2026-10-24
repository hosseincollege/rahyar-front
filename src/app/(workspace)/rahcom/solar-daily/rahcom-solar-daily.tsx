'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, LoaderCircle, Save } from 'lucide-react';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { rahcomApi, type RahcomSolarSnapshot, type RahcomSystem, type RahcomTrafficSnapshot } from '@/lib/api/rahcom/rahcom-api';
import { filterRahcomLtePairs, parseRahcomSolarList as parseList, type RahcomSolarEntry as Entry } from '@/lib/api/rahcom/solar-status';
import { useRahcomDate } from '@/app/(workspace)/rahcom/_shared/rahcom-date';

const commonEquipment = ['LTE', 'RTR-1', 'RTR-2', 'CAM-1', 'RAD-1', 'RAD-2', 'PC', 'RLY', 'RLY-1', 'WL-1', 'WLP2P'];
const defaultEquipment = ['LTE', 'RTR-1', 'CAM-1', 'RAD-1'];

function jalaliParts(date: Date) {
  const values = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(date);
  return Object.fromEntries(values.map(({ type, value }) => [type, value]));
}

function currentJalaliDateTime() {
  const now = new Date();
  const dateParts = jalaliParts(now);
  const timeParts = new Intl.DateTimeFormat('en-u-ca-gregory-nu-latn', {
    timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const time = Object.fromEntries(timeParts.map(({ type, value }) => [type, value]));
  const pad = (value: string) => value.padStart(2, '0');
  return { date: `${dateParts.year}/${pad(dateParts.month)}/${pad(dateParts.day)}`, time: `${time.hour}:${time.minute}` };
}

function toAsciiDigits(value: string) {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) >= 0x06f0 && digit.charCodeAt(0) <= 0x06f9 ? digit.charCodeAt(0) - 0x06f0 + 48 : digit.charCodeAt(0) - 0x0660 + 48));
}

function jalaliToGregorian(jalaliDate: string) {
  const match = toAsciiDigits(jalaliDate.trim()).match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return null;
  const target = match.slice(1).map(Number);
  const cursor = new Date(Date.UTC(target[0] + 621, 0, 1, 12));
  for (let offset = 0; offset < 370; offset += 1) {
    const parts = jalaliParts(cursor);
    if ([Number(parts.year), Number(parts.month), Number(parts.day)].every((part, index) => part === target[index])) {
      return { year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1, day: cursor.getUTCDate() };
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return null;
}

function captureTimestamp(dateValue: string, timeValue: string) {
  const gregorian = jalaliToGregorian(dateValue);
  const time = toAsciiDigits(timeValue).match(/^(\d{2}):(\d{2})$/);
  if (!gregorian || !time) return null;
  const [hour, minute] = time.slice(1).map(Number);
  if (hour > 23 || minute > 59) return null;
  const wallClockAsUtc = Date.UTC(gregorian.year, gregorian.month - 1, gregorian.day, hour, minute);
  const parts = new Intl.DateTimeFormat('en-US-u-nu-latn', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(wallClockAsUtc));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const representedAsUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute));
  return new Date(wallClockAsUtc - (representedAsUtc - wallClockAsUtc)).toISOString();
}

function StatusTable({ entries, columns, locale, systems = [], traffic = null, snapshots = [], currentSnapshot }: { entries: Entry[]; columns: string[]; locale: Parameters<typeof uiMessage>[0]; systems?: RahcomSystem[]; traffic?: RahcomTrafficSnapshot | null; snapshots?: RahcomSolarSnapshot[]; currentSnapshot?: RahcomSolarSnapshot }) {
  const [showTrafficIncidents, setShowTrafficIncidents] = useState(false);
  const [showSystemIncidents, setShowSystemIncidents] = useState(false);
  const [sortBy, setSortBy] = useState<'code' | 'name'>('code');
  const t = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const normalize = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa')
    .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c_\-./()]/g, '');
  const headers = traffic?.headers ?? [];
  const findHeader = (predicate: (normalized: string) => boolean) => headers.findIndex((header) => predicate(normalize(header)));
  const codeIndex = findHeader((header) => header.includes('\u06a9\u062f\u0633\u0627\u0645\u0627\u0646\u0647') || header.includes('systemcode'));
  const axisCodeIndex = findHeader((header) => header.includes('\u06a9\u062f\u0645\u062d\u0648\u0631') || header.includes('axiscode'));
  const axisNameIndex = findHeader((header) => header.includes('\u0646\u0627\u0645\u0645\u062d\u0648\u0631') || header.includes('axisname'));
  const systemNameIndex = findHeader((header) => header.includes('\u0646\u0627\u0645\u0633\u0627\u0645\u0627\u0646\u0647') || header.includes('systemname'));
  const stationNameIndex = findHeader((header) => header.includes('\u0646\u0627\u0645\u0627\u06cc\u0633\u062a\u06af\u0627\u0647') || header.includes('stationname'));
  const incidentIndex = findHeader((header) => header.includes('\u0633\u0631\u0642\u062a') || header.includes('\u062a\u062e\u0631\u06cc\u0628') || header.includes('\u062a\u0639\u0631\u06cc\u0636') || header.includes('\u062c\u0627\u0628\u062c\u0627\u06cc\u06cc') || header.includes('theft') || header.includes('damage') || header.includes('widening') || header.includes('relocation'));
  const outageIndex = findHeader((header) => header.includes('\u0631\u0648\u0632\u0642\u0637\u0639\u06cc') || header.includes('\u062a\u0639\u062f\u0627\u062f\u0631\u0648\u0632\u0642\u0637\u0639\u06cc') || header.includes('outagedays'));
  const solarIndex = findHeader((header) => header.includes('\u0633\u0648\u0644\u0627\u0631') || header.includes('solar'));
  const systemsByCode = new Map(systems.map((system) => [system.systemCode.trim().toUpperCase(), system]));
  const trafficRowsByCode = new Map((traffic?.rows ?? []).map((row) => [codeIndex < 0 ? '' : (row[codeIndex] ?? '').trim().toUpperCase(), row]));
  const selectedColumns = new Set(columns.map((column) => column.toUpperCase()));
  const validEntries = filterRahcomLtePairs(entries);
  const displayedEntries = validEntries.filter((entry) => selectedColumns.has(entry.equipment.toUpperCase()) || (selectedColumns.has('LTE') && /^LTE-[12]$/i.test(entry.equipment)));
  const solarSites = displayedEntries.map((entry) => entry.site.toUpperCase());
  const incidentSites = new Set<string>();
  if (showTrafficIncidents && incidentIndex >= 0 && codeIndex >= 0) {
    for (const row of traffic?.rows ?? []) {
      const code = (row[codeIndex] ?? '').trim().toUpperCase();
      const incident = row[incidentIndex]?.trim() ?? '';
      if (code && incident && !/^(0|[-—–]|none|null|no incident|ندارد|نداشته|بدون\s*مورد)$/i.test(incident)) incidentSites.add(code);
    }
  }
  if (showSystemIncidents) {
    for (const system of systems) if (system.incidentType || system.incidentDetails) incidentSites.add(system.systemCode.trim().toUpperCase());
  }
  const sites = [...new Set([...solarSites, ...incidentSites])].sort();
  const bySiteEquipment = new Map(validEntries.map((entry) => [`${entry.site.toUpperCase()}:${entry.equipment.toUpperCase()}`, entry.state]));
  const fixedEquipment = ['LTE', 'LTE-1', 'LTE-2', 'RTR-1', 'RTR-2', 'CAM-1', 'RAD-1', 'RAD-2'];
  const extraEquipment = [...selectedColumns].filter((item) => !fixedEquipment.includes(item)).sort((a, b) => a.localeCompare(b));
  const selectedRouters = ['RTR-1', 'RTR-2'].filter((equipment) => selectedColumns.has(equipment));
  const selectedRadars = ['RAD-1', 'RAD-2'].filter((equipment) => selectedColumns.has(equipment));
  const equipmentGroups = [
    ...(selectedColumns.has('LTE') ? [{ label: 'LTE', equipment: ['LTE-1', 'LTE-2'] }] : []),
    ...(selectedRouters.length ? [{ label: `${t('solarRouter')} (${selectedRouters.join('/')})`, equipment: selectedRouters }] : []),
    ...(selectedColumns.has('CAM-1') ? [{ label: `${t('solarCamera')} (CAM-1)`, equipment: ['CAM-1'] }] : []),
    ...(selectedRadars.length ? [{ label: `${t('solarRadar')} (${selectedRadars.join('/')})`, equipment: selectedRadars }] : []),
    ...extraEquipment.map((equipment) => ({ label: equipment, equipment: [equipment] })),
  ];
  const displayedEquipmentCodes = [...new Set(equipmentGroups.flatMap((group) => group.equipment.map((equipment) => equipment.toUpperCase())))];
  const recordRows = sites.map((site) => {
    const system = systemsByCode.get(site) ?? null;
    const trafficRow = trafficRowsByCode.get(site);
    const axisCode = system?.axisCode?.trim() || (axisCodeIndex >= 0 ? trafficRow?.[axisCodeIndex]?.trim() : '') || '';
    const axisName = (system?.axis?.trim() || (axisNameIndex >= 0 ? trafficRow?.[axisNameIndex]?.trim() : '') || '').replace(/^محور\s*/u, '').trim();
    const groupKey = axisCode || '__no_axis__';
    return { site, system, trafficRow, axisCode, axisName, groupKey };
  });
  const sortedRows = [...recordRows].sort((left, right) => (sortBy === 'code' ? left.axisCode : left.axisName).localeCompare(sortBy === 'code' ? right.axisCode : right.axisName, locale, { numeric: true, sensitivity: 'base' }) || left.site.localeCompare(right.site, 'en', { numeric: true, sensitivity: 'base' }));
  const chronologicalSnapshots = [...snapshots].sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
  const currentSnapshotIndex = currentSnapshot ? chronologicalSnapshots.findIndex((snapshot) => snapshot.id === currentSnapshot.id) : chronologicalSnapshots.length;
  const previousSnapshot = currentSnapshotIndex > 0 ? chronologicalSnapshots[currentSnapshotIndex - 1] : null;
  const previousStatesBySite = new Map<string, Map<string, 'down' | 'unreachable'>>();
  if (previousSnapshot) {
    for (const entry of filterRahcomLtePairs([...parseList(previousSnapshot.downText, 'down'), ...parseList(previousSnapshot.unreachableText, 'unreachable')])) {
      const siteStates = previousStatesBySite.get(entry.site.toUpperCase()) ?? new Map<string, 'down' | 'unreachable'>();
      siteStates.set(entry.equipment.toUpperCase(), entry.state);
      previousStatesBySite.set(entry.site.toUpperCase(), siteStates);
    }
  }
  const statusText = (state: 'normal' | 'down' | 'unreachable') => t(state === 'down' ? 'solarStatusDown' : state === 'unreachable' ? 'solarStatusUnreachable' : 'solarStatusNormal');
  const columnCount = 8 + equipmentGroups.length + Number(showTrafficIncidents) + Number(showSystemIncidents);
  let nextRowNumber = 0;
  const numberedRows = sortedRows.map((row) => ({ ...row, rowNumber: ++nextRowNumber }));
  return <div className="space-y-3"><div className="flex flex-wrap items-center gap-3 text-sm"><div className="inline-flex overflow-hidden rounded-lg border border-border" role="group"><button type="button" aria-pressed={sortBy === 'code'} onClick={() => setSortBy('code')} className={`px-3 py-1.5 ${sortBy === 'code' ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground'}`}>{t('rahcomAxisCode')}</button><button type="button" aria-pressed={sortBy === 'name'} onClick={() => setSortBy('name')} className={`border-s border-border px-3 py-1.5 ${sortBy === 'name' ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground'}`}>{t('rahcomAxisName')}</button></div><label className="inline-flex items-center gap-2"><input type="checkbox" checked={showTrafficIncidents} onChange={(event) => setShowTrafficIncidents(event.target.checked)} className="size-4 accent-primary" />{t('rahcomTrafficIncidentColumn')}</label><label className="inline-flex items-center gap-2"><input type="checkbox" checked={showSystemIncidents} onChange={(event) => setShowSystemIncidents(event.target.checked)} className="size-4 accent-primary" />{t('rahcomSystemIncidentColumn')}</label></div><div className="overflow-x-auto rounded-2xl border border-border bg-card"><table className="w-full min-w-max text-sm"><thead className="bg-muted/50"><tr>
    <th className="p-3 text-center">{t('rahcomRowNumber')}</th><th className="p-3 text-start">{t('rahcomSystemCode')}</th><th className="p-3 text-start">{t('rahcomSystemName')}</th><th className="p-3 text-start">{t('rahcomAxisCode')}</th><th className="p-3 text-start">{t('rahcomAxisName')}</th>
    {equipmentGroups.map((group) => <th key={group.equipment.join('|')} className="whitespace-nowrap p-3 text-center" dir="ltr">{group.label}</th>)}
    {showTrafficIncidents && <th className="p-3 text-start">{t('rahcomTrafficIncidentColumn')}</th>}{showSystemIncidents && <th className="p-3 text-start">{t('rahcomSystemIncidentColumn')}</th>}<th className="p-3 text-start">{t('rahcomOutageDaysColumn')}</th><th className="p-3 text-start">{t('rahcomTrafficSolarStatus')}</th><th className="p-3 text-start">{t('solarHistory')}</th>
  </tr></thead><tbody>{sites.length === 0 ? <tr><td colSpan={columnCount} className="p-4 text-center text-muted-foreground">{t('solarNoEntries')}</td></tr> : numberedRows.map(({ site, system, trafficRow, axisCode, axisName, rowNumber }) => {
      const trafficIncident = incidentIndex >= 0 ? trafficRow?.[incidentIndex]?.trim() : '';
      const hasTrafficIncident = Boolean(trafficIncident && !/^(0|[-—–]|none|null|no incident|ندارد|نداشته|بدون\s*مورد)$/i.test(trafficIncident));
      const systemIncident = system?.incidentType ? `${t(system.incidentType === 'THEFT' ? 'rahcomIncidentTheft' : system.incidentType === 'DAMAGE' ? 'rahcomIncidentDamage' : 'rahcomIncidentBoth')}${system.incidentDetails ? ` · ${system.incidentDetails}` : ''}` : system?.incidentDetails || '—';
      const previousSiteStates = previousStatesBySite.get(site);
      const historyChanges = displayedEquipmentCodes.reduce<{ equipment: string; from: 'normal' | 'down' | 'unreachable' | null; to: 'normal' | 'down' | 'unreachable' }[]>((changes, equipment) => {
        const currentState = bySiteEquipment.get(`${site}:${equipment}`) ?? 'normal';
        const previousState = previousSiteStates?.get(equipment) ?? 'normal';
        if (previousSnapshot && previousState !== currentState) changes.push({ equipment, from: previousState, to: currentState });
        else if (!previousSnapshot && currentState !== 'normal') changes.push({ equipment, from: null, to: currentState });
        return changes;
      }, []);
      return <tr key={site} className="border-t border-border hover:bg-muted/20"><td className="p-3 text-center tabular-nums">{rowNumber.toLocaleString(locale)}</td><td className="p-3 font-mono" dir="ltr">{site}</td><td className="p-3">{system?.systemName || (systemNameIndex >= 0 ? trafficRow?.[systemNameIndex] : '') || (stationNameIndex >= 0 ? trafficRow?.[stationNameIndex] : '') || '—'}</td><td className="p-3 font-mono" dir="ltr">{axisCode || '—'}</td><td className="p-3">{axisName || '—'}</td>
      {equipmentGroups.map((group) => <td key={group.equipment.join('|')} className="whitespace-nowrap p-3 text-center">{group.equipment.length === 2 && group.equipment.every((equipment) => /^LTE-[12]$/i.test(equipment)) && !group.equipment.every((equipment) => bySiteEquipment.has(`${site}:${equipment}`)) ? '—' : group.equipment.map((equipment, equipmentIndex) => { const state = bySiteEquipment.get(`${site}:${equipment}`) ?? 'normal'; return <span key={equipment} className={`inline-flex items-center ${equipmentIndex ? 'ms-2' : ''} gap-1.5`} dir="auto"><bdi dir="ltr">{equipment}</bdi><span title={statusText(state)} aria-label={statusText(state)}>{state === 'normal' ? '—' : <span className={`inline-block size-3 rounded-full ${state === 'down' ? 'bg-red-600' : 'bg-gray-400'}`} />}</span></span>; })}</td>)}
      {showTrafficIncidents && <td className={`max-w-56 whitespace-nowrap p-3 ${hasTrafficIncident ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>{hasTrafficIncident ? trafficIncident : '—'}</td>}{showSystemIncidents && <td className="max-w-64 whitespace-nowrap p-3">{systemIncident}</td>}<td className="p-3 text-center tabular-nums">{(outageIndex >= 0 ? trafficRow?.[outageIndex]?.trim() : '') || '—'}</td><td className="p-3 whitespace-nowrap">{solarIndex >= 0 ? trafficRow?.[solarIndex]?.trim() || '—' : '—'}</td><td className="max-w-72 p-3 text-xs"><time className="mb-1 block text-[11px] text-muted-foreground">{currentSnapshot ? formatCapturedAt(currentSnapshot.capturedAt, locale) : t('solarHistory')}</time>{historyChanges.length === 0 ? <span className="text-muted-foreground">{previousSnapshot ? t('solarNoChanges') : '—'}</span> : <div className="flex flex-col gap-1">{historyChanges.map(({ equipment, from, to }) => <span key={equipment} dir="auto"><bdi dir="ltr">{equipment}</bdi>: {from ? `${statusText(from)} → ` : ''}{statusText(to)}</span>)}</div>}</td></tr>;
  })}</tbody></table></div></div>;
}

function formatCapturedAt(value: string, locale: Parameters<typeof uiMessage>[0]) {
  return new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR-u-ca-persian' : locale, {
    dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23', timeZone: 'Asia/Tehran',
  }).format(new Date(value));
}

export function RahcomSolarDaily({ formOpen, onFormOpenChange }: { formOpen: boolean; onFormOpenChange: (open: boolean) => void }) {
  const { locale } = usePreferences();
  const { dateText } = useRahcomDate();
  const [downText, setDownText] = useState('');
  const [unreachableText, setUnreachableText] = useState('');
  const [capturedDate, setCapturedDate] = useState('');
  const [capturedTime, setCapturedTime] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(defaultEquipment);
  const [editingColumns, setEditingColumns] = useState(false);
  const [customEquipment, setCustomEquipment] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<RahcomSolarSnapshot[]>([]);
  const [systems, setSystems] = useState<RahcomSystem[]>([]);
  const [trafficSnapshot, setTrafficSnapshot] = useState<RahcomTrafficSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const entries = useMemo(() => [...parseList(downText, 'down'), ...parseList(unreachableText, 'unreachable')], [downText, unreachableText]);
  const columns = useMemo(() => [...commonEquipment, ...[...customEquipment].sort()].filter((item) => selectedEquipment.includes(item)), [customEquipment, selectedEquipment]);
  const t = useCallback((key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key), [locale]);

  useEffect(() => {
    if (formOpen) {
      const current = currentJalaliDateTime();
      setCapturedDate(dateText);
      setCapturedTime(current.time);
    }
  }, [dateText, formOpen]);
  useEffect(() => {
    let active = true;
    void Promise.all([rahcomApi.solarSnapshots(), rahcomApi.systems(), rahcomApi.trafficSnapshot()]).then(([solar, systemRows, traffic]) => { if (active) { setSnapshots(solar); setSystems(systemRows); setTrafficSnapshot(traffic); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : t('solarLoadFailed')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [t]);
  useEffect(() => {
    const found = [...new Set(entries.map((entry) => entry.equipment))]
      .filter((item) => !/^LTE-[12]$/i.test(item) && !commonEquipment.includes(item) && !customEquipment.includes(item));
    if (found.length) {
      setCustomEquipment((current) => [...current, ...found]);
      setSelectedEquipment((current) => [...new Set([...current, ...found])]);
    }
  }, [customEquipment, entries]);

  async function saveSnapshot() {
    if (!downText.trim() && !unreachableText.trim()) { setError(t('solarPasteListsFirst')); return; }
    if (columns.length === 0) { setError(t('solarSelectEquipment')); return; }
    const capturedAt = captureTimestamp(capturedDate, capturedTime);
    if (!capturedAt) { setError(t('solarInvalidDateTime')); return; }
    setSaving(true); setError('');
    try {
      const snapshot = await rahcomApi.createSolarSnapshot({
        downText, unreachableText, equipmentColumns: columns,
        capturedAt,
      });
      setSnapshots((current) => [snapshot, ...current]);
      setDownText('');
      setUnreachableText('');
      onFormOpenChange(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('solarSaveFailed'));
    } finally { setSaving(false); }
  }

  return <section className="space-y-5">
    {formOpen && <>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="space-y-2 rounded-2xl border border-border bg-card p-4"><span className="block font-semibold">{t('solarDownList')}</span><textarea value={downText} onChange={(e) => setDownText(e.target.value)} placeholder={'DOWN\nRahcom (LTE-1-...) (...) (...)'} className="min-h-48 w-full rounded-xl border border-border bg-background p-3 font-mono text-sm" dir="auto" /></label>
      <label className="space-y-2 rounded-2xl border border-border bg-card p-4"><span className="block font-semibold">{t('solarUnreachableList')}</span><textarea value={unreachableText} onChange={(e) => setUnreachableText(e.target.value)} placeholder={'Unreachable\nRahcom (CAM-1-...) (...) (...)'} className="min-h-48 w-full rounded-xl border border-border bg-background p-3 font-mono text-sm" dir="auto" /></label>
    </div>

    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{t('solarVisibleColumns')}</h2><button type="button" onClick={() => setEditingColumns((open) => !open)} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground">{t(editingColumns ? 'solarDoneEditingColumns' : 'solarEditColumns')}</button></div>{editingColumns && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">{[...commonEquipment, ...[...customEquipment].sort()].map((item) => <label key={item} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={selectedEquipment.includes(item)} onChange={(event) => setSelectedEquipment((current) => event.target.checked ? [...current, item] : current.filter((value) => value !== item))} />{item}</label>)}</div>}</div>
      <div className="flex flex-wrap items-end gap-3"><span className="self-center text-xs text-muted-foreground">{t('solarCaptureDate')}: {capturedDate}</span><label className="grid gap-1 text-xs text-muted-foreground">{t('solarCaptureTime')}<input type="text" inputMode="numeric" dir="ltr" placeholder="23:59" maxLength={5} value={capturedTime} onChange={(event) => setCapturedTime(event.target.value)} className="h-10 w-28 rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label><button type="button" disabled={saving} onClick={() => void saveSnapshot()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}{t('solarSaveSnapshot')}</button></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>

    {entries.length > 0 && <div className="space-y-2"><h2 className="font-semibold">{t('solarPreview')}</h2><StatusTable entries={entries} columns={columns} locale={locale} systems={systems} traffic={trafficSnapshot} snapshots={snapshots} /></div>}
    </>}

    <div className="space-y-3"><h2 className="text-lg font-bold">{t('solarHistory')}</h2>{loading ? <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">{t('rahcomSystemsLoading')}</p> : snapshots.length === 0 ? <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">{t('solarNoSnapshots')}</p> : snapshots.map((snapshot) => {
      const columns = snapshot.equipmentColumns.map((column) => /^LTE-[12]$/i.test(column) ? 'LTE' : column).filter((column, columnIndex, all) => all.indexOf(column) === columnIndex);
      const entries = [...parseList(snapshot.downText, 'down'), ...parseList(snapshot.unreachableText, 'unreachable')];
      return <details key={snapshot.id} className="group rounded-2xl border border-border bg-card p-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold"><span className="flex items-center gap-2"><Check size={16} className="text-primary" />{formatCapturedAt(snapshot.capturedAt, locale)}</span><span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">{t('solarExpandSnapshot')}<ChevronDown size={16} className="transition-transform group-open:rotate-180" /></span></summary><div className="mt-4 space-y-4"><StatusTable entries={entries} columns={columns} locale={locale} systems={systems} traffic={trafficSnapshot} snapshots={snapshots} currentSnapshot={snapshot} /></div></details>;
    })}</div>
  </section>;
}
