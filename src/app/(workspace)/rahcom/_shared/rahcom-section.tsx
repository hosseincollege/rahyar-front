'use client';

import { CircleHelp, ClipboardList, Layers, LocateFixed, Map as MapIcon, MapPin, MapPinned, Plus, Route, Scan, Sun, Ticket, TriangleAlert, Upload, X } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { OpenStreetMap, type IncidentMapSummary, type UnmappedSolarDetail } from '@/app/(workspace)/rahcom/map/open-street-map';
import { RahcomActions } from '@/app/(workspace)/rahcom/actions/rahcom-actions';
import { RahcomSystemsList } from '@/app/(workspace)/rahcom/systems/rahcom-systems-list';
import { RahcomDailyTraffic } from '@/app/(workspace)/rahcom/daily-traffic/rahcom-daily-traffic';
import { RahcomSolarDaily } from '@/app/(workspace)/rahcom/solar-daily/rahcom-solar-daily';
import { RahcomHeaderDate } from '@/app/(workspace)/rahcom/_shared/rahcom-header-date';
import { RahcomCountCapsule } from '@/app/(workspace)/rahcom/_shared/rahcom-count-capsule';
import { getCurrentOrganizationId, getCurrentUser } from '@/lib/api/shared/auth-api';
import { settingsApi } from '@/app/(workspace)/settings/settings-api';
import { uiMessage } from '@/lib/ui-messages';
import { rahcomAxisColor } from '@/lib/api/rahcom/rahcom-axes';
import { RahcomTickets } from '@/app/(workspace)/rahcom/tickets/rahcom-tickets';
import { RahcomAggregateList } from '@/app/(workspace)/rahcom/aggregate/rahcom-aggregate-list';
import { rahcomApi } from '@/lib/api/rahcom/rahcom-api';
import type { RahcomSolarSnapshot } from '@/lib/api/rahcom/rahcom-api';
import { rahcomSolarSnapshotNumber } from '@/lib/api/rahcom/solar-status';
import { tehranDateKey } from '@/lib/api/rahcom/solar-status';
import { useRahcomDate } from './rahcom-date';

export type RahcomSection = 'map' | 'actions' | 'systems' | 'daily-traffic' | 'solar-daily' | 'aggregate' | 'tickets';

export function SolarSnapshotPicker({ snapshots, selectedId, locale, onSelect }: { snapshots: RahcomSolarSnapshot[]; selectedId: string; locale: Parameters<typeof uiMessage>[0]; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = snapshots.find((snapshot) => snapshot.id === selectedId) ?? snapshots[0];
  const number = new Intl.NumberFormat(locale);
  const time = (snapshot: RahcomSolarSnapshot) => new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(snapshot.capturedAt));
  const label = (snapshot: RahcomSolarSnapshot) => ({ ordinal: number.format(rahcomSolarSnapshotNumber(snapshot, snapshots)), time: time(snapshot) });

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      // Keep each option's content width equal to the trigger; the menu adds only its border.
      const width = rect.width + 2;
      setPosition({ top: rect.bottom + 6, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), width });
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    updatePosition();
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  if (!selected) return null;
  const selectedLabel = label(selected);
  return <>
    <button ref={triggerRef} type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={`${uiMessage(locale, 'rahcomSolarReport')} · ${uiMessage(locale, 'rahcomSolarDownFilter')}`} title={uiMessage(locale, 'rahcomSolarDownFilter')} onClick={() => setOpen((value) => !value)} className="inline-flex h-9 shrink-0 items-center overflow-hidden rounded-full border border-border bg-background text-xs tabular-nums text-foreground transition-colors hover:border-primary hover:bg-primary/5" dir="rtl">
      <span title={uiMessage(locale, 'rahcomSolarReport')} className="grid h-full w-9 shrink-0 place-items-center text-muted-foreground"><Sun aria-hidden="true" className="size-4" /></span>
      <span className="grid h-full w-24 shrink-0 grid-cols-2 border-e border-border" dir="ltr">
        <span className="flex h-full items-center justify-center"><span style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }} className="grid size-5 place-items-center rounded-full border text-[10px] font-semibold">{selectedLabel.ordinal}</span></span><span className="flex h-full items-center justify-center" style={{ color: 'var(--primary)' }}><time>{selectedLabel.time}</time></span>
      </span>
    </button>
    {open && position && typeof document !== 'undefined' && createPortal(<div ref={menuRef} role="listbox" aria-label={uiMessage(locale, 'rahcomSolarDownFilter')} className="fixed z-[9999] max-h-60 overflow-y-auto rounded-xl border border-border p-0 text-foreground shadow-xl" style={{ top: position.top, left: position.left, width: position.width, backgroundColor: 'var(--card)' }}>
      {snapshots.map((snapshot) => {
        const item = label(snapshot);
        const active = snapshot.id === selected.id;
        return <button key={snapshot.id} type="button" role="option" aria-selected={active} onClick={() => { onSelect(snapshot.id); setOpen(false); }} className={`grid h-9 w-full grid-cols-2 rounded-full text-xs tabular-nums transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`} dir="ltr"><span className="flex items-center justify-center"><span style={active ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : undefined} className={`grid size-5 place-items-center rounded-full border text-[10px] font-semibold ${active ? '' : 'border-border text-muted-foreground'}`}>{item.ordinal}</span></span><span className={`flex items-center justify-center ${active ? 'font-semibold' : 'text-muted-foreground'}`} style={active ? { color: 'var(--primary)' } : undefined}><time>{item.time}</time></span></button>;
      })}
    </div>, document.body)}
  </>;
}

