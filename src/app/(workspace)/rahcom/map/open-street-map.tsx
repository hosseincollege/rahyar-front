'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CircleMarker, LayerGroup, Map as LeafletMap, Marker, TileLayer } from 'leaflet';
import type { Feature, Polygon } from 'geojson';
import { Compass, Map as MapIcon, MapPinned, Navigation, X } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import 'leaflet/dist/leaflet.css';
import { formatRahcomCoordinates, rahcomApi, type RahcomImportedTicket, type RahcomRoadListSnapshot, type RahcomSolarSnapshot, type RahcomSystem, type RahcomTrafficSnapshot } from '@/lib/api/rahcom/rahcom-api';
import { getCurrentUser } from '@/lib/api/shared/auth-api';
import { RahcomSystemHistory } from '@/app/(workspace)/rahcom/_shared/rahcom-system-history';
import { rahcomAxisColor } from '@/lib/api/rahcom/rahcom-axes';
import { failedRahcomSystemCodes, failedRahcomSystemKeys, rahcomSystemKey, rahcomProvinceFromLabel, isRahcomIncidentValue, latestRahcomSolarSnapshotForToday, tehranDateKey } from '@/lib/api/rahcom/solar-status';
import { useRahcomDate } from '@/app/(workspace)/rahcom/_shared/rahcom-date';
import { openRahcomRowInfo } from '@/app/(workspace)/rahcom/_shared/rahcom-row-info';

type Point = { lat: number; lng: number };
type PopupLabels = {
  name: string; code: string; axisCode: string; announcedAxis: string; latitude: string; longitude: string; copy: string; copyCoordinates: string; copied: string;
  electricityBillId: string; simIp: string; radarIp: string; cameraIp: string; pcIp: string; routerIp: string; laptopIp: string;
  edit: string; save: string; cancel: string; close: string; remove: string; route: string; history: string;
  dragHint: string; deleteConfirm: string; updateFailed: string; deleteFailed: string;
};

function routeUrl(provider: 'osm' | 'google' | 'neshan' | 'balad', system: RahcomSystem, from: Point | null) {
  const destination = `${system.latitude},${system.longitude}`;
  if (provider === 'google') return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  if (provider === 'neshan') return `https://nshn.ir/?destination=${encodeURIComponent(destination)}`;
  if (provider === 'balad') return `https://balad.ir/directions/driving?destination=${encodeURIComponent(`${system.longitude},${system.latitude}`)}#16/${system.latitude}/${system.longitude}`;
  const route = from ? `${from.lat},${from.lng};${destination}` : `;${destination}`;
  const center = from ? `${(from.lat + system.latitude) / 2}/${(from.lng + system.longitude) / 2}` : `${system.latitude}/${system.longitude}`;
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${encodeURIComponent(route)}#map=10/${center}`;
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}

function hasRegisteredMapLocation(system: Pick<RahcomSystem, 'latitude' | 'longitude'>) {
  return Number.isFinite(system.latitude) && Number.isFinite(system.longitude)
    && system.latitude >= -90 && system.latitude <= 90
    && system.longitude >= -180 && system.longitude <= 180
    && !(system.latitude === 0 && system.longitude === 0);
}

const popupIcons = {
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>',
  copySheets: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="13" height="13" rx="2"/><rect x="3" y="3" width="13" height="13" rx="2"/></svg>',
  coordinates: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>',
  route: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 19-9-9 19-2-8-8-2Z"/></svg>',
  history: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>',
  save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg>',
  delete: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/></svg>',
} as const;

function systemPopupHtml(system: RahcomSystem, axisName: string, labels: PopupLabels, canManage: boolean, editing: boolean, status: string, copiedValue = '') {
  const copyButton = (value: string, label: string, icon: string = popupIcons.copy) => `<button type="button" class="rahcom-popup-copy" data-copy-value="${escapeHtml(value).replace(/\r?\n/g, '&#10;')}" aria-label="${escapeHtml(copiedValue === value ? labels.copied : label)}" title="${escapeHtml(copiedValue === value ? labels.copied : label)}">${copiedValue === value ? popupIcons.save : icon}</button>`;
  const coordinatePair = formatRahcomCoordinates(system.latitude, system.longitude);
  const axisCode = system.axisCode?.trim() ?? '';
  const resolvedAxisName = axisName.trim();
  const systemDetails = `${labels.code}: ${system.systemCode}\n${labels.name}: ${system.systemName}\n${labels.announcedAxis}: ${resolvedAxisName || '—'}${axisCode ? ` / ${axisCode}` : ''}`;
  const editFields = editing && canManage ? `<div class="rahcom-popup-edit-fields">
    <label>${escapeHtml(labels.name)}<input data-system-field="systemName" value="${escapeHtml(system.systemName)}"></label>
    <label>${escapeHtml(labels.code)}<input data-system-field="systemCode" dir="ltr" value="${escapeHtml(system.systemCode)}"></label>
    <label>${escapeHtml(labels.axisCode)}<input data-system-field="axisCode" dir="ltr" value="${escapeHtml(axisCode)}"></label>
    <label>${escapeHtml(labels.latitude)}<input data-system-field="latitude" dir="ltr" inputmode="decimal" value="${system.latitude}"></label>
    <label>${escapeHtml(labels.longitude)}<input data-system-field="longitude" dir="ltr" inputmode="decimal" value="${system.longitude}"></label>
  </div>` : '';
  const axisRows = `<div class="rahcom-popup-data"><div class="rahcom-popup-row rahcom-popup-axis"><span>${escapeHtml(labels.announcedAxis)}:</span><b class="rahcom-popup-axis-value"><span>${escapeHtml(resolvedAxisName || '—')}</span>${axisCode ? `<span aria-hidden="true">/</span><bdi dir="ltr">${escapeHtml(axisCode)}</bdi>` : ''}</b></div></div>`;
  const actions = editing && canManage
    ? `${editFields}<p class="rahcom-popup-hint">${escapeHtml(labels.dragHint)}</p><div class="rahcom-popup-actions"><button type="button" data-popup-action="save" aria-label="${escapeHtml(labels.save)}" title="${escapeHtml(labels.save)}">${popupIcons.save}</button><button type="button" data-popup-action="cancel" aria-label="${escapeHtml(labels.cancel)}" title="${escapeHtml(labels.cancel)}">${popupIcons.close}</button><button type="button" data-popup-action="delete" class="danger" aria-label="${escapeHtml(labels.remove)}" title="${escapeHtml(labels.remove)}">${popupIcons.delete}</button></div>`
    : `<div class="rahcom-popup-actions">${copyButton(coordinatePair, labels.copyCoordinates, popupIcons.coordinates)}${canManage ? `<button type="button" data-popup-action="edit" aria-label="${escapeHtml(labels.edit)}" title="${escapeHtml(labels.edit)}">${popupIcons.edit}</button>` : ''}<button type="button" data-popup-action="route" aria-label="${escapeHtml(labels.route)}" title="${escapeHtml(labels.route)}">${popupIcons.route}</button><button type="button" data-popup-action="history" aria-label="${escapeHtml(labels.history)}" title="${escapeHtml(labels.history)}">${popupIcons.history}</button></div>`;
  const header = `<header class="rahcom-popup-header"><div class="rahcom-popup-heading"><span class="rahcom-popup-code"><strong class="rahcom-popup-subtitle" dir="ltr">${escapeHtml(system.systemCode)}</strong>${copyButton(system.systemCode, labels.copy, popupIcons.copySheets)}</span><strong class="rahcom-popup-title">${escapeHtml(system.systemName)}</strong></div><div class="rahcom-popup-header-actions">${copyButton(systemDetails, labels.copy)}<button type="button" class="rahcom-popup-copy" data-popup-action="close" aria-label="${escapeHtml(labels.close)}" title="${escapeHtml(labels.close)}">${popupIcons.close}</button></div></header>`;
  return `<div class="rahcom-system-popup" dir="rtl">${header}${editing && canManage ? '' : axisRows}<div data-popup-status role="status" class="rahcom-popup-status">${escapeHtml(status)}</div>${actions}</div>`;
}

