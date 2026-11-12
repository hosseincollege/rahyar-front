'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, LoaderCircle, Pencil, Save, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { usePreferences } from '@/components/preferences-provider';
import { getCurrentOrganizationId } from '@/lib/api/shared/auth-api';
import { rahcomApi, type RahcomSystem } from '@/lib/api/rahcom/rahcom-api';
import { rahcomLongOutageReasonLabel } from '@/lib/api/rahcom/solar-status';
import { settingsApi } from '@/app/(workspace)/settings/settings-api';
import { uiMessage } from '@/lib/ui-messages';

type EditableSystem = Pick<RahcomSystem, 'systemName' | 'systemCode' | 'axisCode' | 'announcedAxis' | 'latitude' | 'longitude' | 'details' | 'electricityBillId' | 'simIp' | 'radarIp' | 'cameraIp' | 'pcIp' | 'routerIp' | 'laptopIp' | 'incidentType' | 'incidentDetails' | 'longOutage' | 'longOutageReason' | 'longOutageDetails'>;

function editValues(system: RahcomSystem): EditableSystem {
  return { systemName: system.systemName, systemCode: system.systemCode, axisCode: system.axisCode, announcedAxis: system.announcedAxis, latitude: system.latitude, longitude: system.longitude, details: system.details ?? '', electricityBillId: system.electricityBillId ?? '', simIp: system.simIp ?? '', radarIp: system.radarIp ?? '', cameraIp: system.cameraIp ?? '', pcIp: system.pcIp ?? '', routerIp: system.routerIp ?? '', laptopIp: system.laptopIp ?? '', incidentType: system.incidentType, incidentDetails: system.incidentDetails ?? '', longOutage: system.longOutage, longOutageReason: system.longOutageReason, longOutageDetails: system.longOutageDetails ?? '' };
}

