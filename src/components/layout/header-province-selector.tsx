'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, MapPinned } from 'lucide-react';
import { getCurrentOrganizationId, getCurrentUser } from '@/lib/api/shared/auth-api';
import { settingsApi, type BranchItem } from '@/app/(workspace)/settings/settings-api';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { iranProvinces, rahcomApi, type RahcomAccess } from '@/lib/api/rahcom/rahcom-api';

function storageKey(userId?: string) {
  return `rahyar-selected-province:${userId || 'current'}`;
}

function provinceIdForBranch(branch: Pick<BranchItem, 'code' | 'name'>) {
  const prefix = 'DEMO-PROVINCE-';
  const idFromCode = branch.code.startsWith(prefix) ? branch.code.slice(prefix.length).toLowerCase() : '';
  if (iranProvinces.some(([id]) => id === idFromCode)) return idFromCode;
  const branchName = branch.name.trim().replace(/^\u0627\u0633\u062a\u0627\u0646\s*/, '');
  return iranProvinces.find(([, name]) => name.trim() === branchName)?.[0] ?? '';
}

export function HeaderProvinceSelector({ userId, embedded = false }: { userId?: string; embedded?: boolean }) {
  const { locale } = usePreferences();
  const currentUser = getCurrentUser();
  const isDemoUser = currentUser?.username?.trim().toLowerCase() === 'demo'
    || currentUser?.role?.trim().toUpperCase() === 'DEMO_USER';
  const [province, setProvince] = useState('isfahan');
  const [offices, setOffices] = useState<Array<{ id: string; name: string }>>([]);
  const [access, setAccess] = useState<RahcomAccess | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const label = uiMessage(locale, 'rahcomProvince');
  const allProvincesLabel = uiMessage(locale, 'rahcomAllProvinces');
  const selectedProvinceName = province === 'all'
    ? allProvincesLabel
    : offices.find(({ id }) => id === province)?.name
      ?? iranProvinces.find(([id]) => id === province)?.[1]
      ?? allProvincesLabel;
  const sortedOffices = [...offices].sort((a, b) => a.name.localeCompare(b.name, 'fa'));
  const numberFormat = new Intl.NumberFormat(locale);

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

    void rahcomApi.access().then(async (rahcomAccess) => {
      if (!active) return;
      const branches = await settingsApi.getBranches(organizationId).catch(() => [] as BranchItem[]);
      const branchProvinces = branches
        .filter((branch) => branch.isActive !== false)
        .map((branch) => ({ id: provinceIdForBranch(branch), name: branch.name }))
        .filter((branch): branch is { id: string; name: string } => Boolean(branch.id))
        .sort((a, b) => iranProvinces.findIndex(([id]) => id === a.id) - iranProvinces.findIndex(([id]) => id === b.id));
      const isfahan = iranProvinces.find(([id]) => id === 'isfahan');
      const availableOffices = isDemoUser && isfahan
        ? [branchProvinces.find(({ id }) => id === 'isfahan') ?? { id: isfahan[0], name: isfahan[1] }]
        : iranProvinces.map(([id, name]) => branchProvinces.find((branch) => branch.id === id) ?? { id, name });
      const available = availableOffices;
      setAccess(rahcomAccess);
      setOffices(available);
      const initial = isDemoUser && available.some(({ id }) => id === 'isfahan')
        ? 'isfahan'
        : rahcomAccess.isAdmin ? rahcomAccess.selectedProvince ?? 'isfahan' : rahcomAccess.province ?? 'all';
      setProvince(initial);
      window.localStorage.setItem(storageKey(userId), initial);
      window.dispatchEvent(new CustomEvent('rahyar:province-change', { detail: { userId, province: initial } }));
      if (rahcomAccess.isAdmin && rahcomAccess.memberId) {
        void rahcomApi.setSelectedProvince(initial).catch(() => undefined);
      }
      setLoaded(true);
    }).catch(() => {
      if (active) {
        setOffices([]);
        setAccess(null);
        const fallback = isDemoUser ? 'isfahan' : 'all';
        setProvince(fallback);
        if (isDemoUser) {
          window.localStorage.setItem(storageKey(userId), fallback);
          window.dispatchEvent(new CustomEvent('rahyar:province-change', { detail: { userId, province: fallback } }));
        }
        setLoaded(true);
      }
    });

    return () => { active = false; };
  }, [isDemoUser, userId]);

  async function selectProvince(value: string) {
    if (!access?.isAdmin) return;
    if (access.memberId) {
      try { await rahcomApi.setSelectedProvince(value); }
      catch { return; }
    }
    setProvince(value);
    setOpen(false);
    window.localStorage.setItem(storageKey(userId), value);
    window.dispatchEvent(new CustomEvent('rahyar:province-change', { detail: { userId, province: value } }));
  }

  if (!loaded) return null;
  if (isDemoUser) {
    return (
      <div dir={getLocaleDirection(locale)} aria-label={`${label}: ${selectedProvinceName}`} title={`${label}: ${selectedProvinceName}`} className="pointer-events-auto flex h-9 max-w-44 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-2 text-xs text-[var(--foreground)] sm:max-w-52 sm:px-3 sm:text-sm">
        <MapPinned size={17} aria-hidden="true" />
        <span className="truncate">{selectedProvinceName}</span>
      </div>
    );
  }
  if (!access?.isAdmin) {
    return <div dir={getLocaleDirection(locale)} aria-label={`${label}: ${selectedProvinceName}`} title={`${label}: ${selectedProvinceName}`} className="pointer-events-auto flex h-9 max-w-44 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-2 text-xs text-[var(--foreground)] sm:max-w-52 sm:px-3 sm:text-sm"><MapPinned size={17} aria-hidden="true" /><span className="truncate">{selectedProvinceName}</span></div>;
  }
  if (embedded) {
    return (
      <label dir={getLocaleDirection(locale)} className="pointer-events-auto block shrink-0">
        <span className="sr-only">{label}</span>
        <select aria-label={label} value={province} onChange={(event) => selectProvince(event.target.value)} style={{ backgroundColor: 'var(--gray-header, var(--surface))' }} className="h-9 max-w-36 rounded-xl border border-[var(--border)] px-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)] sm:max-w-44 sm:px-3 sm:text-sm">
          <option value="all">{uiMessage(locale, 'rahcomAllProvinces')}</option>
          {sortedOffices.map(({ id, name }, index) => <option key={id} value={id}>{numberFormat.format(index + 1)} ـ {name}</option>)}
        </select>
      </label>
    );
  }
  return (
    <div ref={dropdownRef} dir={getLocaleDirection(locale)} className="pointer-events-auto relative shrink-0">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label={`${label}: ${selectedProvinceName}`} aria-haspopup="menu" aria-expanded={open} aria-controls="header-province-selector-menu" title={`${label}: ${selectedProvinceName}`} className={`flex h-9 max-w-44 items-center justify-center gap-2 rounded-xl border px-2 text-xs text-[var(--foreground)] transition-colors sm:max-w-52 sm:px-3 sm:text-sm ${open ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]' : 'border-[var(--border)] hover:bg-[var(--primary-soft)]'}`}>
        <MapPinned size={17} aria-hidden="true" />
        <span className="truncate">{selectedProvinceName}</span>
      </button>
      {open && <div id="header-province-selector-menu" role="menu" style={{ backgroundColor: 'var(--gray-header, var(--surface))' }} className={`absolute ${getLocaleDirection(locale) === 'rtl' ? 'end-0' : 'start-0'} top-full z-[70] mt-2 max-h-[min(65vh,24rem)] w-[min(11rem,calc(100vw-1rem))] space-y-0.5 overflow-y-auto rounded-xl border border-[var(--border)] p-1 shadow-xl`}>
        <button type="button" role="menuitemradio" aria-checked={province === 'all'} onClick={() => selectProvince('all')} className={`flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-2 text-start text-sm transition-colors ${province === 'all' ? 'bg-[var(--primary-soft)] font-semibold text-[var(--primary)]' : 'text-[var(--foreground)] hover:bg-[var(--primary-soft)]'}`}>
          <span className="min-w-0 truncate">{allProvincesLabel}</span>{province === 'all' && <Check size={16} className="shrink-0" aria-hidden="true" />}
        </button>
        {sortedOffices.map(({ id, name }, index) => <button key={id} type="button" role="menuitemradio" aria-checked={province === id} onClick={() => selectProvince(id)} className={`flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-2 text-start text-sm transition-colors ${province === id ? 'bg-[var(--primary-soft)] font-semibold text-[var(--primary)]' : 'text-[var(--foreground)] hover:bg-[var(--primary-soft)]'}`}>
          <span className="flex min-w-0 flex-1 items-center gap-1"><span className="shrink-0 tabular-nums text-xs text-[var(--muted-foreground)]">{numberFormat.format(index + 1)} ـ</span><span className="truncate">{name}</span></span>{province === id && <Check size={16} className="shrink-0" aria-hidden="true" />}
        </button>)}
      </div>}
    </div>
  );
}
