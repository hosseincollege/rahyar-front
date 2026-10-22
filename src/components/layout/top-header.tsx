/**
 * @file src/components/layout/top-header.tsx
 * @project Rahyar - Front-end
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { getCurrentOrganizationId, getCurrentUser, logout, type AuthUser } from '@/lib/api/shared/auth-api';
import { resolveOrganizationLogoUrl, settingsApi, type OrganizationBranding } from '@/lib/api/settings/settings-api';
import { LogOut, Menu, Monitor, Moon, Search, ShieldCheck, Sun, User, X } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { HeaderProvinceSelector } from './header-province-selector';
import { HeaderAccountSwitcher } from './header-account-switcher';
import { rahcomApi, type RahcomSystem } from '@/lib/rahcom-api';

interface TopHeaderProps {
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
}

function repairMojibake(value: string): string {
  const specialCodePoints = [
    0x20ac, 0x0081, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
    0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x008d, 0x017d, 0x008f,
    0x0090, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
    0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x009d, 0x017e, 0x0178,
  ];
  const bytes: number[] = [];

  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
      continue;
    }
    if (codePoint >= 0x00a0 && codePoint <= 0x00ff) {
      bytes.push(codePoint);
      continue;
    }
    const specialIndex = specialCodePoints.indexOf(codePoint);
    if (specialIndex < 0) return value;
    bytes.push(0x80 + specialIndex);
  }

  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(
      Uint8Array.from(bytes),
    );
    return /[\u0600-\u06ff]/u.test(decoded) ? decoded : value;
  } catch {
    return value;
  }
}

export function TopHeader({ isMobileMenuOpen = false, onToggleMobileMenu }: TopHeaderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [systemsSearch, setSystemsSearch] = useState('');
  const [systemMatches, setSystemMatches] = useState<RahcomSystem[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [organizationBranding, setOrganizationBranding] =
    useState<OrganizationBranding | null>(null);
  const { theme, setTheme } = useTheme();
  const { locale } = usePreferences();
  const direction = getLocaleDirection(locale);
  const english = locale !== 'fa';
  const message = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);

  useEffect(() => {
    if (pathname !== '/rahcom/systems') return;
    const frame = window.requestAnimationFrame(() => {
      const value = window.sessionStorage.getItem('rahyar-rahcom-systems-search') || '';
      setSystemsSearch(value);
      window.dispatchEvent(new CustomEvent('rahyar:systems-search', { detail: { query: value } }));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  const updateSystemsSearch = (value: string) => {
    setSystemsSearch(value);
    setSearchOpen(true);
    window.sessionStorage.setItem('rahyar-rahcom-systems-search', value);
    window.dispatchEvent(new CustomEvent('rahyar:systems-search', { detail: { query: value } }));
  };

  useEffect(() => {
    const query = systemsSearch.trim().toLocaleLowerCase();
    if (query.length < 2) { setSystemMatches([]); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      void rahcomApi.systems().then((systems) => {
        if (active) setSystemMatches(systems.filter((system) => `${system.systemCode} ${system.systemName}`.toLocaleLowerCase().includes(query)).slice(0, 5));
      }).catch(() => { if (active) setSystemMatches([]); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [systemsSearch]);

  const openSystemAction = (system: RahcomSystem, destination: 'map' | 'systems' | 'actions') => {
    window.localStorage.setItem(`rahyar-selected-province:${user?.id || 'current'}`, system.province);
    window.sessionStorage.setItem('rahyar-rahcom-focus-system', system.id);
    if (destination === 'systems') window.sessionStorage.setItem('rahyar-rahcom-systems-search', system.systemCode);
    setSearchOpen(false);
    router.push(destination === 'systems' ? '/rahcom/systems' : `/rahcom/${destination}`);
    window.dispatchEvent(new CustomEvent('rahyar:province-change', { detail: { province: system.province } }));
  };

  useEffect(() => {
    if (!isAccountMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isAccountMenuOpen]);


  const handleSignOut = async () => {
    setIsAccountMenuOpen(false);
    await logout();
    router.push('/login');
  };

  /*
   * دریافت اطلاعات کاربر و اعمال تم ذخیره‌شده
   */
  useEffect(() => {
    setUser(getCurrentUser());
    let isCurrent = true;

    const refreshOrganizationBranding = () => {
      const organizationId = getCurrentOrganizationId();
      if (!organizationId) {
        setOrganizationBranding(null);
        return;
      }
      void settingsApi
        .getOrganizationBranding(organizationId)
        .then((branding) => {
          if (isCurrent) setOrganizationBranding(branding);
        })
        .catch(() => {
          if (isCurrent) setOrganizationBranding(null);
        });
    };

    refreshOrganizationBranding();

    const handleAuthChange = () => {
      setUser(getCurrentUser());
    };

    window.addEventListener('auth:logout', handleAuthChange);
    window.addEventListener('auth:user-updated', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);
    window.addEventListener(
      'organization-branding-changed',
      refreshOrganizationBranding,
    );

    return () => {
      window.removeEventListener(
        'auth:logout',
        handleAuthChange
      );
      window.removeEventListener('auth:user-updated', handleAuthChange);

      window.removeEventListener(
        'storage',
        handleAuthChange
      );
      window.removeEventListener(
        'organization-branding-changed',
        refreshOrganizationBranding,
      );
      isCurrent = false;
    };
  }, []);

  /*
   * گردش بین حالت‌های تم
   */
  const cycleTheme = () => {
    const nextTheme =
      theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';

    setTheme(nextTheme);
  };

  const themeIcon =
    theme === 'system' ? (
      <Monitor size={18} />
    ) : theme === 'light' ? (
      <Sun size={18} />
    ) : (
      <Moon size={18} />
    );

  const themeTitle =
    theme === 'system'
    ? message('themeSystem')
      : theme === 'light'
      ? message('themeLight')
      : message('themeDark');

  const logoShadow = organizationBranding?.logoBackground ?? 'NONE';
  const logoShadowClassName =
    logoShadow === 'DARK'
      ? 'drop-shadow-[0_0_5px_rgba(0,0,0,0.9)]'
      : logoShadow === 'LIGHT'
        ? 'drop-shadow-[0_0_5px_rgba(255,255,255,0.95)]'
        : 'drop-shadow-none';

  return (
    <header
      dir={direction}
      className="
        sticky top-0 z-50 relative flex h-16
        items-center border-b border-[var(--border)]
        bg-[var(--surface)]/90 px-5
        backdrop-blur-md transition-colors duration-200
      "
    >
      {/* در موبایل کنترل‌ها کنار هم در سمت شروع و کپسول حساب در سمت مقابل می‌ماند. */}
      <div
        dir={direction}
        className="
          pointer-events-none absolute inset-x-3 top-1/2 z-10 w-[calc(100%-1.5rem)] -translate-y-1/2
          flex min-w-0 items-center justify-between gap-1.5
          md:inset-x-auto md:start-5 md:w-auto md:justify-start
        "
      >
        <div className="order-1 flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          title={message(isMobileMenuOpen ? 'closeSidebar' : 'openSidebar')}
          aria-label={message(isMobileMenuOpen ? 'closeSidebar' : 'openSidebar')}
          aria-expanded={isMobileMenuOpen}
          aria-controls="erp-mobile-navigation"
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground)] md:hidden"
        >
          {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <button
          type="button"
          onClick={cycleTheme}
          title={themeTitle}
          aria-label={message('changeTheme')}
          className="pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground)] transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800/80"
        >
          {themeIcon}
        </button>
        </div>

        {/* کپسول حساب کاربری در سوی مقابل کنترل‌ها */}
        <div className="pointer-events-none order-2 flex shrink-0 items-center gap-1.5">
        <div className="pointer-events-auto flex shrink-0 items-center gap-1.5" dir="rtl">
        <div ref={accountMenuRef} dir={direction} className="pointer-events-none relative shrink-0">
          <button
            id="user-profile-header-btn"
            type="button"
            onClick={() => setIsAccountMenuOpen((open) => !open)}
            aria-label={message('viewProfile')}
            aria-haspopup="menu"
            aria-expanded={isAccountMenuOpen}
            className={`
              pointer-events-auto flex size-10 cursor-pointer select-none items-center justify-center
              rounded-full border p-0 transition-all sm:h-auto sm:w-auto sm:justify-start
              sm:gap-2.5 sm:rounded-2xl sm:p-1.5 sm:pe-4 sm:ps-1.5
              ${isAccountMenuOpen ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]' : 'border-[var(--border)] text-[var(--foreground)]'}
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40
            `}
          >
          {/* آواتار کاربر */}
          <div
            className="
              pointer-events-none
              flex h-7 w-7 items-center
              justify-center rounded-full
              font-black text-white shadow-inner text-xs
            "
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {user?.name ? (
              user.name.charAt(0).toUpperCase()
            ) : (
              <User size={17} />
            )}
          </div>

          {/* نام و نقش */}
          <div className="pointer-events-none hidden text-start sm:block">
            <p className="text-xs font-bold leading-tight">
              {user?.name || message('admin')}
            </p>

            <p
              className="
                text-[10px] font-medium leading-normal
                text-primary
              "
            >
              {user?.role || message('user')}
            </p>
          </div>
          </button>
          {isAccountMenuOpen && (
            <div role="menu" className={`pointer-events-auto absolute end-0 top-full z-[60] mt-2 min-w-48 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-lg md:top-1/2 md:mt-0 md:min-w-36 md:p-1 md:-translate-y-1/2 ${direction === 'rtl' ? 'md:right-full md:left-auto md:me-2' : 'md:left-full md:right-auto md:ms-2'}`}>
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-start text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 md:min-h-8 md:gap-1.5 md:px-2 md:text-xs"
              >
                <LogOut size={16} />
                {message('sidebarSignOut')}
              </button>
            </div>
          )}
        </div>
        </div>
        <HeaderAccountSwitcher userId={user?.id} />
        <HeaderProvinceSelector userId={user?.id} />
        </div>
      </div>

      <div className="pointer-events-auto absolute end-5 top-1/2 z-20 hidden -translate-y-1/2 md:block">
        <label className="relative block w-56 lg:w-72">
          <Search size={17} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="search" value={systemsSearch} onFocus={() => setSearchOpen(true)} onChange={(event) => updateSystemsSearch(event.target.value)} aria-label={message('rahcomSearchSystems')} placeholder={message('rahcomSearchSystems')} className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] pe-9 ps-3 text-sm text-[var(--foreground)] outline-none placeholder:text-muted-foreground focus:border-[var(--primary)]" />
        </label>
        {searchOpen && systemsSearch.trim().length >= 2 && <div className="absolute end-0 top-full mt-2 w-80 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl">
          {systemMatches.length === 0 ? <p className="p-3 text-sm text-muted-foreground">{message('rahcomNoSystemsFound')}</p> : systemMatches.map((system) => <div key={system.id} className="border-b border-[var(--border)] p-3 last:border-0">
            <p className="truncate text-sm font-semibold text-[var(--foreground)]">{system.systemName}</p><p dir="ltr" className="mt-0.5 text-start font-mono text-xs text-muted-foreground">{system.systemCode}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => openSystemAction(system, 'map')} className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground)] hover:bg-accent">{message('rahcomSearchOnMap')}</button>
              <button type="button" onClick={() => openSystemAction(system, 'systems')} className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground)] hover:bg-accent">{message('rahcomSearchOpenSystem')}</button>
              <button type="button" onClick={() => openSystemAction(system, 'actions')} className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground)] hover:bg-accent">{message('rahcomSearchActions')}</button>
            </div>
          </div>)}
        </div>}
      </div>

      {/* نام شرکت در چپ، لوگوی دقیقاً وسط و رهیار در راست؛ کل نشان به داشبورد می‌رود */}
      <div
        className="
          absolute left-1/2 top-1/2
          -translate-x-1/2 -translate-y-1/2
        "
      >
        <Link
          href="/dashboard"
          aria-label={message('sidebarDashboard')}
          dir="ltr"
          className="pointer-events-auto relative flex h-12 w-12 items-center justify-center rounded-xl"
        >
          <span
            className="absolute right-[calc(100%+0.0625rem)] top-1/2 hidden w-max max-w-[min(24vw,15rem)] -translate-y-1/2 truncate text-left font-black tracking-tight text-[var(--foreground)] sm:block"
            style={{ fontSize: english ? '0.8rem' : '0.95rem' }}
          >
            {repairMojibake(organizationBranding?.name || 'رهیار')}
          </span>

          <div
            className={`
              flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden
              rounded-xl
              ${logoShadowClassName}
            `}
          >
            {organizationBranding?.logoUrl ? (
              <Image
                src={
                  resolveOrganizationLogoUrl(organizationBranding.logoUrl) || ''
                }
                alt={message('organizationLogo')}
                width={32}
                height={32}
                unoptimized
                className="h-full w-full object-contain"
                onError={() =>
                  setOrganizationBranding((current) =>
                    current ? { ...current, logoUrl: null } : current,
                  )
                }
              />
            ) : (
              <ShieldCheck size={23} className="text-primary" />
            )}
          </div>

          <span className="absolute left-[calc(100%+0.0625rem)] top-1/2 hidden -translate-y-1/2 text-[11px] font-bold tracking-wide text-primary sm:block">
            رهیار
          </span>
        </Link>
      </div>



    </header>
  );
}


