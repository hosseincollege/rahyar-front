'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, LoaderCircle, Mail, Users } from 'lucide-react';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { rahcomApi, type RahcomActivity } from '@/lib/rahcom-api';

function todayInTehran() {
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => dateParts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function RahcomDailyTraffic() {
  const { locale } = usePreferences();
  const [date, setDate] = useState(todayInTehran);
  const [items, setItems] = useState<RahcomActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const t = useCallback((key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key), [locale]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void rahcomApi.activities(date)
      .then((rows) => { if (active) setItems(rows); })
      .catch((reason: unknown) => {
        if (active) {
          setItems([]);
          setError(reason instanceof Error ? reason.message : t('rahcomHistoryLoadError'));
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date, t]);

  const totals = useMemo(() => ({
    emails: items.filter((item) => item.activityType === 'EMAIL_SENT').reduce((sum, item) => sum + item.quantity, 0),
    visits: items.filter((item) => item.activityType === 'SYSTEM_VISIT').length,
    other: items.filter((item) => item.activityType === 'OTHER').reduce((sum, item) => sum + item.quantity, 0),
  }), [items]);

  return (
    <section dir="rtl" className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Activity size={20} /></span>
          <div><h2 className="font-bold text-foreground">{t('rahcomDailyTraffic')}</h2><p className="mt-1 text-xs text-muted-foreground">{date}</p></div>
        </div>
        <label className="grid gap-1 text-xs text-muted-foreground">
          {t('rahcomVisitDate')}
          <span className="relative">
            <CalendarDays size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2" />
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-10 rounded-lg border border-border bg-background ps-9 pe-3 text-sm text-foreground" />
          </span>
        </label>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {([
          [t('rahcomEmailSent'), totals.emails, Mail],
          [t('rahcomSystemVisit'), totals.visits, Users],
          [t('rahcomOther'), totals.other, Activity],
        ] as const).map(([label, value, Icon]) => (
          <article key={label} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={18} /></span>
            <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold tabular-nums text-foreground">{value.toLocaleString('fa-IR')}</p></div>
          </article>
        ))}
      </div>

      {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><LoaderCircle size={17} className="animate-spin" />{t('rahcomSystemsLoading')}</div> : items.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">{t('rahcomNoActivities')}</p> : (
          <ol className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm text-foreground">{t(item.activityType === 'EMAIL_SENT' ? 'rahcomEmailSent' : item.activityType === 'SYSTEM_VISIT' ? 'rahcomSystemVisit' : 'rahcomOther')}</strong>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{item.quantity.toLocaleString('fa-IR')}</span>
                  </div>
                  {(item.system?.systemName || item.systemNameSnapshot) && <p className="mt-1 text-sm text-foreground">{item.system?.systemName ?? item.systemNameSnapshot}</p>}
                  {item.description && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.description}</p>}
                </div>
                {item.performedBy && <span className="text-xs text-muted-foreground">{t('rahcomPerformedBy')}: {item.performedBy}</span>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
