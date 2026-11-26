'use client';

import { RahcomCompareIcon, RahcomLocationIcon, RahcomToolbar } from '@/components/rahcom/toolbar';
import { RahcomTableCount, RahcomTableFrame } from '@/components/rahcom/table';
import { DataTable } from '@/components/ui/data-table';

import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { ArchiveRestore, Check, ClipboardCopy, ClipboardList, Copy, Download, ExternalLink, FilePenLine, LoaderCircle, MapPin, Pencil, Plus, Save, Search, Trash2, Upload, X } from 'lucide-react';
import { usePreferences } from '@/components/providers/preferences-provider';
import { getAccessToken } from '@/lib/api-client';
import { RahcomSystemHistory } from '@/app/(workspace)/rahcom/_shared/rahcom-system-history';
import { formatRahcomCoordinates, hasRahcomCoordinates, iranProvinces, rahcomApi, type RahcomSystem, type RahcomTrafficSnapshot } from '@/lib/api/rahcom/rahcom-api';
import { isRahcomIncidentValue, normalizeRahcomSystemCode, rahcomLongOutageReasonLabel, rahcomProvinceFromLabel, rahcomSystemHasLongOutage } from '@/lib/api/rahcom/solar-status';
import { uiMessage } from '@/lib/ui-messages';
import { RahcomInfoHeader, RahcomRowInfo, type RahcomElectricityDetail } from '@/app/(workspace)/rahcom/_shared/rahcom-row-info';
import { normalizeRahcomSystemSearchText } from '@/lib/rahcom-system-search';
import { useBackupActionsPreference } from '@/components/rahcom/use-backup-actions-preference';
import { RahcomHeaderDate } from '@/app/(workspace)/rahcom/_shared/rahcom-header-date';
import { useRahcomDate } from '@/app/(workspace)/rahcom/_shared/rahcom-date';

function provinceName(provinceId: string) {
  return iranProvinces.find(([id]) => id === provinceId)?.[1] ?? provinceId;
}

const normalizeTrafficHeader = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa')
  .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c_\-./()]/g, '');

type BillIdentifierWorkbook = { headers: string[]; rows: string[][] };
const normalizeBillIdentifierHeader = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa')
  .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c]/g, '').replace(/[\/\\_-]/g, '');
const splitBillSystemCodes = (value: string) => value.split(/[;,|\u060c\u061b]/).map((code) => code.trim()).filter(Boolean);

const outageReasons = [
  ['THEFT_DAMAGE', 'سرقت و تخریب'], ['RELOCATION', 'جابجایی یا تعریض'],
  ['ELECTRICITY_DEBT', 'بدهی قبض برق'], ['PAYMENT_ARREARS', 'معوقات پرداخت'],
  ['POWER_OUTAGE', 'قطعی برق'], ['OTHER', 'سایر'],
] as const;
function outageReasonLabel(reason: RahcomSystem['longOutageReason']) {
  return rahcomLongOutageReasonLabel(reason);
}

