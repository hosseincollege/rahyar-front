'use client';

import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { Check, ClipboardCopy, ClipboardList, Copy, Download, ExternalLink, Info, LoaderCircle, MapPin, MapPinned, Pencil, Plus, Rows3, Save, Search, Trash2, TriangleAlert, Upload, X } from 'lucide-react';
import { usePreferences } from '@/components/preferences-provider';
import { RahcomSystemHistory } from '@/app/(workspace)/rahcom/_shared/rahcom-system-history';
import { RahcomHeaderDate } from '@/app/(workspace)/rahcom/_shared/rahcom-header-date';
import { formatRahcomCoordinates, iranProvinces, rahcomApi, type RahcomSystem } from '@/lib/api/rahcom/rahcom-api';
import type { RahcomTrafficSnapshot } from '@/lib/api/rahcom/rahcom-api';
import { normalizeRahcomSystemCode, rahcomLongOutageReasonLabel, rahcomProvinceFromLabel, rahcomSystemHasLongOutage, rahcomTrafficLongOutageColumns, rahcomTrafficLongOutageValues } from '@/lib/api/rahcom/solar-status';
import { uiMessage } from '@/lib/ui-messages';
import { useRahcomDate } from '@/app/(workspace)/rahcom/_shared/rahcom-date';
import { RahcomRecordSummary } from '@/app/(workspace)/rahcom/_shared/rahcom-record-summary';
import { tehranDateKey } from '@/lib/api/rahcom/solar-status';
import { RahcomInfoHeader } from '@/app/(workspace)/rahcom/_shared/rahcom-row-info';
import { normalizeRahcomSystemSearchText } from '@/lib/rahcom-system-search';

function provinceName(provinceId: string) {
  return iranProvinces.find(([id]) => id === provinceId)?.[1] ?? provinceId;
}

const outageReasons = [
  ['THEFT_DAMAGE', 'سرقت و تخریب'], ['RELOCATION', 'جابجایی یا تعریض'],
  ['ELECTRICITY_DEBT', 'بدهی قبض برق'], ['PAYMENT_ARREARS', 'معوقات پرداخت'],
  ['POWER_OUTAGE', 'قطعی برق'], ['OTHER', 'سایر'],
] as const;
function outageReasonLabel(reason: RahcomSystem['longOutageReason']) {
  return rahcomLongOutageReasonLabel(reason);
}

