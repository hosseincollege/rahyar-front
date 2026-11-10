'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { Check, ClipboardCopy, ClipboardList, Copy, Download, ExternalLink, LoaderCircle, MapPin, MapPinned, Pencil, Rows3, Save, Search, Trash2, TriangleAlert, Upload, X } from 'lucide-react';
import { usePreferences } from '@/components/preferences-provider';
import { RahcomSystemHistory } from '@/app/(workspace)/rahcom/_shared/rahcom-system-history';
import { formatRahcomCoordinates, iranProvinces, rahcomApi, type RahcomSystem } from '@/lib/api/rahcom/rahcom-api';
import type { RahcomTrafficSnapshot } from '@/lib/api/rahcom/rahcom-api';
import { isRahcomIncidentValue, rahcomProvinceFromLabel } from '@/lib/api/rahcom/solar-status';
import { uiMessage } from '@/lib/ui-messages';
import { useRahcomDate } from '@/app/(workspace)/rahcom/_shared/rahcom-date';
import { RahcomRecordSummary } from '@/app/(workspace)/rahcom/_shared/rahcom-record-summary';
import { tehranDateKey } from '@/lib/api/rahcom/solar-status';

function provinceName(provinceId: string) {
  return iranProvinces.find(([id]) => id === provinceId)?.[1] ?? provinceId;
}

const outageReasons = [
  ['THEFT_DAMAGE', 'سرقت و تخریب'], ['RELOCATION', 'جابجایی یا تعریض'],
  ['ELECTRICITY_DEBT', 'بدهی قبض برق'], ['PAYMENT_ARREARS', 'معوقات پرداخت'],
  ['POWER_OUTAGE', 'قطعی برق'], ['OTHER', 'سایر'],
] as const;
function outageReasonLabel(reason: RahcomSystem['longOutageReason']) {
  return outageReasons.find(([value]) => value === reason)?.[1] ?? '';
}

