/**
 * @file src/components/layout/app-shell.tsx
 * @description Rahyar application frontend
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { TopHeader } from './top-header';
import { ImpersonationBanner } from './impersonation-banner';
import { getLocaleDirection, getOrganizationAccentStyle, usePreferences } from '@/components/preferences-provider';
import { MissionQuickActions, type MissionEntryMode } from './mission-quick-actions';
import { loadOrganizationModuleVisibility } from '@/lib/module-visibility';
import { isReducedEdition } from '@/lib/product-edition';

const SIDEBAR_COLLAPSED_KEY = 'erp-sidebar-collapsed';
const SIDEBAR_LOCKED_KEY = 'erp-sidebar-locked';
const NAVIGATE_ON_CLICK_KEY = 'erp-navigate-on-click';

interface AppShellProps {
  children: React.ReactNode;
}

function hasPointerCursor(target: Element): boolean {
  let element: Element | null = target;
  while (element && element !== document.body) {
    if (window.getComputedStyle(element).cursor === 'pointer') return true;
    element = element.parentElement;
  }
  return false;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isRahcomMap = pathname === '/rahcom/map';
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
  const [navigationPending, setNavigationPending] = useState(false);
  const [navigationProgress, setNavigationProgress] = useState(0);
  const [navigationProgressFading, setNavigationProgressFading] = useState(false);
  const navigationTimer = useRef<number | null>(null);
  const progressFallbackTimer = useRef<number | null>(null);
  const progressFinishTimer = useRef<number | null>(null);
  const progressResetTimer = useRef<number | null>(null);
  const progressFadeTimer = useRef<number | null>(null);
  const pendingRequests = useRef(new Set<number>());
  const progressActive = useRef(false);
  const progressStartedAt = useRef(0);

  const completeNavigationProgress = useCallback(() => {
    progressActive.current = false;
    setNavigationPending(false);
    setNavigationProgress(100);
    if (navigationTimer.current) window.clearTimeout(navigationTimer.current);
    if (progressFallbackTimer.current) window.clearTimeout(progressFallbackTimer.current);
    if (progressFinishTimer.current) window.clearTimeout(progressFinishTimer.current);
    if (progressResetTimer.current) window.clearTimeout(progressResetTimer.current);
    if (progressFadeTimer.current) window.clearTimeout(progressFadeTimer.current);
    // Hold at 100% briefly so completion is clear, then fade the fill away.
    progressResetTimer.current = window.setTimeout(() => {
      setNavigationProgressFading(true);
      progressFadeTimer.current = window.setTimeout(() => {
        setNavigationProgress(0);
        // Keep the completed fill hidden until the next interaction begins.
      }, 240);
    }, 900);
  }, []);

  const finishNavigationProgress = useCallback(() => {
    if (!progressActive.current) return;
    const minimumVisibleDuration = 500;
    const elapsed = performance.now() - progressStartedAt.current;
    if (elapsed < minimumVisibleDuration) {
      if (progressFinishTimer.current) window.clearTimeout(progressFinishTimer.current);
      progressFinishTimer.current = window.setTimeout(completeNavigationProgress, minimumVisibleDuration - elapsed);
      return;
    }
    completeNavigationProgress();
  }, [completeNavigationProgress]);

  useEffect(() => {
    if (navigationTimer.current) window.clearTimeout(navigationTimer.current);
    if (pendingRequests.current.size !== 0) return;
    const completionTimer = window.setTimeout(finishNavigationProgress, 0);
    return () => window.clearTimeout(completionTimer);
  }, [pathname, finishNavigationProgress]);

  useEffect(() => {
    if (!navigationPending) return;
    const progressTimer = window.setInterval(() => {
      setNavigationProgress((current) => current >= 90 ? current : Math.min(90, current + 1.5));
    }, 50);
    return () => window.clearInterval(progressTimer);
  }, [navigationPending]);

  useEffect(() => {
    const startProgress = () => {
      if (progressActive.current) return;
      progressActive.current = true;
      progressStartedAt.current = performance.now();
      setNavigationPending(true);
      setNavigationProgress((current) => current >= 100 ? 14 : Math.max(current, 14));
      if (navigationTimer.current) window.clearTimeout(navigationTimer.current);
      if (progressFallbackTimer.current) window.clearTimeout(progressFallbackTimer.current);
      if (progressFinishTimer.current) window.clearTimeout(progressFinishTimer.current);
      if (progressResetTimer.current) window.clearTimeout(progressResetTimer.current);
      if (progressFadeTimer.current) window.clearTimeout(progressFadeTimer.current);
      if (progressResetTimer.current) window.clearTimeout(progressResetTimer.current);
      if (progressFadeTimer.current) window.clearTimeout(progressFadeTimer.current);
      setNavigationProgressFading(false);
      progressFallbackTimer.current = window.setTimeout(() => {
        if (pendingRequests.current.size === 0) finishNavigationProgress();
      }, 900);
      navigationTimer.current = window.setTimeout(() => {
        if (pendingRequests.current.size === 0) finishNavigationProgress();
      }, 10000);
    };
    const handleInternalNavigation = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      if (anchor instanceof HTMLAnchorElement && anchor.target !== '_blank') {
        const destination = new URL(anchor.href, window.location.href);
        if (destination.origin === window.location.origin && (destination.pathname !== window.location.pathname || destination.search !== window.location.search || destination.hash !== window.location.hash)) startProgress();
        return;
      }

      if (target.closest('[data-navigation-progress]')) {
        startProgress();
        return;
      }
      // Header menus and icon actions are immediate UI controls; opening them
      // does not represent page loading. Route links above still get progress.
      if (target.closest('[data-app-top-header]')) return;
      const stateToggle = target.closest('[role="switch"], [aria-pressed]');
      if (stateToggle && !stateToggle.matches(':disabled, [aria-disabled="true"]')) {
        startProgress();
        return;
      }
      const control = target.closest('button, [role="button"], [role="tab"], [role="switch"], [role="combobox"], [role="option"], [role="menuitem"], select, input[type="checkbox"], input[type="radio"], input[type="date"]');
      if (control?.matches('[aria-haspopup], [aria-expanded]')) return;
      if (control && !control.matches(':disabled, [aria-disabled="true"]')) {
        startProgress();
        return;
      }
      if (target.closest('[onclick]') || hasPointerCursor(target)) startProgress();
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      if (anchor instanceof HTMLAnchorElement) {
        if (anchor.target !== '_blank') {
          const destination = new URL(anchor.href, window.location.href);
          if (destination.origin === window.location.origin && (destination.pathname !== window.location.pathname || destination.search !== window.location.search || destination.hash !== window.location.hash)) startProgress();
        }
        return;
      }
      if (target.closest('[data-navigation-progress]')) {
        startProgress();
        return;
      }
      if (target.closest('[data-app-top-header]')) return;
      const stateToggle = target.closest('[role="switch"], [aria-pressed]');
      if (stateToggle && !stateToggle.matches(':disabled, [aria-disabled="true"]')) {
        startProgress();
        return;
      }
      const control = target.closest('button, a[href], [role="button"], [role="tab"], [role="switch"], [role="combobox"], [role="option"], [role="menuitem"], select, input[type="checkbox"], input[type="radio"], input[type="date"]');
      if (control?.matches('[aria-haspopup], [aria-expanded]')) return;
      if (control && !control.matches(':disabled, [aria-disabled="true"]')) {
        if (control instanceof HTMLAnchorElement && control.target === '_blank') return;
        startProgress();
        return;
      }
      if (target.closest('[onclick]') || hasPointerCursor(target)) startProgress();
    };
    const handleFormSubmit = () => startProgress();
    const handleControlChange = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.matches('select, input[type="checkbox"], input[type="radio"], input[type="date"]')) startProgress();
    };
    document.addEventListener('click', handleInternalNavigation, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('submit', handleFormSubmit, true);
    document.addEventListener('change', handleControlChange, true);
    window.addEventListener('rahyar:navigation-start', startProgress);
    return () => {
      document.removeEventListener('click', handleInternalNavigation, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('submit', handleFormSubmit, true);
      document.removeEventListener('change', handleControlChange, true);
      window.removeEventListener('rahyar:navigation-start', startProgress);
      if (navigationTimer.current) window.clearTimeout(navigationTimer.current);
      if (progressFallbackTimer.current) window.clearTimeout(progressFallbackTimer.current);
      if (progressFinishTimer.current) window.clearTimeout(progressFinishTimer.current);
      if (progressFadeTimer.current) window.clearTimeout(progressFadeTimer.current);
    };
  }, [pathname, finishNavigationProgress]);

  useEffect(() => {
    const handleRequestStart = (event: Event) => {
      // Ignore startup and background polling; only track requests initiated
      // after a user interaction has already made the shell react.
      if (!progressActive.current) return;
      const requestId = (event as CustomEvent<{ requestId?: number }>).detail?.requestId;
      if (typeof requestId !== 'number') return;
      pendingRequests.current.add(requestId);
      if (progressFallbackTimer.current) window.clearTimeout(progressFallbackTimer.current);
      if (progressFinishTimer.current) window.clearTimeout(progressFinishTimer.current);
    };
    const handleRequestEnd = (event: Event) => {
      const requestId = (event as CustomEvent<{ requestId?: number }>).detail?.requestId;
      if (typeof requestId !== 'number' || !pendingRequests.current.delete(requestId)) return;
      if (pendingRequests.current.size === 0) finishNavigationProgress();
    };
    window.addEventListener('rahyar:request-start', handleRequestStart);
    window.addEventListener('rahyar:request-end', handleRequestEnd);
    return () => {
      window.removeEventListener('rahyar:request-start', handleRequestStart);
      window.removeEventListener('rahyar:request-end', handleRequestEnd);
    };
  }, [finishNavigationProgress]);

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
        loadingProgress={navigationProgress}
        loadingProgressFading={navigationProgressFading}
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
          className={`erp-scrollbar min-h-0 min-w-0 flex-1 bg-[color:var(--background)] ${isRahcomMap ? 'overflow-y-hidden' : ''}`}
        >
          <div dir={direction} className={`${isRahcomMap ? 'flex h-full min-h-0 w-full flex-col p-2 text-right sm:p-3' : 'min-h-full w-full p-3 text-right sm:p-4 lg:p-6'}`}>
            {missionMode ? <div className="grid min-h-full min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.42fr)]"><div className="min-w-0">{children}</div><MissionQuickActions key={missionMode} initialMode={missionMode} onSelectMode={(mode) => { void saveWorkspaceMode(mode).catch((error) => console.error('Could not save workspace mode:', error)); }} onClose={() => { void saveWorkspaceMode('form').catch((error) => console.error('Could not save workspace mode:', error)); }} /></div> : children}
          </div>
        </main>
      </div>
    </div>
  );
}
