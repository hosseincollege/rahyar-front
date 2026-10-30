'use client';

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, FileUp, LoaderCircle, X } from 'lucide-react';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { getCurrentOrganizationId } from '@/lib/api/shared/auth-api';
import { settingsApi } from '@/app/(workspace)/settings/settings-api';
import { rahcomApi, type RahcomTrafficSnapshot } from '@/lib/api/rahcom/rahcom-api';

type TrafficUpload = Pick<RahcomTrafficSnapshot, 'fileName' | 'sheetName' | 'headers' | 'rows'>;
const normalizeHeader = (value: string) => value.trim().toLocaleLowerCase('fa').replace(/[\u200c\s]/g, '');

export function RahcomTrafficUpload() {
  const { locale } = usePreferences();
  const t = useCallback((key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key), [locale]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessLoading, setAccessLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [upload, setUpload] = useState<TrafficUpload | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) { setAccessLoading(false); return; }
    void settingsApi.getOrganizationAccess(organizationId).then((access) => {
      if (active) setIsAdmin(Boolean(access.canManageRahcom));
    }).catch(() => { if (active) setIsAdmin(false); }).finally(() => { if (active) setAccessLoading(false); });
    return () => { active = false; };
  }, []);

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setUpload(null); setError(''); setMessage('');
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { setError(t('rahcomTrafficFileTooLarge')); input.value = ''; return; }
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      let parsed: TrafficUpload | null = null;
      for (const sheetName of workbook.SheetNames) {
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false, blankrows: false });
        if (matrix.length < 2 || !Array.isArray(matrix[0])) continue;
        const rawHeaders = matrix[0].map((value) => String(value ?? '').trim());
        const normalized = rawHeaders.map(normalizeHeader);
        if (!normalized.some((value) => value.includes('کدسامانه')) || !normalized.some((value) => value.includes('استان'))) continue;
        const headers = rawHeaders.map((value, index) => value || `${t('rahcomTrafficColumn')} ${index + 1}`);
        const rows = matrix.slice(1).filter((row) => Array.isArray(row) && row.some((value) => value !== '' && value !== null && value !== undefined))
          .map((row) => headers.map((_, index) => String(row[index] ?? '').trim()));
        if (rows.length > 10000) throw new Error(t('rahcomTrafficTooManyRows'));
        if (!rows.length) throw new Error(t('rahcomTrafficEmptyFile'));
        parsed = { fileName: file.name, sheetName, headers, rows };
        break;
      }
      if (!parsed) throw new Error(t('rahcomTrafficRequiredColumns'));
      setUpload(parsed);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('rahcomTrafficReadFailed')); }
    finally { input.value = ''; }
  }

  async function save() {
    if (!upload) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await rahcomApi.createTrafficSnapshot(upload);
      const result = await rahcomApi.applyTrafficAxes();
      setMessage(`${t('rahcomTrafficAxesApplied')}: ${result.updatedSystems.toLocaleString('fa-IR')} · ${t('rahcomTrafficAxesUnmatched')}: ${result.unmatchedSystems.toLocaleString('fa-IR')} · ${t('rahcomTrafficAxesGroups')}: ${result.axisGroups.toLocaleString('fa-IR')}`);
      setUpload(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('rahcomTrafficSaveFailed')); }
    finally { setBusy(false); }
  }

  if (accessLoading || !isAdmin) return null;

  return <>
    <button type="button" aria-label={t('rahcomTrafficChooseFile')} title={t('rahcomTrafficChooseFile')} onClick={() => { setError(''); setMessage(''); setIsOpen(true); }} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground transition hover:bg-muted"><FileUp size={17} aria-hidden="true" /></button>
    {isOpen && <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setIsOpen(false); }}>
      <section dir="rtl" role="dialog" aria-modal="true" aria-label={t('rahcomTrafficChooseFile')} className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-4 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-foreground">{t('rahcomTrafficChooseFile')}</h2>
          <button type="button" disabled={busy} onClick={() => setIsOpen(false)} aria-label={t('closeSidebar')} className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-50"><X size={17} /></button>
        </div>
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-accent"><FileUp size={16} />{t('rahcomTrafficChooseFile')}<input type="file" accept=".xlsx,.xls" onChange={(event) => void readFile(event)} className="sr-only" /></label>
        {upload && <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-xs"><span className="min-w-0 truncate text-foreground">{upload.fileName}</span><span className="shrink-0 text-muted-foreground">{upload.rows.length.toLocaleString('fa-IR')} {t('rahcomTrafficRows')}</span></div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {message && <p role="status" className="text-xs text-primary">{message}</p>}
        {upload && <button type="button" disabled={busy} onClick={() => void save()} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}{t('rahcomTrafficRegister')}</button>}
      </section>
    </div>}
  </>;
}
