/**
 * مسیر فایل:
 * src/app/(workspace)/tickets/page.tsx
 *
 * هدف:
 * صفحه اصلی ماژول تیکت‌ها و پشتیبانی (کارت‌های خلاصه وضعیت و جدول فیلتردار تیکت‌ها).
 */

'use client';

import { getCalendarLocale } from '@/lib/calendar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowDownUp,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  Ticket as TicketIcon,
  UserRound,
  XCircle,
} from 'lucide-react';

import { ticketApi } from '@/app/(workspace)/support/ticket-api';
import type { Ticket, TicketPriority, TicketStatus } from '@/app/(workspace)/support/types';

type StatusFilter = TicketStatus | 'ALL';
type PriorityFilter = TicketPriority | 'ALL';

type SortOption =
  | 'newest'
  | 'oldest'
  | 'priority-desc'
  | 'priority-asc'
  | 'subject-asc'
  | 'subject-desc';

const STATUS_OPTIONS: Array<{
  value: StatusFilter;
  label: string;
}> = [
  { value: 'ALL', label: 'همه وضعیت‌ها' },
  { value: 'OPEN', label: 'باز' },
  { value: 'IN_PROGRESS', label: 'در حال پیگیری' },
  { value: 'WAITING_FOR_CUSTOMER', label: 'در انتظار مشتری' },
  { value: 'RESOLVED', label: 'حل‌شده' },
  { value: 'CLOSED', label: 'بسته‌شده' },
  { value: 'CANCELLED', label: 'لغوشده' },
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
  { value: 'newest', label: 'جدیدترین' },
  { value: 'oldest', label: 'قدیمی‌ترین' },
  { value: 'priority-desc', label: 'اولویت؛ زیاد به کم' },
  { value: 'priority-asc', label: 'اولویت؛ کم به زیاد' },
  { value: 'subject-asc', label: 'عنوان؛ الف تا ی' },
  { value: 'subject-desc', label: 'عنوان؛ ی تا الف' },
];

const PRIORITY_SCORE: Record<TicketPriority, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat('fa-IR').format(value);
}

function formatDate(value?: string | null): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat(getCalendarLocale('fa-IR'), {
    dateStyle: 'medium',
  }).format(date);
}

function getTicketNumberLabel(ticket: Ticket): string {
  if (ticket.ticketNumber !== undefined && ticket.ticketNumber !== null) {
    return `TCK-${ticket.ticketNumber}`;
  }
  return `TCK-${ticket.id.slice(0, 6)}`;
}

function getStatusLabel(status: TicketStatus): string {
  const option = STATUS_OPTIONS.find((item) => item.value === status);
  return option?.label ?? status;
}

function getPriorityLabel(priority: TicketPriority): string {
  const option = PRIORITY_OPTIONS.find((item) => item.value === priority);
  return option?.label ?? priority;
}

function getStatusClassName(status: TicketStatus): string {
  switch (status) {
    case 'RESOLVED':
      return 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20';

    case 'IN_PROGRESS':
      return 'bg-amber-500/10 text-amber-400 ring-amber-500/20';

    case 'WAITING_FOR_CUSTOMER':
      return 'bg-violet-500/10 text-violet-400 ring-violet-500/20';

    case 'CANCELLED':
      return 'bg-rose-500/10 text-rose-400 ring-rose-500/20';

    case 'OPEN':
      return 'bg-blue-500/10 text-blue-400 ring-blue-500/20';

    case 'CLOSED':
    default:
      return 'bg-slate-500/10 text-slate-300 ring-slate-500/20';
  }
}

