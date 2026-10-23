/**
 * @file src/components/layout/top-header.tsx
 * @project ERP Pro - Front-end
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  getCurrentOrganizationId,
  getCurrentUser,
  logout,
  AuthUser,
} from '@/lib/api/shared/auth-api';
import {
  resolveOrganizationLogoUrl,
  settingsApi,
  type OrganizationBranding,
} from '@/app/(workspace)/settings/settings-api';

import {
  ArrowLeftRight,
  Bot,
  FilePlus2,
  SquareTerminal,
  ChevronLeft,
  LogOut,
  Lock,
  Menu,
  Monitor,
  Moon,
  Search,
  Sun,
  Unlock,
  User,
  X,
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { readShellVisibility } from '@/lib/module-visibility';
import { isReducedEdition } from '@/lib/product-edition';
import { saveSearchHistory } from '@/lib/search-history';
import { HeaderAccountSwitcher } from './header-account-switcher';
import { HeaderProvinceSelector } from './header-province-selector';
import type { MissionEntryMode } from './mission-quick-actions';

interface TopHeaderProps {
  isCollapsed?: boolean;
  isMobileMenuOpen?: boolean;
  isSidebarLocked?: boolean;
  navigateOnClick?: boolean;
  onToggleSidebar?: () => void;
  onToggleMobileMenu?: () => void;
  onToggleSidebarLock?: () => void;
  onToggleNavigateOnClick?: () => void;
  onSelectMissionMode?: (mode: MissionEntryMode) => void;
  activeMissionMode?: MissionEntryMode;
}

export function TopHeader({
  isCollapsed = true,
  isMobileMenuOpen = false,
  isSidebarLocked = false,
  navigateOnClick = false,
  onToggleSidebar,
  onToggleMobileMenu,
  onToggleSidebarLock,
  onToggleNavigateOnClick,
  onSelectMissionMode,
  activeMissionMode = 'form',
}: TopHeaderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const missionMenuRef = useRef<HTMLDivElement>(null);
  const [isMissionMenuOpen, setIsMissionMenuOpen] = useState(false);
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');
  const [shellVisibility, setShellVisibility] = useState(() => readShellVisibility(isReducedEdition));
  const router = useRouter();
  const [organizationBranding, setOrganizationBranding] =
    useState<OrganizationBranding | null>(null);
  const { theme, setTheme } = useTheme();
  const { locale } = usePreferences();
  const direction = getLocaleDirection(locale);
  const english = locale !== 'fa';
  const message = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const missionVisibilityKey = { form: 'missionForm', command: 'missionCommand', ai: 'missionAI' } as const;
  const isMissionModeVisible = (mode: MissionEntryMode) => shellVisibility.headerControls?.[missionVisibilityKey[mode]] !== false;

  useEffect(() => {
    const refresh = () => setShellVisibility(readShellVisibility(isReducedEdition));
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('erp-module-visibility-change', refresh);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('erp-module-visibility-change', refresh); };
  }, []);

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

  useEffect(() => {
    if (!isMissionMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (missionMenuRef.current && !missionMenuRef.current.contains(event.target as Node)) {
        setIsMissionMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMissionMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isMissionMenuOpen]);

  const handleSignOut = async () => {
    setIsAccountMenuOpen(false);
    await logout();
    router.push('/login');
  };

  const submitHeaderSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = headerSearchQuery.trim();
    if (query) saveSearchHistory(query, isReducedEdition);
    router.push(query ? `/dashboard/search?q=${encodeURIComponent(query)}` : '/dashboard/search');
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

  const handleSidebarButtonClick = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    // اگر سایدبار باز است و قفل است -> قفل را باز کن
    if (!isCollapsed && isSidebarLocked) {
      onToggleSidebarLock?.();
      return;
    }

    // اگر سایدبار بسته است -> بازش کن
    if (isCollapsed) {
      onToggleSidebar?.();
      return;
    }

    // اگر سایدبار باز است و هنوز قفل نیست -> قفلش کن
    onToggleSidebarLock?.();
  };

  const handleSidebarButtonMouseDown = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.stopPropagation();
  };

  const sidebarButtonTitle = isCollapsed
    ? message('openSidebar')
    : isSidebarLocked
      ? message('unlockSidebar')
      : message('lockSidebar');

  const sidebarButtonIcon = isCollapsed ? (
    <ChevronLeft size={18} />
  ) : isSidebarLocked ? (
    <Lock size={18} />
  ) : (
    <Unlock size={18} />
  );

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

  const navigateModeTitle = navigateOnClick
    ? message('navigateOn')
    : message('navigateOff');
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
        {/* ۱. دکمه کنترل سایدبار (فلش باز/بستن/قفل) */}
        {onToggleSidebar && (
          <div id="sidebar-controls">
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
              id="sidebar-toggle-btn"
              type="button"
              onMouseDown={handleSidebarButtonMouseDown}
              onClick={handleSidebarButtonClick}
              title={sidebarButtonTitle}
              aria-label={sidebarButtonTitle}
              aria-pressed={!isCollapsed && isSidebarLocked}
              className={`pointer-events-auto hidden md:flex
                flex h-9 w-9 cursor-pointer
                items-center justify-center
                rounded-xl transition-all duration-200
                ${
                  !isCollapsed && isSidebarLocked
                    ? 'border-2 border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] shadow-sm shadow-[var(--primary)]/20'
                    : 'border border-[var(--border)] text-[var(--foreground)]'
                }
              `}
            >
              <span className="pointer-events-none flex items-center justify-center">
                {sidebarButtonIcon}
              </span>
            </button>
          </div>
        )}

        {/* ۲. دکمه فلش دوطرفه (سوئیچ حالت ناوبری) */}
        {onToggleNavigateOnClick && (
          <button
            id="navigate-on-click-toggle-btn"
            type="button"
            onClick={onToggleNavigateOnClick}
            title={navigateModeTitle}
            aria-label={navigateModeTitle}
            aria-pressed={navigateOnClick}
            className={`pointer-events-auto flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center
              rounded-xl transition-all duration-200
              ${
                navigateOnClick
                  ? 'border-2 border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] shadow-sm shadow-[var(--primary)]/20'
                  : 'border border-[var(--border)] text-[var(--foreground)]'
              }
            `}
          >
            <ArrowLeftRight size={18} />
          </button>
        )}

        <button
          type="button"
          onClick={cycleTheme}
          title={themeTitle}
          aria-label={message('changeTheme')}
          className="pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground)] transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800/80"
        >
          {themeIcon}
        </button>
        <button type="button" onClick={() => router.push('/dashboard/search')} title={message('headerSearch')} aria-label={message('headerSearch')} className="pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground)] lg:hidden"><Search size={17} /></button>
        </div>

        {/* کپسول حساب کاربری در سوی مقابل کنترل‌ها */}
        <div className="pointer-events-none order-2 flex shrink-0 items-center gap-1.5">
        <div className="pointer-events-auto flex shrink-0 items-center gap-1.5" dir="ltr">
        {shellVisibility.headerControls?.accountSwitcher !== false && <div className="hidden md:block">
          <HeaderAccountSwitcher userId={user?.id} />
        </div>}
        {shellVisibility.headerControls?.provinceSelector !== false && <HeaderProvinceSelector userId={user?.id} />}
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
              rounded-full border p-0 transition-all sm:h-10 sm:w-44 sm:justify-start
              sm:gap-2.5 sm:rounded-2xl sm:p-1.5 sm:pe-4 sm:ps-1.5
              ${isAccountMenuOpen ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]' : 'border-[var(--border)] text-[var(--foreground)]'}
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40
            `}
          >
          {/* آواتار کاربر */}
          <div
            className="
              pointer-events-none
              flex h-7 w-7 shrink-0 items-center
              justify-center overflow-hidden rounded-full
              font-black text-white shadow-inner text-xs
            "
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {user?.avatarUrl ? (
              <Image src={user.avatarUrl} alt="" width={28} height={28} unoptimized className="h-full w-full object-cover" />
            ) : user?.lastName?.trim() ? (
              user.lastName.trim().charAt(0).toLocaleUpperCase(locale)
            ) : user?.name ? (
              user.name.charAt(0).toLocaleUpperCase(locale)
            ) : (
              <User size={17} />
            )}
          </div>

          {/* نام و نقش */}
          <div className="pointer-events-none hidden min-w-0 flex-1 text-start sm:block">
            <p className="truncate whitespace-nowrap text-xs font-bold leading-tight" title={[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || message('admin')}>
              {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || message('admin')}
            </p>
          </div>
          </button>
          {isAccountMenuOpen && (
            <div role="menu" className={`pointer-events-auto absolute end-0 top-full z-[60] mt-3 min-w-48 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-lg md:top-1/2 md:mt-0 md:min-w-36 md:p-1 md:-translate-y-1/2 ${direction === 'rtl' ? 'md:right-full md:left-auto md:me-3' : 'md:left-full md:right-auto md:ms-3'}`}>
              <div className="md:hidden">
                {shellVisibility.headerControls?.accountSwitcher !== false && <HeaderAccountSwitcher userId={user?.id} embedded />}
                {shellVisibility.headerControls?.provinceSelector !== false && <div className="px-2 py-1"><HeaderProvinceSelector userId={user?.id} /></div>}
                <div className="my-1 border-t border-[var(--border)]" />
              </div>
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
        {(['form', 'command', 'ai'] as MissionEntryMode[]).some(isMissionModeVisible) && <div ref={missionMenuRef} className="pointer-events-auto relative lg:hidden">
          <button type="button" onClick={() => setIsMissionMenuOpen((open) => !open)} title={message('missionShortcutTitle')} aria-label={message('missionShortcutTitle')} aria-haspopup="menu" aria-expanded={isMissionMenuOpen} aria-pressed="true" className="flex size-10 min-w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]">
            {activeMissionMode === 'form' ? <FilePlus2 className="size-[17px] shrink-0"/> : activeMissionMode === 'command' ? <SquareTerminal className="size-[17px] shrink-0"/> : <Bot className="size-[17px] shrink-0"/>}
          </button>
          {isMissionMenuOpen && <div role="menu" dir={direction} className={`absolute ${direction === 'rtl' ? 'end-0' : 'start-0'} top-full z-[70] mt-2 w-max min-w-40 max-w-[calc(100vw-1rem)] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-xl`}>
            {([
              ['form', FilePlus2, 'missionModeForm'],
              ['command', SquareTerminal, 'missionModeCommand'],
              ['ai', Bot, 'missionModeAI'],
            ] as const).filter(([mode]) => isMissionModeVisible(mode)).map(([mode, Icon, label]) => <button key={mode} type="button" role="menuitemradio" aria-checked={activeMissionMode === mode} onClick={() => { setIsMissionMenuOpen(false); onSelectMissionMode?.(mode); }} className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-sm font-medium ${activeMissionMode === mode ? 'bg-[var(--primary-soft)] text-[var(--primary)]' : 'text-[var(--foreground)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]'}`}><Icon className="size-4 shrink-0"/>{message(label)}</button>)}
          </div>}
        </div>}
        </div>
        </div>
      </div>

      {/* نام شرکت در چپ، لوگوی دقیقاً وسط و ERP در راست؛ کل نشان به داشبورد می‌رود */}
      <div
        className="
          absolute left-1/2 top-1/2
          -translate-x-1/2 -translate-y-1/2
        "
      >
        <Link
          href="/dashboard"
          aria-label={message('dashboard')}
          dir="ltr"
          className="pointer-events-auto relative flex h-12 w-12 items-center justify-center rounded-xl"
        >
          <span
            className="absolute right-[calc(100%+0.0625rem)] top-1/2 hidden w-max max-w-[min(24vw,15rem)] -translate-y-1/2 truncate text-left font-black tracking-tight text-[var(--foreground)] sm:block"
            style={{ fontSize: english ? '0.8rem' : '0.95rem' }}
          >
            {organizationBranding?.name || 'رهیار'}
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
              <Image
                src="/rahyar-road.png?v=1"
                alt={message('organizationLogo')}
                width={40}
                height={40}
                unoptimized
                className="h-10 w-10 object-contain"
              />
            )}
          </div>

          <span dir="rtl" className="absolute left-[calc(100%+0.0625rem)] top-1/2 hidden -translate-y-1/2 text-[11px] font-bold tracking-wide text-primary sm:block">
            Rahyar
          </span>
        </Link>
      </div>

      <div className="pointer-events-none absolute end-5 top-1/2 hidden -translate-y-1/2 flex-row-reverse items-center gap-1.5 lg:flex" aria-label={message('missionShortcutTitle')}>
        {([
          ['form', FilePlus2, 'missionModeForm'],
          ['command', SquareTerminal, 'missionModeCommand'],
          ['ai', Bot, 'missionModeAI'],
        ] as const).filter(([mode]) => isMissionModeVisible(mode)).map(([mode, Icon, label]) => (
          <button key={mode} type="button" onClick={() => onSelectMissionMode?.(mode)} title={message(label)} aria-label={message(label)} aria-pressed={activeMissionMode === mode} className={`pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${activeMissionMode === mode ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]' : 'border-[var(--border)] text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)]'}`}>
            <Icon size={17}/>
          </button>
        ))}
        <form onSubmit={submitHeaderSearch} role="search" className="pointer-events-auto hidden xl:flex">
          <label className="relative block">
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="search" value={headerSearchQuery} onChange={(event) => setHeaderSearchQuery(event.target.value)} aria-label={message('headerSearch')} placeholder={message('headerSearch')} className="h-9 w-48 rounded-xl border border-[var(--border)] bg-[var(--surface)] ps-9 pe-3 text-sm text-[var(--foreground)] outline-none placeholder:text-muted-foreground focus:border-[var(--primary)] 2xl:w-56" />
          </label>
        </form>
        <button type="button" onClick={() => router.push('/dashboard/search')} title={message('headerSearch')} aria-label={message('headerSearch')} className="pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground)] xl:hidden"><Search size={17} /></button>
      </div>


    </header>
  );
}

