'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, Clock3, Download, LoaderCircle, Pencil, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { usePreferences } from '@/components/preferences-provider';
import { getCurrentUser } from '@/lib/api/shared/auth-api';
import { iranProvinces, rahcomApi, type RahcomAccess, type RahcomImportedTicket, type RahcomSystem } from '@/lib/api/rahcom/rahcom-api';
import { uiMessage } from '@/lib/ui-messages';
import { useRahcomDate } from '@/app/(workspace)/rahcom/_shared/rahcom-date';
import { RahcomRecordSummary } from '@/app/(workspace)/rahcom/_shared/rahcom-record-summary';
import { tehranDateKey } from '@/lib/api/rahcom/solar-status';

type ImportedNocTicket = Omit<RahcomImportedTicket, 'id' | 'sourceFileName' | 'importedAt' | 'listDate' | 'description'>;
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c_-]/g, '');
const provinceFromLabel = (value: string) => {
  const normalized = normalize(value.trim().replace(/^(?:\u0627\u0633\u062a\u0627\u0646\s*|province\s*:?\s*)/i, ''));
  return iranProvinces.find(([id, label]) => normalize(id) === normalized || normalize(label) === normalized)?.[0] ?? null;
};
const provinceName = (province: string | null, locale: Parameters<typeof uiMessage>[0]) =>
  province ? iranProvinces.find(([id]) => id === province)?.[1] ?? province : uiMessage(locale, 'rahcomUnassignedProvince');
const ticketTitle = (ticket: RahcomImportedTicket) => {
  const text = `${ticket.summary} ${ticket.equipment}`.normalize('NFKC').toLocaleUpperCase()
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
  const codes = [...text.matchAll(/\b(CAM|CAMERA|RTR|ROUTER|RAD|RADAR|LTE)[\s_-]*([12])\b/g)]
    .map((match) => `${match[1].startsWith('CAM') ? 'CAM' : match[1].startsWith('RTR') || match[1] === 'ROUTER' ? 'RTR' : match[1].startsWith('RAD') ? 'RAD' : 'LTE'}-${match[2]}`);
  for (const [pattern, prefix] of [[/(?:کَم|کم|دوربین)\s*[-_ ]*(1|2|یک|دو)/g, 'CAM'], [/روتر\s*[-_ ]*(1|2|یک|دو)/g, 'RTR'], [/رادار\s*[-_ ]*(1|2|یک|دو)/g, 'RAD']] as const) {
    for (const match of text.matchAll(pattern)) codes.push(`${prefix}-${match[1] === 'یک' ? '1' : match[1] === 'دو' ? '2' : match[1]}`);
  }
  if (/\bWLP[\s_-]*2[\s_-]*P\b/.test(text)) codes.push('WLP2P');
  return [...new Set(codes)].join('، ');
};

