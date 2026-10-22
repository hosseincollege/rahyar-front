'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CircleMarker, LayerGroup, Map as LeafletMap, Marker } from 'leaflet';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { ExternalLink, LocateFixed, Minus, Plus, X } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import 'leaflet/dist/leaflet.css';
import { formatRahcomCoordinates, rahcomApi, type RahcomSystem } from '@/lib/rahcom-api';
import { getCurrentUser } from '@/lib/api/shared/auth-api';
import { RahcomSystemHistory } from '@/components/rahcom/rahcom-system-history';
import { canonicalRahcomAxis, rahcomAxisColor, rahcomAxisCountiesFor } from '@/lib/rahcom-axes';

type Point = { lat: number; lng: number };
type CountyFeature = Feature<Polygon | MultiPolygon, { county: string }>;

function pointInRing(longitude: number, latitude: number, ring: number[][]) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];
    const crosses = (yi > latitude) !== (yj > latitude) && longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointInCounty(longitude: number, latitude: number, county: CountyFeature) {
  const polygons = county.geometry.type === 'Polygon' ? [county.geometry.coordinates] : county.geometry.coordinates;
  return polygons.some((polygon) => pointInRing(longitude, latitude, polygon[0] as number[][])
    && !polygon.slice(1).some((hole) => pointInRing(longitude, latitude, hole as number[][])));
}

