'use client';

import { RahcomToolbar } from '@/components/rahcom/toolbar';
import { DataTable } from '@/components/ui/data-table';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { ArchiveRestore, Download, LoaderCircle, Plus, Save, Search, Trash2, Upload, WrapText, X, Zap } from 'lucide-react';
import { usePreferences, getLocaleDirection } from '@/components/providers/preferences-provider';

import { getAccessToken } from '@/lib/api-client';
import { rahcomApi, type RahcomSystem } from '@/lib/api/rahcom/rahcom-api';
import { uiMessage } from '@/lib/ui-messages';
import { openRahcomRowInfo } from '@/app/(workspace)/rahcom/_shared/rahcom-row-info';

type BillWorkbook = { headers: string[]; rows: string[][] };
type ExternalSystemType = 'USO' | 'RAHCOM' | 'VSAT';
type ExternalSystemAssignment = { type: ExternalSystemType; code: string; name: string };
const splitSystemCodes = (value: string | undefined) => (value ?? '').split(/[;,،|]/).map((code) => code.trim()).filter(Boolean);
const parseExternalSystem = (value: string): ExternalSystemAssignment | null => {
  const match = value.match(/^EXTERNAL:(USO|RAHCOM|VSAT):([^:]*):([^:]*)$/);
  if (!match) return null;
  try { return { type: match[1] as ExternalSystemType, code: decodeURIComponent(match[2]), name: decodeURIComponent(match[3]) }; }
  catch { return null; }
};
const serializeExternalSystem = (system: ExternalSystemAssignment) => `EXTERNAL:${system.type}:${encodeURIComponent(system.code.trim())}:${encodeURIComponent(system.name.trim())}`;
const externalSystemsFromCell = (value: string | undefined) => splitSystemCodes(value).map(parseExternalSystem).filter((system): system is ExternalSystemAssignment => Boolean(system));
const assignmentFamily = (value: string | ExternalSystemAssignment) => {
  const external = typeof value === 'string' ? parseExternalSystem(value) : value;
  return external?.type ?? 'RAHCOM';
};
const assignmentFamilies = (rahcomSystemCount: number, externalSystems: ExternalSystemAssignment[]) => new Set([
  ...(rahcomSystemCount ? ['RAHCOM'] : []),
  ...externalSystems.map((system) => assignmentFamily(system)),
]);
const canUseAssignmentFamily = (families: Set<string>, family: string) => families.size === 0 || (families.size === 1 && families.has(family));
const assertSingleAssignmentFamily = (codes: string[]) => {
  if (new Set(codes.map(assignmentFamily)).size > 1) throw new Error('mixed_assignment_families');
};
const collectExternalAssignments = (saved: ExternalSystemAssignment[], draft: ExternalSystemAssignment) => {
  const code = draft.code.trim();
  const name = draft.name.trim();
  if (!code && !name) return saved;
  if (!code || !name) throw new Error('incomplete_external_system');
  const assignments = [...saved, { ...draft, code, name }];
  const seen = new Set<string>();
  return assignments.filter((assignment) => {
    const key = `${assignment.type}:${assignment.code.normalize('NFKC').replace(/\s/g, '').toUpperCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
const normalizeBillHeader = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa')
  .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c\u200f/\\_-]/g, '');
const normalizeBillIdentifier = (value: string) => value.normalize('NFKC')
  .replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  }).replace(/\s/g, '');
const normalizeSearchText = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa')
  .replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) >= 0x06f0 ? digit.charCodeAt(0) - 0x06f0 : digit.charCodeAt(0) - 0x0660))
  .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c\u200f\-–—،,.\/]+/g, '');

export function RahcomBillIdentifiers() {
  const { locale } = usePreferences();
  const direction = getLocaleDirection(locale);
  const [workbook, setWorkbook] = useState<BillWorkbook | null>(null);
  const [systems, setSystems] = useState<RahcomSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [canManageBillIdentifiers, setCanManageBillIdentifiers] = useState(false);
  const [query, setQuery] = useState('');
  const [wrapTableText, setWrapTableText] = useState(false);
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
  const [confirmEditDelete, setConfirmEditDelete] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [operationError, setOperationError] = useState('');
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const backupActionsRef = useRef<HTMLDivElement>(null);
  const [backupActionsOpen, setBackupActionsOpen] = useState(false);

  useEffect(() => {
    if (!backupActionsOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!backupActionsRef.current?.contains(event.target as Node)) setBackupActionsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setBackupActionsOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [backupActionsOpen]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const token = getAccessToken();
      if (!token) {
        if (active) { setLoading(false); setAccessLoaded(true); }
        return;
      }
      void rahcomApi.access().then((access) => {
        if (active) setCanManageBillIdentifiers(access.canManageAssignments);
      }).catch(() => {
        if (active) setCanManageBillIdentifiers(false);
      }).finally(() => {
        if (active) setAccessLoaded(true);
      });
      try {
        const response = await fetch('/api/rahcom/bill-identifiers', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Workbook unavailable');
        const data = await response.json() as BillWorkbook;
        if (active) { setWorkbook(data); setLoadFailed(false); }
      } catch {
        if (active) { setWorkbook({ headers: [], rows: [] }); setLoadFailed(true); }
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
  const latestBillMessageIndex = useMemo(() => workbook?.headers.findIndex((header) => [normalizeBillHeader('\u0648\u0636\u0639\u06cc\u062a \u0628\u0631\u0631\u0633\u06cc'), normalizeBillHeader('\u0622\u062e\u0631\u06cc\u0646 \u067e\u06cc\u0627\u0645\u06a9 \u0642\u0628\u0636')].includes(normalizeBillHeader(header))) ?? -1, [workbook]);
  const displayColumnLabel = (header: string, index: number) => index === latestBillMessageIndex
    ? locale === 'fa' ? '\u0622\u062e\u0631\u06cc\u0646 \u067e\u06cc\u0627\u0645\u06a9 \u0642\u0628\u0636' : 'Latest bill SMS'
    : header;
  const systemNameByCode = useMemo(() => new Map(systems.map((system) => [
    system.systemCode.normalize('NFKC').trim().toUpperCase(), system.systemName,
  ])), [systems]);
  const newBillSystemOptions = useMemo(() => {
    const normalized = newBillSystemQuery.trim().toLocaleLowerCase(locale);
    return systems.filter((system) => !normalized || `${system.systemCode} ${system.systemName}`.toLocaleLowerCase(locale).includes(normalized)).slice(0, 30);
  }, [locale, newBillSystemQuery, systems]);
  const newBillAssignmentFamilies = useMemo(() => assignmentFamilies(newBillSystemIds.length, newExternalSystems), [newBillSystemIds.length, newExternalSystems]);
  const editingBillAssignmentFamilies = useMemo(() => assignmentFamilies(editingBillSystemIds.length, editingExternalSystems), [editingBillSystemIds.length, editingExternalSystems]);
  const canChangeEditingExternalType = (index: number, nextType: ExternalSystemType) => {
    const remainingFamilies = new Set([
      ...(editingBillSystemIds.length ? ['RAHCOM'] : []),
      ...editingExternalSystems.filter((_, itemIndex) => itemIndex !== index).map(assignmentFamily),
    ]);
    return canUseAssignmentFamily(remainingFamilies, assignmentFamily({ type: nextType, code: '', name: '' }));
  };
  const getCellValue = useCallback((row: string[], columnIndex: number) => {
    if (columnIndex === -3) {
      const families = [...new Set(splitSystemCodes(systemCodeIndex >= 0 ? row[systemCodeIndex] : undefined)
        .map((code) => parseExternalSystem(code)?.type ?? 'RAHCOM'))];
      return families.map((family) => family === 'RAHCOM' ? (locale === 'fa' ? 'رهکام' : 'Rahcom') : family).join('، ');
    }
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
    const allRows = workbook?.rows ?? [];
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return allRows;
    return allRows.filter((row) => row.some((value) => normalizeSearchText(value).includes(normalizedQuery))
      || normalizeSearchText(getCellValue(row, -1)).includes(normalizedQuery));
  }, [getCellValue, query, workbook]);
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
    if (latestBillMessageIndex >= 0 && !dataColumns.some((column) => column.index === latestBillMessageIndex)) {
      dataColumns.push({ index: latestBillMessageIndex, header: workbook.headers[latestBillMessageIndex] });
    }
    const rowNumber = workbook.headers.findIndex((header) => normalizeBillHeader(header) === normalizeBillHeader('ردیف'));
    const systemCode = dataColumns.find((column) => column.index === systemCodeIndex);
    const billId = dataColumns.find((column) => ['شناسه قبض', 'شناسه قبض برق'].some((alias) => normalizeBillHeader(alias) === normalizeBillHeader(column.header)));
    const computerPasswordIndex = workbook.headers.findIndex((header) => normalizeBillHeader(header) === normalizeBillHeader('\u0631\u0645\u0632 \u0631\u0627\u06cc\u0627\u0646\u0647'));
    const computerPassword = computerPasswordIndex >= 0 ? { index: computerPasswordIndex, header: workbook.headers[computerPasswordIndex] } : undefined;
    const meterBodyIndex = workbook.headers.findIndex((header) => normalizeBillHeader(header) === normalizeBillHeader('\u0634\u0645\u0627\u0631\u0647 \u0628\u062f\u0646\u0647 \u06a9\u0646\u062a\u0648\u0631'));
    const meterBody = meterBodyIndex >= 0 ? { index: meterBodyIndex, header: workbook.headers[meterBodyIndex] } : undefined;
    return [
      ...(rowNumber >= 0 ? [{ index: rowNumber, header: workbook.headers[rowNumber] }] : []),
      { index: -2, header: '\u0639\u0645\u0644\u06cc\u0627\u062a' },
      { index: -1, header: uiMessage(locale, 'rahcomSystemName') },
      ...(systemCode ? [systemCode] : []),
      { index: -3, header: uiMessage(locale, 'rahcomBillAssignmentType') },
      ...(billId ? [billId] : []),
      ...(computerPassword ? [computerPassword] : []),
      ...(meterBody ? [meterBody] : []),
      ...dataColumns.filter((column) => column !== systemCode && column !== billId && column !== meterBody),
    ];
  }, [latestBillMessageIndex, locale, systemCodeIndex, workbook]);
  const editableAddColumns = useMemo(() => displayColumns.filter((column) =>
    column.index >= 0 && column.index !== rowNumberIndex && column.index !== systemCodeIndex && column.index !== billIdentifierIndex && column.index !== registeredDateIndex,
  ), [billIdentifierIndex, displayColumns, registeredDateIndex, rowNumberIndex, systemCodeIndex]);
  const editableRecordColumns = useMemo(() => displayColumns.filter((column) =>
    column.index >= 0 && column.index !== rowNumberIndex && column.index !== systemCodeIndex && column.index !== registeredDateIndex,
  ), [displayColumns, registeredDateIndex, rowNumberIndex, systemCodeIndex]);

  const addBillIdentifier = async () => {
    if (!canManageBillIdentifiers) return;
    const billIdentifier = newBillIdentifier.trim();
    if (!billIdentifier) return;
    setSavingNewBill(true);
    setAddBillError('');
    try {
      const token = getAccessToken();
      if (!token) throw new Error('unauthorized');
      const externalAssignments = collectExternalAssignments(newExternalSystems, newExternalDraft);
      const systemCodes = newBillSystemIds
        .map((id) => systems.find((system) => system.id === id)?.systemCode)
        .filter((code): code is string => Boolean(code))
        .concat(externalAssignments.map(serializeExternalSystem));
      assertSingleAssignmentFamily(systemCodes);
      const fields = Object.fromEntries(editableAddColumns.map(({ header }) => [header, newBillFields[header] ?? '']));
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
        : error instanceof Error && error.message === 'mixed_assignment_families'
          ? uiMessage(locale, 'rahcomBillAssignmentSingleGroup')
          : '\u0630\u062e\u06cc\u0631\u0647\u200c\u0633\u0627\u0632\u06cc \u0631\u06a9\u0648\u0631\u062f \u062f\u0631 \u0641\u0627\u06cc\u0644 \u0627\u06a9\u0633\u0644 \u0627\u0646\u062c\u0627\u0645 \u0646\u0634\u062f.');
    } finally {
      setSavingNewBill(false);
    }
  };

  const saveRecordEdit = async () => {
    if (editingRecordIndex === null || !canManageBillIdentifiers) return;
    setSavingRecordEdit(true);
    setRecordEditError('');
    try {
      const token = getAccessToken();
      if (!token) throw new Error('unauthorized');
      const externalAssignments = collectExternalAssignments(editingExternalSystems, editingExternalDraft);
      const systemCodes = editingBillSystemIds
        .map((id) => systems.find((system) => system.id === id)?.systemCode)
        .filter((code): code is string => Boolean(code))
        .concat(externalAssignments.map(serializeExternalSystem));
      assertSingleAssignmentFamily(systemCodes);
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
      setDeletingRowIndex(null);
      setConfirmEditDelete(false);
      setEditingBillFields({});
    } catch (error) {
      setRecordEditError(error instanceof Error && error.message === 'mixed_assignment_families'
        ? uiMessage(locale, 'rahcomBillAssignmentSingleGroup')
        : '\u0630\u062e\u06cc\u0631\u0647\u200c\u0633\u0627\u0632\u06cc \u062a\u063a\u06cc\u06cc\u0631\u0627\u062a \u062f\u0631 \u0641\u0627\u06cc\u0644 \u0627\u06a9\u0633\u0644 \u0627\u0646\u062c\u0627\u0645 \u0646\u0634\u062f.');
    } finally {
      setSavingRecordEdit(false);
    }
  };

  const openRecordEditor = (row: string[]) => {
    const recordIndex = workbook?.rows.indexOf(row) ?? -1;
    const storedAssignments = splitSystemCodes(systemCodeIndex >= 0 ? row[systemCodeIndex] : undefined);
    setEditingRecordIndex(recordIndex);
    setDeletingRowIndex(recordIndex);
    setDeletingBillIdentifier(row[billIdentifierIndex] ?? '');
    setDeleteError('');
    setConfirmEditDelete(false);
    setEditingBillFields(Object.fromEntries(editableRecordColumns.map(({ header, index }) => [header, row[index] ?? ''])));
    setEditingBillSystemIds(systems.filter((system) => storedAssignments.some((code) =>
      !parseExternalSystem(code) && code.toUpperCase() === system.systemCode.normalize('NFKC').trim().toUpperCase(),
    )).map((system) => system.id));
    const externalAssignments = externalSystemsFromCell(systemCodeIndex >= 0 ? row[systemCodeIndex] : undefined);
    setEditingExternalSystems(externalAssignments);
    setEditingExternalDraft({ type: externalAssignments[0]?.type ?? 'USO', code: '', name: '' });
    setEditingBillSystemQuery('');
    setRecordEditError('');
  };

  const downloadDisplayedTable = () => {
    const exportColumns = displayColumns.filter(({ index }) => index !== -2);
    const exportHeaders = exportColumns.map(({ header, index }) => displayColumnLabel(header, index));
    const exportRows = rows.map((row) => exportColumns.map(({ index }) => getCellValue(row, index)));
    const worksheet = XLSX.utils.aoa_to_sheet([exportHeaders, ...exportRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'شناسه قبض');
    XLSX.writeFile(workbook, `bill-identifiers-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const saveBackup = async () => {
    if (!workbook || backupBusy || !canManageBillIdentifiers) return;
    setBackupBusy(true);
    try {
      const backup = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(backup, XLSX.utils.aoa_to_sheet([workbook.headers, ...workbook.rows]), 'Bill identifiers');
      const token = getAccessToken();
      if (!token) throw new Error('unauthorized');
      const bytes = XLSX.write(backup, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
      const response = await fetch('/api/rahcom/bill-identifiers', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        body: bytes,
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({})) as { error?: string }).error ?? 'backup_failed');
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setOperationError(error instanceof Error ? error.message : 'backup_failed');
    } finally { setBackupBusy(false); }
  };

  const importBillWorkbook = async (file?: File, options: { confirmed?: boolean; keepBusy?: boolean } = {}) => {
    if (!file || !canManageBillIdentifiers || (importBusy && !options.keepBusy)) return;
    if (!options.confirmed && workbook?.rows.length && !window.confirm(`\u0628\u0627 \u0628\u0627\u0631\u06af\u0630\u0627\u0631\u06cc \u0627\u06cc\u0646 \u0641\u0627\u06cc\u0644\u060c \u0641\u0647\u0631\u0633\u062a \u0641\u0639\u0644\u06cc \u0634\u0646\u0627\u0633\u0647\u200c\u0647\u0627\u06cc \u0642\u0628\u0636 \u0628\u0627 \u0645\u062d\u062a\u0648\u0627\u06cc \u0641\u0627\u06cc\u0644 \u062c\u0627\u06cc\u06af\u0632\u06cc\u0646 \u0645\u06cc\u200c\u0634\u0648\u062f. \u0627\u062f\u0627\u0645\u0647 \u0645\u06cc\u200c\u062f\u0647\u06cc\u062f\u061f`)) return;
    if (!options.keepBusy) setImportBusy(true);
    setOperationError('');
    try {
      const parsed = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = parsed.Sheets[parsed.SheetNames[0]];
      const values = sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '', blankrows: false }) : [];
      const headers = (values[0] ?? []).map((value) => String(value ?? '').trim());
      const billColumn = headers.findIndex((header) => ['\u0634\u0646\u0627\u0633\u0647\u0642\u0628\u0636', '\u0634\u0646\u0627\u0633\u0647\u0642\u0628\u0636\u0628\u0631\u0642'].includes(normalizeBillHeader(header)));
      if (headers.length < 2 || billColumn < 0) throw new Error('bill_identifier_column_missing');
      const normalizedHeaders = headers.map(normalizeBillHeader);
      if (normalizedHeaders.some((header) => !header) || new Set(normalizedHeaders).size !== normalizedHeaders.length) throw new Error('duplicate_or_empty_headers');
      const rows = values.slice(1).map((row) => headers.map((_, index) => String(row[index] ?? '').trim())).filter((row) => row.some(Boolean));
      const billIdentifiers = new Set<string>();
      for (const row of rows) {
        const billIdentifier = normalizeBillIdentifier(row[billColumn] ?? '');
        if (!billIdentifier) continue;
        if (billIdentifiers.has(billIdentifier)) throw new Error('duplicate_bill_identifier');
        billIdentifiers.add(billIdentifier);
      }
      const token = getAccessToken();
      if (!token) throw new Error('unauthorized');
      const response = await fetch('/api/rahcom/bill-identifiers', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ headers, rows }) });
      if (!response.ok) throw new Error(response.status === 409 ? 'duplicate_bill_identifier' : 'import_failed');
      setWorkbook({ headers, rows });
      setLoadFailed(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setOperationError(message === 'duplicate_bill_identifier'
        ? '\u0634\u0646\u0627\u0633\u0647\u200c\u0642\u0628\u0636\u200c\u0647\u0627\u06cc \u062a\u06a9\u0631\u0627\u0631\u06cc \u062f\u0631 \u0641\u0627\u06cc\u0644 \u0648\u062c\u0648\u062f \u062f\u0627\u0631\u062f.'
        : message === 'duplicate_or_empty_headers'
          ? '\u0639\u0646\u0648\u0627\u0646 \u0633\u062a\u0648\u0646\u200c\u0647\u0627 \u062e\u0627\u0644\u06cc \u06cc\u0627 \u062a\u06a9\u0631\u0627\u0631\u06cc \u0627\u0633\u062a.'
          : message === 'bill_identifier_column_missing'
            ? '\u0633\u062a\u0648\u0646 \u0634\u0646\u0627\u0633\u0647 \u0642\u0628\u0636 \u062f\u0631 \u0641\u0627\u06cc\u0644 \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.'
            : message === 'import_failed' || message === 'invalid_workbook'
              ? '\u0641\u0627\u06cc\u0644 \u0627\u06a9\u0633\u0644 \u0642\u0627\u0628\u0644 \u0628\u0627\u0631\u06af\u0630\u0627\u0631\u06cc \u0646\u06cc\u0633\u062a.'
              : message || '\u0628\u0627\u0631\u06af\u0630\u0627\u0631\u06cc \u0641\u0627\u06cc\u0644 \u0627\u0646\u062c\u0627\u0645 \u0646\u0634\u062f.');
    } finally { if (!options.keepBusy) setImportBusy(false); }
  };

  const restoreBillBackup = async () => {
    if (!canManageBillIdentifiers || importBusy || loading) return;
    if (workbook?.rows.length && !window.confirm(`\u0628\u0627 \u0628\u0627\u0632\u06cc\u0627\u0628\u06cc \u0627\u0632 \u0646\u0633\u062e\u0647\u200c\u06cc \u067e\u0634\u062a\u06cc\u0628\u0627\u0646\u060c \u0641\u0647\u0631\u0633\u062a \u0641\u0639\u0644\u06cc \u0634\u0646\u0627\u0633\u0647\u200c\u0647\u0627\u06cc \u0642\u0628\u0636 \u0628\u0627 \u0645\u062d\u062a\u0648\u0627\u06cc \u0641\u0627\u06cc\u0644 \u067e\u0634\u062a\u06cc\u0628\u0627\u0646 \u062c\u0627\u06cc\u06af\u0632\u06cc\u0646 \u0645\u06cc\u200c\u0634\u0648\u062f. \u0627\u062f\u0627\u0645\u0647 \u0645\u06cc\u200c\u062f\u0647\u06cc\u062f\u061f`)) return;
    const token = getAccessToken();
    if (!token) { setOperationError('unauthorized'); return; }
    setImportBusy(true);
    setOperationError('');
    try {
      const response = await fetch('/api/rahcom/bill-identifiers?source=backup', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('backup_unavailable');
      const file = new File([await response.arrayBuffer()], 'ESF-electricity.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      await importBillWorkbook(file, { confirmed: true, keepBusy: true });
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'backup_failed');
    } finally { setImportBusy(false); }
  };

  const deleteBillIdentifier = async () => {
    if (deletingRowIndex === null || !canManageBillIdentifiers) return;
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
      setConfirmEditDelete(false);
      setEditingRecordIndex(null);
    } catch {
      setDeleteError('\u062d\u0630\u0641 \u0631\u06a9\u0648\u0631\u062f \u0627\u0632 \u0641\u0627\u06cc\u0644 \u0627\u06a9\u0633\u0644 \u0627\u0646\u062c\u0627\u0645 \u0646\u0634\u062f.');
    } finally {
      setDeletingRecord(false);
    }
  };

  return <section dir={direction} className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
    <RahcomToolbar as="header" className=" flex shrink-0 flex-wrap items-center justify-start gap-3">
      <span role="status" aria-label={`تعداد شناسه‌ها: ${new Intl.NumberFormat(locale).format(workbook?.rows.length ?? 0)}`} title="تعداد شناسه‌ها" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm text-foreground"><Zap size={16} className="text-primary" aria-hidden="true" /><strong className="font-bold tabular-nums">{new Intl.NumberFormat(locale).format(workbook?.rows.length ?? 0)}</strong></span>
      {canManageBillIdentifiers && <button type="button" onClick={() => { setAddBillError(''); setNewBillIdentifier(''); setNewBillSystemIds([]); setNewBillSystemQuery(''); setNewBillFields({}); setNewExternalSystems([]); setNewExternalDraft({ type: 'USO', code: '', name: '' }); setAddingBill(true); }} aria-label={'\u0627\u0641\u0632\u0648\u062f\u0646 \u0634\u0646\u0627\u0633\u0647 \u0642\u0628\u0636'} title={'\u0627\u0641\u0632\u0648\u062f\u0646 \u0634\u0646\u0627\u0633\u0647 \u0642\u0628\u0636'} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary"><Plus size={18} /></button>}
      {canManageBillIdentifiers && <button type="button" onClick={() => { setOperationError(''); uploadInputRef.current?.click(); }} disabled={importBusy} aria-label={uiMessage(locale, 'rahcomUploadExcel')} title={uiMessage(locale, 'rahcomUploadExcel')} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50">{importBusy ? <LoaderCircle size={17} className="animate-spin" /> : <Upload size={17} />}</button>}
      {canManageBillIdentifiers && <input ref={uploadInputRef} type="file" accept=".xlsx,.xls" className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void importBillWorkbook(file); }} />}
      <button type="button" aria-pressed={wrapTableText} onClick={() => setWrapTableText((enabled) => !enabled)} aria-label={uiMessage(locale, wrapTableText ? 'rahcomKeepTableTextSingleLine' : 'rahcomWrapLongTableText')} title={uiMessage(locale, wrapTableText ? 'rahcomKeepTableTextSingleLine' : 'rahcomWrapLongTableText')} className={`grid size-9 shrink-0 place-items-center rounded-full border transition-colors ${wrapTableText ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:border-primary hover:text-primary'}`}><WrapText size={17} aria-hidden="true" /></button>
      <button type="button" onClick={downloadDisplayedTable} aria-label={uiMessage(locale, 'solarDownloadExcel')} title={uiMessage(locale, 'solarDownloadExcel')} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary"><Download size={17} aria-hidden="true" /></button>
      <label className="rahcom-search-capsule relative block w-full max-w-[15rem] rounded-full">
        <Search aria-hidden="true" size={17} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={uiMessage(locale, 'headerSearch')} aria-label={uiMessage(locale, 'rahcomBillIdentifiersSearch')} className="h-9 w-full rounded-full border border-border bg-background ps-9 pe-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary" />
      </label>
      {canManageBillIdentifiers && <div ref={backupActionsRef} className="flex shrink-0 items-center gap-2">
        <button type="button" aria-expanded={backupActionsOpen} aria-pressed={backupActionsOpen} aria-controls="bill-backup-actions" onClick={() => setBackupActionsOpen((open) => !open)} aria-label="همگام‌سازی ابری" title="همگام‌سازی ابری" style={backupActionsOpen ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`grid size-9 shrink-0 place-items-center rounded-full border transition-colors ${backupActionsOpen ? '' : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-primary'}`}><span aria-hidden="true" className="size-[26px] bg-current" style={{ maskImage: "url(/cloud-sync-exact.svg)", WebkitMaskImage: "url(/cloud-sync-exact.svg)", maskSize: "contain", WebkitMaskSize: "contain", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat", maskPosition: "center", WebkitMaskPosition: "center" }} /></button>
        {backupActionsOpen && <div id="bill-backup-actions" className="flex items-center gap-2">
          <button type="button" onClick={() => void saveBackup()} disabled={backupBusy || loading || !workbook?.headers.length} aria-label={uiMessage(locale, 'rahcomSaveSystemsBackup')} title={uiMessage(locale, 'rahcomSaveSystemsBackup')} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50">{backupBusy ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}</button>
          <button type="button" onClick={() => void restoreBillBackup()} disabled={importBusy || loading} aria-label={uiMessage(locale, 'rahcomRestoreSystemsBackup')} title={uiMessage(locale, 'rahcomRestoreSystemsBackup')} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50">{importBusy ? <LoaderCircle size={17} className="animate-spin" /> : <ArchiveRestore size={17} />}</button>
        </div>}
      </div>}
    </RahcomToolbar>
    {operationError && <p role="alert" className="shrink-0 rounded-xl border border-destructive/30 p-3 text-sm text-destructive">{operationError}</p>}
    {accessLoaded && !canManageBillIdentifiers && <p role="status" className="shrink-0 rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">{'\u062f\u0633\u062a\u0631\u0633\u06cc \u0627\u06cc\u0646 \u062d\u0633\u0627\u0628 \u0628\u0647 \u0646\u0645\u0627\u06cc\u0634 \u0645\u062d\u062f\u0648\u062f \u0627\u0633\u062a\u061b \u0628\u0631\u0627\u06cc \u062a\u063a\u06cc\u06cc\u0631 \u0641\u0647\u0631\u0633\u062a \u0634\u0646\u0627\u0633\u0647\u200c\u0647\u0627\u06cc \u0642\u0628\u0636 \u0628\u0627 \u0645\u062f\u06cc\u0631 \u0631\u0647\u06a9\u0627\u0645 \u0647\u0645\u0627\u0647\u0646\u06af \u06a9\u0646\u06cc\u062f.'}</p>}
    {loading && <p role="status" className="shrink-0 p-4 text-sm text-muted-foreground">{uiMessage(locale, 'reportsLoading')}</p>}
    {!loading && loadFailed && <p role="alert" className="shrink-0 rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{uiMessage(locale, 'rahcomBillIdentifiersLoadFailed')}</p>}
    {!loading && !loadFailed && !workbook?.headers.length && <p className="shrink-0 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{uiMessage(locale, 'rahcomBillIdentifiersEmpty')}</p>}
    {!loading && workbook?.headers.length && rows.length === 0 && <p className="shrink-0 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{query ? uiMessage(locale, 'searchNoResults') : uiMessage(locale, 'rahcomBillIdentifiersEmpty')}</p>}
    {!loading && workbook?.headers.length && rows.length > 0 && <div className="rahcom-table-scroll rahcom-traffic-table-frame flex min-h-0 min-w-0 max-w-full flex-col overflow-auto rounded-2xl border border-border bg-card">
      <div className="w-max min-w-full">
        <DataTable className="rahcom-sticky-table rahcom-bill-identifiers-table w-full min-w-max text-sm">
          <thead className="bg-muted/50"><tr>{displayColumns.map(({ header, index }) => {
            const normalizedHeader = normalizeBillHeader(header);
            const narrowColumnClass = normalizedHeader === normalizeBillHeader('آدرس انشعاب')
              ? 'w-96 min-w-96 max-w-96'
              : normalizedHeader === normalizeBillHeader('وضعیت بررسی') ? 'w-64 min-w-64 max-w-64' : '';
            return <th key={`${header}-${index}`} scope="col" title={index === -2 ? 'ویرایش' : undefined} aria-label={index === -2 ? 'ویرایش' : undefined} className={`overflow-hidden text-ellipsis whitespace-nowrap p-2 text-center align-middle ${narrowColumnClass}`}>{index === -2 ? <span className="inline-flex w-full justify-center"><Zap size={15} fill="currentColor" aria-hidden="true" /></span> : displayColumnLabel(header, index) || '—'}</th>;
          })}</tr></thead>
          <tbody>{rows.map((row, rowIndex) => <tr key={`${row[0] || 'bill'}-${rowIndex}`} className="border-t border-border">
            {displayColumns.map(({ header, index: columnIndex }) => {
              if (columnIndex === -2) return <td key={`${header}-${columnIndex}`} className="whitespace-nowrap p-2 text-center align-middle"><div className="flex items-center justify-center gap-1">
                <button type="button" onClick={(event) => {
                  const fields = displayColumns.filter(({ index }) => index !== -2).map(({ header, index }) => ({ label: displayColumnLabel(header, index), value: getCellValue(row, index) }));
                  const billId = row[billIdentifierIndex] ?? '';
                  openRahcomRowInfo(billId || 'شناسه قبض', fields, event.currentTarget, { x: event.clientX, y: event.clientY }, billId, null, canManageBillIdentifiers ? () => openRecordEditor(row) : undefined);
                }} aria-label="نمایش اطلاعات شناسه قبض" title="نمایش اطلاعات شناسه قبض" className="inline-grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><Zap size={14} fill="currentColor" /></button>
              </div></td>;
              const value = getCellValue(row, columnIndex);
              const isCode = columnIndex === systemCodeIndex;
              const isSystemAssignment = isCode || columnIndex === -1;
              const wrapCellText = wrapTableText && !isSystemAssignment && columnIndex !== 0;
              const normalizedHeader = normalizeBillHeader(header);
              const isReviewDescription = columnIndex === latestBillMessageIndex || normalizedHeader === normalizeBillHeader('وضعیت بررسی');
              const narrowColumnClass = normalizedHeader === normalizeBillHeader('آدرس انشعاب')
                ? 'w-96 min-w-96 max-w-96'
                : isReviewDescription ? 'w-64 min-w-64 max-w-64' : '';
              return <td key={`${header}-${columnIndex}`} dir={isCode || columnIndex === 0 ? 'ltr' : 'auto'} className={`group relative p-2 text-center align-middle ${wrapCellText ? 'max-w-64 overflow-hidden' : 'overflow-hidden text-ellipsis'} ${narrowColumnClass} ${isSystemAssignment ? 'bill-assignment-cell whitespace-pre-line' : isCode || columnIndex === 0 ? 'whitespace-nowrap font-mono tabular-nums' : `min-w-28 ${wrapCellText ? 'whitespace-normal break-words' : 'whitespace-nowrap'}`} ${isCode ? 'font-mono tabular-nums' : ''}`}>
                <span className={isReviewDescription ? `text-start text-xs leading-5 ${wrapCellText ? 'block max-w-64 whitespace-normal break-words' : 'line-clamp-1 whitespace-nowrap'}` : wrapCellText ? 'block max-w-64 whitespace-normal break-words' : ''}>{value || '—'}</span>
              </td>;
            })}
          </tr>)}</tbody>
        </DataTable>
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
          {newBillSystemOptions.length ? newBillSystemOptions.map((system) => {
            const checked = newBillSystemIds.includes(system.id);
            const disabled = savingNewBill || (!checked && !canUseAssignmentFamily(newBillAssignmentFamilies, 'RAHCOM'));
            return <label key={system.id} className={`flex w-full cursor-pointer items-center justify-between gap-3 border-b border-border p-3 text-start last:border-b-0 hover:bg-muted ${checked ? 'bg-primary/10 text-primary' : ''} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
            <span className="flex min-w-0 items-center gap-3"><input type="checkbox" checked={checked} onChange={() => { if (!checked && !newExternalSystems.length) setNewExternalDraft((draft) => ({ ...draft, type: 'RAHCOM' })); setNewBillSystemIds((current) => current.includes(system.id) ? current.filter((id) => id !== system.id) : [...current, system.id]); }} disabled={disabled} className="size-4 shrink-0 accent-primary" /><span className="truncate">{system.systemName}</span></span><code dir="ltr" className="shrink-0 font-mono text-xs text-muted-foreground">{system.systemCode}</code>
          </label>;
          }) : <p className="p-4 text-center text-sm text-muted-foreground">{'\u0633\u0627\u0645\u0627\u0646\u0647\u200c\u0627\u06cc \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.'}</p>}
        </div>
        {newBillSystemIds.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{newBillSystemIds.length} {'\u0633\u0627\u0645\u0627\u0646\u0647 \u0627\u0646\u062a\u062e\u0627\u0628 \u0634\u062f'}</p>}
        <fieldset className="mt-4 rounded-xl border border-border p-3">
          <legend className="px-1 text-sm font-medium">{'\u0633\u0627\u0645\u0627\u0646\u0647 \u062e\u0627\u0631\u062c \u0627\u0632 \u0631\u0647\u06a9\u0627\u0645'}</legend>
          <p className="mb-2 text-xs text-muted-foreground">{uiMessage(locale, 'rahcomBillAssignmentSingleGroup')}</p>
          <div className="grid gap-2 sm:grid-cols-[5rem_1fr_1fr_auto]">
            <select value={newExternalDraft.type} onChange={(event) => setNewExternalDraft((current) => ({ ...current, type: event.target.value as ExternalSystemType }))} className="h-10 rounded-xl border border-border bg-background px-2 text-sm text-foreground"><option value="USO" disabled={!canUseAssignmentFamily(newBillAssignmentFamilies, 'USO')}>USO</option><option value="RAHCOM" disabled={!canUseAssignmentFamily(newBillAssignmentFamilies, 'RAHCOM')}>Rahcom</option><option value="VSAT" disabled={!canUseAssignmentFamily(newBillAssignmentFamilies, 'VSAT')}>VSAT</option></select>
            <input value={newExternalDraft.code} onChange={(event) => setNewExternalDraft((current) => ({ ...current, code: event.target.value }))} placeholder={'\u06a9\u062f \u0633\u0627\u0645\u0627\u0646\u0647'} className="h-10 min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground" />
            <input value={newExternalDraft.name} onChange={(event) => setNewExternalDraft((current) => ({ ...current, name: event.target.value }))} placeholder={'\u0646\u0627\u0645 \u0633\u0627\u0645\u0627\u0646\u0647'} className="h-10 min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground" />
            <button type="button" disabled={!newExternalDraft.code.trim() || !newExternalDraft.name.trim() || savingNewBill || !canUseAssignmentFamily(newBillAssignmentFamilies, assignmentFamily(newExternalDraft))} onClick={() => { setNewExternalSystems((current) => collectExternalAssignments(current, newExternalDraft)); setNewExternalDraft((current) => ({ ...current, code: '', name: '' })); }} className="h-10 rounded-xl border border-border px-3 text-sm hover:bg-muted disabled:opacity-50"><Plus size={16} /></button>
          </div>
          {newExternalSystems.length > 0 && <ul className="mt-2 divide-y divide-border rounded-lg border border-border">{newExternalSystems.map((external, index) => <li key={`${external.type}-${external.code}-${index}`} className="flex items-center justify-between gap-2 p-2 text-xs"><span className="min-w-0 truncate"><bdi dir="ltr">{external.type} - {external.code}</bdi>{' \u00b7 '}{external.name}</span><button type="button" onClick={() => setNewExternalSystems((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={'\u062d\u0630\u0641'} className="grid size-7 shrink-0 place-items-center rounded-full hover:bg-muted"><X size={14} /></button></li>)}</ul>}
        </fieldset>
        <div className="mt-4 grid gap-3">
          {editableAddColumns.map(({ header, index }) => <label key={header} className="block space-y-2 text-sm">
            <span>{displayColumnLabel(header, index)}</span>
            <input value={newBillFields[header] ?? ''} onChange={(event) => setNewBillFields((current) => ({ ...current, [header]: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary" />
          </label>)}
        </div>
        {addBillError && <p role="alert" className="mt-3 text-sm text-destructive">{addBillError}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setAddingBill(false)} disabled={savingNewBill} className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-muted disabled:opacity-50">{'\u0627\u0646\u0635\u0631\u0627\u0641'}</button>
          <button type="button" onClick={() => void addBillIdentifier()} disabled={savingNewBill || !newBillIdentifier.trim() || newBillAssignmentFamilies.size > 1 || Boolean(newExternalDraft.code.trim()) !== Boolean(newExternalDraft.name.trim()) || (Boolean(newExternalDraft.code.trim()) && !canUseAssignmentFamily(newBillAssignmentFamilies, assignmentFamily(newExternalDraft)))} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{savingNewBill ? uiMessage(locale, 'reportsLoading') : '\u0630\u062e\u06cc\u0631\u0647'}</button>
        </div>
      </section>
    </div>}
    {editingRecordIndex !== null && typeof document !== 'undefined' && createPortal(<div className="fixed inset-0 z-[100] grid place-items-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.72)' }} onMouseDown={(event) => { if (event.target === event.currentTarget && !savingRecordEdit && !deletingRecord) { setEditingRecordIndex(null); setConfirmEditDelete(false); } }}>
      <section role="dialog" aria-modal="true" aria-labelledby="bill-record-edit-title" dir={direction} style={{ backgroundColor: 'var(--card)' }} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border p-4 text-card-foreground shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="bill-record-edit-title" className="rahcom-popup-title">{'\u0648\u06cc\u0631\u0627\u06cc\u0634 \u0631\u06a9\u0648\u0631\u062f \u0634\u0646\u0627\u0633\u0647 \u0642\u0628\u0636'}</h2>
          <button type="button" onClick={() => { setEditingRecordIndex(null); setConfirmEditDelete(false); }} disabled={savingRecordEdit || deletingRecord} aria-label={'\u0628\u0633\u062a\u0646'} className="grid size-8 place-items-center rounded-[.65rem] border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"><X size={16} /></button>
        </div>
        <div className="grid gap-3">
          {editableRecordColumns.map(({ header, index }) => <label key={header} className="block space-y-2 text-sm">
            <span>{displayColumnLabel(header, index)}</span>
            <input value={editingBillFields[header] ?? ''} onChange={(event) => setEditingBillFields((current) => ({ ...current, [header]: event.target.value }))} disabled={savingRecordEdit} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary disabled:opacity-50" />
          </label>)}
        </div>
        <fieldset className="mt-4 rounded-xl border border-border p-3">
          <legend className="px-1 text-sm font-medium">{'\u0627\u0646\u062a\u0633\u0627\u0628 \u06a9\u062f \u0633\u0627\u0645\u0627\u0646\u0647'}</legend>
          <p className="mb-2 text-xs text-muted-foreground">{uiMessage(locale, 'rahcomBillAssignmentSingleGroup')}</p>
          <label className="rahcom-search-capsule relative block rounded-full">
            <Search aria-hidden="true" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={editingBillSystemQuery} onChange={(event) => setEditingBillSystemQuery(event.target.value)} placeholder={'\u062c\u0633\u062a\u200c\u0648\u062c\u0648\u06cc \u06a9\u062f \u06cc\u0627 \u0646\u0627\u0645 \u0633\u0627\u0645\u0627\u0646\u0647'} className="h-10 w-full rounded-full border border-border bg-background ps-9 pe-4 text-sm outline-none focus:border-primary" />
          </label>
          <div className="mt-2 max-h-48 overflow-auto rounded-xl border border-border" style={{ backgroundColor: 'var(--background)' }}>
            {systems.filter((system) => !editingBillSystemQuery.trim() || `${system.systemCode} ${system.systemName}`.toLocaleLowerCase(locale).includes(editingBillSystemQuery.trim().toLocaleLowerCase(locale))).slice(0, 30).map((system) => {
              const checked = editingBillSystemIds.includes(system.id);
              const disabled = savingRecordEdit || (!checked && !canUseAssignmentFamily(editingBillAssignmentFamilies, 'RAHCOM'));
              return <label key={system.id} className={`flex w-full cursor-pointer items-center justify-between gap-3 border-b border-border p-3 text-start last:border-b-0 hover:bg-muted ${checked ? 'bg-primary/10 text-primary' : ''} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
              <span className="flex min-w-0 items-center gap-3"><input type="checkbox" checked={checked} onChange={() => { if (!checked && !editingExternalSystems.length) setEditingExternalDraft((draft) => ({ ...draft, type: 'RAHCOM' })); setEditingBillSystemIds((current) => current.includes(system.id) ? current.filter((id) => id !== system.id) : [...current, system.id]); }} disabled={disabled} className="size-4 shrink-0 accent-primary" /><span className="truncate">{system.systemName}</span></span><code dir="ltr" className="shrink-0 font-mono text-xs text-muted-foreground">{system.systemCode}</code>
            </label>;
            })}
          </div>
        </fieldset>
        <fieldset className="mt-4 rounded-xl border border-border p-3">
          <legend className="px-1 text-sm font-medium">{'\u0633\u0627\u0645\u0627\u0646\u0647 \u062e\u0627\u0631\u062c \u0627\u0632 \u0631\u0647\u06a9\u0627\u0645'}</legend>
          {editingExternalSystems.length > 0 && <ul className="mb-3 divide-y divide-border rounded-lg border border-border">{editingExternalSystems.map((external, index) => <li key={`${external.type}-${external.code}-${index}`} className="p-2"><div className="grid grid-cols-[5rem_1fr_auto] gap-2"><select value={external.type} onChange={(event) => setEditingExternalSystems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as ExternalSystemType } : item))} disabled={savingRecordEdit} aria-label={'\u0646\u0648\u0639 \u0633\u0627\u0645\u0627\u0646\u0647'} className="h-9 rounded-lg border border-border bg-background px-2 text-xs text-foreground"><option value="USO" disabled={!canChangeEditingExternalType(index, 'USO')}>USO</option><option value="RAHCOM" disabled={!canChangeEditingExternalType(index, 'RAHCOM')}>Rahcom</option><option value="VSAT" disabled={!canChangeEditingExternalType(index, 'VSAT')}>VSAT</option></select><input value={external.code} onChange={(event) => setEditingExternalSystems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, code: event.target.value } : item))} disabled={savingRecordEdit} aria-label={'\u06a9\u062f \u0633\u0627\u0645\u0627\u0646\u0647'} placeholder={'\u06a9\u062f \u0633\u0627\u0645\u0627\u0646\u0647'} className="h-9 min-w-0 rounded-lg border border-border bg-background px-2 text-xs text-foreground" /><button type="button" onClick={() => setEditingExternalSystems((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={savingRecordEdit} aria-label={'\u062d\u0630\u0641'} className="grid size-8 place-items-center rounded-[.65rem] border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"><X size={16} /></button></div><input value={external.name} onChange={(event) => setEditingExternalSystems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} disabled={savingRecordEdit} aria-label={'\u0646\u0627\u0645 \u0633\u0627\u0645\u0627\u0646\u0647'} placeholder={'\u0646\u0627\u0645 \u0633\u0627\u0645\u0627\u0646\u0647'} className="mt-2 h-9 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground" /></li>)}</ul>}
          <div className="grid gap-2 sm:grid-cols-[5rem_1fr_1fr_auto]">
            <select value={editingExternalDraft.type} onChange={(event) => setEditingExternalDraft((current) => ({ ...current, type: event.target.value as ExternalSystemType }))} disabled={savingRecordEdit} className="h-10 rounded-xl border border-border bg-background px-2 text-sm text-foreground"><option value="USO" disabled={!canUseAssignmentFamily(editingBillAssignmentFamilies, 'USO')}>USO</option><option value="RAHCOM" disabled={!canUseAssignmentFamily(editingBillAssignmentFamilies, 'RAHCOM')}>Rahcom</option><option value="VSAT" disabled={!canUseAssignmentFamily(editingBillAssignmentFamilies, 'VSAT')}>VSAT</option></select>
            <input value={editingExternalDraft.code} onChange={(event) => setEditingExternalDraft((current) => ({ ...current, code: event.target.value }))} placeholder={'\u06a9\u062f \u0633\u0627\u0645\u0627\u0646\u0647'} disabled={savingRecordEdit} className="h-10 min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground" />
            <input value={editingExternalDraft.name} onChange={(event) => setEditingExternalDraft((current) => ({ ...current, name: event.target.value }))} placeholder={'\u0646\u0627\u0645 \u0633\u0627\u0645\u0627\u0646\u0647'} disabled={savingRecordEdit} className="h-10 min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground" />
            <button type="button" disabled={!editingExternalDraft.code.trim() || !editingExternalDraft.name.trim() || savingRecordEdit || !canUseAssignmentFamily(editingBillAssignmentFamilies, assignmentFamily(editingExternalDraft))} onClick={() => { setEditingExternalSystems((current) => collectExternalAssignments(current, editingExternalDraft)); setEditingExternalDraft((current) => ({ ...current, code: '', name: '' })); }} className="grid size-8 place-items-center rounded-[.65rem] border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"><Plus size={16} /></button>
          </div>
        </fieldset>
        {recordEditError && <p role="alert" className="mt-3 text-sm text-destructive">{recordEditError}</p>}
        {confirmEditDelete && <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-sm text-foreground">{'\u0622\u06cc\u0627 \u0627\u0632 \u062d\u0630\u0641 \u0627\u06cc\u0646 \u0634\u0646\u0627\u0633\u0647 \u0642\u0628\u0636 \u0645\u0637\u0645\u0626\u0646 \u0647\u0633\u062a\u06cc\u061f'}</p>
          <code dir="ltr" className="mt-2 block font-mono text-sm">{deletingBillIdentifier || '—'}</code>
          {deleteError && <p role="alert" className="mt-2 text-sm text-destructive">{deleteError}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => { setConfirmEditDelete(false); setDeleteError(''); }} disabled={deletingRecord} className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-muted disabled:opacity-50">{'\u0627\u0646\u0635\u0631\u0627\u0641'}</button>
            <button type="button" onClick={() => void deleteBillIdentifier()} disabled={deletingRecord} className="h-9 rounded-lg bg-destructive px-4 text-sm font-medium text-white disabled:opacity-50">{deletingRecord ? uiMessage(locale, 'reportsLoading') : '\u062d\u0630\u0641'}</button>
          </div>
        </div>}
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={() => { setDeleteError(''); setConfirmEditDelete(true); }} disabled={savingRecordEdit || deletingRecord || confirmEditDelete} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-destructive/40 px-3 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"><Trash2 size={14} />{'\u062d\u0630\u0641'}</button>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setEditingRecordIndex(null); setConfirmEditDelete(false); }} disabled={savingRecordEdit || deletingRecord} className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-muted disabled:opacity-50">{'\u0627\u0646\u0635\u0631\u0627\u0641'}</button>
            <button type="button" onClick={() => void saveRecordEdit()} disabled={savingRecordEdit || deletingRecord || confirmEditDelete || editingBillAssignmentFamilies.size > 1 || editingExternalSystems.some((external) => !external.code.trim() || !external.name.trim()) || Boolean(editingExternalDraft.code.trim()) !== Boolean(editingExternalDraft.name.trim()) || (Boolean(editingExternalDraft.code.trim()) && !canUseAssignmentFamily(editingBillAssignmentFamilies, assignmentFamily(editingExternalDraft)))} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">{savingRecordEdit ? uiMessage(locale, 'reportsLoading') : '\u0630\u062e\u06cc\u0631\u0647'}</button>
          </div>
        </div>
      </section>
    </div>, document.body)}
  </section>;
}
