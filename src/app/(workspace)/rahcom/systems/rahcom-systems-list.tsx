'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, ExternalLink, MapPinned, Pencil, Save, Trash2, Upload, X } from 'lucide-react';
import { usePreferences } from '@/components/preferences-provider';
import { RahcomSystemHistory } from '@/app/(workspace)/rahcom/_shared/rahcom-system-history';
import { formatRahcomCoordinates, iranProvinces, rahcomApi, type RahcomSystem } from '@/lib/api/rahcom/rahcom-api';
import { canonicalRahcomAxis, rahcomAxisColor } from '@/lib/api/rahcom/rahcom-axes';
import { uiMessage } from '@/lib/ui-messages';
import { RahcomAxesManager } from '@/app/(workspace)/rahcom/_shared/rahcom-axes-manager';
import { useRouter } from 'next/navigation';

function provinceName(provinceId: string) {
  return iranProvinces.find(([id]) => id === provinceId)?.[1] ?? provinceId;
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
  const router = useRouter();
  const [systems, setSystems] = useState<RahcomSystem[]>([]);
  const [axisOptionsByProvince, setAxisOptionsByProvince] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<string[]>([]);
  const [routeSystem, setRouteSystem] = useState<RahcomSystem | null>(null);
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  const [editingSystemId, setEditingSystemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Pick<RahcomSystem, 'systemName' | 'systemCode' | 'axis' | 'latitude' | 'longitude' | 'details' | 'electricityBillId' | 'simIp' | 'radarIp' | 'cameraIp' | 'pcIp' | 'routerIp' | 'laptopIp' | 'incidentType' | 'incidentDetails'> | null>(null);
  const [savingSystem, setSavingSystem] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');
  const copyResetTimer = useRef<number | null>(null);
  const [systemsRevision, setSystemsRevision] = useState(0);
  const t = useCallback((key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key), [locale]);

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
    const provinces = [...new Set(systems.map((system) => system.province).filter(Boolean))];
    void Promise.all(provinces.map(async (province) => {
      try { return [province, (await rahcomApi.axes(province)).map(({ name }) => name)] as const; }
      catch { return [province, []] as const; }
    })).then((entries) => { if (active) setAxisOptionsByProvince(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [systems]);

  useEffect(() => {
    if (!routeSystem) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setRouteSystem(null); };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [routeSystem]);

  const groups = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    const grouped = new Map<string, RahcomSystem[]>();
    for (const system of systems) {
      const canonicalAxis = canonicalRahcomAxis(system.axis, system.latitude, system.longitude, system.province);
      if (filters.includes('incidents') && !system.incidentType) continue;
      const province = system.province || 'unknown';
      const provinceLabel = provinceName(province);
      const searchable = [provinceLabel, province, canonicalAxis, system.axis, system.axisCode, system.systemName, system.systemCode, system.details, system.incidentType, system.incidentDetails, system.electricityBillId, system.simIp, system.radarIp, system.cameraIp, system.pcIp, system.routerIp, system.laptopIp, system.latitude, system.longitude]
        .filter(Boolean).join(' ').toLocaleLowerCase(locale);
      if (normalizedQuery && !searchable.includes(normalizedQuery)) continue;
      const provinceSystems = grouped.get(province) ?? [];
      provinceSystems.push(system);
      grouped.set(province, provinceSystems);
    }
    return [...grouped.entries()].sort(([a], [b]) => {
      if (a === 'isfahan') return -1;
      if (b === 'isfahan') return 1;
      return provinceName(a).localeCompare(provinceName(b), locale);
    });
  }, [filters, locale, query, systems]);

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

  function startEdit(system: RahcomSystem) {
    setSelectedSystemId(system.id);
    setEditingSystemId(system.id);
    setEditForm({ systemName: system.systemName, systemCode: system.systemCode, axis: canonicalRahcomAxis(system.axis, system.latitude, system.longitude, system.province), latitude: system.latitude, longitude: system.longitude, details: system.details ?? '', electricityBillId: system.electricityBillId ?? '', simIp: system.simIp ?? '', radarIp: system.radarIp ?? '', cameraIp: system.cameraIp ?? '', pcIp: system.pcIp ?? '', routerIp: system.routerIp ?? '', laptopIp: system.laptopIp ?? '', incidentType: system.incidentType, incidentDetails: system.incidentDetails ?? '' });
  }

  async function saveEdit(systemId: string) {
    if (!editForm) return;
    setSavingSystem(true);
    try { await rahcomApi.updateSystem(systemId, editForm); setEditingSystemId(null); setEditForm(null); }
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

  const anyRows = groups.some(([, rows]) => rows.length > 0);

  return (
    <section aria-label={t('rahcomSystemsList')} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5">
        <div>
          <h2 className="font-semibold text-foreground">{t('rahcomSystemsList')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{systems.length} · {t('rahcomSystemName')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><span>{t('rahcomProvince')}: {groups.length}</span>{['incidents','outages','tickets'].map((filter) => <label key={filter} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2"><input type="checkbox" checked={filters.includes(filter)} onChange={() => setFilters((current) => current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter])}/>{t(filter === 'incidents' ? 'rahcomFilterIncidents' : filter === 'outages' ? 'rahcomFilterOutages' : 'rahcomFilterTickets')}</label>)}<button type="button" onClick={() => router.push('/rahcom/data')} aria-label={t('rahcomUploadData')} title={t('rahcomUploadData')} className="inline-flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Upload size={17} aria-hidden="true" /></button></div>
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{t('rahcomSystemsLoading')}</div> : null}
      {error ? <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-300">{error}</div> : null}
      {!loading && !error && !anyRows ? <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{t('rahcomSystemsEmpty')}</div> : null}

            {groups.map(([province, rows]) => {
              const byAxis = new Map<string, RahcomSystem[]>();
              rows.forEach((system) => { const axisKey = system.axisCode?.trim() ? `code:${system.axisCode.trim()}` : 'no-axis-code'; byAxis.set(axisKey, [...(byAxis.get(axisKey) ?? []), system]); });
              byAxis.forEach((axisRows) => axisRows.sort((a, b) => a.systemCode.localeCompare(b.systemCode, 'en', { numeric: true, sensitivity: 'base' }) || a.systemName.localeCompare(b.systemName, locale)));
              const sortedAxisGroups = [...byAxis.entries()].sort(([a],[b])=>a === 'no-axis-code' ? 1 : b === 'no-axis-code' ? -1 : a.slice(5).localeCompare(b.slice(5), 'en', { numeric: true, sensitivity: 'base' }));
              const axisLabel = (axisRows: RahcomSystem[]) => { const first = axisRows[0]; return first.axisCode?.trim() ? `${first.axisCode.trim()} · ${canonicalRahcomAxis(first.axis, first.latitude, first.longitude, first.province) || t('rahcomNoAxis')}` : t('rahcomNoAxis'); };
              const axisOptions = [...new Set(sortedAxisGroups.filter(([key]) => key !== 'no-axis-code').map(([, axisRows]) => axisLabel(axisRows)))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }));
              let systemRowNumber = 0;
              return (
        <details key={province} open={Boolean(query.trim())} className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold text-foreground marker:hidden">
            <span>{provinceName(province)}</span>
            <span className="flex items-center gap-3 text-sm font-normal text-muted-foreground">{canManage && <details onClick={(event) => event.stopPropagation()}><summary className="cursor-pointer rounded-lg border border-border px-3 py-2">{t('rahcomEdit')}</summary><div className="absolute z-20 mt-1 grid gap-2 rounded-xl border border-border bg-card p-3 shadow-xl"><RahcomAxesManager province={province} canManage={canManage} /><button type="button" onClick={async () => { if (window.confirm(t('rahcomDeleteProvinceConfirm'))) { await rahcomApi.deleteSystems({ province }); setSystemsRevision((value) => value + 1); } }} className="rounded-lg border border-destructive/30 px-3 py-2 text-destructive">{t('rahcomDeleteProvinceSystems')}</button></div></details>}<span className="flex items-center gap-2">{rows.length} | {t('rahcomSystemName')}<ChevronDown size={17} /></span></span>
          </summary>
          <div className="space-y-3 border-t border-border p-3 sm:p-4">
            {sortedAxisGroups.map(([axisKey, axisRows]) => { const label = axisLabel(axisRows); const color = axisKey === 'no-axis-code' ? '#64748b' : rahcomAxisColor(label, axisOptions); return <div key={axisKey} className="space-y-2"><h3 className="sticky top-0 flex items-center gap-2 rounded-lg bg-muted/80 px-3 py-2 text-sm font-semibold text-foreground"><i className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />{label} <span className="text-xs font-normal text-muted-foreground">({axisRows.length})</span></h3>{axisRows.map((system) => { const rowNumber = ++systemRowNumber;
              const hasCoordinates = Number.isFinite(Number(system.latitude)) && Number.isFinite(Number(system.longitude));
              const codeKey = `${system.id}:code`;
              const coordinatesKey = `${system.id}:coordinates`;
              return (
                <article key={system.id} className="rounded-xl border border-border bg-background p-3 shadow-sm transition-colors hover:border-primary/30 sm:p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" aria-expanded={selectedSystemId === system.id} onClick={() => setSelectedSystemId((current) => current === system.id ? null : system.id)} className="flex min-h-10 min-w-0 flex-1 items-center justify-between gap-3 rounded-lg px-1 text-start hover:bg-accent/50">
                      <span className="min-w-0"><span className="flex items-center gap-2"><span aria-label={`${t('rahcomRowNumber')} ${rowNumber}`} className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white" style={{ backgroundColor: color }}>{rowNumber.toLocaleString(locale)}</span><span className="block truncate font-semibold text-foreground">{system.systemName}{system.incidentType && <span className="ms-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">{t(system.incidentType === 'THEFT' ? 'rahcomIncidentTheft' : system.incidentType === 'DAMAGE' ? 'rahcomIncidentDamage' : 'rahcomIncidentBoth')}</span>}</span></span><span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs"><span className="shrink-0 text-muted-foreground">{t('rahcomSystemCode')}:</span><bdi dir="ltr" className="truncate rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono font-semibold tracking-wide text-foreground">{system.systemCode}</bdi></span></span>
                      <ChevronDown size={17} className={`shrink-0 transition-transform ${selectedSystemId === system.id ? 'rotate-180' : ''}`} />
                    </button>
                    <button type="button" onClick={() => void copyValue(codeKey, system.systemCode)} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-accent" title={t('rahcomCopyCode')}>
                      {copiedKey === codeKey ? <Check size={15} /> : <Copy size={15} />}{copiedKey === codeKey ? t('rahcomCopied') : t('rahcomCopyCode')}
                    </button>
                  </div>
                  {selectedSystemId === system.id ? <div className="mt-4 border-t border-border pt-4">
                    {canManage && editingSystemId === system.id && editForm ? <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {([
                          ['systemName', 'rahcomSystemName', 'text'], ['systemCode', 'rahcomSystemCode', 'text'],
                          ['latitude', 'rahcomLatitude', 'number'], ['longitude', 'rahcomLongitude', 'number'],
                          ['electricityBillId', 'rahcomElectricityBillId', 'text'], ['simIp', 'rahcomSimIp', 'text'],
                          ['radarIp', 'rahcomRadarIp', 'text'], ['cameraIp', 'rahcomCameraIp', 'text'],
                          ['pcIp', 'rahcomPcIp', 'text'], ['routerIp', 'rahcomRouterIp', 'text'], ['laptopIp', 'rahcomLaptopIp', 'text'],
                        ] as const).map(([field, label, type]) => <label key={field} className="grid gap-1 text-xs text-muted-foreground">{t(label)}<input type={type} dir={type === 'number' || field === 'systemCode' ? 'ltr' : undefined} value={String(editForm[field] ?? '')} onChange={event => setEditForm(current => current ? { ...current, [field]: type === 'number' ? Number(event.target.value) : event.target.value } : current)} className="h-10 min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary" /></label>)}
                      </div>
                      <label className="grid gap-1 text-xs text-muted-foreground">{t('rahcomAxis')}<select value={editForm.axis ?? ''} onChange={(event) => setEditForm(current => current ? { ...current, axis: event.target.value || null } : current)} className="h-10 min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"><option value="">{t('rahcomNoAxis')}</option>{[...new Set([...(axisOptionsByProvince[system.province] ?? []), ...(editForm.axis ? [editForm.axis] : [])])].sort((a, b) => a.localeCompare(b, locale)).map((axis) => <option key={axis} value={axis}>{axis}</option>)}</select></label>
                      <label className="grid gap-1 text-xs text-muted-foreground">{t('rahcomDescription')}<textarea rows={2} value={editForm.details ?? ''} onChange={event => setEditForm(current => current ? { ...current, details: event.target.value } : current)} className="min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" /></label>
                      <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs text-muted-foreground">{t('rahcomIncidentType')}<select value={editForm.incidentType ?? ''} onChange={event => setEditForm(current => current ? { ...current, incidentType: (event.target.value || null) as typeof current.incidentType } : current)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="">{t('rahcomIncidentNone')}</option><option value="THEFT">{t('rahcomIncidentTheft')}</option><option value="DAMAGE">{t('rahcomIncidentDamage')}</option><option value="THEFT_AND_DAMAGE">{t('rahcomIncidentBoth')}</option></select></label><label className="grid gap-1 text-xs text-muted-foreground">{t('rahcomIncidentDetails')}<textarea rows={2} value={editForm.incidentDetails ?? ''} onChange={event => setEditForm(current => current ? { ...current, incidentDetails: event.target.value } : current)} className="min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground" /></label></div>
                      <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => { setEditingSystemId(null); setEditForm(null); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm text-foreground"><X size={16}/>{t('rahcomCancel')}</button><button type="button" disabled={savingSystem} onClick={() => void saveEdit(system.id)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save size={16}/>{t('rahcomSave')}</button></div>
                    </div> : <>
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void copyValue(`${system.id}:all`, [system.systemName, system.systemCode, canonicalRahcomAxis(system.axis, system.latitude, system.longitude, system.province), provinceName(system.province), formatRahcomCoordinates(system.latitude, system.longitude)].filter(Boolean).join('\n'))} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-foreground"><Copy size={15}/>{copiedKey === `${system.id}:all` ? t('rahcomCopied') : t('rahcomCopy')}</button><button type="button" disabled={!hasCoordinates} onClick={() => setRouteSystem(system)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"><MapPinned size={16} />{t('rahcomRoute')}</button>{canManage && <button type="button" onClick={() => void removeSystem(system)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-destructive/30 px-4 text-sm font-medium text-destructive hover:bg-destructive/5"><Trash2 size={15}/>{t('rahcomDelete')}</button>}</div>
                        {canManage && <button type="button" onClick={() => startEdit(system)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-foreground hover:border-primary/40 hover:bg-accent"><Pencil size={15}/>{t('rahcomEditSystem')}</button>}
                      </div>
                      {system.axis && <p className="mb-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{t('rahcomAxis')}: {canonicalRahcomAxis(system.axis, system.latitude, system.longitude, system.province)}</p>}
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-3 text-sm"><span className="shrink-0 text-muted-foreground">{t('rahcomSystemCode')}</span><span dir="ltr" className="truncate font-mono text-xs text-foreground">{system.systemCode}</span><button type="button" onClick={() => void copyValue(codeKey, system.systemCode)} aria-label={t('rahcomCopyCode')} title={t('rahcomCopyCode')} className="inline-flex shrink-0 items-center gap-1 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">{copiedKey === codeKey ? <Check size={15}/> : <Copy size={15}/>}<span className="text-xs">{copiedKey === codeKey ? t('rahcomCopied') : t('rahcomCopyCode')}</span></button></div>
                        <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-3 text-sm sm:col-span-2"><span className="shrink-0 text-muted-foreground">{t('rahcomLatitude')} / {t('rahcomLongitude')}</span><span dir="ltr" className="truncate font-mono text-xs text-foreground">{formatRahcomCoordinates(system.latitude, system.longitude)}</span><button type="button" onClick={() => void copyValue(coordinatesKey, formatRahcomCoordinates(system.latitude, system.longitude))} aria-label={t('rahcomCopyCoordinates')} title={t('rahcomCopyCoordinates')} className="inline-flex shrink-0 items-center gap-1 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">{copiedKey === coordinatesKey ? <Check size={15}/> : <Copy size={15}/>}<span className="text-xs">{copiedKey === coordinatesKey ? t('rahcomCopied') : t('rahcomCopyCoordinates')}</span></button></div>
                        {([
                          ['electricityBillId', 'rahcomElectricityBillId'], ['simIp', 'rahcomSimIp'], ['radarIp', 'rahcomRadarIp'], ['cameraIp', 'rahcomCameraIp'], ['pcIp', 'rahcomPcIp'], ['routerIp', 'rahcomRouterIp'], ['laptopIp', 'rahcomLaptopIp'],
                        ] as const).map(([field, label]) => system[field] ? <div key={field} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-border/70 px-3 py-2.5 text-sm"><span className="shrink-0 text-muted-foreground">{t(label)}</span><code dir="ltr" className="truncate font-mono text-xs text-foreground">{system[field]}</code><button type="button" onClick={() => void copyValue(`${system.id}:${field}`, system[field] ?? '')} aria-label={t('rahcomCopy')} title={t('rahcomCopy')} className="inline-flex shrink-0 items-center gap-1 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">{copiedKey === `${system.id}:${field}` ? <Check size={15}/> : <Copy size={15}/>}<span className="text-xs">{copiedKey === `${system.id}:${field}` ? t('rahcomCopied') : t('rahcomCopy')}</span></button></div> : null)}
                      </div>
                      {system.details ? <p className="mt-3 whitespace-pre-wrap rounded-xl bg-muted/30 p-3 text-sm leading-6 text-muted-foreground">{system.details}</p> : null}
                      {system.incidentType && <p className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"><strong>{t(system.incidentType === 'THEFT' ? 'rahcomIncidentTheft' : system.incidentType === 'DAMAGE' ? 'rahcomIncidentDamage' : 'rahcomIncidentBoth')}</strong>{system.incidentDetails ? <span className="ms-2 whitespace-pre-wrap">{system.incidentDetails}</span> : null}</p>}
                      <div className="mt-4 border-t border-border pt-4"><RahcomSystemHistory system={system} /></div>
                    </>}
                  </div> : null}
                </article>
              );
            })}</div>; })}
          </div>
        </details>
      );})}

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
