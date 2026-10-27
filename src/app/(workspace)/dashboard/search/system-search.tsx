'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight, Search } from 'lucide-react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import type { UiMessage } from '@/languages/types';
import { isReducedEdition } from '@/lib/product-edition';
import { readSearchHistory, saveSearchHistory } from '@/lib/search-history';
import { rahcomApi, type RahcomSystem } from '@/lib/api/rahcom/rahcom-api';
import { searchRahcomSystems } from '@/lib/rahcom-system-search';

const destinations: Array<{ href: string; title: UiMessage }> = [
  { href: '/dashboard', title: 'sidebarDashboard' },
  { href: '/dashboard/events', title: 'notificationsTitle' },
  { href: '/dashboard/events?tab=announcements', title: 'messagesTitle' },
  { href: '/dashboard/events?tab=history', title: 'activityHistoryTitle' },
  { href: '/dashboard/help', title: 'userGuideTitle' },
  { href: '/rahcom', title: 'sidebarRahkam' },
  { href: '/rahcom/systems', title: 'rahcomSystemsList' },
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
  { href: '/settings/roles', title: 'sidebarRolesPermissions' },
  { href: '/settings/accounts', title: 'sidebarUserAccounts' },
  { href: '/settings/projects', title: 'sidebarProjectManagement' },
  { href: '/support', title: 'sidebarSupport' },
];

export function SystemSearchPage() {
  const { locale } = usePreferences();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const t = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const [query, setQuery] = useState(initialQuery);
  const [history, setHistory] = useState<string[]>([]);
  const [systems, setSystems] = useState<RahcomSystem[]>([]);
  const [systemsLoading, setSystemsLoading] = useState(true);
  const [systemsError, setSystemsError] = useState(false);
  useEffect(() => {
    let active = true;
    void rahcomApi.systems()
      .then((items) => { if (active) { setSystems(items); setSystemsError(false); } })
      .catch(() => { if (active) { setSystems([]); setSystemsError(true); } })
      .finally(() => { if (active) setSystemsLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    setQuery(initialQuery);
    setHistory(initialQuery ? saveSearchHistory(initialQuery, isReducedEdition) : readSearchHistory(isReducedEdition));
  }, [initialQuery]);
  const results = useMemo(() => {
    const normalized = query.trim().normalize('NFKC').toLocaleLowerCase(locale);
    if (!normalized) return [];
    return destinations.filter((item) => t(item.title).normalize('NFKC').toLocaleLowerCase(locale).includes(normalized));
  }, [locale, query]);
  const systemResults = useMemo(() => {
    return searchRahcomSystems(systems, query, locale);
  }, [locale, query, systems]);

  return <div dir={getLocaleDirection(locale)} className="mx-auto max-w-4xl space-y-5">
    <header><h1 className="flex items-center gap-2 text-xl font-bold text-foreground"><Search size={21} className="text-primary" />{t('headerSearch')}</h1><p className="mt-1 text-sm text-muted-foreground">{t('searchDescription')}</p></header>
    <label className="relative block"><Search size={17} aria-hidden="true" className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted-foreground" /><input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') setHistory(saveSearchHistory(query, isReducedEdition)); }} aria-label={t('headerSearch')} placeholder={t('headerSearch')} className="h-12 w-full rounded-xl border border-border bg-card ps-11 pe-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary" /></label>
    {query.trim() ? <div className="space-y-4" aria-live="polite"><section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><ul className="divide-y divide-border">{results.map((item) => <li key={item.href}><Link href={item.href} className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50"><span>{t(item.title)}</span><ArrowUpRight size={15} className="shrink-0 text-muted-foreground" /></Link></li>)}</ul></section>{systemResults.map(system => <article key={system.id} className="space-y-3 rounded-2xl border border-border bg-card p-4"><div><h2 className="font-bold text-foreground">{system.systemName}</h2><p dir="ltr" className="mt-1 text-sm text-muted-foreground">{system.systemCode} · {system.province} · {system.axis || ''}</p></div><div className="flex flex-wrap gap-2">{[[`/rahcom/map?system=${encodeURIComponent(system.id)}`, 'rahcomMap'], [`/rahcom/systems?q=${encodeURIComponent(system.systemCode)}`, 'rahcomSystemsList'], [`/rahcom/daily-traffic?system=${encodeURIComponent(system.systemCode)}`, 'rahcomDailyTraffic'], [`/rahcom/solar-daily?system=${encodeURIComponent(system.systemCode)}`, 'rahcomSolarDaily'], [`/rahcom/actions?system=${encodeURIComponent(system.id)}`, 'activityHistoryTitle'], [`/rahcom/tickets?system=${encodeURIComponent(system.systemCode)}`, 'rahcomTickets']].map(([href, key]) => <Link key={href} href={href} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:border-primary hover:text-primary">{t(key as Parameters<typeof uiMessage>[1])}</Link>)}</div></article>)}{systemsError && <p role="alert" className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">{t('rahcomSystemsLoadError')}</p>}{!systemsLoading && !systemsError && results.length === 0 && systemResults.length === 0 && <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">{t('searchNoResults')}</p>}</div> : history.length > 0 && <section className="rounded-2xl border border-border bg-card p-4"><h2 className="mb-2 text-sm font-semibold text-foreground">{t('dashboardHistory')}</h2><ul className="flex flex-wrap gap-2">{history.map((item) => <li key={item}><button type="button" onClick={() => setQuery(item)} className="rounded-full border border-border px-3 py-1.5 text-sm text-foreground hover:border-primary hover:text-primary">{item}</button></li>)}</ul></section>}
  </div>;
}
