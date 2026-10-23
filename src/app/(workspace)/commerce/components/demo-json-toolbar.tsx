'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { getCurrentUser } from '@/lib/api/shared/auth-api';

type Dataset = Record<string, unknown[]>;

function storageKey(module: string) {
  const user = getCurrentUser();
  return `erp-demo-dataset:${user?.organizationId ?? 'no-organization'}:${user?.id ?? 'no-user'}:${module}`;
}

export function useDemoDataset<T extends Dataset>(module: string, seed: T) {
  const [data, setData] = useState<T>(seed);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(module));
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const value = parsed as Record<string, unknown>;
          const valid = Object.keys(seed).every((key) => Array.isArray(value[key]) && (value[key] as unknown[]).every((row) => row && typeof row === 'object' && !Array.isArray(row)));
          if (valid) setData(Object.fromEntries(Object.keys(seed).map((key) => [key, value[key]])) as T);
        }
      }
    } catch {
      localStorage.removeItem(storageKey(module));
    } finally {
      setHydrated(true);
    }
  }, [module]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(storageKey(module), JSON.stringify(data));
  }, [data, hydrated, module]);

  return [data, setData, hydrated] as const;
}

export function DemoJsonToolbar({
  fileName,
  module,
  data,
  sampleData,
  onImport,
  onImportError,
}: {
  fileName: string;
  module: string;
  data: Dataset;
  sampleData?: Dataset;
  onImport: (dataset: Dataset) => void | Promise<void>;
  onImportError?: (error: unknown) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { locale } = usePreferences();

  function download() {
    const exportData = Object.fromEntries(Object.keys(data).map((key) => [key, data[key]?.length ? data[key] : sampleData?.[key] ?? []]));
    const blob = new Blob([JSON.stringify({ format: 'erp-demo-v1', module, ...exportData }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importFile(file?: File) {
    if (!file) return;
    let next: Dataset;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
      const value = parsed as Record<string, unknown>;
      if (value.format !== 'erp-demo-v1' || value.module !== module) throw new Error('invalid');
      const entries = Object.entries(data);
      next = {};
      for (const [key] of entries) {
        const rows = value[key];
        if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('invalid');
        next[key] = rows;
      }
    } catch {
      const error = new Error(uiMessage(locale, 'moduleJsonImportFailed'));
      if (onImportError) onImportError(error);
      else window.alert(error.message);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    try {
      await onImport(next);
    } catch (error) {
      if (onImportError) onImportError(error);
      else window.alert(error instanceof Error ? error.message : uiMessage(locale, 'moduleJsonImportFailed'));
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return <div className="flex flex-wrap gap-2">
    <button type="button" onClick={download} className="inline-flex h-9 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted"><Download size={15}/>{uiMessage(locale, 'rolesDownloadSample')}</button>
    <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex h-9 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted"><Upload size={15}/>{uiMessage(locale, 'rolesUploadJson')}</button>
    <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void importFile(event.target.files?.[0])}/>
  </div>;
}