function SystemsSearchInput({ value, onChange, placeholder, clearLabel }: { value: string; onChange: (value: string) => void; placeholder: string; clearLabel: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const update = (nextValue: string) => {
    setDraft(nextValue);
    startTransition(() => onChange(nextValue));
  };
  return <label className="rahcom-search-capsule rahcom-search-capsule--outer-focus inline-flex h-9 w-44 shrink-0 items-center gap-2 rounded-full border border-border bg-background px-3 text-foreground focus-within:border-primary">
    <Search size={16} className="shrink-0 text-muted-foreground" />
    <input aria-label={placeholder} placeholder={placeholder} value={draft} onChange={(event) => update(event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground focus:outline-none focus:ring-0" />
    {draft && <button type="button" onClick={() => update('')} aria-label={clearLabel} title={clearLabel} className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><X size={14} /></button>}
  </label>;
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
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  const [systemPopupPosition, setSystemPopupPosition] = useState<{ top: number; left: number; maxWidth: number; maxHeight: number } | null>(null);
  const [systemPopupPanel, setSystemPopupPanel] = useState<'location' | 'history' | null>(null);
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
  const [newSystemOpen, setNewSystemOpen] = useState(false);
  const [newSystemBusy, setNewSystemBusy] = useState(false);
  const [newSystemForm, setNewSystemForm] = useState({ systemName: '', systemCode: '', latitude: '', longitude: '' });
  const t = useCallback((key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key), [locale]);
  const canEditSystems = canManage && selectedProvince !== 'isfahan';
  const loadTrafficDatesForCalendar = useCallback((from: string, to: string) => rahcomApi.trafficSnapshotDates(selectedProvince, from, to), [selectedProvince]);

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
    const load = () => {
      setTrafficSnapshot(null);
      void rahcomApi.trafficSnapshot(selectedProvince, date ?? undefined).then((snapshot) => { if (active) setTrafficSnapshot(snapshot); }).catch(() => { if (active) setTrafficSnapshot(null); });
    };
    load();
    window.addEventListener('rahyar:traffic-snapshot-changed', load);
    return () => { active = false; window.removeEventListener('rahyar:traffic-snapshot-changed', load); };
  }, [date, selectedProvince, systemsRevision]);

  useEffect(() => {
    if (!selectedSystemId) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setSelectedSystemId(null); setSystemPopupPanel(null); } };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [selectedSystemId]);

  const deferredQuery = useDeferredValue(query);
  const searchableSystems = useMemo(() => systems.map((system) => {
    const axis = [system.axisCode, system.announcedAxis].filter(Boolean).join(' · ');
    const provinceLabel = provinceName(system.province);
    const searchable = [provinceLabel, system.province, axis || t('rahcomNoAxis'), system.announcedAxis, system.axisCode, system.systemName, system.systemCode, system.details, system.incidentType, system.incidentDetails, system.electricityBillId, system.simIp, system.radarIp, system.cameraIp, system.pcIp, system.routerIp, system.laptopIp, system.latitude, system.longitude]
      .filter(Boolean).join(' ');
    return { system, axis, provinceLabel, searchable: normalizeRahcomSystemSearchText(searchable, locale) };
  }), [locale, systems, t]);
  const searchableById = useMemo(() => new Map(searchableSystems.map(({ system, searchable }) => [system.id, searchable])), [searchableSystems]);
  const baseGroups = useMemo(() => {
    const grouped = new Map<string, { label: string; rows: RahcomSystem[] }>();
    for (const { system, axis, provinceLabel } of searchableSystems) {
      const label = axis || t('rahcomNoAxis');
      const axisCode = system.axisCode || '';
      const key = `${system.province}:${axisCode || label}`;
      const group = grouped.get(key) ?? { label: selectedProvince === 'all' ? `${provinceLabel} · ${label}` : label, rows: [] };
      group.rows.push(system);
      grouped.set(key, group);
    }
    return [...grouped.entries()].map(([key, value]) => [key, value.label, value.rows] as const).sort((a, b) => a[1].localeCompare(b[1], locale, { numeric: true, sensitivity: 'base' }));
  }, [locale, searchableSystems, selectedProvince, t]);
  const groups = useMemo(() => {
    const normalizedQuery = normalizeRahcomSystemSearchText(deferredQuery, locale);
    if (!normalizedQuery) return baseGroups;
    return baseGroups.flatMap(([key, label, rows]) => {
      const filteredRows = rows.filter((system) => searchableById.get(system.id)?.includes(normalizedQuery));
      return filteredRows.length ? [[key, label, filteredRows] as const] : [];
    });
  }, [baseGroups, deferredQuery, locale, searchableById]);

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
        longoutage: 'longOutage', longoutageenabled: 'longOutage', [normalize('\u0648\u0636\u0639\u06cc\u062a \u0642\u0637\u0639\u06cc \u0632\u0645\u0627\u0646\u200c\u0628\u0631')]: 'longOutage',
        longoutagereason: 'longOutageReason', outagecause: 'longOutageReason', [normalize('\u0642\u0637\u0639\u06cc\u200c\u0647\u0627\u06cc \u0632\u0645\u0627\u0646\u200c\u0628\u0631')]: 'longOutageReason', [normalize('\u062f\u0644\u06cc\u0644 \u0642\u0637\u0639\u06cc \u0632\u0645\u0627\u0646\u200c\u0628\u0631')]: 'longOutageReason',
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

  async function createSystem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedProvince === 'all') return;
    const latitude = Number(newSystemForm.latitude);
    const longitude = Number(newSystemForm.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setError(t('rahcomDataUploadHint'));
      return;
    }
    setNewSystemBusy(true);
    setError('');
    try {
      await rahcomApi.importSystems(selectedProvince, [{
        province: selectedProvince,
        systemName: newSystemForm.systemName.trim(),
        systemCode: newSystemForm.systemCode.trim(),
        latitude,
        longitude,
        announcedAxis: '',
        axisCode: '',
        details: '',
      }]);
      setNewSystemOpen(false);
      setNewSystemForm({ systemName: '', systemCode: '', latitude: '', longitude: '' });
      setSystemsRevision((revision) => revision + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('rahcomSystemsLoadError'));
    } finally { setNewSystemBusy(false); }
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
  const trafficValuesByCode = useMemo(() => {
    const result = new Map<string, { incidents: string; outage: string }>();
    if (!trafficSnapshot) return result;
    const headers = trafficSnapshot.headers ?? [];
    const normalize = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa')
      .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9')
      .replace(/[\s\u200c_\-./()]/g, '');
    const codeIndex = headers.findIndex((value) => ['\u06a9\u062f\u0633\u0627\u0645\u0627\u0646\u0647', 'systemcode'].some((alias) => normalize(value).includes(normalize(alias))));
    const provinceIndex = headers.findIndex((value) => ['\u0627\u0633\u062a\u0627\u0646', 'province'].some((alias) => normalize(value).includes(normalize(alias))));
    const incidentIndexes = headers.flatMap((header, index) => {
      const normalized = normalize(header);
      return ['\u0633\u0631\u0642\u062a', '\u062a\u062e\u0631\u06cc\u0628', 'theft', 'damage'].some((term) => normalized.includes(normalize(term))) ? [index] : [];
    });
    const longOutageColumns = rahcomTrafficLongOutageColumns(headers);
    if (codeIndex < 0) return result;
    const systemsByCode = new Map<string, RahcomSystem[]>();
    for (const system of systems) {
      const key = normalizeRahcomSystemCode(system.systemCode);
      systemsByCode.set(key, [...(systemsByCode.get(key) ?? []), system]);
    }
    for (const row of trafficSnapshot.rows ?? []) {
      const code = normalizeRahcomSystemCode(row[codeIndex] ?? '');
      const candidates = systemsByCode.get(code) ?? [];
      const rowProvince = provinceIndex >= 0 ? rahcomProvinceFromLabel(row[provinceIndex] ?? '') : null;
      const province = rowProvince || (selectedProvince !== 'all' ? selectedProvince : candidates.length === 1 ? candidates[0].province : null);
      if (!code || !province) continue;
      const incidents = rahcomTrafficLongOutageValues(headers, row, { indexes: incidentIndexes, isGeneric: false }).join('، ');
      const outageValues = rahcomTrafficLongOutageValues(headers, row, longOutageColumns);
      const outage = outageValues.join('، ');
      if (incidents || outage) result.set(province + ':' + code, { incidents, outage });
    }
    return result;
  }, [selectedProvince, systems, trafficSnapshot]);
  const trafficRowDataByCode = useMemo(() => {
    const result = new Map<string, { stationName: string; aggregationCode: string }>();
    if (!trafficSnapshot) return result;
    const headers = trafficSnapshot.headers ?? [];
    const normalize = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa')
      .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9')
      .replace(/[\s\u200c_\-./()]/g, '');
    const findColumn = (aliases: string[]) => headers.findIndex((header) => aliases.some((alias) => normalize(header).includes(normalize(alias))));
    const codeIndex = findColumn(['\u06a9\u062f\u0633\u0627\u0645\u0627\u0646\u0647', 'systemcode']);
    const provinceIndex = findColumn(['\u0627\u0633\u062a\u0627\u0646', 'province']);
    const stationIndex = findColumn(['\u0646\u0627\u0645\u0627\u06cc\u0633\u062a\u06af\u0627\u0647', 'stationname']);
    const aggregationIndex = findColumn(['\u06a9\u062f\u062a\u062c\u0645\u06cc\u0639', 'aggregationcode']);
    if (codeIndex < 0) return result;
    const systemsByCode = new Map<string, RahcomSystem[]>();
    for (const system of systems) {
      const code = normalizeRahcomSystemCode(system.systemCode);
      systemsByCode.set(code, [...(systemsByCode.get(code) ?? []), system]);
    }
    const valueAt = (row: string[], index: number) => index >= 0 ? String(row[index] ?? '').trim() : '';
    for (const row of trafficSnapshot.rows ?? []) {
      const code = normalizeRahcomSystemCode(valueAt(row, codeIndex));
      if (!code) continue;
      const candidates = systemsByCode.get(code) ?? [];
      const rowProvince = provinceIndex >= 0 ? rahcomProvinceFromLabel(valueAt(row, provinceIndex)) : null;
      const province = rowProvince || (selectedProvince !== 'all' ? selectedProvince : candidates.length === 1 ? candidates[0].province : null);
      if (!province) continue;
      const key = province + ':' + code;
      if (!result.has(key)) result.set(key, { stationName: valueAt(row, stationIndex), aggregationCode: valueAt(row, aggregationIndex) });
    }
    return result;
  }, [selectedProvince, systems, trafficSnapshot]);
  const allSystemRows = useMemo(() => groups.flatMap(([, , axisRows]) => axisRows.map((system) => {
    const key = system.province + ':' + normalizeRahcomSystemCode(system.systemCode);
    const trafficValues = trafficValuesByCode.get(key) ?? { incidents: '', outage: '' };
    const trafficRow = trafficRowDataByCode.get(key);
    return {
      system,
      trafficValues,
      axisCode: system.axisCode ?? '',
      axisName: system.announcedAxis || '',
      stationName: trafficRow?.stationName ?? '',
      aggregationCode: trafficRow?.aggregationCode ?? '',
    };
  })).sort((left, right) => left.axisName.localeCompare(right.axisName, locale, { numeric: true, sensitivity: 'base' }) || left.system.systemCode.localeCompare(right.system.systemCode, 'en', { numeric: true, sensitivity: 'base' })), [groups, locale, trafficRowDataByCode, trafficValuesByCode]);
  const trafficOnlyRows = useMemo(() => {
    if (!showTrafficLongOutage || !trafficSnapshot) return [];
    const headers = trafficSnapshot.headers ?? [];
    const normalize = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa')
      .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9')
      .replace(/[\s\u200c_\-./()]/g, '');
    const findColumn = (aliases: string[]) => headers.findIndex((header) => aliases.some((alias) => normalize(header).includes(normalize(alias))));
    const codeIndex = findColumn(['\u06a9\u062f\u0633\u0627\u0645\u0627\u0646\u0647', 'systemcode']);
    const provinceIndex = findColumn(['\u0627\u0633\u062a\u0627\u0646', 'province']);
    const nameIndex = findColumn(['\u0646\u0627\u0645\u0633\u0627\u0645\u0627\u0646\u0647', 'systemname']);
    const stationIndex = findColumn(['\u0646\u0627\u0645\u0627\u06cc\u0633\u062a\u06af\u0627\u0647', 'stationname']);
    const aggregationIndex = findColumn(['\u06a9\u062f\u062a\u062c\u0645\u06cc\u0639', 'aggregationcode']);
    const axisCodeIndex = findColumn(['\u06a9\u062f\u0645\u062d\u0648\u0631', 'axiscode']);
    const axisNameIndex = findColumn(['\u0646\u0627\u0645\u0645\u062d\u0648\u0631', 'axisname']);
    const incidentIndexes = headers.flatMap((header, index) => {
      const normalized = normalize(header);
      return ['\u0633\u0631\u0642\u062a', '\u062a\u062e\u0631\u06cc\u0628', 'theft', 'damage'].some((term) => normalized.includes(normalize(term))) ? [index] : [];
    });
    if (codeIndex < 0 || incidentIndexes.length === 0) return [];
    const knownKeys = new Set(systems.map((system) => system.province + ':' + normalizeRahcomSystemCode(system.systemCode)));
    const valuesAt = (row: string[], index: number) => index >= 0 ? String(row[index] ?? '').trim() : '';
    const seenTrafficKeys = new Set<string>();
    return (trafficSnapshot.rows ?? []).flatMap((row) => {
      const systemCode = normalizeRahcomSystemCode(valuesAt(row, codeIndex));
      const rowProvince = provinceIndex >= 0 ? rahcomProvinceFromLabel(valuesAt(row, provinceIndex)) : null;
      const province = rowProvince || (selectedProvince !== 'all' ? selectedProvince : null);
      if (!systemCode || !province) return [];
      const key = province + ':' + systemCode;
      const trafficValues = trafficValuesByCode.get(key) ?? { incidents: '', outage: '' };
      if (!trafficValues.incidents || knownKeys.has(key) || seenTrafficKeys.has(key)) return [];
      const systemName = valuesAt(row, nameIndex) || valuesAt(row, stationIndex) || systemCode;
      const axisCode = valuesAt(row, axisCodeIndex);
      const axisName = valuesAt(row, axisNameIndex);
      const searchable = [provinceName(province), systemName, systemCode, axisCode, axisName, valuesAt(row, stationIndex)].join(' ').toLocaleLowerCase(locale);
      if (query.trim() && !searchable.includes(query.trim().toLocaleLowerCase(locale))) return [];
      seenTrafficKeys.add(key);
      const system: RahcomSystem = {
        id: 'traffic-' + trafficSnapshot.id + '-' + systemCode,
        province,
        systemName,
        systemCode,
        axisCode: axisCode || null,
        announcedAxis: axisName || null,
        createdAt: trafficSnapshot.createdAt,
        updatedAt: trafficSnapshot.createdAt,
        longOutage: Boolean(trafficValues.outage),
        longOutageReason: null,
        longOutageDetails: null,
        incidentType: null,
        incidentDetails: null,
        latitude: Number.NaN,
        longitude: Number.NaN,
        details: null,
        electricityBillId: null,
        simIp: null,
        radarIp: null,
        cameraIp: null,
        pcIp: null,
        routerIp: null,
        laptopIp: null,
      };
      return [{ system, trafficValues, axisCode, axisName, stationName: valuesAt(row, stationIndex), aggregationCode: valuesAt(row, aggregationIndex) }];
    });
  }, [locale, query, selectedProvince, showTrafficLongOutage, systems, trafficSnapshot, trafficValuesByCode]);
  const combinedSystemRows = useMemo(() => showTrafficLongOutage
    ? [...allSystemRows, ...trafficOnlyRows].sort((left, right) => left.axisName.localeCompare(right.axisName, locale, { numeric: true, sensitivity: 'base' }) || left.system.systemCode.localeCompare(right.system.systemCode, 'en', { numeric: true, sensitivity: 'base' }))
    : allSystemRows, [allSystemRows, locale, showTrafficLongOutage, trafficOnlyRows]);
  const systemRows = useMemo(() => showTrafficLongOutage
    ? combinedSystemRows.filter(({ system, trafficValues }) => rahcomSystemHasLongOutage(system) || Boolean(trafficValues.incidents))
    : allSystemRows, [allSystemRows, combinedSystemRows, showTrafficLongOutage]);
  const latestSystemUpdate = systems.reduce<string | null>((latest, system) => !latest || new Date(system.updatedAt) > new Date(latest) ? system.updatedAt : latest, null);
  const editingOutageSystem = systems.find((system) => system.id === editingOutageId) ?? null;

  return (
    <section aria-label={t('rahcomSystemsList')} className="flex h-full min-h-0 min-w-0 max-w-full flex-col gap-3 overflow-hidden">
      <div className="rahcom-mobile-toolbar rahcom-page-toolbar max-sm:-mb-2 flex shrink-0 flex-wrap items-center gap-2 overflow-visible sm:flex-nowrap sm:overflow-x-auto max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:overflow-y-hidden max-sm:pb-2">
        <RahcomHeaderDate compact loadMarkedDates={loadTrafficDatesForCalendar} />
        <span role="status" aria-label={`${new Intl.NumberFormat(locale).format(systems.length)} ${t('rahcomSystemsList')}`} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm font-bold tabular-nums text-foreground"><MapPinned size={16} className="text-primary" />{new Intl.NumberFormat(locale).format(systems.length)}</span>
        <span role="status" aria-label={`${new Intl.NumberFormat(locale).format(groups.length)} ${t('rahcomAxisCount')}`} title={`${new Intl.NumberFormat(locale).format(groups.length)} ${t('rahcomAxisCount')}`} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm text-foreground"><Rows3 size={16} className="text-primary" /><strong className="font-bold tabular-nums">{new Intl.NumberFormat(locale).format(groups.length)}</strong><span>{t('rahcomAxis')}</span></span>
        <SystemsSearchInput value={query} onChange={setQuery} placeholder={t('rahcomSearchSystems')} clearLabel={t('searchClear')} />
        {canManage && selectedProvince !== 'all' && <button type="button" onClick={() => { setNewSystemOpen(true); setError(''); }} aria-label={t('rahcomAddSystem')} title={t('rahcomAddSystem')} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary"><Plus size={17} aria-hidden="true" /></button>}
        {selectedProvince !== 'isfahan' && <label aria-label={t('rahcomUploadExcel')} title={t('rahcomUploadExcel')} className={`grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground hover:bg-muted ${uploadBusy ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}>{uploadBusy ? <LoaderCircle size={17} className="animate-spin" /> : <Upload size={17} aria-hidden="true" />}<input type="file" accept=".xlsx,.xls" disabled={uploadBusy} className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void uploadSystemsFile(file); }} /></label>}
        <button type="button" onClick={downloadSystems} aria-label={t('solarDownloadExcel')} title={t('solarDownloadExcel')} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground hover:bg-muted"><Download size={17} aria-hidden="true" /></button>
        <button type="button" aria-pressed={showTrafficLongOutage} onClick={() => setShowTrafficLongOutage((enabled) => !enabled)} aria-label="نمایش سرقت و تخریب ثبت‌شده در فایل تردد" title="نمایش سرقت و تخریب ثبت‌شده در فایل تردد" style={showTrafficLongOutage ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`flex size-9 shrink-0 flex-col items-center justify-center rounded-full border transition-colors ${showTrafficLongOutage ? '' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}><TriangleAlert size={15} className="-translate-y-0.5" /><span className="text-[10px] font-bold leading-[10px]">تردد</span></button>
        {canEditSystems && <button type="button" aria-pressed={editMode} onClick={() => setEditMode((enabled) => !enabled)} aria-label={t('rahcomEditSystem')} title={t('rahcomEditSystem')} style={editMode ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`grid size-9 shrink-0 place-items-center rounded-full border transition-colors ${editMode ? '' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}><Pencil size={16} /></button>}
        <span className="mx-1 h-6 shrink-0 border-s border-border" aria-hidden="true" />

        {systems.length > 0 && latestSystemUpdate && <div className="inline-flex h-9 shrink-0 items-center rounded-full border border-border bg-background px-3"><RahcomRecordSummary bare locale={locale} source={t('rahcomSystemsList')} showSource={false} showRecordDate={false} showCount={false} recordDate={tehranDateKey(latestSystemUpdate)} count={groups.length} savedAt={latestSystemUpdate} /></div>}
      </div>
      {newSystemOpen && <form onSubmit={(event) => void createSystem(event)} className="shrink-0 rounded-xl border border-border bg-card p-3" aria-label={t('rahcomAddSystem')}>
        <div className="mb-3 flex items-center justify-between gap-2"><strong className="text-sm">{t('rahcomAddSystem')}</strong><button type="button" onClick={() => setNewSystemOpen(false)} aria-label={t('rahcomCancel')} className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground"><X size={16}/></button></div>
        <div className="grid gap-2 sm:grid-cols-4">
          {([['systemName', 'rahcomSystemName', 'text'], ['systemCode', 'rahcomSystemCode', 'text'], ['latitude', 'rahcomLatitude', 'number'], ['longitude', 'rahcomLongitude', 'number']] as const).map(([field, label, type]) => <label key={field} className="grid gap-1 text-xs text-muted-foreground">{t(label)}<input required type={type} step={type === 'number' ? 'any' : undefined} dir={type === 'number' || field === 'systemCode' ? 'ltr' : undefined} value={newSystemForm[field]} onChange={(event) => setNewSystemForm((current) => ({ ...current, [field]: event.target.value }))} className="h-9 min-w-0 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-primary" /></label>)}
        </div>
        <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setNewSystemOpen(false)} className="h-9 rounded-lg border border-border px-3 text-sm">{t('rahcomCancel')}</button><button type="submit" disabled={newSystemBusy} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm text-primary-foreground disabled:opacity-60">{newSystemBusy && <LoaderCircle size={15} className="animate-spin"/>}{t('rahcomAdd')}</button></div>
      </form>}
      {canEditSystems && editMode && selectedProvince !== 'all' && <div className="space-y-3 rounded-xl border border-border bg-card p-3"><button type="button" onClick={async () => { if (window.confirm(t('rahcomDeleteProvinceConfirm'))) { await rahcomApi.deleteSystems({ province: selectedProvince }); setSystemsRevision((value) => value + 1); } }} className="rounded-lg border border-destructive/30 px-3 py-2 text-xs text-destructive">{t('rahcomDeleteProvinceSystems')}</button></div>}

      {loading ? <div className="shrink-0 rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{t('rahcomSystemsLoading')}</div> : null}
      {error ? <div role="alert" className="shrink-0 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-300">{error}</div> : null}
      {!loading && !error && (!anyRows || showTrafficLongOutage && systemRows.length === 0) ? <div className="shrink-0 rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{showTrafficLongOutage && anyRows ? t('solarNoEntries') : t('rahcomSystemsEmpty')}</div> : null}

      {systemRows.length > 0 && <section className="rahcom-traffic-table-frame me-auto flex min-h-0 w-fit max-w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="rahcom-sticky-table w-[80.5rem] table-fixed border-separate border-spacing-0 text-sm">
            <colgroup><col style={{ width: '3rem' }} /><col style={{ width: '2.5rem' }} /><col style={{ width: '7rem' }} /><col style={{ width: '17rem' }} /><col style={{ width: '8rem' }} />{showTrafficLongOutage && <col style={{ width: '10rem' }} />}<col style={{ width: '13rem' }} /><col style={{ width: '7rem' }} /><col style={{ width: '5rem' }} /><col style={{ width: '8rem' }} /><col style={{ width: '4rem' }} /><col style={{ width: '6rem' }} /></colgroup>
            <thead className="text-xs text-muted-foreground"><tr>
              <th scope="col" style={{ backgroundColor: 'var(--card)', opacity: 1 }} className="sticky top-0 z-30 whitespace-nowrap border-b border-border bg-card px-3 py-2.5 text-center align-middle font-semibold">{t('rahcomRowNumber')}</th><th scope="col" className="sticky top-0 z-30 border-b border-border bg-card p-1 text-center"><RahcomInfoHeader /></th>
              {[t('rahcomSystemCode'), t('rahcomSystemName'), 'قطعی‌های زمان‌بر', ...(showTrafficLongOutage ? ['سرقت و تخریب'] : []), t('rahcomStationName'), t('rahcomAggregationCode'), t('rahcomAxisCode'), t('rahcomAxisName'), t('rahcomProvince'), t('rahcomBillId')].map((heading) => <th key={heading} scope="col" style={{ backgroundColor: 'var(--card)', opacity: 1 }} className="sticky top-0 z-30 whitespace-nowrap border-b border-border bg-card px-3 py-2.5 text-center align-middle font-semibold">{heading}</th>)}
            </tr></thead>
            <tbody>{systemRows.map(({ system, axisCode, axisName, stationName, aggregationCode, trafficValues }, rowIndex) => {
              const trafficLongOutage = trafficValues.incidents;
              const displayedOutageReason = outageReasonLabel(system.longOutageReason) || system.longOutageDetails || (system.longOutage ? trafficValues.outage || '\u062f\u0644\u06cc\u0644 \u0645\u0634\u062e\u0635 \u0646\u0634\u062f\u0647' : '');
              const coordinatesKey = `${system.id}:coordinates`;
              return (
                <tr
                  key={system.id}
                  aria-selected={selectedSystemId === system.id}
                  className="odd:bg-background even:bg-muted/30"
                >
                  <td className="border-b border-border/70 px-3 py-2 text-center align-middle tabular-nums text-foreground">{new Intl.NumberFormat(locale).format(rowIndex + 1)}</td>
                  <td className="border-b border-border/70 px-1 py-2 text-center align-middle">
                    <button type="button" aria-label={`اطلاعات سامانه ${system.systemCode}`} title="اطلاعات سامانه" aria-expanded={selectedSystemId === system.id} onClick={(event) => {
                      const bounds = event.currentTarget.closest('main')?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
                      if (selectedSystemId === system.id) { setSelectedSystemId(null); setSystemPopupPanel(null); return; }
                      const maxWidth = Math.max(240, Math.min(340, bounds.width - 24));
                      const maxHeight = Math.max(180, Math.min(440, bounds.height - 24));
                      setSystemPopupPosition({ left: Math.max(bounds.left + 12, Math.min(event.clientX + 12, bounds.right - maxWidth - 12)), top: Math.max(bounds.top + 12, Math.min(event.clientY + 12, bounds.bottom - maxHeight - 12)), maxWidth, maxHeight });
                      setSystemPopupPanel(null);
                      setSelectedSystemId(system.id);
                    }} className="inline-grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:text-primary aria-expanded:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" data-rahcom-info-trigger><Info size={16} /></button>
                  </td>
                  <td dir="ltr" className="whitespace-nowrap border-b border-border/70 px-3 py-2 text-center align-middle font-mono font-bold tracking-wide text-foreground">
                  {selectedSystemId === system.id && systemPopupPosition && typeof document !== 'undefined' ? createPortal(<div className="fixed inset-0 z-[100] bg-transparent" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedSystemId(null); }}>
                    <section role="dialog" aria-modal="true" aria-labelledby={`rahcom-system-title-${system.id}`} style={{ position: 'fixed', top: systemPopupPosition.top, left: systemPopupPosition.left, width: systemPopupPosition.maxWidth, maxWidth: systemPopupPosition.maxWidth, maxHeight: systemPopupPosition.maxHeight, overflowY: 'auto', backgroundColor: 'var(--card)', opacity: 1 }} className="rounded-xl border border-border p-2 shadow-2xl">
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
                          </header>
                          <div className="rahcom-popup-data">
                            <div className="rahcom-popup-row rahcom-popup-axis"><span>{t('rahcomAxis')}:</span><b className="rahcom-popup-axis-value"><span>{axisName || '—'}</span>{axisCode && <><span aria-hidden="true">/</span><bdi dir="ltr">{axisCode}</bdi></>}</b></div>
                          </div>
                          <div role="status" className="rahcom-popup-status"></div>
                          <div className="rahcom-popup-actions">
                            <button type="button" className="danger" onClick={() => { setSelectedSystemId(null); setSystemPopupPanel(null); }} title={t('closeSidebar')} aria-label={t('closeSidebar')}><X size={16}/></button>
                            <button type="button" onClick={() => void copyValue(`details-${system.id}`, `${t('rahcomSystemCode')}: ${system.systemCode}\n${t('rahcomSystemName')}: ${system.systemName}\n${t('rahcomAxis')}: ${axisName || '—'}${axisCode ? ` / ${axisCode}` : ''}`)} title={copiedKey === `details-${system.id}` ? t('rahcomCopied') : t('rahcomCopy')} aria-label={t('rahcomCopy')}>{copiedKey === `details-${system.id}` ? <Check size={16}/> : <ClipboardCopy size={16}/>}</button>
                            {Number.isFinite(system.latitude) && Number.isFinite(system.longitude) && <button type="button" data-popup-action="route" aria-expanded={systemPopupPanel === 'location'} onClick={() => setSystemPopupPanel((panel) => panel === 'location' ? null : 'location')} title={t('rahcomRoute')} aria-label={t('rahcomRoute')}><MapPin size={16}/></button>}
                            {!system.id.startsWith('traffic-') && <button type="button" data-popup-action="history" aria-expanded={systemPopupPanel === 'history'} onClick={() => setSystemPopupPanel((panel) => panel === 'history' ? null : 'history')} title={t('rahcomHistory')} aria-label={t('rahcomHistory')}><ClipboardList size={16}/></button>}
                            {canEditSystems && <button type="button" data-popup-action="edit" onClick={() => startEdit(system)} title={t('rahcomEditSystem')} aria-label={t('rahcomEditSystem')}><Pencil size={16}/></button>}
                            <Link href={`/rahcom/systems/${encodeURIComponent(system.systemCode)}?province=${encodeURIComponent(system.province)}`} data-popup-action="system-page" title={t('rahcomOpenSystemPage')} aria-label={t('rahcomOpenSystemPage')} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[.65rem] border border-border bg-background p-1 text-foreground hover:border-primary hover:text-primary"><ExternalLink size={16}/></Link>
                          </div>
                          {systemPopupPanel === 'location' && Number.isFinite(system.latitude) && Number.isFinite(system.longitude) && <div className="mt-1 grid gap-1.5 rounded-lg border border-border bg-background p-2 text-xs">
                            <button type="button" onClick={() => void copyValue(coordinatesKey, formatRahcomCoordinates(system.latitude, system.longitude))} className="flex min-h-9 items-center gap-2 rounded-md px-2 text-start text-foreground hover:bg-muted">{copiedKey === coordinatesKey ? <Check size={15}/> : <MapPin size={15}/>} {copiedKey === coordinatesKey ? t('rahcomCopied') : t('rahcomCopyCoordinates')}</button>
                            {([['google', t('rahcomRouteGoogleMaps')], ['neshan', t('rahcomRouteNeshan')], ['balad', t('rahcomRouteBalad')]] as const).map(([provider, label]) => <a key={provider} href={routeUrl(provider, system)} target="_blank" rel="noreferrer" className="flex min-h-9 items-center justify-between rounded-md px-2 text-foreground hover:bg-muted">{label}<ExternalLink size={14} className="text-muted-foreground"/></a>)}
                          </div>}
                          {systemPopupPanel === 'history' && <div className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-background p-2"><RahcomSystemHistory system={system}/></div>}
                        </>}
                      </div>
                    </section>
                  </div>, document.body) : null}
                  {system.systemCode}
                  </td>
                  <td title={system.systemName} className="overflow-hidden text-ellipsis whitespace-nowrap border-b border-border/70 px-3 py-2 text-center align-middle font-semibold text-foreground">{system.systemName}</td>
                  <td title={displayedOutageReason || undefined} className="group relative border-b border-border/70 px-3 py-2 text-center align-middle text-foreground">
                    <div className="flex min-h-8 items-center justify-center gap-1.5">
                      <span className="truncate" title={system.longOutageReason === 'OTHER' ? system.longOutageDetails ?? '' : undefined}>{displayedOutageReason || '—'}</span>
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
    </section>
  );
}
