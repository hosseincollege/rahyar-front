'use client';

import { useCallback, useEffect, useState } from 'react';
import { LoaderCircle, Plus } from 'lucide-react';
import { usePreferences } from '@/components/preferences-provider';
import { rahcomApi, type RahcomActivity, type RahcomSystem } from '@/lib/api/rahcom/rahcom-api';
import { uiMessage } from '@/lib/ui-messages';
import { formatJalaliDate } from '@/lib/api/rahcom/jalali-date';
import { useRahcomDate } from './rahcom-date';

export function RahcomSystemHistory({ system }: { system: Pick<RahcomSystem, 'id' | 'systemName' | 'systemCode'> }) {
  const { locale } = usePreferences();
  const t = useCallback((key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key), [locale]);
  const [items, setItems] = useState<RahcomActivity[]>([]);
  const { date } = useRahcomDate();
  const [accompaniedBy, setAccompaniedBy] = useState('');
  const [handedOverTo, setHandedOverTo] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await rahcomApi.systemActivities(system.id)); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('rahcomHistoryLoadError')); }
    finally { setLoading(false); }
  }, [system.id, t]);

  useEffect(() => { const frame = window.requestAnimationFrame(() => { void load(); }); return () => window.cancelAnimationFrame(frame); }, [load]);
  useEffect(() => {
    const onChanged = () => { void load(); };
    window.addEventListener('rahyar:activities-changed', onChanged);
    return () => window.removeEventListener('rahyar:activities-changed', onChanged);
  }, [load]);

  async function addVisit() {
    if (!description.trim() || !date) { if (!date) setError(t('rahcomInvalidJalaliDate')); return; }
    setSaving(true); setError('');
    try {
      await rahcomApi.addSystemActivity(system.id, { date, description, accompaniedBy, handedOverTo });
      setDescription(''); setAccompaniedBy(''); setHandedOverTo('');
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('rahcomSystemUpdateFailed')); }
    finally { setSaving(false); }
  }

  return (
    <section className="space-y-3" aria-label={`${t('rahcomHistory')} ${system.systemName}`}>
      <div className="flex items-center justify-between gap-3">
        <div><h3 className="font-semibold text-foreground">{t('rahcomHistory')}</h3><p className="mt-0.5 text-xs text-muted-foreground">{system.systemName} · {system.systemCode}</p></div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{items.length}</span>
      </div>
      <details className="overflow-hidden rounded-xl border border-border bg-background/60">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-medium text-primary marker:hidden"><Plus size={16}/>{t('rahcomAddHistory')}</summary>
        <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs text-muted-foreground">{t('rahcomAccompaniedBy')}<input value={accompaniedBy} onChange={event => setAccompaniedBy(event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label>
          <label className="grid gap-1 text-xs text-muted-foreground">{t('rahcomHandedOverTo')}<input value={handedOverTo} onChange={event => setHandedOverTo(event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label>
          <label className="grid gap-1 text-xs text-muted-foreground sm:col-span-2">{t('rahcomWorkPerformed')}<textarea rows={2} value={description} onChange={event => setDescription(event.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></label>
          <div className="flex items-center justify-between gap-3 sm:col-span-2">{error && <p role="alert" className="text-xs text-destructive">{error}</p>}<button type="button" disabled={saving || !description.trim() || !date} onClick={() => void addVisit()} className="ms-auto inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? <LoaderCircle size={16} className="animate-spin"/> : <Plus size={16}/>} {t('rahcomAddHistory')}</button></div>
        </div>
      </details>
      {error && !loading && <p role="alert" className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      {loading ? <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><LoaderCircle size={16} className="animate-spin"/>…</div> : items.length === 0 ? <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{t('rahcomNoHistory')}</p> : (
        <ol className="relative space-y-3 border-s border-border ps-4">
          {items.map(item => <li key={item.id} className="relative rounded-xl border border-border bg-card p-3 before:absolute before:-start-[21px] before:top-4 before:size-2.5 before:rounded-full before:border-2 before:border-primary before:bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2"><time className="font-mono text-xs font-semibold text-primary" dir="ltr">{formatJalaliDate(item.activityDate)}</time><span className="text-xs text-muted-foreground">{t('rahcomPerformedBy')}: {item.performedBy || '—'}</span></div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{item.description}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{item.accompaniedBy && <span>{t('rahcomAccompaniedBy')}: {item.accompaniedBy}</span>}{item.handedOverTo && <span>{t('rahcomHandedOverTo')}: {item.handedOverTo}</span>}</div>
          </li>)}
        </ol>
      )}
    </section>
  );
}
