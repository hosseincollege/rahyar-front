/**
 * @file src/components/layout/top-header.tsx
 * @project Rahyar
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
  MoreHorizontal,
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
import { iranProvinces, rahcomApi, type RahcomSystem } from '@/lib/api/rahcom/rahcom-api';
import { searchRahcomSystems } from '@/lib/rahcom-system-search';
import { openRahcomRowInfo, RahcomRowInfoHost } from '@/app/(workspace)/rahcom/_shared/rahcom-row-info';
import { HeaderAccountSwitcher } from './header-account-switcher';
import { HeaderProvinceSelector } from './header-province-selector';
import type { MissionEntryMode } from './mission-quick-actions';

interface TopHeaderProps {
  enableMobileHorizontalElasticDrag?: boolean;
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
  enableMobileHorizontalElasticDrag = false,
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
  const headerDragRef = useRef<{ pointerId: number; startX: number; startY: number; shell: HTMLElement; previousTransform: string; previousTransition: string; previousWillChange: string; moved: boolean } | null>(null);
  const suppressClickAfterHeaderDragRef = useRef(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [mobileSearchExpanded, setMobileSearchExpanded] = useState(false);
  const [mobileTool, setMobileTool] = useState<'search' | 'accountSwitcher' | 'province' | 'profile' | 'mission' | null>(null);
  const mobileToolsRef = useRef<HTMLDivElement>(null);
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');
  const [headerSearchProvince, setHeaderSearchProvince] = useState('all');
  const [headerSystems, setHeaderSystems] = useState<RahcomSystem[] | null>(null);
  const [headerSearchResults, setHeaderSearchResults] = useState<RahcomSystem[]>([]);
  const [headerSearchOpen, setHeaderSearchOpen] = useState(false);
  const [headerSearchLoading, setHeaderSearchLoading] = useState(false);
  const [headerSearchError, setHeaderSearchError] = useState(false);
  const headerSystemsPromiseRef = useRef<Promise<RahcomSystem[]> | null>(null);
  const headerSearchRef = useRef<HTMLFormElement>(null);
  const [shellVisibility, setShellVisibility] = useState(() => readShellVisibility(isReducedEdition));
  const router = useRouter();
  const [organizationBranding, setOrganizationBranding] =
    useState<OrganizationBranding | null>(null);
  const { theme, setTheme } = useTheme();
  const { locale } = usePreferences();
  const direction = getLocaleDirection(locale);
  const english = locale !== 'fa';
  const message = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const isMissionModeVisible = (_mode: MissionEntryMode) => shellVisibility.headerControls?.missionTools !== false;

  useEffect(() => {
    let active = true;
    const applyProvince = (province: unknown) => {
      if (typeof province !== 'string' || !province.trim()) return;
      setHeaderSearchProvince((current) => {
        if (current === province) return current;
        setHeaderSystems(null);
        setHeaderSearchResults([]);
        headerSystemsPromiseRef.current = null;
        return province;
      });
    };
    const onProvinceChange = (event: Event) => applyProvince((event as CustomEvent<{ province?: string }>).detail?.province);
    window.addEventListener('rahyar:province-change', onProvinceChange);
    void rahcomApi.access().then((access) => {
      if (active) applyProvince(access.isAdmin ? access.selectedProvince ?? 'all' : access.province ?? 'all');
    }).catch(() => undefined);
    return () => { active = false; window.removeEventListener('rahyar:province-change', onProvinceChange); };
  }, []);

  useEffect(() => {
    if (!enableMobileHorizontalElasticDrag) return;
    const finishDrag = (event: PointerEvent) => {
      const drag = headerDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      headerDragRef.current = null;
      if (!drag.moved) return;

      drag.shell.style.transition = 'transform 220ms cubic-bezier(.2,.8,.2,1)';
      drag.shell.style.transform = drag.previousTransform;
      window.setTimeout(() => {
        drag.shell.style.transition = drag.previousTransition;
        drag.shell.style.willChange = drag.previousWillChange;
      }, 240);
      suppressClickAfterHeaderDragRef.current = true;
      window.requestAnimationFrame(() => {
        suppressClickAfterHeaderDragRef.current = false;
      });
    };
    const moveDrag = (event: PointerEvent) => {
      const drag = headerDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      if (!drag.moved && Math.abs(dx) <= Math.abs(dy)) {
        headerDragRef.current = null;
        return;
      }
      if (!drag.moved) {
        drag.shell.style.willChange = 'transform';
        drag.shell.style.transition = 'none';
      }
      drag.moved = true;
      event.preventDefault();
      const resistedOffset = Math.sign(dx) * Math.min(52, Math.abs(dx) * 0.32);
      drag.shell.style.transform = `translate3d(${resistedOffset}px, 0, 0)`;
    };
    document.addEventListener('pointermove', moveDrag, { passive: false });
    document.addEventListener('pointerup', finishDrag);
    document.addEventListener('pointercancel', finishDrag);
    return () => {
      document.removeEventListener('pointermove', moveDrag);
      document.removeEventListener('pointerup', finishDrag);
      document.removeEventListener('pointercancel', finishDrag);
    };
  }, [enableMobileHorizontalElasticDrag]);

  const beginHeaderDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (!enableMobileHorizontalElasticDrag || !window.matchMedia('(max-width: 767px)').matches || event.button !== 0) return;
    const origin = event.target;
    if (origin instanceof Element && origin.closest('input, textarea, select, [contenteditable="true"]')) return;
    const shell = document.querySelector<HTMLElement>('.erp-app-shell');
    if (!shell) return;
    headerDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      shell,
      previousTransform: shell.style.transform,
      previousTransition: shell.style.transition,
      previousWillChange: shell.style.willChange,
      moved: false,
    };
  };

  const handleHeaderClickCapture = (event: React.MouseEvent<HTMLElement>) => {
    if (!suppressClickAfterHeaderDragRef.current) return;
    suppressClickAfterHeaderDragRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  useEffect(() => {
    const query = headerSearchQuery.trim();
    if (!query) {
      setHeaderSearchResults([]);
      setHeaderSearchLoading(false);
      setHeaderSearchError(false);
      setHeaderSearchOpen(false);
      return;
    }
    setHeaderSearchOpen(true);
    if (headerSystems) {
      setHeaderSearchResults(searchRahcomSystems(headerSystems, query, locale).slice(0, 8));
      setHeaderSearchLoading(false);
      setHeaderSearchError(false);
      return;
    }
    setHeaderSearchLoading(true);
    let active = true;
    const timer = window.setTimeout(() => {
      headerSystemsPromiseRef.current ??= rahcomApi.systems(headerSearchProvince);
      void headerSystemsPromiseRef.current
        .then((items) => {
          if (!active) return;
          setHeaderSystems(items);
          setHeaderSearchResults(searchRahcomSystems(items, query, locale).slice(0, 8));
          setHeaderSearchError(false);
        })
        .catch(() => {
          headerSystemsPromiseRef.current = null;
          if (active) { setHeaderSearchResults([]); setHeaderSearchError(true); }
        })
        .finally(() => { if (active) setHeaderSearchLoading(false); });
    }, 160);
    return () => { active = false; window.clearTimeout(timer); };
  }, [headerSearchQuery, headerSearchProvince, headerSystems, locale]);

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!headerSearchRef.current?.contains(target) && !mobileToolsRef.current?.contains(target)) setHeaderSearchOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setHeaderSearchOpen(false); };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('mousedown', closeOutside); document.removeEventListener('keydown', closeOnEscape); };
  }, []);

  useEffect(() => {
    const refresh = () => setShellVisibility(readShellVisibility(isReducedEdition));
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('rahyar-module-visibility-change', refresh);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('rahyar-module-visibility-change', refresh); };
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
    if (!mobileToolsOpen && !mobileSearchExpanded) return;
    const close = (event: MouseEvent) => { if (mobileToolsRef.current && !mobileToolsRef.current.contains(event.target as Node)) { setMobileToolsOpen(false); setMobileSearchExpanded(false); } };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMobileToolsOpen(false); setMobileSearchExpanded(false); } };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, [mobileToolsOpen, mobileSearchExpanded]);

  const handleSignOut = async () => {
    setIsAccountMenuOpen(false);
    await logout();
    router.push('/login');
  };

  const cycleMissionMode = () => {
    const modes: MissionEntryMode[] = ['form', 'command', 'ai'];
    const currentIndex = modes.indexOf(activeMissionMode);
    onSelectMissionMode?.(modes[(currentIndex + 1 + modes.length) % modes.length]);
  };

  const submitHeaderSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = headerSearchQuery.trim();
    if (query) saveSearchHistory(query, isReducedEdition);
    if (headerSearchResults[0]) {
      selectHeaderSystem(headerSearchResults[0]);
      return;
    }
    router.push('/rahcom/systems');
  };

  const selectHeaderSystem = (system: RahcomSystem, trigger?: HTMLElement | null) => {
    saveSearchHistory(headerSearchQuery, isReducedEdition);
    setHeaderSearchQuery('');
    setHeaderSearchOpen(false);
    setMobileToolsOpen(false);
    setMobileSearchExpanded(false);
    setMobileTool(null);
    const axisName = system.announcedAxis ?? '';
    const axisCode = system.axisCode ?? '';
    openRahcomRowInfo(system.systemName || system.systemCode, [
      { label: message('rahcomSystemCode'), value: system.systemCode },
      { label: message('rahcomSystemName'), value: system.systemName },
      { label: message('rahcomAxisName'), value: axisName },
      { label: message('rahcomAxisCode'), value: axisCode },
      { label: message('rahcomProvince'), value: iranProvinces.find(([id]) => id === system.province)?.[1] ?? system.province },
    ], trigger ?? document.activeElement as HTMLElement | null, undefined, system.systemCode);
  };

  const renderHeaderSystemSuggestions = (mobile = false) => headerSearchOpen && headerSearchQuery.trim() ? (
    <div role="listbox" aria-label={message('headerSearch')} aria-live="polite" dir={direction} style={{ backgroundColor: 'var(--gray-header, var(--surface))' }} className={`${mobile ? 'relative mt-2 w-full' : 'absolute end-0 top-full mt-2 w-80 max-w-[calc(100vw-1.5rem)]'} z-[120] overflow-hidden rounded-xl border border-[var(--border)] text-[var(--foreground)] shadow-2xl`}>
      {headerSearchLoading ? <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground"><span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />{message('headerSearch')}</div> : null}
      {headerSearchError ? <p role="alert" className="px-3 py-3 text-sm text-muted-foreground">{message('rahcomSystemsLoadError')}</p> : null}
      {!headerSearchLoading && !headerSearchError && headerSearchResults.length === 0 ? <p className="px-3 py-3 text-sm text-muted-foreground">{message('searchNoResults')}</p> : null}
      {!headerSearchLoading ? headerSearchResults.map((system) => <button key={system.id} type="button" role="option" aria-selected="false" onClick={(event) => selectHeaderSystem(system, event.currentTarget)} className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-2 text-start last:border-b-0 hover:bg-[var(--primary-soft)] focus-visible:bg-[var(--primary-soft)] focus-visible:outline-none">
        <span className="min-w-0 truncate text-sm font-medium">{system.systemName}</span><span dir="ltr" className="shrink-0 font-mono text-xs text-muted-foreground">{system.systemCode}</span>
      </button>) : null}
    </div>
  ) : null;

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
      data-app-top-header
      dir={direction}
      onPointerDown={beginHeaderDrag}
      onClickCapture={handleHeaderClickCapture}
      className={`
        sticky top-0 z-50 relative flex h-16
        items-center border-b border-[var(--border)]
        bg-[var(--surface)]/90 px-5
        backdrop-blur-md transition-colors duration-200
        ${enableMobileHorizontalElasticDrag ? 'max-md:touch-pan-y max-md:cursor-grab' : ''}
      `}
    >
      {/* در موبایل کنترل‌ها کنار هم در سمت شروع و کپسول حساب در سمت مقابل می‌ماند. */}
      <div
        dir={direction}
        className="
          pointer-events-none absolute inset-x-3 top-1/2 z-10 w-[calc(100%-1.5rem)] -translate-y-1/2
          flex min-w-0 items-center justify-between gap-1.5
          max-sm:inset-x-3 max-sm:gap-0.5 md:inset-x-auto md:start-5 md:w-auto md:justify-start
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
              className="pointer-events-auto flex h-9 w-9 max-sm:h-8 max-sm:w-8 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground)] md:hidden"
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
            className={`pointer-events-auto flex h-9 w-9 max-sm:h-8 max-sm:w-8 shrink-0 cursor-pointer items-center justify-center
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
          className="pointer-events-auto flex h-9 w-9 max-sm:h-8 max-sm:w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground)] transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800/80"
        >
          {themeIcon}
        </button>
        </div>

        <div ref={mobileToolsRef} className="pointer-events-auto absolute inset-y-0 left-3 z-20 flex items-center gap-0.5 max-sm:left-1 lg:hidden">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center max-sm:h-8 max-sm:w-8">
            <button type="button" onClick={() => { setMobileSearchExpanded((expanded) => !expanded); setMobileToolsOpen(false); setMobileTool(null); setHeaderSearchOpen(Boolean(headerSearchQuery.trim())); }} aria-label={message('headerSearch')} title={message('headerSearch')} aria-expanded={mobileSearchExpanded} style={mobileSearchExpanded ? { backgroundColor: 'var(--primary-soft)', borderColor: 'var(--primary)', color: 'var(--primary)' } : undefined} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground)] transition-colors hover:bg-[var(--primary-soft)] max-sm:h-8 max-sm:w-8"><Search size={18}/></button>
            {mobileSearchExpanded && <div className="absolute -left-10 top-[calc(100%+0.5rem)] z-[130] w-[min(18rem,calc(100vw-2rem))]">
              <form onSubmit={(event) => { submitHeaderSearch(event); setMobileSearchExpanded(false); }} role="search" style={{ backgroundColor: 'var(--gray-header,var(--surface))', color: 'var(--foreground)' }} className="rahcom-search-capsule rahcom-search-capsule--outer-focus flex h-12 min-w-0 items-center gap-2 rounded-full border border-[var(--border)] px-3 text-foreground shadow-lg transition-colors focus-within:border-[var(--primary)]">
                <input autoFocus type="text" value={headerSearchQuery} onChange={(event) => setHeaderSearchQuery(event.target.value)} aria-label={message('headerSearch')} placeholder={message('headerSearch')} className="h-full min-w-0 flex-1 rounded-full bg-transparent text-sm text-inherit outline-none ring-0 placeholder:text-muted-foreground focus:outline-none focus:ring-0" />
                {headerSearchQuery && <button type="button" onClick={() => setHeaderSearchQuery('')} aria-label={message('searchClear')} title={message('searchClear')} className="grid size-7 shrink-0 place-items-center rounded-full text-inherit hover:bg-muted focus-visible:outline-none"><X size={16}/></button>}
                <button type="submit" aria-label={message('headerSearch')} title={message('headerSearch')} className="grid size-8 shrink-0 place-items-center rounded-full text-inherit focus-visible:outline-none"><Search size={18}/></button>
              </form>
              {renderHeaderSystemSuggestions()}
            </div>}
          </div>
          <button type="button" onClick={() => { setMobileSearchExpanded(false); setMobileToolsOpen((open) => !open); setMobileTool(null); }} aria-label={message('missionShortcutTitle')} title={message('missionShortcutTitle')} aria-expanded={mobileToolsOpen && mobileTool === null} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground)] max-sm:h-8 max-sm:w-8"><MoreHorizontal size={19}/></button>
          {mobileToolsOpen && <div dir={direction} style={{ backgroundColor: 'var(--gray-header, var(--surface))' }} className="fixed left-2 top-14 z-[100] w-[min(9.5rem,calc(100vw-1rem))] rounded-xl border border-[var(--border)] p-1.5 shadow-2xl">
            {mobileTool === null ? <div>{([['accountSwitcher','settingsHeaderAccountSwitcher'],['province','settingsHeaderProvinceSelector'],['profile','viewProfile'],['mission','missionShortcutTitle']] as const).filter(([id]) => id !== 'province' || isReducedEdition).map(([id,label], index, items) => <button key={id} type="button" onClick={() => setMobileTool(id)} className={`min-h-10 w-full px-3 text-start text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--primary-soft)] ${index < items.length - 1 ? 'border-b border-[var(--border)]' : ''}`}>{locale === 'fa' && id === 'profile' ? 'پروفایل' : locale === 'fa' && id === 'mission' ? 'فرم و دستیار' : message(label)}</button>)}</div> : <div>
              <button type="button" onClick={() => setMobileTool(null)} aria-label="بازگشت" title="بازگشت" className="mb-1 inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)]"><span>بازگشت</span><ChevronLeft size={16}/></button>
              {mobileTool === 'search' && <div className="relative"><form onSubmit={(event) => { submitHeaderSearch(event); setMobileToolsOpen(false); setMobileTool(null); }} role="search" className="flex gap-2"><div className="relative min-w-0 flex-1"><input autoFocus type="text" value={headerSearchQuery} onChange={(event) => setHeaderSearchQuery(event.target.value)} aria-label={message('headerSearch')} placeholder={message('headerSearch')} className="h-12 w-full rounded-xl border border-[var(--border)] bg-background px-3 pe-10 text-sm text-foreground"/>{headerSearchQuery && <button type="button" onClick={() => setHeaderSearchQuery('')} aria-label={message('searchClear')} title={message('searchClear')} className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><X size={16}/></button>}</div><button type="submit" aria-label={message('headerSearch')} className="rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"><Search size={17}/></button></form>{renderHeaderSystemSuggestions(true)}</div>}
              {mobileTool === 'accountSwitcher' && shellVisibility.headerControls?.accountSwitcher !== false && <HeaderAccountSwitcher userId={user?.id} embedded/>}
              {mobileTool === 'province' && shellVisibility.headerControls?.provinceSelector !== false && <div className="p-1"><HeaderProvinceSelector userId={user?.id} embedded/></div>}
              {mobileTool === 'profile' && <div className="grid gap-1">
                <span className="min-w-0 truncate px-2 py-1 text-xs font-semibold text-[var(--muted-foreground)]">{[user?.firstName,user?.lastName].filter(Boolean).join(' ') || user?.name || message('admin')}</span>
                <button type="button" onClick={() => { setMobileToolsOpen(false); setMobileTool(null); void handleSignOut(); }} className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400"><LogOut size={14}/>{message('sidebarSignOut')}</button>
              </div>}
              {mobileTool === 'mission' && <div className="grid gap-1">{([['form',FilePlus2,'missionModeForm'],['command',SquareTerminal,'missionModeCommand'],['ai',Bot,'missionModeAI']] as const).filter(([mode])=>isMissionModeVisible(mode)).map(([mode,Icon,label])=><button key={mode} type="button" onClick={()=>{setMobileToolsOpen(false);setMobileTool(null);onSelectMissionMode?.(mode);}} className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-start text-sm ${activeMissionMode===mode?'bg-[var(--primary-soft)] text-[var(--primary)]':'text-foreground hover:bg-[var(--primary-soft)]'}`}><Icon size={16}/>{message(label)}</button>)}</div>}
            </div>}
          </div>}
        </div>

        {/* کپسول حساب کاربری در سوی مقابل کنترل‌ها */}
        <div className="pointer-events-none order-2 hidden shrink-0 items-center gap-1.5 lg:flex">
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
            <div role="menu" style={{ backgroundColor: 'var(--gray-header, var(--surface))' }} className="pointer-events-auto absolute end-0 top-full z-[110] mt-2 w-[min(10rem,calc(100vw-1rem))] rounded-xl border border-[var(--border)] p-1 shadow-lg sm:w-44">
              <div className="grid gap-1 md:hidden">
                {shellVisibility.headerControls?.accountSwitcher !== false && <HeaderAccountSwitcher userId={user?.id} embedded />}
                {shellVisibility.headerControls?.provinceSelector !== false && <HeaderProvinceSelector userId={user?.id} embedded/>}
                <div className="my-1 border-t border-[var(--border)]" />
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className="flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg px-2 text-center text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 md:min-h-8 md:gap-1.5 md:px-2 md:text-xs"
              >
                <LogOut size={14} />
                {message('sidebarSignOut')}
              </button>
            </div>
          )}
        </div>
        </div>
        </div>
      </div>

      {/* Rahyar organization identity and home link. */}
      <div
        className="
          absolute left-1/2 top-1/2
          -translate-x-1/2 -translate-y-1/2
        "
      >
        <Link
          href="/rahcom"
          aria-label={message('dashboard')}
          dir="ltr"
          className="pointer-events-auto relative flex h-10 w-10 items-center justify-center rounded-xl sm:h-12 sm:w-12"
        >
          <span
            className="absolute right-[calc(100%+0.75rem)] top-1/2 hidden w-max max-w-[min(24vw,15rem)] -translate-y-1/2 truncate text-left font-black tracking-tight text-[var(--foreground)] sm:block"
            style={{ fontSize: english ? '0.8rem' : '0.95rem' }}
          >
            {organizationBranding?.name || 'رهیار'}
          </span>

          <div
            className={`
              flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden sm:h-12 sm:w-12
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

          <span dir="rtl" className="absolute left-[calc(100%+0.75rem)] top-1/2 hidden -translate-y-1/2 text-[11px] font-bold tracking-wide text-primary sm:block">
            Rahyar
          </span>
        </Link>
      </div>

      <div className="pointer-events-none absolute end-5 top-1/2 hidden -translate-y-1/2 flex-row-reverse items-center gap-2 lg:flex">
        {(['form', 'command', 'ai'] as MissionEntryMode[]).some(isMissionModeVisible) && <div className="pointer-events-auto relative shrink-0">
          <button type="button" onClick={cycleMissionMode} title={`${message('missionShortcutTitle')} · ${message(activeMissionMode === 'form' ? 'missionModeForm' : activeMissionMode === 'command' ? 'missionModeCommand' : 'missionModeAI')}`} aria-label={`${message('missionShortcutTitle')} · ${message(activeMissionMode === 'form' ? 'missionModeForm' : activeMissionMode === 'command' ? 'missionModeCommand' : 'missionModeAI')}`} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground)] transition-colors hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]">
            {activeMissionMode === 'form' ? <FilePlus2 size={17}/> : activeMissionMode === 'command' ? <SquareTerminal size={17}/> : <Bot size={17}/>}
          </button>
        </div>}
        <form ref={headerSearchRef} onSubmit={submitHeaderSearch} role="search" className="rahcom-search-capsule pointer-events-auto relative flex min-w-0 rounded-full">
          <input type="text" value={headerSearchQuery} onChange={(event) => setHeaderSearchQuery(event.target.value)} aria-label={message('headerSearch')} placeholder={message('headerSearch')} style={{ backgroundColor: 'var(--gray-header, var(--surface))' }} className="h-9 w-36 rounded-full border border-[var(--border)] px-3 pe-9 text-sm text-[var(--foreground)] outline-none placeholder:text-muted-foreground focus:border-[var(--primary)] xl:w-44 2xl:w-52" />
          {headerSearchQuery && <button type="button" onClick={() => setHeaderSearchQuery('')} aria-label={message('searchClear')} title={message('searchClear')} className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X size={15}/></button>}
          {renderHeaderSystemSuggestions()}
        </form>
      </div>
      <RahcomRowInfoHost />
    </header>
  );
}

