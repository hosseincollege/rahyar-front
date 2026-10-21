'use client';

import { ClipboardList, LocateFixed, Minus, Plus, Waypoints } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { OpenStreetMap, type RahcomMapControls } from '@/components/rahcom/open-street-map';
import { RahcomActions } from '@/components/rahcom/rahcom-actions';
import { RahcomSystemsList } from '@/components/rahcom/rahcom-systems-list';
import { getCurrentUser } from '@/lib/api/shared/auth-api';
import { uiMessage } from '@/lib/ui-messages';

export type RahcomSection = 'map' | 'actions' | 'systems' | 'daily-traffic';

export function RahcomSectionPage({ section }: { section: RahcomSection }) {
  const { locale } = usePreferences();
  const [focusProvince, setFocusProvince] = useState(true);
  const [province, setProvince] = useState('isfahan');
  const [mapSystemsCount, setMapSystemsCount] = useState(0);
  const [mapSystemsError, setMapSystemsError] = useState('');
  const [mapControls, setMapControls] = useState<RahcomMapControls | null>(null);
  const [mapLocating, setMapLocating] = useState(false);
  const [mapLocationError, setMapLocationError] = useState(false);
  const handleMapCount = useCallback((count: number) => setMapSystemsCount(count), []);
  const handleMapError = useCallback((error: string) => setMapSystemsError(error), []);
  const handleMapControls = useCallback((controls: RahcomMapControls | null) => setMapControls(controls), []);
  const handleLocationStatus = useCallback((status: { locating: boolean; error: boolean }) => {
    setMapLocating(status.locating);
    setMapLocationError(status.error);
  }, []);
  const titleKey = section === 'map' ? 'rahcomMap' : section === 'actions' ? 'rahcomActions' : section === 'systems' ? 'rahcomSystemsList' : 'rahcomDailyTraffic';

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
      <header className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Waypoints size={21} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-foreground">{uiMessage(locale, 'sidebarRahkam')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{uiMessage(locale, titleKey)}</p>
        </div>
        {section === 'map' && <div className="ms-auto flex flex-wrap items-center gap-2">
          <span role="status" className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">{mapSystemsCount} {uiMessage(locale, 'rahcomSystemsOnMap')}</span>
          <button type="button" onClick={() => mapControls?.zoomIn()} disabled={!mapControls} aria-label={uiMessage(locale, 'rahcomZoomIn')} title={uiMessage(locale, 'rahcomZoomIn')} className="flex size-9 items-center justify-center rounded-lg border border-border bg-background text-foreground disabled:opacity-50"><Plus size={17} /></button>
          <button type="button" onClick={() => mapControls?.zoomOut()} disabled={!mapControls} aria-label={uiMessage(locale, 'rahcomZoomOut')} title={uiMessage(locale, 'rahcomZoomOut')} className="flex size-9 items-center justify-center rounded-lg border border-border bg-background text-foreground disabled:opacity-50"><Minus size={17} /></button>
          <button type="button" onClick={() => mapControls?.locateMe()} disabled={!mapControls || mapLocating} aria-label={uiMessage(locale, 'rahcomLocateMe')} title={uiMessage(locale, 'rahcomLocateMe')} className="flex size-9 items-center justify-center rounded-lg border border-border bg-background text-foreground disabled:opacity-50">{mapLocating ? <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <LocateFixed size={17} />}</button>
          {mapLocationError && <span role="alert" className="text-xs text-destructive">{uiMessage(locale, 'rahcomLocationUnavailable')}</span>}
          {mapSystemsError && <span role="alert" className="text-xs text-destructive">{mapSystemsError}</span>}
        </div>}
        {section === 'map' && province === 'isfahan' && <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm">
          <input type="checkbox" checked={focusProvince} onChange={(event) => {
            const enabled = event.target.checked;
            setFocusProvince(enabled);
            window.localStorage.setItem('rahyar-rahcom-focus-province', String(enabled));
          }} />
          تمرکز روی محدودهٔ استان
        </label>}
      </header>

      {section === 'map' ? (
        <section aria-label={uiMessage(locale, 'rahcomMap')} className="h-[70vh] min-h-[460px] max-h-[820px] overflow-hidden rounded-2xl border border-border bg-card">
          <OpenStreetMap focusProvince={focusProvince} onSystemsCountChange={handleMapCount} onSystemsErrorChange={handleMapError} onControlsReady={handleMapControls} onLocationStatusChange={handleLocationStatus} />
        </section>
      ) : section === 'actions' ? (
        <RahcomActions />
      ) : section === 'systems' ? (
        <RahcomSystemsList />
      ) : (
        <section aria-label={uiMessage(locale, 'rahcomDailyTraffic')} className="rounded-2xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 font-semibold text-foreground"><ClipboardList size={18} />{uiMessage(locale, 'rahcomDailyTraffic')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{uiMessage(locale, 'rahcomComingSoon')}</p>
        </section>
      )}
    </main>
  );
}
