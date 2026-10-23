'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Circle, Database, LoaderCircle } from 'lucide-react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { developmentApi, type TestDataModuleKey, type TestDataModuleStatus } from '@/app/(workspace)/development/development-api';
import { ApiError } from '@/lib/api-client';
import { uiMessage } from '@/lib/ui-messages';
import { isReducedEdition } from '@/lib/product-edition';
import { readModuleVisibility, type OptionalModuleId } from '@/lib/module-visibility';

const modules: Array<{
  key: TestDataModuleKey;
  title: Parameters<typeof uiMessage>[1];
  countLabels: Record<string, Parameters<typeof uiMessage>[1]>;
}> = [
  { key: 'accounting', title: 'sidebarAccounting', countLabels: { accounts: 'accountingChartOfAccounts', invoices: 'accountingInvoices', vouchers: 'sidebarAccountingEntries' } },
  { key: 'commerce', title: 'sidebarCommercial', countLabels: { accounts: 'sidebarCustomers', contacts: 'testDataContacts', leads: 'testDataLeads', opportunities: 'sidebarSalesOpportunities', warehouses: 'testDataWarehouses', products: 'sidebarInventory', balances: 'testDataStockBalances', movements: 'testDataMovements' } },
  { key: 'human-resources', title: 'sidebarHumanResources', countLabels: { employees: 'sidebarEmployeeRecords', leaveRequests: 'sidebarLeaveRequests', attendanceRecords: 'sidebarAttendance', payrollRecords: 'sidebarPayroll' } },
  { key: 'statistics', title: 'sidebarStatistics', countLabels: { invoices: 'accountingInvoices', leads: 'testDataLeads', opportunities: 'sidebarSalesOpportunities', employees: 'sidebarEmployeeRecords', leaveRequests: 'sidebarLeaveRequests', products: 'sidebarInventory', movements: 'testDataMovements', tickets: 'sidebarAllTickets' } },
  { key: 'settings', title: 'sidebarSettings', countLabels: { branches: 'sidebarOrganizationStructure', departments: 'sidebarOrganizationStructure', announcements: 'sidebarAnnouncements' } },
  { key: 'rahcom', title: 'sidebarRahkam', countLabels: {} },
  { key: 'support', title: 'sidebarSupport', countLabels: { projects: 'sidebarProjectManagement', tickets: 'sidebarAllTickets' } },
];
const optionalKeys: OptionalModuleId[] = ['accounting', 'commerce', 'human-resources', 'support', 'statistics'];

