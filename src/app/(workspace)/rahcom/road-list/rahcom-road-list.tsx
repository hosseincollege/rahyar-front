'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { ChevronLeft, ChevronRight, FileUp, LoaderCircle } from 'lucide-react';
import { usePreferences, getLocaleDirection } from '@/components/preferences-provider';
import { getCurrentOrganizationId } from '@/lib/api/shared/auth-api';
import { settingsApi } from '@/app/(workspace)/settings/settings-api';
import { uiMessage } from '@/lib/ui-messages';
import { iranProvinces, rahcomApi, type RahcomRoadListSnapshot, type RahcomTrafficSnapshot } from '@/lib/api/rahcom/rahcom-api';
import { useRahcomDate } from '@/app/(workspace)/rahcom/_shared/rahcom-date';
import { tehranDateKey } from '@/lib/api/rahcom/solar-status';

const PAGE_SIZE = 100;
const normalizeHeader = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa')
  .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\u200c\s_\-./()]/g, '');
const normalizeIdentifier = (value: unknown) => String(value ?? '').normalize('NFKC')
  .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
  .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
  .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9')
  .replace(/[\u200c\s]/g, '').toLocaleUpperCase('fa');
const hasTableData = (snapshot: RahcomRoadListSnapshot) => Array.isArray(snapshot.headers)
  && Array.isArray(snapshot.rows)
  && snapshot.headers.every((header) => typeof header === 'string')
  && snapshot.rows.every((row) => Array.isArray(row));

