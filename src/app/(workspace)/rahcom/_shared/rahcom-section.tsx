'use client';

import { CircleHelp, ClipboardList, LocateFixed, MapPin, MapPinned, PanelsTopLeft, Plus, Scan, Sun, TriangleAlert, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { OpenStreetMap } from '@/app/(workspace)/rahcom/map/open-street-map';
import { RahcomActions } from '@/app/(workspace)/rahcom/actions/rahcom-actions';
import { RahcomSystemsList } from '@/app/(workspace)/rahcom/systems/rahcom-systems-list';
import { RahcomDailyTraffic } from '@/app/(workspace)/rahcom/daily-traffic/rahcom-daily-traffic';
import { RahcomSolarDaily } from '@/app/(workspace)/rahcom/solar-daily/rahcom-solar-daily';
import { RahcomHeaderDate } from '@/app/(workspace)/rahcom/_shared/rahcom-header-date';
import { getCurrentOrganizationId, getCurrentUser } from '@/lib/api/shared/auth-api';
import { settingsApi } from '@/app/(workspace)/settings/settings-api';
import { uiMessage } from '@/lib/ui-messages';
import { rahcomAxisColor } from '@/lib/api/rahcom/rahcom-axes';
import { RahcomTickets } from '@/app/(workspace)/rahcom/tickets/rahcom-tickets';
import { RahcomAggregateList } from '@/app/(workspace)/rahcom/aggregate/rahcom-aggregate-list';
import { rahcomApi } from '@/lib/api/rahcom/rahcom-api';
import { isRahcomIncidentValue } from '@/lib/api/rahcom/solar-status';
import type { RahcomSolarSnapshot } from '@/lib/api/rahcom/rahcom-api';

export type RahcomSection = 'map' | 'actions' | 'systems' | 'daily-traffic' | 'solar-daily' | 'aggregate' | 'tickets';

export function RahcomSectionPage({ section }: { section: RahcomSection }) {
  const { locale } = usePreferences();
  const [focusProvince, setFocusProvince] = useState(true);
  const [province, setProvince] = useState('isfahan');
  const [mapSystemsCount, setMapSystemsCount] = useState(0);
  const [mapSystemsError, setMapSystemsError] = useState('');
  const [mapLocating, setMapLocating] = useState(false);
  const [locateMeAction, setLocateMeAction] = useState<(() => void) | null>(null);
  const [mapAxisOptions, setMapAxisOptions] = useState<string[]>([]);
  const [axisSource, setAxisSource] = useState<'traffic' | 'rahyar'>('traffic');
  const [solarDownFilter, setSolarDownFilter] = useState(false);
  const [incidentSource, setIncidentSource] = useState<'traffic' | 'systems'>('traffic');
  const [showMapIncidents, setShowMapIncidents] = useState(false);
  const [mapIncidentCount, setMapIncidentCount] = useState(0);
  const [showTrafficIncidents, setShowTrafficIncidents] = useState(true);
  const [showSystemIncidents, setShowSystemIncidents] = useState(true);
  const [incidentCounts, setIncidentCounts] = useState({ traffic: 0, systems: 0 });
  const [incidentFiltersLoaded, setIncidentFiltersLoaded] = useState(false);
  const [showAxisLegend, setShowAxisLegend] = useState(false);
  const [solarSnapshotAvailable, setSolarSnapshotAvailable] = useState<boolean | null>(null);
  const [solarSnapshots, setSolarSnapshots] = useState<RahcomSolarSnapshot[]>([]);
  const [selectedSolarSnapshotId, setSelectedSolarSnapshotId] = useState('');
  const [mapLocationError, setMapLocationError] = useState(false);
  const [accessState, setAccessState] = useState<'loading' | 'allowed' | 'denied' | 'error'>('loading');
  const [canManageRahcom, setCanManageRahcom] = useState(false);
  const [canRecordActivities, setCanRecordActivities] = useState(false);
  const [solarFormOpen, setSolarFormOpen] = useState(false);
  const handleMapCount = useCallback((count: number) => setMapSystemsCount(count), []);
  const handleMapIncidentCount = useCallback((count: number) => setMapIncidentCount(count), []);
  const handleMapError = useCallback((error: string) => setMapSystemsError(error), []);
  const handleAxisOptions = useCallback((axes: string[]) => setMapAxisOptions(axes), []);
  const handleLocationStatus = useCallback((status: { locating: boolean; error: boolean }) => { setMapLocationError(status.error); setMapLocating(status.locating); }, []);
  const handleLocateMeReady = useCallback((action: (() => void) | null) => setLocateMeAction(() => action), []);
  const handleSolarSnapshots = useCallback((snapshots: RahcomSolarSnapshot[] | null) => {
    if (snapshots === null) {
      setSolarSnapshotAvailable(null);
      return;
    }
    const ordered = [...snapshots].sort((left, right) => new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime() || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    setSolarSnapshots(ordered);
    setSolarSnapshotAvailable(ordered.length > 0);
    setSelectedSolarSnapshotId((current) => ordered.some((snapshot) => snapshot.id === current) ? current : ordered[0]?.id ?? '');
  }, []);
  const selectedSolarSnapshot = solarSnapshots.find((snapshot) => snapshot.id === selectedSolarSnapshotId) ?? solarSnapshots[0] ?? null;
  const solarSnapshotCapturedAt = selectedSolarSnapshot?.capturedAt ?? null;
  const solarSnapshotTime = solarSnapshotCapturedAt
    ? new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(solarSnapshotCapturedAt))
    : '';
  useEffect(() => {
    setShowMapIncidents(window.localStorage.getItem('rahcom-show-incidents') === 'true');
    const saved = window.localStorage.getItem('rahcom-incident-display');
    if (saved) {
      try {
        const values = JSON.parse(saved) as { traffic?: boolean; systems?: boolean };
        if (typeof values.traffic === 'boolean') setShowTrafficIncidents(values.traffic);
        if (typeof values.systems === 'boolean') setShowSystemIncidents(values.systems);
      } catch { /* Ignore invalid local display preferences. */ }
    }
    setIncidentFiltersLoaded(true);
  }, []);
  useEffect(() => {
    if (incidentFiltersLoaded) window.localStorage.setItem('rahcom-incident-display', JSON.stringify({ traffic: showTrafficIncidents, systems: showSystemIncidents }));
  }, [incidentFiltersLoaded, showTrafficIncidents, showSystemIncidents]);

  useEffect(() => {
    let active = true;
    void Promise.all([rahcomApi.systems(province), rahcomApi.trafficSnapshot(province)]).then(([systems, traffic]) => {
      if (!active) return;
      const normalizeHeader = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\u200c_./-]/g, '');
      const incidentTerms = ['سرقت', 'تخریب', 'تعریض', 'جابجایی', 'theft', 'damage', 'widening', 'relocation'].map(normalizeHeader);
      const headers = traffic?.headers ?? [];
      const codeIndex = headers.findIndex((header) => {
        const normalized = normalizeHeader(header);
        return normalized.includes(normalizeHeader('کد سامانه')) || normalized.includes('systemcode');
      });
      const incidentIndexes = headers.flatMap((header, index) => incidentTerms.some((term) => normalizeHeader(header).includes(term)) ? [index] : []);
      const allowedCodes = new Set(systems.map((system) => system.systemCode.trim().toUpperCase()));
      const trafficIncidentRows = (traffic?.rows ?? []).filter((row) => codeIndex >= 0
        && allowedCodes.has((row[codeIndex] ?? '').normalize('NFKC').trim().toUpperCase())
        && incidentIndexes.some((index) => isRahcomIncidentValue(row[index])));
      const systemCodes = new Set(systems.filter((system) => system.incidentType || isRahcomIncidentValue(system.incidentDetails))
        .map((system) => system.systemCode.trim().toUpperCase()));
      setIncidentCounts({ traffic: trafficIncidentRows.length, systems: systemCodes.size });
    }).catch(() => {
      if (active) setIncidentCounts({ traffic: 0, systems: 0 });
    });
    return () => { active = false; };
  }, [province]);

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
    <main dir={getLocaleDirection(locale)} className="mx-auto max-w-5xl space-y-5">
      {section !== 'systems' && section !== 'daily-traffic' && <header className={`${section === 'map' ? 'flex flex-nowrap items-center gap-2 overflow-x-auto' : 'space-y-2'} rounded-2xl border border-border bg-card p-3 sm:p-4`}>
        <div className={section === 'map' ? 'contents' : 'flex flex-wrap items-center gap-2'}>
          {section === 'map' && <RahcomHeaderDate />}
          {section === 'map' && <span role="status" aria-label={`${new Intl.NumberFormat(locale).format(mapSystemsCount)} ${uiMessage(locale, 'rahcomSystemsOnMap')}`} title={uiMessage(locale, 'rahcomSystemsOnMap')} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm text-foreground"><MapPin size={16} style={{ color: 'var(--primary)' }} /><strong className="font-bold tabular-nums">{new Intl.NumberFormat(locale).format(mapSystemsCount)}</strong></span>}
          {section !== 'map' && <RahcomHeaderDate />}
          {section === 'tickets' && canManageRahcom && <button type="button" onClick={() => window.dispatchEvent(new Event('rahyar:tickets-upload-click'))} aria-label={uiMessage(locale, 'rahcomUploadExcel')} title={uiMessage(locale, 'rahcomUploadExcel')} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary"><Upload size={17} /></button>}
          {section === 'solar-daily' && <div className="ms-auto flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto">
            <label className="flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground"><input type="checkbox" checked={showTrafficIncidents} onChange={(event) => setShowTrafficIncidents(event.target.checked)} /><i aria-hidden="true" className="size-3 rounded-full border-[3px] border-orange-500" />{uiMessage(locale, 'rahcomTrafficIncidentColumn')} ({new Intl.NumberFormat(locale).format(incidentCounts.traffic)})</label>
            <label className="flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground"><input type="checkbox" checked={showSystemIncidents} onChange={(event) => setShowSystemIncidents(event.target.checked)} /><i aria-hidden="true" className="size-3 rounded-full border-[3px] border-violet-600" />{uiMessage(locale, 'rahcomSystemIncidentColumn')} ({new Intl.NumberFormat(locale).format(incidentCounts.systems)})</label>
          </div>}
          {section === 'map' && <div className="inline-flex overflow-hidden rounded-full border border-border bg-background" role="group" aria-label={uiMessage(locale, 'rahcomIncidentFilter')}>
            <button type="button" aria-pressed={incidentSource === 'traffic'} aria-label={uiMessage(locale, 'rahcomTrafficIncidentColumn')} title={uiMessage(locale, 'rahcomTrafficIncidentColumn')} onClick={() => setIncidentSource('traffic')} style={incidentSource === 'traffic' ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' } : undefined} className={`grid size-9 place-items-center transition-colors ${incidentSource === 'traffic' ? '' : 'text-muted-foreground hover:bg-muted'}`}><ClipboardList size={17} /></button>
            <button type="button" aria-pressed={incidentSource === 'systems'} aria-label={uiMessage(locale, 'rahcomSystemIncidentColumn')} title={uiMessage(locale, 'rahcomSystemIncidentColumn')} onClick={() => setIncidentSource('systems')} style={incidentSource === 'systems' ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' } : undefined} className={`grid size-9 place-items-center border-s border-border transition-colors ${incidentSource === 'systems' ? '' : 'text-muted-foreground hover:bg-muted'}`}><PanelsTopLeft size={17} /></button>
          </div>}
          {(section === 'map' || section === 'solar-daily') && <button type="button" aria-pressed={showMapIncidents} aria-label={uiMessage(locale, 'rahcomIncidentFilter')} title={uiMessage(locale, 'rahcomIncidentFilter')} onClick={() => { const enabled = !showMapIncidents; setShowMapIncidents(enabled); window.localStorage.setItem('rahcom-show-incidents', String(enabled)); }} style={showMapIncidents ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-sm transition-colors ${showMapIncidents ? 'shadow-sm' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}><TriangleAlert size={16} /></button>}
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
            }} style={focusProvince ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`grid size-9 shrink-0 place-items-center rounded-full border transition-colors ${focusProvince ? 'shadow-sm' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}><Scan size={17} /></button>}
          <div className="inline-flex overflow-hidden rounded-full border border-border bg-background" role="group" aria-label={uiMessage(locale, 'rahcomAxis')}>
            <button type="button" aria-pressed={axisSource === 'traffic'} aria-label={uiMessage(locale, 'rahcomTrafficList')} title={uiMessage(locale, 'rahcomTrafficList')} onClick={() => setAxisSource('traffic')} style={axisSource === 'traffic' ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' } : undefined} className={`grid size-9 place-items-center transition-colors ${axisSource === 'traffic' ? '' : 'text-muted-foreground hover:bg-muted'}`}><ClipboardList size={17} /></button>
            <button type="button" aria-pressed={axisSource === 'rahyar'} aria-label={uiMessage(locale, 'rahcomAxesTitle')} title={uiMessage(locale, 'rahcomAxesTitle')} onClick={() => setAxisSource('rahyar')} style={axisSource === 'rahyar' ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' } : undefined} className={`grid size-9 place-items-center border-s border-border transition-colors ${axisSource === 'rahyar' ? '' : 'text-muted-foreground hover:bg-muted'}`}><MapPinned size={17} /></button>
          </div>
          <button type="button" aria-pressed={showAxisLegend} aria-label={uiMessage(locale, 'rahcomShowAxisLegend')} title={uiMessage(locale, 'rahcomShowAxisLegend')} onClick={() => setShowAxisLegend((show) => !show)} style={showAxisLegend ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`grid size-9 place-items-center rounded-full border transition-colors ${showAxisLegend ? 'shadow-sm' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}><CircleHelp size={18} /></button>
          <button type="button" onClick={() => locateMeAction?.()} disabled={!locateMeAction || mapLocating} aria-label={uiMessage(locale, 'rahcomLocateMe')} title={uiMessage(locale, 'rahcomLocateMe')} className="inline-grid size-9 place-items-center rounded-full border border-border bg-background text-foreground hover:bg-muted disabled:opacity-50">{mapLocating ? <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <LocateFixed size={16} />}</button>
          <button type="button" aria-pressed={solarDownFilter} aria-label={`${uiMessage(locale, 'rahcomSolarDownFilter')}${solarSnapshotTime ? ` ${solarSnapshotTime}` : ''}`} title={`${uiMessage(locale, 'rahcomSolarDownFilter')}${solarSnapshotTime ? ` ${solarSnapshotTime}` : solarSnapshotAvailable === false ? ` · ${uiMessage(locale, 'rahcomSolarTodaySnapshotMissing')}` : ''}`} disabled={solarSnapshotAvailable !== true} onClick={() => setSolarDownFilter((enabled) => !enabled)} style={solarDownFilter ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`grid size-9 place-items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${solarDownFilter ? 'shadow-sm' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}><Sun size={18} /></button>
          {solarDownFilter && selectedSolarSnapshot && <select aria-label={uiMessage(locale, 'rahcomSolarDownFilter')} value={selectedSolarSnapshot.id} onChange={(event) => setSelectedSolarSnapshotId(event.target.value)} className="h-9 max-w-28 rounded-full border border-border bg-background px-2 text-xs tabular-nums text-foreground">
            {solarSnapshots.map((snapshot) => <option key={snapshot.id} value={snapshot.id}>{new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Tehran', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(snapshot.capturedAt))}</option>)}
          </select>}
          {solarSnapshotAvailable === false && <span role="status" className="text-xs text-muted-foreground">{uiMessage(locale, 'rahcomSolarTodaySnapshotMissing')}</span>}
        </div>}
      </header>}

      {section === 'map' && showAxisLegend && <section aria-label={uiMessage(locale, 'rahcomShowAxisLegend')} className="rounded-2xl border border-border bg-card p-3 sm:p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">{uiMessage(locale, axisSource === 'traffic' ? 'rahcomTrafficList' : 'rahcomAxesTitle')}</h2>
        {mapAxisOptions.length > 0 ? <div className="flex flex-wrap gap-x-4 gap-y-2">{mapAxisOptions.map((axis) => <span key={axis} className="inline-flex items-center gap-2 text-xs text-muted-foreground"><i className="size-3 rounded-full" style={{ backgroundColor: rahcomAxisColor(axis, mapAxisOptions) }} />{axis}</span>)}</div> : <p className="text-xs text-muted-foreground">{uiMessage(locale, 'rahcomNoAxes')}</p>}
      </section>}

      {section === 'solar-daily' && <div className="flex justify-end"><button type="button" onClick={() => setSolarFormOpen((open) => !open)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"><span className="flex size-5 items-center justify-center">{solarFormOpen ? <X size={17} /> : <Plus size={17} />}</span>{uiMessage(locale, solarFormOpen ? 'solarCloseForm' : 'solarAddSnapshot')}</button></div>}

      {accessState === 'loading' ? (
        <p role="status" className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">{uiMessage(locale, 'rahcomSystemsLoading')}</p>
      ) : accessState === 'denied' ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">{uiMessage(locale, 'rahcomAccessDenied')}</p>
      ) : accessState === 'error' ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">{uiMessage(locale, 'rahcomAccessCheckFailed')}</p>
      ) : section === 'map' ? (
        <section aria-label={uiMessage(locale, 'rahcomMap')} className="h-[70vh] min-h-[460px] max-h-[820px] overflow-hidden rounded-2xl border border-border bg-card">
          <OpenStreetMap focusProvince={focusProvince} canManage={canManageRahcom} solarDownFilter={solarDownFilter} selectedSolarSnapshotId={selectedSolarSnapshotId} showMapIncidents={showMapIncidents} incidentSource={incidentSource} axisSource={axisSource} onAxisOptionsChange={handleAxisOptions} onSystemsCountChange={handleMapCount} onIncidentCountChange={handleMapIncidentCount} onSystemsErrorChange={handleMapError} onLocationStatusChange={handleLocationStatus} onLocateMeReady={handleLocateMeReady} onSolarSnapshotsChange={handleSolarSnapshots} />
        </section>
      ) : section === 'actions' ? (
        <RahcomActions canManage={canManageRahcom} canRecord={canRecordActivities} selectedProvince={province} />
      ) : section === 'systems' ? (
          <RahcomSystemsList canManage={canManageRahcom} selectedProvince={province} axisSource={axisSource} onAxisSourceChange={setAxisSource} />
      ) : section === 'solar-daily' ? (
        <RahcomSolarDaily formOpen={solarFormOpen} onFormOpenChange={setSolarFormOpen} selectedProvince={province} canManage={canManageRahcom} showIncidents={showMapIncidents} showTrafficIncidents={showTrafficIncidents} showSystemIncidents={showSystemIncidents} />
      ) : section === 'aggregate' ? (
        <RahcomAggregateList />
      ) : section === 'tickets' ? (
        <RahcomTickets />
      ) : (
        <RahcomDailyTraffic provinceFilter={province} showIncidents={showMapIncidents} onShowIncidentsChange={(enabled) => { setShowMapIncidents(enabled); window.localStorage.setItem('rahcom-show-incidents', String(enabled)); }} />
      )}
    </main>
  );
}
