'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Check, Copy, FileUp, History, LoaderCircle, Pencil, Save, Trash2, X } from 'lucide-react';
import { usePreferences, getLocaleDirection } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { RahcomSystemHistory } from '@/components/rahcom/rahcom-system-history';
import { formatRahcomCoordinates, iranProvinces, rahcomApi, type RahcomSystem } from '@/lib/rahcom-api';

type Editable = Pick<RahcomSystem, 'systemName' | 'systemCode' | 'latitude' | 'longitude' | 'details' | 'electricityBillId' | 'simIp' | 'radarIp' | 'cameraIp' | 'pcIp' | 'routerIp' | 'laptopIp'>;
const headerAliases: Record<string, keyof Editable> = {
  name: 'systemName', systemname: 'systemName', 'نام سامانه': 'systemName', 'نام سیستم': 'systemName',
  code: 'systemCode', systemcode: 'systemCode', id: 'systemCode', 'کد سامانه': 'systemCode', 'شناسه سامانه': 'systemCode',
  lat: 'latitude', latitude: 'latitude', 'عرض جغرافیایی': 'latitude', 'عرض': 'latitude',
  lng: 'longitude', lon: 'longitude', longitude: 'longitude', 'طول جغرافیایی': 'longitude', 'طول': 'longitude',
  details: 'details', description: 'details', 'توضیحات': 'details',
  electricitybillid: 'electricityBillId', billid: 'electricityBillId', 'شناسه قبض برق': 'electricityBillId',
  simip: 'simIp', simcardip: 'simIp', 'ip سیم کارت': 'simIp', 'ip سیم‌کارت': 'simIp',
  radarip: 'radarIp', 'ip رادار': 'radarIp', cameraip: 'cameraIp', 'ip دوربین': 'cameraIp',
  pcip: 'pcIp', 'ip پی سی': 'pcIp', routerip: 'routerIp', gatewayip: 'routerIp', 'ip روتر': 'routerIp', 'ip گیت وی': 'routerIp',
  laptopip: 'laptopIp', 'ip لپ تاپ': 'laptopIp',
};
const normalizeHeader = (value: unknown) => String(value).trim().normalize('NFKC').toLocaleLowerCase()
  .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c_\-./()]/g, '');
const normalizeProvinceName = (value: unknown) => normalizeHeader(value);
const uploadHeaderAliases: Record<string, keyof Editable | 'province'> = {
  name: 'systemName', systemname: 'systemName', station: 'systemName', stationname: 'systemName',
  [normalizeHeader('\u0646\u0627\u0645 \u0627\u06cc\u0633\u062a\u06af\u0627\u0647')]: 'systemName',
  [normalizeHeader('\u0646\u0627\u0645 \u0633\u0627\u0645\u0627\u0646\u0647')]: 'systemName',
  code: 'systemCode', systemcode: 'systemCode', id: 'systemCode', sitecode: 'systemCode', stationcode: 'systemCode',
  [normalizeHeader('\u06a9\u062f \u0627\u06cc\u0633\u062a\u06af\u0627\u0647')]: 'systemCode',
  [normalizeHeader('\u06a9\u062f \u0633\u0627\u0645\u0627\u0646\u0647')]: 'systemCode',
  lat: 'latitude', latitude: 'latitude', [normalizeHeader('\u0639\u0631\u0636')]: 'latitude',
  [normalizeHeader('\u0639\u0631\u0636 \u062c\u063a\u0631\u0627\u0641\u06cc\u0627\u06cc\u06cc')]: 'latitude',
  long: 'longitude', lng: 'longitude', lon: 'longitude', longitude: 'longitude', [normalizeHeader('\u0637\u0648\u0644')]: 'longitude',
  [normalizeHeader('\u0637\u0648\u0644 \u062c\u063a\u0631\u0627\u0641\u06cc\u0627\u06cc\u06cc')]: 'longitude',
  details: 'details', description: 'details', axis: 'details', route: 'details',
  [normalizeHeader('\u062a\u0648\u0636\u06cc\u062d\u0627\u062a')]: 'details', [normalizeHeader('\u0645\u062d\u0648\u0631')]: 'details',
  electricitybillid: 'electricityBillId', billid: 'electricityBillId', [normalizeHeader('\u0634\u0646\u0627\u0633\u0647 \u0642\u0628\u0636 \u0628\u0631\u0642')]: 'electricityBillId',
  simip: 'simIp', simcardip: 'simIp', [normalizeHeader('ip \u0633\u06cc\u0645\u200c\u06a9\u0627\u0631\u062a')]: 'simIp', [normalizeHeader('ip \u0633\u06cc\u0645 \u06a9\u0627\u0631\u062a')]: 'simIp',
  radarip: 'radarIp', [normalizeHeader('ip \u0631\u0627\u062f\u0627\u0631')]: 'radarIp', cameraip: 'cameraIp', [normalizeHeader('ip \u062f\u0648\u0631\u0628\u06cc\u0646')]: 'cameraIp',
  pcip: 'pcIp', [normalizeHeader('ip \u067e\u06cc \u0633\u06cc')]: 'pcIp', routerip: 'routerIp', gatewayip: 'routerIp', [normalizeHeader('ip \u0631\u0648\u062a\u0631')]: 'routerIp', [normalizeHeader('ip \u06af\u06cc\u062a \u0648\u06cc')]: 'routerIp',
  laptopip: 'laptopIp', [normalizeHeader('ip \u0644\u067e \u062a\u0627\u067e')]: 'laptopIp',
  province: 'province', [normalizeHeader('\u0627\u0633\u062a\u0627\u0646')]: 'province',
};
const normalizeNumericText = (value: unknown) => String(value ?? '')
  .replace(/[\u06f0-\u06f9\u0660-\u0669]/g, digit => String.fromCharCode(digit.charCodeAt(0) >= 0x06f0 ? digit.charCodeAt(0) - 0x06f0 + 48 : digit.charCodeAt(0) - 0x0660 + 48))
  .replace(/[\u066b]/g, '.').trim();