function getStoredProvince() {
  if (typeof window === 'undefined') return 'isfahan';
  const userId = getCurrentUser()?.id;
  return window.localStorage.getItem(`rahyar-selected-province:${userId || 'current'}`) || 'isfahan';
}

export type UnmappedSolarDetail = { code: string; reason: 'unregistered' | 'no-coordinates' };
export type IncidentMapSummary = { totalCodes: number; mappedCodes: number; details: UnmappedSolarDetail[] };

export function OpenStreetMap({ focusProvince, canManage = false, mapSourceFilterActive = false, mapFilterSource = 'none', selectedSolarSnapshotId = '', showMapIncidents = true, onLocateMeReady, onAxisOptionsChange, onSystemsCountChange, onUnmappedSolarCountChange, onUnmappedSolarDetailsChange, onIncidentCountChange, onIncidentMapSummaryChange, onSystemsErrorChange, onLocationStatusChange, onSolarSnapshotsChange }: {
  focusProvince: boolean;
  canManage?: boolean;
  mapSourceFilterActive?: boolean;
  mapFilterSource?: 'none' | 'traffic' | 'road-list' | 'solar' | 'tickets' | 'aggregate';
  selectedSolarSnapshotId?: string;
  showMapIncidents?: boolean;
  onLocateMeReady?: (locate: (() => void) | null) => void;
  onAxisOptionsChange?: (axes: string[]) => void;
  onSystemsCountChange?: (count: number) => void;
  onUnmappedSolarCountChange?: (count: number) => void;
  onUnmappedSolarDetailsChange?: (details: UnmappedSolarDetail[]) => void;
  onIncidentCountChange?: (count: number) => void;
  onIncidentMapSummaryChange?: (summary: IncidentMapSummary) => void;
  onSystemsErrorChange?: (error: string) => void;
  onLocationStatusChange?: (status: { locating: boolean; error: boolean }) => void;
  onSolarSnapshotsChange?: (snapshots: RahcomSolarSnapshot[] | null) => void;
}) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);
  const currentMarker = useRef<CircleMarker | null>(null);
  const systemsLayer = useRef<LayerGroup | null>(null);
  const systemMarkers = useRef<Map<string, Marker>>(new Map());
  const fittedProvince = useRef<string | null>(null);
  const fittedSystemsView = useRef('');
  const [mapReady, setMapReady] = useState(false);
  const [location, setLocation] = useState<Point | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [province, setProvince] = useState(getStoredProvince);
  const [systems, setSystems] = useState<RahcomSystem[]>([]);
  const [solarSnapshots, setSolarSnapshots] = useState<RahcomSolarSnapshot[]>([]);
  const [trafficSnapshot, setTrafficSnapshot] = useState<RahcomTrafficSnapshot | null>(null);
  const [roadListSnapshot, setRoadListSnapshot] = useState<RahcomRoadListSnapshot | null>(null);
  const [mapTickets, setMapTickets] = useState<RahcomImportedTicket[]>([]);
  const [solarSnapshotsLoaded, setSolarSnapshotsLoaded] = useState(false);
  const [todayDateKey, setTodayDateKey] = useState(() => tehranDateKey());
  const [systemsRevision, setSystemsRevision] = useState(0);
  const [routeSystem, setRouteSystem] = useState<RahcomSystem | null>(null);
  const [historySystem, setHistorySystem] = useState<RahcomSystem | null>(null);
  const [systemsError, setSystemsError] = useState('');
  const { resolvedTheme } = useTheme();
  const { locale } = usePreferences();
  const { date } = useRahcomDate();
  const t = useCallback((key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key), [locale]);
  const activeAxisBySystem = useMemo(() => {
    const labels = new Map<string, string>();
    for (const system of systems) {
      const label = [system.axisCode?.trim(), system.announcedAxis?.trim()].filter(Boolean).join(' - ');
      if (label) labels.set(rahcomSystemKey(system.province, system.systemCode), label);
    }
    return labels;
  }, [systems]);
  const axisOptions = useMemo(() => [...new Set(activeAxisBySystem.values())].sort((left, right) => left.localeCompare(right, 'en', { numeric: true, sensitivity: 'base' })), [activeAxisBySystem]);
  const todaySolarSnapshot = useMemo(() => latestRahcomSolarSnapshotForToday(solarSnapshots, date || todayDateKey), [solarSnapshots, date, todayDateKey]);
  const selectedSolarSnapshot = solarSnapshots.find((snapshot) => snapshot.id === selectedSolarSnapshotId && tehranDateKey(snapshot.capturedAt) === (date || todayDateKey)) ?? todaySolarSnapshot;
  const failedSolarCodes = useMemo(() => selectedSolarSnapshot ? failedRahcomSystemCodes(selectedSolarSnapshot) : new Set<string>(), [selectedSolarSnapshot]);
  const solarStatusCodes = useMemo(() => selectedSolarSnapshot
    ? failedRahcomSystemKeys([selectedSolarSnapshot], systems, tehranDateKey(selectedSolarSnapshot.capturedAt), province)
    : new Set<string>(), [selectedSolarSnapshot, systems, province]);
  const incidentSolarCodes = useMemo(() => {
    const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[\s\u200c_./-]/g, '');
    const headers = trafficSnapshot?.headers ?? [];
    const codeIndex = headers.findIndex((value) => { const key = normalize(value); return key.includes('\u06a9\u062f\u0633\u0627\u0645\u0627\u0646\u0647') || key.includes('systemcode'); });
    const incidentIndexes = headers.flatMap((value, index) => { const key = normalize(value); return ['\u0633\u0631\u0642\u062a', '\u062a\u062e\u0631\u06cc\u0628', '\u062a\u0639\u0631\u06cc\u0636', '\u062c\u0627\u0628\u062c\u0627\u06cc\u06cc', 'theft', 'damage', 'widening', 'relocation'].some((term) => key.includes(normalize(term))) ? [index] : []; });
    if (codeIndex < 0 || incidentIndexes.length === 0) return new Set<string>();
    const provinceIndex = headers.findIndex((value) => /province|\u0627\u0633\u062a\u0627\u0646/i.test(value));
    const codes = new Set<string>();
    for (const row of trafficSnapshot?.rows ?? []) {
      if (!incidentIndexes.some((index) => isRahcomIncidentValue(row[index]))) continue;
      const code = (row[codeIndex] ?? '').normalize('NFKC').trim().toUpperCase();
      if (!code) continue;
      const rawProvince = provinceIndex >= 0 ? row[provinceIndex]?.trim() : '';
      const rowProvince = rawProvince ? rahcomProvinceFromLabel(rawProvince) : null;
      if (rawProvince && !rowProvince) continue;
      if (rowProvince && province !== 'all' && rowProvince !== province) continue;
      const matchProvince = rowProvince || (province !== 'all' ? province : '');
      const matches = systems.filter((system) => system.systemCode.normalize('NFKC').trim().toUpperCase() === code && (!matchProvince || system.province === matchProvince));
      // The traffic snapshot is province-scoped. Retain an unmatched code only when it
      // also exists in the selected Solar snapshot so the incident toggle can hide it.
      if (matches.length || failedSolarCodes.has(code)) codes.add(code);
    }
    return codes;
  }, [trafficSnapshot, systems, province, failedSolarCodes]);
  const solarCandidateCodes = useMemo(() => {
    const codes = new Set(failedSolarCodes);
    if (showMapIncidents) incidentSolarCodes.forEach((code) => codes.add(code));
    else incidentSolarCodes.forEach((code) => codes.delete(code));
    return codes;
  }, [failedSolarCodes, incidentSolarCodes, showMapIncidents]);
  const unmappedSolarDetails = useMemo<UnmappedSolarDetail[]>(() => {
    if (!mapSourceFilterActive || mapFilterSource !== 'solar' || !selectedSolarSnapshot) return [];
    const snapshotProvince = selectedSolarSnapshot.province || province;
    const normalizeCode = (value: string) => value.normalize('NFKC').trim().toUpperCase();
    const details: UnmappedSolarDetail[] = [];
    for (const code of solarCandidateCodes) {
      const matches = systems.filter((system) => normalizeCode(system.systemCode) === code
        && (snapshotProvince === 'all' || system.province === snapshotProvince));
      if (!matches.length) details.push({ code, reason: 'unregistered' });
      else if (!matches.some(hasRegisteredMapLocation)) details.push({ code, reason: 'no-coordinates' });
    }
    return details.sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
  }, [mapSourceFilterActive, mapFilterSource, selectedSolarSnapshot, province, systems, solarCandidateCodes]);
  const unmappedSolarCount = unmappedSolarDetails.length;
  const incidentCodes = useMemo(() => {
    const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[\s\u200c_./-]/g, '');
    const headers = trafficSnapshot?.headers ?? [];
    const codeIndex = headers.findIndex((value) => { const key = normalize(value); return key.includes('\u06a9\u062f\u0633\u0627\u0645\u0627\u0646\u0647') || key.includes('systemcode'); });
    const incidentIndexes = headers.flatMap((value, index) => { const key = normalize(value); return ['\u0633\u0631\u0642\u062a', '\u062a\u062e\u0631\u06cc\u0628', '\u062a\u0639\u0631\u06cc\u0636', '\u062c\u0627\u0628\u062c\u0627\u06cc\u06cc', 'theft', 'damage', 'widening', 'relocation'].some((term) => key.includes(normalize(term))) ? [index] : []; });
    if (codeIndex < 0 || incidentIndexes.length === 0) return new Set<string>();
    const provinceIndex = headers.findIndex((value) => /province|\u0627\u0633\u062a\u0627\u0646/i.test(value));
    const keys = new Set<string>();
    for (const row of trafficSnapshot?.rows ?? []) {
      if (!incidentIndexes.some((index) => isRahcomIncidentValue(row[index]))) continue;
      const code = (row[codeIndex] ?? '').trim().toUpperCase();
      const rawProvince = provinceIndex >= 0 ? row[provinceIndex]?.trim() : '';
      const rowProvince = rawProvince ? rahcomProvinceFromLabel(rawProvince) : null;
      if (rawProvince && !rowProvince) continue;
      const matchProvince = rowProvince || province;
      const matches = systems.filter((system) => system.systemCode.trim().toUpperCase() === code && (!matchProvince || system.province === matchProvince));
      if (!matchProvince && matches.length !== 1) continue;
      for (const system of matches) keys.add(rahcomSystemKey(system.province, code));
    }
    return keys;
  }, [trafficSnapshot, systems, province]);
  const incidentMapSummary = useMemo<IncidentMapSummary>(() => {
    const normalize = (value: string) => value.normalize('NFKC').trim().toUpperCase();
    const normalizeHeader = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\u200c_./-]/g, '');
    const headers = trafficSnapshot?.headers ?? [];
    const codeIndex = headers.findIndex((value) => { const key = normalizeHeader(value); return key.includes('\u06a9\u062f\u0633\u0627\u0645\u0627\u0646\u0647') || key.includes('systemcode'); });
    const incidentIndexes = headers.flatMap((value, index) => { const key = normalizeHeader(value); return ['\u0633\u0631\u0642\u062a', '\u062a\u062e\u0631\u06cc\u0628', '\u062a\u0639\u0631\u06cc\u0636', '\u062c\u0627\u0628\u062c\u0627\u06cc\u06cc', 'theft', 'damage', 'widening', 'relocation'].some((term) => key.includes(normalizeHeader(term))) ? [index] : []; });
    const provinceIndex = headers.findIndex((value) => /province|\u0627\u0633\u062a\u0627\u0646/i.test(value));
    const codes = new Set<string>();
    if (codeIndex >= 0 && incidentIndexes.length) for (const row of trafficSnapshot?.rows ?? []) {
      if (!incidentIndexes.some((index) => isRahcomIncidentValue(row[index]))) continue;
      const code = normalize(row[codeIndex] ?? '');
      if (!code) continue;
      const rawProvince = provinceIndex >= 0 ? row[provinceIndex]?.trim() ?? '' : '';
      const rowProvince = rawProvince ? rahcomProvinceFromLabel(rawProvince) : null;
      if (rawProvince && !rowProvince) continue;
      if (rowProvince && province !== 'all' && rowProvince !== province) continue;
      codes.add(code);
    }
    const details: UnmappedSolarDetail[] = [];
    const mappedCodes = new Set<string>();
    for (const code of codes) {
      const matches = systems.filter((system) => normalize(system.systemCode) === code && (province === 'all' || system.province === province));
      if (!matches.length) details.push({ code, reason: 'unregistered' });
      else if (matches.some(hasRegisteredMapLocation)) mappedCodes.add(code);
      else details.push({ code, reason: 'no-coordinates' });
    }
    details.sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
    return { totalCodes: codes.size, mappedCodes: mappedCodes.size, details };
  }, [trafficSnapshot, systems, province]);
  const trafficNoTrafficCodes = useMemo(() => {
    const normalize = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa').replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) >= 0x06f0 ? digit.charCodeAt(0) - 0x06f0 : digit.charCodeAt(0) - 0x0660)).replace(/[\u200c\s]/g, '');
    const headers = trafficSnapshot?.headers ?? [];
    const codeIndex = headers.findIndex((header) => { const key = normalize(header); return key.includes('\u06a9\u062f\u0633\u0627\u0645\u0627\u0646\u0647') || key.includes('systemcode'); });
    const crmIndex = headers.findIndex((header) => { const key = normalize(header); return key.includes('crm') && (key.includes(normalize('\u062a\u0631\u062f\u062f')) || key.includes('traffic')) && (key.includes(normalize('\u0644\u062d\u0638\u0647\u0627\u06cc')) || key.includes('realtime') || key.includes('real-time')); });
    const provinceIndex = headers.findIndex((header) => { const key = normalize(header); return key.includes('province') || key.includes('\u0627\u0633\u062a\u0627\u0646'); });
    const systemsByCode = new Map<string, RahcomSystem[]>();
    for (const system of systems) { const code = system.systemCode.normalize('NFKC').trim().toUpperCase(); systemsByCode.set(code, [...(systemsByCode.get(code) ?? []), system]); }
    const codes = new Set<string>();
    if (codeIndex < 0 || crmIndex < 0) return codes;
    const isNoTraffic = (value: string) => {
      const normalized = normalize(value);
      return normalized.includes(normalize('\u0628\u062f\u0648\u0646 \u062a\u0631\u062f\u062f')) || normalized.includes('notraffic') || normalized.includes('norealtime');
    };
    for (const row of trafficSnapshot?.rows ?? []) {
      if (!isNoTraffic(row[crmIndex] ?? '')) continue;
      const code = (row[codeIndex] ?? '').normalize('NFKC').trim().toUpperCase();
      const candidates = systemsByCode.get(code) ?? [];
      const rawProvince = provinceIndex >= 0 ? row[provinceIndex]?.trim() ?? '' : '';
      const rowProvince = rawProvince ? rahcomProvinceFromLabel(rawProvince) : null;
      const matches = rawProvince ? rowProvince ? candidates.filter((system) => system.province === rowProvince) : [] : candidates.length === 1 ? candidates : [];
      matches.forEach((system) => codes.add(rahcomSystemKey(system.province, system.systemCode)));
    }
    return codes;
  }, [trafficSnapshot, systems]);
  const roadListCodes = useMemo(() => {
    const systemCodes = new Map(systems.map((system) => [system.systemCode.trim().toUpperCase(), rahcomSystemKey(system.province, system.systemCode)]));
    const codes = new Set<string>();
    const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\u200c_./-]/g, '');
    const roadHeaders = roadListSnapshot?.headers ?? [];
    const identifierIndex = roadHeaders.findIndex((header) => normalize(header).includes('\u0634\u0646\u0627\u0633\u0647') || normalize(header) === 'id');
    const trafficHeaders = trafficSnapshot?.headers ?? [];
    const aggregationIndex = trafficHeaders.findIndex((header) => { const key = normalize(header); return key.includes('\u06a9\u062f\u062a\u062c\u0645\u06cc\u0639') || key.includes('aggregationcode') || key.includes('aggregatecode'); });
    const trafficCodeIndex = trafficHeaders.findIndex((header) => { const key = normalize(header); return key.includes('\u06a9\u062f\u0633\u0627\u0645\u0627\u0646\u0647') || key.includes('systemcode'); });
    const trafficProvinceIndex = trafficHeaders.findIndex((header) => { const key = normalize(header); return key.includes('province') || key.includes('\u0627\u0633\u062a\u0627\u0646'); });
    const roadIdentifiers = new Set((roadListSnapshot?.rows ?? []).map((row) => identifierIndex >= 0 ? row[identifierIndex]?.normalize('NFKC').trim().toUpperCase() : '').filter(Boolean));
    if (aggregationIndex >= 0 && trafficCodeIndex >= 0 && roadIdentifiers.size) for (const row of trafficSnapshot?.rows ?? []) {
      if (!roadIdentifiers.has((row[aggregationIndex] ?? '').normalize('NFKC').trim().toUpperCase())) continue;
      const code = (row[trafficCodeIndex] ?? '').trim().toUpperCase();
      const rawProvince = trafficProvinceIndex >= 0 ? row[trafficProvinceIndex]?.trim() ?? '' : '';
      const rowProvince = rawProvince ? rahcomProvinceFromLabel(rawProvince) : null;
      if (rawProvince && rowProvince !== province) continue;
      const key = systemCodes.get(code);
      if (key) codes.add(key);
    }
    for (const row of roadListSnapshot?.rows ?? []) for (const cell of row) {
      const matches = String(cell ?? '').match(/\d{3}[A-Z]\d{5}/gi) ?? [];
      for (const code of matches) { const key = systemCodes.get(code.toUpperCase()); if (key) codes.add(key); }
    }
    return codes;
  }, [roadListSnapshot, trafficSnapshot, province, systems]);
  const ticketSystemCodes = useMemo(() => {
    const ticketCodes = new Set(mapTickets.map((ticket) => ticket.systemCode.trim().toUpperCase()).filter(Boolean));
    return new Set(systems.filter((system) => ticketCodes.has(system.systemCode.trim().toUpperCase())).map((system) => rahcomSystemKey(system.province, system.systemCode)));
  }, [mapTickets, systems]);
  const solarMapCodes = useMemo(() => showMapIncidents
    ? new Set([...solarStatusCodes, ...incidentCodes])
    : solarStatusCodes,
  [solarStatusCodes, incidentCodes, showMapIncidents]);
  const aggregateMapCodes = useMemo(() => new Set([...trafficNoTrafficCodes, ...roadListCodes, ...solarStatusCodes, ...ticketSystemCodes]), [roadListCodes, solarStatusCodes, ticketSystemCodes, trafficNoTrafficCodes]);
  const selectedMapSourceCodes = mapFilterSource === 'none' ? new Set<string>()
    : mapFilterSource === 'traffic' ? trafficNoTrafficCodes
    : mapFilterSource === 'road-list' ? roadListCodes
      : mapFilterSource === 'solar' ? solarMapCodes
        : mapFilterSource === 'tickets' ? ticketSystemCodes
          : aggregateMapCodes;
  const visibleSystems = useMemo(() => systems.filter((system) =>
    !mapSourceFilterActive || selectedMapSourceCodes.has(rahcomSystemKey(system.province, system.systemCode)),
  ), [mapSourceFilterActive, selectedMapSourceCodes, systems]);
  const incidentSystemsCount = useMemo(() => visibleSystems.filter((system) => incidentCodes.has(rahcomSystemKey(system.province, system.systemCode))).length, [visibleSystems, incidentCodes]);
  const displayedSystems = useMemo(() => visibleSystems.filter((system) => hasRegisteredMapLocation(system)
    && (showMapIncidents || !incidentCodes.has(rahcomSystemKey(system.province, system.systemCode)))),
  [visibleSystems, incidentCodes, showMapIncidents]);
  const [provinceBoundary, setProvinceBoundary] = useState<Feature<Polygon> | null>(null);
  const popupLabels = useMemo<PopupLabels>(() => ({
    name: t('rahcomSystemName'), code: t('rahcomSystemCode'), axisCode: t('rahcomAxisCode'), announcedAxis: t('rahcomAxis'), latitude: t('rahcomLatitude'), longitude: t('rahcomLongitude'),
    copy: t('rahcomCopy'), copyCoordinates: t('rahcomCopyCoordinates'), copied: t('rahcomCopied'),
    electricityBillId: t('rahcomElectricityBillId'), simIp: t('rahcomSimIp'), radarIp: t('rahcomRadarIp'), cameraIp: t('rahcomCameraIp'), pcIp: t('rahcomPcIp'), routerIp: t('rahcomRouterIp'), laptopIp: t('rahcomLaptopIp'), edit: t('rahcomEditSystem'),
    save: t('rahcomSaveCoordinates'), cancel: t('rahcomCancel'), close: t('closeSidebar'), remove: t('rahcomDelete'),
    route: t('rahcomRoute'), history: t('rahcomHistory'), dragHint: t('rahcomDragMarkerHint'), deleteConfirm: t('rahcomDeleteConfirm'),
    updateFailed: t('rahcomSystemUpdateFailed'), deleteFailed: t('rahcomSystemDeleteFailed'),
  }), [t]);

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    void import('leaflet').then((leaflet) => {
      if (cancelled || !mapElement.current) return;
      map = leaflet.map(mapElement.current, { zoomControl: false }).setView([32.2, 52.2], 7);
      map.createPane('rahcomProvinceShade').style.zIndex = '350';
      map.createPane('rahcomProvinceBoundary').style.zIndex = '430';
      systemsLayer.current = leaflet.layerGroup().addTo(map);
      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      currentMarker.current = null;
      systemsLayer.current = null;
    };
  }, []);

  useEffect(() => {
    const onSystemsChanged = () => setSystemsRevision((revision) => revision + 1);
    const onFocusSystem = () => setSystemsRevision((revision) => revision + 1);
    window.addEventListener('rahyar:systems-changed', onSystemsChanged);
    window.addEventListener('rahyar:focus-system', onFocusSystem);
    return () => {
      window.removeEventListener('rahyar:systems-changed', onSystemsChanged);
      window.removeEventListener('rahyar:focus-system', onFocusSystem);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const refreshTraffic = () => { void rahcomApi.trafficSnapshot(province, date || undefined).then((snapshot) => { if (active) setTrafficSnapshot(snapshot); }).catch(() => { if (active) setTrafficSnapshot(null); }); };
    refreshTraffic();
    window.addEventListener('rahyar:traffic-snapshot-changed', refreshTraffic);
    return () => { active = false; window.removeEventListener('rahyar:traffic-snapshot-changed', refreshTraffic); };
  }, [province, date]);

  useEffect(() => {
    let active = true;
    void Promise.all([rahcomApi.roadList(province, date || tehranDateKey()), rahcomApi.importedTickets(province, date || undefined)])
      .then(([roadList, tickets]) => { if (active) { setRoadListSnapshot(roadList); setMapTickets(tickets); } })
      .catch(() => { if (active) { setRoadListSnapshot(null); setMapTickets([]); } });
    return () => { active = false; };
  }, [province, date]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    let cancelled = false;
    void import('leaflet').then((leaflet) => {
      if (cancelled || mapRef.current !== map) return;
      tileLayerRef.current?.remove();
      const streetUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
      const streetOptions = {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      };
      tileLayerRef.current = leaflet.tileLayer(streetUrl, streetOptions).addTo(map);
    });
    return () => { cancelled = true; };
  }, [mapReady, resolvedTheme]);

  useEffect(() => {
    let active = true;
    const refreshSnapshots = () => {
      void rahcomApi.solarSnapshots(province, date || undefined).then((snapshots) => { if (active) { setSolarSnapshots(snapshots); setSolarSnapshotsLoaded(true); } })
        .catch(() => { if (active) { setSolarSnapshots([]); setSolarSnapshotsLoaded(true); } });
    };
    refreshSnapshots();
    window.addEventListener('rahyar:solar-snapshots-changed', refreshSnapshots);
    return () => {
      active = false;
      window.removeEventListener('rahyar:solar-snapshots-changed', refreshSnapshots);
    };
  }, [province, date]);

  useEffect(() => {
    const updateToday = () => setTodayDateKey(tehranDateKey());
    const timer = window.setInterval(updateToday, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { onSolarSnapshotsChange?.(solarSnapshotsLoaded ? solarSnapshots : null); }, [onSolarSnapshotsChange, solarSnapshots, solarSnapshotsLoaded]);

  useEffect(() => {
    if (!mapReady || province !== 'isfahan') return;
    let active = true;
    void fetch('/data/isfahan-boundary.geojson')
      .then((response) => {
        if (!response.ok) throw new Error('مرز استان اصفهان بارگذاری نشد.');
        return response.json() as Promise<Feature<Polygon>>;
      })
      .then((feature) => { if (active) setProvinceBoundary(feature); })
      .catch(() => { if (active) setProvinceBoundary(null); });
    return () => { active = false; };
  }, [mapReady, province]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || province !== 'isfahan' || !provinceBoundary || !focusProvince) {
      fittedProvince.current = null;
      return;
    }
    let cancelled = false;
    let shadeLayer: import('leaflet').Polygon | null = null;
    let haloLayer: import('leaflet').GeoJSON | null = null;
    let boundaryLayer: import('leaflet').GeoJSON | null = null;
    void import('leaflet').then(({ geoJSON, polygon }) => {
      if (cancelled || mapRef.current !== map) return;
      const dark = resolvedTheme === 'dark';
      const boundaryPane = 'rahcomProvinceBoundary';
      haloLayer = geoJSON(provinceBoundary, {
        pane: boundaryPane,
        style: { color: dark ? '#f8fafc' : '#ffffff', weight: 7, opacity: 0.95, fillOpacity: 0 },
        interactive: false,
      }).addTo(map);
      boundaryLayer = geoJSON(provinceBoundary, {
        pane: boundaryPane,
        style: { color: dark ? '#22d3ee' : '#1d4ed8', weight: 3.5, opacity: 1, fillColor: dark ? '#22d3ee' : '#f59e0b', fillOpacity: 0 },
        interactive: false,
      }).addTo(map);

      const ring = provinceBoundary.geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]);
      const updateShade = () => {
        shadeLayer?.remove();
        const bounds = map.getBounds().pad(2);
        const outer: [number, number][] = [
          [bounds.getSouth(), bounds.getWest()], [bounds.getSouth(), bounds.getEast()],
          [bounds.getNorth(), bounds.getEast()], [bounds.getNorth(), bounds.getWest()],
        ];
        shadeLayer = polygon([outer, ring], {
          pane: 'rahcomProvinceShade', color: 'transparent', weight: 0,
          fillColor: dark ? '#020617' : '#172033', fillOpacity: dark ? 0.56 : 0.3,
          fillRule: 'evenodd', interactive: false,
        }).addTo(map);
      };
      if (fittedProvince.current !== province) {
        map.fitBounds(haloLayer.getBounds(), { padding: [24, 24], maxZoom: 8, animate: false });
        fittedProvince.current = province;
      }
      updateShade();
      map.on('moveend', updateShade);
      boundaryLayer.on('remove', () => map.off('moveend', updateShade));
    });
    return () => {
      cancelled = true;
      shadeLayer?.remove();
      haloLayer?.remove();
      boundaryLayer?.remove();
    };
  }, [mapReady, province, provinceBoundary, focusProvince, resolvedTheme]);


  useEffect(() => {
    const userId = getCurrentUser()?.id;
    const key = `rahyar-selected-province:${userId || 'current'}`;
    const onProvinceChange = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string; province?: string }>).detail;
      if (detail?.province) setProvince(detail.province);
    };
    const onStorageChange = (event: StorageEvent) => {
      if (event.key === key) setProvince(event.newValue || 'isfahan');
    };
    window.addEventListener('rahyar:province-change', onProvinceChange);
    window.addEventListener('storage', onStorageChange);
    return () => {
      window.removeEventListener('rahyar:province-change', onProvinceChange);
      window.removeEventListener('storage', onStorageChange);
    };
  }, []);

  useEffect(() => {
    let active = true;
    void rahcomApi.systems(province)
      .then((rows) => { if (active) { setSystems(rows); setSystemsError(''); } })
      .catch((error: unknown) => {
        if (!active) return;
        setSystems([]);
        setSystemsError(error instanceof Error ? error.message : 'سامانه‌های این استان بارگذاری نشدند.');
      });
    return () => { active = false; };
  }, [province, systemsRevision]);

  useEffect(() => { onAxisOptionsChange?.(axisOptions); }, [axisOptions, onAxisOptionsChange]);
  useEffect(() => { onSystemsCountChange?.(displayedSystems.length); }, [onSystemsCountChange, displayedSystems.length]);
  useEffect(() => { onUnmappedSolarCountChange?.(unmappedSolarCount); }, [onUnmappedSolarCountChange, unmappedSolarCount]);
  useEffect(() => { onUnmappedSolarDetailsChange?.(unmappedSolarDetails); }, [onUnmappedSolarDetailsChange, unmappedSolarDetails]);
  useEffect(() => { onIncidentCountChange?.(incidentSystemsCount); }, [onIncidentCountChange, incidentSystemsCount]);
  useEffect(() => { onIncidentMapSummaryChange?.(incidentMapSummary); }, [incidentMapSummary, onIncidentMapSummaryChange]);
  useEffect(() => { onSystemsErrorChange?.(systemsError); }, [onSystemsErrorChange, systemsError]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const updateSystemCodeLabels = () => {
      const zoom = map.getZoom();
      const container = map.getContainer();
      container.classList.toggle('rahcom-system-codes-visible', zoom >= 8);
      container.style.setProperty('--rahcom-system-code-size', `${Math.min(32, 18 + Math.max(0, zoom - 8) * 1.8)}px`);
    };
    updateSystemCodeLabels();
    map.on('zoomend', updateSystemCodeLabels);
    return () => {
      map.off('zoomend', updateSystemCodeLabels);
      map.getContainer().classList.remove('rahcom-system-codes-visible');
      map.getContainer().style.removeProperty('--rahcom-system-code-size');
    };
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !systemsLayer.current || !map) return;
    let cancelled = false;
    let labelLayoutFrame = 0;
    let scheduleLabelLayout: (() => void) | null = null;
    void import('leaflet').then(({ divIcon, latLngBounds, marker: leafletMarker }) => {
      if (cancelled || !systemsLayer.current) return;
      const layer = systemsLayer.current; layer.clearLayers();
      const nextSystemMarkers = new Map<string, Marker>();
      const markers: Marker[] = [];
      displayedSystems.forEach((system) => {
        const systemCode = rahcomSystemKey(system.province, system.systemCode);
        const axisLabel = activeAxisBySystem.get(systemCode);
        const popupAxisName = system.announcedAxis?.trim() ?? '';
        const markerColor = axisLabel ? rahcomAxisColor(axisLabel, axisOptions) : '#64748b';
        const systemIcon = divIcon({
          className: '', iconSize: [19, 24], iconAnchor: [9.5, 23],
          html: `<svg aria-hidden="true" width="19" height="24" viewBox="0 0 24 30" style="display:block;filter:drop-shadow(0 1px 2px #0008)"><path d="M12 29S1 17 1 12a11 11 0 1 1 22 0c0 5-11 17-11 17Z" fill="${markerColor}" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="#fff" fill-opacity=".92"/></svg>`,
        });
        const marker = leafletMarker([system.latitude, system.longitude], { icon: systemIcon, draggable: false })
          .bindTooltip(escapeHtml(system.systemCode.trim()), { permanent: true, direction: 'top', offset: [0, -2], className: 'rahcom-system-code-tooltip', opacity: 1, interactive: true })
          .bindPopup(systemPopupHtml(system, popupAxisName, popupLabels, canManage, false, ''), { closeButton: false, minWidth: Math.min(220, window.innerWidth - 32), maxWidth: Math.min(window.innerWidth - 32, 340), className: 'rahcom-map-system-popup', autoPanPadding: [16, 16] });
        marker.on('tooltipopen', (event) => event.tooltip.getElement()?.style.setProperty('--rahcom-axis-code-color', markerColor));
        marker.addTo(layer);
        markers.push(marker);
        nextSystemMarkers.set(systemCode, marker);

        marker.on('popupopen', ({ popup }) => {
          const markerElement = marker.getElement();
          if (markerElement) {
          const markerBounds = markerElement?.getBoundingClientRect();
          popup.remove();
          openRahcomRowInfo(system.systemName || system.systemCode, [
            { label: popupLabels.code, value: system.systemCode },
            { label: popupLabels.name, value: system.systemName },
            { label: popupLabels.announcedAxis, value: popupAxisName },
            { label: popupLabels.axisCode, value: system.axisCode ?? '' },
          ], markerElement, markerBounds ? { x: markerBounds.left + markerBounds.width / 2, y: markerBounds.bottom } : undefined, system.systemCode, { ...system, announcedAxis: popupAxisName || system.announcedAxis });
          return;
          }
          let editing = false;
          let status = '';
          let copiedValue = '';
          let copyResetTimer: number | null = null;
          const updateCoordinatesInPopup = () => {
            const position = marker.getLatLng();
            const content = popup.getElement();
            const coordinatePair = content?.querySelector<HTMLElement>('[data-coordinate-pair]');
            if (coordinatePair) coordinatePair.textContent = formatRahcomCoordinates(position.lat, position.lng);
            const latitudeInput = content?.querySelector<HTMLInputElement>('[data-system-field="latitude"]');
            const longitudeInput = content?.querySelector<HTMLInputElement>('[data-system-field="longitude"]');
            if (latitudeInput) latitudeInput.value = String(position.lat);
            if (longitudeInput) longitudeInput.value = String(position.lng);
            const copyCoordinatesButton = content?.querySelector<HTMLButtonElement>('[data-coordinate-copy]');
            if (copyCoordinatesButton) copyCoordinatesButton.dataset.copyValue = formatRahcomCoordinates(position.lat, position.lng);
          };
          const onDrag = () => updateCoordinatesInPopup();
          marker.once('popupclose', () => {
            if (!editing) return;
            marker.off('drag', onDrag);
            marker.dragging?.disable();
            marker.setLatLng([system.latitude, system.longitude]);
          });
          const renderPopup = () => {
            popup.setContent(systemPopupHtml(system, popupAxisName, popupLabels, canManage, editing, status, copiedValue));
            popup.update();
            const root = popup.getElement()?.querySelector<HTMLElement>('.rahcom-system-popup');
            if (!root) return;
            root.querySelectorAll<HTMLButtonElement>('[data-copy-value]').forEach((button) => {
              button.addEventListener('click', async () => {
                try {
                  await navigator.clipboard.writeText(button.dataset.copyValue || '');
                  copiedValue = button.dataset.copyValue || '';
                  status = '';
                  if (copyResetTimer !== null) window.clearTimeout(copyResetTimer);
                  copyResetTimer = window.setTimeout(() => { if (copiedValue === button.dataset.copyValue) { copiedValue = ''; if (popup.isOpen()) renderPopup(); } }, 1800);
                } catch {
                  status = t('rahcomCopyFailed');
                }
                renderPopup();
              });
            });
            root.querySelector<HTMLButtonElement>('[data-popup-action="edit"]')?.addEventListener('click', () => {
              if (!canManage) return;
              editing = true;
              status = '';
              marker.dragging?.enable();
              marker.on('drag', onDrag);
              renderPopup();
            });
            root.querySelector<HTMLButtonElement>('[data-popup-action="close"]')?.addEventListener('click', () => popup.remove());
            root.querySelector<HTMLButtonElement>('[data-popup-action="cancel"]')?.addEventListener('click', () => {
              marker.off('drag', onDrag);
              marker.dragging?.disable();
              marker.setLatLng([system.latitude, system.longitude]);
              editing = false;
              status = '';
              renderPopup();
            });
            root.querySelector<HTMLButtonElement>('[data-popup-action="save"]')?.addEventListener('click', async () => {
              if (!canManage) return;
              try {
              const field = (name: string) => root.querySelector<HTMLInputElement>(`[data-system-field="${name}"]`)?.value ?? '';
              const latitude = Number(field('latitude'));
              const longitude = Number(field('longitude'));
              if (!field('systemName').trim() || !field('systemCode').trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                status = popupLabels.updateFailed;
                renderPopup();
                return;
              }
              await rahcomApi.updateSystem(system.id, { systemName: field('systemName').trim(), systemCode: field('systemCode').trim(), axisCode: field('axisCode').trim() || null, latitude, longitude });
                marker.off('drag', onDrag);
                marker.dragging?.disable();
                editing = false;
                status = '';
                popup.remove();
              } catch {
                status = popupLabels.updateFailed;
                renderPopup();
              }
            });
            root.querySelector<HTMLButtonElement>('[data-popup-action="route"]')?.addEventListener('click', () => setRouteSystem(system));
            root.querySelector<HTMLButtonElement>('[data-popup-action="history"]')?.addEventListener('click', () => setHistorySystem(system));
            root.querySelector<HTMLButtonElement>('[data-popup-action="delete"]')?.addEventListener('click', async () => {
              if (!canManage) return;
              if (!window.confirm(`${popupLabels.deleteConfirm} ${system.systemName}`)) return;
              try {
                await rahcomApi.deleteSystem(system.id);
              } catch {
                status = popupLabels.deleteFailed;
                renderPopup();
              }
            });
          };
          renderPopup();
        });
      });
      systemMarkers.current = nextSystemMarkers;
      const layoutLabels = () => {
        const mapBounds = map.getContainer().getBoundingClientRect();
        const placed: DOMRect[] = [];
        const markerBounds = markers.map((marker) => ({ marker, bounds: marker.getElement()?.getBoundingClientRect() })).filter((item): item is { marker: Marker; bounds: DOMRect } => Boolean(item.bounds));
        const gap = 5;
        for (const marker of markers) {
          const element = marker.getTooltip()?.getElement();
          if (!element || getComputedStyle(element).display === 'none') continue;
          element.style.visibility = 'visible';
          element.style.marginLeft = '0px';
          element.style.marginTop = '0px';
          const base = element.getBoundingClientRect();
          const candidates: Array<[number, number]> = [[0, 0]];
          for (let row = 1; row <= 2; row += 1) candidates.push([0, -row * (base.height + gap)]);
          for (let step = 1; step <= 6; step += 1) {
            const dx = step * 12;
            for (let row = 0; row <= 2; row += 1) {
              const dy = -row * (base.height + gap);
              candidates.push([-dx, dy], [dx, dy]);
            }
          }
          candidates.sort((left, right) => Math.hypot(...left) - Math.hypot(...right));
          let selected: [number, number] | null = null;
          for (const [dx, dy] of candidates) {
            const bounds = new DOMRect(base.left + dx, base.top + dy, base.width, base.height);
            const insideMap = bounds.left >= mapBounds.left + 2 && bounds.right <= mapBounds.right - 2 && bounds.top >= mapBounds.top + 2 && bounds.bottom <= mapBounds.bottom - 2;
            const overlapsLabel = placed.some((other) => bounds.left < other.right + gap && bounds.right + gap > other.left && bounds.top < other.bottom + gap && bounds.bottom + gap > other.top);
            const overlapsPin = markerBounds.some((pin) => bounds.left < pin.bounds.right && bounds.right > pin.bounds.left && bounds.top < pin.bounds.bottom && bounds.bottom > pin.bounds.top);
            if (insideMap && !overlapsLabel && !overlapsPin) { selected = [dx, dy]; break; }
          }
          if (!selected) { element.style.visibility = 'hidden'; continue; }
          element.style.marginLeft = `${selected[0]}px`;
          element.style.marginTop = `${selected[1]}px`;
          placed.push(element.getBoundingClientRect());
        }
      };
      scheduleLabelLayout = () => {
        if (labelLayoutFrame) window.cancelAnimationFrame(labelLayoutFrame);
        labelLayoutFrame = window.requestAnimationFrame(layoutLabels);
      };
      map.on('zoomend moveend resize', scheduleLabelLayout);
      scheduleLabelLayout();
      let focusedSystem = false;
      const focusSystemId = window.sessionStorage.getItem('rahyar-rahcom-focus-system');
      if (focusSystemId) {
        const focusedRecord = visibleSystems.find((system) => system.id === focusSystemId);
        const marker = focusedRecord ? systemMarkers.current.get(rahcomSystemKey(focusedRecord.province, focusedRecord.systemCode)) : undefined;
        if (marker && systemsLayer.current?.hasLayer(marker)) {
          mapRef.current?.setView(marker.getLatLng(), 15, { animate: false });
          marker.openPopup();
          focusedSystem = true;
        }
        window.sessionStorage.removeItem('rahyar-rahcom-focus-system');
      }
      const viewKey = `${province}:${mapSourceFilterActive ? mapFilterSource : 'all'}:${showMapIncidents ? 'incidents-included' : 'incidents-hidden'}`;
      const provinceAlreadyFocused = province === 'isfahan' && provinceBoundary && focusProvince;
      if (!focusedSystem && markers.length && fittedSystemsView.current !== viewKey && !provinceAlreadyFocused) {
        const bounds = latLngBounds(markers.map((marker) => marker.getLatLng()));
        if (markers.length === 1) mapRef.current?.setView(markers[0].getLatLng(), 12, { animate: false });
        else mapRef.current?.fitBounds(bounds, { padding: [36, 36], maxZoom: 12 });
        fittedSystemsView.current = viewKey;
      }
    });
    return () => {
      cancelled = true;
      if (scheduleLabelLayout) map.off('zoomend moveend resize', scheduleLabelLayout);
      if (labelLayoutFrame) window.cancelAnimationFrame(labelLayoutFrame);
    };
  }, [mapReady, displayedSystems, t, popupLabels, province, provinceBoundary, focusProvince, canManage, mapSourceFilterActive, mapFilterSource, showMapIncidents, axisOptions, activeAxisBySystem]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    if (location) {
      if (currentMarker.current) currentMarker.current.setLatLng([location.lat, location.lng]);
      else {
        void import('leaflet').then(({ circleMarker }) => {
          if (mapRef.current !== map) return;
          currentMarker.current = circleMarker([location.lat, location.lng], {
            radius: 9, color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1,
            interactive: false,
          }).addTo(map);
        });
      }
    }
  }, [location, mapReady]);

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError(true);
      return;
    }
    setLocating(true);
    setLocationError(false);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        setLocation(point);
        mapRef.current?.setView([point.lat, point.lng], 14);
        setLocating(false);
      },
      () => {
        setLocationError(true);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }, []);

  useEffect(() => {
    onLocateMeReady?.(locateMe);
    return () => onLocateMeReady?.(null);
  }, [locateMe, onLocateMeReady]);

  useEffect(() => {
    onLocationStatusChange?.({ locating, error: locationError });
  }, [locating, locationError, onLocationStatusChange]);

  useEffect(() => {
    if (!routeSystem) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setRouteSystem(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [routeSystem]);

  useEffect(() => {
    if (!historySystem) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setHistorySystem(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [historySystem]);

  return (
    <div className={`rahcom-osm-map relative h-full w-full overflow-hidden ${resolvedTheme === 'dark' ? 'rahcom-osm-map-dark' : ''}`}>
      <div ref={mapElement} className="absolute inset-0 z-0" />
      {routeSystem ? <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setRouteSystem(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="rahcom-map-route-title" className="w-full max-w-xs rounded-2xl border border-border bg-card p-3 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div><h2 id="rahcom-map-route-title" className="font-bold text-foreground">{t('rahcomChooseRouteApp')}</h2><p className="mt-1 text-sm text-muted-foreground">{routeSystem.systemName}</p></div>
            <button type="button" onClick={() => setRouteSystem(null)} aria-label={t('rahcomCancel')} title={t('rahcomCancel')} className="rounded-lg border border-border p-1.5 text-foreground"><X size={16} aria-hidden="true" /></button>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {([
              ['osm', t('rahcomRouteOpenStreetMap'), MapIcon], ['google', t('rahcomRouteGoogleMaps'), MapPinned],
              ['neshan', t('rahcomRouteNeshan'), Compass], ['balad', t('rahcomRouteBalad'), Navigation],
            ] as const).map(([provider, label, RouteIcon]) => <a key={provider} href={routeUrl(provider, routeSystem, location)} target="_blank" rel="noreferrer" aria-label={label} title={label} onClick={() => setRouteSystem(null)} className="flex size-10 items-center justify-center rounded-lg border border-border text-foreground hover:border-primary/50 hover:bg-accent">
              <RouteIcon size={18} aria-hidden="true" /><span className="sr-only">{label}</span>
            </a>)}
          </div>
        </section>
      </div> : null}
      {historySystem && typeof document !== 'undefined' ? createPortal(<div className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/75 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistorySystem(null); }}>
        <section role="dialog" aria-modal="true" aria-label={t('rahcomHistory')} className="flex max-h-[min(90vh,52rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-2xl">
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4 py-3 sm:px-6">
            <div className="min-w-0"><h2 className="font-bold">{t('rahcomHistory')}</h2><p className="mt-1 truncate text-sm text-muted-foreground">{historySystem.systemName} · {historySystem.systemCode}</p></div>
            <button type="button" onClick={() => setHistorySystem(null)} aria-label={t('rahcomCloseHistory')} className="shrink-0 rounded-lg border border-border bg-background p-2 text-muted-foreground hover:bg-accent"><X size={18}/></button>
          </div>
          <div className="min-h-0 overflow-y-auto p-4 sm:p-6"><RahcomSystemHistory system={historySystem} /></div>
        </section>
      </div>, document.body) : null}
    </div>
  );
}