function SystemsSearchInput({ value, onChange, placeholder, clearLabel }: { value: string; onChange: (value: string) => void; placeholder: string; clearLabel: string }) {
  const update = (nextValue: string) => onChange(nextValue);
  return <label className="rahcom-search-capsule rahcom-systems-search-capsule rahcom-search-capsule--outer-focus group inline-flex h-9 w-44 shrink-0 items-center gap-2 rounded-full border border-border bg-background px-3 text-foreground focus-within:border-primary">
    <Search size={16} className="shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
    <input aria-label={placeholder} placeholder={placeholder} value={value} onChange={(event) => update(event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground focus:outline-none focus:ring-0" />
    {value && <button type="button" onClick={() => update('')} aria-label={clearLabel} title={clearLabel} className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><X size={14} /></button>}
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
  const stationNameColumnLabel = locale.startsWith('fa') ? '\u0646\u0627\u0645 \u0627\u06cc\u0633\u062a\u06af\u0627\u0647 \u062f\u0631 \u0633\u0627\u0645\u0627\u0646\u0647\u200c\u0647\u0627' : 'Station Name in Systems';
  const { date } = useRahcomDate();
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const [systemsState, setSystemsState] = useState<{ province: string; rows: RahcomSystem[] } | null>(null);
  const systems = useMemo(
    () => systemsState?.province === selectedProvince ? systemsState.rows : [],
    [systemsState, selectedProvince],
  );
  const [billIdentifierWorkbookState, setBillIdentifierWorkbookState] = useState<{ province: string; workbook: BillIdentifierWorkbook | null } | null>(null);
  const [systemsRequestFinished, setSystemsRequestFinished] = useState(false);
  const loading = !systemsRequestFinished || systemsState?.province !== selectedProvince;
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [reviewOnly, setReviewOnly] = useState(false);
  const [trafficSnapshotState, setTrafficSnapshotState] = useState<{ province: string; date: string | null; snapshot: RahcomTrafficSnapshot | null } | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  const [systemPopupPosition, setSystemPopupPosition] = useState<{ top: number; left: number; maxWidth: number; maxHeight: number } | null>(null);
  const [systemPopupPanel, setSystemPopupPanel] = useState<'location' | 'history' | null>(null);
  const [editingSystemId, setEditingSystemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Pick<RahcomSystem, 'systemName' | 'systemCode' | 'latitude' | 'longitude' | 'details' | 'electricityBillId' | 'simIp' | 'radarIp' | 'cameraIp' | 'pcIp' | 'routerIp' | 'laptopIp' | 'incidentType' | 'incidentDetails' | 'longOutage' | 'longOutageReason' | 'longOutageDetails' | 'stationName' | 'aggregationCode' | 'axisCode' | 'announcedAxis'> | null>(null);
  const [savingSystem, setSavingSystem] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');
  const copyResetTimer = useRef<number | null>(null);
  const [systemsRevision, setSystemsRevision] = useState(0);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const { open: backupActionsOpen, toggle: toggleBackupActions } = useBackupActionsPreference();
  const [newSystemOpen, setNewSystemOpen] = useState(false);
  const [newSystemBusy, setNewSystemBusy] = useState(false);
  const [newSystemForm, setNewSystemForm] = useState({ systemName: '', systemCode: '', axisCode: '', announcedAxis: '', latitude: '', longitude: '', electricityBillId: '' });
  const [newSystemOptionalOpen, setNewSystemOptionalOpen] = useState(false);
  const [newSystemPosition, setNewSystemPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const t = useCallback((key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key), [locale]);
  const canEditSystems = canManage;
  const billIdentifierWorkbook = billIdentifierWorkbookState?.province === selectedProvince
    ? billIdentifierWorkbookState.workbook
    : null;

  useEffect(() => {
    const onSearch = (event: Event) => {
      const nextQuery = (event as CustomEvent<{ query?: string }>).detail?.query || '';
      setSearchDraft(nextQuery);
      setQuery(nextQuery);
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
      .then((result) => { if (active) { setSystemsState({ province: selectedProvince, rows: result }); setError(''); } })
      .catch((reason: unknown) => {
        if (active) {
          setSystemsState({ province: selectedProvince, rows: [] });
          setError(reason instanceof Error ? reason.message : t('rahcomSystemsLoadError'));
        }
      })
      .finally(() => { if (active) setSystemsRequestFinished(true); });
    return () => { active = false; };
  }, [selectedProvince, systemsRevision, t]);

  useEffect(() => {
    let active = true;
    void rahcomApi.trafficSnapshot(selectedProvince, date ?? undefined)
      .then((snapshot) => { if (active) setTrafficSnapshotState({ province: selectedProvince, date: date ?? null, snapshot }); })
      .catch(() => { if (active) setTrafficSnapshotState({ province: selectedProvince, date: date ?? null, snapshot: null }); });
    const onTrafficChanged = () => {
      void rahcomApi.trafficSnapshot(selectedProvince, date ?? undefined)
        .then((snapshot) => { if (active) setTrafficSnapshotState({ province: selectedProvince, date: date ?? null, snapshot }); })
        .catch(() => { if (active) setTrafficSnapshotState({ province: selectedProvince, date: date ?? null, snapshot: null }); });
    };
    window.addEventListener('rahyar:traffic-snapshot-changed', onTrafficChanged);
    return () => { active = false; window.removeEventListener('rahyar:traffic-snapshot-changed', onTrafficChanged); };
  }, [date, selectedProvince]);

  const trafficSnapshot = trafficSnapshotState?.province === selectedProvince && trafficSnapshotState.date === (date ?? null)
    ? trafficSnapshotState.snapshot
    : null;
  const trafficHeaders = Array.isArray(trafficSnapshot?.headers) ? trafficSnapshot.headers : [];
  const trafficRows = Array.isArray(trafficSnapshot?.rows) ? trafficSnapshot.rows : [];
  const theftDamageHeader = trafficHeaders.find((header) => {
    const normalized = normalizeTrafficHeader(header);
    return normalized.includes('\u0633\u0631\u0642\u062a') && normalized.includes('\u062a\u062e\u0631\u06cc\u0628');
  })?.trim() || '\u0633\u0631\u0642\u062a - \u062a\u062e\u0631\u06cc\u0628';
  const trafficDetailsBySystem = useMemo(() => {
    const details = new Map<string, { theftDamage: string[] }>();
    if (!trafficSnapshot) return details;
    const headers = trafficHeaders.map(normalizeTrafficHeader);
    const codeIndex = headers.findIndex((header) => header.includes(normalizeTrafficHeader('\u06a9\u062f \u0633\u0627\u0645\u0627\u0646\u0647')) || header.includes('systemcode') || header === 'code');
    if (codeIndex < 0) return details;
    const incidentIndexes = headers.flatMap((header, index) => header.includes('\u0633\u0631\u0642\u062a') || header.includes('\u062a\u062e\u0631\u06cc\u0628') || header.includes('theft') || header.includes('damage') ? [index] : []);
    for (const row of trafficRows) {
      const key = normalizeRahcomSystemCode(row[codeIndex] ?? '');
      if (!key) continue;
      const value = details.get(key) ?? { theftDamage: [] };
      for (const index of incidentIndexes) {
        const cellValue = String(row[index] ?? '').trim();
        if (isRahcomIncidentValue(cellValue) && !value.theftDamage.includes(cellValue)) value.theftDamage.push(cellValue);
      }
      details.set(key, value);
    }
    return details;
  }, [trafficSnapshot, trafficHeaders, trafficRows]);

  useEffect(() => {
    let active = true;
    if (selectedProvince !== 'all' && selectedProvince !== 'isfahan') return () => { active = false; };
    const token = getAccessToken();
    if (!token) return () => { active = false; };
    void fetch('/api/rahcom/bill-identifiers', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Bill identifiers unavailable');
        return await response.json() as BillIdentifierWorkbook;
      })
      .then((data) => { if (active) setBillIdentifierWorkbookState({ province: selectedProvince, workbook: data }); })
      .catch(() => { if (active) setBillIdentifierWorkbookState({ province: selectedProvince, workbook: null }); });
    return () => { active = false; };
  }, [selectedProvince]);

  useEffect(() => {
    if (!selectedSystemId) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setSelectedSystemId(null); setSystemPopupPanel(null); } };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [selectedSystemId]);

  useEffect(() => {
    if (!newSystemOpen) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !newSystemBusy) setNewSystemOpen(false); };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [newSystemBusy, newSystemOpen]);

  const deferredQuery = useDeferredValue(query);
  const searchableSystems = useMemo(() => systems.map((system) => {
    const axis = [system.axisCode, system.announcedAxis].filter(Boolean).join(' · ');
    const provinceLabel = provinceName(system.province);
    const searchable = [provinceLabel, system.province, axis || t('rahcomNoAxis'), system.announcedAxis, system.axisCode, system.systemName, system.systemCode, system.stationName, system.aggregationCode, system.details, system.incidentType, system.incidentDetails, system.electricityBillId, system.simIp, system.radarIp, system.cameraIp, system.pcIp, system.routerIp, system.laptopIp, system.latitude, system.longitude]
      .filter(Boolean).join(' ');
    return { system, axis, provinceLabel, searchable: normalizeRahcomSystemSearchText(searchable, locale) };
  }), [locale, systems, t]);
  const searchableById = useMemo(() => new Map(searchableSystems.map(({ system, searchable }) => [system.id, searchable])), [searchableSystems]);
  const electricityDetailsBySystem = useMemo(() => {
    const detailsBySystem = new Map<string, RahcomElectricityDetail[]>();
    if (!billIdentifierWorkbook) return detailsBySystem;
    const findColumn = (aliases: string[]) => billIdentifierWorkbook.headers.findIndex((header) => aliases.includes(normalizeBillIdentifierHeader(header)));
    const systemCodeIndex = findColumn(['\u06a9\u062f\u0633\u0627\u0645\u0627\u0646\u0647', '\u06a9\u062f\u0633\u06cc\u0633\u062a\u0645']);
    const billIdIndex = findColumn(['\u0634\u0646\u0627\u0633\u0647\u0642\u0628\u0636', '\u0634\u0646\u0627\u0633\u0647\u0642\u0628\u0636\u0628\u0631\u0642']);
    const meterBodyIndex = findColumn(['\u0634\u0645\u0627\u0631\u0647\u0628\u062f\u0646\u0647\u06a9\u0646\u062a\u0648\u0631']);
    if (systemCodeIndex < 0) return detailsBySystem;
    for (const row of billIdentifierWorkbook.rows) {
      const billId = billIdIndex >= 0 ? row[billIdIndex]?.trim() : '';
      const meterBody = meterBodyIndex >= 0 ? row[meterBodyIndex]?.trim() : '';
      if (!billId && !meterBody) continue;
      for (const code of splitBillSystemCodes(row[systemCodeIndex] ?? '')) {
        const key = normalizeRahcomSystemCode(code);
        const details = detailsBySystem.get(key) ?? [];
        if (billId) details.push({ label: '\u0634\u0646\u0627\u0633\u0647 \u0642\u0628\u0636 \u0628\u0631\u0642', value: billId });
        if (meterBody) details.push({ label: '\u0634\u0645\u0627\u0631\u0647 \u0628\u062f\u0646\u0647 \u06a9\u0646\u062a\u0648\u0631', value: meterBody });
        detailsBySystem.set(key, details);
      }
    }
    return detailsBySystem;
  }, [billIdentifierWorkbook]);
  const baseGroups = useMemo(() => {
    const grouped = new Map<string, { label: string; rows: RahcomSystem[] }>();
    for (const { system, axis, provinceLabel } of searchableSystems) {
      const label = axis || t('rahcomNoAxis');
      const axisCode = system.axisCode || '';
      const axisNameKey = normalizeRahcomSystemSearchText(
        system.announcedAxis ?? '',
        locale,
      );
      const key = `${system.province}:${axisCode || label}:${axisNameKey}`;
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

  async function uploadSystemsFile(file?: File, allowAllProvinces = false, keepBusy = false) {
    if (!file) return;
    if (!selectedProvince || (selectedProvince === 'all' && !allowAllProvinces)) { setError(t('rahcomProvince')); return; }
    setUploadBusy(true);
    setError('');
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error(t('rahcomSystemsFileTooLarge'));
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = firstSheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' }) : [];
      const normalize = (value: unknown) => String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c_\-./()]/g, '');
      const aliases: Record<string, string> = {
        name: 'systemName', systemname: 'systemName', [normalize('\u0646\u0627\u0645 \u0633\u0627\u0645\u0627\u0646\u0647')]: 'systemName', stationname: 'stationName', [normalize('\u0646\u0627\u0645 \u0627\u06cc\u0633\u062a\u06af\u0627\u0647')]: 'stationName',
        code: 'systemCode', systemcode: 'systemCode', sitecode: 'systemCode', stationcode: 'systemCode', id: 'systemCode', [normalize('\u06a9\u062f \u0633\u0627\u0645\u0627\u0646\u0647')]: 'systemCode', [normalize('\u06a9\u062f \u0627\u06cc\u0633\u062a\u06af\u0627\u0647')]: 'systemCode',
        latitude: 'latitude', lat: 'latitude', [normalize('\u0639\u0631\u0636')]: 'latitude', [normalize('\u0639\u0631\u0636 \u062c\u063a\u0631\u0627\u0641\u06cc\u0627\u06cc\u06cc')]: 'latitude', longitude: 'longitude', long: 'longitude', lng: 'longitude', lon: 'longitude', [normalize('\u0637\u0648\u0644')]: 'longitude', [normalize('\u0637\u0648\u0644 \u062c\u063a\u0631\u0627\u0641\u06cc\u0627\u06cc\u06cc')]: 'longitude',
        axis: 'announcedAxis', route: 'announcedAxis', announcedaxis: 'announcedAxis', [normalize('\u0645\u062d\u0648\u0631')]: 'announcedAxis', axiscode: 'axisCode', [normalize('\u06a9\u062f \u0645\u062d\u0648\u0631')]: 'axisCode', aggregationcode: 'aggregationCode', aggregation: 'aggregationCode', [normalize('\u06a9\u062f \u062a\u062c\u0645\u06cc\u0639')]: 'aggregationCode',
        electricitybillid: 'electricityBillId', simip: 'simIp', radarip: 'radarIp', cameraip: 'cameraIp', pcip: 'pcIp', routerip: 'routerIp', laptopip: 'laptopIp',
        longoutage: 'longOutage', longoutageenabled: 'longOutage', [normalize('\u0648\u0636\u0639\u06cc\u062a \u0642\u0637\u0639\u06cc \u0632\u0645\u0627\u0646\u200c\u0628\u0631')]: 'longOutage',
        longoutagereason: 'longOutageReason', outagecause: 'longOutageReason', [normalize('\u0628\u0631\u0686\u0633\u0628')]: 'longOutageReason', [normalize('\u0642\u0637\u0639\u06cc\u200c\u0647\u0627\u06cc \u0632\u0645\u0627\u0646\u200c\u0628\u0631')]: 'longOutageReason', [normalize('\u062f\u0644\u06cc\u0644 \u0642\u0637\u0639\u06cc \u0632\u0645\u0627\u0646\u200c\u0628\u0631')]: 'longOutageReason',
        longoutagedetails: 'longOutageDetails',
        [normalize('توضیحات دلیل')]: 'longOutageDetails',
        details: 'details', description: 'details', [normalize('\u062a\u0648\u0636\u06cc\u062d\u0627\u062a')]: 'details',
        incidenttype: 'incidentType', incidentdetails: 'incidentDetails', province: 'province', [normalize(t('rahcomProvince'))]: 'province',
        [normalize(t('rahcomIncidentType'))]: 'incidentType', [normalize(t('rahcomIncidentDetails'))]: 'incidentDetails',
      };
      const seenCodes = new Set<string>();
      let invalidRows = 0;
      const parsed = rows.flatMap((row) => {
        const values: Record<string, unknown> = {};
        Object.entries(row).forEach(([header, value]) => { const key = aliases[normalize(header)]; if (key) values[key] = value; });
        const systemCode = String(values.systemCode ?? '').trim();
        const systemName = String(values.systemName ?? '').trim() || systemCode;
        const toNumber = (value: unknown) => String(value ?? '').replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) >= 0x06f0 ? digit.charCodeAt(0) - 0x06f0 : digit.charCodeAt(0) - 0x0660)).replace(/[\u066b]/g, '.').trim();
        const latitudeText = toNumber(values.latitude);
        const longitudeText = toNumber(values.longitude);
        const hasLatitude = Boolean(latitudeText);
        const hasLongitude = Boolean(longitudeText);
        const latitude = hasLatitude ? Number(latitudeText) : null;
        const longitude = hasLongitude ? Number(longitudeText) : null;
        const longOutage = typeof values.longOutage === 'boolean' ? values.longOutage : /^(true|1|yes|بله|آری)$/i.test(String(values.longOutage ?? '').trim());
        const rawOutageReason = String(values.longOutageReason ?? '').trim();
        const outageReason = outageReasons.find(([value, label]) => value === rawOutageReason || normalize(label) === normalize(rawOutageReason))?.[0] ?? null;
        const outageDetails = String(values.longOutageDetails ?? '').trim();
        const normalizedCode = systemCode.normalize('NFKC').trim().toUpperCase();
        const rowProvince = selectedProvince === 'all' ? rahcomProvinceFromLabel(String(values.province ?? '').trim()) : selectedProvince;
        if (!rowProvince) { invalidRows += 1; return []; }
        if (selectedProvince !== 'all' && values.province && rahcomProvinceFromLabel(String(values.province)) !== selectedProvince) return [];
        if (!systemName || !normalizedCode || seenCodes.has(normalizedCode) || hasLatitude !== hasLongitude || (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) || (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) { invalidRows += 1; return []; }
        seenCodes.add(normalizedCode);
        const incidentType = String(values.incidentType ?? '').trim();
        return [{ province: rowProvince, system: { systemName, systemCode, stationName: String(values.stationName ?? '').trim(), aggregationCode: String(values.aggregationCode ?? '').trim(), latitude, longitude, longOutage: longOutage || Boolean(outageReason), longOutageReason: outageReason, longOutageDetails: outageDetails, incidentType: ['THEFT', 'DAMAGE', 'THEFT_AND_DAMAGE', 'WIDENING_RELOCATION'].includes(incidentType) ? incidentType : null, incidentDetails: String(values.incidentDetails ?? '').trim(), announcedAxis: String(values.announcedAxis ?? '').trim(), axisCode: String(values.axisCode ?? '').trim(), details: String(values.details ?? '').trim(), electricityBillId: String(values.electricityBillId ?? '').trim(), simIp: String(values.simIp ?? '').trim(), radarIp: String(values.radarIp ?? '').trim(), cameraIp: String(values.cameraIp ?? '').trim(), pcIp: String(values.pcIp ?? '').trim(), routerIp: String(values.routerIp ?? '').trim(), laptopIp: String(values.laptopIp ?? '').trim() } }];
      });
      if (invalidRows) throw new Error(t('rahcomSystemsImportInvalidRows'));
      if (!parsed.length) throw new Error(t('rahcomDataUploadHint'));
      const importRows = parsed.map(({ province, system }) => ({ ...system, province }));
      const payload = JSON.stringify({ systems: importRows });
      if (new TextEncoder().encode(payload).byteLength > 8 * 1024 * 1024)
        throw new Error(t('rahcomSystemsPayloadTooLarge'));
      await rahcomApi.importSystemsBatch(importRows);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('rahcomSystemsLoadError'));
    } finally { if (!keepBusy) setUploadBusy(false); }
  }

  async function restoreSystemsBackup() {
    if (uploadBusy || loading) return;
    if (selectedProvince !== 'isfahan' && selectedProvince !== 'all') { setError(t('rahcomProvince')); return; }
    const token = getAccessToken();
    if (!token) { setError(t('rahcomSystemsLoadError')); return; }
    setUploadBusy(true);
    setError('');
    try {
      const response = await fetch('/api/provinces/isfahan/systems?source=backup', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(t('rahcomSystemsLoadError'));
      const backup = new File([await response.arrayBuffer()], 'ESF-systems.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      await uploadSystemsFile(backup, true, true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('rahcomSystemsLoadError'));
    } finally { setUploadBusy(false); }
  }

  function createSystemsWorkbook() {
    const rows = systems.map((system) => ({
      [t('rahcomSystemCode')]: system.systemCode,
      [t('rahcomSystemName')]: system.systemName,
      [stationNameColumnLabel]: system.stationName ?? '',
      [t('rahcomAggregationCode')]: system.aggregationCode ?? '',
      [t('rahcomIncidentFilter')]: system.longOutageReason ?? '',
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
    return workbook;
  }

  function downloadSystems() {
    const workbook = createSystemsWorkbook();
    XLSX.writeFile(workbook, `rahcom-systems-${selectedProvince}.xlsx`);
  }

  // Keep the backup database-shaped: include station name and system-owned label/incident fields.
  // Theft/damage values from the daily traffic upload remain in that date's traffic snapshot.
  function createSystemsBackupWorkbook(systemRecords = systems) {
    const rows = systemRecords.map((system) => ({
      id: system.id,
      systemCode: system.systemCode,
      systemName: system.systemName,
      province: system.province,
      axisCode: system.axisCode ?? '',
      announcedAxis: system.announcedAxis ?? '',
      incidentType: system.incidentType ?? '',
      incidentDetails: system.incidentDetails ?? '',
      latitude: system.latitude,
      longitude: system.longitude,
      details: system.details ?? '',
      electricityBillId: system.electricityBillId ?? '',
      simIp: system.simIp ?? '',
      radarIp: system.radarIp ?? '',
      cameraIp: system.cameraIp ?? '',
      pcIp: system.pcIp ?? '',
      routerIp: system.routerIp ?? '',
      laptopIp: system.laptopIp ?? '',
      createdAt: system.createdAt,
      updatedAt: system.updatedAt,
      longOutage: system.longOutage,
      longOutageReason: system.longOutageReason ?? '',
      longOutageDetails: system.longOutageDetails ?? '',
      stationName: system.stationName ?? '',
      aggregationCode: system.aggregationCode ?? '',
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Systems');
    return workbook;
  }

  async function writeSystemsBackup(systemRecords = systems) {
    const workbook = createSystemsBackupWorkbook(systemRecords);
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const token = getAccessToken();
    if (!token) throw new Error(t('rahcomSystemsLoadError'));
    const response = await fetch('/api/provinces/isfahan/systems', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      body: bytes,
    });
    if (!response.ok) throw new Error(t('rahcomSystemsLoadError'));
  }

  async function saveSystemsBackup() {
    if (backupBusy) return;
    if (selectedProvince !== 'isfahan') { setError(t('rahcomProvince')); return; }
    setBackupBusy(true);
    setError('');
    try {
      const latestSystems = await rahcomApi.systems('isfahan');
      setSystemsState({ province: 'isfahan', rows: latestSystems });
      await writeSystemsBackup(latestSystems);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : t('rahcomSystemsLoadError'));
    } finally { setBackupBusy(false); }
  }

  function startEdit(system: RahcomSystem) {
    const workspaceBounds = document.querySelector<HTMLElement>('[data-workspace-main]')?.getBoundingClientRect()
      ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    const maxWidth = Math.max(240, Math.min(420, workspaceBounds.width - 24));
    const maxHeight = Math.max(180, Math.min(window.innerHeight * 0.85, workspaceBounds.height - 24));
    setSelectedSystemId(system.id);
    setSystemPopupPosition({
      top: workspaceBounds.top + Math.max(12, (workspaceBounds.height - maxHeight) / 2),
      left: workspaceBounds.left + Math.max(12, (workspaceBounds.width - maxWidth) / 2),
      maxWidth,
      maxHeight,
    });
    setEditingSystemId(system.id);
    setEditForm({ systemName: system.systemName, systemCode: system.systemCode, latitude: system.latitude, longitude: system.longitude, details: system.details ?? '', electricityBillId: system.electricityBillId ?? '', simIp: system.simIp ?? '', radarIp: system.radarIp ?? '', cameraIp: system.cameraIp ?? '', pcIp: system.pcIp ?? '', routerIp: system.routerIp ?? '', laptopIp: system.laptopIp ?? '', incidentType: system.incidentType, incidentDetails: system.incidentDetails ?? '', longOutage: system.longOutage, longOutageReason: system.longOutageReason ?? null, longOutageDetails: system.longOutageDetails ?? '', stationName: system.stationName ?? '', aggregationCode: system.aggregationCode ?? '', axisCode: system.axisCode ?? '', announcedAxis: system.announcedAxis ?? '' });
  }

  async function saveEdit(systemId: string) {
    if (!editForm) return;
    const latitude = editForm.latitude;
    const longitude = editForm.longitude;
    if (
      (latitude == null) !== (longitude == null) ||
      (latitude != null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
      (longitude != null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
    ) {
      setError(t('rahcomCoordinatesOptionalHint'));
      return;
    }
    setSavingSystem(true);
    try { await rahcomApi.updateSystem(systemId, editForm); setEditingSystemId(null); setEditForm(null); setSelectedSystemId(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('rahcomSystemUpdateFailed')); }
    finally { setSavingSystem(false); }
  }

  function openAddSystem() {
    const bounds = document.querySelector<HTMLElement>('[data-workspace-main]')?.getBoundingClientRect()
      ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    const width = Math.max(260, Math.min(440, bounds.width - 24));
    const maxHeight = Math.max(220, Math.min(window.innerHeight * 0.82, bounds.height - 24));
    setNewSystemPosition({ top: bounds.top + Math.max(12, (bounds.height - maxHeight) / 2), left: bounds.left + Math.max(12, (bounds.width - width) / 2), width, maxHeight });
    setNewSystemForm({ systemName: '', systemCode: '', axisCode: '', announcedAxis: '', latitude: '', longitude: '', electricityBillId: '' });
    setNewSystemOptionalOpen(false);
    setError('');
    setNewSystemOpen(true);
  }

  async function createSystem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedProvince === 'all') return;
    const hasLatitude = Boolean(newSystemForm.latitude.trim());
    const hasLongitude = Boolean(newSystemForm.longitude.trim());
    const latitude = hasLatitude ? Number(newSystemForm.latitude) : undefined;
    const longitude = hasLongitude ? Number(newSystemForm.longitude) : undefined;
    if (hasLatitude !== hasLongitude || (latitude !== undefined && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) || (longitude !== undefined && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
      setError(t('rahcomCoordinatesOptionalHint'));
      return;
    }
    setNewSystemBusy(true);
    setError('');
    try {
      await rahcomApi.createSystem({
        province: selectedProvince,
        systemName: newSystemForm.systemName.trim(),
        systemCode: newSystemForm.systemCode.trim(),
        axisCode: newSystemForm.axisCode.trim(),
        announcedAxis: newSystemForm.announcedAxis.trim(),
        ...(latitude !== undefined && longitude !== undefined ? { latitude, longitude } : {}),
        ...(newSystemForm.electricityBillId.trim() ? { electricityBillId: newSystemForm.electricityBillId.trim() } : {}),
      });
      setNewSystemOpen(false);
      setNewSystemForm({ systemName: '', systemCode: '', axisCode: '', announcedAxis: '', latitude: '', longitude: '', electricityBillId: '' });
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
  const allSystemRows = useMemo(() => groups.flatMap(([, , axisRows]) => axisRows.map((system) => ({
    system,
    axisCode: system.axisCode ?? '',
    axisName: system.announcedAxis || '',
    stationName: system.stationName ?? '',
    aggregationCode: system.aggregationCode ?? '',
  }))).sort((left, right) => left.axisName.localeCompare(right.axisName, locale, { numeric: true, sensitivity: 'base' }) || left.system.systemCode.localeCompare(right.system.systemCode, 'en', { numeric: true, sensitivity: 'base' })), [groups, locale]);
  const systemRows = reviewOnly
    ? allSystemRows.filter(({ system }) => {
      const trafficDetails = trafficDetailsBySystem.get(normalizeRahcomSystemCode(system.systemCode));
      return rahcomSystemHasLongOutage(system) || Boolean(system.incidentType) || Boolean(trafficDetails?.theftDamage.length);
    })
    : allSystemRows;
  return (
    <section aria-label={t('rahcomSystemsList')} className="rahcom-horizontal-overflow-page flex h-full min-h-0 w-full min-w-0 max-w-full flex-col gap-3 overflow-hidden">
      <RahcomToolbar className="rahcom-systems-toolbar rahcom-mobile-toolbar max-sm:-mb-2 flex shrink-0 flex-wrap items-center gap-2 overflow-visible sm:flex-nowrap sm:overflow-x-auto max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:overflow-y-hidden max-sm:pb-2">
        <RahcomHeaderDate compact />
        <RahcomTableCount label={`${numberFormatter.format(systems.length)} ${t('rahcomSystemsList')}`}><RahcomLocationIcon size={16} className="text-primary" />{numberFormatter.format(systems.length)}</RahcomTableCount>
        <SystemsSearchInput value={searchDraft} onChange={(value) => { setSearchDraft(value); startTransition(() => setQuery(value)); }} placeholder={t('rahcomSearchSystems')} clearLabel={t('searchClear')} />
        {/* Keep this as Compare: DB system labels + selected-day traffic incidents; its name/icon/filter are an approved invariant. */}
        <button type="button" aria-pressed={reviewOnly} aria-label={locale.startsWith('fa') ? '\u0645\u0642\u0627\u06cc\u0633\u0647' : 'Compare'} data-toolbar-label={locale.startsWith('fa') ? '\u0645\u0642\u0627\u06cc\u0633\u0647' : 'Compare'} title={locale.startsWith('fa') ? '\u0645\u0642\u0627\u06cc\u0633\u0647' : 'Compare'} onClick={() => setReviewOnly((value) => !value)} style={reviewOnly ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`grid size-9 shrink-0 place-items-center rounded-full border transition-colors ${reviewOnly ? '' : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-primary'}`}><RahcomCompareIcon aria-hidden="true" /></button>
        {canManage && selectedProvince !== 'all' && <button type="button" onClick={openAddSystem} aria-label={t('rahcomAddSystem')} title={t('rahcomAddSystem')} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary"><Plus size={17} aria-hidden="true" /></button>}
        <label aria-label={t('rahcomUploadExcel')} title={t('rahcomUploadExcel')} className={`grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground hover:bg-muted ${uploadBusy ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}>{uploadBusy ? <LoaderCircle size={17} className="animate-spin" /> : <Upload size={17} aria-hidden="true" />}<input type="file" accept=".xlsx,.xls" disabled={uploadBusy} className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void uploadSystemsFile(file); }} /></label>
        <button type="button" onClick={downloadSystems} aria-label={t('solarDownloadExcel')} title={t('solarDownloadExcel')} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground hover:bg-muted"><Download size={17} aria-hidden="true" /></button>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" aria-expanded={backupActionsOpen} aria-pressed={backupActionsOpen} aria-controls="systems-backup-actions" onClick={toggleBackupActions} aria-label={t('rahcomSaveSystemsBackup')} data-toolbar-label={locale.startsWith('fa') ? 'پشتیبان‌گیری' : 'Backup'} title={t('rahcomSaveSystemsBackup')} style={backupActionsOpen ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`grid size-9 shrink-0 place-items-center rounded-full border transition-colors ${backupActionsOpen ? '' : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-primary'}`}><span aria-hidden="true" className="size-[26px] bg-current" style={{ maskImage: "url(/cloud-sync-exact.svg)", WebkitMaskImage: "url(/cloud-sync-exact.svg)", maskSize: "contain", WebkitMaskSize: "contain", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat", maskPosition: "center", WebkitMaskPosition: "center" }} /></button>
          {backupActionsOpen && <div id="systems-backup-actions" className="flex items-center gap-2">
            <button type="button" onClick={() => void saveSystemsBackup()} disabled={backupBusy || loading || systems.length === 0 || selectedProvince !== 'isfahan'} aria-label={t('rahcomSaveSystemsBackup')} title={t('rahcomSaveSystemsBackup')} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground hover:border-primary hover:text-primary disabled:cursor-wait disabled:opacity-50">{backupBusy ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} aria-hidden="true" />}</button>
            <button type="button" onClick={() => void restoreSystemsBackup()} disabled={uploadBusy || loading || (selectedProvince !== 'isfahan' && selectedProvince !== 'all')} aria-label={t('rahcomRestoreSystemsBackup')} title={t('rahcomRestoreSystemsBackup')} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground hover:border-primary hover:text-primary disabled:cursor-wait disabled:opacity-50">{uploadBusy ? <LoaderCircle size={17} className="animate-spin" /> : <ArchiveRestore size={17} aria-hidden="true" />}</button>
          </div>}
        </div>

      </RahcomToolbar>
      {newSystemOpen && newSystemPosition && typeof document !== 'undefined' && createPortal(<div className="fixed inset-0 z-[1000] bg-transparent" onMouseDown={(event) => { if (event.target === event.currentTarget && !newSystemBusy) setNewSystemOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-label={t('rahcomAddSystem')} style={{ position: 'fixed', top: newSystemPosition.top, left: newSystemPosition.left, width: newSystemPosition.width, maxWidth: newSystemPosition.width, maxHeight: newSystemPosition.maxHeight, overflowY: 'auto', backgroundColor: 'var(--card)', opacity: 1 }} className="rounded-xl border border-border p-2 text-card-foreground shadow-2xl">
          <div className="rahcom-system-popup">
            <header className="rahcom-popup-header"><strong className="rahcom-popup-title">{t('rahcomAddSystem')}</strong><button type="button" onClick={() => setNewSystemOpen(false)} aria-label={t('rahcomCancel')} className="rahcom-popup-copy"><X size={16}/></button></header>
            <form onSubmit={(event) => void createSystem(event)} className="grid gap-3" aria-label={t('rahcomAddSystem')}>
              <div className="rahcom-popup-edit-fields">
                {([['systemCode', 'rahcomSystemCode', 'text'], ['systemName', 'rahcomSystemName', 'text'], ['axisCode', 'rahcomAxisCode', 'text'], ['announcedAxis', 'rahcomAxisName', 'text']] as const).map(([field, label, type]) => <label key={field}>{t(label)}<input required type={type} dir={field === 'systemCode' || field === 'axisCode' ? 'ltr' : undefined} value={newSystemForm[field]} onChange={(event) => setNewSystemForm((current) => ({ ...current, [field]: event.target.value }))} /></label>)}
              </div>
              <button type="button" aria-expanded={newSystemOptionalOpen} onClick={() => setNewSystemOptionalOpen((open) => !open)} className="inline-flex min-h-9 items-center gap-2 justify-self-start rounded-lg border border-border bg-background px-3 text-xs text-muted-foreground hover:text-foreground"><MapPin size={15}/>{t('rahcomOptionalSystemDetails')}</button>
              {newSystemOptionalOpen && <div className="grid gap-2 rounded-lg border border-border p-2">
                <div className="rahcom-popup-edit-fields">
                  {([['latitude', 'rahcomLatitude'], ['longitude', 'rahcomLongitude']] as const).map(([field, label]) => <label key={field}>{t(label)}<input type="number" step="any" inputMode="decimal" dir="ltr" value={newSystemForm[field]} onChange={(event) => setNewSystemForm((current) => ({ ...current, [field]: event.target.value }))} /></label>)}
                  <label className="col-span-2">{t('rahcomElectricityBillId')}<input dir="ltr" value={newSystemForm.electricityBillId} onChange={(event) => setNewSystemForm((current) => ({ ...current, electricityBillId: event.target.value }))} /></label>
                </div>
                <p className="text-[11px] text-muted-foreground">{t('rahcomCoordinatesOptionalHint')}</p>
              </div>}
              {error && <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-xs text-red-600 dark:text-red-300">{error}</div>}
              <div className="rahcom-popup-actions"><button type="button" onClick={() => setNewSystemOpen(false)} className="danger" title={t('rahcomCancel')} aria-label={t('rahcomCancel')}><X size={16}/></button><button type="submit" disabled={newSystemBusy} title={t('rahcomAdd')} aria-label={t('rahcomAdd')}>{newSystemBusy ? <LoaderCircle size={16} className="animate-spin"/> : <Plus size={16}/>}</button></div>
            </form>
          </div>
        </section>
      </div>, document.body)}
      {loading ? <div className="shrink-0 rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{t('rahcomSystemsLoading')}</div> : null}
      {error ? <div role="alert" className="shrink-0 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-300">{error}</div> : null}
      {!loading && !error && !anyRows ? <div className="shrink-0 rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{t('rahcomSystemsEmpty')}</div> : null}

      {(systemRows.length > 0 || reviewOnly) && <RahcomTableFrame className="rahcom-traffic-table-frame w-full min-w-0 max-w-full shadow-sm" viewportClassName="rahcom-contained-table-scroll w-full min-w-0 max-w-full">
          <DataTable className="rahcom-sticky-table rahcom-systems-table w-full min-w-max table-fixed border-separate border-spacing-0 text-sm">
            <colgroup><col style={{ width: '4rem' }} /><col style={{ width: '2.5rem' }} /><col style={{ width: '7rem' }} /><col style={{ width: '25rem' }} /><col style={{ width: '8rem' }} />{reviewOnly && <col style={{ width: '8rem' }} />}<col style={{ width: '25rem' }} /><col style={{ width: '7rem' }} /><col style={{ width: '5rem' }} /><col style={{ width: '15rem' }} /><col style={{ width: '9rem' }} /></colgroup>
            <thead className="text-xs text-muted-foreground"><tr>
              <th scope="col" style={{ backgroundColor: 'var(--card)', opacity: 1 }} className="sticky top-0 z-30 whitespace-nowrap border-b border-border bg-card px-3 py-2.5 text-center align-middle font-semibold">{t('rahcomRowNumber')}</th><th scope="col" className="sticky top-0 z-30 border-b border-border bg-card p-1 text-center"><RahcomInfoHeader /></th>
              {[t('rahcomSystemCode'), t('rahcomSystemName'), t('rahcomIncidentFilter')].map((heading) => <th key={heading} scope="col" style={{ backgroundColor: 'var(--card)', opacity: 1 }} className="sticky top-0 z-30 whitespace-nowrap border-b border-border bg-card px-3 py-2.5 text-center align-middle font-semibold">{heading}</th>)}{reviewOnly && <th scope="col" style={{ backgroundColor: 'var(--card)', opacity: 1 }} className="sticky top-0 z-30 whitespace-nowrap border-b border-border bg-card px-3 py-2.5 text-center align-middle font-semibold">{theftDamageHeader}</th>}{[stationNameColumnLabel, t('rahcomAggregationCode'), t('rahcomAxisCode'), t('rahcomAxisName'), t('rahcomProvince')].map((heading) => <th key={heading} scope="col" style={{ backgroundColor: 'var(--card)', opacity: 1 }} className="sticky top-0 z-30 whitespace-nowrap border-b border-border bg-card px-3 py-2.5 text-center align-middle font-semibold">{heading}</th>)}
            </tr></thead>
            <tbody>{systemRows.length === 0 ? <tr><td colSpan={reviewOnly ? 11 : 10} className="border-b border-border/70 p-5 text-center text-sm text-muted-foreground">{locale.startsWith('fa') ? 'موردی برای بازبینی در این تاریخ پیدا نشد.' : 'No review items were found for this date.'}</td></tr> : systemRows.map(({ system, axisCode, axisName, stationName, aggregationCode }, rowIndex) => {
              const trafficDetails = trafficDetailsBySystem.get(normalizeRahcomSystemCode(system.systemCode));
              const displayedOutageReason = rahcomSystemHasLongOutage(system)
                ? outageReasonLabel(system.longOutageReason) || system.longOutageDetails || '\u062f\u0644\u06cc\u0644 \u0645\u0634\u062e\u0635 \u0646\u0634\u062f\u0647'
                : '';
              const coordinatesKey = `${system.id}:coordinates`;
              return (
                <tr
                  key={system.id}
                  aria-selected={selectedSystemId === system.id}
                  className="odd:bg-background even:bg-muted/30"
                >
                  <td className="whitespace-nowrap border-b border-border/70 px-3 py-2 text-center align-middle tabular-nums text-foreground">{numberFormatter.format(rowIndex + 1)}</td>
                  <td className="border-b border-border/70 px-1 py-2 text-center align-middle"><RahcomRowInfo title={system.systemName} systemCode={system.systemCode} system={{ ...system, announcedAxis: axisName || system.announcedAxis, axisCode: axisCode || system.axisCode }} fields={[{ label: t('rahcomSystemCode'), value: system.systemCode }, { label: t('rahcomSystemName'), value: system.systemName }, { label: t('rahcomAxisName'), value: axisName }, { label: t('rahcomAxisCode'), value: axisCode }, { label: t('rahcomProvince'), value: provinceName(system.province) }]} electricityDetails={electricityDetailsBySystem.get(normalizeRahcomSystemCode(system.systemCode)) ?? []} onEdit={canEditSystems ? () => startEdit({ ...system, announcedAxis: axisName || system.announcedAxis, axisCode: axisCode || system.axisCode }) : undefined} /></td>
                  <td dir="ltr" className="whitespace-nowrap border-b border-border/70 px-3 py-2 text-center align-middle font-mono font-bold tracking-wide text-foreground">
                  {selectedSystemId === system.id && systemPopupPosition && typeof document !== 'undefined' ? createPortal(<div className="fixed inset-0 z-[100] bg-transparent" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedSystemId(null); }}>
                    <section role="dialog" aria-modal="true" aria-labelledby={`rahcom-system-title-${system.id}`} style={{ position: 'fixed', top: systemPopupPosition.top, left: systemPopupPosition.left, width: systemPopupPosition.maxWidth, maxWidth: systemPopupPosition.maxWidth, maxHeight: systemPopupPosition.maxHeight, overflowY: 'auto', backgroundColor: 'var(--card)', opacity: 1 }} className="rounded-xl border border-border p-2 shadow-2xl">
                      <div className="rahcom-system-popup">
                        {canEditSystems && editingSystemId === system.id && editForm ? <>
                          <header className="rahcom-popup-header"><strong className="rahcom-popup-title">{t('rahcomEditSystem')}</strong><button type="button" onClick={() => { setEditingSystemId(null); setEditForm(null); }} aria-label={t('rahcomCancel')} className="rahcom-popup-copy"><X size={16}/></button></header>
                          <div className="rahcom-popup-edit-fields">
                            <h3 className="col-span-2 border-b border-border/70 pb-1 text-xs font-semibold text-foreground">اطلاعات اصلی</h3>
                            <label>{t('rahcomSystemName')}<input value={editForm.systemName} onChange={(event) => setEditForm((current) => current ? { ...current, systemName: event.target.value } : current)} /></label>
                            <label>{t('rahcomSystemCode')}<input dir="ltr" value={editForm.systemCode} onChange={(event) => setEditForm((current) => current ? { ...current, systemCode: event.target.value } : current)} /></label>
                            <label>{t('rahcomStationName')}<input value={editForm.stationName ?? ''} onChange={(event) => setEditForm((current) => current ? { ...current, stationName: event.target.value } : current)} /></label>
                            <label>{t('rahcomAggregationCode')}<input dir="ltr" value={editForm.aggregationCode ?? ''} onChange={(event) => setEditForm((current) => current ? { ...current, aggregationCode: event.target.value } : current)} /></label>
                            <label>{t('rahcomAxisCode')}<input dir="ltr" value={editForm.axisCode ?? ''} onChange={(event) => setEditForm((current) => current ? { ...current, axisCode: event.target.value } : current)} /></label>
                            <label>{t('rahcomAxisName')}<input value={editForm.announcedAxis ?? ''} onChange={(event) => setEditForm((current) => current ? { ...current, announcedAxis: event.target.value } : current)} /></label>
                            <h3 className="col-span-2 border-b border-border/70 pb-1 pt-2 text-xs font-semibold text-foreground">موقعیت</h3>
                            {([['latitude', 'rahcomLatitude', -90, 90], ['longitude', 'rahcomLongitude', -180, 180]] as const).map(([field, label, min, max]) => <label key={field}>{t(label)}<input type="number" min={min} max={max} step="any" dir="ltr" value={editForm[field] ?? ''} onChange={(event) => setEditForm((current) => current ? { ...current, [field]: event.target.value === '' ? null : Number(event.target.value) } : current)} /></label>)}
                            <h3 className="col-span-2 border-b border-border/70 pb-1 pt-2 text-xs font-semibold text-foreground">برق و تجهیزات</h3>
                            {([['electricityBillId', 'rahcomElectricityBillId'], ['simIp', 'rahcomSimIp'], ['radarIp', 'rahcomRadarIp'], ['cameraIp', 'rahcomCameraIp'], ['pcIp', 'rahcomPcIp'], ['routerIp', 'rahcomRouterIp'], ['laptopIp', 'rahcomLaptopIp']] as const).map(([field, label]) => <label key={field}>{t(label)}<input dir="ltr" value={editForm[field] ?? ''} onChange={(event) => setEditForm((current) => current ? { ...current, [field]: event.target.value } : current)} /></label>)}
                            <h3 className="col-span-2 border-b border-border/70 pb-1 pt-2 text-xs font-semibold text-foreground">وضعیت و توضیحات</h3>
                            <label>{t('solarSpecialCategory')}<select value={editForm.incidentType ?? ''} onChange={(event) => setEditForm((current) => current ? { ...current, incidentType: (event.target.value || null) as typeof current.incidentType } : current)}><option value="">—</option><option value="THEFT">{t('rahcomIncidentTheft')}</option><option value="DAMAGE">{t('rahcomIncidentDamage')}</option><option value="THEFT_AND_DAMAGE">{t('rahcomIncidentBoth')}</option><option value="WIDENING_RELOCATION">{t('solarWideningRelocation')}</option></select></label>
                            <label className="col-span-2">{t('rahcomIncidentDetails')}<textarea maxLength={1000} value={editForm.incidentDetails ?? ''} onChange={(event) => setEditForm((current) => current ? { ...current, incidentDetails: event.target.value } : current)} /></label>
                            <label>{t('rahcomIncidentFilter')}<select value={editForm.longOutageReason ?? ''} onChange={(event) => setEditForm((current) => current ? { ...current, longOutageReason: (event.target.value || null) as typeof current.longOutageReason, longOutage: Boolean(event.target.value), longOutageDetails: event.target.value === 'OTHER' ? current.longOutageDetails : '' } : current)}><option value="">ندارد</option>{outageReasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                            {editForm.longOutageReason === 'OTHER' && <label className="col-span-2">شرح مورد دیگر<textarea maxLength={1000} value={editForm.longOutageDetails ?? ''} onChange={(event) => setEditForm((current) => current ? { ...current, longOutageDetails: event.target.value } : current)} /></label>}
                            <label className="col-span-2">{t('rahcomDescription')}<textarea maxLength={5000} value={editForm.details ?? ''} onChange={(event) => setEditForm((current) => current ? { ...current, details: event.target.value } : current)} /></label>
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
                            {hasRahcomCoordinates(system) && <button type="button" data-popup-action="route" aria-expanded={systemPopupPanel === 'location'} onClick={() => setSystemPopupPanel((panel) => panel === 'location' ? null : 'location')} title={t('rahcomRoute')} aria-label={t('rahcomRoute')}><MapPin size={16}/></button>}
                            {!system.id.startsWith('traffic-') && <button type="button" data-popup-action="history" aria-expanded={systemPopupPanel === 'history'} onClick={() => setSystemPopupPanel((panel) => panel === 'history' ? null : 'history')} title={t('rahcomHistory')} aria-label={t('rahcomHistory')}><ClipboardList size={16}/></button>}
                            {canEditSystems && <button type="button" data-popup-action="edit" onClick={() => startEdit(system)} title={t('rahcomEditSystem')} aria-label={t('rahcomEditSystem')}><FilePenLine size={16}/></button>}
                          </div>
                          {systemPopupPanel === 'location' && hasRahcomCoordinates(system) && <div className="mt-1 grid gap-1.5 rounded-lg border border-border bg-background p-2 text-xs">
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
                  <td className="overflow-hidden text-ellipsis whitespace-nowrap border-b border-border/70 px-3 py-2 text-center align-middle font-semibold text-foreground">{system.systemName}</td>
                  <td className="group relative border-b border-border/70 px-3 py-2 text-center align-middle text-foreground">
                    <div className="flex min-h-8 items-center justify-center gap-1.5">
                      <span className="truncate">{displayedOutageReason || '—'}</span>
                    </div>
                  </td>
                  {reviewOnly && <td className="border-b border-border/70 px-3 py-2 text-center align-middle text-foreground">{trafficDetails?.theftDamage.join('\u060c ') || '\u2014'}</td>}
                  <td className="overflow-hidden text-ellipsis whitespace-nowrap border-b border-border/70 px-3 py-2 text-center align-middle text-foreground">{stationName || '—'}</td>
                  <td dir="ltr" className="whitespace-nowrap border-b border-border/70 px-3 py-2 text-center align-middle font-mono text-foreground">{aggregationCode || '—'}</td>
                  <td dir="ltr" className="whitespace-nowrap border-b border-border/70 px-3 py-2 text-center align-middle font-mono text-foreground">{axisCode || '—'}</td>
                  <td className="overflow-hidden text-ellipsis whitespace-nowrap border-b border-border/70 px-3 py-2 text-center align-middle text-foreground">{axisName || '—'}</td>
                  <td className="whitespace-nowrap border-b border-border/70 px-3 py-2 text-center align-middle text-foreground">{provinceName(system.province)}</td>
                </tr>
              );
            })}</tbody>
          </DataTable>
      </RahcomTableFrame>}

    </section>
  );
}
