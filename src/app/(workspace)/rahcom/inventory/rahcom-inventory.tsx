'use client';

import { useEffect, useMemo, useState } from 'react';
import { Archive, LoaderCircle, Plus, Search, Trash2, X } from 'lucide-react';
import { RahcomToolbar } from '@/components/rahcom/toolbar';
import { usePreferences, getLocaleDirection } from '@/components/providers/preferences-provider';
import { rahcomApi, type RahcomInventoryEntry, type RahcomSystem } from '@/lib/api/rahcom/rahcom-api';
import { formatJalaliDate } from '@/lib/api/rahcom/jalali-date';
import { tehranDateKey } from '@/lib/api/rahcom/solar-status';
import { uiMessage } from '@/lib/ui-messages';

export function RahcomInventory({ selectedProvince, canManage }: { selectedProvince: string; canManage: boolean }) {
  const { locale } = usePreferences();
  const [entries, setEntries] = useState<RahcomInventoryEntry[]>([]);
  const [systems, setSystems] = useState<RahcomSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [equipmentName, setEquipmentName] = useState('');
  const [systemId, setSystemId] = useState('');
  const [usageDate, setUsageDate] = useState(tehranDateKey());
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [items, availableSystems] = await Promise.all([rahcomApi.inventory(selectedProvince), rahcomApi.systems(selectedProvince)]);
      setEntries(items); setSystems(availableSystems);
    } catch { setError(uiMessage(locale, 'rahcomInventoryLoadFailed')); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [selectedProvince]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    return entries.filter((item) => !needle || `${item.equipmentName} ${item.systemNameSnapshot} ${item.systemCodeSnapshot} ${item.usageDate}`.toLocaleLowerCase(locale).includes(needle));
  }, [entries, query, locale]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!equipmentName.trim() || !systemId || !usageDate) return;
    setBusy(true); setError('');
    try {
      await rahcomApi.createInventory({ province: selectedProvince, equipmentName: equipmentName.trim(), systemId, usageDate });
      setEquipmentName(''); setSystemId(''); setUsageDate(tehranDateKey()); setOpen(false); await load();
    } catch { setError(uiMessage(locale, 'rahcomInventorySaveFailed')); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (!window.confirm(uiMessage(locale, 'rahcomInventoryDeleteConfirm'))) return;
    setDeletingId(id); setError('');
    try { await rahcomApi.deleteInventory(id); setEntries((current) => current.filter((item) => item.id !== id)); }
    catch { setError(uiMessage(locale, 'rahcomInventorySaveFailed')); }
    finally { setDeletingId(''); }
  };

  return <section dir={getLocaleDirection(locale)} className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3 overflow-hidden">
    <RahcomToolbar className="flex shrink-0 flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
      <span className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-border bg-background px-3 text-sm" aria-label={uiMessage(locale, 'rahcomInventory')}><Archive size={16} className="text-primary"/>{new Intl.NumberFormat(locale).format(filtered.length)}</span>
      <label className="inline-flex h-9 min-w-44 flex-1 items-center gap-2 rounded-full border border-border bg-background px-3"><Search size={16}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={uiMessage(locale, 'rahcomInventorySearch')} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
      {canManage && selectedProvince !== 'all' && <button type="button" onClick={() => setOpen((v) => !v)} aria-label={uiMessage(locale, 'rahcomAdd')} title={uiMessage(locale, 'rahcomAdd')} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background transition-colors hover:border-primary hover:text-primary">{open ? <X size={17}/> : <Plus size={17}/>}</button>}
    </RahcomToolbar>
    {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-card px-4 py-2 text-sm text-destructive">{error}</p>}
    {open && <form onSubmit={(e) => void submit(e)} className="grid shrink-0 grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-4">
      <label className="grid gap-1 text-sm">{uiMessage(locale, 'rahcomInventoryEquipment')}<input required maxLength={200} value={equipmentName} onChange={(e) => setEquipmentName(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3" placeholder="مودم SXT" /></label>
      <label className="grid gap-1 text-sm">{uiMessage(locale, 'rahcomInventorySystem')}<select required value={systemId} onChange={(e) => setSystemId(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3"><option value="">—</option>{systems.map((system) => <option key={system.id} value={system.id}>{system.systemName} ({system.systemCode})</option>)}</select></label>
      <label className="grid gap-1 text-sm">{uiMessage(locale, 'rahcomInventoryDate')}<input required type="date" value={usageDate} onChange={(e) => setUsageDate(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3" /></label>
      <button type="submit" disabled={busy} className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? <LoaderCircle size={16} className="animate-spin"/> : <Plus size={16}/>} {uiMessage(locale, 'rahcomSave')}</button>
    </form>}
    <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[640px] border-collapse text-sm"><thead className="sticky top-0 z-10 bg-muted/90"><tr>{['rahcomInventoryEquipment','rahcomInventorySystem','rahcomInventoryDate'].map((key) => <th key={key} className="border-b border-border px-4 py-3 text-start font-semibold">{uiMessage(locale, key as 'rahcomInventoryEquipment')}</th>)}{canManage && <th className="w-16 border-b border-border px-3 py-3"/>}</tr></thead>
      <tbody>{!loading && filtered.map((item) => <tr key={item.id} className="border-b border-border/70 last:border-0 hover:bg-muted/30"><td className="px-4 py-3">{item.equipmentName}</td><td className="px-4 py-3">{item.systemNameSnapshot} <span className="text-muted-foreground">({item.systemCodeSnapshot})</span></td><td className="px-4 py-3">{formatJalaliDate(item.usageDate.slice(0, 10))}</td>{canManage && <td className="px-3 py-2 text-center"><button type="button" onClick={() => void remove(item.id)} disabled={deletingId === item.id} aria-label={uiMessage(locale, 'rahcomDelete')} className="rounded-full p-2 text-muted-foreground transition-colors hover:text-destructive">{deletingId === item.id ? <LoaderCircle size={16} className="animate-spin"/> : <Trash2 size={16}/>}</button></td>}</tr>)}
      {!loading && filtered.length === 0 && <tr><td colSpan={canManage ? 4 : 3} className="p-8 text-center text-muted-foreground">{uiMessage(locale, 'rahcomInventoryEmpty')}</td></tr>}</tbody></table>
      {loading && <div className="p-10 text-center text-muted-foreground"><LoaderCircle className="mx-auto animate-spin"/></div>}
    </div>
  </section>;
}
