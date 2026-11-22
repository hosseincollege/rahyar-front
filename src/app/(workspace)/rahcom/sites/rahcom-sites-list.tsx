'use client';

import { RahcomTableCount } from '@/components/rahcom/table';
import { RahcomDataListLayout, RahcomDataListToolbar } from '@/components/rahcom/data-list-layout';
import { DataTable } from '@/components/ui/data-table';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { usePreferences } from '@/components/providers/preferences-provider';
import { getLocaleDirection } from '@/lib/languages';
import { getAccessToken } from '@/lib/api-client';
import { iranProvinces, rahcomApi } from '@/lib/api/rahcom/rahcom-api';
import { uiMessage } from '@/lib/ui-messages';
import { RahcomInfoHeader, RahcomRowInfo, RahcomSiteIcon } from '@/app/(workspace)/rahcom/_shared/rahcom-row-info';
import { useBackupActionsPreference } from '@/components/rahcom/use-backup-actions-preference';

type WorkbookSheet = { name: string; rows: string[][] };
type BillWorkbook = { headers: string[]; rows: string[][] };
type SiteType = string;
const siteTypeHeader = '\u0646\u0648\u0639 \u0633\u0627\u06cc\u062a';
const normalize = (value: string) => value.trim().normalize('NFKC').replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c\u200f]/g, '').toLocaleLowerCase();

