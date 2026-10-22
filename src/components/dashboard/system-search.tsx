'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Search } from 'lucide-react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import type { UiMessage } from '@/lib/ui-messages';

const destinations: Array<{ href: string; title: UiMessage }> = [
  { href: '/dashboard', title: 'sidebarDashboard' },
  { href: '/dashboard/events', title: 'notificationsTitle' },
  { href: '/dashboard/events?tab=announcements', title: 'messagesTitle' },
  { href: '/dashboard/events?tab=history', title: 'activityHistoryTitle' },
  { href: '/dashboard/help', title: 'userGuideTitle' },
  { href: '/accounting', title: 'sidebarAccounting' },
  { href: '/accounting/accounts', title: 'accountingChartOfAccounts' },
  { href: '/accounting/vouchers', title: 'accountingEntriesLedger' },
  { href: '/accounting/invoices', title: 'accountingInvoices' },
  { href: '/accounting/purchases', title: 'accountingPurchaseInvoices' },
  { href: '/accounting/payments', title: 'accountingReceiptsPayments' },
  { href: '/accounting/ledger', title: 'sidebarLedger' },
  { href: '/accounting/reports', title: 'sidebarFinancialReports' },
  { href: '/commerce', title: 'sidebarCommercial' },
  { href: '/commerce/customers', title: 'sidebarCustomers' },
  { href: '/commerce/sales', title: 'sidebarSales' },
  { href: '/human-resources', title: 'sidebarHumanResources' },
  { href: '/human-resources/employees', title: 'sidebarEmployeeRecords' },
  { href: '/human-resources/attendance', title: 'sidebarAttendance' },
  { href: '/human-resources/leaves', title: 'sidebarLeaveRequests' },
  { href: '/human-resources/payroll', title: 'sidebarPayroll' },
  { href: '/commerce/inventory', title: 'sidebarInventory' },
  { href: '/commerce/purchasing', title: 'sidebarPurchases' },
  { href: '/statistics', title: 'sidebarStatistics' },
  { href: '/statistics/reports', title: 'sidebarReports' },
  { href: '/statistics/reports/financial', title: 'sidebarFinancialReports' },
  { href: '/statistics/reports/sales', title: 'sidebarSalesReports' },
  { href: '/statistics/reports/hr', title: 'sidebarHrReports' },
  { href: '/statistics/reports/inventory', title: 'sidebarInventoryReports' },
  { href: '/statistics/business-intelligence', title: 'sidebarBusinessIntelligence' },
  { href: '/development', title: 'sidebarDevelopment' },
  { href: '/development/test-data', title: 'sidebarTestData' },
  { href: '/settings', title: 'sidebarSettings' },
  { href: '/settings/general', title: 'sidebarGeneral' },
  { href: '/settings/announcements', title: 'sidebarAnnouncementManagement' },
  { href: '/settings/company', title: 'sidebarCompanyInformation' },
  { href: '/settings/organization', title: 'sidebarOrganizationStructure' },
  { href: '/settings/accounts', title: 'sidebarUserAccounts' },
  { href: '/support', title: 'sidebarSupport' },
];

export function SystemSearchPage() {
  const { locale } = usePreferences();
  const t = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const normalized = query.trim().normalize('NFKC').toLocaleLowerCase(locale);
    if (!normalized) return [];
    return destinations.filter((item) => t(item.title).normalize('NFKC').toLocaleLowerCase(locale).includes(normalized));
  }, [locale, query]);

  return <div dir={getLocaleDirection(locale)} className="mx-auto max-w-4xl space-y-5">
    <header><h1 className="flex items-center gap-2 text-xl font-bold text-foreground"><Search size={21} className="text-primary" />{t('headerSearch')}</h1><p className="mt-1 text-sm text-muted-foreground">{t('searchDescription')}</p></header>
    <label className="relative block"><Search size={17} aria-hidden="true" className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted-foreground" /><input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label={t('headerSearch')} placeholder={t('headerSearch')} className="h-12 w-full rounded-xl border border-border bg-card ps-11 pe-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary" /></label>
    {query.trim() && <section aria-live="polite" className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><ul className="divide-y divide-border">{results.map((item) => <li key={item.href}><Link href={item.href} className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50"><span>{t(item.title)}</span><ArrowUpRight size={15} className="shrink-0 text-muted-foreground" /></Link></li>)}{results.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">{t('searchNoResults')}</li>}</ul></section>}
  </div>;
}