function getAxisCountyZones(counties: CountyFeature[], systems: RahcomSystem[], selectedAxis = '') {
  return counties.flatMap((county) => {
    const names = rahcomAxisCountiesFor(selectedAxis);
    if (selectedAxis && !names.includes(county.properties.county)) return [];
    const axes = new Map<string, number>();
    for (const system of systems) {
      if (!pointInCounty(system.longitude, system.latitude, county)) continue;
      const axis = canonicalRahcomAxis(system.axis, system.latitude, system.longitude, system.province);
      if (axis) axes.set(axis, (axes.get(axis) ?? 0) + 1);
    }
    const axis = selectedAxis || [...axes.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
    return axis ? [{ county, axis }] : [];
  });
}

type PopupLabels = {
  code: string; axis: string; copyCode: string; copyCoordinates: string; copied: string;
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
  const copyButton = (value: string, label: string) => `<button type="button" class="rahcom-popup-copy" data-copy-value="${escapeHtml(value)}">${escapeHtml(copiedValue === value ? labels.copied : label)}</button>`;
  const row = (label: string, value: string) => `<div class="rahcom-popup-row"><span>${escapeHtml(label)}</span><b dir="ltr">${escapeHtml(value)}</b></div>`;
  const coordinatePair = formatRahcomCoordinates(system.latitude, system.longitude);
  const optionalRows = ([
    [labels.electricityBillId, system.electricityBillId], [labels.simIp, system.simIp], [labels.radarIp, system.radarIp],
    [labels.cameraIp, system.cameraIp], [labels.pcIp, system.pcIp], [labels.routerIp, system.routerIp], [labels.laptopIp, system.laptopIp],
  ] as const).filter((entry): entry is [string, string] => Boolean(entry[1])).map(([label, value]) => row(label, value));
  const codeRow = `<div class="rahcom-popup-row"><span>${escapeHtml(labels.code)}</span><b dir="ltr">${escapeHtml(system.systemCode)}</b>${copyButton(system.systemCode, labels.copyCode)}</div>`;
  const axis = canonicalRahcomAxis(system.axis, system.latitude, system.longitude, system.province);
  const coordinates = `<div class="rahcom-popup-data">${codeRow}${axis ? row(labels.axis, axis) : ''}<div class="rahcom-popup-copy-row"><b data-coordinate-pair dir="ltr">${escapeHtml(coordinatePair)}</b>${copyButton(coordinatePair, labels.copyCoordinates).replace('data-copy-value=', 'aria-label="' + escapeHtml(labels.copyCoordinates) + '" data-coordinate-copy data-copy-value=')}</div>${optionalRows.join('')}</div>`;
  const actions = editing && canManage
    ? `<p class="rahcom-popup-hint">${escapeHtml(labels.dragHint)}</p><div class="rahcom-popup-actions"><button type="button" data-popup-action="save">${escapeHtml(labels.save)}</button><button type="button" data-popup-action="cancel">${escapeHtml(labels.cancel)}</button><button type="button" data-popup-action="delete" class="danger">${escapeHtml(labels.remove)}</button></div>`
    : `<div class="rahcom-popup-actions">${canManage ? `<button type="button" data-popup-action="edit">${escapeHtml(labels.edit)}</button>` : ''}<button type="button" data-popup-action="route">${escapeHtml(labels.route)}</button><button type="button" data-popup-action="history">${escapeHtml(labels.history)}</button></div>`;
  return `<div class="rahcom-system-popup" dir="rtl"><strong class="rahcom-popup-title">${escapeHtml(system.systemName)}</strong>${coordinates}<div data-popup-status role="status" class="rahcom-popup-status">${escapeHtml(status)}</div>${actions}</div>`;
}

function getStoredProvince() {
  if (typeof window === 'undefined') return 'isfahan';
  const userId = getCurrentUser()?.id;
  return window.localStorage.getItem(`rahyar-selected-province:${userId || 'current'}`) || 'isfahan';
}

export function OpenStreetMap({ focusProvince, showAxisZones, canManage = false, axisFilter, onAxisFilterChange, onAxisOptionsChange, onSystemsCountChange, onSystemsErrorChange, onLocationStatusChange }: {
  focusProvince: boolean;
  showAxisZones: boolean;
  canManage?: boolean;
  axisFilter: string;
  onAxisFilterChange: (axis: string) => void;
  onAxisOptionsChange?: (axes: string[]) => void;
  onSystemsCountChange?: (count: number) => void;
  onSystemsErrorChange?: (error: string) => void;
  onLocationStatusChange?: (status: { locating: boolean; error: boolean }) => void;
}) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const currentMarker = useRef<CircleMarker | null>(null);
  const systemsLayer = useRef<LayerGroup | null>(null);
  const fittedProvince = useRef<string | null>(null);
  const fittedSystemsView = useRef('');
  const [mapReady, setMapReady] = useState(false);
  const [location, setLocation] = useState<Point | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [province, setProvince] = useState(getStoredProvince);
  const [systems, setSystems] = useState<RahcomSystem[]>([]);
  const [systemsRevision, setSystemsRevision] = useState(0);
  const [routeSystem, setRouteSystem] = useState<RahcomSystem | null>(null);
  const [historySystem, setHistorySystem] = useState<RahcomSystem | null>(null);
  const [systemsError, setSystemsError] = useState('');
  const [countyBoundaries, setCountyBoundaries] = useState<CountyFeature[]>([]);
  const { resolvedTheme } = useTheme();
  const { locale } = usePreferences();
  const t = useCallback((key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key), [locale]);
  const axisOptions = useMemo(() => [...new Set(systems.map((system) => canonicalRahcomAxis(system.axis, system.latitude, system.longitude, system.province)).filter(Boolean))].sort((a, b) => a.localeCompare(b, locale)), [locale, systems]);
  const visibleSystems = useMemo(() => systems.filter((system) => !axisFilter || canonicalRahcomAxis(system.axis, system.latitude, system.longitude, system.province) === axisFilter), [axisFilter, systems]);
  const [provinceBoundary, setProvinceBoundary] = useState<Feature<Polygon> | null>(null);
  const popupLabels = useMemo<PopupLabels>(() => ({
    code: t('rahcomSystemCode'), axis: t('rahcomAxis'),
    copyCode: t('rahcomCopyCode'), copyCoordinates: t('rahcomCopyCoordinates'), copied: t('rahcomCopied'),
    electricityBillId: t('rahcomElectricityBillId'), simIp: t('rahcomSimIp'), radarIp: t('rahcomRadarIp'), cameraIp: t('rahcomCameraIp'), pcIp: t('rahcomPcIp'), routerIp: t('rahcomRouterIp'), laptopIp: t('rahcomLaptopIp'), edit: t('rahcomEditCoordinates'),
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
      map.createPane('rahcomAxisZones').style.zIndex = '375';
      map.createPane('rahcomProvinceBoundary').style.zIndex = '430';
      systemsLayer.current = leaflet.layerGroup().addTo(map);
      leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      currentMarker.current = null;
      systemsLayer.current = null;
    };
  }, []);

  useEffect(() => {
    const onSystemsChanged = () => setSystemsRevision((revision) => revision + 1);
    window.addEventListener('rahyar:systems-changed', onSystemsChanged);
    return () => window.removeEventListener('rahyar:systems-changed', onSystemsChanged);
  }, []);

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
    if (!mapReady || province !== 'isfahan') { setCountyBoundaries([]); return; }
    let active = true;
    void fetch('/data/isfahan-counties.geojson')
      .then((response) => {
        if (!response.ok) throw new Error('مرز شهرستان‌ها بارگذاری نشد.');
        return response.json() as Promise<{ features: CountyFeature[] }>;
      })
      .then((collection) => { if (active) setCountyBoundaries(collection.features); })
      .catch(() => { if (active) setCountyBoundaries([]); });
    return () => { active = false; };
  }, [mapReady, province]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !showAxisZones || province !== 'isfahan' || countyBoundaries.length === 0 || systems.length === 0) return;
    let cancelled = false;
    let zonesLayer: LayerGroup | null = null;
    void import('leaflet').then(({ layerGroup, geoJSON }) => {
      if (cancelled || mapRef.current !== map) return;
      const layer = layerGroup().addTo(map);
      zonesLayer = layer;
      for (const zone of getAxisCountyZones(countyBoundaries, systems, axisFilter)) {
        const color = rahcomAxisColor(zone.axis, axisOptions);
        geoJSON(zone.county, {
          pane: 'rahcomAxisZones',
          style: { color, weight: axisFilter ? 2.5 : 1.3, opacity: 0.9, fillColor: color, fillOpacity: axisFilter ? 0.19 : 0.11 },
          onEachFeature: (_feature, countyLayer) => countyLayer.bindTooltip(`${zone.axis} · ${zone.county.properties.county}`, { sticky: true, direction: 'center', opacity: 0.92 }),
        }).addTo(layer);
      }
    });
    return () => {
      cancelled = true;
      zonesLayer?.remove();
    };
  }, [mapReady, showAxisZones, province, countyBoundaries, systems, axisOptions, axisFilter]);

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
          fillColor: dark ? '#020617' : '#172033', fillOpacity: dark ? 0.48 : 0.3,
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
  useEffect(() => { onSystemsCountChange?.(visibleSystems.length); }, [onSystemsCountChange, visibleSystems.length]);
  useEffect(() => { onSystemsErrorChange?.(systemsError); }, [onSystemsErrorChange, systemsError]);

  useEffect(() => {
    if (!mapReady || !systemsLayer.current) return;
    let cancelled = false;
    void import('leaflet').then(({ divIcon, geoJSON, latLngBounds, marker: leafletMarker }) => {
      if (cancelled || !systemsLayer.current) return;
      const layer = systemsLayer.current; layer.clearLayers();
      const markers: Marker[] = visibleSystems.map((system) => {
        const systemAxis = canonicalRahcomAxis(system.axis, system.latitude, system.longitude, system.province);
        const markerColor = systemAxis ? rahcomAxisColor(systemAxis, axisOptions) : '#64748b';
        const systemIcon = divIcon({
          className: '', iconSize: [18, 18], iconAnchor: [9, 9],
          html: `<span style="display:block;width:16px;height:16px;border:2px solid #fff;border-radius:50%;background:${markerColor};box-shadow:0 1px 5px #1118"></span>`,
        });
        const marker = leafletMarker([system.latitude, system.longitude], { icon: systemIcon, draggable: false })
          .bindPopup(systemPopupHtml(system, popupLabels, canManage, false, ''), { minWidth: 250, maxWidth: 340 })
          .addTo(layer);

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
              const position = marker.getLatLng();
              try {
              await rahcomApi.updateSystem(system.id, { latitude: position.lat, longitude: position.lng });
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
        return marker;
      });
      let focusedSystem = false;
      const focusSystemId = window.sessionStorage.getItem('rahyar-rahcom-focus-system');
      if (focusSystemId) {
        const focusIndex = visibleSystems.findIndex((system) => system.id === focusSystemId);
        if (focusIndex >= 0) {
          const marker = markers[focusIndex];
          mapRef.current?.setView(marker.getLatLng(), 15, { animate: false });
          marker.openPopup();
          focusedSystem = true;
        }
        window.sessionStorage.removeItem('rahyar-rahcom-focus-system');
      }
      const viewKey = `${province}:${axisFilter}`;
      const provinceAlreadyFocused = province === 'isfahan' && provinceBoundary && focusProvince;
      if (!focusedSystem && markers.length && fittedSystemsView.current !== viewKey && (Boolean(axisFilter) || !provinceAlreadyFocused)) {
        const countyZones = axisFilter ? getAxisCountyZones(countyBoundaries, visibleSystems, axisFilter) : [];
        const bounds = latLngBounds([]);
        for (const zone of countyZones) bounds.extend(geoJSON(zone.county).getBounds());
        if (bounds.isValid()) mapRef.current?.fitBounds(bounds, { padding: [36, 36], maxZoom: 10 });
        else {
          const markerBounds = latLngBounds(markers.map((marker) => marker.getLatLng()));
          if (markers.length === 1) mapRef.current?.setView(markers[0].getLatLng(), 12, { animate: false });
          else mapRef.current?.fitBounds(markerBounds, { padding: [36, 36], maxZoom: 12 });
        }
        fittedSystemsView.current = viewKey;
      }
    });
    return () => { cancelled = true; };
  }, [mapReady, visibleSystems, t, popupLabels, province, provinceBoundary, focusProvince, canManage, axisFilter, axisOptions, countyBoundaries]);

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
