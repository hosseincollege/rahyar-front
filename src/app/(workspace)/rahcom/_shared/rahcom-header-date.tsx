'use client';

import { CalendarDays } from 'lucide-react';
import { usePreferences } from '@/components/preferences-provider';
import { jalaliDateToGregorian } from '@/lib/api/rahcom/jalali-date';
import { uiMessage } from '@/lib/ui-messages';
import { useRahcomDate } from './rahcom-date';

export function RahcomHeaderDate() {
  const { locale } = usePreferences();
  const { dateText, setDateText, date } = useRahcomDate();
  const weekday = date
    ? new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Tehran' }).format(new Date(`${date}T12:00:00+03:30`))
    : uiMessage(locale, 'rahcomInvalidJalaliDate');

  return <div className="ms-auto flex flex-wrap items-center justify-end gap-3">
    <span className="text-sm font-medium text-muted-foreground">{weekday}</span>
    <label className="relative block" aria-label={uiMessage(locale, 'rahcomVisitDate')}>
      <CalendarDays size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input type="text" inputMode="numeric" dir="ltr" placeholder="1405/07/30" value={dateText} onChange={(event) => setDateText(event.target.value)} className="h-10 w-36 rounded-lg border border-border bg-background ps-9 pe-3 text-sm text-foreground" />
    </label>
  </div>;
}
