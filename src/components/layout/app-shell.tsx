/**
 * @file src/components/layout/app-shell.tsx
 * @description پوسته اصلی صفحات داخلی ERP Pro
 */

'use client';

import React, { useEffect, useState } from 'react';
import { Sidebar } from './sidebar';
import { TopHeader } from './top-header';
import { ImpersonationBanner } from './impersonation-banner';
import { getLocaleDirection, getOrganizationAccentStyle, usePreferences } from '@/components/preferences-provider';
import { MissionQuickActions, type MissionEntryMode } from './mission-quick-actions';

const SIDEBAR_COLLAPSED_KEY = 'erp-sidebar-collapsed';
const SIDEBAR_LOCKED_KEY = 'erp-sidebar-locked';
const NAVIGATE_ON_CLICK_KEY = 'erp-navigate-on-click';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
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
          className="erp-scrollbar min-h-0 min-w-0 flex-1 bg-[color:var(--background)]"
        >
          <div dir={direction} className="min-h-full w-full p-3 text-right sm:p-4 lg:p-6">
            {missionMode ? <div className="grid min-h-full min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.42fr)]"><div className="min-w-0">{children}</div><MissionQuickActions key={missionMode} initialMode={missionMode} onSelectMode={(mode) => { void saveWorkspaceMode(mode).catch((error) => console.error('Could not save workspace mode:', error)); }} onClose={() => { void saveWorkspaceMode('form').catch((error) => console.error('Could not save workspace mode:', error)); }} /></div> : children}
          </div>
        </main>
      </div>
    </div>
  );
}
