'use client';

import { useCallback, useEffect, useState } from 'react';
import { GitMerge, Pencil, Plus, Save, Settings2, Trash2, X } from 'lucide-react';
import { usePreferences } from '@/components/preferences-provider';
import { iranProvinces, rahcomApi, type RahcomAxis } from '@/lib/api/rahcom/rahcom-api';
import { uiMessage } from '@/lib/ui-messages';

export function RahcomAxesManager({ province, canManage }: { province: string; canManage: boolean }) {
  const { locale } = usePreferences();
  const [open, setOpen] = useState(false);
  const [axes, setAxes] = useState<RahcomAxis[]>([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editingName, setEditingName] = useState('');
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const t = useCallback((key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key), [locale]);
  const provinceName = iranProvinces.find(([id]) => id === province)?.[1] ?? province;

  const loadAxes = useCallback(async () => {
    setLoading(true);
    try {
      setAxes(await rahcomApi.axes(province));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('rahcomAxisLoadError'));
    } finally {
      setLoading(false);
    }
  }, [province, t]);

  useEffect(() => { if (open) void loadAxes(); }, [loadAxes, open]);

  async function addAxis(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) { setError(t('rahcomAxisNameRequired')); return; }
    setSaving(true);
    try {
      await rahcomApi.createAxis(province, name);
      setNewName('');
      await loadAxes();
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('rahcomAxisSaveError')); }
    finally { setSaving(false); }
  }

  async function renameAxis(axis: RahcomAxis) {
    const name = editingName.trim();
    if (!name) { setError(t('rahcomAxisNameRequired')); return; }
    setSaving(true);
    try {
      await rahcomApi.updateAxis(axis.id, name);
      setEditingId('');
      await loadAxes();
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('rahcomAxisSaveError')); }
    finally { setSaving(false); }
  }

  async function deleteAxis(axis: RahcomAxis) {
    if (!window.confirm(`${t('rahcomAxisDeleteConfirm')} ${axis.name}`)) return;
    setSaving(true);
    try { await rahcomApi.deleteAxis(axis.id); await loadAxes(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('rahcomAxisSaveError')); }
    finally { setSaving(false); }
  }

  async function mergeAxes(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId) return;
    if (!window.confirm(t('rahcomAxisMergeConfirm'))) return;
    setSaving(true);
    try {
      await rahcomApi.mergeAxes(mergeSourceId, mergeTargetId);
      setMergeSourceId('');
      setMergeTargetId('');
      await loadAxes();
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('rahcomAxisSaveError')); }
    finally { setSaving(false); }
  }

  if (!canManage) return null;
  return <>
    <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-accent"><Settings2 size={16} />{t('rahcomManageAxes')}</button>
    {open && <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="rahcom-axes-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl" dir="rtl">
        <header className="flex items-start justify-between gap-3">
          <div><h2 id="rahcom-axes-title" className="text-lg font-bold text-foreground">{t('rahcomAxesTitle')} · {provinceName}</h2><p className="mt-1 text-sm text-muted-foreground">{t('rahcomAxisFilter')}</p></div>
          <button type="button" onClick={() => setOpen(false)} aria-label={t('closeSidebar')} className="rounded-lg p-2 text-muted-foreground hover:bg-accent"><X size={18} /></button>
        </header>

        {error && <p role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        <form onSubmit={(event) => void addAxis(event)} className="mt-4 flex flex-wrap gap-2">
          <input value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={120} placeholder={t('rahcomAxisName')} className="h-10 min-w-48 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground" />
          <button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Plus size={16} />{t('rahcomAddAxis')}</button>
        </form>

        <div className="mt-4 space-y-2">
          {loading ? <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">{t('rahcomSystemsLoading')}</p> : axes.length === 0 ? <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">{t('rahcomNoAxes')}</p> : axes.map((axis) => <div key={axis.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-3">
            {editingId === axis.id ? <>
              <input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} maxLength={120} className="h-9 min-w-48 flex-1 rounded-lg border border-border bg-card px-3 text-sm text-foreground" />
              <button type="button" disabled={saving} onClick={() => void renameAxis(axis)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"><Save size={14} />{t('rahcomSave')}</button>
              <button type="button" onClick={() => setEditingId('')} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs text-foreground">{t('rahcomCancel')}</button>
            </> : <>
              <span className="min-w-48 flex-1 text-sm font-medium text-foreground">{axis.name}</span>
              <button type="button" onClick={() => { setEditingId(axis.id); setEditingName(axis.name); }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs text-foreground"><Pencil size={14} />{t('rahcomRenameAxis')}</button>
              <button type="button" disabled={saving} onClick={() => void deleteAxis(axis)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-destructive/30 px-3 text-xs text-destructive"><Trash2 size={14} />{t('rahcomDelete')}</button>
            </>}
          </div>)}
        </div>

        {axes.length > 1 && <form onSubmit={(event) => void mergeAxes(event)} className="mt-5 rounded-xl border border-border bg-background p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><GitMerge size={16} />{t('rahcomMergeAxes')}</h3>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="grid gap-1 text-xs text-muted-foreground">{t('rahcomMergeSource')}<select value={mergeSourceId} onChange={(event) => setMergeSourceId(event.target.value)} className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground"><option value="">{t('rahcomChooseAxis')}</option>{axes.map((axis) => <option key={axis.id} value={axis.id}>{axis.name}</option>)}</select></label>
            <label className="grid gap-1 text-xs text-muted-foreground">{t('rahcomMergeTarget')}<select value={mergeTargetId} onChange={(event) => setMergeTargetId(event.target.value)} className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground"><option value="">{t('rahcomChooseAxis')}</option>{axes.filter((axis) => axis.id !== mergeSourceId).map((axis) => <option key={axis.id} value={axis.id}>{axis.name}</option>)}</select></label>
            <button type="submit" disabled={saving || !mergeSourceId || !mergeTargetId} className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm text-foreground disabled:opacity-50"><GitMerge size={15} />{t('rahcomMergeAxes')}</button>
          </div>
        </form>}
      </section>
    </div>}
  </>;
}