export function RahcomSitesList({ selectedProvince = 'all', canManage = false }: { selectedProvince?: string; canManage?: boolean }) {
  const { locale } = usePreferences();
  const [sitesData, setSitesData] = useState<{ province: string; sheets: WorkbookSheet[] } | null>(null);
  const [billWorkbook, setBillWorkbook] = useState<BillWorkbook | null>(null);
  const [loadErrorState, setLoadErrorState] = useState<{ province: string; message: string } | null>(null);
  const sheets = useMemo(() => sitesData?.province === selectedProvince ? sitesData.sheets : [], [selectedProvince, sitesData]);
  const loading = sitesData?.province !== selectedProvince && loadErrorState?.province !== selectedProvince;
  const loadError = loadErrorState?.province === selectedProvince ? loadErrorState.message : '';
  const [query, setQuery] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const { open: backupActionsOpen, toggle: toggleBackupActions } = useBackupActionsPreference();
  const [operationError, setOperationError] = useState('');
  const deferredQuery = useDeferredValue(query);
  const activeSheet = sheets[0];
  const headers = activeSheet?.rows[0] ?? [];
  const provinceLabel = iranProvinces.find(([id]) => id === selectedProvince)?.[1] ?? selectedProvince;
  const filteredRows = useMemo(() => {
    const sheet = sheets[0];
    if (!sheet) return [];
    const search = normalize(deferredQuery);
    const headers = sheet.rows[0] ?? [];
    const provinceIndex = headers.findIndex((header) => ['استان', 'استانسایت', 'ناماستان'].includes(normalize(header)));
    return sheet.rows.slice(1).filter((row) => {
      if (selectedProvince !== 'all' && provinceIndex >= 0 && normalize(row[provinceIndex] ?? '') !== normalize(provinceLabel)) return false;
      if (!search) return true;
      return row.some((cell) => normalize(cell).includes(search));
    });
  }, [deferredQuery, provinceLabel, selectedProvince, sheets]);
  const isPersian = locale === 'fa';
  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const visibleHeaders = headers.map((header, index) => ({ header, index })).filter(({ header }) => normalize(header) !== normalize(siteTypeHeader));
  const billIdsBySite = useMemo(() => {
    const result = new Map<string, string[]>();
    if (!billWorkbook) return result;
    const normalizeHeader = (value: string) => normalize(value).replace(/[\/_-]/g, '');
    const systemIndex = billWorkbook.headers.findIndex((header) => ['کدسامانه', 'کدسیستم'].includes(normalizeHeader(header)));
    const billIndex = billWorkbook.headers.findIndex((header) => ['شناسهقبض', 'شناسهقبضبرق'].includes(normalizeHeader(header)));
    if (systemIndex < 0 || billIndex < 0) return result;
    for (const row of billWorkbook.rows) {
      const billId = row[billIndex]?.trim();
      if (!billId) continue;
      for (const assignment of (row[systemIndex] ?? '').split(/[;,|]/).map((value) => value.trim())) {
        const match = assignment.match(/^EXTERNAL:USO:([^:]*):([^:]*)$/i);
        if (!match) continue;
        try {
          const key = normalize(decodeURIComponent(match[1]));
          const ids = result.get(key) ?? [];
          ids.push(billId);
          result.set(key, ids);
        } catch { /* Ignore malformed legacy assignments. */ }
      }
    }
    return result;
  }, [billWorkbook]);

  useEffect(() => {
    let active = true;
    void rahcomApi.sites(selectedProvince).then((result) => {
      if (!active) return;
      setSitesData({ province: selectedProvince, sheets: result });
      setLoadErrorState(null);
    }).catch((error: unknown) => {
      if (!active) return;
      setLoadErrorState({ province: selectedProvince, message: error instanceof Error ? error.message : (isPersian ? 'بارگذاری فهرست سایت‌ها انجام نشد.' : 'Could not load the sites list.') });
    });
    return () => { active = false; };
  }, [isPersian, selectedProvince]);

  useEffect(() => {
    let active = true;
    const token = getAccessToken();
    if (!token || selectedProvince !== 'isfahan') {
      queueMicrotask(() => { if (active) setBillWorkbook(null); });
      return () => { active = false; };
    }
    void fetch('/api/rahcom/bill-identifiers', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Bill list unavailable');
        return await response.json() as BillWorkbook;
      })
      .then((data) => { if (active) setBillWorkbook(data); })
      .catch(() => { if (active) setBillWorkbook(null); });
    return () => { active = false; };
  }, [selectedProvince]);

  const downloadWorkbook = () => {
    const workbook = XLSX.utils.book_new();
    for (const sheet of sheets) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name.slice(0, 31));
    XLSX.writeFile(workbook, 'uso-sites.xlsx');
  };

  const saveSiteType = async (row: string[], value: SiteType) => {
    const sheet = sheets[0];
    if (!sheet || !canManage || !value.trim() || value.trim().length > 40) return;
    const typeIndex = headers.findIndex((header) => normalize(header) === normalize(siteTypeHeader));
    if (typeIndex < 0) return;
    setOperationError('');
    try {
      let targetProvince = selectedProvince;
      let targetSheet = sheet;
      let targetHeaders = headers;
      if (selectedProvince === 'all') {
        const provinceIndex = headers.findIndex((header) => normalize(header) === normalize('استان'));
        const label = provinceIndex >= 0 ? row[provinceIndex] : '';
        targetProvince = iranProvinces.find(([, name]) => normalize(name) === normalize(label))?.[0] ?? '';
        if (!targetProvince) throw new Error(uiMessage(locale, 'rahcomSystemsLoadError'));
        const provinceSheets = await rahcomApi.sites(targetProvince);
        if (!provinceSheets[0]) throw new Error(uiMessage(locale, 'rahcomSystemsLoadError'));
        targetSheet = provinceSheets[0];
        targetHeaders = targetSheet.rows[0] ?? [];
      }
      const targetTypeIndex = targetHeaders.findIndex((header) => normalize(header) === normalize(siteTypeHeader));
      const rowKey = normalize(row[1] || row[2] || row[0] || '');
      const rowIndex = targetSheet.rows.findIndex((candidate, index) => index > 0 && normalize(candidate[1] || candidate[2] || candidate[0] || '') === rowKey);
      if (targetTypeIndex < 0 || rowIndex < 1) throw new Error(uiMessage(locale, 'rahcomSystemsLoadError'));
      const updatedRows = targetSheet.rows.slice(1).map((current) => [...current]);
      updatedRows[rowIndex - 1][targetTypeIndex] = value.trim();
      await rahcomApi.replaceSites(targetProvince, targetHeaders, updatedRows);
      if (selectedProvince === 'all') {
        const refreshed = await rahcomApi.sites('all');
        setSitesData({ province: 'all', sheets: refreshed });
      } else {
        setSitesData({ province: selectedProvince, sheets: [{ ...targetSheet, rows: [targetHeaders, ...updatedRows] }] });
      }
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : uiMessage(locale, 'rahcomSystemsLoadError'));
    }
  };

  const saveSitesBackup = async () => {
    if (backupBusy || selectedProvince !== 'isfahan' || !sheets.length) return;
    const token = getAccessToken();
    if (!token) { setOperationError(uiMessage(locale, 'rahcomSystemsLoadError')); return; }
    setBackupBusy(true);
    setOperationError('');
    try {
      const workbook = XLSX.utils.book_new();
      for (const sheet of sheets) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name.slice(0, 31));
      const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
      const response = await fetch('/api/provinces/isfahan/sites', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        body: bytes,
      });
      if (response.status === 501) XLSX.writeFile(workbook, 'ESF-sites.xlsx');
      else if (!response.ok) throw new Error(uiMessage(locale, 'rahcomSystemsLoadError'));
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : uiMessage(locale, 'rahcomSystemsLoadError'));
    } finally {
      setBackupBusy(false);
    }
  };

  const restoreSitesBackup = async () => {
    if (backupBusy || selectedProvince !== 'isfahan') return;
    const token = getAccessToken();
    if (!token) { setOperationError(uiMessage(locale, 'rahcomSystemsLoadError')); return; }
    setBackupBusy(true);
    setOperationError('');
    try {
      const response = await fetch('/api/provinces/isfahan/sites?source=backup', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!response.ok) throw new Error(uiMessage(locale, 'rahcomSystemsLoadError'));
      const workbook = XLSX.read(new Uint8Array(await response.arrayBuffer()), { type: 'array' });
      const restoredSheets = workbook.SheetNames.map((name) => ({
        name,
        rows: XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[name], { header: 1, raw: false, defval: '', blankrows: false }),
      }));
      if (!restoredSheets.length || !restoredSheets[0].rows.length) throw new Error(uiMessage(locale, 'rahcomSystemsLoadError'));
      const restoredHeaders = [...restoredSheets[0].rows[0]];
      let typeIndex = restoredHeaders.findIndex((header) => normalize(header) === normalize(siteTypeHeader));
      if (typeIndex < 0) { typeIndex = restoredHeaders.length; restoredHeaders.push(siteTypeHeader); }
      const restoredRows = restoredSheets[0].rows.slice(1).map((row) => {
        const normalized = [...row];
        while (normalized.length < restoredHeaders.length) normalized.push('');
        if (!normalized[typeIndex]) normalized[typeIndex] = 'USO';
        return normalized;
      });
      await rahcomApi.replaceSites('isfahan', restoredHeaders, restoredRows);
      restoredSheets[0] = { ...restoredSheets[0], rows: [restoredHeaders, ...restoredRows] };
      setSitesData({ province: 'isfahan', sheets: restoredSheets });
      setLoadErrorState(null);
      setQuery('');
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : uiMessage(locale, 'rahcomSystemsLoadError'));
    } finally {
      setBackupBusy(false);
    }
  };

  const toolbar = <RahcomDataListToolbar
    count={filteredRows.length > 0 && <RahcomTableCount label={`${numberFormat.format(filteredRows.length)} ${uiMessage(locale, 'rahcomSites')}`} title={uiMessage(locale, 'rahcomSites')}><RahcomSiteIcon size={16} />{numberFormat.format(filteredRows.length)}</RahcomTableCount>}
    download={{ label: uiMessage(locale, 'solarDownloadExcel'), onClick: downloadWorkbook, disabled: loading || sheets.length === 0 }}
    search={{ value: query, onChange: setQuery, placeholder: uiMessage(locale, 'rahcomSitesSearch'), label: uiMessage(locale, 'rahcomSitesSearch'), clearLabel: uiMessage(locale, 'searchClear') }}
    backup={canManage ? {
      open: backupActionsOpen,
      onToggle: toggleBackupActions,
      label: uiMessage(locale, 'rahcomSaveSitesBackup'),
      controlsId: 'sites-backup-actions',
      save: { label: uiMessage(locale, 'rahcomSaveSitesBackup'), onClick: () => void saveSitesBackup(), disabled: loading || selectedProvince !== 'isfahan' || sheets.length === 0, busy: backupBusy },
      restore: { label: uiMessage(locale, 'rahcomRestoreSitesBackup'), onClick: () => void restoreSitesBackup(), disabled: loading || selectedProvince !== 'isfahan', busy: backupBusy },
    } : undefined}
  />;

  return <RahcomDataListLayout
    dir={getLocaleDirection(locale)}
    toolbar={toolbar}
    isLoading={Boolean(loading)}
    loadingMessage={uiMessage(locale, 'reportsLoading')}
    error={loadError || undefined}
    emptyMessage={uiMessage(locale, query.trim() && headers.length > 0 ? 'rahcomSitesNoResults' : 'rahcomSitesEmpty')}
    hasRows={filteredRows.length > 0}
    beforeResults={operationError && <p role="alert" className="shrink-0 rounded-xl border border-destructive/30 p-3 text-sm text-destructive">{operationError}</p>}
  >
