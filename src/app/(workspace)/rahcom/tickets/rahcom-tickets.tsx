'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { usePreferences } from '@/components/preferences-provider';
import { getCurrentUser } from '@/lib/api/shared/auth-api';
import { iranProvinces, rahcomApi, type RahcomAccess, type RahcomImportedTicket, type RahcomMemberProvince } from '@/lib/api/rahcom/rahcom-api';
import { uiMessage } from '@/lib/ui-messages';

type ImportedNocTicket = Omit<RahcomImportedTicket, 'id' | 'sourceFileName' | 'importedAt'>;
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c_-]/g, '');
const provinceFromLabel = (value: string) => {
  const normalized = normalize(value.trim().replace(/^(?:\u0627\u0633\u062a\u0627\u0646\s*|province\s*:?\s*)/i, ''));
  return iranProvinces.find(([id, label]) => normalize(id) === normalized || normalize(label) === normalized)?.[0] ?? null;
};
const provinceName = (province: string | null, locale: Parameters<typeof uiMessage>[0]) =>
  province ? iranProvinces.find(([id]) => id === province)?.[1] ?? province : uiMessage(locale, 'rahcomUnassignedProvince');

export function RahcomTickets() {
  const { locale } = usePreferences();
  const searchParams = useSearchParams();
  const systemFilter = searchParams.get('system')?.toLocaleLowerCase(locale) ?? '';
  const userId = getCurrentUser()?.id;
  const storageKey = `rahyar-selected-province:${userId || 'current'}`;
  const [selectedProvince, setSelectedProvince] = useState('isfahan');
  const [importedTickets, setImportedTickets] = useState<RahcomImportedTicket[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [error, setError] = useState('');
  const [access, setAccess] = useState<RahcomAccess | null>(null);
  const [assignments, setAssignments] = useState<RahcomMemberProvince[]>([]);
  const [savingMemberId, setSavingMemberId] = useState('');
  const importedRequestId = useRef(0);

  const loadImported = useCallback(async (province: string) => {
    const requestId = ++importedRequestId.current;
    setImportedTickets(null);
    const rows = await rahcomApi.importedTickets(province);
    if (requestId !== importedRequestId.current) return;
    setImportedTickets(rows);
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
      if (result.canManageAssignments) {
        void rahcomApi.memberProvinces().then((rows) => { if (active) setAssignments(rows); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : ''); });
      }
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

  const visibleTickets = useMemo(() => (importedTickets ?? []).filter((ticket) =>
    !systemFilter || ticket.systemCode.trim().toLocaleLowerCase(locale) === systemFilter.trim()
  ), [importedTickets, locale, systemFilter]);

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
      await rahcomApi.importTickets(file.name, matched);
      await loadImported(selectedProvince);
      setSelectedFileName(file.name);
    } catch (reason) {
      setError(reason instanceof Error && !['invalid', 'invalid-province'].includes(reason.message) ? reason.message : uiMessage(locale, 'rahcomTicketExcelInvalid'));
    } finally {
      setImporting(false);
    }
  };

  const changeAssignment = async (memberId: string, province: string) => {
    setSavingMemberId(memberId);
    try {
      await rahcomApi.setMemberProvince(memberId, province || null);
      setAssignments((current) => current.map((member) => member.id === memberId ? { ...member, province: province || null } : member));
    } catch (reason) { setError(reason instanceof Error ? reason.message : ''); }
    finally { setSavingMemberId(''); }
  };

  return <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold text-foreground">{uiMessage(locale, 'rahcomTickets')}</h2><div className="flex flex-wrap items-center gap-2">{access?.canManageAssignments && <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:border-primary"><Upload size={16} />{uiMessage(locale, importing ? 'rolesUploading' : 'rahcomUploadExcel')}<input type="file" disabled={importing} accept=".xlsx,.xls" className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void handleExcelUpload(file); }} /></label>}</div></div>
    {!importedTickets && !error && <p role="status" className="p-4 text-sm text-muted-foreground">{uiMessage(locale, 'reportsLoading')}</p>}
    {selectedFileName && <p className="text-xs text-muted-foreground" dir="auto">{selectedFileName} · {new Intl.NumberFormat(locale).format(visibleTickets.length)} {uiMessage(locale, 'supportTicketCount')}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {visibleTickets.length ? <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[980px] text-sm"><thead className="bg-muted/50"><tr>{[['rahcomTicketNumber','TicketCode'],['rahcomProvince','Province'],['rahcomSystemCode','System'],['rahcomTicketSubject','Summary'],['rahcomTicketCustomer','Customer'],['rahcomTicketEquipment','NetworkEquipment'],['rahcomTicketType','TicketType'],['rahcomTicketStatus','Status'],['rahcomTicketPriority','Priority'],['rahcomTicketSupportTeam','SupportTeam'],['rahcomTicketCreatedOn','Created On']].map(([key]) => <th key={key} className="p-3 text-start">{uiMessage(locale, key as Parameters<typeof uiMessage>[1])}</th>)}</tr></thead><tbody>{visibleTickets.map((ticket) => <tr key={ticket.id} className="border-t border-border"><td className="whitespace-nowrap p-3 font-mono" dir="ltr">{ticket.ticketCode || '—'}</td><td className="whitespace-nowrap p-3">{provinceName(ticket.province, locale)}</td><td className="whitespace-nowrap p-3 font-mono" dir="ltr">{ticket.systemCode || '—'}</td><td className="min-w-64 p-3">{ticket.summary || '—'}</td><td className="p-3">{ticket.customer || '—'}</td><td className="p-3 font-mono" dir="ltr">{ticket.equipment || '—'}</td><td className="p-3">{ticket.type || '—'}</td><td className="p-3">{ticket.status || '—'}</td><td className="p-3">{ticket.priority || '—'}</td><td className="p-3">{ticket.supportTeam || '—'}</td><td className="whitespace-nowrap p-3" dir="auto">{ticket.createdOn || '—'}</td></tr>)}</tbody></table></div> : importedTickets && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{uiMessage(locale, 'rahcomTicketsEmpty')}</p>}
    {access?.canManageAssignments && <section className="space-y-3 border-t border-border pt-4"><h3 className="font-semibold text-foreground">{uiMessage(locale, 'rahcomProvinceAssignment')}</h3><div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[520px] text-sm"><thead className="bg-muted/50"><tr><th className="p-3 text-start">{uiMessage(locale, 'usersDetailName')}</th><th className="p-3 text-start">{uiMessage(locale, 'usersDetailUsername')}</th><th className="p-3 text-start">{uiMessage(locale, 'rahcomProvince')}</th></tr></thead><tbody>{assignments.map((member) => <tr key={member.id} className="border-t border-border"><td className="p-3">{member.name}</td><td dir="ltr" className="p-3 text-start">{member.username}</td><td className="p-3"><select aria-label={`${uiMessage(locale, 'rahcomProvince')}: ${member.name}`} disabled={savingMemberId === member.id} value={member.province ?? ''} onChange={(event) => void changeAssignment(member.id, event.target.value)} className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="">{uiMessage(locale, 'rahcomUnassignedProvince')}</option>{iranProvinces.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></td></tr>)}</tbody></table></div></section>}
  </section>;
}
