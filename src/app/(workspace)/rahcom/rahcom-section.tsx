'use client';

import { Plus, Waypoints, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { OpenStreetMap } from '@/components/rahcom/open-street-map';
import { RahcomActions } from '@/components/rahcom/rahcom-actions';
import { RahcomSystemsList } from '@/components/rahcom/rahcom-systems-list';
import { RahcomDailyTraffic } from '@/components/rahcom/rahcom-daily-traffic';
import { RahcomSolarDaily } from '@/components/rahcom/rahcom-solar-daily';
import { getCurrentOrganizationId, getCurrentUser } from '@/lib/api/shared/auth-api';
import { settingsApi } from '@/lib/api/settings/settings-api';
import { uiMessage } from '@/lib/ui-messages';
import { rahcomAxisColor } from '@/lib/rahcom-axes';

export type RahcomSection = 'map' | 'actions' | 'systems' | 'daily-traffic' | 'solar-daily';

export function RahcomSectionPage({ section }: { section: RahcomSection }) {
  const { locale } = usePreferences();
  const [focusProvince, setFocusProvince] = useState(true);
  const [showAxisZones, setShowAxisZones] = useState(true);
  const [province, setProvince] = useState('isfahan');
  const [mapSystemsCount, setMapSystemsCount] = useState(0);
  const [mapSystemsError, setMapSystemsError] = useState('');
  const [mapAxisFilter, setMapAxisFilter] = useState('');
  const [mapAxisOptions, setMapAxisOptions] = useState<string[]>([]);
  const [mapLocationError, setMapLocationError] = useState(false);
  const [accessState, setAccessState] = useState<'loading' | 'allowed' | 'denied' | 'error'>('loading');
  const [canManageRahcom, setCanManageRahcom] = useState(false);
  const [solarFormOpen, setSolarFormOpen] = useState(false);
  const handleMapCount = useCallback((count: number) => setMapSystemsCount(count), []);
  const handleMapError = useCallback((error: string) => setMapSystemsError(error), []);
  const handleAxisOptions = useCallback((axes: string[]) => setMapAxisOptions(axes), []);
  const handleLocationStatus = useCallback((status: { locating: boolean; error: boolean }) => setMapLocationError(status.error), []);
  const titleKey = section === 'map' ? 'rahcomMap' : section === 'actions' ? 'rahcomActions' : section === 'systems' ? 'rahcomSystemsList' : section === 'solar-daily' ? 'rahcomSolarDaily' : 'rahcomDailyTraffic';

  useEffect(() => {
    let active = true;
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      setAccessState('denied');
      return;
    }
    void settingsApi.getOrganizationAccess(organizationId).then((access) => {
      if (!active) return;
      setCanManageRahcom(Boolean(access.canManageRahcom));
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
      if (selected) { setProvince(selected); setMapAxisFilter(''); }
    };
    const onStorageChange = (event: StorageEvent) => {
      if (event.key === key) { setProvince(event.newValue || 'isfahan'); setMapAxisFilter(''); }
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
      <header className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Waypoints size={21} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-foreground">{uiMessage(locale, 'sidebarRahkam')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{uiMessage(locale, titleKey)}</p>
        </div>
        {section === 'solar-daily' && <button type="button" onClick={() => setSolarFormOpen((open) => !open)} className="ms-auto inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"><span className="flex size-5 items-center justify-center">{solarFormOpen ? <X size={17} /> : <Plus size={17} />}</span>{uiMessage(locale, solarFormOpen ? 'solarCloseForm' : 'solarAddSnapshot')}</button>}
        {section === 'map' && <div className="ms-auto flex flex-wrap items-center gap-2">
          <span role="status" className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">{mapSystemsCount} {uiMessage(locale, 'rahcomSystemsOnMap')}</span>
          {mapLocationError && <span role="alert" className="text-xs text-destructive">{uiMessage(locale, 'rahcomLocationUnavailable')}</span>}
          {mapSystemsError && <span role="alert" className="text-xs text-destructive">{mapSystemsError}</span>}
        </div>}
        {section === 'map' && <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">{uiMessage(locale, 'rahcomAxisFilter')}<select value={mapAxisFilter} onChange={(event) => setMapAxisFilter(event.target.value)} className="h-10 max-w-56 rounded-lg border border-border bg-background px-3 text-sm"><option value="">{uiMessage(locale, 'rahcomAllAxes')}</option>{mapAxisOptions.map((axis) => <option key={axis} value={axis}>{axis}</option>)}</select></label>
          {province === 'isfahan' && <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground"><input type="checkbox" checked={showAxisZones} onChange={(event) => setShowAxisZones(event.target.checked)} />{uiMessage(locale, 'rahcomShowAxisZones')}</label>}
          {province === 'isfahan' && <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground">
            <input type="checkbox" checked={focusProvince} onChange={(event) => {
              const enabled = event.target.checked;
              setFocusProvince(enabled);
              window.localStorage.setItem('rahyar-rahcom-focus-province', String(enabled));
            }} />
            {uiMessage(locale, 'rahcomFocusProvince')}
          </label>}
        </div>}
        {section === 'map' && mapAxisOptions.length > 0 && <div className="flex w-full flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3">{mapAxisOptions.map((axis) => <span key={axis} className="inline-flex items-center gap-2 text-xs text-muted-foreground"><i className="size-3 rounded-full" style={{ backgroundColor: rahcomAxisColor(axis, mapAxisOptions) }} />{axis}</span>)}</div>}
      </header>

      {accessState === 'loading' ? (
        <p role="status" className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">{uiMessage(locale, 'rahcomSystemsLoading')}</p>
      ) : accessState === 'denied' ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">{uiMessage(locale, 'rahcomAccessDenied')}</p>
      ) : accessState === 'error' ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">{uiMessage(locale, 'rahcomAccessCheckFailed')}</p>
      ) : section === 'map' ? (
        <section aria-label={uiMessage(locale, 'rahcomMap')} className="h-[70vh] min-h-[460px] max-h-[820px] overflow-hidden rounded-2xl border border-border bg-card">
          <OpenStreetMap focusProvince={focusProvince} showAxisZones={showAxisZones} canManage={canManageRahcom} axisFilter={mapAxisFilter} onAxisFilterChange={setMapAxisFilter} onAxisOptionsChange={handleAxisOptions} onSystemsCountChange={handleMapCount} onSystemsErrorChange={handleMapError} onLocationStatusChange={handleLocationStatus} />
        </section>
      ) : section === 'actions' ? (
        <RahcomActions canManage={canManageRahcom} />
      ) : section === 'systems' ? (
        <RahcomSystemsList canManage={canManageRahcom} />
      ) : section === 'solar-daily' ? (
        <RahcomSolarDaily formOpen={solarFormOpen} onFormOpenChange={setSolarFormOpen} />
      ) : (
        <RahcomDailyTraffic />
      )}
    </main>
  );
}
