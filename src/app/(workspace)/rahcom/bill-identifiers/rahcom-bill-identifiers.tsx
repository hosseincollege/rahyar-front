'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Link, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { usePreferences, getLocaleDirection } from '@/components/preferences-provider';
import { getAccessToken } from '@/lib/api-client';
import { rahcomApi, type RahcomSystem } from '@/lib/api/rahcom/rahcom-api';
import { uiMessage } from '@/lib/ui-messages';

type BillWorkbook = { headers: string[]; rows: string[][] };
type ExternalSystemType = 'USO' | 'VSAT';
type ExternalSystemAssignment = { type: ExternalSystemType; code: string; name: string };
const splitSystemCodes = (value: string | undefined) => (value ?? '').split(/[;,،|]/).map((code) => code.trim()).filter(Boolean);
const parseExternalSystem = (value: string): ExternalSystemAssignment | null => {
  const match = value.match(/^EXTERNAL:(USO|VSAT):([^:]*):([^:]*)$/);
  if (!match) return null;
  try { return { type: match[1] as ExternalSystemType, code: decodeURIComponent(match[2]), name: decodeURIComponent(match[3]) }; }
  catch { return null; }
};
const serializeExternalSystem = (system: ExternalSystemAssignment) => `EXTERNAL:${system.type}:${encodeURIComponent(system.code.trim())}:${encodeURIComponent(system.name.trim())}`;
const externalSystemsFromCell = (value: string | undefined) => splitSystemCodes(value).map(parseExternalSystem).filter((system): system is ExternalSystemAssignment => Boolean(system));
const normalizeBillHeader = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa')
  .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c]/g, '').replace(/[\/\\_-]/g, '');
const normalizeSearchText = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa')
  .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c\u200f\-–—،,.\/]+/g, '');

