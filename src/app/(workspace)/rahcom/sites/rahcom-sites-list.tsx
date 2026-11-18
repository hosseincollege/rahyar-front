'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Download, MapPin, Search, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { usePreferences } from '@/components/preferences-provider';
import { iranProvinces, rahcomApi } from '@/lib/api/rahcom/rahcom-api';
import { uiMessage } from '@/lib/ui-messages';

type WorkbookSheet = { name: string; rows: string[][] };
const normalize = (value: string) => value.trim().normalize('NFKC').replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c\u200f]/g, '').toLocaleLowerCase();

export function RahcomSitesList({ selectedProvince = 'all' }: { selectedProvince?: string }) {
  const { locale } = usePreferences();
  const [sitesData, setSitesData] = useState<{ province: string; sheets: WorkbookSheet[] } | null>(null);
  const [loadErrorState, setLoadErrorState] = useState<{ province: string; message: string } | null>(null);
  const sheets = useMemo(() => sitesData?.province === selectedProvince ? sitesData.sheets : [], [selectedProvince, sitesData]);
  const loading = sitesData?.province !== selectedProvince && loadErrorState?.province !== selectedProvince;
  const loadError = loadErrorState?.province === selectedProvince ? loadErrorState.message : '';
  const [selectedSheetName, setSelectedSheetName] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const activeSheet = sheets.find((sheet) => sheet.name === selectedSheetName) ?? sheets[0];
  const headers = activeSheet?.rows[0] ?? [];
  const provinceLabel = iranProvinces.find(([id]) => id === selectedProvince)?.[1] ?? selectedProvince;
  const filteredRows = useMemo(() => {
    const sheet = sheets.find((item) => item.name === selectedSheetName);
    if (!sheet) return [];
    const search = normalize(deferredQuery);
    const headers = sheet.rows[0] ?? [];
    const provinceIndex = headers.findIndex((header) => ['استان', 'استانسایت', 'ناماستان'].includes(normalize(header)));
    return sheet.rows.slice(1).filter((row) => {
      if (selectedProvince !== 'all' && provinceIndex >= 0 && normalize(row[provinceIndex] ?? '') !== normalize(provinceLabel)) return false;
      if (!search) return true;
      return row.some((cell) => normalize(cell).includes(search));
    });
  }, [deferredQuery, provinceLabel, selectedProvince, selectedSheetName, sheets]);
  const pageSize = 100;
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visiblePage = Math.min(page, pageCount - 1);
  const visibleRows = filteredRows.slice(visiblePage * pageSize, (visiblePage + 1) * pageSize);
  const isPersian = locale === 'fa';
  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  useEffect(() => {
    let active = true;
    void rahcomApi.sites(selectedProvince).then((result) => {
      if (!active) return;
      setSitesData({ province: selectedProvince, sheets: result });
      setLoadErrorState(null);
      setSelectedSheetName((current) => result.some((sheet) => sheet.name === current) ? current : result[0]?.name ?? '');
      setPage(0);
    }).catch((error: unknown) => {
      if (!active) return;
      setLoadErrorState({ province: selectedProvince, message: error instanceof Error ? error.message : (isPersian ? 'بارگذاری فهرست سایت‌ها انجام نشد.' : 'Could not load the sites list.') });
    });
    return () => { active = false; };
  }, [isPersian, selectedProvince]);

  const downloadWorkbook = () => {
    const workbook = XLSX.utils.book_new();
    for (const sheet of sheets) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name.slice(0, 31));
    }
    XLSX.writeFile(workbook, 'uso-sites.xlsx');
  };

  return <section dir="rtl" className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border p-3">
      <label className="rahcom-search-capsule rahcom-search-capsule--outer-focus inline-flex h-9 w-52 shrink-0 items-center gap-2 rounded-full border border-border bg-background px-3 text-foreground focus-within:border-primary">
        <Search size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder={isPersian ? 'جست‌وجو در سایت‌ها' : 'Search sites'} aria-label={isPersian ? 'جست‌وجو در سایت‌ها' : 'Search sites'} className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground focus:outline-none focus:ring-0" />
        {query && <button type="button" onClick={() => { setQuery(''); setPage(0); }} aria-label={uiMessage(locale, 'searchClear')} title={uiMessage(locale, 'searchClear')} className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><X size={14} /></button>}
      </label>
      <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm text-foreground" title={isPersian ? 'تعداد ردیف‌های فهرست' : 'Rows in list'}>
        <MapPin size={15} className="text-muted-foreground" aria-hidden="true" />
        <strong className="font-bold tabular-nums">{numberFormat.format(filteredRows.length)}</strong>
        <span className="text-muted-foreground">{isPersian ? 'ردیف' : 'rows'}</span>
      </span>
      <button type="button" onClick={downloadWorkbook} disabled={loading || sheets.length === 0} className="ms-auto inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-border bg-background px-3 text-sm text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50" aria-label={isPersian ? 'دانلود فایل اکسل سایت‌ها' : 'Download sites workbook'} title={isPersian ? 'دانلود اکسل استان‌های مجاز' : 'Download workbook for accessible provinces'}>
        <Download size={16} aria-hidden="true" /><span>{isPersian ? 'دانلود اکسل' : 'Download Excel'}</span>
      </button>
    </div>
    <div role="tablist" aria-label={isPersian ? 'برگه‌های فایل سایت‌ها' : 'Site workbook sheets'} className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 pt-2">
      {sheets.map((sheet) => <button key={sheet.name} type="button" role="tab" aria-selected={selectedSheetName === sheet.name} onClick={() => { setSelectedSheetName(sheet.name); setPage(0); }} style={selectedSheetName === sheet.name ? { color: 'var(--primary)', borderBottomColor: 'var(--primary)' } : undefined} className={`max-w-64 shrink-0 truncate border-b-2 px-3 pb-2 text-sm font-semibold transition-colors ${selectedSheetName === sheet.name ? '' : 'border-transparent text-muted-foreground hover:text-foreground'}`} title={sheet.name}>{sheet.name}</button>)}
    </div>
    <div className="min-h-0 min-w-0 flex-1 overflow-auto">
      {loading ? <p role="status" className="p-5 text-sm text-muted-foreground">{isPersian ? 'در حال بارگذاری فهرست سایت‌ها…' : 'Loading sites…'}</p> : loadError ? <p role="alert" className="p-5 text-sm text-destructive">{loadError}</p> : headers.length > 0 ? <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-10 bg-card text-muted-foreground">
          <tr>{headers.map((header, index) => <th key={`${index}:${header}`} scope="col" className="h-10 whitespace-nowrap border-b border-border bg-card px-3 text-start font-semibold">{header || (isPersian ? 'ستون' : 'Column')}</th>)}</tr>
        </thead>
        <tbody>{visibleRows.map((row, rowIndex) => <tr key={`${page * pageSize + rowIndex}`} className="h-9 text-foreground hover:bg-muted/40">
          {headers.map((_, columnIndex) => <td key={columnIndex} title={row[columnIndex] ?? ''} className="h-9 max-w-72 truncate whitespace-nowrap border-b border-border/70 px-3">{row[columnIndex] || '—'}</td>)}
        </tr>)}</tbody>
      </table> : <p className="p-5 text-sm text-muted-foreground">{isPersian ? 'این برگه داده‌ای برای نمایش ندارد.' : 'This sheet has no data to display.'}</p>}
      {visibleRows.length === 0 && headers.length > 0 && <p className="p-5 text-sm text-muted-foreground">{isPersian ? 'موردی پیدا نشد.' : 'No matching rows found.'}</p>}
    </div>
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-3 py-2 text-sm text-muted-foreground">
      <span>{isPersian ? `${numberFormat.format(filteredRows.length)} ردیف` : `${numberFormat.format(filteredRows.length)} rows`}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0} className="h-8 rounded-full border border-border bg-background px-3 disabled:cursor-not-allowed disabled:opacity-45">{isPersian ? 'قبلی' : 'Previous'}</button>
        <span className="tabular-nums">{numberFormat.format(visiblePage + 1)} / {numberFormat.format(pageCount)}</span>
        <button type="button" onClick={() => setPage((value) => Math.min(pageCount - 1, Math.min(value, pageCount - 1) + 1))} disabled={visiblePage >= pageCount - 1} className="h-8 rounded-full border border-border bg-background px-3 disabled:cursor-not-allowed disabled:opacity-45">{isPersian ? 'بعدی' : 'Next'}</button>
      </div>
    </div>
  </section>;
}
