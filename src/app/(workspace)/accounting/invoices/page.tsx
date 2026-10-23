'use client';

import { getCalendarLocale } from '@/lib/calendar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  XCircle,
} from 'lucide-react';

import {
  accountingApi,
  ApiClientError,
} from '@/app/(workspace)/accounting/accounting-api';

import type {
  AccountingDashboardSummary,
  AccountingDocumentStatus,
  AccountingListItem,
  AccountingPriority,
} from '@/app/(workspace)/accounting/types';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { useAccountingAccess } from '../accounting-access-context';

type StatusFilter = AccountingDocumentStatus | 'ALL';
type PriorityFilter = AccountingPriority | 'ALL';

type SortOption =
  | 'newest'
  | 'oldest'
  | 'amount-desc'
  | 'amount-asc'
  | 'title-asc'
  | 'title-desc';

const STATUS_OPTIONS: Array<{
  value: StatusFilter;
  label: string;
}> = [
  { value: 'ALL', label: 'همه وضعیت‌ها' },
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'submitted', label: 'ارسال‌شده' },
  { value: 'pending_review', label: 'در انتظار بررسی' },
  { value: 'approved', label: 'تأییدشده' },
  { value: 'rejected', label: 'ردشده' },
  { value: 'in_progress', label: 'در حال اجرا' },
  { value: 'completed', label: 'تکمیل‌شده' },
  { value: 'cancelled', label: 'لغوشده' },
];

const PRIORITY_OPTIONS: Array<{
  value: PriorityFilter;
  label: string;
}> = [
  { value: 'ALL', label: 'همه اولویت‌ها' },
  { value: 'LOW', label: 'کم' },
  { value: 'MEDIUM', label: 'متوسط' },
  { value: 'HIGH', label: 'زیاد' },
  { value: 'URGENT', label: 'فوری' },
];

const SORT_OPTIONS: Array<{
  value: SortOption;
  label: string;
}> = [
  { value: 'newest', label: 'جدیدترین سند' },
  { value: 'oldest', label: 'قدیمی‌ترین سند' },
  { value: 'amount-desc', label: 'مبلغ (زیاد به کم)' },
  { value: 'amount-asc', label: 'مبلغ (کم به زیاد)' },
  { value: 'title-asc', label: 'عنوان (الف تا ی)' },
  { value: 'title-desc', label: 'عنوان (ی تا الف)' },
];

const EMPTY_DASHBOARD: AccountingDashboardSummary = {
  totalInvoices: 0,
  pendingReview: 0,
  approved: 0,
  rejected: 0,
  paid: 0,
  overdue: 0,
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat('fa-IR').format(value);
}

function formatCurrency(amount: number, currency = 'IRR'): string {
  const formattedAmount = new Intl.NumberFormat('fa-IR').format(amount);
  const currencyLabels: Record<string, string> = {
    IRR: 'ریال',
    toman: 'تومان',
    تومان: 'تومان',
    USD: 'دلار',
    EUR: 'یورو',
  };
  return `${formattedAmount} ${currencyLabels[currency] ?? currency}`;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(getCalendarLocale('fa-IR'), {
    dateStyle: 'medium',
  }).format(date);
}

function getStatusLabel(status: AccountingDocumentStatus): string {
  const option = STATUS_OPTIONS.find((item) => item.value === status);
  return option?.label ?? status;
}

function getPriorityLabel(priority: AccountingPriority): string {
  const option = PRIORITY_OPTIONS.find((item) => item.value === priority);
  return option?.label ?? priority;
}

function getStatusBadge(status: AccountingDocumentStatus) {
  const config: Record<
    AccountingDocumentStatus,
    { label: string; bg: string; text: string }
  > = {
    approved: {
      label: 'تأییدشده',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-600 dark:text-emerald-400',
    },
    completed: {
      label: 'تکمیل‌شده',
      bg: 'bg-cyan-500/10',
      text: 'text-cyan-600 dark:text-cyan-400',
    },
    rejected: {
      label: 'ردشده',
      bg: 'bg-rose-500/10',
      text: 'text-rose-600 dark:text-rose-400',
    },
    cancelled: {
      label: 'لغوشده',
      bg: 'bg-rose-500/10',
      text: 'text-rose-600 dark:text-rose-400',
    },
    pending_review: {
      label: 'در انتظار بررسی',
      bg: 'bg-amber-500/10',
      text: 'text-amber-600 dark:text-amber-400',
    },
    submitted: {
      label: 'ارسال‌شده',
      bg: 'bg-blue-500/10',
      text: 'text-blue-600 dark:text-blue-400',
    },
    in_progress: {
      label: 'در حال اجرا',
      bg: 'bg-purple-500/10',
      text: 'text-purple-600 dark:text-purple-400',
    },
    draft: {
      label: 'پیش‌نویس',
      bg: 'bg-muted',
      text: 'text-muted-foreground',
    },
  };
  const c = config[status] || config.draft;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${c.bg} ${c.text}`}
    >
      {c.label}
    </span>
  );
}

function getPriorityBadge(priority: AccountingPriority) {
  const config: Record<
    AccountingPriority,
    { label: string; color: string }
  > = {
    LOW: { label: 'کم', color: 'text-muted-foreground bg-muted' },
    MEDIUM: {
      label: 'متوسط',
      color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10',
    },
    HIGH: {
      label: 'زیاد',
      color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
    },
    URGENT: {
      label: 'فوری',
      color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10',
    },
  };
  const c = config[priority] || config.LOW;
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold ${c.color}`}
    >
      {c.label}
    </span>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return 'دریافت اطلاعات حسابداری با خطا مواجه شد.';
}

