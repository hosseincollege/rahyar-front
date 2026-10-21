// File: frontend/src/app/(workspace)/settings/settings-tabs.tsx
// Frontend - سربرگ مشترک Route-based برای صفحات تنظیمات

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

export interface SettingsTabItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface SettingsTabsProps {
  items: SettingsTabItem[];
}

export function SettingsTabs({ items }: SettingsTabsProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="بخش‌های تنظیمات"
      className="overflow-x-auto border-b border-border/60 pb-1"
    >
      <div className="flex gap-2 overflow-x-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={[
                'relative flex min-h-11 shrink-0 items-center gap-2.5 rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
                  : 'border-transparent text-muted-foreground hover:border-border/60 hover:bg-accent/40 hover:text-foreground',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
                    : 'bg-muted/60 text-muted-foreground',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>

              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
