'use client';

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { LoaderCircle, Plus, Trash2, Zap } from 'lucide-react';
import { RahcomDataListLayout, RahcomDataListToolbar } from '@/components/rahcom/data-list-layout';
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
  const [wrapTableText, setWrapTableText] = useState(false);

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
  const downloadInventory = () => {
    if (filtered.length === 0) return;
    const headers = [uiMessage(locale, 'rahcomInventoryEquipment'), uiMessage(locale, 'rahcomInventorySystem'), uiMessage(locale, 'rahcomInventoryDate')];
    const rows = filtered.map((item) => [item.equipmentName, `${item.systemNameSnapshot} (${item.systemCodeSnapshot})`, formatJalaliDate(item.usageDate.slice(0, 10))]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, ...rows]), 'Inventory');
    XLSX.writeFile(workbook, `rahcom-inventory-${tehranDateKey()}.xlsx`);
  };

  return <RahcomDataListLayout
    dir={getLocaleDirection(locale)}
    toolbar={<RahcomDataListToolbar
      count={filtered.length > 0 && <span role="status" aria-label={uiMessage(locale, 'rahcomInventory')} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm text-foreground"><Zap size={16} className="text-primary" aria-hidden="true"/><strong className="font-bold tabular-nums">{new Intl.NumberFormat(locale).format(filtered.length)}</strong></span>}
      add={canManage && selectedProvince !== 'all' ? { label: uiMessage(locale, 'rahcomAdd'), onClick: () => setOpen((value) => !value) } : { label: uiMessage(locale, 'rahcomAdd'), disabled: true }}
      upload={{ label: uiMessage(locale, 'rahcomUploadExcel'), disabled: true }}
      wrap={{ label: uiMessage(locale, 'rahcomWrapLongTableText'), singleLineLabel: uiMessage(locale, 'rahcomKeepTableTextSingleLine'), pressed: wrapTableText, onToggle: () => setWrapTableText((value) => !value) }}
      download={{ label: uiMessage(locale, 'solarDownloadExcel'), onClick: downloadInventory, disabled: filtered.length === 0 }}
      search={{ value: query, onChange: setQuery, placeholder: uiMessage(locale, 'rahcomInventorySearch'), label: uiMessage(locale, 'rahcomInventory') }}
      backup={{ open: false, onToggle: () => undefined, label: uiMessage(locale, 'rahcomSaveSystemsBackup'), disabled: true, save: { label: uiMessage(locale, 'rahcomSaveSystemsBackup'), disabled: true }, restore: { label: uiMessage(locale, 'rahcomRestoreSystemsBackup'), disabled: true } }}
    />}
    isLoading={loading}
    loadingMessage={uiMessage(locale, 'reportsLoading')}
    error={entries.length === 0 ? error : undefined}
    emptyMessage={query.trim() ? uiMessage(locale, 'searchNoResults') : uiMessage(locale, 'rahcomInventoryEmpty')}
    hasRows={filtered.length > 0}
    beforeResults={<>
      {entries.length > 0 && error && <p role="alert" className="shrink-0 rounded-xl border border-destructive/30 bg-card p-3 text-sm text-destructive">{error}</p>}
      {open && <form onSubmit={(e) => void submit(e)} className="grid shrink-0 grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-4">
        <label className="grid gap-1 text-sm">{uiMessage(locale, 'rahcomInventoryEquipment')}<input required maxLength={200} value={equipmentName} onChange={(e) => setEquipmentName(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3" placeholder="مودم SXT" /></label>
        <label className="grid gap-1 text-sm">{uiMessage(locale, 'rahcomInventorySystem')}<select required value={systemId} onChange={(e) => setSystemId(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3"><option value="">—</option>{systems.map((system) => <option key={system.id} value={system.id}>{system.systemName} ({system.systemCode})</option>)}</select></label>
        <label className="grid gap-1 text-sm">{uiMessage(locale, 'rahcomInventoryDate')}<input required type="date" value={usageDate} onChange={(e) => setUsageDate(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3" /></label>
        <button type="submit" disabled={busy} className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? <LoaderCircle size={16} className="animate-spin"/> : <Plus size={16}/>} {uiMessage(locale, 'rahcomSave')}</button>
      </form>}
    </>}
  >
      <table className="w-full min-w-[640px] border-collapse text-sm"><thead className="sticky top-0 z-10 bg-muted/90"><tr>{['rahcomInventoryEquipment','rahcomInventorySystem','rahcomInventoryDate'].map((key) => <th key={key} className="border-b border-border px-4 py-3 text-start font-semibold">{uiMessage(locale, key as 'rahcomInventoryEquipment')}</th>)}{canManage && <th className="w-16 border-b border-border px-3 py-3"/>}</tr></thead>
      <tbody>{filtered.map((item) => <tr key={item.id} className="border-b border-border/70 last:border-0 hover:bg-muted/30"><td className={`px-4 py-3 ${wrapTableText ? 'whitespace-normal break-words' : 'whitespace-nowrap'}`}>{item.equipmentName}</td><td className={`px-4 py-3 ${wrapTableText ? 'whitespace-normal break-words' : 'whitespace-nowrap'}`}>{item.systemNameSnapshot} <span className="text-muted-foreground">({item.systemCodeSnapshot})</span></td><td className="whitespace-nowrap px-4 py-3">{formatJalaliDate(item.usageDate.slice(0, 10))}</td>{canManage && <td className="px-3 py-2 text-center"><button type="button" onClick={() => void remove(item.id)} disabled={deletingId === item.id} aria-label={uiMessage(locale, 'rahcomDelete')} className="rounded-full p-2 text-muted-foreground transition-colors hover:text-destructive">{deletingId === item.id ? <LoaderCircle size={16} className="animate-spin"/> : <Trash2 size={16}/>}</button></td>}</tr>)}</tbody></table>
  </RahcomDataListLayout>;
}
