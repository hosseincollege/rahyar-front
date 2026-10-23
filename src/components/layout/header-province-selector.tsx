'use client';

import { useEffect, useState } from 'react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { iranProvinces } from '@/lib/api/rahcom/rahcom-api';
import { getCurrentOrganizationId } from '@/lib/api/shared/auth-api';
import { settingsApi, type BranchItem } from '@/app/(workspace)/settings/settings-api';

function storageKey(userId?: string) {
  return `rahyar-selected-province:${userId || 'current'}`;
}

function provinceIdForBranch(branch: Pick<BranchItem, 'code' | 'name'>) {
  const prefix = 'DEMO-PROVINCE-';
  const idFromCode = branch.code.startsWith(prefix) ? branch.code.slice(prefix.length).toLowerCase() : '';
  if (iranProvinces.some(([id]) => id === idFromCode)) return idFromCode;
  const branchName = branch.name.trim().replace(/^استان\s*/, '');
  return iranProvinces.find(([, name]) => name.trim() === branchName)?.[0] ?? '';
}

export function HeaderProvinceSelector({ userId }: { userId?: string }) {
  const { locale } = usePreferences();
  const [province, setProvince] = useState('isfahan');
  const [offices, setOffices] = useState<Array<{ id: string; name: string }>>([]);
  const [loaded, setLoaded] = useState(false);
  const label = uiMessage(locale, 'rahcomProvince');

  useEffect(() => {
    let active = true;
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      setOffices([]);
      setLoaded(true);
      return () => { active = false; };
    }

    void settingsApi.getBranches(organizationId).then((branches) => {
      if (!active) return;
      const available = branches
        .filter((branch) => branch.isActive !== false)
        .map((branch) => ({ id: provinceIdForBranch(branch), name: branch.name }))
        .filter((branch): branch is { id: string; name: string } => Boolean(branch.id))
        .sort((a, b) => iranProvinces.findIndex(([id]) => id === a.id) - iranProvinces.findIndex(([id]) => id === b.id));
      setOffices(available);
      const saved = window.localStorage.getItem(storageKey(userId));
      const initial = available.some(({ id }) => id === saved)
        ? saved!
        : available.some(({ id }) => id === 'isfahan') ? 'isfahan' : available[0]?.id ?? 'all';
      setProvince(initial);
      setLoaded(true);
    }).catch(() => {
      if (active) {
        setOffices([]);
        setProvince('all');
        setLoaded(true);
      }
    });

    return () => { active = false; };
  }, [userId]);

  function selectProvince(value: string) {
    setProvince(value);
    window.localStorage.setItem(storageKey(userId), value);
    window.dispatchEvent(new CustomEvent('rahyar:province-change', { detail: { userId, province: value } }));
  }

  if (!loaded) return null;
  return (
    <label dir={getLocaleDirection(locale)} className="pointer-events-auto block shrink-0">
      <span className="sr-only">{label}</span>
      <select aria-label={label} value={province} onChange={(event) => selectProvince(event.target.value)} className="h-9 max-w-36 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)] sm:max-w-44 sm:px-3 sm:text-sm">
        <option value="all">{uiMessage(locale, 'rahcomAllProvinces')}</option>
        {offices.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
      </select>
    </label>
  );
}
