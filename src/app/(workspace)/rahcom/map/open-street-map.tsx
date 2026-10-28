'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CircleMarker, LayerGroup, Map as LeafletMap, Marker, TileLayer } from 'leaflet';
import type { Feature, Polygon } from 'geojson';
import { ExternalLink, LocateFixed, Minus, Plus, X } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import 'leaflet/dist/leaflet.css';
import { formatRahcomCoordinates, rahcomApi, type RahcomSolarSnapshot, type RahcomSystem, type RahcomTrafficSnapshot } from '@/lib/api/rahcom/rahcom-api';
import { getCurrentUser } from '@/lib/api/shared/auth-api';
import { RahcomSystemHistory } from '@/app/(workspace)/rahcom/_shared/rahcom-system-history';
import { canonicalRahcomAxis, rahcomAxisColor } from '@/lib/api/rahcom/rahcom-axes';
import { failedRahcomSystemCodes, isRahcomIncidentValue, latestRahcomSolarSnapshotForToday, tehranDateKey } from '@/lib/api/rahcom/solar-status';
import { useRahcomDate } from '@/app/(workspace)/rahcom/_shared/rahcom-date';

type Point = { lat: number; lng: number };
const isfahanCountyLabels = [
  { name: 'آران و بیدگل', lat: 34.1511, lng: 51.8712 }, { name: 'اردستان', lat: 33.6521, lng: 52.407 },
  { name: 'اصفهان', lat: 32.5692, lng: 51.8161 }, { name: 'برخوار', lat: 33.0128, lng: 51.7845 },
  { name: 'بوئین و میاندشت', lat: 33.1664, lng: 50.1 }, { name: 'تیران و کرون', lat: 32.7849, lng: 50.8936 },
  { name: 'خمینی‌شهر', lat: 32.6786, lng: 51.5031 }, { name: 'خوانسار', lat: 33.2492, lng: 50.3657 },
  { name: 'خور و بیابانک', lat: 33.6749, lng: 54.8684 }, { name: 'دهاقان', lat: 32.0158, lng: 51.5934 },
  { name: 'سمیرم', lat: 31.2832, lng: 51.6141 }, { name: 'شاهین‌شهر و میمه', lat: 33.2436, lng: 51.1548 },
  { name: 'شهرضا', lat: 31.8895, lng: 51.9128 }, { name: 'فریدن', lat: 32.9605, lng: 50.41 },
  { name: 'فریدون‌شهر', lat: 32.8496, lng: 49.9813 }, { name: 'فلاورجان', lat: 32.5224, lng: 51.5503 },
  { name: 'کاشان', lat: 33.9737, lng: 51.3744 }, { name: 'لنجان', lat: 32.376, lng: 51.2192 },
  { name: 'مبارکه', lat: 32.264, lng: 51.5179 }, { name: 'نائین', lat: 33.3938, lng: 53.6896 },
  { name: 'نجف‌آباد', lat: 32.9045, lng: 51.047 }, { name: 'نطنز', lat: 33.6101, lng: 51.8797 },
  { name: 'چادگان', lat: 32.7458, lng: 50.5354 }, { name: 'گلپایگان', lat: 33.4458, lng: 50.3558 },
  { name: 'هرند', lat: 32.5032, lng: 52.3589 }, { name: 'ورزنه', lat: 32.2956, lng: 52.6993 },
  { name: 'جرقویه', lat: 31.9901, lng: 52.5549 }, { name: 'کوهپایه', lat: 32.7375, lng: 52.4566 },
] as const;
type PopupLabels = {
  name: string; code: string; axis: string; axisCode: string; latitude: string; longitude: string; copy: string; copyCode: string; copyCoordinates: string; copyAll: string; copied: string;
  electricityBillId: string; simIp: string; radarIp: string; cameraIp: string; pcIp: string; routerIp: string; laptopIp: string;
  edit: string; save: string; cancel: string; remove: string; route: string; history: string;
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

function systemPopupHtml(system: RahcomSystem, labels: PopupLabels, canManage: boolean, editing: boolean, status: string, copiedValue = '') {
  const copyButton = (value: string, label: string) => `<button type="button" class="rahcom-popup-copy" data-copy-value="${escapeHtml(value).replace(/\r?\n/g, '&#10;')}">${escapeHtml(copiedValue === value ? labels.copied : label)}</button>`;
  const row = (label: string, value: string, copyLabel = labels.copy) => `<div class="rahcom-popup-row"><span>${escapeHtml(label)}</span><b dir="ltr">${escapeHtml(value)}</b>${copyButton(value, copyLabel)}</div>`;
  const coordinatePair = formatRahcomCoordinates(system.latitude, system.longitude);
  const axisCode = system.axisCode?.trim() ?? '';
  const axis = canonicalRahcomAxis(system.axis, system.latitude, system.longitude, system.province);
  const copyBasics = [system.systemName, system.systemCode, axisCode].filter(Boolean).join('\n');
  const editFields = editing && canManage ? `<div class="rahcom-popup-edit-fields">
    <label>${escapeHtml(labels.name)}<input data-system-field="systemName" value="${escapeHtml(system.systemName)}"></label>
    <label>${escapeHtml(labels.code)}<input data-system-field="systemCode" dir="ltr" value="${escapeHtml(system.systemCode)}"></label>
    <label>${escapeHtml(labels.axisCode)}<input data-system-field="axisCode" dir="ltr" value="${escapeHtml(axisCode)}"></label>
    <label>${escapeHtml(labels.axis)}<input data-system-field="axis" value="${escapeHtml(axis)}"></label>
    <label>${escapeHtml(labels.latitude)}<input data-system-field="latitude" dir="ltr" inputmode="decimal" value="${system.latitude}"></label>
    <label>${escapeHtml(labels.longitude)}<input data-system-field="longitude" dir="ltr" inputmode="decimal" value="${system.longitude}"></label>
  </div>` : '';
  const optionalRows = ([
    [labels.electricityBillId, system.electricityBillId], [labels.simIp, system.simIp], [labels.radarIp, system.radarIp],
    [labels.cameraIp, system.cameraIp], [labels.pcIp, system.pcIp], [labels.routerIp, system.routerIp], [labels.laptopIp, system.laptopIp],
  ] as const).filter((entry): entry is [string, string] => Boolean(entry[1])).map(([label, value]) => row(label, value));
  const basics = `<div class="rahcom-popup-basics">${copyButton(copyBasics, labels.copyAll)}</div>`;
  const axisRows = `${axisCode ? row(labels.axisCode, axisCode) : ''}${axis ? row(labels.axis, axis) : ''}`;
  const coordinates = `<div class="rahcom-popup-data">${row(labels.name, system.systemName, labels.copy)}${row(labels.code, system.systemCode, labels.copyCode)}${axisRows}<div class="rahcom-popup-row"><span>${escapeHtml(labels.copyCoordinates)}</span><b data-coordinate-pair dir="ltr">${escapeHtml(coordinatePair)}</b>${copyButton(coordinatePair, labels.copyCoordinates).replace('data-copy-value=', 'data-coordinate-copy data-copy-value=')}</div>${optionalRows.join('')}</div>`;
  const actions = editing && canManage
    ? `${editFields}<p class="rahcom-popup-hint">${escapeHtml(labels.dragHint)}</p><div class="rahcom-popup-actions"><button type="button" data-popup-action="save">${escapeHtml(labels.save)}</button><button type="button" data-popup-action="cancel">${escapeHtml(labels.cancel)}</button><button type="button" data-popup-action="delete" class="danger">${escapeHtml(labels.remove)}</button></div>`
    : `<div class="rahcom-popup-actions">${canManage ? `<button type="button" data-popup-action="edit">${escapeHtml(labels.edit)}</button>` : ''}<button type="button" data-popup-action="route">${escapeHtml(labels.route)}</button><button type="button" data-popup-action="history">${escapeHtml(labels.history)}</button></div>`;
  const header = `<header class="rahcom-popup-header"><div><strong class="rahcom-popup-title">${escapeHtml(system.systemName)}</strong><span class="rahcom-popup-subtitle" dir="ltr">${escapeHtml(system.systemCode)}</span></div>${basics}</header>`;
  return `<div class="rahcom-system-popup" dir="rtl">${header}${editing && canManage ? '' : coordinates}<div data-popup-status role="status" class="rahcom-popup-status">${escapeHtml(status)}</div>${actions}</div>`;
}

function getStoredProvince() {
  if (typeof window === 'undefined') return 'isfahan';
  const userId = getCurrentUser()?.id;
  return window.localStorage.getItem(`rahyar-selected-province:${userId || 'current'}`) || 'isfahan';
}

export function OpenStreetMap({ focusProvince, canManage = false, solarDownFilter = false, showTrafficIncidents = true, showSystemIncidents = true, countyLabels = true, onAxisOptionsChange, onSystemsCountChange, onSystemsErrorChange, onLocationStatusChange, onSolarSnapshotAvailabilityChange }: {
  focusProvince: boolean;
  canManage?: boolean;
  solarDownFilter?: boolean;
  showTrafficIncidents?: boolean;
  showSystemIncidents?: boolean;
  countyLabels?: boolean;
  onAxisOptionsChange?: (axes: string[]) => void;
  onSystemsCountChange?: (count: number) => void;
  onSystemsErrorChange?: (error: string) => void;
  onLocationStatusChange?: (status: { locating: boolean; error: boolean }) => void;
  onSolarSnapshotAvailabilityChange?: (available: boolean | null) => void;
}) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);
  const currentMarker = useRef<CircleMarker | null>(null);
  const systemsLayer = useRef<LayerGroup | null>(null);
  const systemMarkers = useRef<Map<string, Marker>>(new Map());
  const countyLabelsLayer = useRef<LayerGroup | null>(null);
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
  const axisLabelByCode = useMemo(() => {
    const labels = new Map<string, string>();
    for (const system of systems) {
      const code = system.axisCode?.trim();
      if (!code || labels.has(code)) continue;
      const name = canonicalRahcomAxis(system.axis, system.latitude, system.longitude, system.province);
      labels.set(code, name ? `${code} · ${name}` : code);
    }
    return labels;
  }, [systems]);
  const axisOptions = useMemo(() => [...axisLabelByCode.values()].sort((left, right) => left.localeCompare(right, 'en', { numeric: true, sensitivity: 'base' })), [axisLabelByCode]);
  const todaySolarSnapshot = useMemo(() => latestRahcomSolarSnapshotForToday(solarSnapshots, date || todayDateKey), [solarSnapshots, date, todayDateKey]);
  const solarFailedCodes = useMemo(() => failedRahcomSystemCodes(todaySolarSnapshot), [todaySolarSnapshot]);
  const incidentCodes = useMemo(() => {
    const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[\s\u200c_./-]/g, '');
    const headers = trafficSnapshot?.headers ?? [];
    const codeIndex = headers.findIndex((value) => { const key = normalize(value); return key.includes('\u06a9\u062f\u0633\u0627\u0645\u0627\u0646\u0647') || key.includes('systemcode'); });
    const incidentIndexes = headers.flatMap((value, index) => { const key = normalize(value); return ['\u0633\u0631\u0642\u062a', '\u062a\u062e\u0631\u06cc\u0628', '\u062a\u0639\u0631\u06cc\u0636', '\u062c\u0627\u0628\u062c\u0627\u06cc\u06cc', 'theft', 'damage', 'widening', 'relocation'].some((term) => key.includes(normalize(term))) ? [index] : []; });
    if (codeIndex < 0 || incidentIndexes.length === 0) return new Set<string>();
    return new Set((trafficSnapshot?.rows ?? []).filter((row) => {
      return incidentIndexes.some((index) => isRahcomIncidentValue(row[index]));
    }).map((row) => (row[codeIndex] ?? '').trim().toUpperCase()).filter(Boolean));
  }, [trafficSnapshot]);
  const systemIncidentCodes = useMemo(() => new Set(systems.filter((system) => system.incidentType || isRahcomIncidentValue(system.incidentDetails)).map((system) => system.systemCode.trim().toUpperCase())), [systems]);
  const visibleSystems = useMemo(() => systems.filter((system) =>
    !solarDownFilter || solarFailedCodes.has(system.systemCode.trim().toUpperCase()),
  ), [solarDownFilter, solarFailedCodes, systems]);
  const displayedSystems = useMemo(() => visibleSystems.filter((system) => {
    const systemCode = system.systemCode.trim().toUpperCase();
    const hasTrafficIncident = incidentCodes.has(systemCode);
    const hasSystemIncident = systemIncidentCodes.has(systemCode);
    return (!hasTrafficIncident && !hasSystemIncident)
      || (showTrafficIncidents && hasTrafficIncident)
      || (showSystemIncidents && hasSystemIncident);
  }), [visibleSystems, incidentCodes, systemIncidentCodes, showTrafficIncidents, showSystemIncidents]);
  const [provinceBoundary, setProvinceBoundary] = useState<Feature<Polygon> | null>(null);
  const popupLabels = useMemo<PopupLabels>(() => ({
    name: t('rahcomSystemName'), code: t('rahcomSystemCode'), axis: t('rahcomAxis'), axisCode: t('rahcomAxisCode'), latitude: t('rahcomLatitude'), longitude: t('rahcomLongitude'), copy: t('rahcomCopy'), copyAll: t('rahcomCopyAll'),
    copyCode: t('rahcomCopyCode'), copyCoordinates: t('rahcomCopyCoordinates'), copied: t('rahcomCopied'),
    electricityBillId: t('rahcomElectricityBillId'), simIp: t('rahcomSimIp'), radarIp: t('rahcomRadarIp'), cameraIp: t('rahcomCameraIp'), pcIp: t('rahcomPcIp'), routerIp: t('rahcomRouterIp'), laptopIp: t('rahcomLaptopIp'), edit: t('rahcomEditSystem'),
    save: t('rahcomSaveCoordinates'), cancel: t('rahcomCancel'), remove: t('rahcomDelete'),
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
      countyLabelsLayer.current = leaflet.layerGroup().addTo(map);
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
      countyLabelsLayer.current = null;
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
    const refreshTraffic = () => { void rahcomApi.trafficSnapshot().then((snapshot) => { if (active) setTrafficSnapshot(snapshot); }).catch(() => { if (active) setTrafficSnapshot(null); }); };
    refreshTraffic();
    window.addEventListener('rahyar:traffic-snapshot-changed', refreshTraffic);
    return () => { active = false; window.removeEventListener('rahyar:traffic-snapshot-changed', refreshTraffic); };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    let cancelled = false;
    void import('leaflet').then((leaflet) => {
      if (cancelled || mapRef.current !== map) return;
      tileLayerRef.current?.remove();
      tileLayerRef.current = leaflet.tileLayer(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        },
      ).addTo(map);
    });
    return () => { cancelled = true; };
  }, [mapReady, resolvedTheme]);

  useEffect(() => {
    let active = true;
    const refreshSnapshots = () => {
      void rahcomApi.solarSnapshots().then((snapshots) => { if (active) { setSolarSnapshots(snapshots); setSolarSnapshotsLoaded(true); } })
        .catch(() => { if (active) { setSolarSnapshots([]); setSolarSnapshotsLoaded(true); } });
    };
    refreshSnapshots();
    window.addEventListener('rahyar:solar-snapshots-changed', refreshSnapshots);
    return () => {
      active = false;
      window.removeEventListener('rahyar:solar-snapshots-changed', refreshSnapshots);
    };
  }, []);

  useEffect(() => {
    const updateToday = () => setTodayDateKey(tehranDateKey());
    const timer = window.setInterval(updateToday, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { onSolarSnapshotAvailabilityChange?.(solarSnapshotsLoaded ? Boolean(todaySolarSnapshot) : null); }, [onSolarSnapshotAvailabilityChange, solarSnapshotsLoaded, todaySolarSnapshot]);

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
    const map = mapRef.current;
    const layer = countyLabelsLayer.current;
    if (!mapReady || !map || !layer) return;
    let cancelled = false;
    const updateCountyLabels = () => {
      if (cancelled) return;
      layer.clearLayers();
      if (!countyLabels || province !== 'isfahan' || map.getZoom() < 7) return;
      void import('leaflet').then(({ divIcon, marker: leafletMarker }) => {
        if (cancelled || !countyLabels || province !== 'isfahan' || map.getZoom() < 7) return;
        const dark = resolvedTheme === 'dark';
        for (const county of isfahanCountyLabels) {
          const width = Math.max(56, county.name.length * 9 + 8);
          const icon = divIcon({
            className: '', iconSize: [width, 24], iconAnchor: [width / 2, 12],
            html: `<span dir="rtl" style="display:block;width:${width}px;white-space:nowrap;text-align:center;font-size:14px;line-height:20px;font-weight:700;color:${dark ? '#f8fafc' : '#172033'};text-shadow:${dark ? '0 1px 3px #000,0 0 5px #000' : '0 1px 2px #fff,0 0 4px #fff'}">${county.name}</span>`,
          });
          leafletMarker([county.lat, county.lng], { icon, interactive: false, keyboard: false, zIndexOffset: -100 }).addTo(layer);
        }
      });
    };
    updateCountyLabels();
    map.on('zoomend', updateCountyLabels);
    return () => {
      cancelled = true;
      map.off('zoomend', updateCountyLabels);
      layer.clearLayers();
    };
  }, [mapReady, province, resolvedTheme, countyLabels]);

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
    void rahcomApi.systems(province === 'all' ? undefined : province)
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
  useEffect(() => { onSystemsErrorChange?.(systemsError); }, [onSystemsErrorChange, systemsError]);

  useEffect(() => {
    if (!mapReady || !systemsLayer.current) return;
    let cancelled = false;
    void import('leaflet').then(({ divIcon, latLngBounds, marker: leafletMarker }) => {
      if (cancelled || !systemsLayer.current) return;
      const layer = systemsLayer.current; layer.clearLayers();
      const nextSystemMarkers = new Map<string, Marker>();
      const markers: Marker[] = [];
      displayedSystems.forEach((system) => {
        const systemAxisCode = system.axisCode?.trim() ?? '';
        const markerColor = systemAxisCode ? rahcomAxisColor(axisLabelByCode.get(systemAxisCode) ?? systemAxisCode, axisOptions) : '#64748b';
        const systemCode = system.systemCode.trim().toUpperCase();
        const systemIcon = divIcon({
          className: '', iconSize: [18, 18], iconAnchor: [9, 9],
          html: `<span style="display:block;width:16px;height:16px;border:2px solid #fff;border-radius:50%;background:${markerColor};box-shadow:0 1px 5px #1118"></span>`,
        });
        const marker = leafletMarker([system.latitude, system.longitude], { icon: systemIcon, draggable: false })
          .bindPopup(systemPopupHtml(system, popupLabels, canManage, false, ''), { minWidth: Math.min(300, window.innerWidth - 40), maxWidth: Math.min(window.innerWidth - 40, 440), className: 'rahcom-map-system-popup', autoPanPadding: [24, 24] });
        marker.addTo(layer);
        markers.push(marker);
        nextSystemMarkers.set(systemCode, marker);

        marker.on('popupopen', ({ popup }) => {
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
            popup.setContent(systemPopupHtml(system, popupLabels, canManage, editing, status, copiedValue));
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
              await rahcomApi.updateSystem(system.id, { systemName: field('systemName').trim(), systemCode: field('systemCode').trim(), axisCode: field('axisCode').trim() || null, axis: field('axis').trim() || null, latitude, longitude });
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
      let focusedSystem = false;
      const focusSystemId = window.sessionStorage.getItem('rahyar-rahcom-focus-system');
      if (focusSystemId) {
        const focusedRecord = visibleSystems.find((system) => system.id === focusSystemId);
        const marker = focusedRecord ? systemMarkers.current.get(focusedRecord.systemCode.trim().toUpperCase()) : undefined;
        if (marker && systemsLayer.current?.hasLayer(marker)) {
          mapRef.current?.setView(marker.getLatLng(), 15, { animate: false });
          marker.openPopup();
          focusedSystem = true;
        }
        window.sessionStorage.removeItem('rahyar-rahcom-focus-system');
      }
      const viewKey = `${province}:${solarDownFilter}`;
      const provinceAlreadyFocused = province === 'isfahan' && provinceBoundary && focusProvince;
      if (!focusedSystem && markers.length && fittedSystemsView.current !== viewKey && !provinceAlreadyFocused) {
        const bounds = latLngBounds(markers.map((marker) => marker.getLatLng()));
        if (markers.length === 1) mapRef.current?.setView(markers[0].getLatLng(), 12, { animate: false });
        else mapRef.current?.fitBounds(bounds, { padding: [36, 36], maxZoom: 12 });
        fittedSystemsView.current = viewKey;
      }
    });
    return () => { cancelled = true; };
  }, [mapReady, displayedSystems, t, popupLabels, province, provinceBoundary, focusProvince, canManage, solarDownFilter, axisOptions, axisLabelByCode]);

  useEffect(() => {
    const layer = systemsLayer.current;
    if (!mapReady || !layer) return;
    for (const [systemCode, marker] of systemMarkers.current) {
      const hasTrafficIncident = incidentCodes.has(systemCode);
      const hasSystemIncident = systemIncidentCodes.has(systemCode);
      const shouldShow = (!hasTrafficIncident && !hasSystemIncident) || (showTrafficIncidents && hasTrafficIncident) || (showSystemIncidents && hasSystemIncident);
      if (shouldShow && !layer.hasLayer(marker)) marker.addTo(layer);
      else if (!shouldShow && layer.hasLayer(marker)) layer.removeLayer(marker);
    }
  }, [mapReady, showTrafficIncidents, showSystemIncidents, incidentCodes, systemIncidentCodes]);

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

  const zoomIn = useCallback(() => mapRef.current?.zoomIn(), []);
  const zoomOut = useCallback(() => mapRef.current?.zoomOut(), []);

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
      <div className="absolute start-3 top-3 z-[500] flex items-center gap-2 rounded-xl border border-border bg-card/95 p-2 shadow-lg backdrop-blur">
        <button type="button" onClick={zoomIn} aria-label={t('rahcomZoomIn')} title={t('rahcomZoomIn')} className="flex size-9 items-center justify-center rounded-lg border border-border bg-background text-foreground"><Plus size={17} /></button>
        <button type="button" onClick={zoomOut} aria-label={t('rahcomZoomOut')} title={t('rahcomZoomOut')} className="flex size-9 items-center justify-center rounded-lg border border-border bg-background text-foreground"><Minus size={17} /></button>
        <button type="button" onClick={locateMe} disabled={locating} aria-label={t('rahcomLocateMe')} title={t('rahcomLocateMe')} className="flex size-9 items-center justify-center rounded-lg border border-border bg-background text-foreground disabled:opacity-50">{locating ? <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <LocateFixed size={17} />}</button>
      </div>
      {routeSystem ? <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setRouteSystem(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="rahcom-map-route-title" className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div><h2 id="rahcom-map-route-title" className="font-bold text-foreground">{t('rahcomChooseRouteApp')}</h2><p className="mt-1 text-sm text-muted-foreground">{routeSystem.systemName}</p></div>
            <button type="button" onClick={() => setRouteSystem(null)} className="rounded-lg border border-border px-3 py-2 text-xs text-foreground">{t('rahcomCancel')}</button>
          </div>
          <div className="mt-4 grid gap-2">
            {([
              ['osm', t('rahcomRouteOpenStreetMap')], ['google', t('rahcomRouteGoogleMaps')],
              ['neshan', t('rahcomRouteNeshan')], ['balad', t('rahcomRouteBalad')],
            ] as const).map(([provider, label]) => <a key={provider} href={routeUrl(provider, routeSystem, location)} target="_blank" rel="noreferrer" onClick={() => setRouteSystem(null)} className="flex min-h-11 items-center justify-between rounded-xl border border-border px-4 text-sm font-medium text-foreground hover:border-primary/50 hover:bg-accent">
              {label}<ExternalLink size={16} className="text-muted-foreground" />
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