function getPriorityClassName(priority: TicketPriority): string {
  switch (priority) {
    case 'URGENT':
      return 'bg-rose-500/10 text-rose-400 ring-rose-500/20';

    case 'HIGH':
      return 'bg-orange-500/10 text-orange-400 ring-orange-500/20';

    case 'LOW':
      return 'bg-slate-500/10 text-slate-300 ring-slate-500/20';

    case 'MEDIUM':
    default:
      return 'bg-sky-500/10 text-sky-400 ring-sky-500/20';
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'دریافت اطلاعات تیکت‌ها با خطا مواجه شد.';
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const loadTicketsData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await ticketApi.getTickets();
      setTickets(result || []);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTicketsData();
  }, [loadTicketsData]);

  const filteredTickets = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('fa-IR');

    const result = tickets.filter((ticket) => {
      const searchableText = [
        ticket.ticketNumber !== undefined && ticket.ticketNumber !== null
          ? String(ticket.ticketNumber)
          : '',
        ticket.subject,
        ticket.description ?? '',
        ticket.category ?? '',
        ticket.creator?.username ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase('fa-IR');

      const matchesSearch =
        !normalizedSearch || searchableText.includes(normalizedSearch);

      const matchesStatus =
        statusFilter === 'ALL' || ticket.status === statusFilter;

      const matchesPriority =
        priorityFilter === 'ALL' || ticket.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });

    return result.sort((first, second) => {
      switch (sortBy) {
        case 'oldest':
          return (
            new Date(first.createdAt).getTime() -
            new Date(second.createdAt).getTime()
          );

        case 'priority-desc':
          return (
            PRIORITY_SCORE[second.priority] - PRIORITY_SCORE[first.priority]
          );

        case 'priority-asc':
          return (
            PRIORITY_SCORE[first.priority] - PRIORITY_SCORE[second.priority]
          );

        case 'subject-asc':
          return first.subject.localeCompare(second.subject, 'fa');

        case 'subject-desc':
          return second.subject.localeCompare(first.subject, 'fa');

        case 'newest':
        default:
          return (
            new Date(second.createdAt).getTime() -
            new Date(first.createdAt).getTime()
          );
      }
    });
  }, [tickets, priorityFilter, search, sortBy, statusFilter]);

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
      label: 'کل تیکت‌ها',
      value: tickets.length,
      icon: TicketIcon,
      iconClassName: 'bg-blue-500/10 text-blue-500',
    },
    {
      label: 'در انتظار پیگیری',
      value: tickets.filter(
        (t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS',
      ).length,
      icon: Clock3,
      iconClassName: 'bg-amber-500/10 text-amber-500',
    },
    {
      label: 'حل‌شده',
      value: tickets.filter((t) => t.status === 'RESOLVED').length,
      icon: CheckCircle2,
      iconClassName: 'bg-emerald-500/10 text-emerald-500',
    },
    {
      label: 'فوری و بحرانی',
      value: tickets.filter((t) => t.priority === 'URGENT').length,
      icon: XCircle,
      iconClassName: 'bg-rose-500/10 text-rose-500',
    },
  ];

  return (
    <div dir="rtl" className="space-y-5">
      {/* ۱. کارت‌های خلاصه وضعیت */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-500/30 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-xl font-bold text-foreground">
                    {isLoading ? '—' : formatNumber(stat.value)}
                  </p>
                </div>

                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.iconClassName}`}
                >
                  <Icon size={20} />
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* ۲. بخش فیلترها و جدول تیکت‌ها */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                فهرست تیکت‌ها
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                فهرست تیکت‌های پشتیبانی ثبت‌شده در سامانه
              </p>
            </div>

            <div className="text-xs text-muted-foreground">
              تعداد تیکت‌ها:{' '}
              <span className="font-bold text-foreground">
                {formatNumber(filteredTickets.length)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(200px,1fr)_160px_160px_160px]">
            <div className="relative">
              <Search
                size={16}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="جست‌وجو در شماره، عنوان یا دسته‌بندی..."
                className="h-10 w-full rounded-xl border border-border bg-background pe-10 ps-3 text-xs text-foreground outline-none transition placeholder:text-muted-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
              className="h-10 rounded-xl border border-border bg-background px-3 text-xs text-foreground outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(event.target.value as PriorityFilter)
              }
              className="h-10 rounded-xl border border-border bg-background px-3 text-xs text-foreground outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <div className="relative">
              <ArrowDownUp
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value as SortOption)
                }
                className="h-10 w-full rounded-xl border border-border bg-background pe-3 ps-8 text-xs text-foreground outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-2 p-8 text-muted-foreground">
            <RefreshCw size={22} className="animate-spin text-blue-500" />
            <p className="text-xs">در حال دریافت اطلاعات تیکت‌ها...</p>
          </div>
        ) : error ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="rounded-full bg-rose-500/10 p-2.5 text-rose-400 ring-1 ring-inset ring-rose-500/15">
              <AlertCircle size={22} />
            </div>

            <div>
              <h3 className="text-sm font-bold text-foreground">
                دریافت اطلاعات ناموفق بود
              </h3>
              <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadTicketsData()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
            >
              تلاش مجدد
            </button>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="rounded-full bg-muted p-3.5 text-muted-foreground">
              <TicketIcon size={24} />
            </div>

            <div>
              <h3 className="text-sm font-bold text-foreground">
                {hasActiveFilters
                  ? 'نتیجه‌ای با فیلترهای فعلی پیدا نشد'
                  : 'هنوز تیکتی ثبت نشده است'}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {hasActiveFilters
                  ? 'فیلترها را تغییر دهید یا آن‌ها را پاک کنید.'
                  : 'برای شروع، اولین تیکت پشتیبانی را ثبت کنید.'}
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2.5">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground transition hover:bg-accent"
                >
                  پاک‌کردن فیلترها
                </button>
              )}

              <Link
                href="/support/new"
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"
              >
                ثبت تیکت جدید
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-right">
              <thead className="bg-muted/40">
                <tr className="border-b border-border text-[11px] font-bold text-muted-foreground">
                  <th className="px-5 py-3">شماره تیکت</th>
                  <th className="px-5 py-3">عنوان و شرح</th>
                  <th className="px-5 py-3">دسته‌بندی</th>
                  <th className="px-5 py-3">وضعیت</th>
                  <th className="px-5 py-3">اولویت</th>
                  <th className="px-5 py-3">ثبت‌کننده</th>
                  <th className="px-5 py-3">عملیات</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="text-xs transition hover:bg-accent/40"
                  >
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <Link
                        href={`/support/${ticket.id}`}
                        className="font-bold text-blue-500 hover:text-blue-400 hover:underline"
                      >
                        {getTicketNumberLabel(ticket)}
                      </Link>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatDate(ticket.createdAt)}
                      </p>
                    </td>

                    <td className="max-w-[240px] px-5 py-3.5">
                      <Link
                        href={`/support/${ticket.id}`}
                        className="line-clamp-1 font-medium text-foreground hover:text-blue-400"
                      >
                        {ticket.subject}
                      </Link>

                      {ticket.description && (
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                          {ticket.description}
                        </p>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-3.5 text-xs text-foreground">
                      {ticket.category || '—'}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${getStatusClassName(
                          ticket.status,
                        )}`}
                      >
                        {getStatusLabel(ticket.status)}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${getPriorityClassName(
                          ticket.priority,
                        )}`}
                      >
                        {getPriorityLabel(ticket.priority)}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-5 py-3.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <UserRound size={13} className="text-muted-foreground" />
                        <span>
                          {ticket.creator?.username || '—'}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <Link
                        href={`/support/${ticket.id}`}
                        className="whitespace-nowrap rounded-xl border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-foreground shadow-sm transition hover:bg-accent"
                      >
                        مشاهده جزئیات
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