function MapSystemsCapsule({ systemsCount, details, locale }: { systemsCount: number; details: UnmappedSolarDetail[]; locale: Parameters<typeof uiMessage>[0] }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const title = uiMessage(locale, details.length ? 'rahcomIncidentDiscrepancyDetails' : 'rahcomSystemsOnMap');

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(384, window.innerWidth - 24);
      const height = Math.min(panelRef.current?.offsetHeight ?? 280, window.innerHeight - 24);
      const top = rect.bottom + 8 + height <= window.innerHeight ? rect.bottom + 8 : Math.max(12, rect.top - height - 8);
      const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
      setPosition({ top, left });
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    updatePosition();
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, details.length]);

  const content = <span className="inline-flex h-9 shrink-0 items-center overflow-hidden rounded-full border border-border bg-background text-sm text-foreground">
    <span className="inline-flex h-full items-center gap-1.5 px-3"><MapPin size={16} style={{ color: 'var(--primary)' }} /><strong className="font-bold tabular-nums">{new Intl.NumberFormat(locale).format(systemsCount)}</strong></span>
    {details.length > 0 && <span className="inline-flex h-full items-center border-s border-amber-500/40 bg-amber-500/10 px-2 text-amber-600"><strong className="tabular-nums">+{new Intl.NumberFormat(locale).format(details.length)}</strong></span>}
  </span>;

  return <>
    {details.length > 0 ? <button ref={triggerRef} type="button" aria-expanded={open} aria-haspopup="dialog" aria-label={`${new Intl.NumberFormat(locale).format(systemsCount)} ${uiMessage(locale, 'rahcomSystemsOnMap')}، ${new Intl.NumberFormat(locale).format(details.length)} ${uiMessage(locale, 'rahcomMapUnlocatedCount')}`} title={title} onClick={() => setOpen((value) => !value)} className="shrink-0 rounded-full text-start transition-colors hover:border-amber-500/70">{content}</button> : <span role="status" aria-label={`${new Intl.NumberFormat(locale).format(systemsCount)} ${uiMessage(locale, 'rahcomSystemsOnMap')}`} title={uiMessage(locale, 'rahcomSystemsOnMap')}>{content}</span>}
    {open && position && typeof document !== 'undefined' && createPortal(<div ref={panelRef} role="dialog" aria-label={title} dir="auto" className="fixed z-[10000] max-h-[min(70vh,28rem)] w-[min(24rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-amber-500/40 p-3 text-sm text-foreground shadow-xl" style={{ top: position.top, left: position.left, backgroundColor: 'var(--card, #20262d)', opacity: 1, backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
      <p className="font-semibold text-amber-600">{title}</p>
      <p className="mt-2 text-xs text-muted-foreground">{new Intl.NumberFormat(locale).format(systemsCount)} {uiMessage(locale, 'rahcomSystemsOnMap')}</p>
      <p className="mt-1 text-xs text-muted-foreground">{new Intl.NumberFormat(locale).format(details.length)} {uiMessage(locale, 'rahcomMapUnlocatedCount')}</p>
      <ul className="mt-2 space-y-2">{details.map((item) => <li key={`${item.code}:${item.reason}`} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2"><code dir="ltr" className="font-mono">{item.code}</code><span className="text-xs text-muted-foreground">{uiMessage(locale, item.reason === 'unregistered' ? 'rahcomMapSystemNotRegistered' : 'rahcomMapCoordinatesMissing')}</span></li>)}</ul>
    </div>, document.body)}
  </>;
}

export function RahcomSectionPage({ section }: { section: RahcomSection }) {
  const { locale } = usePreferences();
  const { date, setDateText } = useRahcomDate();
  const [province, setProvince] = useState('isfahan');
  const loadSectionMarkedDates = useCallback(async (from: string, to: string) => {
    const range = { from, to };
    const [solar, tickets, activities, trafficDates] = await Promise.all([
      section === 'solar-daily' || section === 'aggregate' ? rahcomApi.solarSnapshots(province) : Promise.resolve([]),
      section === 'tickets' || section === 'aggregate' ? rahcomApi.importedTickets(province) : Promise.resolve([]),
      section === 'actions' ? rahcomApi.activities(from, range, province) : Promise.resolve([]),
      section === 'aggregate' ? rahcomApi.trafficSnapshotDates(province, from, to) : Promise.resolve([]),
    ]);
    const inRange = (value: string) => value >= from && value <= to;
    return [...new Set([
      ...solar.map((item) => tehranDateKey(item.capturedAt)).filter(inRange),
      ...tickets.map((item) => item.listDate.slice(0, 10)).filter(inRange),
      ...activities.map((item) => item.activityDate.slice(0, 10)).filter(inRange),
      ...trafficDates,
    ])].sort();
  }, [section, province]);
  const [focusProvince, setFocusProvince] = useState(true);
  const [mapSystemsCount, setMapSystemsCount] = useState(0);
  const [mapUnmappedSolarDetails, setMapUnmappedSolarDetails] = useState<UnmappedSolarDetail[]>([]);
  const [mapIncidentSummary, setMapIncidentSummary] = useState<IncidentMapSummary>({ totalCodes: 0, mappedCodes: 0, details: [] });
  const [sectionSystemsCount, setSectionSystemsCount] = useState(0);
  const [mapSystemsError, setMapSystemsError] = useState('');
  const [mapLocating, setMapLocating] = useState(false);
  const [locateMeAction, setLocateMeAction] = useState<(() => void) | null>(null);
  const [mapAxisOptions, setMapAxisOptions] = useState<string[]>([]);
  const [axisSource, setAxisSource] = useState<'traffic' | 'rahyar' | 'zones'>('traffic');
  const [aggregateSetOperation, setAggregateSetOperation] = useState<'union' | 'intersection'>('union');
  const [aggregateSources, setAggregateSources] = useState({ traffic: true, road: true, solar: true, tickets: true });
  const renderedAxisSource = useDeferredValue(axisSource);
  useEffect(() => { if (province !== 'isfahan' && axisSource === 'zones') setAxisSource('traffic'); }, [axisSource, province]);
  const [mapSourceFilterActive, setMapSourceFilterActive] = useState(false);
  const [mapFilterSource, setMapFilterSource] = useState<'traffic' | 'road-list' | 'solar' | 'tickets' | 'aggregate'>('solar');
  const [showMapIncidents, setShowMapIncidents] = useState(true);
  const renderedShowMapIncidents = useDeferredValue(showMapIncidents);
  const renderedMapFilterSource = useDeferredValue(mapFilterSource);
  const renderedMapSourceFilterActive = useDeferredValue(mapSourceFilterActive);
  const [mapIncidentCount, setMapIncidentCount] = useState(0);
  const [showAxisLegend, setShowAxisLegend] = useState(false);
  const [solarSnapshotAvailable, setSolarSnapshotAvailable] = useState<boolean | null>(null);
  const [solarSnapshots, setSolarSnapshots] = useState<RahcomSolarSnapshot[]>([]);
  const [selectedSolarSnapshotId, setSelectedSolarSnapshotId] = useState('');
  const renderedSolarSnapshotId = useDeferredValue(selectedSolarSnapshotId);
  const toolbarUpdating = renderedAxisSource !== axisSource
    || renderedShowMapIncidents !== showMapIncidents
    || renderedMapFilterSource !== mapFilterSource
    || renderedMapSourceFilterActive !== mapSourceFilterActive
    || renderedSolarSnapshotId !== selectedSolarSnapshotId;
  const [mapLocationError, setMapLocationError] = useState(false);
  const [accessState, setAccessState] = useState<'loading' | 'allowed' | 'denied' | 'error'>('loading');
  const [canManageRahcom, setCanManageRahcom] = useState(false);
  const [canRecordActivities, setCanRecordActivities] = useState(false);
  const [solarFormOpen, setSolarFormOpen] = useState(false);
  const [actionsWorkflowOpen, setActionsWorkflowOpen] = useState(false);
  const handleMapCount = useCallback((count: number) => setMapSystemsCount(count), []);
  const handleUnmappedSolarDetails = useCallback((details: UnmappedSolarDetail[]) => setMapUnmappedSolarDetails(details), []);
  const handleIncidentMapSummary = useCallback((summary: IncidentMapSummary) => setMapIncidentSummary(summary), []);
  const mapDiscrepancyDetails = useMemo(() => {
    const byCode = new Map<string, UnmappedSolarDetail>();
    for (const detail of [...mapIncidentSummary.details, ...mapUnmappedSolarDetails]) {
      const key = detail.code.normalize('NFKC').trim().toUpperCase();
      if (!byCode.has(key) || detail.reason === 'unregistered') byCode.set(key, detail);
    }
    return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
  }, [mapIncidentSummary.details, mapUnmappedSolarDetails]);
  const handleSectionSystemsCount = useCallback((count: number) => setSectionSystemsCount(count), []);
  useEffect(() => { setSectionSystemsCount(0); }, [section, date, province]);
  const handleMapIncidentCount = useCallback((count: number) => setMapIncidentCount(count), []);
  const handleMapError = useCallback((error: string) => setMapSystemsError(error), []);
  const handleAxisOptions = useCallback((axes: string[]) => setMapAxisOptions(axes), []);
  const handleLocationStatus = useCallback((status: { locating: boolean; error: boolean }) => { setMapLocationError(status.error); setMapLocating(status.locating); }, []);
  const handleLocateMeReady = useCallback((action: (() => void) | null) => setLocateMeAction(() => action), []);
  const handleSolarSnapshots = useCallback((snapshots: RahcomSolarSnapshot[] | null) => {
    if (snapshots === null) {
      setSolarSnapshotAvailable(null);
      setSolarSnapshots([]);
      return;
    }
    const ordered = [...snapshots].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() || new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime());
    setSolarSnapshots(ordered);
    const daySnapshots = ordered.filter((snapshot) => tehranDateKey(snapshot.capturedAt) === (date ?? tehranDateKey()));
    setSolarSnapshotAvailable(daySnapshots.length > 0);
    setSelectedSolarSnapshotId((current) => daySnapshots.some((snapshot) => snapshot.id === current) ? current : daySnapshots[0]?.id ?? '');
  }, [date]);
  useEffect(() => {
    if (!['map', 'daily-traffic', 'solar-daily', 'aggregate'].includes(section)) return;
    let active = true;
    handleSolarSnapshots(null);
    void rahcomApi.solarSnapshots(province, date ?? undefined).then((snapshots) => { if (active) handleSolarSnapshots(snapshots); }).catch(() => { if (active) handleSolarSnapshots([]); });
    return () => { active = false; };
  }, [date, handleSolarSnapshots, province, section]);
  const snapshotsForDate = solarSnapshots.filter((snapshot) => tehranDateKey(snapshot.capturedAt) === (date ?? tehranDateKey()));
  const selectedSolarSnapshot = snapshotsForDate.find((snapshot) => snapshot.id === selectedSolarSnapshotId) ?? snapshotsForDate[0] ?? null;
  const solarSnapshotPicker = snapshotsForDate.length > 0 ? <SolarSnapshotPicker snapshots={snapshotsForDate} selectedId={selectedSolarSnapshot?.id ?? ''} locale={locale} onSelect={setSelectedSolarSnapshotId} /> : null;
  const mapFilterSourceLabels = {
    traffic: locale === 'fa' ? '\u0628\u062f\u0648\u0646 \u062a\u0631\u062f\u062f' : uiMessage(locale, 'rahcomDailyTraffic'),
    'road-list': uiMessage(locale, 'rahcomRoadList'),
    solar: uiMessage(locale, 'rahcomSolarDaily'),
    tickets: uiMessage(locale, 'rahcomTickets'),
    aggregate: uiMessage(locale, 'rahcomAggregateList'),
  };
  const MapFilterIcon = mapFilterSource === 'traffic' ? ClipboardList : mapFilterSource === 'road-list' ? Route : mapFilterSource === 'solar' ? Sun : mapFilterSource === 'tickets' ? Ticket : Layers;
  useEffect(() => {
    const initialized = window.localStorage.getItem('rahcom-show-incidents-default-v2') === 'true';
    if (!initialized) {
      window.localStorage.setItem('rahcom-show-incidents', 'true');
      window.localStorage.setItem('rahcom-show-incidents-default-v2', 'true');
      setShowMapIncidents(true);
      return;
    }
    setShowMapIncidents(window.localStorage.getItem('rahcom-show-incidents') !== 'false');
  }, []);

  useEffect(() => {
    let active = true;
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      setAccessState('denied');
      return;
    }
    void Promise.all([settingsApi.getOrganizationAccess(organizationId), rahcomApi.access()]).then(([access, rahcomAccess]) => {
      if (!active) return;
      setCanManageRahcom(Boolean(access.canManageRahcom));
      setCanRecordActivities(rahcomAccess.canRecordActivities);
      if (rahcomAccess.selectedProvince) setProvince(rahcomAccess.selectedProvince);
      setAccessState(access.canViewRahcom ? 'allowed' : 'denied');
    }).catch(() => {
      if (active) setAccessState('error');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const userId = getCurrentUser()?.id;
    const key = `rahyar-selected-province:${userId || 'current'}`;
    const frame = window.requestAnimationFrame(() => {
      setProvince(window.localStorage.getItem(key) || 'isfahan');
      setFocusProvince(window.localStorage.getItem('rahyar-rahcom-focus-province') !== 'false');
    });
    const onProvinceChange = (event: Event) => {
      const selected = (event as CustomEvent<{ province?: string }>).detail?.province;
      if (selected) setProvince(selected);
    };
    const onStorageChange = (event: StorageEvent) => {
      if (event.key === key) setProvince(event.newValue || 'isfahan');
      if (event.key === 'rahyar-rahcom-focus-province') setFocusProvince(event.newValue !== 'false');
    };
    window.addEventListener('rahyar:province-change', onProvinceChange);
    window.addEventListener('storage', onStorageChange);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('rahyar:province-change', onProvinceChange);
      window.removeEventListener('storage', onStorageChange);
    };
  }, []);

  return (
    <main dir={getLocaleDirection(locale)} className={section === 'map' ? 'mx-auto flex h-full min-h-0 w-full max-w-none flex-col gap-2 overflow-hidden' : section === 'systems' || section === 'daily-traffic' ? 'min-w-0 w-full max-w-full overflow-x-clip space-y-5' : section === 'solar-daily' || section === 'aggregate' || section === 'tickets' ? 'w-full max-w-none space-y-5' : 'mx-auto max-w-5xl space-y-5'}>
      {section !== 'systems' && section !== 'daily-traffic' && section !== 'actions' && <header className={`rahcom-mobile-toolbar ${section === 'map' ? 'flex shrink-0 flex-wrap items-center gap-1 overflow-visible py-1 sm:flex-nowrap sm:overflow-x-auto' : section === 'solar-daily' || section === 'aggregate' ? 'flex flex-wrap items-center gap-2 overflow-visible py-1 sm:flex-nowrap sm:overflow-x-auto' : section === 'tickets' ? 'flex flex-wrap items-center justify-start gap-2' : 'space-y-2 rounded-2xl border border-border bg-card p-3 sm:p-4'} max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:overflow-y-hidden max-sm:pb-2`}>
        <div className={section === 'map' || section === 'solar-daily' || section === 'aggregate' ? 'contents' : 'flex flex-wrap items-center gap-2'}>
          {section === 'map' && <><RahcomHeaderDate /><SolarSnapshotPicker snapshots={snapshotsForDate} selectedId={selectedSolarSnapshot?.id ?? ''} locale={locale} onSelect={setSelectedSolarSnapshotId} /></>}
          {section === 'map' && <MapSystemsCapsule systemsCount={mapSystemsCount} details={mapDiscrepancyDetails} locale={locale} />}
          {section !== 'map' && <><RahcomHeaderDate loadMarkedDates={['solar-daily', 'tickets', 'aggregate', 'actions'].includes(section) ? loadSectionMarkedDates : undefined} />{['solar-daily', 'aggregate'].includes(section) && solarSnapshotPicker}</>}
          {['solar-daily', 'tickets', 'aggregate'].includes(section) && <RahcomCountCapsule count={sectionSystemsCount} />}
          {section === 'solar-daily' && <button type="button" aria-pressed={solarFormOpen} onClick={() => setSolarFormOpen((open) => !open)} aria-label={uiMessage(locale, solarFormOpen ? 'solarCloseForm' : 'solarAddSnapshot')} title={uiMessage(locale, solarFormOpen ? 'solarCloseForm' : 'solarAddSnapshot')} style={solarFormOpen ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`grid size-9 shrink-0 place-items-center rounded-full border transition-colors ${solarFormOpen ? '' : 'border-border bg-background text-foreground hover:border-primary hover:text-primary'}`}>{solarFormOpen ? <X size={17} /> : <Plus size={17} />}</button>}
          {section === 'tickets' && canManageRahcom && <button type="button" onClick={() => window.dispatchEvent(new Event('rahyar:tickets-upload-click'))} aria-label={uiMessage(locale, 'rahcomUploadExcel')} title={uiMessage(locale, 'rahcomUploadExcel')} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary"><Upload size={17} /></button>}
          {section === 'aggregate' && <>
            <button type="button" aria-pressed={showMapIncidents} aria-label={uiMessage(locale, 'rahcomIncidentFilter')} title={uiMessage(locale, 'rahcomIncidentFilter')} onClick={() => { const enabled = !showMapIncidents; setShowMapIncidents(enabled); window.localStorage.setItem('rahcom-show-incidents', String(enabled)); }} style={showMapIncidents ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`grid size-9 shrink-0 place-items-center rounded-full border transition-colors ${showMapIncidents ? '' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}><TriangleAlert size={16} /></button>
            <div className="inline-flex shrink-0 overflow-hidden rounded-full border border-border bg-background" role="group" aria-label={uiMessage(locale, 'rahcomAxesTitle')}>
              <button type="button" aria-pressed={axisSource === 'traffic'} aria-label={uiMessage(locale, 'rahcomTrafficList')} title={uiMessage(locale, 'rahcomTrafficList')} onClick={() => setAxisSource('traffic')} style={axisSource === 'traffic' ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' } : undefined} className={`grid size-9 place-items-center ${axisSource === 'traffic' ? '' : 'text-muted-foreground hover:bg-muted'}`}><ClipboardList size={16} /></button>
              <button type="button" aria-pressed={axisSource === 'rahyar'} aria-label={uiMessage(locale, 'rahcomOperationalAxisColumn')} title={uiMessage(locale, 'rahcomOperationalAxisColumn')} onClick={() => setAxisSource('rahyar')} style={axisSource === 'rahyar' ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' } : undefined} className={`grid size-9 place-items-center border-s border-border ${axisSource === 'rahyar' ? '' : 'text-muted-foreground hover:bg-muted'}`}><MapPinned size={16} /></button>
              <button type="button" disabled={province !== 'isfahan'} aria-pressed={axisSource === 'zones'} aria-label={uiMessage(locale, 'rahcomZones')} title={uiMessage(locale, 'rahcomZones')} onClick={() => setAxisSource('zones')} style={axisSource === 'zones' ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' } : undefined} className={`grid size-9 place-items-center border-s border-border disabled:cursor-not-allowed disabled:opacity-40 ${axisSource === 'zones' ? '' : 'text-muted-foreground hover:bg-muted'}`}><MapIcon size={16} /></button>
            </div>
            <div className="inline-flex shrink-0 overflow-hidden rounded-full border border-border bg-background text-sm" role="group" aria-label={uiMessage(locale, 'rahcomAggregateOperation')}>
              <button type="button" aria-pressed={aggregateSetOperation === 'union'} onClick={() => setAggregateSetOperation('union')} style={aggregateSetOperation === 'union' ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' } : undefined} className={`px-3 py-1.5 transition-colors ${aggregateSetOperation === 'union' ? '' : 'text-muted-foreground hover:bg-muted'}`}>{uiMessage(locale, 'rahcomAggregateUnion')}</button>
              <button type="button" aria-pressed={aggregateSetOperation === 'intersection'} onClick={() => setAggregateSetOperation('intersection')} style={aggregateSetOperation === 'intersection' ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' } : undefined} className={`border-s border-border px-3 py-1.5 transition-colors ${aggregateSetOperation === 'intersection' ? '' : 'text-muted-foreground hover:bg-muted'}`}>{uiMessage(locale, 'rahcomAggregateIntersection')}</button>
            </div>
            <div className="inline-flex shrink-0 overflow-hidden rounded-full border border-border bg-background text-sm" role="group" aria-label={uiMessage(locale, 'rahcomAggregateList')}>
              {([
                ['traffic', locale === 'fa' ? '\u0628\u062f\u0648\u0646 \u062a\u0631\u062f\u062f' : uiMessage(locale, 'rahcomDailyTraffic')],
                ['road', uiMessage(locale, 'rahcomRoadList')],
                ['tickets', uiMessage(locale, 'rahcomTickets')],
                ['solar', uiMessage(locale, 'rahcomSolarDaily')],
              ] as const).map(([source, label], index) => <button key={source} type="button" aria-pressed={aggregateSources[source]} onClick={() => setAggregateSources((current) => ({ ...current, [source]: !current[source] }))} style={aggregateSources[source] ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' } : undefined} className={`px-3 py-1.5 transition-colors ${index ? 'border-s border-border ' : ''}${aggregateSources[source] ? '' : 'text-muted-foreground hover:bg-muted'}`}>{label}</button>)}
            </div>
          </>}
          {(section === 'map' || section === 'solar-daily') && <button type="button" aria-pressed={showMapIncidents} aria-label={uiMessage(locale, 'rahcomIncidentFilter')} title={uiMessage(locale, 'rahcomIncidentFilter')} onClick={() => { const enabled = !showMapIncidents; setShowMapIncidents(enabled); window.localStorage.setItem('rahcom-show-incidents', String(enabled)); }} style={showMapIncidents ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`grid size-9 shrink-0 place-items-center rounded-full border transition-colors ${showMapIncidents ? '' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}><TriangleAlert size={16} /></button>}
          {section === 'map' && (mapLocationError || mapSystemsError) && <div className="flex shrink-0 items-center gap-2">
            {mapLocationError && <span role="alert" className="text-xs text-destructive">{uiMessage(locale, 'rahcomLocationUnavailable')}</span>}
            {mapSystemsError && <span role="alert" className="text-xs text-destructive">{mapSystemsError}</span>}
          </div>}
        </div>
        {section === 'map' && <div className="contents">
          {province === 'isfahan' && <button type="button" aria-pressed={focusProvince} aria-label={uiMessage(locale, 'rahcomFocusProvince')} title={uiMessage(locale, 'rahcomFocusProvince')} onClick={() => {
              const enabled = !focusProvince;
              setFocusProvince(enabled);
              window.localStorage.setItem('rahyar-rahcom-focus-province', String(enabled));
            }} style={focusProvince ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`grid size-9 shrink-0 place-items-center rounded-full border transition-colors ${focusProvince ? '' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}><Scan size={17} /></button>}
          <div className="inline-flex overflow-hidden rounded-full border border-border bg-background" role="group" aria-label={uiMessage(locale, 'rahcomAxis')}>
            <button type="button" aria-pressed={axisSource === 'traffic'} aria-label={uiMessage(locale, 'rahcomTrafficList')} title={uiMessage(locale, 'rahcomTrafficList')} onClick={() => setAxisSource('traffic')} style={axisSource === 'traffic' ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' } : undefined} className={`grid size-9 place-items-center transition-colors ${axisSource === 'traffic' ? '' : 'text-muted-foreground hover:bg-muted'}`}><ClipboardList size={17} /></button>
            <button type="button" aria-pressed={axisSource === 'rahyar'} aria-label={uiMessage(locale, 'rahcomAxesTitle')} title={uiMessage(locale, 'rahcomAxesTitle')} onClick={() => setAxisSource('rahyar')} style={axisSource === 'rahyar' ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' } : undefined} className={`grid size-9 place-items-center border-s border-border transition-colors ${axisSource === 'rahyar' ? '' : 'text-muted-foreground hover:bg-muted'}`}><MapPinned size={17} /></button>
            <button type="button" disabled={province !== 'isfahan'} aria-pressed={axisSource === 'zones'} aria-label={uiMessage(locale, 'rahcomZones')} title={uiMessage(locale, 'rahcomZones')} onClick={() => setAxisSource('zones')} style={axisSource === 'zones' ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' } : undefined} className={`grid size-9 place-items-center border-s border-border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${axisSource === 'zones' ? '' : 'text-muted-foreground hover:bg-muted'}`}><MapIcon size={17} /></button>
          </div>
          <button type="button" aria-pressed={showAxisLegend} aria-label={uiMessage(locale, 'rahcomShowAxisLegend')} title={uiMessage(locale, 'rahcomShowAxisLegend')} onClick={() => setShowAxisLegend((show) => !show)} style={showAxisLegend ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`grid size-9 shrink-0 place-items-center rounded-full border transition-colors ${showAxisLegend ? '' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}><CircleHelp size={18} /></button>
          <button type="button" onClick={() => { setMapLocationError(false); setMapLocating(true); locateMeAction?.(); }} disabled={!locateMeAction || mapLocating} aria-label={uiMessage(locale, 'rahcomLocateMe')} title={uiMessage(locale, 'rahcomLocateMe')} className="inline-grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground hover:bg-muted disabled:opacity-50">{mapLocating ? <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <LocateFixed size={16} />}</button>
          <label className="sr-only" htmlFor="rahcom-map-filter-source">{uiMessage(locale, 'rahcomMapFilterSource')}</label>
          <select id="rahcom-map-filter-source" value={mapFilterSource} onChange={(event) => setMapFilterSource(event.target.value as typeof mapFilterSource)} aria-label={uiMessage(locale, 'rahcomMapFilterSource')} title={uiMessage(locale, 'rahcomMapFilterSource')} className="h-9 max-w-36 shrink rounded-full border border-border bg-background px-2 text-xs text-foreground max-sm:w-28 max-sm:max-w-28">
            {(['solar', 'traffic', 'road-list', 'tickets', 'aggregate'] as const).map((source) => <option key={source} value={source}>{mapFilterSourceLabels[source]}</option>)}
          </select>
          <button type="button" aria-pressed={mapSourceFilterActive} aria-label={`${uiMessage(locale, 'rahcomMapShowSource')}: ${mapFilterSourceLabels[mapFilterSource]}`} title={`${uiMessage(locale, 'rahcomMapShowSource')}: ${mapFilterSourceLabels[mapFilterSource]}`} disabled={mapFilterSource === 'solar' && !(solarSnapshotAvailable === true && selectedSolarSnapshot)} onClick={() => setMapSourceFilterActive((enabled) => !enabled)} style={mapSourceFilterActive ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`grid size-9 shrink-0 place-items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${mapSourceFilterActive ? '' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}><MapFilterIcon size={18} /></button>
          {(solarSnapshotAvailable === false || solarSnapshotAvailable === true && !selectedSolarSnapshot) && <span role="status" className="text-xs text-muted-foreground">{uiMessage(locale, 'rahcomSolarTodaySnapshotMissing')}</span>}
        </div>}
        {section === 'solar-daily' && <div className="contents">
          <div className="inline-flex shrink-0 overflow-hidden rounded-full border border-border bg-background" role="group" aria-label={uiMessage(locale, 'rahcomAxis')}>
            <button type="button" aria-pressed={axisSource === 'traffic'} aria-label={uiMessage(locale, 'rahcomTrafficList')} title={uiMessage(locale, 'rahcomTrafficList')} onClick={() => setAxisSource('traffic')} style={axisSource === 'traffic' ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' } : undefined} className={`grid size-9 place-items-center transition-colors ${axisSource === 'traffic' ? '' : 'text-muted-foreground hover:bg-muted'}`}><ClipboardList size={17} /></button>
            <button type="button" aria-pressed={axisSource === 'rahyar'} aria-label={uiMessage(locale, 'rahcomAxesTitle')} title={uiMessage(locale, 'rahcomAxesTitle')} onClick={() => setAxisSource('rahyar')} style={axisSource === 'rahyar' ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' } : undefined} className={`grid size-9 place-items-center border-s border-border transition-colors ${axisSource === 'rahyar' ? '' : 'text-muted-foreground hover:bg-muted'}`}><MapPinned size={17} /></button>
            <button type="button" disabled={province !== 'isfahan'} aria-pressed={axisSource === 'zones'} aria-label={uiMessage(locale, 'rahcomZones')} title={uiMessage(locale, 'rahcomZones')} onClick={() => setAxisSource('zones')} style={axisSource === 'zones' ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' } : undefined} className={`grid size-9 place-items-center border-s border-border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${axisSource === 'zones' ? '' : 'text-muted-foreground hover:bg-muted'}`}><MapIcon size={17} /></button>
          </div>
        </div>}
        {section === 'solar-daily' && <div id="rahcom-solar-table-controls" className="contents" />}
        {toolbarUpdating && <span role="status" aria-label={uiMessage(locale, 'rahcomSystemsLoading')} className="ms-auto inline-flex size-9 shrink-0 items-center justify-center text-primary"><span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /></span>}
      </header>}

      {section === 'map' && showAxisLegend && <section aria-label={uiMessage(locale, 'rahcomShowAxisLegend')} className="rounded-2xl border border-border bg-card p-3 sm:p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">{uiMessage(locale, axisSource === 'traffic' ? 'rahcomTrafficList' : axisSource === 'zones' ? 'rahcomZones' : 'rahcomAxesTitle')}</h2>
        {mapAxisOptions.length > 0 ? <div className="flex flex-wrap gap-x-4 gap-y-2">{mapAxisOptions.map((axis) => <span key={axis} className="inline-flex items-center gap-2 text-xs text-muted-foreground"><i className="size-3 rounded-full" style={{ backgroundColor: rahcomAxisColor(axis, mapAxisOptions) }} />{axis}</span>)}</div> : <p className="text-xs text-muted-foreground">{uiMessage(locale, 'rahcomNoAxes')}</p>}
      </section>}


      {accessState === 'loading' ? (
        <p role="status" className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">{uiMessage(locale, 'rahcomSystemsLoading')}</p>
      ) : accessState === 'denied' ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">{uiMessage(locale, 'rahcomAccessDenied')}</p>
      ) : accessState === 'error' ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">{uiMessage(locale, 'rahcomAccessCheckFailed')}</p>
      ) : section === 'map' ? (
        <section aria-label={uiMessage(locale, 'rahcomMap')} className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
          <OpenStreetMap focusProvince={focusProvince} canManage={canManageRahcom} mapSourceFilterActive={renderedMapSourceFilterActive} mapFilterSource={renderedMapFilterSource} selectedSolarSnapshotId={renderedSolarSnapshotId} showMapIncidents={renderedShowMapIncidents} axisSource={renderedAxisSource} onAxisOptionsChange={handleAxisOptions} onSystemsCountChange={handleMapCount} onUnmappedSolarDetailsChange={handleUnmappedSolarDetails} onIncidentCountChange={handleMapIncidentCount} onIncidentMapSummaryChange={handleIncidentMapSummary} onSystemsErrorChange={handleMapError} onLocationStatusChange={handleLocationStatus} onLocateMeReady={handleLocateMeReady} onSolarSnapshotsChange={handleSolarSnapshots} />
        </section>
      ) : section === 'actions' ? (
        <>
          <header className="rahcom-mobile-toolbar flex flex-wrap items-center gap-2 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:overflow-y-hidden max-sm:pb-2">
            <RahcomHeaderDate loadMarkedDates={loadSectionMarkedDates} />
            {canRecordActivities && <button type="button" onClick={() => setActionsWorkflowOpen((open) => !open)} aria-label={uiMessage(locale, actionsWorkflowOpen ? 'solarCloseForm' : 'rahcomWorkflowRegisterCodes')} title={uiMessage(locale, actionsWorkflowOpen ? 'solarCloseForm' : 'rahcomWorkflowRegisterCodes')} aria-expanded={actionsWorkflowOpen} style={actionsWorkflowOpen ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`grid size-9 place-items-center rounded-full border transition-colors ${actionsWorkflowOpen ? '' : 'border-border bg-background text-foreground hover:border-primary hover:text-primary'}`}><Plus size={18} aria-hidden="true" /></button>}
          </header>
          <RahcomActions canManage={canManageRahcom} canRecord={canRecordActivities} selectedProvince={province} workflowOpen={actionsWorkflowOpen} />
        </>
      ) : section === 'systems' ? (
          <RahcomSystemsList canManage={canManageRahcom} selectedProvince={province} axisSource={axisSource} renderAxisSource={renderedAxisSource} onAxisSourceChange={setAxisSource} />
      ) : section === 'solar-daily' ? (
        <RahcomSolarDaily formOpen={solarFormOpen} onFormOpenChange={setSolarFormOpen} selectedProvince={province} canManage={canManageRahcom} showIncidents={renderedShowMapIncidents} axisSource={renderedAxisSource} selectedSnapshotId={renderedSolarSnapshotId} onSnapshotSelect={setSelectedSolarSnapshotId} onSolarSnapshotsChange={handleSolarSnapshots} onSystemCountChange={handleSectionSystemsCount} />
      ) : section === 'aggregate' ? (
        <RahcomAggregateList onSystemCountChange={handleSectionSystemsCount} selectedProvince={province} axisSource={axisSource} showIncidents={showMapIncidents} setOperation={aggregateSetOperation} sources={aggregateSources} />
      ) : section === 'tickets' ? (
        <RahcomTickets onSystemCountChange={handleSectionSystemsCount} />
      ) : (
        <RahcomDailyTraffic provinceFilter={province} showIncidents={renderedShowMapIncidents} solarSnapshotPicker={solarSnapshotPicker} onShowIncidentsChange={(enabled) => { setShowMapIncidents(enabled); window.localStorage.setItem('rahcom-show-incidents', String(enabled)); }} />
      )}
    </main>
  );
}