<DataTable className="rahcom-sticky-table w-max min-w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-10 bg-card text-muted-foreground">
          <tr><th scope="col" className="h-10 whitespace-nowrap border-b border-border bg-card px-3 text-center font-semibold">{uiMessage(locale, 'rahcomRowNumber')}</th><th scope="col" className="h-10 w-9 border-b border-border bg-card px-1 text-center font-semibold"><RahcomInfoHeader icon="tower" /></th><th scope="col" className="h-10 whitespace-nowrap border-b border-border bg-card px-3 text-start font-semibold">{siteTypeHeader}</th>{visibleHeaders.map(({ header, index }) => <th key={`${index}:${header}`} scope="col" className="h-10 whitespace-nowrap border-b border-border bg-card px-3 text-start font-semibold">{header || (isPersian ? 'ستون' : 'Column')}</th>)}<th scope="col" className="h-10 whitespace-nowrap border-b border-border bg-card px-3 text-start font-semibold">{isPersian ? 'شناسه قبض برق' : 'Electricity bill IDs'}</th></tr>
        </thead>
        <tbody>{filteredRows.map((row, rowIndex) => { const typeIndex = headers.findIndex((header) => normalize(header) === normalize(siteTypeHeader)); const siteType = row[typeIndex] || 'USO'; return <tr key={rowIndex} className="h-9 text-foreground hover:bg-muted/40"><td className="h-9 whitespace-nowrap border-b border-border/70 px-3 text-center tabular-nums">{numberFormat.format(rowIndex + 1)}</td><td className="h-9 w-9 border-b border-border/70 px-1 text-center"><RahcomRowInfo icon="tower" kind="site" title={row[0] || row[1] || (isPersian ? 'سایت' : 'Site')} systemCode={row[1] || row[2] || ''} fields={visibleHeaders.map(({ header, index }) => ({ label: header || (isPersian ? 'ستون' : 'Column'), value: row[index] ?? '' }))} editValue={siteType} onSaveEdit={canManage ? (value) => void saveSiteType(row, value) : undefined} /></td>
          <td className="h-9 whitespace-nowrap border-b border-border/70 px-3">{siteType}</td>
          {visibleHeaders.map(({ index }) => <td key={index} className="h-9 max-w-72 truncate whitespace-nowrap border-b border-border/70 px-3">{row[index] || '—'}</td>)}
          <td dir="ltr" className="h-9 max-w-72 border-b border-border/70 px-3">{(billIdsBySite.get(normalize(row[0] ?? '')) ?? billIdsBySite.get(normalize(row[1] ?? '')) ?? []).join(', ') || '—'}</td>
        </tr>; })}</tbody>
      </DataTable>
  </RahcomDataListLayout>;
}
