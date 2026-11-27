'use client';

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { LoaderCircle, Plus, Trash2, Zap } from 'lucide-react';
import { RahcomDataListToolbar } from '@/components/rahcom/data-list-layout';
import { RahcomTableFrame } from '@/components/rahcom/table';
import { usePreferences, getLocaleDirection } from '@/components/providers/preferences-provider';
import { rahcomApi, type RahcomInventoryEntry, type RahcomInventoryRequest, type RahcomSystem } from '@/lib/api/rahcom/rahcom-api';
import { formatJalaliDate } from '@/lib/api/rahcom/jalali-date';
import { tehranDateKey } from '@/lib/api/rahcom/solar-status';
import { uiMessage } from '@/lib/ui-messages';
import { useBackupActionsPreference } from '@/components/rahcom/use-backup-actions-preference';
import { getAccessToken } from '@/lib/api-client';

export function RahcomInventory({ selectedProvince, canManage }: { selectedProvince: string; canManage: boolean }) {
  const { locale } = usePreferences();
  const deliveredActionLabel = '\u062b\u0628\u062a \u062a\u062d\u0648\u06cc\u0644';
  const consumedActionLabel = '\u062b\u0628\u062a \u0645\u0635\u0631\u0641/\u0646\u0635\u0628';
  const [entries, setEntries] = useState<RahcomInventoryEntry[]>([]);
  const [requests, setRequests] = useState<RahcomInventoryRequest[]>([]);
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
  const [backupBusy, setBackupBusy] = useState(false);
  const [wrapTableText, setWrapTableText] = useState(false);
  const { open: backupActionsOpen, toggle: toggleBackupActions } = useBackupActionsPreference();

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [items, availableSystems, requestItems] = await Promise.all([rahcomApi.inventory(selectedProvince), rahcomApi.systems(selectedProvince), rahcomApi.inventoryRequests(selectedProvince)]);
      setEntries(items); setSystems(availableSystems); setRequests(requestItems);
    } catch { setError(uiMessage(locale, 'rahcomInventoryLoadFailed')); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [selectedProvince]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    return entries.filter((item) => !needle || `${item.equipmentName} ${item.systemNameSnapshot} ${item.systemCodeSnapshot} ${item.usageDate}`.toLocaleLowerCase(locale).includes(needle));
  }, [entries, query, locale]);
  const filteredRequests = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    return requests.filter((request) => !needle || [request.referenceNumber, request.requestedAtText, request.requestDescription, request.status, ...request.items.map((item) => `${item.name} ${item.code ?? ''} ${item.note ?? ''}`)].join(' ').toLocaleLowerCase(locale).includes(needle));
  }, [requests, query, locale]);
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
  const updateRequestStage = async (request: RahcomInventoryRequest, nextStatus: 'DELIVERED' | 'CONSUMED') => {
    const isDelivery = nextStatus === 'DELIVERED';
    const date = window.prompt(isDelivery ? 'تاریخ تحویل (مثلاً 1405/09/05):' : 'تاریخ مصرف/نصب (مثلاً 1405/09/05):', tehranDateKey());
    if (!date?.trim()) return;
    const itemText = request.items.map((item) => `${item.name} | ${item.quantity ?? ''}`).join('\n');
    const quantities = window.prompt(isDelivery ? 'برای هر قلم یک سطر «نام قلم | تعداد تحویلی» وارد کن:' : 'برای هر قلم یک سطر «نام قلم | تعداد مصرف‌شده» وارد کن:', itemText);
    if (quantities === null) return;
    const stageItems = quantities.split(/\r?\n/).map((line) => {
      const [name, quantity = ''] = line.split('|');
      return { name: name.trim(), quantity: quantity.trim() };
    }).filter((item) => item.name);
    if (!stageItems.length) { setError('برای ثبت مرحله، حداقل یک قلم لازم است.'); return; }
    const note = window.prompt(isDelivery ? 'یادداشت تحویل:' : 'یادداشت مصرف/محل نصب یا سامانه:');
    if (note === null) return;
    setError('');
    try {
      const updated = await rahcomApi.updateInventoryRequest(request.id, isDelivery
        ? { status: nextStatus, deliveryDate: date.trim(), deliveryNote: note.trim(), deliveredItems: stageItems }
        : { status: nextStatus, consumptionDate: date.trim(), consumptionNote: note.trim(), consumedItems: stageItems });
      setRequests((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch { setError('ثبت مرحلهٔ درخواست انجام نشد.'); }
  };
  const downloadRequestBackup = () => {
    const workbook = XLSX.utils.book_new();
    const requestRows = requests.map((request) => [request.referenceNumber, request.province, request.requestedAtText, request.requestDescription, request.status, request.deliveryDate ?? '', request.deliveryNote ?? '', request.consumptionDate ?? '', request.consumptionNote ?? '']);
    const requestSheet = XLSX.utils.aoa_to_sheet([['شماره درخواست','استان','تاریخ ثبت','شرح درخواست','وضعیت','تاریخ تحویل','یادداشت تحویل','تاریخ مصرف/نصب','یادداشت مصرف/محل نصب'], ...requestRows]);
    requestSheet['!cols'] = [{wch:20},{wch:14},{wch:24},{wch:90},{wch:16},{wch:20},{wch:60},{wch:20},{wch:60}];
    XLSX.utils.book_append_sheet(workbook, requestSheet, 'درخواست‌ها');
    const itemRows = requests.flatMap((request) => request.items.map((item, index) => [request.referenceNumber,item.name,item.code ?? '',item.quantity ?? '',item.unit ?? '',item.supplyType ?? '',item.note ?? '',request.deliveredItems?.[index]?.quantity ?? '',request.deliveryDate ?? '',request.consumedItems?.[index]?.quantity ?? '',request.consumptionDate ?? '',request.consumptionNote ?? '']));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['شماره درخواست','شرح قلم','کد کالا','تعداد درخواستی','واحد','نوع تامین','توضیح درخواست','تعداد تحویلی','تاریخ تحویل','تعداد مصرف‌شده','تاریخ مصرف/نصب','یادداشت مصرف/محل نصب'], ...itemRows]), 'اقلام');
    XLSX.writeFile(workbook, 'ESF-inventory-requests.xlsx');
  };
  const restoreRequestBackup = async () => {
    if (backupBusy || loading || selectedProvince !== 'isfahan' || !canManage) return;
    const token = getAccessToken();
    if (!token) { setError(uiMessage(locale, 'rahcomInventoryLoadFailed')); return; }
    setBackupBusy(true); setError('');
    try {
      const response = await fetch('/api/provinces/isfahan/inventory-requests/backup', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!response.ok) throw new Error(uiMessage(locale, 'rahcomInventoryLoadFailed'));
      const workbook = XLSX.read(new Uint8Array(await response.arrayBuffer()), { type: 'array' });
      const requestSheet = workbook.Sheets['درخواست‌ها'];
      const itemsSheet = workbook.Sheets['اقلام'];
      if (!requestSheet || !itemsSheet) throw new Error(uiMessage(locale, 'rahcomInventoryLoadFailed'));
      const requestRows = XLSX.utils.sheet_to_json<unknown[]>(requestSheet, { header: 1, raw: false, defval: '', blankrows: false });
      const itemRows = XLSX.utils.sheet_to_json<unknown[]>(itemsSheet, { header: 1, raw: false, defval: '', blankrows: false });
      type BackupRequest = { referenceNumber: string; requestedAtText: string; requestDescription: string; status: string; deliveryDate: string; deliveryNote: string; consumptionDate: string; consumptionNote: string };
      const records = new Map<string, BackupRequest>();
      for (const row of requestRows.slice(1)) {
        const referenceNumber = String(row[0] ?? '').trim();
        if (!referenceNumber || String(row[2] ?? '').trim() !== 'اصفهان') continue;
        records.set(referenceNumber, { referenceNumber, requestedAtText: String(row[3] ?? ''), requestDescription: String(row[4] ?? ''), status: String(row[5] ?? 'REQUESTED'), deliveryDate: String(row[6] ?? ''), deliveryNote: String(row[7] ?? ''), consumptionDate: String(row[8] ?? ''), consumptionNote: String(row[9] ?? '') });
      }
      if (!records.size) throw new Error(uiMessage(locale, 'rahcomInventoryLoadFailed'));
      if (!window.confirm(`${records.size} \u062f\u0631\u062e\u0648\u0627\u0633\u062a \u06a9\u0627\u0644\u0627 \u0627\u0632 \u0641\u0627\u06cc\u0644 \u067e\u0634\u062a\u06cc\u0628\u0627\u0646 \u0627\u0635\u0641\u0647\u0627\u0646 \u0628\u0627\u0632\u06cc\u0627\u0628\u06cc \u0634\u0648\u062f\u061f \u0645\u0631\u0627\u062d\u0644 \u062a\u06a9\u0645\u06cc\u0644\u200c\u0634\u062f\u0647 \u0642\u0628\u0644\u06cc \u062d\u0641\u0638 \u0645\u06cc\u200c\u0634\u0648\u0646\u062f.`)) return;
      const itemsByReference = new Map<string, Array<{ name: string; code?: string; quantity?: string; unit?: string; supplyType?: string; note?: string }>>();
      const deliveredByReference = new Map<string, Array<{ name: string; quantity?: string }>>();
      const consumedByReference = new Map<string, Array<{ name: string; quantity?: string }>>();
      for (const row of itemRows.slice(1)) {
        const reference = String(row[0] ?? '').trim();
        const name = String(row[1] ?? '').trim();
        if (!records.has(reference) || !name) continue;
        const items = itemsByReference.get(reference) ?? [];
        items.push({ name, code: String(row[2] ?? '').trim(), quantity: String(row[3] ?? '').trim(), unit: String(row[4] ?? '').trim(), supplyType: String(row[5] ?? '').trim(), note: String(row[6] ?? '').trim() });
        itemsByReference.set(reference, items);
        if (String(row[7] ?? '').trim()) { const stage = deliveredByReference.get(reference) ?? []; stage.push({ name, quantity: String(row[7]).trim() }); deliveredByReference.set(reference, stage); }
        if (String(row[9] ?? '').trim()) { const stage = consumedByReference.get(reference) ?? []; stage.push({ name, quantity: String(row[9]).trim() }); consumedByReference.set(reference, stage); }
      }
      for (const record of records.values()) {
        let saved = await rahcomApi.createInventoryRequest({ province: 'isfahan', referenceNumber: record.referenceNumber, requestedAtText: record.requestedAtText, requestDescription: record.requestDescription, items: itemsByReference.get(record.referenceNumber) ?? [] });
        if (saved.status === 'REQUESTED' && ['DELIVERED', 'CONSUMED'].includes(record.status) && record.deliveryDate) {
          saved = await rahcomApi.updateInventoryRequest(saved.id, { status: 'DELIVERED', deliveryDate: record.deliveryDate, deliveryNote: record.deliveryNote, deliveredItems: deliveredByReference.get(record.referenceNumber) ?? [] });
        }
        if (saved.status === 'DELIVERED' && record.status === 'CONSUMED' && record.consumptionDate) {
          await rahcomApi.updateInventoryRequest(saved.id, { status: 'CONSUMED', consumptionDate: record.consumptionDate, consumptionNote: record.consumptionNote, consumedItems: consumedByReference.get(record.referenceNumber) ?? [] });
        }
      }
      setRequests(await rahcomApi.inventoryRequests('isfahan'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : uiMessage(locale, 'rahcomInventoryLoadFailed'));
    } finally { setBackupBusy(false); }
  };

  return <section dir={getLocaleDirection(locale)} className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
    <RahcomDataListToolbar
      count={(filtered.length + filteredRequests.length) > 0 && <span role="status" aria-label={uiMessage(locale, 'rahcomInventory')} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm text-foreground"><Zap size={16} className="text-primary" aria-hidden="true"/><strong className="font-bold tabular-nums">{new Intl.NumberFormat(locale).format(filtered.length + filteredRequests.length)}</strong></span>}
      add={canManage && selectedProvince !== 'all' ? { label: uiMessage(locale, 'rahcomAdd'), onClick: () => setOpen((value) => !value) } : { label: uiMessage(locale, 'rahcomAdd'), disabled: true }}
      upload={{ label: uiMessage(locale, 'rahcomUploadExcel'), disabled: true }}
      wrap={{ label: uiMessage(locale, 'rahcomWrapLongTableText'), singleLineLabel: uiMessage(locale, 'rahcomKeepTableTextSingleLine'), pressed: wrapTableText, onToggle: () => setWrapTableText((value) => !value) }}
      download={{ label: uiMessage(locale, 'solarDownloadExcel'), onClick: downloadInventory, disabled: filtered.length === 0 }}
      search={{ value: query, onChange: setQuery, placeholder: uiMessage(locale, 'rahcomInventorySearch'), label: uiMessage(locale, 'rahcomInventory') }}
      backup={canManage && selectedProvince === 'isfahan' ? { open: backupActionsOpen, onToggle: toggleBackupActions, label: uiMessage(locale, 'rahcomSaveSystemsBackup'), controlsId: 'inventory-backup-actions', save: { label: uiMessage(locale, 'rahcomSaveSystemsBackup'), onClick: downloadRequestBackup, disabled: requests.length === 0, busy: backupBusy }, restore: { label: uiMessage(locale, 'rahcomRestoreSystemsBackup'), onClick: () => void restoreRequestBackup(), disabled: loading || backupBusy, busy: backupBusy } } : undefined}
    />
    {error && <p role="alert" className="shrink-0 rounded-xl border border-destructive/30 bg-card p-3 text-sm text-destructive">{error}</p>}
    {open && <form onSubmit={(e) => void submit(e)} className="grid shrink-0 grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-4">
        <label className="grid gap-1 text-sm">{uiMessage(locale, 'rahcomInventoryEquipment')}<input required maxLength={200} value={equipmentName} onChange={(e) => setEquipmentName(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3" placeholder="مودم SXT" /></label>
        <label className="grid gap-1 text-sm">{uiMessage(locale, 'rahcomInventorySystem')}<select required value={systemId} onChange={(e) => setSystemId(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3"><option value="">—</option>{systems.map((system) => <option key={system.id} value={system.id}>{system.systemName} ({system.systemCode})</option>)}</select></label>
        <label className="grid gap-1 text-sm">{uiMessage(locale, 'rahcomInventoryDate')}<input required type="date" value={usageDate} onChange={(e) => setUsageDate(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3" /></label>
        <button type="submit" disabled={busy} className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? <LoaderCircle size={16} className="animate-spin"/> : <Plus size={16}/>} {uiMessage(locale, 'rahcomSave')}</button>
      </form>}
    {loading && <p role="status" className="shrink-0 p-4 text-sm text-muted-foreground">{uiMessage(locale, 'reportsLoading')}</p>}
    {!loading && !error && filteredRequests.length === 0 && filtered.length === 0 && <p className="shrink-0 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{query.trim() ? uiMessage(locale, 'searchNoResults') : uiMessage(locale, 'rahcomInventoryEmpty')}</p>}
    {!loading && !error && (filteredRequests.length > 0 || filtered.length > 0) && <RahcomTableFrame className="rahcom-traffic-table-frame flex-1" viewportClassName="w-max min-w-full">
      <div className="min-w-0 space-y-4">
        <table className="w-full min-w-[1100px] border-collapse text-sm"><thead className="sticky top-0 z-10 bg-muted/90"><tr>{["\u0634\u0645\u0627\u0631\u0647 \u062f\u0631\u062e\u0648\u0627\u0633\u062a", "\u062a\u0627\u0631\u06cc\u062e \u062b\u0628\u062a", "\u0634\u0631\u062d \u062f\u0631\u062e\u0648\u0627\u0633\u062a \u0648 \u0627\u0642\u0644\u0627\u0645", "\u0648\u0636\u0639\u06cc\u062a", "\u062a\u062d\u0648\u06cc\u0644", "\u0645\u0635\u0631\u0641/\u0646\u0635\u0628", "\u0639\u0645\u0644\u06cc\u0627\u062a"].map((heading) => <th key={heading} className="border-b border-border px-3 py-3 text-start font-semibold">{heading}</th>)}</tr></thead><tbody>
          {filteredRequests.map((request) => <tr key={request.id} className="border-b border-border/70 align-top hover:bg-muted/30"><td dir="ltr" className="whitespace-nowrap px-3 py-3 font-semibold">{request.referenceNumber}</td><td className="whitespace-nowrap px-3 py-3">{request.requestedAtText}</td><td className="min-w-72 max-w-[32rem] px-3 py-3"><div className={wrapTableText ? '' : 'line-clamp-2'}>{request.requestDescription}</div><ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">{request.items.map((item, index) => <li key={index}>{item.name}{item.code ? ' (' + item.code + ')' : ''}{item.quantity ? ' | ' + item.quantity + ' ' + (item.unit ?? '') : ''}{item.supplyType ? ' | ' + item.supplyType : ''}{item.note ? ' | ' + item.note : ''}</li>)}</ul></td><td className="whitespace-nowrap px-3 py-3">{{ REQUESTED: '\u062f\u0631\u062e\u0648\u0627\u0633\u062a \u0634\u062f\u0647', DELIVERED: '\u062a\u062d\u0648\u06cc\u0644 \u0634\u062f\u0647', CONSUMED: '\u0645\u0635\u0631\u0641 \u0634\u062f\u0647' }[request.status]}</td><td className="min-w-40 px-3 py-3">{request.deliveryDate ?? '-'}{request.deliveredItems?.map((item, index) => <div key={index} className="text-xs text-muted-foreground">{item.name}: {item.quantity ?? '-'}</div>)}{request.deliveryNote && <div className="text-xs">{request.deliveryNote}</div>}</td><td className="min-w-40 px-3 py-3">{request.consumptionDate ?? '-'}{request.consumedItems?.map((item, index) => <div key={index} className="text-xs text-muted-foreground">{item.name}: {item.quantity ?? '-'}</div>)}{request.consumptionNote && <div className="text-xs">{request.consumptionNote}</div>}</td><td className="whitespace-nowrap px-3 py-3">{canManage && request.status === 'REQUESTED' && <button type="button" onClick={() => void updateRequestStage(request, 'DELIVERED')} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary">{deliveredActionLabel}</button>}{canManage && request.status === 'DELIVERED' && <button type="button" onClick={() => void updateRequestStage(request, 'CONSUMED')} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary">{consumedActionLabel}</button>}</td></tr>)}
          {filtered.length > 0 && <><tr><th colSpan={7} className="border-y border-border bg-muted/50 px-3 py-2 text-start">{'\u0645\u0635\u0631\u0641 \u062b\u0628\u062a\u200c\u0634\u062f\u0647 \u0631\u0648\u06cc \u0633\u0627\u0645\u0627\u0646\u0647\u200c\u0647\u0627'}</th></tr><tr>{[uiMessage(locale, 'rahcomInventoryEquipment'), uiMessage(locale, 'rahcomInventorySystem'), uiMessage(locale, 'rahcomInventoryDate'), ''].map((heading, index) => <th key={index} className="border-b border-border px-3 py-2 text-start font-medium">{heading}</th>)}</tr>{filtered.map((item) => <tr key={item.id} className="border-b border-border/70 hover:bg-muted/30"><td className="px-3 py-2">{item.equipmentName}</td><td className="px-3 py-2">{item.systemNameSnapshot} ({item.systemCodeSnapshot})</td><td className="whitespace-nowrap px-3 py-2">{formatJalaliDate(item.usageDate.slice(0, 10))}</td><td className="px-3 py-2 text-center">{canManage && <button type="button" onClick={() => void remove(item.id)} disabled={deletingId === item.id} aria-label={uiMessage(locale, 'rahcomDelete')} className="rounded-full p-2 text-muted-foreground hover:text-destructive">{deletingId === item.id ? <LoaderCircle size={16} className="animate-spin"/> : <Trash2 size={16}/>}</button>}</td></tr>)}</>}
        </tbody></table>
      </div>
    </RahcomTableFrame>}
  </section>;
}
