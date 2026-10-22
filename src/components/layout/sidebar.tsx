/**
 * @file src/components/layout/sidebar.tsx
 * @project ERP Pro - Front-end
 * @description نوار ناوبری دو ستونه ERP Pro با هدایت خودکار ماژول‌ها و پنل‌های اختصاصی پروفایل و صفحه اصلی
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getCurrentUser, logout, AuthUser } from '@/lib/api/shared/auth-api';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import type { UiMessage } from '@/lib/ui-messages';

import { Code2, ExternalLink, LayoutDashboard, LogOut, Settings, User, Waypoints } from 'lucide-react';

type NavigationSubItem = {
  titleKey?: UiMessage;
  title?: string;
  href: string;
  activeHrefs?: string[];
};

type NavigationItem = {
  id: string;
  titleKey: UiMessage;
  icon: React.ElementType;
  href: string;
  sub?: NavigationSubItem[];
};

// فهرست ماژول‌های اصلی سیستم
const navigation: NavigationItem[] = [
  { id: 'dashboard', titleKey: 'sidebarDashboard', icon: LayoutDashboard, href: '/dashboard', sub: [] },
  {
    id: 'rahcom',
    titleKey: 'sidebarRahkam',
    icon: Waypoints,
    href: '/rahcom',
    sub: [
      { titleKey: 'rahcomMap', href: '/rahcom/map' },
      { titleKey: 'rahcomActions', href: '/rahcom/actions' },
      { titleKey: 'rahcomSystemsList', href: '/rahcom/systems' },
      { titleKey: 'rahcomDailyTraffic', href: '/rahcom/daily-traffic' },
    ],
  },
  {
    id: 'settings',
    titleKey: 'sidebarSettings',
    icon: Settings,
    href: '/settings',
    sub: [
      { titleKey: 'sidebarAnnouncementManagement', href: '/settings/announcements' },
      { titleKey: 'sidebarGeneral', href: '/settings/company' },
      { titleKey: 'sidebarOrganizationStructure', href: '/settings/organization' },
      { titleKey: 'settingsAccessWorkspace', href: '/settings/accounts', activeHrefs: ['/settings/accounts'] },
      { titleKey: 'rahcomSystemData', href: '/settings/rahcom-data' },
    ],
  },
  {
    id: 'development',
    titleKey: 'sidebarDevelopment',
    icon: Code2,
    href: '/development',
    sub: [
      { titleKey: 'developmentSiteVisits', href: '/development/site-visits' },
      { titleKey: 'sidebarTestData', href: '/development/test-data' },
      { titleKey: 'developmentAccountSwitching', href: '/development/account-switching' },
    ],
  },
];

interface SidebarProps {
  isMainCollapsed?: boolean;
  isProfileActive?: boolean;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  onSetProfileActive?: (active: boolean) => void;
}

export function Sidebar({
  isMainCollapsed = true,
  isProfileActive = false,
  isMobileOpen = false,
  onMobileClose,
  onSetProfileActive,
}: SidebarProps) {
  const pathname = usePathname();
  const { locale } = usePreferences();
  const message = (key: UiMessage) => uiMessage(locale, key);
  const router = useRouter();
  const sidebarRef = useRef<HTMLElement>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const isProfileRoute = false;
  const isHomeRoute = pathname === '/' || pathname === '/dashboard' || pathname.startsWith('/dashboard/') || pathname === '/rahcom' || pathname.startsWith('/rahcom/');

  useEffect(() => {
    const refreshUser = () => setUser(getCurrentUser());
    refreshUser();
    window.addEventListener('auth:logout', refreshUser);
    window.addEventListener('auth:login', refreshUser);
    window.addEventListener('auth:user-updated', refreshUser);
    window.addEventListener('storage', refreshUser);
    return () => {
      window.removeEventListener('auth:logout', refreshUser);
      window.removeEventListener('auth:login', refreshUser);
      window.removeEventListener('auth:user-updated', refreshUser);
      window.removeEventListener('storage', refreshUser);
    };
  }, []);


  // یافتن ماژول مطابق با مسیر فعلی
  const getMatchedModuleId = () => {
    if (pathname === '/') return 'dashboard';
    const matched = navigation.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`) ||
        item.sub?.some((subItem) => pathname === subItem.href.split('?')[0] || pathname.startsWith(`${subItem.href.split('?')[0]}/`))
    );
    return matched?.id || null;
  };

  const [activeTab, setActiveTab] = useState<string | null>(getMatchedModuleId());

  // همگام‌سازی تب فعال هنگام تغییر مسیر (Navigation)
  useEffect(() => {
    if (isHomeRoute) {
      setActiveTab(getMatchedModuleId());
      onSetProfileActive?.(false);
    } else if (isProfileRoute) {
      setActiveTab(null);
      onSetProfileActive?.(true);
    } else {
      setActiveTab(getMatchedModuleId());
      onSetProfileActive?.(false);
    }
  }, [pathname, isHomeRoute, isProfileRoute, onSetProfileActive]);

  // رویداد Click-Outside جهت بستن و ریست سایدبار به پنل پیش‌فرض صفحه
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (sidebarRef.current && sidebarRef.current.contains(target)) {
        return;
      }

      const userProfileBtn = document.getElementById('user-profile-header-btn');

      if (userProfileBtn && userProfileBtn.contains(target)) {
        return;
      }

      if (isHomeRoute) {
        setActiveTab(getMatchedModuleId());
        onSetProfileActive?.(false);
      } else if (isProfileRoute) {
        setActiveTab(null);
        onSetProfileActive?.(true);
      } else {
        setActiveTab(getMatchedModuleId());
        if (isProfileActive) {
          onSetProfileActive?.(false);
        }
      }

    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [
    isMainCollapsed,
    isProfileActive,
    isProfileRoute,
    isHomeRoute,
    pathname,
    onSetProfileActive,
  ]);

  // انتخاب ماژول: تغییر ستون دوم و هدایت اختیاری در صورت روشن بودن Navigation Mode
  const handleSelectModule = (item: NavigationItem) => {
    onSetProfileActive?.(false);
    setActiveTab(item.id);

    if (item.href) {
      router.push(item.href);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const localizedNavigation = navigation.map((item) => ({
    ...item,
    title: message(item.titleKey),
    sub: item.sub?.map((subItem) => ({
      ...subItem,
      title: subItem.titleKey ? message(subItem.titleKey) : subItem.title,
    })),
  }));
  const activeGroup = localizedNavigation.find((item) => item.id === activeTab);
  const activePath = pathname;
  const isModuleLandingActive = Boolean(activeGroup && activePath === activeGroup.href);
  const activeSubItemPath = activeGroup?.sub
    ?.flatMap((subItem) => (subItem.activeHrefs ?? [subItem.href]).map((href) => href.split(/[?#]/)[0]))
    .filter((href) => activePath === href || activePath.startsWith(`${href}/`))
    .sort((left, right) => right.length - left.length)[0];

  return (
    <aside
      ref={sidebarRef}
      dir={getLocaleDirection(locale)}
      id="erp-mobile-navigation"
      data-mobile-open={isMobileOpen}
      className="
        erp-sidebar-drawer fixed bottom-0 start-0 top-16 z-40 flex min-h-0 max-w-[calc(100vw-0.5rem)]
        md:sticky md:inset-auto md:top-16 md:z-40 md:h-[calc(100vh-4rem)] md:max-w-none
        shrink-0 select-none
        transition-all duration-300
      "
    >
      {/* ستون اول: لیست آیکون‌های ماژول‌ها */}
      <div
        className={`
          flex min-h-0 flex-col
          border-e border-[var(--border)]
          bg-[var(--surface)]
          py-3
          transition-all duration-300
          ${isMainCollapsed ? 'w-14 items-center px-2' : 'w-38 px-1.5'}
        `}
      >
        <div className="flex min-h-0 w-full flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain no-scrollbar">
          {localizedNavigation.map((item, index) => {
            const Icon = item.icon;
            const isSelected = !isProfileActive && activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                title={item.title}
                aria-label={item.title}
                onClick={() => handleSelectModule(item)}
                className={`
                  relative flex w-full items-center rounded-xl p-2.5 text-start transition-all duration-200 cursor-pointer
                  ${
                    isSelected
                      ? 'sidebar-module-selected bg-[var(--primary)] font-medium shadow-lg shadow-[var(--primary)]/20'
                      : 'text-[var(--foreground)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]'
                  }
                  text-sm
                    ${isMainCollapsed ? 'justify-center' : 'justify-start gap-2'}
                `}
              >
                <Icon size={20} className="shrink-0" />
                {!isMainCollapsed && (
                  <>
                    <span className="hidden shrink-0 text-xs font-medium tabular-nums text-current md:inline" dir="ltr">{index + 1}</span>
                    <span className="truncate leading-none">{item.title}</span>
                  </>
                )}
                <span
                  className={`absolute end-0.5 top-0.5 text-[8px] font-medium leading-none tabular-nums text-current ${isMainCollapsed ? '' : 'md:hidden'}`}
                  dir="ltr"
                >
                  {index + 1}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ستون دوم: اولویت رندر: پنل پروفایل | زیرمنوی ماژول فعال | پیشخوان خانه */}
      <div
        className={`
          flex min-h-0 w-50 shrink-0 flex-col
          border-e border-[var(--border)]
          bg-[var(--surface)]/95
          p-4 shadow-sm backdrop-blur
          ${activeGroup ? '' : 'hidden'}
        `}
      >
        {isProfileActive || (isProfileRoute && !activeTab) ? (
          /* حالت اول: پنل پروفایل کاربر */
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain">
            <Link
              href="/dashboard/profile"
              onClick={() => {
                onSetProfileActive?.(true);
                onMobileClose?.();
              }}
              className="flex items-center justify-between rounded-xl bg-[var(--primary)] px-3.5 py-2.5 text-xs font-semibold text-[var(--primary-foreground)] shadow-md shadow-[var(--primary)]/20 transition-colors hover:bg-[var(--primary-hover)]"
            >
              <span className="flex items-center gap-2">
                <User size={16} />
                {message('sidebarViewProfile')}
              </span>
              <ExternalLink size={14} />
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 px-3.5 py-2.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors cursor-pointer"
            >
              <LogOut size={16} />
              {message('sidebarSignOut')}
            </button>

            <div className="mt-1 flex flex-col items-center rounded-xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-900/40 p-4 text-center">
              <div className="relative mb-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary)] font-bold text-[var(--primary-foreground)] shadow-md text-xl">
                  {user?.name ? (
                    user.name.charAt(0).toUpperCase()
                  ) : (
                    <User size={24} />
                  )}
                </div>
                <span
                  className="absolute bottom-0 end-0 h-3.5 w-3.5 rounded-full border-2 border-[var(--surface)] bg-emerald-500"
                  title={message('sidebarOnlineStatus')}
                />
              </div>

              <p className="text-sm font-bold text-[var(--foreground)]">
                {user?.name || message('sidebarSystemUser')}
              </p>
              <span className="mt-1 rounded-md bg-[var(--primary-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--primary)]">
                {user?.role || message('user')}
              </span>
              <p className="mt-1.5 text-xs text-muted-foreground truncate w-full">
                {user?.email || ''}
              </p>
            </div>
          </div>
        ) : activeGroup ? (
          /* حالت دوم: زیرمنوهای ماژول انتخاب شده */
          <div className="flex min-h-0 flex-1 flex-col">
            <h2 className={`shrink-0 overflow-hidden border-b text-sm font-bold transition-[max-height,opacity,transform,margin,padding,color,border-color] duration-200 ease-out motion-reduce:transition-none ${isMainCollapsed ? 'mb-2 border-[var(--border)] pb-3 md:max-h-12 md:translate-y-0 md:opacity-100' : 'mb-2 border-[var(--border)] pb-3 md:mb-0 md:max-h-0 md:translate-y-1 md:border-transparent md:pb-0 md:opacity-0'} ${isModuleLandingActive ? 'text-[var(--primary)]' : 'text-[var(--foreground)]'}`}>
              <Link
                href={activeGroup.href}
                onClick={onMobileClose}
                aria-current={isModuleLandingActive ? 'page' : undefined}
                className="block rounded-sm text-start transition-colors hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                {activeGroup.title}
              </Link>
            </h2>
            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain">
              {activeGroup.sub && activeGroup.sub.length > 0 ? (
                activeGroup.sub.map((subItem, index) => {
                  const isActive = (subItem.activeHrefs ?? [subItem.href]).some((href) => activeSubItemPath === href.split(/[?#]/)[0]);

                  return (
                    <Link
                      key={subItem.href}
                      href={subItem.href}
                      onClick={onMobileClose}
                      className={`
                        flex items-center gap-2 rounded-lg px-3 py-2.5 transition-colors
                        ${
                          isActive
                            ? 'bg-[var(--primary-soft)] font-bold text-[var(--primary)] ring-1 ring-[var(--primary)]/20'
                            : 'text-[var(--foreground)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]'
                        }
                        text-sm text-start
                      `}
                      style={isActive ? { color: 'var(--primary)' } : undefined}
                    >
                      <span className="shrink-0 text-xs font-medium tabular-nums text-current" dir="ltr">{index + 1}</span>
                      <span className="truncate leading-none">{subItem.title}</span>
                    </Link>
                  );
                })
              ) : (
                <p className="px-3 py-2.5 text-sm text-muted-foreground/70">
                  {activeGroup.id === 'support' ? message('supportNoProjects') : message('sidebarNoSubmenu')}
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
