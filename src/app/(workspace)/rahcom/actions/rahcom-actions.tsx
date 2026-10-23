'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Clock3, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { RahcomSystemHistory } from '@/app/(workspace)/rahcom/_shared/rahcom-system-history';
import { iranProvinces, rahcomApi, type RahcomActivity, type RahcomSystem } from '@/lib/api/rahcom/rahcom-api';
import { formatJalaliDate } from '@/lib/api/rahcom/jalali-date';
import { useRahcomDate } from '@/app/(workspace)/rahcom/_shared/rahcom-date';
export function RahcomActions({ canManage = false }: { canManage?: boolean }) {
  const { locale } = usePreferences();
  const t = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const { date } = useRahcomDate();
  const [items, setItems] = useState<RahcomActivity[]>([]);
  const [systems, setSystems] = useState<RahcomSystem[]>([]);
  const [systemId, setSystemId] = useState('');
  const [accompaniedBy, setAccompaniedBy] = useState('');
  const [handedOverTo, setHandedOverTo] = useState('');
  const [historySystemId, setHistorySystemId] = useState('');
  const [type, setType] = useState<RahcomActivity['activityType']>('EMAIL_SENT');
  const [quantity, setQuantity] = useState(1);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setItems(date ? await rahcomApi.activities(date, { from: date, to: date }) : []); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load actions.'); }
    finally { setLoading(false); }
  }, [date]);
  useEffect(() => { const frame = window.requestAnimationFrame(() => { void load(); }); return () => window.cancelAnimationFrame(frame); }, [load]);
  useEffect(() => {
    void rahcomApi.systems().then((result) => {
      setSystems(result);
      const focusId = window.sessionStorage.getItem('rahyar-rahcom-focus-system');
      if (focusId && result.some((system) => system.id === focusId)) {
        setSystemId(focusId);
        setType('SYSTEM_VISIT');
        window.sessionStorage.removeItem('rahyar-rahcom-focus-system');
      }
    }).catch(() => setSystems([]));
  }, []);
  async function add() {
    if (!date) { setError(t('rahcomInvalidJalaliDate')); return; }
    setSaving(true); setError('');
    try { await rahcomApi.addActivity({ date, activityType: systemId ? 'SYSTEM_VISIT' : type, quantity: systemId ? 1 : quantity, description, ...(systemId ? { systemId, accompaniedBy, handedOverTo } : {}) }); setDescription(''); setQuantity(1); setAccompaniedBy(''); setHandedOverTo(''); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save action.'); }
    finally { setSaving(false); }
  }
async function remove(id: string) { if (!window.confirm(t('rahcomDeleteConfirm'))) return; try { await rahcomApi.deleteActivity(id); await load(); } catch (e) { setError(e instanceof Error ? e.message : t('rahcomSystemDeleteFailed')); } }
  const labels = { EMAIL_SENT: t('rahcomEmailSent'), SYSTEM_VISIT: t('rahcomSystemVisit'), OTHER: t('rahcomOther') };
  return <section className="space-y-4" dir={locale === 'fa' || locale === 'ar' ? 'rtl' : 'ltr'}>
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">{t('rahcomActions')}</h2>{date && <span className="text-sm text-muted-foreground">{formatJalaliDate(date)}</span>}{!date && <span className="text-xs text-destructive">{t('rahcomInvalidJalaliDate')}</span>}</div>
      {canManage && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-1 text-xs text-muted-foreground">{t('rahcomSystemOptional')}<select value={systemId} onChange={(e) => { setSystemId(e.target.value); setType(e.target.value ? 'SYSTEM_VISIT' : 'EMAIL_SENT'); }} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="">{t('rahcomSystemOptional')}</option>{systems.map(item => <option key={item.id} value={item.id}>{item.systemName} · {iranProvinces.find(([id]) => id === item.province)?.[1] ?? item.province}</option>)}</select></label>
        <label className="grid gap-1 text-xs text-muted-foreground">{t('rahcomActions')}<select value={type} disabled={Boolean(systemId)} onChange={(e) => setType(e.target.value as typeof type)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground disabled:opacity-60">{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {!systemId && <label className="grid gap-1 text-xs text-muted-foreground">{t('rahcomQuantity')}<input aria-label={t('rahcomQuantity')} type="number" min={1} max={100000} step={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label>}
        {systemId && <label className="grid gap-1 text-xs text-muted-foreground">{t('rahcomAccompaniedBy')}<input value={accompaniedBy} onChange={e => setAccompaniedBy(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label>}
        {systemId && <label className="grid gap-1 text-xs text-muted-foreground">{t('rahcomHandedOverTo')}<input value={handedOverTo} onChange={e => setHandedOverTo(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label>}
        <label className="grid gap-1 text-xs text-muted-foreground sm:col-span-2">{systemId ? t('rahcomWorkPerformed') : t('rahcomDescription')}<input aria-label={t('rahcomDescription')} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={systemId ? t('rahcomWorkPerformed') : t('rahcomDescription')} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label>
        <button type="button" disabled={saving || !date} onClick={() => void add()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}{t('rahcomAdd')}</button>
      </div>}
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {loading ? <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><LoaderCircle size={16} className="animate-spin" />…</div> : items.length === 0 ? <p className="p-5 text-sm text-muted-foreground">{t('rahcomNoActivities')}</p> : <div className="divide-y divide-border">{items.map(item => {
        const linkedSystem = item.system ?? systems.find(system => system.id === item.systemId) ?? null;
        const systemName = item.system?.systemName ?? item.systemNameSnapshot;
        const historyOpen = Boolean(item.systemId && historySystemId === item.systemId);
        return <article key={item.id} className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{labels[item.activityType]}</strong><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{item.quantity}</span><time className="text-xs text-muted-foreground">{formatJalaliDate(item.activityDate)}</time></div>
              {systemName && <p className="mt-2 text-sm font-medium text-foreground">{systemName} <span dir="ltr" className="font-mono text-xs text-muted-foreground">{item.system?.systemCode ?? item.systemCodeSnapshot}</span></p>}
              {item.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.description}</p>}
              {(item.performedBy || item.accompaniedBy || item.handedOverTo) && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{item.performedBy && <span>{t('rahcomPerformedBy')}: {item.performedBy}</span>}{item.accompaniedBy && <span>{t('rahcomAccompaniedBy')}: {item.accompaniedBy}</span>}{item.handedOverTo && <span>{t('rahcomHandedOverTo')}: {item.handedOverTo}</span>}</div>}
            </div>
            <div className="flex items-center gap-1">{linkedSystem && <button type="button" onClick={() => setHistorySystemId(current => current === linkedSystem.id ? '' : linkedSystem.id)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs text-foreground hover:bg-accent"><Clock3 size={15}/>{t('rahcomHistory')}<ChevronDown size={14} className={historyOpen ? 'rotate-180' : ''}/></button>}{canManage && <button type="button" aria-label={t('rahcomDelete')} onClick={() => void remove(item.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={16} /></button>}</div>
          </div>
          {historyOpen && linkedSystem && <div className="border-t border-border pt-3"><RahcomSystemHistory system={linkedSystem}/></div>}
        </article>;
      })}</div>}
    </div>
  </section>;
}
