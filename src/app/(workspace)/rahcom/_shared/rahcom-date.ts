'use client';

import { useCallback, useEffect, useState } from 'react';
import { jalaliDateToGregorian, todayJalaliDate } from '@/lib/api/rahcom/jalali-date';

const storageKey = 'rahyar-rahcom-date';
const eventName = 'rahyar:rahcom-date-change';

export function useRahcomDate() {
  const [dateText, setDateText] = useState(() => todayJalaliDate());

  useEffect(() => {
    setDateText(window.localStorage.getItem(storageKey) || todayJalaliDate());
    const onDateChange = (event: Event) => {
      const value = (event as CustomEvent<{ date?: string }>).detail?.date;
      if (value) setDateText(value);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) setDateText(event.newValue || todayJalaliDate());
    };
    window.addEventListener(eventName, onDateChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(eventName, onDateChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setDate = useCallback((value: string) => {
    setDateText(value);
    window.localStorage.setItem(storageKey, value);
    window.dispatchEvent(new CustomEvent(eventName, { detail: { date: value } }));
  }, []);

  return { dateText, setDateText: setDate, date: jalaliDateToGregorian(dateText) };
}