export default function RahcomDataPage() {
  const { locale } = usePreferences(); const t = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const [province, setProvince] = useState(''); const [systems, setSystems] = useState<RahcomSystem[]>([]);
  const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null); const [form, setForm] = useState<Editable | null>(null);
  const [copiedKey, setCopiedKey] = useState('');
  const [historySystemId, setHistorySystemId] = useState('');
  const copyResetTimer = useRef<number | null>(null);
  const load = useCallback(async () => { setLoading(true); try { setSystems(await rahcomApi.systems()); } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not load systems.'); } finally { setLoading(false); } }, []);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void load(); });
    return () => window.cancelAnimationFrame(frame);
  }, [load]);
  useEffect(() => {
    const onSystemsChanged = () => { void load(); };
    window.addEventListener('rahyar:systems-changed', onSystemsChanged);
    return () => window.removeEventListener('rahyar:systems-changed', onSystemsChanged);
  }, [load]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const saved = window.localStorage.getItem('rahyar-rahcom-upload-province');
      if (saved && iranProvinces.some(([id]) => id === saved)) setProvince(saved);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  async function upload(file?: File) {
    if (!file || !province) return;
    setBusy(true); setMessage('');
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('فایل باید کمتر از ۱۰ مگابایت باشد.');
      const data = await file.arrayBuffer(); const workbook = XLSX.read(data, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
      if (!rows.length) throw new Error('فایل اکسل خالی است.');
      const skippedRows: number[] = [];
      const seenCodes = new Set<string>();
      const selectedProvinceName = iranProvinces.find(([id]) => id === province)?.[1] ?? province;
      const systems = rows.flatMap((row, index) => {
        if (Object.values(row).every(value => String(value ?? '').trim() === '')) return [];
        const normalized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
          const normalizedKey = normalizeHeader(key);
          const field = uploadHeaderAliases[normalizedKey] ?? headerAliases[normalizedKey];
          if (field) normalized[field] = value;
        }
        const systemName = String(normalized.systemName ?? '').trim();
        const systemCode = String(normalized.systemCode ?? '').trim();
        const latitudeText = normalizeNumericText(normalized.latitude);
        const longitudeText = normalizeNumericText(normalized.longitude);
        const latitude = latitudeText ? Number(latitudeText) : Number.NaN;
        const longitude = longitudeText ? Number(longitudeText) : Number.NaN;
        const fileProvince = String(normalized.province ?? '').trim();
        if (fileProvince && normalizeProvinceName(fileProvince) !== normalizeProvinceName(selectedProvinceName) && normalizeProvinceName(fileProvince) !== normalizeProvinceName(province)) {
          throw new Error(`\u0641\u0627\u06cc\u0644 \u0645\u0631\u0628\u0648\u0637 \u0628\u0647 \u0627\u0633\u062a\u0627\u0646 \u00ab${fileProvince}\u00bb \u0627\u0633\u062a\u060c \u0627\u0645\u0627 \u0627\u0633\u062a\u0627\u0646 \u062f\u06cc\u06af\u0631\u06cc \u0627\u0646\u062a\u062e\u0627\u0628 \u0634\u062f\u0647 \u0627\u0633\u062a.`);
        }
        if (!systemName || !systemCode || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || seenCodes.has(systemCode)) {
          skippedRows.push(index + 2);
          return [];
        }
        seenCodes.add(systemCode);
        const optionalFields = ['electricityBillId', 'simIp', 'radarIp', 'cameraIp', 'pcIp', 'routerIp', 'laptopIp'] as const;
        const optionalData = Object.fromEntries(optionalFields.filter(field => normalized[field] !== undefined).map(field => [field, String(normalized[field] ?? '').trim()]));
        return [{ systemName, systemCode, latitude, longitude, details: String(normalized.details ?? '').trim(), ...optionalData }];
      });
      if (!systems.length) throw new Error('\u0647\u06cc\u0686 \u0631\u062f\u06cc\u0641 \u06a9\u0627\u0645\u0644\u06cc \u0628\u0631\u0627\u06cc \u062b\u0628\u062a \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f. \u0639\u0646\u0648\u0627\u0646 \u0633\u062a\u0648\u0646\u200c\u0647\u0627 \u0648 \u0645\u062e\u062a\u0635\u0627\u062a \u0631\u0627 \u0628\u0631\u0631\u0633\u06cc \u06a9\u0646\u06cc\u062f.');
      const result = await rahcomApi.importSystems(province, systems);
      setMessage(`${result.imported} \u0633\u0627\u0645\u0627\u0646\u0647 \u0628\u0627 \u0645\u0648\u0641\u0642\u06cc\u062a \u062b\u0628\u062a \u0634\u062f.${skippedRows.length ? ` ${skippedRows.length} \u0631\u062f\u06cc\u0641 \u0646\u0627\u0642\u0635 \u0648\u0627\u0631\u062f \u0646\u0634\u062f (\u0631\u062f\u06cc\u0641\u200c\u0647\u0627\u06cc ${skippedRows.join('\u060c ')}).` : ''}`);
      await load();
    } catch (e) { setMessage(e instanceof Error ? `\u062e\u0637\u0627 \u062f\u0631 \u0628\u0627\u0631\u06af\u0630\u0627\u0631\u06cc: ${e.message}` : '\u0628\u0627\u0631\u06af\u0630\u0627\u0631\u06cc \u0641\u0627\u06cc\u0644 \u0627\u0646\u062c\u0627\u0645 \u0646\u0634\u062f.'); }
    finally { setBusy(false); }
  }
  function beginEdit(item: RahcomSystem) { setEditing(item.id); setForm({ systemName: item.systemName, systemCode: item.systemCode, latitude: item.latitude, longitude: item.longitude, details: item.details ?? '', electricityBillId: item.electricityBillId ?? '', simIp: item.simIp ?? '', radarIp: item.radarIp ?? '', cameraIp: item.cameraIp ?? '', pcIp: item.pcIp ?? '', routerIp: item.routerIp ?? '', laptopIp: item.laptopIp ?? '' }); }
  async function save() { if (!editing || !form) return; setBusy(true); try { await rahcomApi.updateSystem(editing, form); setEditing(null); setForm(null); await load(); } catch (e) { setMessage(e instanceof Error ? e.message : 'ذخیره انجام نشد.'); } finally { setBusy(false); } }
  async function remove(id: string) { if (!window.confirm(t('rahcomDelete') + '?')) return; setBusy(true); try { await rahcomApi.deleteSystem(id); await load(); } catch (e) { setMessage(e instanceof Error ? e.message : 'حذف انجام نشد.'); } finally { setBusy(false); } }
  async function removeMany(input: { province?: string; ids?: string[] }) {
    const count = input.province ? systemsByProvince[input.province]?.length ?? 0 : input.ids?.length ?? 0;
    if (!count) return;
    const provinceName = input.province ? iranProvinces.find(([id]) => id === input.province)?.[1] ?? input.province : '';
    const prompt = input.province ? `همهٔ ${count} سامانهٔ استان ${provinceName} حذف شوند؟` : `${count} سامانهٔ انتخاب‌شده حذف شوند؟`;
    if (!window.confirm(prompt)) return;
    setBusy(true); setMessage('');
    try {
      const result = await rahcomApi.deleteSystems(input);
      setSelectedIds(new Set());
      setMessage(`${result.deleted} سامانه حذف شد.`);
      await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'حذف انجام نشد.'); }
    finally { setBusy(false); }
  }
  async function copyValue(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      if (copyResetTimer.current) window.clearTimeout(copyResetTimer.current);
      copyResetTimer.current = window.setTimeout(() => setCopiedKey(current => current === key ? '' : current), 1800);
    } catch { setMessage(t('rahcomCopyFailed')); }
  }
  const systemsByProvince = systems.reduce<Record<string, RahcomSystem[]>>((groups, item) => { (groups[item.province] ??= []).push(item); return groups; }, {});
  const field = (key: keyof Editable, label: string, type = 'text') => <label className="grid gap-1 text-xs text-muted-foreground">{label}<input type={type} value={String(form?.[key] ?? '')} onChange={e => setForm(prev => prev ? { ...prev, [key]: type === 'number' ? Number(e.target.value) : e.target.value } : prev)} className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground" /></label>;
  return <main dir={getLocaleDirection(locale)} className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
    <header><h1 className="text-xl font-bold text-foreground">{t('rahcomSystemData')}</h1><p className="mt-1 text-sm text-muted-foreground">{t('rahcomDataUploadHint')}</p></header>
    <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
      <label className="grid min-w-48 gap-1 text-xs text-muted-foreground">{t('rahcomProvince')}<select required aria-label={t('rahcomProvince')} value={province} onChange={e => { setProvince(e.target.value); window.localStorage.setItem('rahyar-rahcom-upload-province', e.target.value); }} className="h-10 cursor-pointer rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="" disabled>استان را انتخاب کنید</option>{iranProvinces.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold ${province ? 'cursor-pointer bg-primary text-primary-foreground' : 'cursor-not-allowed bg-muted text-muted-foreground'}`}>{busy ? <LoaderCircle size={16} className="animate-spin" /> : <FileUp size={16} />}{t('rahcomUploadExcel')}<input type="file" accept=".xlsx,.xls" className="sr-only" disabled={busy || !province} onChange={e => { void upload(e.target.files?.[0]); e.currentTarget.value = ''; }} /></label>
      {message && <p role="status" className="w-full text-sm text-muted-foreground">{message}</p>}
    </section>
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      {loading ? <p className="p-5 text-sm text-muted-foreground">…</p> : systems.length === 0 ? <p className="p-5 text-sm text-muted-foreground">داده‌ای ثبت نشده است.</p> : <div className="divide-y divide-border">{Object.entries(systemsByProvince).map(([provinceId, provinceSystems]) => {
        const provinceIds = provinceSystems.map(item => item.id);
        const allSelected = provinceIds.length > 0 && provinceIds.every(id => selectedIds.has(id));
        return <details key={provinceId} open={provinceId === province || Object.keys(systemsByProvince).length === 1} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between bg-muted/30 p-4 font-semibold"><span>{iranProvinces.find(([id]) => id === provinceId)?.[1] ?? provinceId}</span><span className="text-xs text-muted-foreground">{provinceSystems.length} سامانه</span></summary>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/10 px-4 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(current => { const next = new Set(current); provinceIds.forEach(id => { if (allSelected) next.delete(id); else next.add(id); }); return next; })} />انتخاب همهٔ این استان</label>
            <div className="flex gap-2"><button type="button" onClick={() => void removeMany({ ids: provinceIds.filter(id => selectedIds.has(id)) })} disabled={busy || !provinceIds.some(id => selectedIds.has(id))} className="rounded-lg border border-border px-3 py-1.5 text-xs text-destructive disabled:opacity-50">حذف انتخاب‌شده‌ها</button><button type="button" onClick={() => void removeMany({ province: provinceId })} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs text-destructive disabled:opacity-50"><Trash2 size={14}/>حذف کل استان</button></div>
          </div>
          {provinceSystems.map(item => <article key={item.id} className="flex flex-wrap gap-3 border-t border-border p-4">
            <input aria-label={`انتخاب ${item.systemName}`} type="checkbox" checked={selectedIds.has(item.id)} onChange={() => setSelectedIds(current => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} className="mt-1" />
            <button type="button" onClick={() => setHistorySystemId(current => current === item.id ? '' : item.id)} aria-label={t('rahcomHistory')} title={t('rahcomHistory')} className="mt-0.5 rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent hover:text-primary"><History size={16}/></button>
            {historySystemId === item.id && <div className="w-full basis-full"><RahcomSystemHistory system={item}/></div>}
            <div className="min-w-0 flex-1">{editing === item.id && form ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{field('systemName', t('rahcomSystemName'))}{field('systemCode', t('rahcomSystemCode'))}{field('latitude', t('rahcomLatitude'), 'number')}{field('longitude', t('rahcomLongitude'), 'number')}{field('electricityBillId', t('rahcomElectricityBillId'))}{field('simIp', t('rahcomSimIp'))}{field('radarIp', t('rahcomRadarIp'))}{field('cameraIp', t('rahcomCameraIp'))}{field('pcIp', t('rahcomPcIp'))}{field('routerIp', t('rahcomRouterIp'))}{field('laptopIp', t('rahcomLaptopIp'))}{field('details', t('rahcomDescription'))}<div className="flex items-end gap-2"><button onClick={() => void save()} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm text-primary-foreground"><Save size={15}/>{t('rahcomSave')}</button><button onClick={() => { setEditing(null); setForm(null); }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm"><X size={15}/></button></div></div> : <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h2 className="font-semibold">{item.systemName}</h2><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{t('rahcomSystemCode')}:</span><code dir="ltr" className="text-foreground">{item.systemCode}</code><button type="button" onClick={() => void copyValue(`${item.id}:code`, item.systemCode)} aria-label={t('rahcomCopyCode')} title={t('rahcomCopyCode')} className="inline-flex items-center gap-1 rounded p-1 hover:bg-accent">{copiedKey === `${item.id}:code` ? <Check size={14}/> : <Copy size={14}/>}<span>{copiedKey === `${item.id}:code` ? t('rahcomCopied') : t('rahcomCopyCode')}</span></button><span dir="ltr" className="font-mono text-foreground">{formatRahcomCoordinates(item.latitude, item.longitude)}</span><button type="button" onClick={() => void copyValue(`${item.id}:coordinates`, formatRahcomCoordinates(item.latitude, item.longitude))} aria-label={t('rahcomCopyCoordinates')} title={t('rahcomCopyCoordinates')} className="inline-flex items-center gap-1 rounded p-1 hover:bg-accent">{copiedKey === `${item.id}:coordinates` ? <Check size={14}/> : <Copy size={14}/>}<span>{copiedKey === `${item.id}:coordinates` ? t('rahcomCopied') : t('rahcomCopyCoordinates')}</span></button></div><div className="mt-2 flex flex-wrap gap-2">{([
              ['electricityBillId', 'rahcomElectricityBillId'], ['simIp', 'rahcomSimIp'], ['radarIp', 'rahcomRadarIp'], ['cameraIp', 'rahcomCameraIp'], ['pcIp', 'rahcomPcIp'], ['routerIp', 'rahcomRouterIp'], ['laptopIp', 'rahcomLaptopIp'],
            ] as const).map(([fieldKey, labelKey]) => item[fieldKey] ? <span key={fieldKey} className="rounded-lg border border-border bg-muted/30 px-2 py-1 text-xs"><span className="text-muted-foreground">{t(labelKey)}: </span><code dir="ltr" className="text-foreground">{item[fieldKey]}</code></span> : null)}{item.details ? <span className="text-xs text-muted-foreground">{item.details}</span> : null}</div></div><div className="flex gap-2"><button aria-label={t('rahcomEditSystem')} onClick={() => beginEdit(item)} className="rounded-lg border border-border p-2 text-muted-foreground hover:text-primary"><Pencil size={16}/></button><button aria-label={t('rahcomDelete')} onClick={() => void remove(item.id)} className="rounded-lg border border-border p-2 text-muted-foreground hover:text-destructive"><Trash2 size={16}/></button></div></div>}</div>
          </article>)}
        </details>;
      })}</div>}
    </section>
  </main>;
}

