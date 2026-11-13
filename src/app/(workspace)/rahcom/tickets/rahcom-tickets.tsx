'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, Clock3, Download, LoaderCircle, Pencil, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { usePreferences } from '@/components/preferences-provider';
import { getCurrentUser } from '@/lib/api/shared/auth-api';
import { iranProvinces, rahcomApi, type RahcomAccess, type RahcomImportedTicket, type RahcomSystem, type RahcomTrafficSnapshot } from '@/lib/api/rahcom/rahcom-api';
import { uiMessage } from '@/lib/ui-messages';
import { useRahcomDate } from '@/app/(workspace)/rahcom/_shared/rahcom-date';
import { RahcomRecordSummary } from '@/app/(workspace)/rahcom/_shared/rahcom-record-summary';
import { RahcomInfoHeader, RahcomRowInfo } from '@/app/(workspace)/rahcom/_shared/rahcom-row-info';
import { isRahcomIncidentValue, tehranDateKey } from '@/lib/api/rahcom/solar-status';

type ImportedNocTicket = Omit<RahcomImportedTicket, 'id' | 'sourceFileName' | 'importedAt' | 'listDate' | 'description'> & { description?: string };
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
  const [trafficSnapshot, setTrafficSnapshot] = useState<RahcomTrafficSnapshot | null>(null);
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
    let active = true;
    setTrafficSnapshot(null);
    void rahcomApi.trafficSnapshot(selectedProvince, date ?? undefined)
      .then((snapshot) => { if (active) setTrafficSnapshot(snapshot); })
      .catch(() => { if (active) setTrafficSnapshot(null); });
    return () => { active = false; };
  }, [date, selectedProvince]);

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
  const trafficIncidentsByCode = useMemo(() => {
    const headers = trafficSnapshot?.headers ?? [];
    const rows = trafficSnapshot?.rows ?? [];
    const normalizedHeaders = headers.map(normalize);
    const codeIndex = normalizedHeaders.findIndex((header) => header.includes('کدسامانه') || header === 'systemcode' || header === 'stationcode');
    if (codeIndex < 0) return new Map<string, string>();
    const incidentIndexes = normalizedHeaders.flatMap((header, index) => ['سرقت', 'تخریب', 'theft', 'damage', 'تعریض', 'جابجایی', 'widening', 'relocation'].some((term) => header.includes(normalize(term))) ? [index] : []);
    const incidentsByCode = new Map<string, string>();
    for (const row of rows) {
      const code = normalize(row[codeIndex] ?? '');
      if (!code) continue;
      const incidents = incidentIndexes.flatMap((index) => {
        const value = String(row[index] ?? '').trim();
        if (!isRahcomIncidentValue(value)) return [];
        const normalizedValue = normalize(value);
        const header = normalizedHeaders[index];
        const hasTheft = normalizedValue.includes('سرقت') || normalizedValue.includes('theft') || header.includes('سرقت') || header.includes('theft');
        const hasDamage = normalizedValue.includes('تخریب') || normalizedValue.includes('damage') || header.includes('تخریب') || header.includes('damage');
        if (normalizedValue.includes('تعریض') || normalizedValue.includes('جابجایی') || normalizedValue.includes('widening') || normalizedValue.includes('relocation') || header.includes('تعریض') || header.includes('جابجایی') || header.includes('widening') || header.includes('relocation')) return [uiMessage(locale, 'solarWideningRelocation')];
        if (hasTheft && hasDamage) return [uiMessage(locale, 'rahcomIncidentBoth')];
        if (hasTheft) return [uiMessage(locale, 'rahcomIncidentTheft')];
        if (hasDamage) return [uiMessage(locale, 'rahcomIncidentDamage')];
        return [value];
      });
      if (incidents.length) incidentsByCode.set(code, [...new Set([...(incidentsByCode.get(code)?.split(' · ') ?? []), ...incidents])].join(' · '));
    }
    return incidentsByCode;
  }, [locale, trafficSnapshot]);
  useEffect(() => { onSystemCountChange(visibleSystemCount); }, [onSystemCountChange, visibleSystemCount]);
  const downloadExcel = useCallback(() => {
    if (!tableRef.current) return;
    const exportTable = tableRef.current.cloneNode(true) as HTMLTableElement;
    exportTable.querySelectorAll('tr').forEach((row) => row.cells.item(1)?.remove());
    const workbook = XLSX.utils.table_to_book(exportTable, { sheet: 'Tickets' });
    XLSX.writeFile(workbook, `rahcom-tickets-${date ?? tehranDateKey()}.xlsx`);
  }, [date]);
  useEffect(() => {
    window.addEventListener('rahyar:tickets-download-click', downloadExcel);
    return () => window.removeEventListener('rahyar:tickets-download-click', downloadExcel);
  }, [downloadExcel]);
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
      if (!rows.length) throw new Error('invalid');
      const columns = new Map(Object.keys(rows[0]).map((key) => [normalize(key), key]));
      const hasColumn = (...aliases: string[]) => aliases.some((alias) => columns.has(normalize(alias)));
      const value = (row: Record<string, unknown>, ...aliases: string[]) => {
        const key = aliases.map(normalize).map((alias) => columns.get(alias)).find(Boolean);
        return key ? String(row[key] ?? '').trim() : '';
      };
      const ticketCodeAliases = ['TicketCode', '\u0634\u0645\u0627\u0631\u0647 \u062a\u06cc\u06a9\u062a'];
      const summaryAliases = ['Summary', '\u0645\u0648\u0636\u0648\u0639 \u062a\u06cc\u06a9\u062a'];
      if (!hasColumn(...ticketCodeAliases) || !hasColumn(...summaryAliases)) throw new Error('invalid');
      const isRahcomExport = !hasColumn('Project') && hasColumn('Description', '\u062a\u0648\u0636\u06cc\u062d\u0627\u062a');
      const matched = rows.flatMap((row): ImportedNocTicket[] => {
        const ticketCode = value(row, ...ticketCodeAliases);
        const summary = value(row, ...summaryAliases);
        if (!ticketCode || (!isRahcomExport && normalize(value(row, 'Project')) !== 'rahcom')) return [];
        const customer = value(row, 'Customer', '\u0645\u0634\u062a\u0631\u06cc');
        const equipment = value(row, 'NetworkEquipment', '\u062a\u062c\u0647\u06cc\u0632 \u0634\u0628\u06a9\u0647');
        const systemCode = value(row, 'systemCode', '\u06a9\u062f \u0633\u0627\u0645\u0627\u0646\u0647') || [summary, customer, equipment].join(' ').match(/\b\d{3}[A-Z]\d{5}\b/i)?.[0]?.toUpperCase() || '';
        const sourceProvince = value(row, 'Province', '\u0627\u0633\u062a\u0627\u0646');
        const parsedProvince = provinceFromLabel(sourceProvince);
        if (sourceProvince && !parsedProvince) throw new Error('invalid-province');
        if (parsedProvince && parsedProvince !== selectedProvince) throw new Error('invalid-province');
        return [{
          ticketCode, systemCode, province: parsedProvince, summary,
          description: hasColumn('Description', '\u062a\u0648\u0636\u06cc\u062d\u0627\u062a') ? value(row, 'Description', '\u062a\u0648\u0636\u06cc\u062d\u0627\u062a') : undefined, customer, equipment,
          type: value(row, 'TicketType', '\u0646\u0648\u0639 \u062a\u06cc\u06a9\u062a'),
          status: value(row, 'Status', '\u0648\u0636\u0639\u06cc\u062a'),
          priority: value(row, 'Priority', '\u0627\u0648\u0644\u0648\u06cc\u062a'),
          supportTeam: value(row, 'SupportTeam', '\u062a\u06cc\u0645 \u067e\u0634\u062a\u06cc\u0628\u0627\u0646\u06cc'),
          createdOn: value(row, 'Created On', '\u062a\u0627\u0631\u06cc\u062e \u0627\u06cc\u062c\u0627\u062f'),
        }];
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
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3"><RahcomRecordSummary bare showRecordDate={false} showCount={false} locale={locale} source={uiMessage(locale, 'rahcomTickets')} fileName={visibleTickets[0]?.sourceFileName || selectedFileName} recordDate={date ?? tehranDateKey()} count={visibleTickets.length} savedAt={visibleTickets[0]?.importedAt} /></div>
      <div className="max-h-[calc(68vh-5rem)] overflow-auto"><table ref={tableRef} className="rahcom-sticky-table w-full min-w-[2500px] text-sm">
        <thead className="bg-muted/50"><tr><th className="w-12 min-w-12 max-w-12 p-1 text-center">{uiMessage(locale, 'rahcomRowNumber')}</th><th className="w-9 min-w-9 max-w-9 p-1 text-center"><RahcomInfoHeader /></th>{[['rahcomSystemName','Name'],['rahcomSystemCode','System'],['rahcomTicketTitle','TicketTitle'],['rahcomTicketDescription','Description'],['rahcomIncidentFilter','Incident'],['rahcomAxisCode','AxisCode'],['rahcomAxisName','AxisName'],['rahcomTicketNumber','TicketCode'],['rahcomTicketCreatedOn','Created On'],['rahcomTicketImportedAt','Imported At'],['rahcomTicketSubject','Summary'],['rahcomProvince','Province'],['rahcomTicketCustomer','Customer'],['rahcomTicketEquipment','NetworkEquipment'],['rahcomTicketType','TicketType'],['rahcomTicketStatus','TicketStatus'],['rahcomTicketPriority','TicketPriority'],['rahcomTicketSupportTeam','TicketSupportTeam']].map(([key]) => <th key={key} className={`whitespace-nowrap p-3 text-start ${key === 'rahcomTicketSubject' ? 'min-w-[560px]' : key === 'rahcomTicketDescription' ? 'w-[150px] min-w-[150px] max-w-[150px]' : ''}`}>{uiMessage(locale, key as Parameters<typeof uiMessage>[1])}</th>)}</tr></thead>
        <tbody>{visibleTickets.map((ticket, index) => {
          const system = systemsByCode.get(ticket.systemCode.trim().toLocaleUpperCase(locale));
          return <tr key={ticket.id} className="border-t border-border">
            <td className="whitespace-nowrap p-3 text-center tabular-nums">{new Intl.NumberFormat(locale).format(index + 1)}</td>
            <td className="w-9 px-1 py-1 text-center"><RahcomRowInfo title={system?.systemName || ticket.systemCode || ticket.summary} systemCode={ticket.systemCode} system={system} fields={[{ label: uiMessage(locale, 'rahcomSystemCode'), value: ticket.systemCode }, { label: uiMessage(locale, 'rahcomSystemName'), value: system?.systemName ?? '' }, { label: uiMessage(locale, 'rahcomAxisCode'), value: system?.axisCode ?? '' }, { label: uiMessage(locale, 'rahcomTicketTitle'), value: ticketTitle(ticket) }, { label: uiMessage(locale, 'rahcomTicketDescription'), value: ticket.description ?? '' }, { label: uiMessage(locale, 'rahcomIncidentFilter'), value: trafficIncidentsByCode.get(normalize(ticket.systemCode)) ?? '' }, { label: uiMessage(locale, 'rahcomTicketNumber'), value: ticket.ticketCode }, { label: uiMessage(locale, 'rahcomTicketCreatedOn'), value: ticket.createdOn }, { label: uiMessage(locale, 'rahcomTicketSubject'), value: ticket.summary }, { label: uiMessage(locale, 'rahcomProvince'), value: provinceName(ticket.province, locale) }, { label: uiMessage(locale, 'rahcomTicketCustomer'), value: ticket.customer ?? '' }, { label: uiMessage(locale, 'rahcomTicketEquipment'), value: ticket.equipment ?? '' }, { label: uiMessage(locale, 'rahcomTicketType'), value: ticket.type ?? '' }, { label: uiMessage(locale, 'rahcomTicketStatus'), value: ticket.status ?? '' }, { label: uiMessage(locale, 'rahcomTicketPriority'), value: ticket.priority ?? '' }, { label: uiMessage(locale, 'rahcomTicketSupportTeam'), value: ticket.supportTeam ?? '' }]} /></td>
            <td className="min-w-[220px] whitespace-nowrap p-3">{system?.systemName || '—'}</td>
            <td className="whitespace-nowrap p-3 font-mono" dir="ltr">{ticket.systemCode || '—'}</td>
            <td className="min-w-[120px] whitespace-nowrap p-3 font-mono" dir="ltr">{ticketTitle(ticket) || '—'}</td>
            <td className="w-[150px] max-w-[150px] p-2 align-middle">
              <button type="button" disabled={Boolean(savingDescriptionId)} onClick={() => { setDescriptionDraft(ticket.description ?? ''); setEditingDescription(false); setDescriptionTicketId(ticket.id); }} aria-label={uiMessage(locale, 'rahcomTicketDescription')} title={ticket.description || uiMessage(locale, 'rahcomTicketDescription')} className="group flex h-5 min-h-0 w-full items-center gap-2 overflow-hidden text-start text-foreground hover:text-primary disabled:opacity-50">
                <span className="line-clamp-1 min-w-0 flex-1 whitespace-nowrap">{ticket.description || '—'}</span>
              </button>
            </td>
            <td className="whitespace-nowrap p-3">{trafficIncidentsByCode.get(normalize(ticket.systemCode)) || '—'}</td>
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
      <section role="dialog" aria-modal="true" aria-labelledby="rahcom-ticket-description-title" style={{ width: 'fit-content', minWidth: 'min(20rem, calc(100vw - 2rem))', maxWidth: 'min(42rem, calc(100vw - 2rem))', opacity: 1, backdropFilter: 'none' }} className="rahcom-ticket-description-dialog relative z-[101] rounded-2xl border border-border bg-card p-3 shadow-xl sm:p-4">
        <header className="mb-2 flex items-center justify-between gap-3 border-b border-border pb-2">
          <h2 id="rahcom-ticket-description-title" className="font-semibold">{uiMessage(locale, 'rahcomTicketDescription')}</h2>
          <button type="button" disabled={Boolean(savingDescriptionId)} onClick={() => setDescriptionTicketId(null)} aria-label={uiMessage(locale, 'missionClose')} title={uiMessage(locale, 'missionClose')} className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground disabled:opacity-50"><X size={16} /></button>
        </header>
        {editingDescription ? <div className="grid gap-3">
          <textarea autoFocus rows={6} maxLength={10000} value={descriptionDraft} onChange={(event) => setDescriptionDraft(event.target.value)} aria-label={uiMessage(locale, 'rahcomTicketDescription')} className="max-h-[55vh] min-h-32 w-full resize-y rounded-xl border border-border bg-background p-3 text-start text-sm leading-6 outline-none focus:border-primary" />
          <div className="flex items-center gap-2">
            <button type="button" disabled={Boolean(savingDescriptionId)} onClick={() => void saveTicketDescription(descriptionTicket)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">{savingDescriptionId === descriptionTicket.id ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}{uiMessage(locale, 'rahcomSave')}</button>
            <button type="button" disabled={Boolean(savingDescriptionId)} onClick={() => { setDescriptionDraft(descriptionTicket.description ?? ''); setEditingDescription(false); }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm text-foreground disabled:opacity-50"><X size={15} />{uiMessage(locale, 'rahcomCancel')}</button>
          </div>
        </div> : <>
          <div dir="auto" className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-background p-3 text-start text-sm leading-6">{descriptionTicket.description || '—'}</div>
          <footer className="mt-3 flex justify-end gap-2">
            {access?.canManageAssignments && <button type="button" onClick={() => { setDescriptionDraft(descriptionTicket.description ?? ''); setEditingDescription(true); }} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"><Pencil size={15} />{uiMessage(locale, 'rahcomEdit')}</button>}
            <button type="button" onClick={() => setDescriptionTicketId(null)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm text-foreground">{uiMessage(locale, 'missionClose')}</button>
          </footer>
        </>}
      </section>
    </div>}
  </section>;
}
