'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { FileText, Info, Paperclip } from 'lucide-react';
import { RahcomDataListLayout, RahcomDataListToolbar } from '@/components/rahcom/data-list-layout';
import { RahcomTableCount } from '@/components/rahcom/table';
import { DataTable } from '@/components/ui/data-table';
import { usePreferences, getLocaleDirection } from '@/components/providers/preferences-provider';
import { rahcomApi, type RahcomInvoiceAttachment, type RahcomInvoiceList } from '@/lib/api/rahcom/rahcom-api';
import { uiMessage } from '@/lib/ui-messages';
import { openRahcomRowInfo } from '@/app/(workspace)/rahcom/_shared/rahcom-row-info';
import { RahcomInvoiceAttachments } from './rahcom-invoice-attachments';

function normalizeSearch(value: string) {
  return value.trim().normalize('NFKC').toLocaleLowerCase('fa')
    .replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) >= 0x06f0 ? digit.charCodeAt(0) - 0x06f0 : digit.charCodeAt(0) - 0x0660))
    .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c\u200f\-â€“â€”ØŒ,.\/]+/g, '');
}

export default function RahcomInvoicesPage() {
  const { locale } = usePreferences();
  const direction = getLocaleDirection(locale);
  const [invoiceList, setInvoiceList] = useState<RahcomInvoiceList | null>(null);
  const [invoiceAttachments, setInvoiceAttachments] = useState<RahcomInvoiceAttachment[]>([]);
  const [province, setProvince] = useState('');
  const [activeInvoice, setActiveInvoice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [wrapTableText, setWrapTableText] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void rahcomApi.access().then(async (access) => {
      if (!access.selectedProvince) throw new Error('Select a province before viewing invoices.');
      const selectedProvince = access.selectedProvince;
      const data = await rahcomApi.invoices(selectedProvince);
      const attachments = await rahcomApi.invoiceAttachments(selectedProvince).catch(() => []);
      return { selectedProvince, data, attachments };
    }).then(({ selectedProvince, data, attachments }) => {
      if (active) {
        setProvince(selectedProvince);
        setInvoiceList(data);
        setInvoiceAttachments(attachments);
      }
    }).catch(() => {
      if (active) setError(locale === 'fa' ? 'دریافت فاکتورها انجام نشد.' : 'Invoices could not be loaded.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [locale]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    if (!normalizedQuery) return invoiceList?.rows ?? [];
    return (invoiceList?.rows ?? []).filter((row) => row.some((cell) => normalizeSearch(cell).includes(normalizedQuery)));
  }, [invoiceList, query]);

  const downloadDisplayedTable = useCallback(() => {
    if (!invoiceList) return;
    const sheet = XLSX.utils.aoa_to_sheet([invoiceList.headers, ...filteredRows]);
    sheet['!cols'] = invoiceList.headers.map((header, index) => ({ wch: index === 8 ? 58 : header.includes('شبا') ? 30 : 24 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'فاکتورها');
    XLSX.writeFile(workbook, 'فاکتورهای-رهکام-اصفهان.xlsx');
  }, [filteredRows, invoiceList]);

  const headers = invoiceList?.headers ?? [];
  const attachmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const attachment of invoiceAttachments) counts.set(attachment.invoiceNumber, (counts.get(attachment.invoiceNumber) ?? 0) + 1);
    return counts;
  }, [invoiceAttachments]);
  const addAttachment = useCallback((attachment: RahcomInvoiceAttachment) => {
    setInvoiceAttachments((current) => [...current, attachment]);
  }, []);
  return <>
  <RahcomDataListLayout
    dir={direction}
    toolbar={<RahcomDataListToolbar
      count={<RahcomTableCount count={filteredRows.length} label={locale === 'fa' ? 'تعداد فاکتورها' : 'Invoice count'}><FileText size={16} className="text-primary" aria-hidden="true" />{new Intl.NumberFormat(locale).format(filteredRows.length)}</RahcomTableCount>}
      add={{ label: uiMessage(locale, 'rahcomAdd'), disabled: true }}
      upload={{ label: uiMessage(locale, 'rahcomUploadExcel'), disabled: true }}
      wrap={{ label: uiMessage(locale, 'rahcomWrapLongTableText'), singleLineLabel: uiMessage(locale, 'rahcomKeepTableTextSingleLine'), pressed: wrapTableText, onToggle: () => setWrapTableText((value) => !value) }}
      download={{ label: uiMessage(locale, 'solarDownloadExcel'), onClick: downloadDisplayedTable, disabled: !invoiceList }}
      search={{ value: query, onChange: setQuery, placeholder: uiMessage(locale, 'rahcomInvoicesSearch'), label: uiMessage(locale, 'rahcomInvoicesSearch') }}
      backup={{ open: false, onToggle: () => undefined, label: uiMessage(locale, 'rahcomSaveSystemsBackup'), disabled: true, save: { label: uiMessage(locale, 'rahcomSaveSystemsBackup'), disabled: true }, restore: { label: uiMessage(locale, 'rahcomRestoreSystemsBackup'), disabled: true } }}
    />}
    isLoading={loading}
    loadingMessage={uiMessage(locale, 'reportsLoading')}
    error={error}
    emptyMessage={query.trim() ? uiMessage(locale, 'rahcomInvoicesNoResults') : uiMessage(locale, 'rahcomInvoicesEmpty')}
    hasRows={filteredRows.length > 0}
  >
    <DataTable className={`rahcom-sticky-table w-full min-w-max text-sm ${wrapTableText ? 'rahcom-invoices-wrap' : ''}`}>
      <thead className="bg-muted/50"><tr>{headers.map((header, index) => <th key={`${header}-${index}`} scope="col" className="whitespace-nowrap px-3 py-2 text-center font-semibold text-foreground">{header}</th>)}<th scope="col" className="whitespace-nowrap px-3 py-2 text-center font-semibold text-foreground">پیوست‌ها</th></tr></thead>
      <tbody>{filteredRows.map((row, rowIndex) => <tr key={`${row[0] || 'note'}-${rowIndex}`} className="border-t border-border">
        {headers.map((header, columnIndex) => <td key={`${header}-${columnIndex}`} dir={columnIndex === 0 || columnIndex === 4 || header.includes('شبا') || header.includes('کد سامانه') ? 'ltr' : 'auto'} className={`max-w-72 overflow-hidden px-3 py-1 text-center text-foreground ${columnIndex === 0 || columnIndex === 4 || header.includes('شبا') || header.includes('کد سامانه') ? 'whitespace-nowrap font-mono tabular-nums' : wrapTableText ? 'whitespace-normal break-words' : 'truncate whitespace-nowrap'} ${columnIndex === 8 ? 'min-w-80' : ''}`}>
          {columnIndex === 0 ? <span className="inline-flex items-center justify-center gap-1.5"><button type="button" aria-label={locale === 'fa' ? `نمایش جزئیات سند ${row[0] || 'گروه'}` : `Show details for invoice ${row[0] || 'group note'}`} title={locale === 'fa' ? 'نمایش جزئیات کامل' : 'Show full details'} aria-haspopup="dialog" aria-expanded="false" onClick={(event) => openRahcomRowInfo(row[0] || (locale === 'fa' ? 'یادداشت گروه' : 'Group note'), headers.map((label, index) => ({ label, value: row[index] ?? '' })), event.currentTarget, { x: event.clientX, y: event.clientY })} className="inline-grid size-6 place-items-center rounded-full text-muted-foreground transition-colors hover:text-primary aria-expanded:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" data-rahcom-info-trigger><Info size={14} aria-hidden="true" /></button>{row[columnIndex] || '—'}</span> : row[columnIndex] || '—'}
        </td>)}
        <td className="whitespace-nowrap px-3 py-1 text-center">
          {/^[0-9]+$/.test(row[0] ?? '') && <button type="button" onClick={() => setActiveInvoice(row[0])} aria-label={`پیوست‌های سند ${row[0]}`} title="ذخیره یا نمایش تصاویر سند" className="inline-flex h-8 items-center gap-1 rounded-full border border-border px-3 text-xs hover:border-primary hover:text-primary"><Paperclip size={15} />{new Intl.NumberFormat(locale).format(attachmentCounts.get(row[0]) ?? 0)}</button>}
        </td>
      </tr>)}</tbody>
    </DataTable>
  </RahcomDataListLayout>
  {activeInvoice && province && <RahcomInvoiceAttachments
    invoiceNumber={activeInvoice}
    province={province}
    attachments={invoiceAttachments}
    onAdded={addAttachment}
    open
    onClose={() => setActiveInvoice(null)}
  />}
  </>;
}