export default function TestDataPage() {
  const { locale } = usePreferences();
  const [statuses, setStatuses] = useState<TestDataModuleStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [workingKey, setWorkingKey] = useState<TestDataModuleKey | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [failedKeys, setFailedKeys] = useState<TestDataModuleKey[]>([]);
  const [visibility, setVisibility] = useState(() => readModuleVisibility(isReducedEdition));
  useEffect(() => {
    const refresh = () => setVisibility(readModuleVisibility(isReducedEdition));
    refresh();
    window.addEventListener('erp-module-visibility-change', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('erp-module-visibility-change', refresh); window.removeEventListener('storage', refresh); };
  }, []);
  const visibleModules = modules.filter(({ key }) => !optionalKeys.includes(key as OptionalModuleId) || visibility[key as OptionalModuleId]);
  const t = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const visibleStatuses = visibleModules.map(({ key }) => statuses.find((item) => item.moduleKey === key));
  const appliedCount = visibleStatuses.filter((item) => item?.applied).length;

  const updateModuleStatus = (result: TestDataModuleStatus) => {
    setStatuses((current) => current.map((item) => item.moduleKey === result.moduleKey ? result : item));
  };

  const loadStatuses = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    setDenied(false);
    try {
      const result = await developmentApi.getTestDataStatus();
      setStatuses(result.modules);
    } catch (error) {
      setDenied(error instanceof ApiError && error.status === 403);
      setLoadFailed(!(error instanceof ApiError && error.status === 403));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadStatuses(); }, [loadStatuses]);

  const applyModule = async (moduleKey: TestDataModuleKey) => {
    if (!visibleModules.some((module) => module.key === moduleKey)) return;
    setWorkingKey(moduleKey);
    setFailedKeys((current) => current.filter((key) => key !== moduleKey));
    try {
      const result = await developmentApi.applyTestData(moduleKey);
      updateModuleStatus(result);
      if (moduleKey === 'settings') window.dispatchEvent(new Event('organization-branding-changed'));
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) setDenied(true);
      else setFailedKeys((current) => current.includes(moduleKey) ? current : [...current, moduleKey]);
    } finally {
      setWorkingKey(null);
    }
  };

  const applyAllModules = async () => {
    setApplyingAll(true);
    setFailedKeys([]);
    const order: TestDataModuleKey[] = ['settings', 'rahcom', 'human-resources', 'accounting', 'commerce', 'support', 'statistics'];
    for (const moduleKey of order.filter((key) => visibleModules.some((module) => module.key === key))) {
      setWorkingKey(moduleKey);
      try {
        const result = await developmentApi.applyTestData(moduleKey);
        updateModuleStatus(result);
        if (moduleKey === 'settings') window.dispatchEvent(new Event('organization-branding-changed'));
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          setDenied(true);
          break;
        }
        setFailedKeys((current) => current.includes(moduleKey) ? current : [...current, moduleKey]);
      }
    }
    setWorkingKey(null);
    setApplyingAll(false);
  };

  const countLabel = (count: number) => t('testDataRecordCount').replace('{count}', new Intl.NumberFormat(locale).format(count));

  return (
    <main dir={getLocaleDirection(locale)} className="mx-auto max-w-5xl space-y-5">
      <header className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Database size={21} /></span>
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('testDataTitle')}</h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('testDataDescription')}</p>
        </div>
      </header>

      {denied ? (
        <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300">{t('developmentAccessDenied')}</p>
      ) : loadFailed ? (
        <div role="alert" className="space-y-2 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-sm text-red-700 dark:text-red-300">{t('testDataLoadFailed')}</p>
          <button type="button" onClick={() => void loadStatuses()} className="text-sm font-semibold text-primary underline underline-offset-4">{t('projectsRetry')}</button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <span className="text-sm font-semibold text-foreground">{t('testDataProgress')}</span>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm tabular-nums text-muted-foreground">{new Intl.NumberFormat(locale).format(appliedCount)} / {visibleModules.length}</span>
              <button type="button" onClick={() => void applyAllModules()} disabled={loading || applyingAll || workingKey !== null || denied} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                {applyingAll && <LoaderCircle size={16} className="animate-spin" />}
                {applyingAll ? t('testDataApplying') : t('testDataApplyAll')}
              </button>
            </div>
          </div>
          {loading ? (
            <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">{t('testDataLoading')}</p>
          ) : (
            <div className="space-y-3">
              {visibleModules.map(({ key, title, countLabels }, index) => {
                const status = visibleStatuses[index];
                const applied = Boolean(status?.applied);
                const busy = workingKey === key;
                return (
                  <section key={key} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={applied ? 'mt-0.5 text-emerald-600 dark:text-emerald-400' : 'mt-0.5 text-muted-foreground'}>
                        {busy ? <LoaderCircle size={21} className="animate-spin" /> : applied ? <CheckCircle2 size={21} /> : <Circle size={21} />}
                      </span>
                      <div className="min-w-0">
                        <h2 className="font-semibold text-foreground">{t(title)}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{applied ? `${t('testDataApplied')} · ${countLabel(status?.totalRecords ?? 0)}` : t('testDataPending')}</p>
                        {applied && status && (
                          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {Object.entries(countLabels).map(([countKey, label]) => {
                              const count = status.recordCounts[countKey];
                              return typeof count === 'number' && count > 0 ? <li key={countKey}>{new Intl.NumberFormat(locale).format(count)} {t(label)}</li> : null;
                            })}
                          </ul>
                        )}
                        {key === 'statistics' && <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('testDataStatisticsNote')}</p>}
                        {failedKeys.includes(key) && <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-300">{t('testDataApplyFailed')}</p>}
                      </div>
                    </div>
                    <button type="button" onClick={() => void applyModule(key)} disabled={loading || busy || workingKey !== null || applyingAll || denied} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                      {busy && <LoaderCircle size={16} className="animate-spin" />}
                      {busy ? t('testDataApplying') : applied ? t('testDataApplyAgain') : t('testDataApply')}
                    </button>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}
