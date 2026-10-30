'use client';

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { FileUp, LoaderCircle } from 'lucide-react';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { getCurrentOrganizationId } from '@/lib/api/shared/auth-api';
import { settingsApi } from '@/app/(workspace)/settings/settings-api';
import { rahcomApi, type RahcomTrafficSnapshot } from '@/lib/api/rahcom/rahcom-api';

type TrafficUpload = Pick<RahcomTrafficSnapshot, 'fileName' | 'sheetName' | 'headers' | 'rows'>;
const normalizeHeader = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa')
  .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\u200c\s_\-./()]/g, '');

export function RahcomTrafficUpload() {
  const { locale } = usePreferences();
  const t = useCallback((key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key), [locale]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessLoading, setAccessLoading] = useState(true);
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

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setError('');
    setMessage('');
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { setError(t('rahcomTrafficFileTooLarge')); input.value = ''; return; }
    setBusy(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      let upload: TrafficUpload | null = null;
      for (const sheetName of workbook.SheetNames) {
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false, blankrows: false });
        if (matrix.length < 2 || !Array.isArray(matrix[0])) continue;
        const rawHeaders = matrix[0].map((value) => String(value ?? '').trim());
        const normalized = rawHeaders.map(normalizeHeader);
        const hasSystemCode = normalized.some((value) => value.includes('کدسامانه') || value.includes('systemcode') || value === 'code' || value === 'sitecode');
        const hasProvince = normalized.some((value) => value.includes('استان') || value.includes('province'));
        if (!hasSystemCode || !hasProvince) continue;
        const headers = rawHeaders.map((value, index) => value || `${t('rahcomTrafficColumn')} ${index + 1}`);
        const rows = matrix.slice(1).filter((row) => Array.isArray(row) && row.some((value) => value !== '' && value !== null && value !== undefined))
          .map((row) => headers.map((_, index) => String(row[index] ?? '').trim()));
        if (rows.length > 10000) throw new Error(t('rahcomTrafficTooManyRows'));
        if (!rows.length) throw new Error(t('rahcomTrafficEmptyFile'));
        upload = { fileName: file.name, sheetName, headers, rows };
        break;
      }
      if (!upload) throw new Error(t('rahcomTrafficRequiredColumns'));

      await rahcomApi.createTrafficSnapshot(upload);
      const result = await rahcomApi.applyTrafficAxes();
      setMessage(`${t('rahcomTrafficAxesApplied')}: ${result.updatedSystems.toLocaleString(locale)} · ${t('rahcomTrafficAxesUnmatched')}: ${result.unmatchedSystems.toLocaleString(locale)} · ${t('rahcomTrafficAxesGroups')}: ${result.axisGroups.toLocaleString(locale)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('rahcomTrafficSaveFailed'));
    } finally {
      input.value = '';
      setBusy(false);
    }
  }

  if (accessLoading || !isAdmin) return null;

  return <div className="inline-flex shrink-0 items-center gap-2">
    <label aria-label={t('rahcomTrafficChooseFile')} title={t('rahcomTrafficChooseFile')} className={`grid size-9 place-items-center rounded-full border border-border bg-background text-foreground transition hover:bg-muted ${busy ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}>
      {busy ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <FileUp size={17} aria-hidden="true" />}
      <input type="file" accept=".xlsx,.xls" disabled={busy} onChange={(event) => void uploadFile(event)} className="sr-only" />
    </label>
    {error && <span role="alert" className="max-w-64 text-xs text-destructive">{error}</span>}
    {message && <span role="status" className="max-w-64 text-xs text-primary">{message}</span>}
  </div>;
}
