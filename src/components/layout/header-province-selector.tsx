'use client';

import { useEffect, useState } from 'react';

const IRAN_PROVINCES = [
  'آذربایجان شرقی', 'آذربایجان غربی', 'اردبیل', 'اصفهان', 'البرز', 'ایلام', 'بوشهر', 'تهران',
  'چهارمحال و بختیاری', 'خراسان جنوبی', 'خراسان رضوی', 'خراسان شمالی', 'خوزستان', 'زنجان',
  'سمنان', 'سیستان و بلوچستان', 'فارس', 'قزوین', 'قم', 'کردستان', 'کرمان', 'کرمانشاه',
  'کهگیلویه و بویراحمد', 'گلستان', 'گیلان', 'لرستان', 'مازندران', 'مرکزی', 'هرمزگان', 'همدان', 'یزد',
];

function storageKey(userId?: string) {
  return `rahyar-selected-province:${userId || 'current'}`;
}

export function HeaderProvinceSelector({ userId, embedded = false }: { userId?: string; embedded?: boolean }) {
  const [province, setProvince] = useState('');

  useEffect(() => {
    setProvince(window.localStorage.getItem(storageKey(userId)) || '');
  }, [userId]);

  function selectProvince(value: string) {
    setProvince(value);
    if (value) window.localStorage.setItem(storageKey(userId), value);
    else window.localStorage.removeItem(storageKey(userId));
    window.dispatchEvent(new CustomEvent('rahyar:province-change', { detail: { userId, province: value } }));
  }

  return (
    <label dir="rtl" className={embedded ? 'block w-full' : 'block shrink-0'}>
      <span className="sr-only">انتخاب استان</span>
      <select
        aria-label="انتخاب استان"
        value={province}
        onChange={(event) => selectProvince(event.target.value)}
        className={embedded
          ? 'min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-start text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]'
          : 'h-9 max-w-36 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)] sm:max-w-44 sm:px-3 sm:text-sm'}
      >
        <option value="">انتخاب استان</option>
        {IRAN_PROVINCES.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
}
