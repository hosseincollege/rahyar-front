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

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const {
    locale,
    organizationAppearance,
    appearancePreview,
    contrastPreferences,
    contrastPreview,
  } = usePreferences();
  const activeAppearance = appearancePreview ?? organizationAppearance;
  const activeContrast = contrastPreview ?? contrastPreferences;
  const direction = getLocaleDirection(locale);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

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

  return (
    <div
      dir={direction}
      data-accent={activeAppearance.accentPreset}
      data-background-style={activeAppearance.backgroundStyle}
      data-light-contrast={activeContrast.light}
      data-dark-contrast={activeContrast.dark}
      data-light-brightness="balanced"
      data-dark-brightness="balanced"
      style={getOrganizationAccentStyle(activeAppearance)}
      className="erp-app-shell flex h-screen min-h-0 flex-col overflow-hidden bg-[color:var(--background)] text-[color:var(--foreground)] transition-colors duration-200"
    >
      <TopHeader
        isMobileMenuOpen={isMobileNavOpen}
        onToggleMobileMenu={() => setIsMobileNavOpen((open) => !open)}
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
          isMobileOpen={isMobileNavOpen}
          onMobileClose={() => setIsMobileNavOpen(false)}
        />

        <main
          dir={direction === 'rtl' ? 'ltr' : 'rtl'}
          className="erp-scrollbar min-h-0 min-w-0 flex-1 bg-[color:var(--background)]"
        >
          <div dir={direction} className="min-h-full w-full p-3 text-right sm:p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}