export function RahcomTickets({ onSystemCountChange }: { onSystemCountChange: (count: number) => void }) {
  const { locale } = usePreferences();
  const { date } = useRahcomDate();
  const searchParams = useSearchParams();
  const systemFilter = searchParams.get('system')?.toLocaleLowerCase(locale) ?? '';
  const userId = getCurrentUser()?.id;
  const storageKey = `rahyar-selected-province:${userId || 'current'}`;
  const [selectedProvince, setSelectedProvince] = useState('isfahan');
  const [importedTickets, setImportedTickets] = useState<RahcomImportedTicket[] | null>(null);
  const [systems, setSystems] = useState<RahcomSystem[]>([]);
  const [importing, setImporting] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [error, setError] = useState('');
  const [access, setAccess] = useState<RahcomAccess | null>(null);
  const [descriptionTicketId, setDescriptionTicketId] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [savingDescriptionId, setSavingDescriptionId] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const importedRequestId = useRef(0);

  const loadImported = useCallback(async (province: string) => {
    const requestId = ++importedRequestId.current;
    setImportedTickets(null);
    const [rows, systemRows] = await Promise.all([rahcomApi.importedTickets(province), rahcomApi.systems(province).catch(() => [])]);
    if (requestId !== importedRequestId.current) return;
    setImportedTickets(rows);
    setSystems(systemRows);
    setSelectedFileName(rows[0]?.sourceFileName ?? '');
  }, []);

  useEffect(() => {
    setSelectedProvince(window.localStorage.getItem(storageKey) || 'isfahan');
    const onProvinceChange = (event: Event) => {
      const value = (event as CustomEvent<{ province?: string }>).detail?.province;
      if (value) setSelectedProvince(value);
    };
    const onStorage = (event: StorageEvent) => { if (event.key === storageKey) setSelectedProvince(event.newValue || 'isfahan'); };
    window.addEventListener('rahyar:province-change', onProvinceChange);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('rahyar:province-change', onProvinceChange); window.removeEventListener('storage', onStorage); };
  }, [storageKey]);

  useEffect(() => {
    let active = true;
    void rahcomApi.access().then((result) => {
      if (!active) return;
      setAccess(result);
      if (!result.isAdmin && result.province) setSelectedProvince(result.province);
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : ''); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!access) return;
    setError('');
    void loadImported(selectedProvince).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : ''); });
    return () => { active = false; importedRequestId.current++; };
  }, [access, loadImported, selectedProvince]);

  useEffect(() => {
    const openUpload = () => { if (access?.canManageAssignments && !importing) uploadInputRef.current?.click(); };
    window.addEventListener('rahyar:tickets-upload-click', openUpload);
    return () => window.removeEventListener('rahyar:tickets-upload-click', openUpload);
  }, [access?.canManageAssignments, importing]);

  const visibleTickets = useMemo(() => (importedTickets ?? []).filter((ticket) =>
    ticket.listDate.slice(0, 10) === date && (!systemFilter || ticket.systemCode.trim().toLocaleLowerCase(locale) === systemFilter.trim())
  ), [importedTickets, locale, systemFilter, date]);
  const visibleSystemCount = useMemo(() => new Set(visibleTickets.map((ticket) => ticket.systemCode.trim().toLocaleUpperCase(locale)).filter(Boolean)).size, [locale, visibleTickets]);
  const systemsByCode = useMemo(() => new Map(systems.map((system) => [system.systemCode.trim().toLocaleUpperCase(locale), system])), [locale, systems]);
  useEffect(() => { onSystemCountChange(visibleSystemCount); }, [onSystemCountChange, visibleSystemCount]);
  const downloadExcel = () => {
    if (!tableRef.current) return;
    const workbook = XLSX.utils.table_to_book(tableRef.current, { sheet: 'Tickets' });
    XLSX.writeFile(workbook, `rahcom-tickets-${date ?? tehranDateKey()}.xlsx`);
  };
  const descriptionTicket = visibleTickets.find((ticket) => ticket.id === descriptionTicketId) ?? null;
  useEffect(() => {
    if (!descriptionTicketId) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !savingDescriptionId) setDescriptionTicketId(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [descriptionTicketId, savingDescriptionId]);

  const handleExcelUpload = async (file?: File) => {
    if (!file || importing) return;
    setImporting(true);
    setError('');
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error('invalid');
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
      if (!rows.length || !['TicketCode', 'Summary', 'Project'].every((field) => field in rows[0])) throw new Error('invalid');
      const stringValue = (row: Record<string, unknown>, key: string) => String(row[key] ?? '').trim();
      const matched = rows.flatMap((row): ImportedNocTicket[] => {
        const ticketCode = stringValue(row, 'TicketCode');
        const summary = stringValue(row, 'Summary');
        const project = stringValue(row, 'Project');
        if (!ticketCode || normalize(project) !== 'rahcom') return [];
        const customer = stringValue(row, 'Customer');
        const equipment = stringValue(row, 'NetworkEquipment');
        const systemCode = `${summary} ${customer} ${equipment}`.match(/\b\d{3}[A-Z]\d{5}\b/i)?.[0]?.toUpperCase() ?? '';
        const provinceField = Object.keys(row).find((key) => normalize(key).includes('province') || normalize(key).includes('استان'));
        const sourceProvince = provinceField ? stringValue(row, provinceField) : '';
        const parsedProvince = provinceFromLabel(sourceProvince);
        if (sourceProvince && !parsedProvince) throw new Error('invalid-province');
        const province = sourceProvince
          ? parsedProvince
          : null;
        return [{ ticketCode, systemCode, province, summary, customer, equipment, type: stringValue(row, 'TicketType'), status: stringValue(row, 'Status'), priority: stringValue(row, 'Priority'), supportTeam: stringValue(row, 'SupportTeam'), createdOn: stringValue(row, 'Created On') }];
      });
      if (!matched.length || matched.length > 10000) throw new Error('invalid');
      await rahcomApi.importTickets(file.name, selectedProvince, date ?? tehranDateKey(), matched);
      await loadImported(selectedProvince);
      setSelectedFileName(file.name);
    } catch (reason) {
      setError(reason instanceof Error && !['invalid', 'invalid-province'].includes(reason.message) ? reason.message : uiMessage(locale, 'rahcomTicketExcelInvalid'));
    } finally {
      setImporting(false);
    }
  };

  const saveTicketDescription = async (ticket: RahcomImportedTicket) => {
    if (savingDescriptionId) return;
    setSavingDescriptionId(ticket.id);
    setError('');
    try {
      const updated = await rahcomApi.updateImportedTicketDescription(ticket.id, descriptionDraft);
      setImportedTickets((current) => current?.map((row) => row.id === updated.id ? updated : row) ?? null);
      setEditingDescription(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : uiMessage(locale, 'rahcomTicketDescriptionSaveFailed'));
    } finally {
      setSavingDescriptionId(null);
    }
  };

  const formatImportedAt = (value: string) => {
    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) return '—';
    return new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR-u-ca-persian' : locale, {
      dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23', timeZone: 'Asia/Tehran',
    }).format(timestamp);
  };

  return <section className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
    <input ref={uploadInputRef} type="file" disabled={importing} accept=".xlsx,.xls" className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void handleExcelUpload(file); }} />
    {importing && <p role="status" className="shrink-0 text-sm text-muted-foreground">{uiMessage(locale, 'rolesUploading')}</p>}
    {!importedTickets && !error && <p role="status" className="shrink-0 p-4 text-sm text-muted-foreground">{uiMessage(locale, 'reportsLoading')}</p>}
    {error && <p role="alert" className="shrink-0 text-sm text-destructive">{error}</p>}
    {visibleTickets.length ? <div className="flex max-h-[68vh] min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3"><RahcomRecordSummary bare showRecordDate={false} showCount={false} locale={locale} source={uiMessage(locale, 'rahcomTickets')} fileName={visibleTickets[0]?.sourceFileName || selectedFileName} recordDate={date ?? tehranDateKey()} count={visibleTickets.length} savedAt={visibleTickets[0]?.importedAt} /><button type="button" onClick={downloadExcel} aria-label={uiMessage(locale, 'solarDownloadExcel')} title={uiMessage(locale, 'solarDownloadExcel')} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary"><Download size={16} /></button></div>
      <div className="max-h-[calc(68vh-5rem)] overflow-auto"><table ref={tableRef} className="rahcom-sticky-table w-full min-w-[2500px] text-sm">
        <thead className="bg-muted/50"><tr>{[['rahcomRowNumber','Row'],['rahcomSystemName','Name'],['rahcomSystemCode','System'],['rahcomTicketTitle','TicketTitle'],['rahcomTicketDescription','Description'],['rahcomAxisCode','AxisCode'],['rahcomAxisName','AxisName'],['rahcomTicketNumber','TicketCode'],['rahcomTicketCreatedOn','Created On'],['rahcomTicketImportedAt','Imported At'],['rahcomTicketSubject','Summary'],['rahcomProvince','Province'],['rahcomTicketCustomer','Customer'],['rahcomTicketEquipment','NetworkEquipment'],['rahcomTicketType','TicketType'],['rahcomTicketStatus','TicketStatus'],['rahcomTicketPriority','TicketPriority'],['rahcomTicketSupportTeam','TicketSupportTeam']].map(([key]) => <th key={key} className={`whitespace-nowrap p-3 text-start ${key === 'rahcomTicketSubject' ? 'min-w-[560px]' : key === 'rahcomTicketDescription' ? 'w-[150px] min-w-[150px] max-w-[150px]' : ''}`}>{uiMessage(locale, key as Parameters<typeof uiMessage>[1])}</th>)}</tr></thead>
        <tbody>{visibleTickets.map((ticket, index) => {
          const system = systemsByCode.get(ticket.systemCode.trim().toLocaleUpperCase(locale));
          return <tr key={ticket.id} className="border-t border-border">
            <td className="whitespace-nowrap p-3 text-center tabular-nums">{new Intl.NumberFormat(locale).format(index + 1)}</td>
            <td className="min-w-[220px] whitespace-nowrap p-3">{system?.systemName || '—'}</td>
            <td className="whitespace-nowrap p-3 font-mono" dir="ltr">{ticket.systemCode || '—'}</td>
            <td className="min-w-[120px] whitespace-nowrap p-3 font-mono" dir="ltr">{ticketTitle(ticket) || '—'}</td>
            <td className="w-[150px] max-w-[150px] p-2 align-middle">
              <button type="button" disabled={Boolean(savingDescriptionId)} onClick={() => { setDescriptionDraft(ticket.description ?? ''); setEditingDescription(false); setDescriptionTicketId(ticket.id); }} aria-label={uiMessage(locale, 'rahcomTicketDescription')} title={ticket.description || uiMessage(locale, 'rahcomTicketDescription')} className="group flex h-5 min-h-0 w-full items-center gap-2 overflow-hidden text-start text-foreground hover:text-primary disabled:opacity-50">
                <span className="line-clamp-1 min-w-0 flex-1 whitespace-nowrap">{ticket.description || '—'}</span>
                {access?.canManageAssignments && <Pencil size={14} className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />}
              </button>
            </td>
            <td className="whitespace-nowrap p-3 font-mono" dir="ltr">{system?.axisCode || '—'}</td>
            <td className="min-w-[180px] whitespace-nowrap p-3">{system?.announcedAxis || '—'}</td>
            <td className="whitespace-nowrap p-3 font-mono" dir="ltr">{ticket.ticketCode || '—'}</td>
            <td className="whitespace-nowrap p-3" dir="auto">{ticket.createdOn || '—'}</td>
            <td className="whitespace-nowrap p-3"><span className="inline-flex items-center gap-1.5"><Clock3 size={14} className="text-muted-foreground" />{formatImportedAt(ticket.importedAt)}</span></td>
            <td className="min-w-[560px] whitespace-nowrap p-3">{ticket.summary || '—'}</td>
            <td className="whitespace-nowrap p-3">{provinceName(ticket.province, locale)}</td>
            <td className="min-w-[180px] whitespace-nowrap p-3">{ticket.customer || '—'}</td>
            <td className="min-w-[240px] whitespace-nowrap p-3 font-mono" dir="ltr">{ticket.equipment || '—'}</td>
            <td className="whitespace-nowrap p-3">{ticket.type || '—'}</td>
            <td className="whitespace-nowrap p-3">{ticket.status || '—'}</td>
            <td className="whitespace-nowrap p-3">{ticket.priority || '—'}</td>
            <td className="min-w-[220px] whitespace-nowrap p-3">{ticket.supportTeam || '—'}</td>
          </tr>;
        })}</tbody>
      </table></div>
    </div> : importedTickets && <p className="shrink-0 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{uiMessage(locale, 'rahcomTicketsEmpty')}</p>}
    {descriptionTicket && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-transparent p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingDescriptionId) setDescriptionTicketId(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="rahcom-ticket-description-title" className="w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-xl sm:p-5">
        <header className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
          <h2 id="rahcom-ticket-description-title" className="font-semibold">{uiMessage(locale, 'rahcomTicketDescription')}</h2>
          <button type="button" disabled={Boolean(savingDescriptionId)} onClick={() => setDescriptionTicketId(null)} aria-label={uiMessage(locale, 'missionClose')} title={uiMessage(locale, 'missionClose')} className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground disabled:opacity-50"><X size={16} /></button>
        </header>
        {editingDescription ? <div className="grid gap-3">
          <textarea autoFocus rows={8} maxLength={10000} value={descriptionDraft} onChange={(event) => setDescriptionDraft(event.target.value)} aria-label={uiMessage(locale, 'rahcomTicketDescription')} className="max-h-[55vh] min-h-40 w-full resize-y rounded-xl border border-border bg-background p-3 text-start text-sm leading-7 outline-none focus:border-primary" />
          <div className="flex items-center gap-2">
            <button type="button" disabled={Boolean(savingDescriptionId)} onClick={() => void saveTicketDescription(descriptionTicket)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">{savingDescriptionId === descriptionTicket.id ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}{uiMessage(locale, 'rahcomSave')}</button>
            <button type="button" disabled={Boolean(savingDescriptionId)} onClick={() => { setDescriptionDraft(descriptionTicket.description ?? ''); setEditingDescription(false); }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm text-foreground disabled:opacity-50"><X size={15} />{uiMessage(locale, 'rahcomCancel')}</button>
          </div>
        </div> : <>
          <div dir="auto" className="max-h-[55vh] min-h-20 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-background p-3 text-start text-sm leading-7">{descriptionTicket.description || '—'}</div>
          <footer className="mt-4 flex justify-end gap-2">
            {access?.canManageAssignments && <button type="button" onClick={() => { setDescriptionDraft(descriptionTicket.description ?? ''); setEditingDescription(true); }} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"><Pencil size={15} />{uiMessage(locale, 'rahcomEdit')}</button>}
            <button type="button" onClick={() => setDescriptionTicketId(null)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm text-foreground">{uiMessage(locale, 'missionClose')}</button>
          </footer>
        </>}
      </section>
    </div>}
  </section>;
}
