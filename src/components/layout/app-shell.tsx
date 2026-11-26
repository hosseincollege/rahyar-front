/**
 * @file src/components/layout/app-shell.tsx
 * @description Rahyar application frontend
 */

'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { TopHeader } from './top-header';
import { ImpersonationBanner } from './impersonation-banner';
import { getLocaleDirection, getOrganizationAccentStyle, usePreferences } from '@/components/providers/preferences-provider';
import { MissionQuickActions, type MissionEntryMode } from './mission-quick-actions';
import { loadOrganizationModuleVisibility } from '@/lib/module-visibility';
import { isReducedEdition } from '@/lib/product-edition';
import { uiMessage } from '@/lib/ui-messages';
import { getCharcoalShellStyle } from '@/components/rahcom/charcoal-shell';

const SIDEBAR_COLLAPSED_KEY = 'rahyar-sidebar-collapsed';
const SIDEBAR_LOCKED_KEY = 'rahyar-sidebar-locked';
const NAVIGATE_ON_CLICK_KEY = 'rahyar-navigate-on-click';
const LEGACY_SIDEBAR_KEYS = ['erp-sidebar-collapsed', 'erp-sidebar-locked', 'erp-navigate-on-click'];
const SIDEBAR_PREFERENCES_EVENT = 'rahyar:sidebar-preferences-change';
const DEFAULT_SIDEBAR_PREFERENCES = 'true|false|false';
function getSidebarPreferencesSnapshot() {
  try {
    return [SIDEBAR_COLLAPSED_KEY, SIDEBAR_LOCKED_KEY, NAVIGATE_ON_CLICK_KEY]
      .map((key, index) => window.localStorage.getItem(key) ?? window.localStorage.getItem(LEGACY_SIDEBAR_KEYS[index]) ?? DEFAULT_SIDEBAR_PREFERENCES.split('|')[index])
      .join('|');
  } catch {
    return DEFAULT_SIDEBAR_PREFERENCES;
  }
}
function subscribeSidebarPreferences(onChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || [SIDEBAR_COLLAPSED_KEY, SIDEBAR_LOCKED_KEY, NAVIGATE_ON_CLICK_KEY, ...LEGACY_SIDEBAR_KEYS].includes(event.key)) onChange();
  };
  window.addEventListener('storage', handleStorage);
  window.addEventListener(SIDEBAR_PREFERENCES_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(SIDEBAR_PREFERENCES_EVENT, onChange);
  };
}
function saveSidebarPreference(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, String(value));
    window.dispatchEvent(new Event(SIDEBAR_PREFERENCES_EVENT));
  } catch (error) {
    console.warn('Could not save sidebar preference:', error);
  }
}
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0';
const APP_BUILD_DATE = process.env.NEXT_PUBLIC_APP_BUILD_DATE ?? '2026-11-05';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isRahcomMap = pathname === '/rahcom/map';
  const isRahcomPage = pathname.startsWith('/rahcom/');
  const isRahcomMobileOverflowPage = pathname === '/rahcom/daily-traffic' || pathname === '/rahcom/road-list' || pathname === '/rahcom/systems' || pathname === '/rahcom/sites';
  const isRahcomSystems = pathname === '/rahcom/systems';
  const isRahcomTickets = pathname === '/rahcom/tickets';
  const isRahcomAggregate = pathname === '/rahcom/aggregate';
  const isRahcomBillIdentifiers = pathname === '/rahcom/bill-identifiers';
  const isRahcomFixedHeightPage = isRahcomMap || isRahcomSystems || pathname === '/rahcom/sites' || isRahcomTickets || isRahcomAggregate || isRahcomBillIdentifiers;
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
  const direction = getLocaleDirection(locale);
  const pageFrameClassName = `${isRahcomMap ? 'flex h-full min-h-0 min-w-0 w-full flex-col p-2 text-right sm:p-3' : isRahcomFixedHeightPage || isRahcomMobileOverflowPage ? 'flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden px-2 pt-2 pb-3 text-right sm:px-3 sm:pt-3 sm:pb-4 lg:pt-3 lg:pb-6' : isRahcomPage ? 'min-h-full min-w-0 w-full px-2 pt-2 pb-3 text-right sm:px-3 sm:pt-3 sm:pb-4 lg:pt-3 lg:pb-6' : 'min-h-full min-w-0 w-full p-3 text-right sm:p-4 lg:p-6'}`;
  const appFooter = (
    <footer dir={direction} className="flex h-[55px] shrink-0 flex-wrap items-center justify-center gap-x-2 gap-y-0 border-t border-border/70 px-3 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">{uiMessage(locale, 'appFooterBrand')}</span>
      <span>{uiMessage(locale, 'appFooterVersion')}: <bdi dir="ltr" className="font-mono">{APP_VERSION}</bdi></span>
      <span>{uiMessage(locale, 'appFooterLastUpdated')}: <time dateTime={APP_BUILD_DATE}>{formattedBuildDate}</time></span>
    </footer>
  );
  const missionMode: MissionEntryMode | null = workspaceMode === 'form' ? null : workspaceMode;
  const activeAppearance = appearancePreview ?? organizationAppearance;
  const activeContrast = contrastPreview ?? contrastPreferences;
  const activeBrightness = brightnessPreview ?? brightnessPreferences;
  const sidebarPreferenceSnapshot = useSyncExternalStore(subscribeSidebarPreferences, getSidebarPreferencesSnapshot, () => DEFAULT_SIDEBAR_PREFERENCES);
  const [collapsedValue, lockedValue, navigateValue] = sidebarPreferenceSnapshot.split('|');
  const isCollapsed = collapsedValue === 'true';
  const isSidebarLocked = lockedValue === 'true';
  const navigateOnClick = navigateValue === 'true';
  const [isProfileActive, setIsProfileActive] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
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
  const handleToggleSidebar = () => {
    if (!isCollapsed && isSidebarLocked) return;
    saveSidebarPreference(SIDEBAR_COLLAPSED_KEY, !isCollapsed);
  };

  const handleCloseSidebar = () => {
    if (isSidebarLocked) return;
    saveSidebarPreference(SIDEBAR_COLLAPSED_KEY, true);
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
    const nextLocked = !isSidebarLocked;
    saveSidebarPreference(SIDEBAR_LOCKED_KEY, nextLocked);
    if (nextLocked) saveSidebarPreference(SIDEBAR_COLLAPSED_KEY, false);
  };

  const handleToggleNavigateOnClick = () => {
    saveSidebarPreference(NAVIGATE_ON_CLICK_KEY, !navigateOnClick);
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
      style={{ ...getOrganizationAccentStyle(activeAppearance), ...getCharcoalShellStyle() }}
      className="erp-app-shell flex h-screen min-h-0 flex-col overflow-hidden bg-[color:var(--background)] text-[color:var(--foreground)] transition-colors duration-200"
    >
      <TopHeader
        enableMobileHorizontalElasticDrag={isRahcomMobileOverflowPage}
        onSelectWorkspaceMode={(mode) => { void saveWorkspaceMode(mode).catch((error) => console.error('Could not save workspace mode:', error)); }}
        activeWorkspaceMode={workspaceMode}
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
            className="fixed inset-x-0 bottom-0 top-16 z-[35] bg-black/45 backdrop-blur-[1px] md:hidden"
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
          data-workspace-main
          data-workspace-mode-panel={missionMode ? 'true' : undefined}
          dir={direction === 'rtl' ? 'ltr' : 'rtl'}
          className="erp-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto bg-[color:var(--background)]"
        >
          {missionMode ? (
            <div dir={direction} className="grid min-h-full min-w-0 w-full grid-cols-1 gap-4 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.42fr)] xl:grid-rows-[minmax(0,1fr)_auto] xl:gap-0">
              <div className="min-w-0 xl:col-start-1 xl:row-start-1 xl:min-h-0 xl:overflow-y-auto">
                <div dir={direction} className={pageFrameClassName}>{children}</div>
              </div>
              <aside className="mx-3 min-w-0 sm:mx-4 lg:mx-6 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:mx-0 xl:min-h-0 xl:overflow-hidden xl:border-s xl:border-border xl:bg-card">
                <MissionQuickActions key={missionMode} initialMode={missionMode} onSelectMode={(mode) => { void saveWorkspaceMode(mode).catch((error) => console.error('Could not save workspace mode:', error)); }} onClose={() => { void saveWorkspaceMode('form').catch((error) => console.error('Could not save workspace mode:', error)); }} />
              </aside>
              <div className="xl:col-start-1 xl:row-start-2">{appFooter}</div>
            </div>
          ) : (
            <>
              <div dir={direction} className={pageFrameClassName}>{children}</div>
              {appFooter}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