export default function RahcomSystemDetailsPage() {
  const { locale } = usePreferences();
  const t = useCallback((key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key), [locale]);
  const params = useParams<{ systemCode: string }>();
  const searchParams = useSearchParams();
  const systemCode = decodeURIComponent(params.systemCode ?? '');
  const province = searchParams.get('province') ?? '';
  const [system, setSystem] = useState<RahcomSystem | null>(null);
  const [form, setForm] = useState<EditableSystem | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!province || !systemCode) { setLoading(false); setError(t('rahcomSystemsLoadError')); return; }
    setLoading(true);
    const organizationId = getCurrentOrganizationId();
    const accessPromise = organizationId ? settingsApi.getOrganizationAccess(organizationId) : Promise.resolve(null);
    void Promise.all([rahcomApi.systems(province), accessPromise]).then(([systems, access]) => {
      if (!active) return;
      const found = systems.find((item) => item.systemCode.normalize('NFKC').trim().toLocaleUpperCase() === systemCode.normalize('NFKC').trim().toLocaleUpperCase());
      setSystem(found ?? null);
      setForm(found ? editValues(found) : null);
      setCanManage(Boolean(access?.canManageRahcom));
      setError(found ? '' : t('rahcomSystemsEmpty'));
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : t('rahcomSystemsLoadError')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [province, systemCode, t]);

  const change = <K extends keyof EditableSystem>(key: K, value: EditableSystem[K]) => setForm((current) => current ? { ...current, [key]: value } : current);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!system || !form) return;
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) { setError(t('rahcomDataUploadHint')); return; }
    setSaving(true); setError('');
    const patch = { ...form, latitude, longitude, systemName: form.systemName.trim(), systemCode: form.systemCode.trim(), longOutage: Boolean(form.longOutageReason) };
    try {
      if (system.province === 'isfahan') await rahcomApi.importSystems('isfahan', [{ ...system, ...patch }]);
      else await rahcomApi.updateSystem(system.id, patch);
      const updated = { ...system, ...patch };
      setSystem(updated); setForm(editValues(updated)); setEditing(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('rahcomSystemUpdateFailed')); }
    finally { setSaving(false); }
  }

  const incidentLabel = (value: RahcomSystem['incidentType']) => value === 'THEFT' ? t('rahcomIncidentTheft') : value === 'DAMAGE' ? t('rahcomIncidentDamage') : value === 'THEFT_AND_DAMAGE' ? t('rahcomIncidentBoth') : value === 'WIDENING_RELOCATION' ? t('solarWideningRelocation') : '';
  const equipment = [['simIp', 'SIM IP'], ['radarIp', 'RAD IP'], ['cameraIp', 'CAM IP'], ['pcIp', 'PC IP'], ['routerIp', 'RTR IP'], ['laptopIp', 'Laptop IP']] as const;
  function input<K extends keyof EditableSystem>(key: K, label: string, type = 'text') {
    return <label key={key} className="grid min-w-0 gap-1 text-xs text-muted-foreground">{label}<input required={key === 'systemName' || key === 'systemCode' || key === 'latitude' || key === 'longitude'} type={type} step={type === 'number' ? 'any' : undefined} dir={type === 'number' || key === 'systemCode' ? 'ltr' : undefined} value={String(form?.[key] ?? '')} onChange={(event) => change(key, (type === 'number' ? Number(event.target.value) : event.target.value) as EditableSystem[K])} className="h-9 min-w-0 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-primary" /> </label>;
  }
  const viewFields: Array<[string, string | null | undefined]> = system ? [
    [t('rahcomSystemCode'), system.systemCode], [t('rahcomSystemName'), system.systemName], [t('rahcomProvince'), system.province], [t('rahcomAxisName'), system.announcedAxis], [t('rahcomAxisCode'), system.axisCode], [t('rahcomLatitude'), String(system.latitude)], [t('rahcomLongitude'), String(system.longitude)], [t('rahcomBillId'), system.electricityBillId], [t('rahcomIncidentType'), incidentLabel(system.incidentType)], [t('rahcomIncidentDetails'), system.incidentDetails], [t('rahcomIncidentFilter'), system.longOutage ? rahcomLongOutageReasonLabel(system.longOutageReason, system.longOutageDetails) : ''], ...equipment.map(([key, label]) => [label, system[key]] as [string, string | null]), [t('rahcomSystemDetails'), system.details],
  ] : [];

  return <main dir="rtl" className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3 overflow-auto p-3 sm:p-4">
    <header className="flex shrink-0 items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs text-muted-foreground">{t('rahcomSystemsList')} / {t('rahcomOpenSystemPage')}</p><h1 className="mt-1 truncate text-lg font-semibold">{system?.systemName ?? systemCode}</h1></div><div className="flex shrink-0 gap-2"><Link href="/rahcom/systems" className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-background px-3 text-sm text-foreground hover:border-primary hover:text-primary"><ArrowLeft size={16}/>{t('rahcomSystemsList')}</Link>{system && canManage && !editing && <button type="button" onClick={() => { setForm(editValues(system)); setEditing(true); }} className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-background px-3 text-sm hover:border-primary hover:text-primary"><Pencil size={15}/>{t('rahcomEditSystem')}</button>}</div></header>
    {loading && <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground"><LoaderCircle size={16} className="animate-spin"/>{t('rahcomSystemsLoading')}</div>}
    {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-card p-3 text-sm text-destructive">{error}</div>}
    {system && form && <form onSubmit={(event) => void save(event)} className="min-h-0 rounded-2xl border border-border bg-card p-4">
      {editing ? <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{input('systemName', t('rahcomSystemName'))}{input('systemCode', t('rahcomSystemCode'))}{input('announcedAxis', t('rahcomAxisName'))}{input('axisCode', t('rahcomAxisCode'))}{input('latitude', t('rahcomLatitude'), 'number')}{input('longitude', t('rahcomLongitude'), 'number')}{input('electricityBillId', t('rahcomBillId'))}{equipment.map(([key, label]) => input(key, label))}
          <label className="grid gap-1 text-xs text-muted-foreground">{t('rahcomIncidentType')}<select value={form.incidentType ?? ''} onChange={(event) => change('incidentType', (event.target.value || null) as EditableSystem['incidentType'])} className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground"><option value="">{t('rahcomIncidentNone')}</option><option value="THEFT">{t('rahcomIncidentTheft')}</option><option value="DAMAGE">{t('rahcomIncidentDamage')}</option><option value="THEFT_AND_DAMAGE">{t('rahcomIncidentBoth')}</option><option value="WIDENING_RELOCATION">{t('solarWideningRelocation')}</option></select></label>
          <label className="grid gap-1 text-xs text-muted-foreground">{t('rahcomLongOutageReason')}<select value={form.longOutageReason ?? ''} onChange={(event) => change('longOutageReason', (event.target.value || null) as EditableSystem['longOutageReason'])} className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground"><option value="">{t('rahcomIncidentNone')}</option>{(['THEFT_DAMAGE', 'RELOCATION', 'ELECTRICITY_DEBT', 'PAYMENT_ARREARS', 'POWER_OUTAGE', 'OTHER'] as const).map((reason) => <option key={reason} value={reason}>{rahcomLongOutageReasonLabel(reason)}</option>)}</select></label>
          <label className="grid gap-1 text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">{t('rahcomSystemDetails')}<textarea value={form.details ?? ''} onChange={(event) => change('details', event.target.value)} rows={3} className="min-w-0 rounded-lg border border-border bg-background p-2 text-sm text-foreground outline-none focus:border-primary" /></label>
          <label className="grid gap-1 text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">{t('rahcomIncidentDetails')}<textarea value={form.incidentDetails ?? ''} onChange={(event) => change('incidentDetails', event.target.value)} rows={2} className="min-w-0 rounded-lg border border-border bg-background p-2 text-sm text-foreground outline-none focus:border-primary" /></label>
          {form.longOutageReason === 'OTHER' && <label className="grid gap-1 text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">{t('rahcomIncidentDetails')}<textarea value={form.longOutageDetails ?? ''} onChange={(event) => change('longOutageDetails', event.target.value)} rows={2} className="min-w-0 rounded-lg border border-border bg-background p-2 text-sm text-foreground outline-none focus:border-primary" /></label>}
        </div>
        <div className="mt-4 flex gap-2"><button type="submit" disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm text-primary-foreground disabled:opacity-60">{saving ? <LoaderCircle size={15} className="animate-spin"/> : <Save size={15} />}{t('rahcomSave')}</button><button type="button" onClick={() => { setForm(editValues(system)); setEditing(false); setError(''); }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm"><X size={15}/>{t('rahcomCancel')}</button></div>
      </> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {viewFields.map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-border/70 bg-background p-3"><div className="text-xs text-muted-foreground">{label}</div><div dir="auto" className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{value || '—'}</div></div>)}
      </div>}
    </form>}
  </main>;
}
