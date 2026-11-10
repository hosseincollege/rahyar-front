'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Clock3, LoaderCircle, Trash2 } from 'lucide-react';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { RahcomSystemHistory } from '@/app/(workspace)/rahcom/_shared/rahcom-system-history';
import { iranProvinces, rahcomApi, type RahcomActivity, type RahcomSystem } from '@/lib/api/rahcom/rahcom-api';
import { formatJalaliDate } from '@/lib/api/rahcom/jalali-date';
import { useRahcomDate } from '@/app/(workspace)/rahcom/_shared/rahcom-date';
import { getCurrentUser } from '@/lib/api/shared/auth-api';
import { RahcomRecordSummary } from '@/app/(workspace)/rahcom/_shared/rahcom-record-summary';
import { RahcomDailyWorkflow } from './rahcom-daily-workflow';
export function RahcomActions({ canManage = false, canRecord = false, selectedProvince = 'all' }: { canManage?: boolean; canRecord?: boolean; selectedProvince?: string }) {
  const { locale } = usePreferences();
  const t = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const { date } = useRahcomDate();
  const [items, setItems] = useState<RahcomActivity[]>([]);
  const [systems, setSystems] = useState<RahcomSystem[]>([]);
  const [activityProvinceState, setActivityProvinceState] = useState({
    selection: selectedProvince,
    province: selectedProvince === 'all' ? 'isfahan' : selectedProvince,
  });
  const activityProvince = activityProvinceState.selection === selectedProvince
    ? activityProvinceState.province
    : selectedProvince === 'all' ? 'isfahan' : selectedProvince;
  const [historySystemId, setHistorySystemId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setItems(date ? await rahcomApi.activities(date, { from: date, to: date }, selectedProvince) : []); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load actions.'); }
    finally { setLoading(false); }
  }, [date, selectedProvince]);
  useEffect(() => { const frame = window.requestAnimationFrame(() => { void load(); }); return () => window.cancelAnimationFrame(frame); }, [load]);
  useEffect(() => {
    let active = true;
    void rahcomApi.systems(selectedProvince).then((result) => {
      if (!active) return;
      setSystems(result);
    }).catch(() => { if (active) setSystems([]); });
    return () => { active = false; };
  }, [selectedProvince]);
async function remove(id: string) { if (!window.confirm(t('rahcomDeleteConfirm'))) return; try { await rahcomApi.deleteActivity(id); await load(); } catch (e) { setError(e instanceof Error ? e.message : t('rahcomSystemDeleteFailed')); } }
  const visibleItems = items.filter(item => item.activityType === 'SYSTEM_VISIT');
  const latestActivityAt = visibleItems.reduce<string | null>((latest, item) => !latest || new Date(item.createdAt) > new Date(latest) ? item.createdAt : latest, null);
  return <section className="space-y-4" dir={locale === 'fa' || locale === 'ar' ? 'rtl' : 'ltr'}>
    <div className="space-y-4">
      {selectedProvince === 'all' && <label className="mb-4 grid max-w-sm gap-1 text-xs text-muted-foreground">{t('rahcomProvince')}<select value={activityProvince} onChange={(e) => setActivityProvinceState({ selection: selectedProvince, province: e.target.value })} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground">{iranProvinces.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>}
      {visibleItems.length > 0 && date && <RahcomRecordSummary locale={locale} source={t('rahcomActions')} recordDate={date} count={visibleItems.length} savedAt={latestActivityAt} />}
      {canRecord && <RahcomDailyWorkflow date={date} province={activityProvince} items={items} systems={systems.filter(system => system.province === activityProvince)} onSaved={load} />}
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {loading ? <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><LoaderCircle size={16} className="animate-spin" />…</div> : visibleItems.length === 0 ? <p className="p-5 text-sm text-muted-foreground">{t('rahcomNoActivities')}</p> : <div className="divide-y divide-border">{visibleItems.map(item => {
        const linkedSystem = item.system ?? systems.find(system => system.id === item.systemId) ?? null;
        const systemName = item.system?.systemName ?? item.systemNameSnapshot;
        const historyOpen = Boolean(item.systemId && historySystemId === item.systemId);
        return <article key={item.id} className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{t('rahcomSystemVisit')}</strong><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{item.quantity}</span><time className="text-xs text-muted-foreground">{formatJalaliDate(item.activityDate)}</time></div>
              {systemName && <p className="mt-2 text-sm font-medium text-foreground">{systemName} <span dir="ltr" className="font-mono text-xs text-muted-foreground">{item.system?.systemCode ?? item.systemCodeSnapshot}</span></p>}
              {item.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.description}</p>}
              {(item.performedBy || item.accompaniedBy || item.handedOverTo) && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{item.performedBy && <span>{t('rahcomPerformedBy')}: {item.performedBy}</span>}{item.accompaniedBy && <span>{t('rahcomAccompaniedBy')}: {item.accompaniedBy}</span>}{item.handedOverTo && <span>{t('rahcomHandedOverTo')}: {item.handedOverTo}</span>}</div>}
            </div>
            <div className="flex items-center gap-1">{linkedSystem && <button type="button" onClick={() => setHistorySystemId(current => current === linkedSystem.id ? '' : linkedSystem.id)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs text-foreground hover:bg-accent"><Clock3 size={15}/>{t('rahcomHistory')}<ChevronDown size={14} className={historyOpen ? 'rotate-180' : ''}/></button>}{(canManage || (canRecord && item.createdById === getCurrentUser()?.id)) && <button type="button" aria-label={t('rahcomDelete')} onClick={() => void remove(item.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={16} /></button>}</div>
          </div>
          {historyOpen && linkedSystem && <div className="border-t border-border pt-3"><RahcomSystemHistory system={linkedSystem}/></div>}
        </article>;
      })}</div>}
    </div>
  </section>;
}
