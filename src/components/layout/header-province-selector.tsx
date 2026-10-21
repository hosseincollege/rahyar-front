'use client';

import { useEffect, useState } from 'react';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { iranProvinces } from '@/lib/rahcom-api';

function storageKey(userId?: string) {
  return `rahyar-selected-province:${userId || 'current'}`;
}

export function HeaderProvinceSelector({ userId }: { userId?: string }) {
  const { locale } = usePreferences();
  const [province, setProvince] = useState('isfahan');
  const label = uiMessage(locale, 'rahcomProvince');

  useEffect(() => {
    setProvince(window.localStorage.getItem(storageKey(userId)) || 'isfahan');
  }, [userId]);

  function selectProvince(value: string) {
    setProvince(value);
    window.localStorage.setItem(storageKey(userId), value);
    window.dispatchEvent(new CustomEvent('rahyar:province-change', { detail: { userId, province: value } }));
  }

  return (
    <label dir={locale === 'fa' || locale === 'ar' ? 'rtl' : 'ltr'} className="pointer-events-auto block shrink-0">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={province}
        onChange={(event) => selectProvince(event.target.value)}
        className="h-9 max-w-36 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)] sm:max-w-44 sm:px-3 sm:text-sm"
      >
        {iranProvinces.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </label>
  );
}
