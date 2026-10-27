'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { jalaliDateToGregorian, todayJalaliDate } from '@/lib/api/rahcom/jalali-date';
import { uiMessage } from '@/lib/ui-messages';
import { useRahcomDate } from './rahcom-date';

function persianParts(isoDate: string) {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(new Date(`${isoDate}T12:00:00Z`));
  const get = (type: 'year' | 'month' | 'day') => Number(parts.find((part) => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

function shiftedMonth(year: number, month: number, delta: number) {
  const value = year * 12 + month - 1 + delta;
  return { year: Math.floor(value / 12), month: ((value % 12) + 12) % 12 + 1 };
}

export function RahcomHeaderDate() {
  const { locale } = usePreferences();
  const { dateText, setDateText, date } = useRahcomDate();
  const direction = getLocaleDirection(locale);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fallbackDate = jalaliDateToGregorian(todayJalaliDate()) ?? new Date().toISOString().slice(0, 10);
  const activeDate = date ?? fallbackDate;
  const selectedDate = date ? persianParts(date) : null;
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>(() => persianParts(activeDate));
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); window.removeEventListener('keydown', onKeyDown); };
  }, [open]);
  const firstDay = jalaliDateToGregorian(`${viewMonth.year}/${viewMonth.month}/1`);
  const nextMonth = shiftedMonth(viewMonth.year, viewMonth.month, 1);
  const nextFirstDay = jalaliDateToGregorian(`${nextMonth.year}/${nextMonth.month}/1`);
  const monthLabel = firstDay
    ? new Intl.DateTimeFormat(locale, { calendar: 'persian', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${firstDay}T12:00:00Z`))
    : '';
  const days = firstDay && nextFirstDay
    ? Math.round((Date.parse(`${nextFirstDay}T12:00:00Z`) - Date.parse(`${firstDay}T12:00:00Z`)) / 86_400_000)
    : 31;
  const leadingEmptyDays = firstDay ? (new Date(`${firstDay}T12:00:00Z`).getUTCDay() + 1) % 7 : 0;
  const cells = useMemo(() => [
    ...Array.from({ length: leadingEmptyDays }, (_, index) => `empty-${index}` as const),
    ...Array.from({ length: days }, (_, index) => index + 1),
  ], [days, leadingEmptyDays]);
  const weekdayLabels = useMemo(() => {
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
    return Array.from({ length: 7 }, (_, index) => weekday.format(new Date(Date.UTC(2024, 0, 6 + index, 12))));
  }, [locale]);
  const number = useMemo(() => new Intl.NumberFormat(locale, { useGrouping: false }), [locale]);
  const weekday = date
    ? new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Tehran' }).format(new Date(`${date}T12:00:00+03:30`))
    : uiMessage(locale, 'rahcomInvalidJalaliDate');

  const chooseDay = (day: number) => {
    setDateText(`${viewMonth.year}/${String(viewMonth.month).padStart(2, '0')}/${String(day).padStart(2, '0')}`);
    setOpen(false);
  };

  return <div ref={wrapperRef} className="ms-auto flex flex-wrap items-center justify-end gap-3">
    <span className="text-sm font-medium text-muted-foreground">{weekday}</span>
    <div className="relative flex items-center gap-2">
      <label className="block" aria-label={uiMessage(locale, 'rahcomVisitDate')}>
        <input type="text" inputMode="numeric" dir="ltr" aria-label={uiMessage(locale, 'rahcomVisitDate')} placeholder="1405/07/30" value={dateText} onClick={() => setOpen(true)} onChange={(event) => setDateText(event.target.value)} className="h-10 w-36 rounded-lg border border-border bg-background px-3 text-sm text-foreground" />
      </label>
      <button type="button" aria-label={uiMessage(locale, 'rahcomVisitDate')} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="grid size-10 place-items-center rounded-lg border border-border bg-background text-foreground hover:bg-muted" title={uiMessage(locale, 'rahcomVisitDate')}>
        <CalendarDays size={18} />
      </button>
      {open && <div role="dialog" aria-label={uiMessage(locale, 'rahcomVisitDate')} className="absolute end-0 top-full z-[1100] isolate mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border p-3 text-foreground shadow-xl ring-1 ring-black/10 dark:ring-white/10" style={{ backgroundColor: 'var(--card)' }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" onClick={() => { setDateText(todayJalaliDate()); setViewMonth(persianParts(fallbackDate)); setOpen(false); }} className="rounded-lg border border-border px-2.5 py-2 text-xs font-semibold text-foreground hover:bg-muted">{uiMessage(locale, 'rahcomGoToToday')}</button>
        <button type="button" aria-label={uiMessage(locale, 'rahcomPreviousMonth')} onClick={() => setViewMonth((month) => shiftedMonth(month.year, month.month, -1))} className="grid size-9 place-items-center rounded-lg border border-border text-foreground hover:bg-muted">{direction === 'rtl' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}</button>
        <strong className="text-sm text-foreground">{monthLabel}</strong>
        <button type="button" aria-label={uiMessage(locale, 'rahcomNextMonth')} onClick={() => setViewMonth((month) => shiftedMonth(month.year, month.month, 1))} className="grid size-9 place-items-center rounded-lg border border-border text-foreground hover:bg-muted">{direction === 'rtl' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">{weekdayLabels.map((label, index) => <span key={`${index}-${label}`} className="py-1">{label}</span>)}</div>
      <div className="grid grid-cols-7 gap-1" role="grid">
        {cells.map((day) => typeof day === 'string'
          ? <span key={day} aria-hidden="true" />
          : (() => {
            const selected = selectedDate?.year === viewMonth.year && selectedDate.month === viewMonth.month && selectedDate.day === day;
            const dayLabel = `${number.format(day)} ${monthLabel}`;
            return <button key={day} type="button" role="gridcell" aria-label={dayLabel} aria-pressed={selected} onClick={() => chooseDay(day)} className={`grid aspect-square place-items-center rounded-lg text-sm text-foreground hover:bg-primary/10 ${selected ? 'bg-primary text-primary-foreground hover:bg-primary' : ''}`}>{number.format(day)}</button>;
          })())}
      </div>
      </div>}
    </div>
  </div>;
}