export function RahcomBillIdentifiers() {
  const { locale } = usePreferences();
  const direction = getLocaleDirection(locale);
  const [workbook, setWorkbook] = useState<BillWorkbook | null>(null);
  const [systems, setSystems] = useState<RahcomSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([]);
  const [assignmentQuery, setAssignmentQuery] = useState('');
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [assignmentError, setAssignmentError] = useState('');
  const [addingBill, setAddingBill] = useState(false);
  const [newBillIdentifier, setNewBillIdentifier] = useState('');
  const [newBillSystemIds, setNewBillSystemIds] = useState<string[]>([]);
  const [newBillSystemQuery, setNewBillSystemQuery] = useState('');
  const [newBillFields, setNewBillFields] = useState<Record<string, string>>({});
  const [newExternalDraft, setNewExternalDraft] = useState<ExternalSystemAssignment>({ type: 'USO', code: '', name: '' });
  const [newExternalSystems, setNewExternalSystems] = useState<ExternalSystemAssignment[]>([]);
  const [savingNewBill, setSavingNewBill] = useState(false);
  const [addBillError, setAddBillError] = useState('');
  const [editingRecordIndex, setEditingRecordIndex] = useState<number | null>(null);
  const [editingBillFields, setEditingBillFields] = useState<Record<string, string>>({});
  const [editingBillSystemIds, setEditingBillSystemIds] = useState<string[]>([]);
  const [editingExternalDraft, setEditingExternalDraft] = useState<ExternalSystemAssignment>({ type: 'USO', code: '', name: '' });
  const [editingExternalSystems, setEditingExternalSystems] = useState<ExternalSystemAssignment[]>([]);
  const [editingBillSystemQuery, setEditingBillSystemQuery] = useState('');
  const [savingRecordEdit, setSavingRecordEdit] = useState(false);
  const [recordEditError, setRecordEditError] = useState('');
  const [deletingRowIndex, setDeletingRowIndex] = useState<number | null>(null);
  const [deletingBillIdentifier, setDeletingBillIdentifier] = useState('');
  const [deletingRecord, setDeletingRecord] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      const token = getAccessToken();
      if (!token) {
        if (active) setLoading(false);
        return;
      }
      try {
        const response = await fetch('/api/rahcom/bill-identifiers', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Workbook unavailable');
        const data = await response.json() as BillWorkbook;
        if (active) setWorkbook(data);
      } catch {
        if (active) setWorkbook({ headers: [], rows: [] });
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void rahcomApi.systems().then((data) => {
      if (active) setSystems(data);
    }).catch(() => {
      if (active) setSystems([]);
    });
    return () => { active = false; };
  }, []);

  const systemCodeIndex = useMemo(() => workbook?.headers.findIndex((header) =>
    ['کد سامانه', 'کد سیستم'].some((alias) => normalizeBillHeader(alias) === normalizeBillHeader(header)),
  ) ?? -1, [workbook]);
  const billIdentifierIndex = useMemo(() => workbook?.headers.findIndex((header) =>
    ['\u0634\u0646\u0627\u0633\u0647 \u0642\u0628\u0636', '\u0634\u0646\u0627\u0633\u0647 \u0642\u0628\u0636 \u0628\u0631\u0642'].some((alias) => normalizeBillHeader(alias) === normalizeBillHeader(header)),
  ) ?? -1, [workbook]);
  const rowNumberIndex = useMemo(() => workbook?.headers.findIndex((header) => normalizeBillHeader(header) === normalizeBillHeader('\u0631\u062f\u06cc\u0641')) ?? -1, [workbook]);
  const registeredDateIndex = useMemo(() => workbook?.headers.findIndex((header) => normalizeBillHeader(header) === normalizeBillHeader('\u062a\u0627\u0631\u06cc\u062e \u062b\u0628\u062a')) ?? -1, [workbook]);
  const systemNameByCode = useMemo(() => new Map(systems.map((system) => [
    system.systemCode.normalize('NFKC').trim().toUpperCase(), system.systemName,
  ])), [systems]);
  const assignmentOptions = useMemo(() => {
    const normalized = assignmentQuery.trim().toLocaleLowerCase(locale);
    return systems.filter((system) => !normalized || `${system.systemCode} ${system.systemName}`.toLocaleLowerCase(locale).includes(normalized)).slice(0, 30);
  }, [assignmentQuery, locale, systems]);
  const newBillSystemOptions = useMemo(() => {
    const normalized = newBillSystemQuery.trim().toLocaleLowerCase(locale);
    return systems.filter((system) => !normalized || `${system.systemCode} ${system.systemName}`.toLocaleLowerCase(locale).includes(normalized)).slice(0, 30);
  }, [locale, newBillSystemQuery, systems]);
  const getCellValue = useCallback((row: string[], columnIndex: number) => {
    if (columnIndex === -1) {
      return splitSystemCodes(systemCodeIndex >= 0 ? row[systemCodeIndex] : undefined)
        .map((code) => parseExternalSystem(code)?.name || systemNameByCode.get(code.toUpperCase())).filter(Boolean).join('\n');
    }
    if (columnIndex === systemCodeIndex) return splitSystemCodes(row[columnIndex]).map((code) => {
      const external = parseExternalSystem(code);
      return external ? `${external.type} - ${external.code}` : code;
    }).join('\n');
    if (columnIndex === registeredDateIndex && /^\d{4}-\d{2}-\d{2}$/.test(row[columnIndex] ?? '')) {
      const date = new Date(`${row[columnIndex]}T12:00:00Z`);
      return new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR-u-ca-persian' : locale, { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }).format(date);
    }
    return row[columnIndex] || '';
  }, [locale, registeredDateIndex, systemCodeIndex, systemNameByCode]);

  const rows = useMemo(() => {
    const billIdentifierIndex = workbook?.headers.findIndex((header) =>
      ['شناسه قبض', 'شناسه قبض برق'].some((alias) => normalizeBillHeader(alias) === normalizeBillHeader(header)),
    ) ?? -1;
    const rowNumberIndex = workbook?.headers.findIndex((header) => normalizeBillHeader(header) === normalizeBillHeader('ردیف')) ?? -1;
    const visibleRows = (workbook?.rows ?? []).filter((row) => {
      if (billIdentifierIndex < 0) return true;
      const billIdentifier = (row[billIdentifierIndex] ?? '').trim().replace(/[۰-۹٠-٩]/g, (digit) => {
        const code = digit.charCodeAt(0);
        return String(code >= 0x06f0 && code <= 0x06f9 ? code - 0x06f0 : code - 0x0660);
      });
      const has402BillIdWithNoDetails = billIdentifier.startsWith('402') && row.every((value, index) =>
        index === billIdentifierIndex || index === rowNumberIndex || !value.trim(),
      );
      return !has402BillIdWithNoDetails;
    });
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return visibleRows;
    return visibleRows.filter((row) => row.some((value) => normalizeSearchText(value).includes(normalizedQuery))
      || normalizeSearchText(getCellValue(row, -1)).includes(normalizedQuery));
  }, [getCellValue, locale, query, workbook]);
  const displayColumns = useMemo(() => {
    if (!workbook) return [];
    const orderedAliases = [
      ['کد سامانه', 'کد سیستم'],
      ['شناسه قبض', 'شناسه قبض برق'],
      ['آدرس انشعاب'],
      ['منطقه امور', 'منطقه / امور'],
      ['نام مشترک'],
      ['وضعیت بررسی'],
      ['تاریخ ثبت'],
    ].map((aliases) => aliases.map(normalizeBillHeader));
    const dataColumns = orderedAliases.flatMap((aliases) => {
      const index = workbook.headers.findIndex((header) => aliases.includes(normalizeBillHeader(header)));
      return index < 0 ? [] : [{ index, header: workbook.headers[index] }];
    });
    const rowNumber = workbook.headers.findIndex((header) => normalizeBillHeader(header) === normalizeBillHeader('ردیف'));
    const systemCode = dataColumns.find((column) => column.index === systemCodeIndex);
    const billId = dataColumns.find((column) => ['شناسه قبض', 'شناسه قبض برق'].some((alias) => normalizeBillHeader(alias) === normalizeBillHeader(column.header)));
    const meterBodyIndex = workbook.headers.findIndex((header) => normalizeBillHeader(header) === normalizeBillHeader('\u0634\u0645\u0627\u0631\u0647 \u0628\u062f\u0646\u0647 \u06a9\u0646\u062a\u0648\u0631'));
    const meterBody = meterBodyIndex >= 0 ? { index: meterBodyIndex, header: workbook.headers[meterBodyIndex] } : undefined;
    return [
      ...(rowNumber >= 0 ? [{ index: rowNumber, header: workbook.headers[rowNumber] }] : []),
      { index: -2, header: '\u0639\u0645\u0644\u06cc\u0627\u062a' },
      { index: -1, header: uiMessage(locale, 'rahcomSystemName') },
      ...(systemCode ? [systemCode] : []),
      ...(billId ? [billId] : []),
      ...(meterBody ? [meterBody] : []),
      ...dataColumns.filter((column) => column !== systemCode && column !== billId && column !== meterBody),
    ];
  }, [locale, systemCodeIndex, workbook]);
  const editableAddColumns = useMemo(() => displayColumns.filter((column) =>
    column.index >= 0 && column.index !== rowNumberIndex && column.index !== systemCodeIndex && column.index !== billIdentifierIndex && column.index !== registeredDateIndex,
  ), [billIdentifierIndex, displayColumns, registeredDateIndex, rowNumberIndex, systemCodeIndex]);
  const editableRecordColumns = useMemo(() => displayColumns.filter((column) =>
    column.index >= 0 && column.index !== rowNumberIndex && column.index !== systemCodeIndex && column.index !== registeredDateIndex,
  ), [displayColumns, registeredDateIndex, rowNumberIndex, systemCodeIndex]);

  const persistAssignment = async (systemCodes: string[]) => {
    if (editingRowIndex === null) return;
    setSavingAssignment(true);
    setAssignmentError('');
    try {
      const token = getAccessToken();
      if (!token) throw new Error('unauthorized');
      const response = await fetch('/api/rahcom/bill-identifiers', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: editingRowIndex, systemCodes }),
      });
      if (!response.ok) throw new Error('assignment_failed');
      setWorkbook((current) => current ? {
        ...current,
        rows: current.rows.map((row, index) => index === editingRowIndex
          ? row.map((value, columnIndex) => columnIndex === systemCodeIndex ? systemCodes.join(';') : value)
          : row),
      } : current);
      setEditingRowIndex(null);
      setAssignmentQuery('');
    } catch {
      setAssignmentError('\u0630\u062e\u06cc\u0631\u0647\u200c\u0633\u0627\u0632\u06cc \u0627\u0646\u062a\u0633\u0627\u0628 \u062f\u0631 \u0641\u0627\u06cc\u0644 \u0627\u06a9\u0633\u0644 \u0627\u0646\u062c\u0627\u0645 \u0646\u0634\u062f.');
    } finally {
      setSavingAssignment(false);
    }
  };

  const saveAssignment = () => {
    const systemCodes = selectedAssignmentIds
      .map((id) => systems.find((system) => system.id === id)?.systemCode)
      .filter((code): code is string => Boolean(code));
    const externalCodes = editingRowIndex === null ? [] : externalSystemsFromCell(workbook?.rows[editingRowIndex]?.[systemCodeIndex]).map(serializeExternalSystem);
    return persistAssignment([...systemCodes, ...externalCodes]);
  };

  const addBillIdentifier = async () => {
    const billIdentifier = newBillIdentifier.trim();
    if (!billIdentifier) return;
    setSavingNewBill(true);
    setAddBillError('');
    try {
      const token = getAccessToken();
      if (!token) throw new Error('unauthorized');
      const systemCodes = newBillSystemIds
        .map((id) => systems.find((system) => system.id === id)?.systemCode)
        .filter((code): code is string => Boolean(code))
        .concat(newExternalSystems.map(serializeExternalSystem));
      const fields = Object.fromEntries(editableAddColumns.map(({ header, index }) => [header, newBillFields[header] ?? '']));
      const response = await fetch('/api/rahcom/bill-identifiers', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ billIdentifier, systemCodes, fields }),
      });
      const result = await response.json() as { row?: string[]; error?: string };
      if (!response.ok || !result.row) {
        if (result.error === 'duplicate_bill_identifier') throw new Error('duplicate');
        throw new Error('save_failed');
      }
      setWorkbook((current) => current ? { ...current, rows: [...current.rows, result.row!] } : current);
      setQuery('');
      setNewBillIdentifier('');
      setNewBillSystemIds([]);
      setNewBillSystemQuery('');
      setNewBillFields({});
      setNewExternalDraft({ type: 'USO', code: '', name: '' });
      setNewExternalSystems([]);
      setAddingBill(false);
    } catch (error) {
      setAddBillError(error instanceof Error && error.message === 'duplicate'
        ? '\u0627\u06cc\u0646 \u0634\u0646\u0627\u0633\u0647 \u0642\u0628\u0636 \u0642\u0628\u0644\u0627\u064b \u062b\u0628\u062a \u0634\u062f\u0647 \u0627\u0633\u062a.'
        : '\u0630\u062e\u06cc\u0631\u0647\u200c\u0633\u0627\u0632\u06cc \u0631\u06a9\u0648\u0631\u062f \u062f\u0631 \u0641\u0627\u06cc\u0644 \u0627\u06a9\u0633\u0644 \u0627\u0646\u062c\u0627\u0645 \u0646\u0634\u062f.');
    } finally {
      setSavingNewBill(false);
    }
  };

  const saveRecordEdit = async () => {
    if (editingRecordIndex === null) return;
    setSavingRecordEdit(true);
    setRecordEditError('');
    try {
      const token = getAccessToken();
      if (!token) throw new Error('unauthorized');
      const systemCodes = editingBillSystemIds
        .map((id) => systems.find((system) => system.id === id)?.systemCode)
        .filter((code): code is string => Boolean(code))
        .concat(editingExternalSystems.map(serializeExternalSystem));
      const response = await fetch('/api/rahcom/bill-identifiers', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: editingRecordIndex, systemCodes, fields: editingBillFields }),
      });
      const result = await response.json() as { row?: string[] };
      if (!response.ok || !result.row) throw new Error('edit_failed');
      setWorkbook((current) => current ? {
        ...current,
        rows: current.rows.map((row, index) => index === editingRecordIndex
          ? current.headers.map((_, columnIndex) => result.row?.[columnIndex] ?? '')
          : row),
      } : current);
      setEditingRecordIndex(null);
      setEditingBillFields({});
    } catch {
      setRecordEditError('\u0630\u062e\u06cc\u0631\u0647\u200c\u0633\u0627\u0632\u06cc \u062a\u063a\u06cc\u06cc\u0631\u0627\u062a \u062f\u0631 \u0641\u0627\u06cc\u0644 \u0627\u06a9\u0633\u0644 \u0627\u0646\u062c\u0627\u0645 \u0646\u0634\u062f.');
    } finally {
      setSavingRecordEdit(false);
    }
  };

  const openRecordEditor = (row: string[]) => {
    const recordIndex = workbook?.rows.indexOf(row) ?? -1;
    const storedAssignments = splitSystemCodes(systemCodeIndex >= 0 ? row[systemCodeIndex] : undefined);
    setEditingRecordIndex(recordIndex);
    setEditingBillFields(Object.fromEntries(editableRecordColumns.map(({ header, index }) => [header, row[index] ?? ''])));
    setEditingBillSystemIds(systems.filter((system) => storedAssignments.some((code) =>
      !parseExternalSystem(code) && code.toUpperCase() === system.systemCode.normalize('NFKC').trim().toUpperCase(),
    )).map((system) => system.id));
    setEditingExternalSystems(externalSystemsFromCell(systemCodeIndex >= 0 ? row[systemCodeIndex] : undefined));
    setEditingExternalDraft({ type: 'USO', code: '', name: '' });
    setEditingBillSystemQuery('');
    setRecordEditError('');
  };

  const openAssignmentEditor = (row: string[]) => {
    const storedCodes = splitSystemCodes(systemCodeIndex >= 0 ? row[systemCodeIndex] : undefined)
      .filter((code) => !parseExternalSystem(code)).map((code) => code.toUpperCase());
    setEditingRowIndex(workbook?.rows.indexOf(row) ?? -1);
    setSelectedAssignmentIds(systems.filter((system) => storedCodes.includes(system.systemCode.normalize('NFKC').trim().toUpperCase())).map((system) => system.id));
    setAssignmentQuery('');
    setAssignmentError('');
  };

  const downloadDisplayedTable = () => {
    const exportColumns = displayColumns.filter(({ index }) => index !== -2);
    const exportHeaders = exportColumns.map(({ header }) => header);
    const exportRows = rows.map((row) => exportColumns.map(({ index }) => getCellValue(row, index)));
    const worksheet = XLSX.utils.aoa_to_sheet([exportHeaders, ...exportRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'شناسه قبض');
    XLSX.writeFile(workbook, `bill-identifiers-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const deleteBillIdentifier = async () => {
    if (deletingRowIndex === null) return;
    setDeletingRecord(true);
    setDeleteError('');
    try {
      const token = getAccessToken();
      if (!token) throw new Error('unauthorized');
      const response = await fetch('/api/rahcom/bill-identifiers', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: deletingRowIndex }),
      });
      if (!response.ok) throw new Error('delete_failed');
      setWorkbook((current) => current ? {
        ...current,
        rows: current.rows.filter((_, index) => index !== deletingRowIndex).map((row, index) => rowNumberIndex >= 0
          ? row.map((value, columnIndex) => columnIndex === rowNumberIndex ? String(index + 1) : value)
          : row),
      } : current);
      setDeletingRowIndex(null);
      setDeletingBillIdentifier('');
    } catch {
      setDeleteError('\u062d\u0630\u0641 \u0631\u06a9\u0648\u0631\u062f \u0627\u0632 \u0641\u0627\u06cc\u0644 \u0627\u06a9\u0633\u0644 \u0627\u0646\u062c\u0627\u0645 \u0646\u0634\u062f.');
    } finally {
      setDeletingRecord(false);
    }
  };

  return <section dir={direction} className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
    <header className="rahcom-page-toolbar flex shrink-0 flex-wrap items-center justify-start gap-3">
      <button type="button" onClick={() => { setAddBillError(''); setNewBillIdentifier(''); setNewBillSystemIds([]); setNewBillSystemQuery(''); setNewBillFields({}); setNewExternalSystems([]); setNewExternalDraft({ type: 'USO', code: '', name: '' }); setAddingBill(true); }} aria-label={'\u0627\u0641\u0632\u0648\u062f\u0646 \u0634\u0646\u0627\u0633\u0647 \u0642\u0628\u0636'} title={'\u0627\u0641\u0632\u0648\u062f\u0646 \u0634\u0646\u0627\u0633\u0647 \u0642\u0628\u0636'} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary"><Plus size={18} /></button>
      <label className="rahcom-search-capsule relative block w-full max-w-[15rem] rounded-full">
        <Search aria-hidden="true" size={17} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={uiMessage(locale, 'headerSearch')} aria-label={uiMessage(locale, 'rahcomBillIdentifiersSearch')} className="h-9 w-full rounded-full border border-border bg-background ps-9 pe-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary" />
      </label>
      <button type="button" onClick={downloadDisplayedTable} aria-label={uiMessage(locale, 'solarDownloadExcel')} title={uiMessage(locale, 'solarDownloadExcel')} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary"><Download size={17} aria-hidden="true" /></button>
    </header>
    {loading && <p role="status" className="shrink-0 p-4 text-sm text-muted-foreground">{uiMessage(locale, 'reportsLoading')}</p>}
    {!loading && !workbook?.headers.length && <p role="alert" className="shrink-0 rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{uiMessage(locale, 'rahcomBillIdentifiersLoadFailed')}</p>}
    {!loading && workbook?.headers.length && rows.length === 0 && <p className="shrink-0 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{query ? uiMessage(locale, 'searchNoResults') : uiMessage(locale, 'rahcomBillIdentifiersEmpty')}</p>}
    {!loading && workbook?.headers.length && rows.length > 0 && <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-card">
      <div className="min-h-full w-max min-w-full">
        <table className="rahcom-sticky-table rahcom-bill-identifiers-table w-full min-w-max text-sm">
          <thead className="bg-muted/50"><tr>{displayColumns.map(({ header, index }) => <th key={`${header}-${index}`} scope="col" className="whitespace-nowrap p-2 text-start">{header || '—'}</th>)}</tr></thead>
          <tbody>{rows.map((row, rowIndex) => <tr key={`${row[0] || 'bill'}-${rowIndex}`} className="border-t border-border">
            {displayColumns.map(({ header, index: columnIndex }) => {
              if (columnIndex === -2) return <td key={`${header}-${columnIndex}`} className="whitespace-nowrap p-2"><div className="flex items-center gap-1">
                <button type="button" onClick={() => openAssignmentEditor(row)} aria-label={'\u0648\u06cc\u0631\u0627\u06cc\u0634 \u0627\u0646\u062a\u0633\u0627\u0628 \u06a9\u062f \u0633\u0627\u0645\u0627\u0646\u0647'} title={'\u0648\u06cc\u0631\u0627\u06cc\u0634 \u0627\u0646\u062a\u0633\u0627\u0628 \u06a9\u062f \u0633\u0627\u0645\u0627\u0646\u0647'} className="inline-grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><Link size={14} /></button>
                <button type="button" onClick={() => openRecordEditor(row)} aria-label={'\u0648\u06cc\u0631\u0627\u06cc\u0634 \u0631\u06a9\u0648\u0631\u062f'} title={'\u0648\u06cc\u0631\u0627\u06cc\u0634 \u0631\u06a9\u0648\u0631\u062f'} className="inline-grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><Pencil size={14} /></button>
                <button type="button" onClick={() => { setDeletingRowIndex(workbook.rows.indexOf(row)); setDeletingBillIdentifier(row[billIdentifierIndex] ?? ''); setDeleteError(''); }} aria-label={'\u062d\u0630\u0641 \u0631\u06a9\u0648\u0631\u062f'} title={'\u062d\u0630\u0641 \u0631\u06a9\u0648\u0631\u062f'} className="inline-grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><Trash2 size={14} /></button>
              </div></td>;
              const value = getCellValue(row, columnIndex);
              const isCode = columnIndex === systemCodeIndex;
              const isSystemAssignment = isCode || columnIndex === -1;
              return <td key={`${header}-${columnIndex}`} dir={isCode || columnIndex === 0 ? 'ltr' : 'auto'} title={value} className={`group relative p-2 ${isSystemAssignment ? 'bill-assignment-cell whitespace-pre-line' : isCode || columnIndex === 0 ? 'whitespace-nowrap font-mono tabular-nums' : 'min-w-28'} ${isCode ? 'font-mono tabular-nums' : ''}`}>
                <span>{value || '—'}</span>
              </td>;
            })}
          </tr>)}</tbody>
        </table>
      </div>
    </div>}
    {addingBill && <div className="fixed inset-0 z-[100] grid place-items-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.72)' }} onMouseDown={(event) => { if (event.target === event.currentTarget && !savingNewBill) setAddingBill(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="bill-identifier-add-title" dir={direction} style={{ backgroundColor: 'var(--surface)' }} className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-border p-4 text-foreground shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="bill-identifier-add-title" className="font-semibold">{'\u0627\u0641\u0632\u0648\u062f\u0646 \u0634\u0646\u0627\u0633\u0647 \u0642\u0628\u0636'}</h2>
          <button type="button" onClick={() => setAddingBill(false)} disabled={savingNewBill} aria-label={'\u0628\u0633\u062a\u0646'} className="grid size-8 place-items-center rounded-full border border-border hover:bg-muted disabled:opacity-50"><X size={16} /></button>
        </div>
        <label className="block space-y-2 text-sm">
          <span>{'\u0634\u0646\u0627\u0633\u0647 \u0642\u0628\u0636'}</span>
          <input autoFocus dir="ltr" inputMode="numeric" value={newBillIdentifier} onChange={(event) => setNewBillIdentifier(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && newBillIdentifier.trim() && !savingNewBill) void addBillIdentifier(); }} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary" />
        </label>
        <label className="rahcom-search-capsule relative mt-4 block rounded-full">
          <Search aria-hidden="true" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={newBillSystemQuery} onChange={(event) => setNewBillSystemQuery(event.target.value)} placeholder={'\u062c\u0633\u062a\u200c\u0648\u062c\u0648\u06cc \u06a9\u062f \u06cc\u0627 \u0646\u0627\u0645 \u0633\u0627\u0645\u0627\u0646\u0647'} className="h-10 w-full rounded-full border border-border bg-background ps-9 pe-4 text-sm outline-none focus:border-primary" />
        </label>
        <div className="mt-2 max-h-52 overflow-auto rounded-xl border border-border" style={{ backgroundColor: 'var(--background)' }}>
          {newBillSystemOptions.length ? newBillSystemOptions.map((system) => <label key={system.id} className={`flex w-full cursor-pointer items-center justify-between gap-3 border-b border-border p-3 text-start last:border-b-0 hover:bg-muted ${newBillSystemIds.includes(system.id) ? 'bg-primary/10 text-primary' : ''}`}>
            <span className="flex min-w-0 items-center gap-3"><input type="checkbox" checked={newBillSystemIds.includes(system.id)} onChange={() => setNewBillSystemIds((current) => current.includes(system.id) ? current.filter((id) => id !== system.id) : [...current, system.id])} disabled={savingNewBill} className="size-4 shrink-0 accent-primary" /><span className="truncate">{system.systemName}</span></span><code dir="ltr" className="shrink-0 font-mono text-xs text-muted-foreground">{system.systemCode}</code>
          </label>) : <p className="p-4 text-center text-sm text-muted-foreground">{'\u0633\u0627\u0645\u0627\u0646\u0647\u200c\u0627\u06cc \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.'}</p>}
        </div>
        {newBillSystemIds.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{newBillSystemIds.length} {'\u0633\u0627\u0645\u0627\u0646\u0647 \u0627\u0646\u062a\u062e\u0627\u0628 \u0634\u062f'}</p>}
        <fieldset className="mt-4 rounded-xl border border-border p-3">
          <legend className="px-1 text-sm font-medium">{'\u0633\u0627\u0645\u0627\u0646\u0647 \u062e\u0627\u0631\u062c \u0627\u0632 \u0631\u0647\u06a9\u0627\u0645'}</legend>
          <div className="grid gap-2 sm:grid-cols-[5rem_1fr_1fr_auto]">
            <select value={newExternalDraft.type} onChange={(event) => setNewExternalDraft((current) => ({ ...current, type: event.target.value as ExternalSystemType }))} className="h-10 rounded-xl border border-border bg-background px-2 text-sm text-foreground"><option value="USO">USO</option><option value="VSAT">VSAT</option></select>
            <input value={newExternalDraft.code} onChange={(event) => setNewExternalDraft((current) => ({ ...current, code: event.target.value }))} placeholder={'\u06a9\u062f \u0633\u0627\u0645\u0627\u0646\u0647'} className="h-10 min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground" />
            <input value={newExternalDraft.name} onChange={(event) => setNewExternalDraft((current) => ({ ...current, name: event.target.value }))} placeholder={'\u0646\u0627\u0645 \u0633\u0627\u0645\u0627\u0646\u0647'} className="h-10 min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground" />
            <button type="button" disabled={!newExternalDraft.code.trim() || !newExternalDraft.name.trim() || savingNewBill} onClick={() => { setNewExternalSystems((current) => [...current, { ...newExternalDraft, code: newExternalDraft.code.trim(), name: newExternalDraft.name.trim() }]); setNewExternalDraft((current) => ({ ...current, code: '', name: '' })); }} className="h-10 rounded-xl border border-border px-3 text-sm hover:bg-muted disabled:opacity-50"><Plus size={16} /></button>
          </div>
          {newExternalSystems.length > 0 && <ul className="mt-2 divide-y divide-border rounded-lg border border-border">{newExternalSystems.map((external, index) => <li key={`${external.type}-${external.code}-${index}`} className="flex items-center justify-between gap-2 p-2 text-xs"><span className="min-w-0 truncate"><bdi dir="ltr">{external.type} - {external.code}</bdi>{' \u00b7 '}{external.name}</span><button type="button" onClick={() => setNewExternalSystems((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={'\u062d\u0630\u0641'} className="grid size-7 shrink-0 place-items-center rounded-full hover:bg-muted"><X size={14} /></button></li>)}</ul>}
        </fieldset>
        <div className="mt-4 grid gap-3">
          {editableAddColumns.map(({ header }) => <label key={header} className="block space-y-2 text-sm">
            <span>{header}</span>
            <input value={newBillFields[header] ?? ''} onChange={(event) => setNewBillFields((current) => ({ ...current, [header]: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary" />
          </label>)}
        </div>
        {addBillError && <p role="alert" className="mt-3 text-sm text-destructive">{addBillError}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setAddingBill(false)} disabled={savingNewBill} className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-muted disabled:opacity-50">{'\u0627\u0646\u0635\u0631\u0627\u0641'}</button>
          <button type="button" onClick={() => void addBillIdentifier()} disabled={savingNewBill || !newBillIdentifier.trim()} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{savingNewBill ? uiMessage(locale, 'reportsLoading') : '\u0630\u062e\u06cc\u0631\u0647'}</button>
        </div>
      </section>
    </div>}
    {deletingRowIndex !== null && <div className="fixed inset-0 z-[100] grid place-items-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.72)' }} onMouseDown={(event) => { if (event.target === event.currentTarget && !deletingRecord) setDeletingRowIndex(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="bill-identifier-delete-title" dir={direction} style={{ backgroundColor: 'var(--surface)' }} className="w-full max-w-sm rounded-2xl border border-border p-4 text-foreground shadow-2xl">
        <h2 id="bill-identifier-delete-title" className="font-semibold">{'\u062d\u0630\u0641 \u0631\u06a9\u0648\u0631\u062f'}</h2>
        <p className="mt-3 text-sm text-muted-foreground">{'\u0622\u06cc\u0627 \u0627\u0632 \u062d\u0630\u0641 \u0627\u06cc\u0646 \u0634\u0646\u0627\u0633\u0647 \u0642\u0628\u0636 \u0645\u0637\u0645\u0626\u0646 \u0647\u0633\u062a\u06cc\u061f'}</p>
        <code dir="ltr" className="mt-2 block font-mono text-sm">{deletingBillIdentifier || '—'}</code>
        {deleteError && <p role="alert" className="mt-3 text-sm text-destructive">{deleteError}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setDeletingRowIndex(null)} disabled={deletingRecord} className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-muted disabled:opacity-50">{'\u0627\u0646\u0635\u0631\u0627\u0641'}</button>
          <button type="button" onClick={() => void deleteBillIdentifier()} disabled={deletingRecord} className="h-9 rounded-lg bg-destructive px-4 text-sm font-medium text-white disabled:opacity-50">{deletingRecord ? uiMessage(locale, 'reportsLoading') : '\u062d\u0630\u0641'}</button>
        </div>
      </section>
    </div>}
    {editingRecordIndex !== null && <div className="fixed inset-0 z-[100] grid place-items-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.72)' }} onMouseDown={(event) => { if (event.target === event.currentTarget && !savingRecordEdit) setEditingRecordIndex(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="bill-record-edit-title" dir={direction} style={{ backgroundColor: 'var(--surface)' }} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border p-4 text-foreground shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="bill-record-edit-title" className="font-semibold">{'\u0648\u06cc\u0631\u0627\u06cc\u0634 \u0631\u06a9\u0648\u0631\u062f \u0634\u0646\u0627\u0633\u0647 \u0642\u0628\u0636'}</h2>
          <button type="button" onClick={() => setEditingRecordIndex(null)} disabled={savingRecordEdit} aria-label={'\u0628\u0633\u062a\u0646'} className="grid size-8 place-items-center rounded-full border border-border hover:bg-muted disabled:opacity-50"><X size={16} /></button>
        </div>
        <div className="grid gap-3">
          {editableRecordColumns.map(({ header }) => <label key={header} className="block space-y-2 text-sm">
            <span>{header}</span>
            <input value={editingBillFields[header] ?? ''} onChange={(event) => setEditingBillFields((current) => ({ ...current, [header]: event.target.value }))} disabled={savingRecordEdit} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary disabled:opacity-50" />
          </label>)}
        </div>
        <label className="rahcom-search-capsule relative mt-4 block rounded-full">
          <Search aria-hidden="true" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={editingBillSystemQuery} onChange={(event) => setEditingBillSystemQuery(event.target.value)} placeholder={'\u062c\u0633\u062a\u200c\u0648\u062c\u0648\u06cc \u06a9\u062f \u06cc\u0627 \u0646\u0627\u0645 \u0633\u0627\u0645\u0627\u0646\u0647'} className="h-10 w-full rounded-full border border-border bg-background ps-9 pe-4 text-sm outline-none focus:border-primary" />
        </label>
        <div className="mt-2 max-h-48 overflow-auto rounded-xl border border-border" style={{ backgroundColor: 'var(--background)' }}>
          {systems.filter((system) => !editingBillSystemQuery.trim() || `${system.systemCode} ${system.systemName}`.toLocaleLowerCase(locale).includes(editingBillSystemQuery.trim().toLocaleLowerCase(locale))).slice(0, 30).map((system) => <label key={system.id} className={`flex w-full cursor-pointer items-center justify-between gap-3 border-b border-border p-3 text-start last:border-b-0 hover:bg-muted ${editingBillSystemIds.includes(system.id) ? 'bg-primary/10 text-primary' : ''}`}>
            <span className="flex min-w-0 items-center gap-3"><input type="checkbox" checked={editingBillSystemIds.includes(system.id)} onChange={() => setEditingBillSystemIds((current) => current.includes(system.id) ? current.filter((id) => id !== system.id) : [...current, system.id])} disabled={savingRecordEdit} className="size-4 shrink-0 accent-primary" /><span className="truncate">{system.systemName}</span></span><code dir="ltr" className="shrink-0 font-mono text-xs text-muted-foreground">{system.systemCode}</code>
          </label>)}
        </div>
        <fieldset className="mt-4 rounded-xl border border-border p-3">
          <legend className="px-1 text-sm font-medium">{'\u0633\u0627\u0645\u0627\u0646\u0647 \u062e\u0627\u0631\u062c \u0627\u0632 \u0631\u0647\u06a9\u0627\u0645'}</legend>
          {editingExternalSystems.length > 0 && <ul className="mb-3 divide-y divide-border rounded-lg border border-border">{editingExternalSystems.map((external, index) => <li key={`${external.type}-${external.code}-${index}`} className="p-2"><div className="grid grid-cols-[5rem_1fr_auto] gap-2"><select value={external.type} onChange={(event) => setEditingExternalSystems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as ExternalSystemType } : item))} disabled={savingRecordEdit} aria-label={'\u0646\u0648\u0639 \u0633\u0627\u0645\u0627\u0646\u0647'} className="h-9 rounded-lg border border-border bg-background px-2 text-xs text-foreground"><option value="USO">USO</option><option value="VSAT">VSAT</option></select><input value={external.code} onChange={(event) => setEditingExternalSystems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, code: event.target.value } : item))} disabled={savingRecordEdit} aria-label={'\u06a9\u062f \u0633\u0627\u0645\u0627\u0646\u0647'} placeholder={'\u06a9\u062f \u0633\u0627\u0645\u0627\u0646\u0647'} className="h-9 min-w-0 rounded-lg border border-border bg-background px-2 text-xs text-foreground" /><button type="button" onClick={() => setEditingExternalSystems((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={savingRecordEdit} aria-label={'\u062d\u0630\u0641'} className="grid size-9 place-items-center rounded-lg hover:bg-muted disabled:opacity-50"><X size={14} /></button></div><input value={external.name} onChange={(event) => setEditingExternalSystems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} disabled={savingRecordEdit} aria-label={'\u0646\u0627\u0645 \u0633\u0627\u0645\u0627\u0646\u0647'} placeholder={'\u0646\u0627\u0645 \u0633\u0627\u0645\u0627\u0646\u0647'} className="mt-2 h-9 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground" /></li>)}</ul>}
          <div className="grid gap-2 sm:grid-cols-[5rem_1fr_1fr_auto]">
            <select value={editingExternalDraft.type} onChange={(event) => setEditingExternalDraft((current) => ({ ...current, type: event.target.value as ExternalSystemType }))} disabled={savingRecordEdit} className="h-10 rounded-xl border border-border bg-background px-2 text-sm text-foreground"><option value="USO">USO</option><option value="VSAT">VSAT</option></select>
            <input value={editingExternalDraft.code} onChange={(event) => setEditingExternalDraft((current) => ({ ...current, code: event.target.value }))} placeholder={'\u06a9\u062f \u0633\u0627\u0645\u0627\u0646\u0647'} disabled={savingRecordEdit} className="h-10 min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground" />
            <input value={editingExternalDraft.name} onChange={(event) => setEditingExternalDraft((current) => ({ ...current, name: event.target.value }))} placeholder={'\u0646\u0627\u0645 \u0633\u0627\u0645\u0627\u0646\u0647'} disabled={savingRecordEdit} className="h-10 min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground" />
            <button type="button" disabled={!editingExternalDraft.code.trim() || !editingExternalDraft.name.trim() || savingRecordEdit} onClick={() => { setEditingExternalSystems((current) => [...current, { ...editingExternalDraft, code: editingExternalDraft.code.trim(), name: editingExternalDraft.name.trim() }]); setEditingExternalDraft((current) => ({ ...current, code: '', name: '' })); }} className="h-10 rounded-xl border border-border px-3 text-sm hover:bg-muted disabled:opacity-50"><Plus size={16} /></button>
          </div>
        </fieldset>
        {recordEditError && <p role="alert" className="mt-3 text-sm text-destructive">{recordEditError}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setEditingRecordIndex(null)} disabled={savingRecordEdit} className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-muted disabled:opacity-50">{'\u0627\u0646\u0635\u0631\u0627\u0641'}</button>
          <button type="button" onClick={() => void saveRecordEdit()} disabled={savingRecordEdit || editingExternalSystems.some((external) => !external.code.trim() || !external.name.trim())} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">{savingRecordEdit ? uiMessage(locale, 'reportsLoading') : '\u0630\u062e\u06cc\u0631\u0647'}</button>
        </div>
      </section>
    </div>}
    {editingRowIndex !== null && <div className="fixed inset-0 z-[100] grid place-items-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.72)' }} onMouseDown={(event) => { if (event.target === event.currentTarget && !savingAssignment) setEditingRowIndex(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="bill-system-assignment-title" dir={direction} style={{ backgroundColor: 'var(--surface)' }} className="w-full max-w-md rounded-2xl border border-border p-4 text-foreground shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="bill-system-assignment-title" className="font-semibold">{'\u0627\u0646\u062a\u0633\u0627\u0628 \u06a9\u062f \u0633\u0627\u0645\u0627\u0646\u0647'}</h2>
          <button type="button" onClick={() => setEditingRowIndex(null)} disabled={savingAssignment} aria-label={'\u0628\u0633\u062a\u0646'} className="grid size-8 place-items-center rounded-full border border-border hover:bg-muted disabled:opacity-50"><X size={16} /></button>
        </div>
        <label className="rahcom-search-capsule relative block rounded-full">
          <Search aria-hidden="true" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input autoFocus value={assignmentQuery} onChange={(event) => setAssignmentQuery(event.target.value)} placeholder={'\u062c\u0633\u062a\u200c\u0648\u062c\u0648\u06cc \u06a9\u062f \u06cc\u0627 \u0646\u0627\u0645 \u0633\u0627\u0645\u0627\u0646\u0647'} className="h-10 w-full rounded-full border border-border bg-background ps-9 pe-4 text-sm outline-none focus:border-primary" />
        </label>
        <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-border" style={{ backgroundColor: 'var(--background)' }}>
          {assignmentOptions.length ? assignmentOptions.map((system) => <label key={system.id} className={`flex w-full cursor-pointer items-center justify-between gap-3 border-b border-border p-3 text-start last:border-b-0 hover:bg-muted ${selectedAssignmentIds.includes(system.id) ? 'bg-primary/10 text-primary' : ''}`}>
            <span className="flex min-w-0 items-center gap-3"><input type="checkbox" name="bill-system-assignment" value={system.id} checked={selectedAssignmentIds.includes(system.id)} onChange={() => setSelectedAssignmentIds((current) => current.includes(system.id) ? current.filter((id) => id !== system.id) : [...current, system.id])} disabled={savingAssignment} className="size-4 shrink-0 accent-primary" /><span className="truncate">{system.systemName}</span></span><code dir="ltr" className="shrink-0 font-mono text-xs text-muted-foreground">{system.systemCode}</code>
          </label>) : <p className="p-4 text-center text-sm text-muted-foreground">{'\u0633\u0627\u0645\u0627\u0646\u0647\u200c\u0627\u06cc \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.'}</p>}
        </div>
        {savingAssignment && <p role="status" className="mt-3 text-sm text-muted-foreground">{uiMessage(locale, 'reportsLoading')}</p>}
        {assignmentError && <p role="alert" className="mt-3 text-sm text-destructive">{assignmentError}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setEditingRowIndex(null)} disabled={savingAssignment} className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-muted disabled:opacity-50">{'\u0627\u0646\u0635\u0631\u0627\u0641'}</button>
          {selectedAssignmentIds.length > 0 && <button type="button" onClick={() => { setSelectedAssignmentIds([]); void persistAssignment([]); }} disabled={savingAssignment} className="h-9 rounded-lg border border-destructive/40 px-3 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50">{'\u067e\u0627\u06a9\u200c\u06a9\u0631\u062f\u0646 \u0647\u0645\u0647'}</button>}
          <button type="button" onClick={() => void saveAssignment()} disabled={savingAssignment} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{'\u0630\u062e\u06cc\u0631\u0647'}</button>
        </div>
      </section>
    </div>}
  </section>;
}
