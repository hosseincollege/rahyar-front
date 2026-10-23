/**
 * @file src/components/layout/sidebar.tsx
 * @project ERP Pro - Front-end
 * @description نوار ناوبری دو ستونه ERP Pro با هدایت خودکار ماژول‌ها و پنل‌های اختصاصی پروفایل و صفحه اصلی
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getCurrentOrganizationId, getCurrentUser, logout, AuthUser } from '@/lib/api/shared/auth-api';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import type { UiMessage } from '@/languages/types';
import { projectsApi, type SupportProjectItem } from '@/lib/api/shared/projects-api';
import { notificationsApi } from '@/lib/api/shared/notifications-api';
import { settingsApi, type OrganizationAccess } from '@/app/(workspace)/settings/settings-api';
import { isReducedEdition } from '@/lib/product-edition';
import { OPTIONAL_MODULE_IDS, readShellVisibility } from '@/lib/module-visibility';

import {
  BarChart3,
  BriefcaseBusiness,
  Calculator,
  Code2,
  ExternalLink,
  LayoutDashboard,
  MapPinned,
  LogOut,
  Settings,
  Ticket,
  User,
  UsersRound,
} from 'lucide-react';

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
  {
    id: 'dashboard',
    titleKey: 'sidebarDashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
    sub: [
      { titleKey: 'dashboardTools', href: '/dashboard/events' },
      { titleKey: 'dashboardConversation', href: '/dashboard/conversations' },
      { titleKey: 'dashboardAccount', href: '/dashboard/profile' },
    ],
  },
  {
    id: 'rahcom',
    titleKey: 'sidebarRahkam',
    icon: MapPinned,
    href: '/rahcom',
    sub: [
      { titleKey: 'rahcomMap', href: '/rahcom/map' },
      { titleKey: 'rahcomSystemsList', href: '/rahcom/systems' },
      { titleKey: 'rahcomSystemData', href: '/rahcom/data' },
      { titleKey: 'rahcomDailyTraffic', href: '/rahcom/daily-traffic' },
      { titleKey: 'rahcomSolarDaily', href: '/rahcom/solar-daily' },
      { titleKey: 'rahcomActions', href: '/rahcom/actions' },
      { titleKey: 'rahcomTickets', href: '/rahcom/tickets' },
    ],
  },
  {
    id: 'accounting',
    titleKey: 'sidebarAccounting',
    icon: Calculator,
    href: '/accounting',
    sub: [
      { titleKey: 'accountingChartOfAccounts', href: '/accounting/accounts' },
      { titleKey: 'accountingEntriesLedger', href: '/accounting/vouchers' },
      { titleKey: 'accountingInvoices', href: '/accounting/invoices' },
      { titleKey: 'accountingPurchaseInvoices', href: '/accounting/purchases' },
      { titleKey: 'accountingReceiptsPayments', href: '/accounting/payments' },
      { titleKey: 'sidebarLedger', href: '/accounting/ledger' },
      { titleKey: 'sidebarFinancialReports', href: '/accounting/reports' },
    ],
  },
  {
    id: 'commerce',
    titleKey: 'sidebarCommercial',
    icon: UsersRound,
    href: '/commerce',
    sub: [
      { titleKey: 'sidebarCustomers', href: '/commerce/customers' },
      { titleKey: 'sidebarSales', href: '/commerce/sales' },
      { titleKey: 'sidebarInventory', href: '/commerce/inventory' },
      { titleKey: 'sidebarPurchases', href: '/commerce/purchasing' },
    ],
  },
  {
    id: 'human-resources',
    titleKey: 'sidebarHumanResources',
    icon: BriefcaseBusiness,
    href: '/human-resources',
    sub: [
      { titleKey: 'sidebarEmployeeRecords', href: '/human-resources/employees' },
      { titleKey: 'sidebarAttendance', href: '/human-resources/attendance' },
      { titleKey: 'sidebarLeaveRequests', href: '/human-resources/leaves' },
      { titleKey: 'sidebarPayroll', href: '/human-resources/payroll' },
    ],
  },
  {
    id: 'statistics',
    titleKey: 'sidebarStatistics',
    icon: BarChart3,
    href: '/statistics',
    sub: [
      { titleKey: 'sidebarReports', href: '/statistics/reports' },
      { titleKey: 'sidebarBusinessIntelligence', href: '/statistics/business-intelligence' },
    ],
  },
  {
    id: 'settings',
    titleKey: 'sidebarSettings',
    icon: Settings,
    href: '/settings',
    sub: [
      { titleKey: 'sidebarGeneral', href: '/settings/general' },
      { titleKey: 'settingsDisplayManagement', href: '/settings/modules' },
      { titleKey: 'sidebarAnnouncementManagement', href: '/settings/announcements' },
      { titleKey: 'settingsOrganizationWorkspace', href: '/settings/company', activeHrefs: ['/settings/company', '/settings/organization', '/settings/projects'] },
      { titleKey: 'settingsAccessWorkspace', href: '/settings/roles', activeHrefs: ['/settings/roles', '/settings/accounts'] },
    ],
  },
  {
    id: 'support',
    titleKey: 'sidebarSupport',
    icon: Ticket,
    href: '/support',
    sub: [],
  },
  {
    id: 'development',
    titleKey: 'sidebarDevelopment',
    icon: Code2,
    href: '/development',
    sub: [
      { titleKey: 'developmentSiteVisits', href: '/development/site-visits' },
      { titleKey: 'sidebarTestData', href: '/development/test-data' },
    ],
  },
];

interface SidebarProps {
  isMainCollapsed?: boolean;
  isLocked?: boolean;
  isProfileActive?: boolean;
  navigateOnClick?: boolean;
  onCloseSidebar?: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  onSetProfileActive?: (active: boolean) => void;
}

export function Sidebar({
  isMainCollapsed = true,
  isLocked = false,
  isProfileActive = false,
  navigateOnClick = false,
  onCloseSidebar,
  isMobileOpen = false,
  onMobileClose,
  onSetProfileActive,
}: SidebarProps) {
  const pathname = usePathname();
  const { locale } = usePreferences();
  const message = (key: UiMessage) => uiMessage(locale, key);
  const router = useRouter();
  const sidebarRef = useRef<HTMLElement>(null);
  const supportProjectsRequest = useRef(0);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [supportProjects, setSupportProjects] = useState<SupportProjectItem[]>([]);
  const [organizationAccess, setOrganizationAccess] = useState<OrganizationAccess | null>(null);
  const [moduleVisibility, setModuleVisibility] = useState(() => readShellVisibility(isReducedEdition));
  const [dashboardUnreadCount, setDashboardUnreadCount] = useState(0);

  const isProfileRoute = pathname === '/dashboard/profile' || pathname.startsWith('/dashboard/profile/');
  const isHomeRoute = pathname === '/' || pathname === '/dashboard' || pathname.startsWith('/dashboard/');

  useEffect(() => {
    const refreshUser = () => {
      const requestId = ++supportProjectsRequest.current;
      const currentUser = getCurrentUser();
      setUser(currentUser);
      if (!currentUser) {
        setSupportProjects([]);
        setOrganizationAccess(null);
        return;
      }
      const organizationId = getCurrentOrganizationId();
      if (!organizationId) {
        setOrganizationAccess(null);
        setSupportProjects([]);
        return;
      }
      settingsApi.getOrganizationAccess(organizationId)
        .then((access) => { if (requestId === supportProjectsRequest.current) setOrganizationAccess(access); })
        .catch(() => { if (requestId === supportProjectsRequest.current) setOrganizationAccess(null); });
      projectsApi.getSupportProjects()
        .then((items) => { if (requestId === supportProjectsRequest.current) setSupportProjects(items); })
        .catch(() => { if (requestId === supportProjectsRequest.current) setSupportProjects([]); });
    };
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

  useEffect(() => {
    let mounted = true;
    const refreshUnreadCount = () => {
      void notificationsApi.getSummary().then((summary) => {
        if (mounted) setDashboardUnreadCount(summary.unreadCount);
      }).catch(() => {
        if (mounted) setDashboardUnreadCount(0);
      });
    };
    refreshUnreadCount();
    window.addEventListener('notifications-updated', refreshUnreadCount);
    window.addEventListener('auth:login', refreshUnreadCount);
    window.addEventListener('auth:logout', refreshUnreadCount);
    return () => {
      mounted = false;
      window.removeEventListener('notifications-updated', refreshUnreadCount);
      window.removeEventListener('auth:login', refreshUnreadCount);
      window.removeEventListener('auth:logout', refreshUnreadCount);
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

  useEffect(() => {
    const refresh = () => setModuleVisibility(readShellVisibility(isReducedEdition));
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('erp-module-visibility-change', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('erp-module-visibility-change', refresh);
    };
  }, []);

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

      const sidebarControls = document.getElementById('sidebar-controls');
      const userProfileBtn = document.getElementById('user-profile-header-btn');
      const navigateToggleBtn = document.getElementById('navigate-on-click-toggle-btn');

      if (
        (sidebarControls && sidebarControls.contains(target)) ||
        (userProfileBtn && userProfileBtn.contains(target)) ||
        (navigateToggleBtn && navigateToggleBtn.contains(target))
      ) {
        return;
      }

      // ریست وضعیت موقت تب به حالت متناظر با صفحه جاری
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

      // بستن ستون‌ها در صورت عدم قفل بودن
      if (!isMainCollapsed && !isLocked) {
        onCloseSidebar?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [
    isMainCollapsed,
    isLocked,
    isProfileActive,
    isProfileRoute,
    isHomeRoute,
    pathname,
    onCloseSidebar,
    onSetProfileActive,
  ]);

  // انتخاب ماژول: تغییر ستون دوم و هدایت اختیاری در صورت روشن بودن Navigation Mode
  const handleSelectModule = (item: NavigationItem) => {
    onSetProfileActive?.(false);
    setActiveTab(item.id);

    if (item.href && navigateOnClick) {
      router.push(item.href);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const localizedNavigation = navigation
    // Rahyar keeps the full ERP code, but its five premium modules are off by
    // default. Keep every other shared module available in the reduced edition.
    .filter((item) => moduleVisibility.navigationModules?.[item.id as keyof NonNullable<typeof moduleVisibility.navigationModules>] !== false)
    .filter((item) => !OPTIONAL_MODULE_IDS.includes(item.id as (typeof OPTIONAL_MODULE_IDS)[number]) || moduleVisibility[item.id as (typeof OPTIONAL_MODULE_IDS)[number]])
    .filter((item) => item.id !== 'rahcom' || Boolean(organizationAccess?.canViewRahcom))
    .filter((item) => item.id !== 'accounting' || Boolean(organizationAccess?.canViewAccounting))
    .filter((item) => item.id !== 'human-resources' || Boolean(organizationAccess?.canViewHumanResources))
    .map((item) => ({
    ...item,
    title: message(item.titleKey),
    sub: item.id === 'support'
      ? supportProjects.map((project) => ({ title: project.name, href: `/support/projects/${encodeURIComponent(project.id)}`, activeHrefs: undefined }))
      : item.sub?.filter((subItem) => moduleVisibility.navigationItems?.[subItem.href] !== false).map((subItem) => ({ ...subItem, title: subItem.titleKey ? message(subItem.titleKey) : subItem.title })),
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
        className="
          flex min-h-0 w-50 shrink-0 flex-col
          border-e border-[var(--border)]
          bg-[var(--surface)]/95
          p-4 shadow-sm backdrop-blur
        "
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
                      {subItem.href === '/dashboard/events' && dashboardUnreadCount > 0 && (
                        <span className="ms-auto inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-[var(--primary-foreground)]" dir="ltr">
                          {dashboardUnreadCount > 99 ? '99+' : dashboardUnreadCount}
                        </span>
                      )}
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
