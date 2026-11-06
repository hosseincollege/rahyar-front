/**
 * @file src/components/layout/app-shell.tsx
 * @description Rahyar application frontend
 */

'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { TopHeader } from './top-header';
import { ImpersonationBanner } from './impersonation-banner';
import { getLocaleDirection, getOrganizationAccentStyle, usePreferences } from '@/components/preferences-provider';
import { MissionQuickActions, type MissionEntryMode } from './mission-quick-actions';
import { loadOrganizationModuleVisibility } from '@/lib/module-visibility';
import { isReducedEdition } from '@/lib/product-edition';
import { uiMessage } from '@/lib/ui-messages';

const SIDEBAR_COLLAPSED_KEY = 'erp-sidebar-collapsed';
const SIDEBAR_LOCKED_KEY = 'erp-sidebar-locked';
const NAVIGATE_ON_CLICK_KEY = 'erp-navigate-on-click';
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0';
const APP_BUILD_DATE = process.env.NEXT_PUBLIC_APP_BUILD_DATE ?? '2026-11-05';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isRahcomMap = pathname === '/rahcom/map';
  const isRahcomPage = pathname.startsWith('/rahcom/');
  const isRahcomMobileOverflowPage = pathname === '/rahcom/daily-traffic' || pathname === '/rahcom/road-list';
  const isRahcomSystems = pathname === '/rahcom/systems';
  const isRahcomSolarDaily = pathname === '/rahcom/solar-daily';
  const isRahcomTickets = pathname === '/rahcom/tickets';
  const isRahcomAggregate = pathname === '/rahcom/aggregate';
  const isRahcomBillIdentifiers = pathname === '/rahcom/bill-identifiers';
  const isRahcomFixedHeightPage = isRahcomMap || isRahcomSystems || isRahcomSolarDaily || isRahcomTickets || isRahcomAggregate || isRahcomBillIdentifiers;
  const {
    locale,
    workspaceMode,
    saveWorkspaceMode,
    organizationAppearance,
    appearancePreview,
    contrastPreferences,
    contrastPreview,
    brightnessPreferences,
    brightnessPreview,
  } = usePreferences();
  const formattedBuildDate = new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR-u-ca-persian' : locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${APP_BUILD_DATE}T12:00:00Z`));
  const missionMode: MissionEntryMode | null = workspaceMode === 'form' ? null : workspaceMode;
  const activeAppearance = appearancePreview ?? organizationAppearance;
  const activeContrast = contrastPreview ?? contrastPreferences;
  const activeBrightness = brightnessPreview ?? brightnessPreferences;
  const direction = getLocaleDirection(locale);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isSidebarLocked, setIsSidebarLocked] = useState(false);
  const [isSidebarStateLoaded, setIsSidebarStateLoaded] = useState(false);
  const [isProfileActive, setIsProfileActive] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [navigateOnClick, setNavigateOnClick] = useState(false);
  useEffect(() => {
    const refreshOrganizationVisibility = () => { void loadOrganizationModuleVisibility(isReducedEdition); };
    refreshOrganizationVisibility();
    window.addEventListener('auth:login', refreshOrganizationVisibility);
    window.addEventListener('auth:user-updated', refreshOrganizationVisibility);
    return () => {
      window.removeEventListener('auth:login', refreshOrganizationVisibility);
      window.removeEventListener('auth:user-updated', refreshOrganizationVisibility);
    };
  }, []);

  /*
   * خواندن وضعیت ذخیره‌شده سایدبار و حالت ناوبری از localStorage در سمت کلاینت
   */
  useEffect(() => {
    try {
      const savedCollapsed = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      const savedLocked = window.localStorage.getItem(SIDEBAR_LOCKED_KEY);
      const savedNavigateOnClick = window.localStorage.getItem(NAVIGATE_ON_CLICK_KEY);

      if (savedCollapsed !== null) {
        setIsCollapsed(savedCollapsed === 'true');
      }

      if (savedLocked !== null) {
        setIsSidebarLocked(savedLocked === 'true');
      }

      if (savedNavigateOnClick !== null) {
        setNavigateOnClick(savedNavigateOnClick === 'true');
      }
    } catch (error) {
      console.warn(
        'امکان خواندن وضعیت‌ها از localStorage وجود ندارد:',
        error
      );
    } finally {
      setIsSidebarStateLoaded(true);
    }
  }, []);

  /*
   * ذخیره وضعیت جمع/باز بودن سایدبار
   */
  useEffect(() => {
    if (!isSidebarStateLoaded) return;
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
    } catch (error) {
      console.warn('امکان ذخیره وضعیت باز/جمع سایدبار وجود ندارد:', error);
    }
  }, [isCollapsed, isSidebarStateLoaded]);

  /*
   * ذخیره وضعیت قفل سایدبار
   */
  useEffect(() => {
    if (!isSidebarStateLoaded) return;
    try {
      window.localStorage.setItem(SIDEBAR_LOCKED_KEY, String(isSidebarLocked));
    } catch (error) {
      console.warn('امکان ذخیره وضعیت قفل سایدبار وجود ندارد:', error);
    }
  }, [isSidebarLocked, isSidebarStateLoaded]);

  /*
   * ذخیره وضعیت حالت ناوبری با کلیک
   */
  useEffect(() => {
    if (!isSidebarStateLoaded) return;
    try {
      window.localStorage.setItem(NAVIGATE_ON_CLICK_KEY, String(navigateOnClick));
    } catch (error) {
      console.warn('امکان ذخیره وضعیت حالت ناوبری وجود ندارد:', error);
    }
  }, [navigateOnClick, isSidebarStateLoaded]);

  const handleToggleSidebar = () => {
    if (!isCollapsed && isSidebarLocked) return;
    setIsCollapsed((previous) => !previous);
  };

  const handleCloseSidebar = () => {
    if (isSidebarLocked) return;
    setIsCollapsed(true);
    setIsProfileActive(false);
  };

  useEffect(() => {
    if (!isMobileNavOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileNavOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isMobileNavOpen]);

  useEffect(() => {
    if (!isRahcomMobileOverflowPage) return;
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const resetHorizontalScroll = () => {
      const root = document.documentElement;
      window.scrollTo({ left: 0, top: window.scrollY, behavior: 'instant' });
      root.scrollLeft = 0;
      document.body.scrollLeft = 0;
      const contentViewport = document.querySelector<HTMLElement>('.erp-scrollbar');
      if (contentViewport) contentViewport.scrollLeft = 0;
    };
    resetHorizontalScroll();
    const frame = window.requestAnimationFrame(resetHorizontalScroll);
    const timer = window.setTimeout(resetHorizontalScroll, 120);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, [isMobileNavOpen, isRahcomMobileOverflowPage, pathname]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)');
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setIsMobileNavOpen(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  const handleToggleSidebarLock = () => {
    setIsSidebarLocked((previousLocked) => {
      const nextLocked = !previousLocked;
      if (nextLocked) {
        setIsCollapsed(false);
      }
      return nextLocked;
    });
  };

  const handleToggleNavigateOnClick = () => {
    setNavigateOnClick((previous) => !previous);
  };

  return (
    <div
      dir={direction}
      data-accent={activeAppearance.accentPreset}
      data-background-style={activeAppearance.backgroundStyle}
      data-light-contrast={activeContrast.light}
      data-dark-contrast={activeContrast.dark}
      data-light-brightness={activeBrightness.light}
      data-dark-brightness={activeBrightness.dark}
      style={getOrganizationAccentStyle(activeAppearance)}
      className="erp-app-shell flex h-screen min-h-0 flex-col overflow-hidden bg-[color:var(--background)] text-[color:var(--foreground)] transition-colors duration-200"
    >
      <TopHeader
        enableMobileHorizontalElasticDrag={isRahcomMobileOverflowPage}
        onSelectMissionMode={(mode) => { void saveWorkspaceMode(mode).catch((error) => console.error('Could not save workspace mode:', error)); }}
        activeMissionMode={workspaceMode}
        isCollapsed={isCollapsed}
        isMobileMenuOpen={isMobileNavOpen}
        isSidebarLocked={isSidebarLocked}
        navigateOnClick={navigateOnClick}
        onToggleSidebar={handleToggleSidebar}
        onToggleMobileMenu={() => setIsMobileNavOpen((open) => !open)}
        onToggleSidebarLock={handleToggleSidebarLock}
        onToggleNavigateOnClick={handleToggleNavigateOnClick}
      />

      <ImpersonationBanner />

      <div className="flex min-h-0 flex-1 items-stretch overflow-hidden">
        {isMobileNavOpen && (
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setIsMobileNavOpen(false)}
            className="fixed inset-x-0 bottom-0 top-16 z-30 bg-black/45 backdrop-blur-[1px] md:hidden"
          />
        )}
        <Sidebar
          isMainCollapsed={isCollapsed}
          isLocked={isSidebarLocked}
          isProfileActive={isProfileActive}
          navigateOnClick={navigateOnClick}
          onSetProfileActive={setIsProfileActive}
          onCloseSidebar={handleCloseSidebar}
          isMobileOpen={isMobileNavOpen}
          onMobileClose={() => setIsMobileNavOpen(false)}
        />

        <main
          dir={direction === 'rtl' ? 'ltr' : 'rtl'}
          className="erp-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto bg-[color:var(--background)]"
        >
          <div dir={direction} className={`${isRahcomMap ? 'flex h-full min-h-0 min-w-0 w-full flex-col p-2 text-right sm:p-3' : isRahcomFixedHeightPage || isRahcomMobileOverflowPage ? 'flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden px-2 pt-2 pb-3 text-right sm:px-3 sm:pt-3 sm:pb-4 lg:pt-3 lg:pb-6' : isRahcomPage ? 'min-h-full min-w-0 w-full px-2 pt-2 pb-3 text-right sm:px-3 sm:pt-3 sm:pb-4 lg:pt-3 lg:pb-6' : 'min-h-full min-w-0 w-full p-3 text-right sm:p-4 lg:p-6'}`}>
            {missionMode ? <div className="grid min-h-full min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.42fr)]"><div className="min-w-0">{children}</div><MissionQuickActions key={missionMode} initialMode={missionMode} onSelectMode={(mode) => { void saveWorkspaceMode(mode).catch((error) => console.error('Could not save workspace mode:', error)); }} onClose={() => { void saveWorkspaceMode('form').catch((error) => console.error('Could not save workspace mode:', error)); }} /></div> : children}
          </div>
          <footer dir={direction} className="flex h-[55px] shrink-0 flex-wrap items-center justify-center gap-x-2 gap-y-0 border-t border-border/70 px-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{uiMessage(locale, 'appFooterBrand')}</span>
            <span>{uiMessage(locale, 'appFooterVersion')}: <bdi dir="ltr" className="font-mono">{APP_VERSION}</bdi></span>
            <span>{uiMessage(locale, 'appFooterLastUpdated')}: <time dateTime={APP_BUILD_DATE}>{formattedBuildDate}</time></span>
          </footer>
        </main>
      </div>
    </div>
  );
}
