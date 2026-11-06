'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { usePreferences, getLocaleDirection } from '@/components/preferences-provider';
import { getAccessToken } from '@/lib/api-client';
import { rahcomApi, type RahcomSystem } from '@/lib/api/rahcom/rahcom-api';
import { uiMessage } from '@/lib/ui-messages';

type BillWorkbook = { headers: string[]; rows: string[][] };
const normalizeBillHeader = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa')
  .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c]/g, '').replace(/[\/\\_-]/g, '');

export function RahcomBillIdentifiers() {
  const { locale } = usePreferences();
  const direction = getLocaleDirection(locale);
  const [workbook, setWorkbook] = useState<BillWorkbook | null>(null);
  const [systems, setSystems] = useState<RahcomSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

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
  const systemNameByCode = useMemo(() => new Map(systems.map((system) => [
    system.systemCode.normalize('NFKC').trim().toUpperCase(), system.systemName,
  ])), [systems]);
  const getCellValue = useCallback((row: string[], columnIndex: number) => {
    if (columnIndex === -1) {
      const code = systemCodeIndex >= 0 ? row[systemCodeIndex]?.normalize('NFKC').trim().toUpperCase() : '';
      return (code && systemNameByCode.get(code)) || '';
    }
    return row[columnIndex] || '';
  }, [systemCodeIndex, systemNameByCode]);

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
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    if (!normalizedQuery) return visibleRows;
    return visibleRows.filter((row) => row.some((value) => value.toLocaleLowerCase(locale).includes(normalizedQuery))
      || getCellValue(row, -1).toLocaleLowerCase(locale).includes(normalizedQuery));
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
    ].map((aliases) => aliases.map(normalizeBillHeader));
    const dataColumns = orderedAliases.flatMap((aliases) => {
      const index = workbook.headers.findIndex((header) => aliases.includes(normalizeBillHeader(header)));
      return index < 0 ? [] : [{ index, header: workbook.headers[index] }];
    });
    const rowNumber = workbook.headers.findIndex((header) => normalizeBillHeader(header) === normalizeBillHeader('ردیف'));
    const systemCode = dataColumns.find((column) => column.index === systemCodeIndex);
    const billId = dataColumns.find((column) => ['شناسه قبض', 'شناسه قبض برق'].some((alias) => normalizeBillHeader(alias) === normalizeBillHeader(column.header)));
    return [
      ...(rowNumber >= 0 ? [{ index: rowNumber, header: workbook.headers[rowNumber] }] : []),
      { index: -1, header: uiMessage(locale, 'rahcomSystemName') },
      ...(systemCode ? [systemCode] : []),
      ...(billId ? [billId] : []),
      ...dataColumns.filter((column) => column !== systemCode && column !== billId),
    ];
  }, [locale, systemCodeIndex, workbook]);

  return <section dir={direction} className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
    <header className="rahcom-page-toolbar flex shrink-0 flex-wrap items-center justify-start gap-3">
      <label className="relative block w-full max-w-[15rem]">
        <Search aria-hidden="true" size={17} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={uiMessage(locale, 'headerSearch')} aria-label={uiMessage(locale, 'rahcomBillIdentifiersSearch')} className="h-9 w-full rounded-full border border-border bg-background ps-9 pe-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary" />
      </label>
    </header>
    {loading && <p role="status" className="shrink-0 p-4 text-sm text-muted-foreground">{uiMessage(locale, 'reportsLoading')}</p>}
    {!loading && !workbook?.headers.length && <p role="alert" className="shrink-0 rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{uiMessage(locale, 'rahcomBillIdentifiersLoadFailed')}</p>}
    {!loading && workbook?.headers.length && rows.length === 0 && <p className="shrink-0 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{query ? uiMessage(locale, 'searchNoResults') : uiMessage(locale, 'rahcomBillIdentifiersEmpty')}</p>}
    {!loading && workbook?.headers.length && rows.length > 0 && <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-card">
      <div className="min-h-full w-max min-w-full">
        <table className="rahcom-sticky-table w-full min-w-max text-sm">
          <thead className="bg-muted/50"><tr>{displayColumns.map(({ header, index }) => <th key={`${header}-${index}`} scope="col" className="whitespace-nowrap p-3 text-start">{header || '—'}</th>)}</tr></thead>
          <tbody>{rows.map((row, rowIndex) => <tr key={`${row[0] || 'bill'}-${rowIndex}`} className="border-t border-border">
            {displayColumns.map(({ header, index: columnIndex }) => {
              const value = getCellValue(row, columnIndex);
              const isCode = columnIndex === systemCodeIndex;
              return <td key={`${header}-${columnIndex}`} dir={isCode || columnIndex === 0 ? 'ltr' : 'auto'} title={value} className={`p-3 ${isCode || columnIndex === 0 ? 'whitespace-nowrap font-mono tabular-nums' : 'min-w-28'}`}>{value || '—'}</td>;
            })}
          </tr>)}</tbody>
        </table>
      </div>
    </div>}
  </section>;
}
