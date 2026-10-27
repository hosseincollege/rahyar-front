'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { usePreferences } from '@/components/preferences-provider';
import { projectsApi } from '@/lib/api/shared/projects-api';
import { rahcomApi } from '@/lib/api/rahcom/rahcom-api';
import { ticketApi } from '@/app/(workspace)/support/ticket-api';
import type { Ticket } from '@/app/(workspace)/support/types';
import { uiMessage } from '@/lib/ui-messages';

type ImportedNocTicket = { ticketCode: string; systemCode: string; summary: string; customer: string; equipment: string; type: string; status: string; priority: string; supportTeam: string; createdOn: string };

const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase('fa').replace(/[\s\u200c_-]/g, '');
const isIsfahanTicket = (value: (key: string) => string) => {
  const location = ['SupportTeam', 'Customer', 'Summary', 'NetworkEquipment', 'City'].map(value).join(' ');
  return normalize(location).includes(normalize('اصفهان')) || /(?:^|[^a-z])(?:isfahan|esfahan|esf)(?:[^a-z]|$)/i.test(location);
};

export function RahcomTickets() {
  const { locale } = usePreferences();
  const searchParams = useSearchParams();
  const systemFilter = searchParams.get('system')?.toLocaleLowerCase(locale) ?? '';
  const [projectId, setProjectId] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [importedTickets, setImportedTickets] = useState<ImportedNocTicket[] | null>(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [error, setError] = useState('');
  const handleExcelUpload = async (file?: File) => {
    if (!file) return;
    setError('');
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error('invalid');
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
      if (!rows.length || !['TicketCode', 'Summary', 'Project'].every((field) => field in rows[0])) throw new Error('invalid');
      const stringValue = (row: Record<string, unknown>, key: string) => String(row[key] ?? '').trim();
      const matched = rows.flatMap((row) => {
        const ticketCode = stringValue(row, 'TicketCode');
        const summary = stringValue(row, 'Summary');
        const customer = stringValue(row, 'Customer');
        const project = stringValue(row, 'Project');
        const equipment = stringValue(row, 'NetworkEquipment');
        if (!ticketCode || normalize(project) !== 'rahcom' || !isIsfahanTicket((key) => stringValue(row, key))) return [];
        const systemCode = `${summary} ${customer} ${equipment}`.match(/\b\d{3}[A-Z]\d{5}\b/i)?.[0]?.toUpperCase() ?? '';
        return [{ ticketCode, systemCode, summary, customer, equipment, type: stringValue(row, 'TicketType'), status: stringValue(row, 'Status'), priority: stringValue(row, 'Priority'), supportTeam: stringValue(row, 'SupportTeam'), createdOn: stringValue(row, 'Created On') }];
      });
      for (let offset = 0; offset < matched.length; offset += 100) {
        await rahcomApi.importTickets(file.name, matched.slice(offset, offset + 100));
      }
      setImportedTickets(matched.length ? await rahcomApi.importedTickets() : []);
      setSelectedFileName(file.name);
    } catch {
      setImportedTickets(null);
      setSelectedFileName('');
      setError(uiMessage(locale, 'rahcomTicketExcelInvalid'));
    }
  };
  useEffect(() => {
    let active = true;
    void projectsApi.getRahcomProject().then(async (project) => {
      if (!active) return;
      setProjectId(project.id);
      const rows = await ticketApi.getTickets({ projectId: project.id });
      if (active) setTickets(rows);
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : ''); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    void rahcomApi.importedTickets().then((rows) => {
      if (!active) return;
      setImportedTickets(rows.length ? rows : null);
      setSelectedFileName(rows[0]?.sourceFileName ?? '');
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : ''); });
    return () => { active = false; };
  }, []);
  return <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold text-foreground">{uiMessage(locale, 'rahcomTickets')}</h2><div className="flex flex-wrap items-center gap-2">{projectId && <Link href={`/support/new?projectId=${encodeURIComponent(projectId)}`} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{uiMessage(locale, 'supportNewTicket')}</Link>}<label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:border-primary"><Upload size={16} />{uiMessage(locale, 'rahcomUploadExcel')}<input type="file" accept=".xlsx,.xls" className="sr-only" onChange={(event) => void handleExcelUpload(event.currentTarget.files?.[0])} /></label></div></div>
    {selectedFileName && <p className="text-xs text-muted-foreground" dir="auto">{selectedFileName} · {new Intl.NumberFormat(locale).format(importedTickets?.length ?? 0)} {uiMessage(locale, 'supportTicketCount')}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {importedTickets ? importedTickets.length ? <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[900px] text-sm"><thead className="bg-muted/50"><tr>{[['rahcomTicketNumber','TicketCode'],['rahcomSystemCode','System'],['rahcomTicketSubject','Summary'],['rahcomTicketCustomer','Customer'],['rahcomTicketEquipment','NetworkEquipment'],['rahcomTicketType','TicketType'],['rahcomTicketStatus','Status'],['rahcomTicketPriority','Priority'],['rahcomTicketSupportTeam','SupportTeam'],['rahcomTicketCreatedOn','Created On']].map(([key]) => <th key={key} className="p-3 text-start">{uiMessage(locale, key as Parameters<typeof uiMessage>[1])}</th>)}</tr></thead><tbody>{importedTickets.map((ticket) => <tr key={ticket.ticketCode} className="border-t border-border"><td className="whitespace-nowrap p-3 font-mono" dir="ltr">{ticket.ticketCode || '—'}</td><td className="whitespace-nowrap p-3 font-mono" dir="ltr">{ticket.systemCode || '—'}</td><td className="min-w-64 p-3">{ticket.summary || '—'}</td><td className="p-3">{ticket.customer || '—'}</td><td className="p-3 font-mono" dir="ltr">{ticket.equipment || '—'}</td><td className="p-3">{ticket.type || '—'}</td><td className="p-3">{ticket.status || '—'}</td><td className="p-3">{ticket.priority || '—'}</td><td className="p-3">{ticket.supportTeam || '—'}</td><td className="whitespace-nowrap p-3" dir="auto">{ticket.createdOn || '—'}</td></tr>)}</tbody></table></div> : <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{uiMessage(locale, 'rahcomTicketsEmpty')}</p> : tickets.filter(ticket => !systemFilter || `${ticket.subject} ${ticket.description}`.toLocaleLowerCase(locale).includes(systemFilter)).length ? <ul className="divide-y divide-border rounded-xl border border-border">{tickets.filter(ticket => !systemFilter || `${ticket.subject} ${ticket.description}`.toLocaleLowerCase(locale).includes(systemFilter)).map(ticket => <li key={ticket.id}><Link href="/support/all" className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm hover:bg-muted/40"><span className="font-semibold text-foreground">#{ticket.ticketNumber} · {ticket.subject}</span><span className="text-muted-foreground">{ticket.status} · {ticket.priority}</span></Link></li>)}</ul> : !error && <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">{uiMessage(locale, 'searchNoResults')}</p>}
  </section>;
}
