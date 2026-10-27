'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, MapPinned } from 'lucide-react';
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

export function HeaderProvinceSelector({ userId, embedded = false }: { userId?: string; embedded?: boolean }) {
  const { locale } = usePreferences();
  const [province, setProvince] = useState('isfahan');
  const [offices, setOffices] = useState<Array<{ id: string; name: string }>>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const label = uiMessage(locale, 'rahcomProvince');

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

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
    setOpen(false);
    window.localStorage.setItem(storageKey(userId), value);
    window.dispatchEvent(new CustomEvent('rahyar:province-change', { detail: { userId, province: value } }));
  }

  if (!loaded) return null;
  if (embedded) {
    return (
      <label dir={getLocaleDirection(locale)} className="pointer-events-auto block shrink-0">
        <span className="sr-only">{label}</span>
        <select aria-label={label} value={province} onChange={(event) => selectProvince(event.target.value)} style={{ backgroundColor: 'var(--gray-header, var(--surface))' }} className="h-9 max-w-36 rounded-xl border border-[var(--border)] px-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)] sm:max-w-44 sm:px-3 sm:text-sm">
          <option value="all">{uiMessage(locale, 'rahcomAllProvinces')}</option>
          {offices.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
    );
  }
  return (
    <div ref={dropdownRef} dir={getLocaleDirection(locale)} className="pointer-events-auto relative shrink-0">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls="header-province-selector-menu" title={label} className={`flex size-9 items-center justify-center rounded-xl border text-[var(--foreground)] transition-colors ${open ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]' : 'border-[var(--border)] hover:bg-[var(--primary-soft)]'}`}>
        <MapPinned size={17} aria-hidden="true" />
      </button>
      {open && <div id="header-province-selector-menu" role="menu" style={{ backgroundColor: 'var(--gray-header, var(--surface))' }} className={`absolute ${getLocaleDirection(locale) === 'rtl' ? 'end-0' : 'start-0'} top-full z-[70] mt-2 max-h-[min(65vh,24rem)] w-[min(18rem,calc(100vw-1rem))] space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] p-2 shadow-xl`}>
        {[
          { id: 'all', name: uiMessage(locale, 'rahcomAllProvinces') },
          ...offices,
        ].map(({ id, name }) => <button key={id} type="button" role="menuitemradio" aria-checked={province === id} onClick={() => selectProvince(id)} className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 text-start text-sm transition-colors ${province === id ? 'bg-[var(--primary-soft)] font-semibold text-[var(--primary)]' : 'text-[var(--foreground)] hover:bg-[var(--primary-soft)]'}`}>
          <span className="min-w-0 truncate">{name}</span>{province === id && <Check size={16} className="shrink-0" aria-hidden="true" />}
        </button>)}
      </div>}
    </div>
  );
}
