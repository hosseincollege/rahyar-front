'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

function shiftIsoDay(isoDate: string, delta: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function jalaliTextFromGregorian(isoDate: string) {
  const { year, month, day } = persianParts(isoDate);
  return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

function startOfPersianWeek(isoDate: string) {
  const dayOfWeek = new Date(`${isoDate}T12:00:00Z`).getUTCDay();
  return shiftIsoDay(isoDate, -((dayOfWeek + 1) % 7));
}

export function RahcomHeaderDate() {
  const { locale } = usePreferences();
  const { dateText, setDateText, date } = useRahcomDate();
  const direction = getLocaleDirection(locale);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const fallbackDate = jalaliDateToGregorian(todayJalaliDate()) ?? new Date().toISOString().slice(0, 10);
  const activeDate = date ?? fallbackDate;
  const selectedDate = date ? persianParts(date) : null;
  const [open, setOpen] = useState(false);
  const [weekOpen, setWeekOpen] = useState(false);
  const [weekStart, setWeekStart] = useState(() => startOfPersianWeek(activeDate));
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null);
  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>(() => persianParts(activeDate));
  useEffect(() => {
    if (!open && !weekOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!wrapperRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
        setWeekOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); setWeekOpen(false); } };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); window.removeEventListener('keydown', onKeyDown); };
  }, [open, weekOpen]);
  useEffect(() => {
    if (!open && !weekOpen) return;
    const updatePosition = () => {
      const anchor = wrapperRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const width = weekOpen ? Math.min(224, window.innerWidth - 24) : Math.min(320, window.innerWidth - 24);
      const height = open ? 390 : 300;
      const left = Math.max(12, Math.min(anchor.right - width, window.innerWidth - width - 12));
      const top = anchor.bottom + height + 12 <= window.innerHeight
        ? anchor.bottom + 8
        : Math.max(12, anchor.top - height - 8);
      setPopoverPosition({ top, left });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, weekOpen]);
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
    ? new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
    : uiMessage(locale, 'rahcomInvalidJalaliDate');
  const weekDays = Array.from({ length: 7 }, (_, index) => shiftIsoDay(weekStart, index));

  const chooseDay = (day: number) => {
    setDateText(`${viewMonth.year}/${String(viewMonth.month).padStart(2, '0')}/${String(day).padStart(2, '0')}`);
    setOpen(false);
  };

  return <div ref={wrapperRef} className="grid h-10 w-[14rem] shrink-0 grid-cols-[0.85fr_1fr] overflow-hidden rounded-full border border-border bg-background">
    <button type="button" aria-expanded={weekOpen} aria-label={weekday} onClick={() => {
      setOpen(false);
      setWeekStart(startOfPersianWeek(date ?? fallbackDate));
      setWeekOpen((value) => !value);
    }} className={`flex h-full min-w-0 items-center justify-center whitespace-nowrap px-1 text-sm font-semibold transition-colors hover:bg-muted ${weekOpen ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
      {weekday}
    </button>
    <button type="button" aria-haspopup="dialog" aria-expanded={open} aria-label={uiMessage(locale, 'rahcomVisitDate')} onClick={() => { setWeekOpen(false); setOpen((value) => !value); setViewMonth(persianParts(activeDate)); }} className={`flex h-full min-w-0 items-center justify-center whitespace-nowrap border-s border-border px-1 font-mono text-[13px] font-medium tabular-nums transition-colors hover:bg-muted ${open ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
      <span dir="ltr">{dateText}</span>
    </button>
    {(open || weekOpen) && popoverPosition && typeof document !== 'undefined' && createPortal(<div ref={popoverRef} dir={direction} role="dialog" aria-label={weekOpen ? 'انتخاب روز هفته' : uiMessage(locale, 'rahcomVisitDate')} className={`fixed z-[9999] ${weekOpen ? 'w-[min(14rem,calc(100vw-1.5rem))]' : 'w-[min(20rem,calc(100vw-1.5rem))]'} rounded-xl border border-border p-2.5 text-foreground shadow-2xl ring-1 ring-black/10 dark:ring-white/10`} style={{ top: popoverPosition.top, left: popoverPosition.left, backgroundColor: 'var(--card)' }}>
      {open ? <>
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
      </> : <>
        <div className="mb-3 flex items-center justify-between gap-2">
          <button type="button" aria-label="هفتهٔ قبل" onClick={() => setWeekStart((start) => shiftIsoDay(start, -7))} className="grid size-9 place-items-center rounded-lg border border-border text-foreground hover:bg-muted">{direction === 'rtl' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}</button>
          <strong className="whitespace-nowrap text-xs text-foreground">{weekDays.length ? new Intl.DateTimeFormat(locale, { calendar: 'persian', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${weekDays[0]}T12:00:00Z`)) : ''} – {new Intl.DateTimeFormat(locale, { calendar: 'persian', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${weekDays[6]}T12:00:00Z`))}</strong>
          <button type="button" aria-label="هفتهٔ بعد" onClick={() => setWeekStart((start) => shiftIsoDay(start, 7))} className="grid size-9 place-items-center rounded-lg border border-border text-foreground hover:bg-muted">{direction === 'rtl' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}</button>
        </div>
        <div className="space-y-0.5">
          {weekDays.map((day) => {
            const isSelected = day === date;
            const dayDate = new Intl.DateTimeFormat(locale, { calendar: 'persian', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
            return <button key={day} type="button" aria-pressed={isSelected} onClick={() => { setDateText(jalaliTextFromGregorian(day)); setWeekOpen(false); }} className={`flex min-h-8 w-full items-center justify-between rounded-md px-2 text-xs transition-colors hover:bg-primary/10 ${isSelected ? 'bg-primary text-primary-foreground hover:bg-primary' : 'text-foreground'}`}><span>{new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))}</span><span className="text-[11px] tabular-nums">{dayDate}</span></button>;
          })}
        </div>
      </>}
    </div>, document.body)}
  </div>;
}