function routeUrl(provider: 'google' | 'neshan' | 'balad', system: RahcomSystem) {
  const lat = system.latitude;
  const lng = system.longitude;
  if (provider === 'google') {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  if (provider === 'neshan') {
    return `https://nshn.ir/?destination=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  return `https://balad.ir/directions/driving?destination=${encodeURIComponent(`${lng},${lat}`)}#16/${lat}/${lng}`;
}

export function RahcomSystemsList({ canManage = false, selectedProvince = 'all' }: { canManage?: boolean; selectedProvince?: string }) {
  const { locale } = usePreferences();
  const { date } = useRahcomDate();
  const [systems, setSystems] = useState<RahcomSystem[]>([]);
  const [trafficSnapshot, setTrafficSnapshot] = useState<RahcomTrafficSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [showTrafficLongOutage, setShowTrafficLongOutage] = useState(false);
  const [routeSystem, setRouteSystem] = useState<RahcomSystem | null>(null);
  const [historySystem, setHistorySystem] = useState<RahcomSystem | null>(null);
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  const [editingSystemId, setEditingSystemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Pick<RahcomSystem, 'systemName' | 'systemCode' | 'latitude' | 'longitude' | 'details' | 'electricityBillId' | 'simIp' | 'radarIp' | 'cameraIp' | 'pcIp' | 'routerIp' | 'laptopIp' | 'incidentType' | 'incidentDetails' | 'longOutage' | 'longOutageReason' | 'longOutageDetails'> | null>(null);
  const [editingOutageId, setEditingOutageId] = useState<string | null>(null);
  const [outageDraft, setOutageDraft] = useState<{ reason: RahcomSystem['longOutageReason']; details: string }>({ reason: null, details: '' });
  const [savingSystem, setSavingSystem] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');
  const copyResetTimer = useRef<number | null>(null);
  const [systemsRevision, setSystemsRevision] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const t = useCallback((key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key), [locale]);
  const canEditSystems = canManage && selectedProvince !== 'isfahan';

  useEffect(() => {
    const onSearch = (event: Event) => {
      setQuery((event as CustomEvent<{ query?: string }>).detail?.query || '');
    };
    window.addEventListener('rahyar:systems-search', onSearch);
    return () => window.removeEventListener('rahyar:systems-search', onSearch);
  }, []);

  useEffect(() => {
    const onSystemsChanged = () => setSystemsRevision((revision) => revision + 1);
    window.addEventListener('rahyar:systems-changed', onSystemsChanged);
    return () => window.removeEventListener('rahyar:systems-changed', onSystemsChanged);
  }, []);

  useEffect(() => {
    const openFocusedSystem = () => {
      const systemId = window.sessionStorage.getItem('rahyar-rahcom-focus-system');
      if (!systemId) return;
      const system = systems.find((item) => item.id === systemId);
      if (!system) return;
      setQuery(system.systemCode);
      setSelectedSystemId(system.id);
      window.sessionStorage.removeItem('rahyar-rahcom-focus-system');
    };
    openFocusedSystem();
    window.addEventListener('rahyar:open-system-details', openFocusedSystem);
    return () => window.removeEventListener('rahyar:open-system-details', openFocusedSystem);
  }, [systems]);

  useEffect(() => {
    let active = true;
    rahcomApi.systems(selectedProvince)
      .then((result) => { if (active) { setSystems(result); setError(''); } })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : t('rahcomSystemsLoadError'));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedProvince, systemsRevision, t]);

  useEffect(() => {
    let active = true;
    const load = () => { void rahcomApi.trafficSnapshot(selectedProvince, date ?? undefined).then((snapshot) => { if (active) setTrafficSnapshot(snapshot); }).catch(() => { if (active) setTrafficSnapshot(null); }); };
    load();
    window.addEventListener('rahyar:traffic-snapshot-changed', load);
    return () => { active = false; window.removeEventListener('rahyar:traffic-snapshot-changed', load); };
  }, [date, selectedProvince, systemsRevision]);

  useEffect(() => {
    if (!routeSystem) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setRouteSystem(null); };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [routeSystem]);

  const groups = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    const grouped = new Map<string, { label: string; rows: RahcomSystem[] }>();
    for (const system of systems) {
      const axis = [system.axisCode, system.announcedAxis].filter(Boolean).join(' · ');
      const label = axis || t('rahcomNoAxis');
      const axisCode = system.axisCode || '';
      const key = `${system.province}:${axisCode || label}`;
      const provinceLabel = provinceName(system.province);
      const searchable = [provinceLabel, system.province, label, axis, system.announcedAxis, system.axisCode, system.systemName, system.systemCode, system.details, system.incidentType, system.incidentDetails, system.electricityBillId, system.simIp, system.radarIp, system.cameraIp, system.pcIp, system.routerIp, system.laptopIp, system.latitude, system.longitude]
        .filter(Boolean).join(' ').toLocaleLowerCase(locale);
      if (normalizedQuery && !searchable.includes(normalizedQuery)) continue;
      const group = grouped.get(key) ?? { label: selectedProvince === 'all' ? `${provinceLabel} · ${label}` : label, rows: [] };
      group.rows.push(system);
      grouped.set(key, group);
    }
    return [...grouped.entries()].map(([key, value]) => [key, value.label, value.rows] as const).sort((a, b) => a[1].localeCompare(b[1], locale, { numeric: true, sensitivity: 'base' }));
  }, [locale, query, selectedProvince, systems, t]);

  async function copyValue(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      if (copyResetTimer.current) window.clearTimeout(copyResetTimer.current);
      copyResetTimer.current = window.setTimeout(() => setCopiedKey((current) => current === key ? '' : current), 1800);
    } catch {
      setError(t('rahcomCopyFailed'));
    }
  }

  async function uploadSystemsFile(file?: File) {
    if (!file) return;
    if (!selectedProvince || selectedProvince === 'all') { setError(t('rahcomProvince')); return; }
    setUploadBusy(true);
    setError('');
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error(t('rahcomDataUploadHint'));
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = firstSheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' }) : [];
      const normalize = (value: unknown) => String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c_\-./()]/g, '');
      const aliases: Record<string, string> = {
        name: 'systemName', systemname: 'systemName', stationname: 'systemName', [normalize('\u0646\u0627\u0645 \u0633\u0627\u0645\u0627\u0646\u0647')]: 'systemName', [normalize('\u0646\u0627\u0645 \u0627\u06cc\u0633\u062a\u06af\u0627\u0647')]: 'systemName',
        code: 'systemCode', systemcode: 'systemCode', sitecode: 'systemCode', stationcode: 'systemCode', id: 'systemCode', [normalize('\u06a9\u062f \u0633\u0627\u0645\u0627\u0646\u0647')]: 'systemCode', [normalize('\u06a9\u062f \u0627\u06cc\u0633\u062a\u06af\u0627\u0647')]: 'systemCode',
        latitude: 'latitude', lat: 'latitude', [normalize('\u0639\u0631\u0636')]: 'latitude', [normalize('\u0639\u0631\u0636 \u062c\u063a\u0631\u0627\u0641\u06cc\u0627\u06cc\u06cc')]: 'latitude', longitude: 'longitude', long: 'longitude', lng: 'longitude', lon: 'longitude', [normalize('\u0637\u0648\u0644')]: 'longitude', [normalize('\u0637\u0648\u0644 \u062c\u063a\u0631\u0627\u0641\u06cc\u0627\u06cc\u06cc')]: 'longitude',
        axis: 'announcedAxis', route: 'announcedAxis', announcedaxis: 'announcedAxis', [normalize('\u0645\u062d\u0648\u0631')]: 'announcedAxis', axiscode: 'axisCode', [normalize('\u06a9\u062f \u0645\u062d\u0648\u0631')]: 'axisCode',
        electricitybillid: 'electricityBillId', simip: 'simIp', radarip: 'radarIp', cameraip: 'cameraIp', pcip: 'pcIp', routerip: 'routerIp', laptopip: 'laptopIp',
        longoutage: 'longOutage', [normalize(t('rahcomIncidentFilter'))]: 'longOutage',
        longoutagereason: 'longOutageReason', outagecause: 'longOutageReason', [normalize('دلیل قطعی زمان‌بر')]: 'longOutageReason',
        longoutagedetails: 'longOutageDetails',
        [normalize('توضیحات دلیل')]: 'longOutageDetails',
        details: 'details', description: 'details', [normalize('\u062a\u0648\u0636\u06cc\u062d\u0627\u062a')]: 'details',
      };
      const seenCodes = new Set<string>();
      const parsed = rows.flatMap((row) => {
        const values: Record<string, unknown> = {};
        Object.entries(row).forEach(([header, value]) => { const key = aliases[normalize(header)]; if (key) values[key] = value; });
        const systemCode = String(values.systemCode ?? '').trim();
        const systemName = String(values.systemName ?? '').trim() || systemCode;
        const toNumber = (value: unknown) => String(value ?? '').replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) >= 0x06f0 ? digit.charCodeAt(0) - 0x06f0 : digit.charCodeAt(0) - 0x0660)).replace(/[\u066b]/g, '.').trim();
        const latitudeText = toNumber(values.latitude);
        const longitudeText = toNumber(values.longitude);
        const latitude = Number(latitudeText);
        const longitude = Number(longitudeText);
        const longOutage = typeof values.longOutage === 'boolean' ? values.longOutage : /^(true|1|yes|بله|آری)$/i.test(String(values.longOutage ?? '').trim());
        const rawOutageReason = String(values.longOutageReason ?? '').trim();
        const outageReason = outageReasons.find(([value, label]) => value === rawOutageReason || normalize(label) === normalize(rawOutageReason))?.[0] ?? null;
        const outageDetails = String(values.longOutageDetails ?? '').trim();
        const normalizedCode = systemCode.normalize('NFKC').trim().toUpperCase();
        if (!systemName || !normalizedCode || seenCodes.has(normalizedCode) || !latitudeText || !longitudeText || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return [];
        seenCodes.add(normalizedCode);
        return [{ systemName, systemCode, latitude, longitude, longOutage: longOutage || Boolean(outageReason), longOutageReason: outageReason, longOutageDetails: outageDetails, announcedAxis: String(values.announcedAxis ?? '').trim(), axisCode: String(values.axisCode ?? '').trim(), details: String(values.details ?? '').trim(), electricityBillId: String(values.electricityBillId ?? '').trim(), simIp: String(values.simIp ?? '').trim(), radarIp: String(values.radarIp ?? '').trim(), cameraIp: String(values.cameraIp ?? '').trim(), pcIp: String(values.pcIp ?? '').trim(), routerIp: String(values.routerIp ?? '').trim(), laptopIp: String(values.laptopIp ?? '').trim() }];
      });
      if (!parsed.length) throw new Error(t('rahcomDataUploadHint'));
      await rahcomApi.importSystems(selectedProvince, parsed);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('rahcomSystemsLoadError'));
    } finally { setUploadBusy(false); }
  }

  function downloadSystems() {
    const rowData = new Map(systemRows.map(({ system, stationName, aggregationCode }) => [system.id, { stationName, aggregationCode }]));
    const rows = systems.map((system) => ({
      [t('rahcomSystemCode')]: system.systemCode,
      [t('rahcomSystemName')]: system.systemName,
      [t('rahcomStationName')]: rowData.get(system.id)?.stationName ?? '',
      [t('rahcomAggregationCode')]: rowData.get(system.id)?.aggregationCode ?? '',
      ['قطعی‌های زمان‌بر']: system.longOutageReason ?? '',
      ['توضیحات دلیل']: system.longOutageDetails ?? '',
      [t('rahcomAxisCode')]: system.axisCode ?? '',
      [t('rahcomAxisName')]: system.announcedAxis ?? '',
      [t('rahcomLatitude')]: system.latitude,
      [t('rahcomLongitude')]: system.longitude,
      [t('rahcomProvince')]: provinceName(system.province),
      [t('rahcomBillId')]: system.electricityBillId ?? '',
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), t('rahcomSystemsList').slice(0, 31));
    XLSX.writeFile(workbook, `rahcom-systems-${selectedProvince}.xlsx`);
  }

  function startEdit(system: RahcomSystem) {
    setSelectedSystemId(system.id);
    setEditingSystemId(system.id);
    setEditForm({ systemName: system.systemName, systemCode: system.systemCode, latitude: system.latitude, longitude: system.longitude, details: system.details ?? '', electricityBillId: system.electricityBillId ?? '', simIp: system.simIp ?? '', radarIp: system.radarIp ?? '', cameraIp: system.cameraIp ?? '', pcIp: system.pcIp ?? '', routerIp: system.routerIp ?? '', laptopIp: system.laptopIp ?? '', incidentType: system.incidentType, incidentDetails: system.incidentDetails ?? '', longOutage: system.longOutage, longOutageReason: system.longOutageReason ?? null, longOutageDetails: system.longOutageDetails ?? '' });
  }

  async function saveOutageReason(system: RahcomSystem) {
    const patch = { longOutage: Boolean(outageDraft.reason), longOutageReason: outageDraft.reason, longOutageDetails: outageDraft.reason === 'OTHER' ? outageDraft.details.trim() : '' };
    setSavingSystem(true);
    try {
      if (system.province === 'isfahan') {
        await rahcomApi.importSystems('isfahan', [{ ...system, ...patch }]);
      } else {
        await rahcomApi.updateSystem(system.id, patch);
      }
      setEditingOutageId(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('rahcomSystemUpdateFailed')); }
    finally { setSavingSystem(false); }
  }

  function openOutageEditor(system: RahcomSystem) {
    setSelectedSystemId(null);
    setEditingOutageId(system.id);
    setOutageDraft({ reason: system.longOutageReason ?? null, details: system.longOutageDetails ?? '' });
  }

  async function saveEdit(systemId: string) {
    if (!editForm) return;
    setSavingSystem(true);
    try { await rahcomApi.updateSystem(systemId, editForm); setEditingSystemId(null); setEditForm(null); setSelectedSystemId(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('rahcomSystemUpdateFailed')); }
    finally { setSavingSystem(false); }
  }

  async function removeSystem(system: RahcomSystem) {
    if (!window.confirm(`${t('rahcomDeleteConfirm')} ${system.systemName}`)) return;
    try {
      await rahcomApi.deleteSystem(system.id);
      setSelectedSystemId(null);
      setEditingSystemId(null);
      setEditForm(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('rahcomSystemDeleteFailed')); }
  }

  const anyRows = groups.some(([, , rows]) => rows.length > 0);
  const trafficLongOutageByCode = useMemo(() => {
    const result = new Map<string, string>();
    if (!trafficSnapshot) return result;
    const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase('fa').replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c_./-]/g, '');
    const headers = trafficSnapshot.headers ?? [];
    const codeIndex = headers.findIndex((value) => ['کدسامانه', 'systemcode'].some((alias) => normalize(value).includes(normalize(alias))));
    const provinceIndex = headers.findIndex((value) => ['استان', 'province'].some((alias) => normalize(value).includes(normalize(alias))));
    const incidentIndexes = headers.flatMap((header, index) => ['سرقت', 'تخریب', 'تعریض', 'جابجایی', 'theft', 'damage', 'widening', 'relocation'].some((term) => normalize(header).includes(normalize(term))) ? [index] : []);
    if (codeIndex < 0 || incidentIndexes.length === 0) return result;
    const systemsByCode = new Map<string, RahcomSystem[]>();
    for (const system of systems) {
      const key = system.systemCode.normalize('NFKC').trim().toUpperCase();
      systemsByCode.set(key, [...(systemsByCode.get(key) ?? []), system]);
    }
    for (const row of trafficSnapshot.rows ?? []) {
      const code = row[codeIndex]?.normalize('NFKC').trim().toUpperCase() ?? '';
      const candidates = systemsByCode.get(code) ?? [];
      const province = provinceIndex >= 0 ? rahcomProvinceFromLabel(row[provinceIndex] ?? '') : selectedProvince !== 'all' ? selectedProvince : candidates.length === 1 ? candidates[0].province : null;
      if (!code || !province || !candidates.some((system) => system.province === province)) continue;
      const labels = incidentIndexes.filter((index) => isRahcomIncidentValue(row[index] ?? '')).map((index) => headers[index].trim());
      if (labels.length) result.set(`${province}:${code}`, labels.join('، '));
    }
    return result;
  }, [selectedProvince, systems, trafficSnapshot]);
  const systemRows = groups.flatMap(([, , axisRows]) => axisRows.map((system) => ({
    system,
    trafficLongOutage: trafficLongOutageByCode.get(`${system.province}:${system.systemCode.normalize('NFKC').trim().toUpperCase()}`) ?? '',
    axisCode: system.axisCode ?? '',
    axisName: system.announcedAxis || '',
    stationName: (() => {
      if (!trafficSnapshot) return '';
      const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\u200c_./-]/g, '');
      const headers = trafficSnapshot.headers;
      const codeIndex = headers.findIndex((value) => ['کدسامانه', 'systemcode'].some((alias) => normalize(value).includes(alias)));
      const stationIndex = headers.findIndex((value) => ['نامایستگاه', 'stationname'].some((alias) => normalize(value).includes(alias)));
      const provinceIndex = headers.findIndex((value) => ['استان', 'province'].some((alias) => normalize(value).includes(alias)));
      if (codeIndex < 0 || stationIndex < 0) return '';
      const row = trafficSnapshot.rows.find((item) => item[codeIndex]?.normalize('NFKC').trim().toUpperCase() === system.systemCode.normalize('NFKC').trim().toUpperCase() && (provinceIndex < 0 || !item[provinceIndex] || rahcomProvinceFromLabel(item[provinceIndex]) === system.province));
      return row?.[stationIndex]?.trim() ?? '';
    })(),
    aggregationCode: (() => {
      if (!trafficSnapshot) return '';
      const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\u200c_./-]/g, '');
      const headers = trafficSnapshot.headers;
      const codeIndex = headers.findIndex((value) => ['کدسامانه', 'systemcode'].some((alias) => normalize(value).includes(alias)));
      const aggregationIndex = headers.findIndex((value) => ['کدتجمیع', 'aggregationcode'].some((alias) => normalize(value).includes(alias)));
      const provinceIndex = headers.findIndex((value) => ['استان', 'province'].some((alias) => normalize(value).includes(alias)));
      if (codeIndex < 0 || aggregationIndex < 0) return '';
      const row = trafficSnapshot.rows.find((item) => item[codeIndex]?.normalize('NFKC').trim().toUpperCase() === system.systemCode.normalize('NFKC').trim().toUpperCase() && (provinceIndex < 0 || !item[provinceIndex] || rahcomProvinceFromLabel(item[provinceIndex]) === system.province));
      return row?.[aggregationIndex]?.trim() ?? '';
    })(),
  }))).sort((left, right) => left.axisName.localeCompare(right.axisName, locale, { numeric: true, sensitivity: 'base' }) || left.system.systemCode.localeCompare(right.system.systemCode, 'en', { numeric: true, sensitivity: 'base' }));
  const latestSystemUpdate = systems.reduce<string | null>((latest, system) => !latest || new Date(system.updatedAt) > new Date(latest) ? system.updatedAt : latest, null);
  const editingOutageSystem = systems.find((system) => system.id === editingOutageId) ?? null;

  return (
    <section aria-label={t('rahcomSystemsList')} className="flex h-full min-h-0 min-w-0 max-w-full flex-col gap-3 overflow-hidden">
      <div className="rahcom-mobile-toolbar rahcom-page-toolbar max-sm:-mb-2 flex shrink-0 flex-wrap items-center gap-2 overflow-visible sm:flex-nowrap sm:overflow-x-auto max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:overflow-y-hidden max-sm:pb-2">
        <span role="status" aria-label={`${new Intl.NumberFormat(locale).format(systems.length)} ${t('rahcomSystemsList')}`} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm font-bold tabular-nums text-foreground"><MapPinned size={16} className="text-primary" />{new Intl.NumberFormat(locale).format(systems.length)}</span>
        <span role="status" aria-label={`${new Intl.NumberFormat(locale).format(groups.length)} ${t('rahcomAxisCount')}`} title={`${new Intl.NumberFormat(locale).format(groups.length)} ${t('rahcomAxisCount')}`} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm text-foreground"><Rows3 size={16} className="text-primary" /><strong className="font-bold tabular-nums">{new Intl.NumberFormat(locale).format(groups.length)}</strong><span>{t('rahcomAxis')}</span></span>
        <label className="rahcom-search-capsule rahcom-search-capsule--outer-focus inline-flex h-9 w-44 shrink-0 items-center gap-2 rounded-full border border-border bg-background px-3 text-foreground focus-within:border-primary">
          <Search size={16} className="shrink-0 text-muted-foreground" />
          <input aria-label={t('rahcomSearchSystems')} placeholder={t('rahcomSearchSystems')} value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground focus:outline-none focus:ring-0" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label={t('searchClear')} title={t('searchClear')} className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><X size={14} /></button>}
        </label>
        {selectedProvince !== 'isfahan' && <label aria-label={t('rahcomUploadExcel')} title={t('rahcomUploadExcel')} className={`grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground hover:bg-muted ${uploadBusy ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}>{uploadBusy ? <LoaderCircle size={17} className="animate-spin" /> : <Upload size={17} aria-hidden="true" />}<input type="file" accept=".xlsx,.xls" disabled={uploadBusy} className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void uploadSystemsFile(file); }} /></label>}
        <button type="button" onClick={downloadSystems} aria-label={t('solarDownloadExcel')} title={t('solarDownloadExcel')} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground hover:bg-muted"><Download size={17} aria-hidden="true" /></button>
        <button type="button" aria-pressed={showTrafficLongOutage} onClick={() => setShowTrafficLongOutage((enabled) => !enabled)} aria-label="نمایش قطعی‌های زمان‌بر ثبت‌شده در فایل تردد" title="مقایسه با قطعی‌های زمان‌بر فایل تردد" style={showTrafficLongOutage ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`relative grid size-9 shrink-0 place-items-center rounded-full border transition-colors ${showTrafficLongOutage ? '' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}><TriangleAlert size={16} /><span className="absolute -end-0.5 -top-0.5 text-[9px] font-bold">۲</span></button>
        {canEditSystems && <button type="button" aria-pressed={editMode} onClick={() => setEditMode((enabled) => !enabled)} aria-label={t('rahcomEditSystem')} title={t('rahcomEditSystem')} style={editMode ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`grid size-9 shrink-0 place-items-center rounded-full border transition-colors ${editMode ? '' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}><Pencil size={16} /></button>}
        <span className="mx-1 h-6 shrink-0 border-s border-border" aria-hidden="true" />

        {systems.length > 0 && latestSystemUpdate && <div className="inline-flex h-9 shrink-0 items-center rounded-full border border-border bg-background px-3"><RahcomRecordSummary bare locale={locale} source={t('rahcomSystemsList')} showSource={false} showRecordDate={false} showCount={false} recordDate={tehranDateKey(latestSystemUpdate)} count={groups.length} savedAt={latestSystemUpdate} /></div>}
      </div>
      {canEditSystems && editMode && selectedProvince !== 'all' && <div className="space-y-3 rounded-xl border border-border bg-card p-3"><button type="button" onClick={async () => { if (window.confirm(t('rahcomDeleteProvinceConfirm'))) { await rahcomApi.deleteSystems({ province: selectedProvince }); setSystemsRevision((value) => value + 1); } }} className="rounded-lg border border-destructive/30 px-3 py-2 text-xs text-destructive">{t('rahcomDeleteProvinceSystems')}</button></div>}

      {loading ? <div className="shrink-0 rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{t('rahcomSystemsLoading')}</div> : null}
      {error ? <div role="alert" className="shrink-0 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-300">{error}</div> : null}
      {!loading && !error && !anyRows ? <div className="shrink-0 rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{t('rahcomSystemsEmpty')}</div> : null}

      {systemRows.length > 0 && <section className="rahcom-traffic-table-frame me-auto flex min-h-0 w-fit max-w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="rahcom-sticky-table w-[78rem] table-fixed border-separate border-spacing-0 text-sm">
            <colgroup><col style={{ width: '3rem' }} /><col style={{ width: '7rem' }} /><col style={{ width: '17rem' }} /><col style={{ width: '8rem' }} />{showTrafficLongOutage && <col style={{ width: '10rem' }} />}<col style={{ width: '13rem' }} /><col style={{ width: '7rem' }} /><col style={{ width: '5rem' }} /><col style={{ width: '8rem' }} /><col style={{ width: '4rem' }} /><col style={{ width: '6rem' }} /></colgroup>
            <thead className="text-xs text-muted-foreground"><tr>
              {[t('rahcomRowNumber'), t('rahcomSystemCode'), t('rahcomSystemName'), 'قطعی‌های زمان‌بر', ...(showTrafficLongOutage ? ['قطعی زمان‌بر تردد'] : []), t('rahcomStationName'), t('rahcomAggregationCode'), t('rahcomAxisCode'), t('rahcomAxisName'), t('rahcomProvince'), t('rahcomBillId')].map((heading) => <th key={heading} scope="col" style={{ backgroundColor: 'var(--card)', opacity: 1 }} className="sticky top-0 z-30 whitespace-nowrap border-b border-border bg-card px-3 py-2.5 text-center align-middle font-semibold">{heading}</th>)}
            </tr></thead>
            <tbody>{systemRows.map(({ system, axisCode, axisName, stationName, aggregationCode, trafficLongOutage }, rowIndex) => {
              const coordinatesKey = `${system.id}:coordinates`;
              return (
                <tr
                  key={system.id}
                  aria-selected={selectedSystemId === system.id}
                  className="odd:bg-background even:bg-muted/30"
                >
                  <td className="border-b border-border/70 px-3 py-2 text-center align-middle tabular-nums text-foreground">{new Intl.NumberFormat(locale).format(rowIndex + 1)}</td>
                  <td dir="ltr" className="whitespace-nowrap border-b border-border/70 px-3 py-2 text-center align-middle font-mono font-bold tracking-wide text-foreground">
                  {selectedSystemId === system.id && typeof document !== 'undefined' ? createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-transparent p-4" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedSystemId(null); }}>
                    <section role="dialog" aria-modal="true" aria-labelledby={`rahcom-system-title-${system.id}`} style={{ backgroundColor: 'var(--card)', opacity: 1 }} className="w-full max-w-[340px] rounded-xl border border-border p-2 shadow-2xl">
                      <div className="rahcom-system-popup">
                        {canEditSystems && editingSystemId === system.id && editForm ? <>
                          <header className="rahcom-popup-header"><strong className="rahcom-popup-title">{t('rahcomEditSystem')}</strong><button type="button" onClick={() => { setEditingSystemId(null); setEditForm(null); }} aria-label={t('rahcomCancel')} className="rahcom-popup-copy"><X size={16}/></button></header>
                          <div className="rahcom-popup-edit-fields">
                            {([['systemName', 'rahcomSystemName', 'text'], ['systemCode', 'rahcomSystemCode', 'text'], ['latitude', 'rahcomLatitude', 'number'], ['longitude', 'rahcomLongitude', 'number']] as const).map(([field, label, type]) => <label key={field}>{t(label)}<input type={type} dir={type === 'number' || field === 'systemCode' ? 'ltr' : undefined} value={String(editForm[field] ?? '')} onChange={(event) => setEditForm((current) => current ? { ...current, [field]: type === 'number' ? Number(event.target.value) : event.target.value } : current)} /></label>)}
                            <label>{t('solarSpecialCategory')}<select value={editForm.incidentType ?? ''} onChange={(event) => setEditForm((current) => current ? { ...current, incidentType: (event.target.value || null) as typeof current.incidentType } : current)}><option value="">—</option><option value="THEFT">{t('rahcomIncidentTheft')}</option><option value="DAMAGE">{t('rahcomIncidentDamage')}</option><option value="THEFT_AND_DAMAGE">{t('rahcomIncidentBoth')}</option><option value="WIDENING_RELOCATION">{t('solarWideningRelocation')}</option></select></label>
                            <label>قطعی زمان‌بر<select value={editForm.longOutageReason ?? ''} onChange={(event) => setEditForm((current) => current ? { ...current, longOutageReason: (event.target.value || null) as typeof current.longOutageReason, longOutage: Boolean(event.target.value), longOutageDetails: event.target.value === 'OTHER' ? current.longOutageDetails : '' } : current)}><option value="">ندارد</option>{outageReasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                            {editForm.longOutageReason === 'OTHER' && <label>شرح مورد دیگر<textarea maxLength={1000} value={editForm.longOutageDetails ?? ''} onChange={(event) => setEditForm((current) => current ? { ...current, longOutageDetails: event.target.value } : current)} /></label>}
                          </div>
                          <div className="rahcom-popup-actions"><button type="button" data-popup-action="save" disabled={savingSystem} onClick={() => void saveEdit(system.id)} title={t('rahcomSave')} aria-label={t('rahcomSave')}><Save size={16}/></button><button type="button" onClick={() => { setEditingSystemId(null); setEditForm(null); }} title={t('rahcomCancel')} aria-label={t('rahcomCancel')}><X size={16}/></button><button type="button" className="danger" onClick={() => void removeSystem(system)} title={t('rahcomDelete')} aria-label={t('rahcomDelete')}><Trash2 size={16}/></button></div>
                        </> : <>
                          <header className="rahcom-popup-header">
                            <div className="rahcom-popup-heading"><span className="rahcom-popup-code"><strong className="rahcom-popup-subtitle" dir="ltr">{system.systemCode}</strong><button type="button" onClick={() => void copyValue(`code-${system.id}`, system.systemCode)} title={copiedKey === `code-${system.id}` ? t('rahcomCopied') : t('rahcomCopy')} aria-label={t('rahcomCopy')} className="rahcom-popup-copy">{copiedKey === `code-${system.id}` ? <Check size={16}/> : <Copy size={16}/>}</button></span><strong id={`rahcom-system-title-${system.id}`} className="rahcom-popup-title">{system.systemName}</strong></div>
                            <div className="rahcom-popup-header-actions">
                              <button type="button" onClick={() => void copyValue(`details-${system.id}`, `${t('rahcomSystemCode')}: ${system.systemCode}\n${t('rahcomSystemName')}: ${system.systemName}\n${t('rahcomAxis')}: ${axisName || '—'}${axisCode ? ` / ${axisCode}` : ''}`)} title={copiedKey === `details-${system.id}` ? t('rahcomCopied') : t('rahcomCopy')} aria-label={t('rahcomCopy')} className="rahcom-popup-copy">{copiedKey === `details-${system.id}` ? <Check size={16}/> : <ClipboardCopy size={16}/>}</button>
                              <button type="button" onClick={() => setSelectedSystemId(null)} aria-label={t('closeSidebar')} className="rahcom-popup-copy"><X size={16}/></button>
                            </div>
                          </header>
                          <div className="rahcom-popup-data">
                            <div className="rahcom-popup-row rahcom-popup-axis"><span>{t('rahcomAxis')}:</span><b className="rahcom-popup-axis-value"><span>{axisName || '—'}</span>{axisCode && <><span aria-hidden="true">/</span><bdi dir="ltr">{axisCode}</bdi></>}</b></div>
                          </div>
                          <div role="status" className="rahcom-popup-status"></div>
                          <div className="rahcom-popup-actions">
                            <button type="button" onClick={() => void copyValue(coordinatesKey, formatRahcomCoordinates(system.latitude, system.longitude))} title={copiedKey === coordinatesKey ? t('rahcomCopied') : t('rahcomCopyCoordinates')} aria-label={t('rahcomCopyCoordinates')}>{copiedKey === coordinatesKey ? <Check size={16}/> : <MapPin size={16}/>}</button>
                            {canEditSystems && <button type="button" data-popup-action="edit" onClick={() => startEdit(system)} title={t('rahcomEditSystem')} aria-label={t('rahcomEditSystem')}><Pencil size={16}/></button>}
                            <button type="button" data-popup-action="route" onClick={() => setRouteSystem(system)} title={t('rahcomRoute')} aria-label={t('rahcomRoute')}><MapPinned size={16}/></button>
                            <button type="button" data-popup-action="history" onClick={() => { setSelectedSystemId(null); setHistorySystem(system); }} title={t('rahcomHistory')} aria-label={t('rahcomHistory')}><ClipboardList size={16}/></button>
                          </div>
                        </>}
                      </div>
                    </section>
                  </div>, document.body) : null}
                  <button type="button" aria-label={`${t('rahcomSystemCode')}: ${system.systemCode}`} onClick={() => setSelectedSystemId((current) => current === system.id ? null : system.id)} className="rounded-sm hover:text-primary hover:underline hover:underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{system.systemCode}</button>
                  </td>
                  <td title={system.systemName} className="overflow-hidden text-ellipsis whitespace-nowrap border-b border-border/70 px-3 py-2 text-center align-middle font-semibold text-foreground"><button type="button" aria-label={`${t('rahcomSystemName')}: ${system.systemName}`} onClick={() => setSelectedSystemId((current) => current === system.id ? null : system.id)} className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-sm hover:text-primary hover:underline hover:underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{system.systemName}</button></td>
                  <td title="قطعی‌های زمان‌بر" className="group relative border-b border-border/70 px-3 py-2 text-center align-middle text-foreground">
                    <div className="flex min-h-8 items-center justify-center gap-1.5">
                      <span className="truncate" title={system.longOutageReason === 'OTHER' ? system.longOutageDetails ?? '' : undefined}>{outageReasonLabel(system.longOutageReason) || (system.longOutage ? 'دلیل مشخص نشده' : '—')}{system.longOutageReason === 'OTHER' && system.longOutageDetails ? `: ${system.longOutageDetails}` : ''}</span>
                      {canManage && <button type="button" onClick={() => openOutageEditor(system)} aria-label="ویرایش قطعی زمان‌بر" title="ویرایش قطعی زمان‌بر" className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100 focus-visible:opacity-100"><Pencil size={14}/></button>}
                    </div>
                  </td>
                  {showTrafficLongOutage && <td title={trafficLongOutage} className="border-b border-border/70 px-3 py-2 text-center align-middle text-foreground">{trafficLongOutage || '—'}</td>}
                  <td title={stationName} className="overflow-hidden text-ellipsis whitespace-nowrap border-b border-border/70 px-3 py-2 text-center align-middle text-foreground">{stationName || '—'}</td>
                  <td dir="ltr" className="whitespace-nowrap border-b border-border/70 px-3 py-2 text-center align-middle font-mono text-foreground">{aggregationCode || '—'}</td>
                  <td dir="ltr" className="whitespace-nowrap border-b border-border/70 px-3 py-2 text-center align-middle font-mono text-foreground">{axisCode || '—'}</td>
                  <td title={axisName} className="overflow-hidden text-ellipsis whitespace-nowrap border-b border-border/70 px-3 py-2 text-center align-middle text-foreground">{axisName || '—'}</td>
                  <td className="whitespace-nowrap border-b border-border/70 px-3 py-2 text-center align-middle text-foreground">{provinceName(system.province)}</td>
                  <td dir="ltr" className="whitespace-nowrap border-b border-border/70 px-3 py-2 text-center align-middle font-mono text-xs text-foreground">{system.electricityBillId || '—'}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </section>}

      {editingOutageSystem && typeof document !== 'undefined' ? createPortal(<div className="fixed inset-0 z-[1002] flex items-center justify-center bg-transparent p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingSystem) setEditingOutageId(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="rahcom-long-outage-title" style={{ backgroundColor: 'var(--card)', opacity: 1 }} className="w-full max-w-[360px] rounded-xl border border-border p-2 shadow-2xl">
          <div className="rahcom-system-popup">
            <header className="rahcom-popup-header">
              <div className="rahcom-popup-heading"><strong id="rahcom-long-outage-title" className="rahcom-popup-title">ویرایش قطعی زمان‌بر</strong><span className="text-xs text-muted-foreground">{editingOutageSystem.systemName} · <bdi dir="ltr">{editingOutageSystem.systemCode}</bdi></span></div>
              <button type="button" disabled={savingSystem} onClick={() => setEditingOutageId(null)} aria-label={t('rahcomCancel')} className="rahcom-popup-copy disabled:opacity-50"><X size={16}/></button>
            </header>
            <div className="rahcom-popup-edit-fields mt-2 grid-cols-1">
              <label>قطعی زمان‌بر
                <select autoFocus className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground" value={outageDraft.reason ?? ''} onChange={(event) => setOutageDraft((current) => ({ reason: (event.target.value || null) as RahcomSystem['longOutageReason'], details: event.target.value === 'OTHER' ? current.details : '' }))}>
                  <option value="">ندارد</option>{outageReasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              {outageDraft.reason === 'OTHER' && <label>شرح مورد دیگر<textarea maxLength={1000} rows={2} value={outageDraft.details} onChange={(event) => setOutageDraft((current) => ({ ...current, details: event.target.value }))} placeholder="شرح قطعی زمان‌بر را بنویسید" className="w-full resize-y rounded-md border border-border bg-background p-2 text-xs text-foreground" /></label>}
            </div>
            <div className="rahcom-popup-actions mt-2">
              <button type="button" disabled={savingSystem || (outageDraft.reason === 'OTHER' && !outageDraft.details.trim())} onClick={() => void saveOutageReason(editingOutageSystem)} title="ذخیره" aria-label="ذخیره" className="disabled:opacity-50">{savingSystem ? <LoaderCircle className="animate-spin"/> : <Save/>}</button>
              <button type="button" disabled={savingSystem} onClick={() => setEditingOutageId(null)} title="لغو" aria-label="لغو" className="disabled:opacity-50"><X/></button>
            </div>
          </div>
        </section>
      </div>, document.body) : null}
      {historySystem && typeof document !== 'undefined' ? createPortal(<div className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/75 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistorySystem(null); }}>
        <section role="dialog" aria-modal="true" aria-label={t('rahcomHistory')} className="flex max-h-[min(90vh,52rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-2xl">
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4 py-3 sm:px-6">
            <div className="min-w-0"><h2 className="font-bold">{t('rahcomHistory')}</h2><p className="mt-1 truncate text-sm text-muted-foreground">{historySystem.systemName} · {historySystem.systemCode}</p></div>
            <button type="button" onClick={() => setHistorySystem(null)} aria-label={t('rahcomCancel')} className="shrink-0 rounded-lg border border-border bg-background p-2 text-muted-foreground hover:bg-accent"><X size={18}/></button>
          </div>
          <div className="min-h-0 overflow-y-auto p-4 sm:p-6"><RahcomSystemHistory system={historySystem} /></div>
        </section>
      </div>, document.body) : null}
      {routeSystem ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setRouteSystem(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="rahcom-route-title" className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div><h2 id="rahcom-route-title" className="font-bold text-foreground">{t('rahcomChooseRouteApp')}</h2><p className="mt-1 text-sm text-muted-foreground">{routeSystem.systemName}</p></div>
            <button type="button" onClick={() => setRouteSystem(null)} aria-label={t('closeSidebar')} className="rounded-lg p-2 text-muted-foreground hover:bg-accent"><X size={18} /></button>
          </div>
          <div className="mt-4 grid gap-2">
            {([
              ['google', t('rahcomRouteGoogleMaps')],
              ['neshan', t('rahcomRouteNeshan')],
              ['balad', t('rahcomRouteBalad')],
            ] as const).map(([provider, label]) => <a key={provider} href={routeUrl(provider, routeSystem)} target="_blank" rel="noreferrer" onClick={() => setRouteSystem(null)} className="flex min-h-11 items-center justify-between rounded-xl border border-border px-4 text-sm font-medium text-foreground hover:border-primary/50 hover:bg-accent">
              {label}<ExternalLink size={16} className="text-muted-foreground" />
            </a>)}
          </div>
        </section>
      </div> : null}
    </section>
  );
}
