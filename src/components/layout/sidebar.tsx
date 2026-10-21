'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Code2, LayoutDashboard, Settings, Waypoints, type LucideIcon } from 'lucide-react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import type { UiMessage } from '@/lib/languages/types';

const navigation: Array<{ id: string; titleKey: UiMessage; icon: LucideIcon; href: string }> = [
  { id: 'dashboard', titleKey: 'sidebarDashboard', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'rahcom', titleKey: 'sidebarRahkam', icon: Waypoints, href: '/rahcom' },
  { id: 'settings', titleKey: 'sidebarSettings', icon: Settings, href: '/settings' },
  { id: 'development', titleKey: 'sidebarDevelopment', icon: Code2, href: '/development' },
];

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { locale } = usePreferences();

  return (
    <aside
      dir={getLocaleDirection(locale)}
      id="erp-mobile-navigation"
      data-mobile-open={isMobileOpen}
      className="erp-sidebar-drawer fixed bottom-0 start-0 top-16 z-40 flex min-h-0 w-56 max-w-[calc(100vw-0.5rem)] shrink-0 select-none flex-col border-e border-[var(--border)] bg-[var(--surface)] py-3 transition-transform duration-300 md:sticky md:inset-auto md:top-16 md:z-40 md:h-[calc(100vh-4rem)] md:max-w-none"
    >
      <nav aria-label={uiMessage(locale, 'sidebarSettings')} className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-2">
        {navigation.map(({ id, titleKey, icon: Icon, href }) => {
          const selected = pathname === href || pathname.startsWith(`${href}/`);
          const title = uiMessage(locale, titleKey);
          return (
            <Link
              key={id}
              href={href}
              title={title}
              aria-current={selected ? 'page' : undefined}
              onClick={onMobileClose}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${selected ? 'sidebar-module-selected bg-[var(--primary)] shadow-sm shadow-[var(--primary)]/20' : 'text-[var(--foreground)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]'}`}
            >
              <Icon size={19} className="shrink-0" aria-hidden="true" />
              <span className="truncate">{title}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
