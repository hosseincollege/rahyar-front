'use client';

import { RahcomToolbar } from '@/components/rahcom/toolbar';
import { RahcomTableCount, RahcomTableFrame } from '@/components/rahcom/table';
import { DataTable } from '@/components/ui/data-table';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ArchiveRestore, Download, LoaderCircle, Save, Search, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { usePreferences } from '@/components/providers/preferences-provider';
import { getAccessToken } from '@/lib/api-client';
import { iranProvinces, rahcomApi } from '@/lib/api/rahcom/rahcom-api';
import { uiMessage } from '@/lib/ui-messages';
import { RahcomInfoHeader, RahcomRowInfo, RahcomSiteIcon } from '@/app/(workspace)/rahcom/_shared/rahcom-row-info';

type WorkbookSheet = { name: string; rows: string[][] };
type BillWorkbook = { headers: string[]; rows: string[][] };
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
  const [backupActionsOpen, setBackupActionsOpen] = useState(false);
  const [operationError, setOperationError] = useState('');
  const backupActionsRef = useRef<HTMLDivElement>(null);
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
    if (!backupActionsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!backupActionsRef.current?.contains(event.target as Node)) setBackupActionsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setBackupActionsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [backupActionsOpen]);

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
    if (!token || selectedProvince !== 'isfahan') { setBillWorkbook(null); return; }
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
    for (const sheet of sheets) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name.slice(0, 31));
    }
    XLSX.writeFile(workbook, 'uso-sites.xlsx');
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
      setSitesData({ province: 'isfahan', sheets: restoredSheets });
      setLoadErrorState(null);
      setQuery('');
      setBackupActionsOpen(false);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : uiMessage(locale, 'rahcomSystemsLoadError'));
    } finally {
      setBackupBusy(false);
    }
  };

  return <section dir="rtl" className="rahcom-page-toolbar flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 overflow-hidden">
    <RahcomToolbar as="header" className="rahcom-mobile-toolbar flex shrink-0 flex-nowrap items-center justify-start gap-2 overflow-x-auto overflow-y-hidden pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0">
      <RahcomTableCount label={`${numberFormat.format(filteredRows.length)} ${isPersian ? 'ردیف' : 'rows'}`} title={isPersian ? 'تعداد ردیف‌های فهرست' : 'Rows in list'}>
        <RahcomSiteIcon size={16} />{numberFormat.format(filteredRows.length)}
      </RahcomTableCount>
      <label className="rahcom-search-capsule rahcom-search-capsule--outer-focus relative block w-full max-w-[15rem] shrink-0 rounded-full">
        <Search aria-hidden="true" size={17} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isPersian ? 'جست‌وجو در سایت‌ها' : 'Search sites'} aria-label={isPersian ? 'جست‌وجو در سایت‌ها' : 'Search sites'} className="h-9 w-full rounded-full border border-border bg-background ps-9 pe-9 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary" />
        {query && <button type="button" onClick={() => setQuery('')} aria-label={uiMessage(locale, 'searchClear')} title={uiMessage(locale, 'searchClear')} className="absolute end-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><X size={14} /></button>}
      </label>
      <button type="button" onClick={downloadWorkbook} disabled={loading || sheets.length === 0} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50" aria-label={isPersian ? 'دانلود فایل اکسل سایت‌ها' : 'Download sites workbook'} title={isPersian ? 'دانلود اکسل استان‌های مجاز' : 'Download workbook for accessible provinces'}>
        <Download size={16} aria-hidden="true" />
      </button>
      {canManage && <div ref={backupActionsRef} className="flex shrink-0 items-center gap-2">
        <button type="button" aria-expanded={backupActionsOpen} aria-pressed={backupActionsOpen} aria-controls="sites-backup-actions" onClick={() => setBackupActionsOpen((open) => !open)} aria-label={uiMessage(locale, 'rahcomSaveSitesBackup')} title={uiMessage(locale, 'rahcomSaveSitesBackup')} style={backupActionsOpen ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`grid size-9 shrink-0 place-items-center rounded-full border transition-colors ${backupActionsOpen ? '' : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-primary'}`}><span aria-hidden="true" className="size-[26px] bg-current" style={{ maskImage: 'url(/cloud-sync-exact.svg)', WebkitMaskImage: 'url(/cloud-sync-exact.svg)', maskSize: 'contain', WebkitMaskSize: 'contain', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat', maskPosition: 'center', WebkitMaskPosition: 'center' }} /></button>
        {backupActionsOpen && <div id="sites-backup-actions" className="flex items-center gap-2">
          <button type="button" onClick={() => void saveSitesBackup()} disabled={backupBusy || loading || selectedProvince !== 'isfahan' || sheets.length === 0} aria-label={uiMessage(locale, 'rahcomSaveSitesBackup')} title={uiMessage(locale, 'rahcomSaveSitesBackup')} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground hover:border-primary hover:text-primary disabled:cursor-wait disabled:opacity-50">{backupBusy ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} aria-hidden="true" />}</button>
          <button type="button" onClick={() => void restoreSitesBackup()} disabled={backupBusy || loading || selectedProvince !== 'isfahan'} aria-label={uiMessage(locale, 'rahcomRestoreSitesBackup')} title={uiMessage(locale, 'rahcomRestoreSitesBackup')} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground hover:border-primary hover:text-primary disabled:cursor-wait disabled:opacity-50">{backupBusy ? <LoaderCircle size={17} className="animate-spin" /> : <ArchiveRestore size={17} aria-hidden="true" />}</button>
        </div>}
      </div>}
    </RahcomToolbar>
    {operationError && <p role="alert" className="shrink-0 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{operationError}</p>}
    <RahcomTableFrame className="flex-1">
      {loading ? <p role="status" className="p-5 text-sm text-muted-foreground">{isPersian ? 'در حال بارگذاری فهرست سایت‌ها…' : 'Loading sites…'}</p> : loadError ? <p role="alert" className="p-5 text-sm text-destructive">{loadError}</p> : headers.length > 0 ? <DataTable className="rahcom-sticky-table w-max min-w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-10 bg-card text-muted-foreground">
          <tr><th scope="col" className="h-10 whitespace-nowrap border-b border-border bg-card px-3 text-center font-semibold">{uiMessage(locale, 'rahcomRowNumber')}</th><th scope="col" className="h-10 w-9 border-b border-border bg-card px-1 text-center font-semibold"><RahcomInfoHeader icon="tower" /></th>{headers.map((header, index) => <th key={`${index}:${header}`} scope="col" className="h-10 whitespace-nowrap border-b border-border bg-card px-3 text-start font-semibold">{header || (isPersian ? 'ستون' : 'Column')}</th>)}<th scope="col" className="h-10 whitespace-nowrap border-b border-border bg-card px-3 text-start font-semibold">{isPersian ? 'شناسه قبض برق' : 'Electricity bill IDs'}</th></tr>
        </thead>
        <tbody>{filteredRows.map((row, rowIndex) => <tr key={rowIndex} className="h-9 text-foreground hover:bg-muted/40"><td className="h-9 whitespace-nowrap border-b border-border/70 px-3 text-center tabular-nums">{numberFormat.format(rowIndex + 1)}</td><td className="h-9 w-9 border-b border-border/70 px-1 text-center"><RahcomRowInfo icon="tower" kind="site" title={row[0] || row[1] || (isPersian ? 'سایت' : 'Site')} systemCode={row[1] || row[2] || ''} fields={headers.map((header, columnIndex) => ({ label: header || (isPersian ? 'ستون' : 'Column'), value: row[columnIndex] ?? '' }))} /></td>
          {headers.map((_, columnIndex) => <td key={columnIndex} className="h-9 max-w-72 truncate whitespace-nowrap border-b border-border/70 px-3">{row[columnIndex] || '—'}</td>)}
          <td dir="ltr" className="h-9 max-w-72 border-b border-border/70 px-3">{(billIdsBySite.get(normalize(row[0] ?? '')) ?? billIdsBySite.get(normalize(row[1] ?? '')) ?? []).join(', ') || '—'}</td>
        </tr>)}</tbody>
      </DataTable> : <p className="p-5 text-sm text-muted-foreground">{isPersian ? 'این برگه داده‌ای برای نمایش ندارد.' : 'This sheet has no data to display.'}</p>}
      {filteredRows.length === 0 && headers.length > 0 && <p className="p-5 text-sm text-muted-foreground">{isPersian ? 'موردی پیدا نشد.' : 'No matching rows found.'}</p>}
    </RahcomTableFrame>
  </section>;
}