export function RahcomRoadList() {
  const { locale } = usePreferences();
  const { date } = useRahcomDate();
  const selectedDate = date ?? tehranDateKey();
  const t = useCallback((key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key), [locale]);
  const [canView, setCanView] = useState<boolean | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [province, setProvince] = useState('');
  const [snapshot, setSnapshot] = useState<RahcomRoadListSnapshot | null>(null);
  const [traffic, setTraffic] = useState<RahcomTrafficSnapshot | null>(null);
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) { setCanView(false); setLoading(false); return; }
    void Promise.all([settingsApi.getOrganizationAccess(organizationId), rahcomApi.access()])
      .then(([organizationAccess, rahcomAccess]) => {
        if (!active) return;
        setCanView(Boolean(organizationAccess.canViewRahcom));
        setCanManage(Boolean(organizationAccess.canManageRahcom));
        if (rahcomAccess.selectedProvince && rahcomAccess.selectedProvince !== 'all') setProvince(rahcomAccess.selectedProvince);
        else if (!rahcomAccess.isAdmin && rahcomAccess.province) setProvince(rahcomAccess.province);
      })
      .catch(() => { if (active) setCanView(false); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!province || canView !== true) { setSnapshot(null); setTraffic(null); return; }
    let active = true;
    setSnapshot(null);
    setTraffic(null);
    setLoading(true);
    setError('');
    void Promise.all([rahcomApi.roadList(province, selectedDate), rahcomApi.trafficSnapshot(province, selectedDate)])
      .then(([result, trafficResult]) => {
        if (!active) return;
        if (result && !hasTableData(result)) {
          setSnapshot(null);
          setError(t('rahcomRoadListInvalidFile'));
          return;
        }
        setSnapshot(result);
        setTraffic(trafficResult && Array.isArray(trafficResult.headers) && Array.isArray(trafficResult.rows)
          ? { ...trafficResult, headers: trafficResult.headers.map((header) => String(header ?? '')), rows: trafficResult.rows.filter(Array.isArray).map((row) => row.map((cell) => String(cell ?? ''))) }
          : null);
        setPage(0);
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : t('rahcomRoadListInvalidFile')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [province, canView, t, selectedDate]);

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setError('');
    setMessage('');
    if (!file) return;
    if (!province) { setError(t('rahcomRoadListChooseProvince')); input.value = ''; return; }
    if (file.size > 20 * 1024 * 1024) { setError(t('rahcomRoadListFileTooLarge')); input.value = ''; return; }
    setBusy(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      let upload: Pick<RahcomRoadListSnapshot, 'province' | 'fileName' | 'sheetName' | 'headers' | 'rows'> & { listDate: string } | null = null;
      for (const sheetName of workbook.SheetNames) {
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false, blankrows: false });
        const headerIndex = matrix.findIndex((row) => Array.isArray(row) && row.some((cell) => {
          const normalized = normalizeHeader(String(cell ?? ''));
          return normalized.includes('\u0627\u0633\u062a\u0627\u0646') || normalized === 'province';
        }));
        if (headerIndex < 0 || !Array.isArray(matrix[headerIndex])) continue;
        const rawHeaders = matrix[headerIndex].map((value) => String(value ?? '').trim());
        if (!rawHeaders.length || rawHeaders.length > 100) continue;
        const headers = rawHeaders.map((value, index) => value || `${t('rahcomTrafficColumn')} ${index + 1}`);
        const rows = matrix.slice(headerIndex + 1)
          .filter((row) => Array.isArray(row) && row.some((value) => value !== '' && value !== null && value !== undefined))
          .map((row) => headers.map((_, index) => String(row[index] ?? '').trim()));
        if (!rows.length) throw new Error(t('rahcomRoadListInvalidFile'));
        if (rows.length > 10000) throw new Error(t('rahcomTrafficTooManyRows'));
        const payload = { province, listDate: selectedDate, fileName: file.name, sheetName, headers, rows };
        if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > 8 * 1024 * 1024) throw new Error(t('rahcomRoadListFileTooLarge'));
        upload = payload;
        break;
      }
      if (!upload) throw new Error(t('rahcomRoadListInvalidFile'));
      const saved = await rahcomApi.replaceRoadList(upload);
      if (!hasTableData(saved)) throw new Error(t('rahcomRoadListInvalidFile'));
      setSnapshot(saved);
      setPage(0);
      setMessage(t('rahcomRoadListUploadDone'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('rahcomRoadListInvalidFile'));
    } finally {
      input.value = '';
      setBusy(false);
    }
  }

  const visibleRows = useMemo(() => (Array.isArray(snapshot?.rows) ? snapshot.rows : [])
    .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [snapshot, page]);
  const headers = Array.isArray(snapshot?.headers) ? snapshot.headers : [];
  const identifierIndex = headers.findIndex((header) => normalizeHeader(header).includes('\u0634\u0646\u0627\u0633\u0647') || normalizeHeader(header) === 'id');
  const trafficMatches = useMemo(() => {
    const trafficHeaders = Array.isArray(traffic?.headers) ? traffic.headers : [];
    const aggregationIndex = trafficHeaders.findIndex((header) => {
      const normalized = normalizeHeader(header);
      return normalized.includes('\u06a9\u062f\u062a\u062c\u0645\u06cc\u0639') || normalized.includes('aggregationcode') || normalized.includes('aggregatecode');
    });
    const systemCodeIndex = trafficHeaders.findIndex((header) => {
      const normalized = normalizeHeader(header);
      return normalized.includes('\u06a9\u062f\u0633\u0627\u0645\u0627\u0646\u0647') || normalized === 'systemcode';
    });
    const systemNameIndex = trafficHeaders.findIndex((header) => {
      const normalized = normalizeHeader(header);
      return normalized.includes('\u0646\u0627\u0645\u0627\u06cc\u0633\u062a\u06af\u0627\u0647') || normalized.includes('\u0646\u0627\u0645\u0633\u0627\u0645\u0627\u0646\u0647') || normalized === 'systemname';
    });
    const provinceIndex = trafficHeaders.findIndex((header) => normalizeHeader(header).includes('\u0627\u0633\u062a\u0627\u0646') || normalizeHeader(header) === 'province');
    const provinceLabel = iranProvinces.find(([id]) => id === province)?.[1] ?? province;
    const validProvinces = new Set([normalizeIdentifier(province), normalizeIdentifier(provinceLabel)]);
    const matches = new Map<string, Array<{ systemCode: string; systemName: string }>>();
    if (aggregationIndex < 0 || systemCodeIndex < 0 || systemNameIndex < 0) return matches;
    for (const row of traffic?.rows ?? []) {
      const rowProvince = provinceIndex >= 0 ? normalizeIdentifier(row[provinceIndex]) : '';
      if (rowProvince && !validProvinces.has(rowProvince)) continue;
      const aggregationCode = normalizeIdentifier(row[aggregationIndex]);
      if (!aggregationCode) continue;
      const candidates = matches.get(aggregationCode) ?? [];
      candidates.push({ systemCode: String(row[systemCodeIndex] ?? '').trim(), systemName: String(row[systemNameIndex] ?? '').trim() });
      matches.set(aggregationCode, candidates);
    }
    return matches;
  }, [province, traffic]);
  const pageCount = Math.max(1, Math.ceil((snapshot?.rowCount ?? 0) / PAGE_SIZE));
  if (loading && canView === null) return <main dir={getLocaleDirection(locale)} className="mx-auto max-w-6xl rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{t('rahcomSystemsLoading')}</main>;
  if (!canView) return <main dir={getLocaleDirection(locale)} className="mx-auto max-w-6xl rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">{uiMessage(locale, 'rahcomAccessDenied')}</main>;

  return <main dir={getLocaleDirection(locale)} className="mx-auto max-w-6xl space-y-4">
    <header className="flex flex-wrap justify-end gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        {canManage && <label aria-label={t('rahcomRoadListChooseFile')} title={t('rahcomRoadListChooseFile')} className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-border bg-background px-3 text-sm text-foreground transition hover:border-primary hover:text-primary ${busy || !province ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
          {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <FileUp size={16} aria-hidden="true" />}
          <span>{busy ? t('rahcomRoadListUploading') : t('rahcomRoadListChooseFile')}</span>
          <input type="file" accept=".xlsx,.xls" disabled={busy || !province} onChange={(event) => void uploadFile(event)} className="sr-only" />
        </label>}
      </div>
    </header>

    {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-primary">{message}</p>}
    {!province ? <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{t('rahcomRoadListChooseProvince')}</p> : loading ? <p role="status" className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{t('rahcomSystemsLoading')}</p> : error ? null : !snapshot ? <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{t('rahcomRoadListNoData')}</p> : <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 text-sm">
        <div className="min-w-0 truncate text-foreground"><span className="text-muted-foreground">{snapshot.fileName}</span></div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{t('rahcomRoadListRows')}: {new Intl.NumberFormat(locale).format(snapshot.rowCount)}</span>
          <span>{t('rahcomRoadListLastUpdated')}: {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(new Date(snapshot.importedAt))}</span>
        </div>
      </div>
      <div className="max-h-[68vh] overflow-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-muted text-start text-xs text-muted-foreground"><tr>
            <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold whitespace-nowrap">{t('rahcomRowNumber')}</th>
            <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold whitespace-nowrap">{t('rahcomSystemCode')}</th>
            <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold whitespace-nowrap">{t('rahcomSystemName')}</th>
            {headers.map((header, index) => <th key={`${header}-${index}`} scope="col" className="max-w-64 border-b border-border px-3 py-2.5 font-semibold whitespace-normal">{header}</th>)}
          </tr></thead>
          <tbody>{visibleRows.map((row, rowIndex) => {
            const identifier = identifierIndex >= 0 ? normalizeIdentifier(row[identifierIndex]) : '';
            const candidates = identifier ? trafficMatches.get(identifier) ?? [] : [];
            const match = candidates.length === 1 ? candidates[0] : null;
            return <tr key={page * PAGE_SIZE + rowIndex} className="odd:bg-background even:bg-muted/30">
              <td className="border-b border-border/70 px-3 py-2 text-center tabular-nums text-foreground">{new Intl.NumberFormat(locale).format(page * PAGE_SIZE + rowIndex + 1)}</td>
              <td dir="ltr" className="border-b border-border/70 px-3 py-2 font-mono text-foreground">{match?.systemCode || '—'}</td>
              <td className="border-b border-border/70 px-3 py-2 align-top text-foreground whitespace-pre-wrap">{match?.systemName || '—'}</td>
              {headers.map((_, columnIndex) => <td key={columnIndex} className="max-w-80 border-b border-border/70 px-3 py-2 align-top text-foreground whitespace-pre-wrap">{row[columnIndex] ?? ''}</td>)}
            </tr>;
          })}</tbody>
        </table>
      </div>
      {pageCount > 1 && <div className="flex items-center justify-center gap-3 border-t border-border p-3 text-sm">
        <button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label={t('rahcomRoadListPreviousPage')} className="grid size-8 place-items-center rounded-full border border-border text-foreground disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight size={16} /></button>
        <span className="tabular-nums text-muted-foreground">{new Intl.NumberFormat(locale).format(page + 1)} / {new Intl.NumberFormat(locale).format(pageCount)}</span>
        <button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} aria-label={t('rahcomRoadListNextPage')} className="grid size-8 place-items-center rounded-full border border-border text-foreground disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={16} /></button>
      </div>}
    </section>}
  </main>;
}