export default function AccountingPage() {
  const { locale } = usePreferences();
  const { canManage } = useAccountingAccess();
  const [invoices, setInvoices] = useState<AccountingListItem[]>([]);
  const [dashboard, setDashboard] =
    useState<AccountingDashboardSummary>(EMPTY_DASHBOARD);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const loadAccountingData = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const [dashboardResult, invoicesResult] = await Promise.all([
        accountingApi.getDashboard(),
        accountingApi.getInvoices(),
      ]);

      setDashboard(dashboardResult);
      setInvoices(invoicesResult);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAccountingData();
  }, [loadAccountingData]);

  const filteredInvoices = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('fa-IR');

    const result = invoices.filter((invoice) => {
      const searchableText = [
        invoice.documentNumber,
        invoice.title,
        invoice.description ?? '',
        invoice.vendorName ?? '',
        invoice.branchName ?? '',
        invoice.departmentName ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase('fa-IR');

      const matchesSearch =
        !normalizedSearch || searchableText.includes(normalizedSearch);
      const matchesStatus =
        statusFilter === 'ALL' || invoice.status === statusFilter;
      const matchesPriority =
        priorityFilter === 'ALL' || invoice.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });

    return result.sort((first, second) => {
      switch (sortBy) {
        case 'oldest':
          return (
            new Date(first.createdAt).getTime() -
            new Date(second.createdAt).getTime()
          );
        case 'amount-desc':
          return second.totalAmount - first.totalAmount;
        case 'amount-asc':
          return first.totalAmount - second.totalAmount;
        case 'title-asc':
          return first.title.localeCompare(second.title, 'fa');
        case 'title-desc':
          return second.title.localeCompare(first.title, 'fa');
        case 'newest':
        default:
          return (
            new Date(second.createdAt).getTime() -
            new Date(first.createdAt).getTime()
          );
      }
    });
  }, [invoices, priorityFilter, search, sortBy, statusFilter]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    statusFilter !== 'ALL' ||
    priorityFilter !== 'ALL';

  function clearFilters() {
    setSearch('');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setSortBy('newest');
  }

  const stats = [
    {
      label: 'کل فاکتورها و اسناد',
      value: dashboard.totalInvoices,
      subtext: 'ثبت‌شده در سامانه',
      icon: FileText,
      iconColor: 'bg-blue-500/10 text-blue-500',
    },
    {
      label: 'در انتظار بررسی',
      value: dashboard.pendingReview,
      subtext: 'نیازمند تأیید مالی',
      icon: Clock,
      iconColor: 'bg-amber-500/10 text-amber-500',
    },
    {
      label: 'تأییدشده و نهایی',
      value: dashboard.approved,
      subtext: 'گردش کار موفق',
      icon: CheckCircle2,
      iconColor: 'bg-emerald-500/10 text-emerald-500',
    },
    {
      label: 'معوق و سررسیدشده',
      value: dashboard.overdue,
      subtext: 'نیازمند پیگیری فوری',
      icon: XCircle,
      iconColor: 'bg-rose-500/10 text-rose-500',
    },
  ];

  return (
    <div dir={getLocaleDirection(locale)} className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold text-primary">ERP</p><h1 className="mt-1 text-xl font-bold text-foreground">{uiMessage(locale, 'accountingInvoices')}</h1></div>
      </header>
      {/* کارت‌های آماری (KPIs) */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-blue-500/30"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-xl font-bold text-foreground">
                    {isLoading ? '—' : formatNumber(stat.value)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {stat.subtext}
                  </p>
                </div>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.iconColor}`}
                >
                  <Icon size={20} />
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* فیلترها، جستجو و دکمه‌های عملیاتی */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="relative">
              <Search
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جست‌وجوی شماره، عنوان یا تأمین‌کننده..."
                className="h-10 w-full rounded-xl border border-border bg-background pr-9 pl-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="relative">
              <Filter
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
                className="h-10 w-full appearance-none rounded-xl border border-border bg-background pr-9 pl-3 text-xs text-foreground focus:border-blue-500 focus:outline-none"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Sparkles
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <select
                value={priorityFilter}
                onChange={(e) =>
                  setPriorityFilter(e.target.value as PriorityFilter)
                }
                className="h-10 w-full appearance-none rounded-xl border border-border bg-background pr-9 pl-3 text-xs text-foreground focus:border-blue-500 focus:outline-none"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <ArrowUpDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as SortOption)
                }
                className="h-10 w-full appearance-none rounded-xl border border-border bg-background pr-9 pl-3 text-xs text-foreground focus:border-blue-500 focus:outline-none"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-border">
            <button
              type="button"
              onClick={() => void loadAccountingData(true)}
              disabled={isRefreshing || isLoading}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground transition-all hover:bg-muted active:scale-95 disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={isRefreshing ? 'animate-spin' : ''}
              />
              <span>به‌روزرسانی</span>
            </button>

            {canManage && <Link
              href="/accounting/new"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95"
            >
              <Plus size={15} />
              <span>ثبت فاکتور جدید</span>
            </Link>}
          </div>
        </div>
      </section>

      {/* جدول اسناد مالی */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-right text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                <th className="px-4 py-3.5 font-medium">شماره سند</th>
                <th className="px-4 py-3.5 font-medium">عنوان سند</th>
                <th className="px-4 py-3.5 font-medium">طرف‌حساب / تأمین‌کننده</th>
                <th className="px-4 py-3.5 font-medium">مبلغ کل</th>
                <th className="px-4 py-3.5 font-medium">وضعیت</th>
                <th className="px-4 py-3.5 font-medium">اولویت</th>
                <th className="px-4 py-3.5 font-medium">تاریخ سررسید</th>
                <th className="px-4 py-3.5 text-center font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-4">
                      <div className="h-4 w-24 rounded bg-muted"></div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-36 rounded bg-muted"></div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-28 rounded bg-muted"></div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-24 rounded bg-muted"></div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-5 w-20 rounded bg-muted"></div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-5 w-14 rounded bg-muted"></div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-20 rounded bg-muted"></div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="mx-auto h-8 w-8 rounded bg-muted"></div>
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
                      <AlertCircle size={24} />
                    </div>
                    <p className="mt-3 text-sm font-bold text-foreground">
                      دریافت اطلاعات ناموفق بود
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{error}</p>
                    <button
                      type="button"
                      onClick={() => void loadAccountingData()}
                      className="mt-4 inline-flex h-9 items-center rounded-xl bg-blue-600 px-4 text-xs font-bold text-white transition-all hover:bg-blue-700"
                    >
                      تلاش مجدد
                    </button>
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                      <FileText size={24} />
                    </div>
                    <p className="mt-3 text-sm font-bold text-foreground">
                      {hasActiveFilters
                        ? 'موردی با فیلترهای فعلی یافت نشد'
                        : 'هنوز فاکتوری ثبت نشده است'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {hasActiveFilters
                        ? 'فیلترها را تغییر دهید یا آن‌ها را پاک کنید.'
                        : 'برای شروع، اولین فاکتور مالی را ایجاد کنید.'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-4 inline-flex h-9 items-center rounded-xl border border-border bg-background px-4 text-xs font-semibold text-foreground transition hover:bg-muted"
                      >
                        پاک‌کردن فیلترها
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    {/* شماره سند */}
                    <td className="px-4 py-4">
                      <Link
                        href={`/accounting/${invoice.id}`}
                        className="font-mono text-xs font-bold text-blue-500 hover:underline"
                      >
                        {invoice.documentNumber}
                      </Link>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatDate(invoice.createdAt)}
                      </div>
                    </td>

                    {/* عنوان سند */}
                    <td className="px-4 py-4">
                      <Link
                        href={`/accounting/${invoice.id}`}
                        className="font-semibold text-foreground hover:text-blue-500"
                      >
                        {invoice.title}
                      </Link>
                      {invoice.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {invoice.description}
                        </p>
                      )}
                    </td>

                    {/* تأمین‌کننده / طرف‌حساب */}
                    <td className="px-4 py-4 text-foreground/80">
                      {invoice.vendorName || '—'}
                    </td>

                    {/* مبلغ */}
                    <td className="px-4 py-4 font-semibold text-foreground">
                      {formatCurrency(invoice.totalAmount, invoice.currency)}
                    </td>

                    {/* وضعیت */}
                    <td className="px-4 py-4">{getStatusBadge(invoice.status)}</td>

                    {/* اولویت */}
                    <td className="px-4 py-4">
                      {getPriorityBadge(invoice.priority)}
                    </td>

                    {/* تاریخ سررسید */}
                    <td className="px-4 py-4 text-muted-foreground">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Clock size={13} className="text-muted-foreground" />
                        <span>{formatDate(invoice.dueDate)}</span>
                      </div>
                    </td>

                    {/* عملیات */}
                    <td className="px-4 py-4 text-center">
                      <Link
                        href={`/accounting/${invoice.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-all hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-500"
                        title="مشاهده جزئیات سند"
                      >
                        <Eye size={15} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
