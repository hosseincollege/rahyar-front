/**
 * @file src/app/(workspace)/tickets/[id]/page.tsx
 * @name ticket-details-page
 * @description صفحه جزئیات تیکت با رابط RTL، نمایش اطلاعات ساختاریافته و سازگاری کامل با متغیرهای CSS تم‌های روشن و تیره.
 */

'use client';

import { getCalendarLocale } from '@/lib/calendar';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clipboard,
  Clock3,
  Copy,
  FileText,
  Loader2,
  Mail,
  Phone,
  RefreshCcw,
  ShieldAlert,
  Ticket,
  UserRound,
  XCircle,
} from 'lucide-react';

import { ticketApi } from '@/app/(workspace)/support/ticket-api';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';

type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
type TicketSource =
  | 'PHONE'
  | 'EMAIL'
  | 'WHATSAPP'
  | 'TELEGRAM'
  | 'WEB'
  | 'IN_PERSON'
  | 'OTHER';

type CustomerSummary = {
  id?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
};

type CreatorSummary = {
  id?: string | null;
  name?: string | null;
  fullName?: string | null;
  email?: string | null;
};

type TicketDetailsRecord = {
  id: string;
  ticketNumber?: string | null;
  title: string;
  description?: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  source?: TicketSource | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customer?: CustomerSummary | null;
  creator?: CreatorSummary | null;
  creatorId?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  project?: { id: string; name: string; code: string } | null;
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return '-';
  }

  try {
    return new Intl.DateTimeFormat(getCalendarLocale('fa-IR'), {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatShortDate(value?: string | null) {
  if (!value) {
    return '-';
  }

  try {
    return new Intl.DateTimeFormat(getCalendarLocale('fa-IR'), {
      dateStyle: 'medium',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getStatusLabel(status: TicketStatus) {
  const labels: Record<TicketStatus, string> = {
    OPEN: 'باز',
    IN_PROGRESS: 'در حال پیگیری',
    RESOLVED: 'حل‌شده',
    CLOSED: 'بسته‌شده',
  };

  return labels[status];
}

function getPriorityLabel(priority: TicketPriority) {
  const labels: Record<TicketPriority, string> = {
    LOW: 'کم',
    MEDIUM: 'متوسط',
    HIGH: 'زیاد',
    URGENT: 'فوری',
  };

  return labels[priority];
}

function getSourceLabel(source?: TicketSource | null) {
  const labels: Record<TicketSource, string> = {
    PHONE: 'تماس تلفنی',
    EMAIL: 'ایمیل',
    WHATSAPP: 'واتساپ',
    TELEGRAM: 'تلگرام',
    WEB: 'وب‌سایت',
    IN_PERSON: 'مراجعه حضوری',
    OTHER: 'سایر',
  };

  return source ? labels[source] : '-';
}

function getStatusClassName(status: TicketStatus) {
  const classes: Record<TicketStatus, string> = {
    OPEN: 'border-[var(--info)]/20 bg-[var(--info-soft)] text-[var(--info)]',
    IN_PROGRESS: 'border-[var(--warning)]/20 bg-[var(--warning-soft)] text-[var(--warning)]',
    RESOLVED: 'border-[var(--success)]/20 bg-[var(--success-soft)] text-[var(--success)]',
    CLOSED: 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]',
  };

  return classes[status];
}

function getPriorityClassName(priority: TicketPriority) {
  const classes: Record<TicketPriority, string> = {
    LOW: 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]',
    MEDIUM: 'border-[var(--primary)]/20 bg-[var(--primary-soft)] text-[var(--primary)]',
    HIGH: 'border-[var(--warning)]/20 bg-[var(--warning-soft)] text-[var(--warning)]',
    URGENT: 'border-[var(--danger)]/20 bg-[var(--danger-soft)] text-[var(--danger)]',
  };

  return classes[priority];
}

function getStatusIcon(status: TicketStatus) {
  switch (status) {
    case 'OPEN':
      return <Clock3 className="h-4 w-4" />;
    case 'IN_PROGRESS':
      return <RefreshCcw className="h-4 w-4" />;
    case 'RESOLVED':
      return <CheckCircle2 className="h-4 w-4" />;
    case 'CLOSED':
      return <XCircle className="h-4 w-4" />;
  }
}

function getCreatorName(ticket: TicketDetailsRecord) {
  return (
    ticket.creator?.fullName ||
    ticket.creator?.name ||
    ticket.creator?.email ||
    ticket.creatorId ||
    '-'
  );
}

export default function TicketDetailsPage() {
  const params = useParams<{ id: string }>();
  const { locale } = usePreferences();

  const ticketId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [ticket, setTicket] = useState<TicketDetailsRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadTicket = useCallback(
    async (refresh = false) => {
      if (!ticketId) {
        setError('شناسه تیکت معتبر نیست.');
        setIsLoading(false);
        return;
      }

      try {
        if (refresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        setError(null);

        const result = await ticketApi.getTicketById(ticketId);
        
        // تبدیل صریح Response بک‌اندازه به شکل مورد نیاز این صفحه
        const record: TicketDetailsRecord = {
          id: result.id,
          title: result.subject,
          ticketNumber:
            result.ticketNumber !== undefined && result.ticketNumber !== null
              ? String(result.ticketNumber)
              : null,
          description: result.description,
          status: (result.status as unknown) as TicketStatus,
          priority: result.priority,
          source: null,
          customerName: null,
          customerPhone: null,
          customer: null,
          creator: result.creatorId
            ? {
                id: result.creatorId,
                name: `کاربر ${result.creatorId.slice(0, 6)}`,
                fullName: `کاربر ${result.creatorId.slice(0, 6)}`,
              }
            : null,
          creatorId: result.creatorId,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
          project: result.project ?? null,
        };

        setTicket(record);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'دریافت جزئیات تیکت با خطا مواجه شد.',
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [ticketId],
  );


  useEffect(() => {
    void loadTicket();
  }, [loadTicket]);

  async function copyTicketNumber() {
    if (!ticket) {
      return;
    }

    const valueToCopy = ticket.ticketNumber || ticket.id;

    try {
      await navigator.clipboard.writeText(valueToCopy);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setCopied(false);
    }
  }

  if (isLoading) {
    return <TicketDetailsLoading />;
  }

  if (error || !ticket) {
    return (
      <div className="flex min-h-[540px] items-center justify-center" dir="rtl">
        <section
          className="
            w-full max-w-xl rounded-2xl
            border border-[var(--danger)]/20
            bg-[var(--danger-soft)] p-7 text-center
            shadow-[0_20px_60px_var(--shadow-color)]
          "
        >
          <div
            className="
              mx-auto flex h-14 w-14 items-center justify-center
              rounded-2xl bg-[var(--danger-soft)]
              text-[var(--danger)]
            "
          >
            <AlertCircle className="h-7 w-7" />
          </div>

          <h1 className="mt-5 text-xl font-bold text-[var(--foreground)]">
            دریافت تیکت ناموفق بود
          </h1>

          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            {error || 'تیکت مورد نظر یافت نشد یا امکان دریافت آن وجود ندارد.'}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => void loadTicket(true)}
              className="
                inline-flex h-11 items-center justify-center gap-2 rounded-xl
                bg-[var(--primary)] px-4 text-sm font-semibold
                text-[var(--primary-foreground)] transition-opacity
                hover:opacity-90
              "
            >
              <RefreshCcw className="h-4 w-4" />
              تلاش مجدد
            </button>

            <Link
              href="/support"
              className="
                inline-flex h-11 items-center justify-center gap-2 rounded-xl
                border border-[var(--border)] bg-[var(--surface-muted)]
                px-4 text-sm font-medium text-[var(--foreground)]
                transition-colors hover:bg-[var(--surface-hover)]
              "
            >
              <ArrowRight className="h-4 w-4" />
              بازگشت به تیکت‌ها
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div dir="rtl" className="mx-auto max-w-7xl space-y-6 text-[var(--foreground)]">
      <section
        className="
          flex flex-col gap-4 border-b border-[var(--border)] pb-5
          lg:flex-row lg:items-center lg:justify-between
        "
      >
        <div className="space-y-4">
          <Link
            href="/support"
            className="
              inline-flex items-center gap-2 text-sm
              text-[var(--muted)] transition-colors
              hover:text-[var(--foreground)]
            "
          >
            <ArrowRight className="h-4 w-4" />
            بازگشت به فهرست تیکت‌ها
          </Link>

          <div className="flex items-start gap-4">
            <div
              className="
                rounded-2xl border border-[var(--primary)]/20
                bg-[var(--primary-soft)] p-3
                text-[var(--primary)]
              "
            >
              <Ticket className="h-7 w-7" />
            </div>

            <div>
              {ticket.project && (
                <Link
                  href={`/support/projects/${encodeURIComponent(ticket.project.id)}`}
                  className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] hover:underline"
                >
                  {uiMessage(locale, 'supportProjectLabel')}
                  <span>{ticket.project.name}</span>
                  <span dir="ltr" className="font-mono text-[10px]">({ticket.project.code})</span>
                </Link>
              )}
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className="
                    rounded-full border border-[var(--warning)]/20
                    bg-[var(--warning-soft)] px-3 py-1
                    text-xs font-medium text-[var(--warning)]
                  "
                >
                  جزئیات تیکت
                </span>

                <span
                  className={`
                    inline-flex items-center gap-1.5 rounded-full border
                    px-3 py-1 text-xs font-medium
                    ${getStatusClassName(ticket.status)}
                  `}
                >
                  {getStatusIcon(ticket.status)}
                  {getStatusLabel(ticket.status)}
                </span>

                <span
                  className={`
                    rounded-full border px-3 py-1 text-xs font-medium
                    ${getPriorityClassName(ticket.priority)}
                  `}
                >
                  اولویت {getPriorityLabel(ticket.priority)}
                </span>
              </div>

              <h1 className="text-2xl font-bold leading-10 text-[var(--foreground)] sm:text-3xl">
                {ticket.title}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
                <span className="inline-flex items-center gap-1.5">
                  <Clipboard className="h-4 w-4" />
                  {ticket.ticketNumber || ticket.id}
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  ثبت در {formatShortDate(ticket.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={copyTicketNumber}
            className="
              inline-flex h-11 items-center justify-center gap-2 rounded-xl
              border border-[var(--border)] bg-[var(--surface-muted)]
              px-4 text-sm font-medium text-[var(--foreground)]
              transition-colors hover:bg-[var(--surface-hover)]
            "
          >
            {copied ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
                کپی شد
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                کپی شناسه
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => void loadTicket(true)}
            disabled={isRefreshing}
            className="
              inline-flex h-11 items-center justify-center gap-2 rounded-xl
              bg-[var(--primary)] px-4 text-sm font-semibold
              text-[var(--primary-foreground)] transition-opacity
              hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60
            "
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            بروزرسانی
          </button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="space-y-6 xl:col-span-2">
          <Panel
            icon={<FileText className="h-5 w-5" />}
            title="شرح درخواست"
            description="اطلاعات ثبت‌شده برای پیگیری و رسیدگی به تیکت"
          >
            <div
              className="
                rounded-xl border border-[var(--border)]
                bg-[var(--background)] p-5
              "
            >
              <p className="whitespace-pre-wrap text-sm leading-8 text-[var(--foreground)]">
                {ticket.description || 'برای این تیکت توضیحات تکمیلی ثبت نشده است.'}
              </p>
            </div>
          </Panel>

          <Panel
            icon={<Clock3 className="h-5 w-5" />}
            title="وضعیت عملیاتی"
            description="نمای فعلی تیکت در چرخه رسیدگی پشتیبانی"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <InfoCard
                title="وضعیت فعلی"
                value={getStatusLabel(ticket.status)}
                icon={getStatusIcon(ticket.status)}
                className={getStatusClassName(ticket.status)}
              />

              <InfoCard
                title="سطح اولویت"
                value={getPriorityLabel(ticket.priority)}
                icon={<ShieldAlert className="h-4 w-4" />}
                className={getPriorityClassName(ticket.priority)}
              />

              <InfoCard
                title="منبع ثبت"
                value={getSourceLabel(ticket.source)}
                icon={<Ticket className="h-4 w-4" />}
                className="border-[var(--primary)]/20 bg-[var(--primary-soft)] text-[var(--primary)]"
              />
            </div>
          </Panel>

          <Panel
            icon={<CalendarDays className="h-5 w-5" />}
            title="زمان‌بندی و ثبت"
            description="تاریخ‌های کلیدی برای گزارش‌گیری و رهگیری تیکت"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <DetailRow
                icon={<CalendarDays className="h-4 w-4" />}
                label="تاریخ و ساعت ثبت"
                value={formatDateTime(ticket.createdAt)}
              />

              <DetailRow
                icon={<RefreshCcw className="h-4 w-4" />}
                label="آخرین بروزرسانی"
                value={formatDateTime(ticket.updatedAt)}
              />

              <DetailRow
                icon={<Clipboard className="h-4 w-4" />}
                label="شماره تیکت"
                value={ticket.ticketNumber || '-'}
                direction="ltr"
              />

              <DetailRow
                icon={<Ticket className="h-4 w-4" />}
                label="شناسه سیستمی"
                value={ticket.id}
                direction="ltr"
              />
            </div>
          </Panel>
        </section>

        <aside className="space-y-6">
          <Panel
            icon={<UserRound className="h-5 w-5" />}
            title="اطلاعات مشتری"
            description="مشخصات ثبت‌شده برای مشتری این درخواست"
          >
            <div className="space-y-4">
              <DetailRow
                icon={<UserRound className="h-4 w-4" />}
                label="نام مشتری"
                value={ticket.customer?.name || ticket.customerName || '-'}
              />

              <DetailRow
                icon={<Phone className="h-4 w-4" />}
                label="شماره تماس"
                value={ticket.customer?.phone || ticket.customerPhone || '-'}
                direction="ltr"
              />

              <DetailRow
                icon={<Mail className="h-4 w-4" />}
                label="ایمیل مشتری"
                value={ticket.customer?.email || '-'}
                direction="ltr"
              />

              {ticket.customer?.id ? (
                <DetailRow
                  icon={<Clipboard className="h-4 w-4" />}
                  label="شناسه مشتری"
                  value={ticket.customer.id}
                  direction="ltr"
                />
              ) : null}
            </div>
          </Panel>

          <Panel
            icon={<UserRound className="h-5 w-5" />}
            title="ثبت‌کننده تیکت"
            description="کاربری که درخواست را در سیستم ثبت کرده است"
          >
            <div className="space-y-4">
              <DetailRow
                icon={<UserRound className="h-4 w-4" />}
                label="نام کاربر"
                value={getCreatorName(ticket)}
              />

              <DetailRow
                icon={<Mail className="h-4 w-4" />}
                label="ایمیل کاربر"
                value={ticket.creator?.email || '-'}
                direction="ltr"
              />
            </div>
          </Panel>

          <section
            className="
              rounded-2xl border border-[var(--primary)]/15
              bg-gradient-to-br from-[var(--primary-soft)] to-[var(--surface-muted)]
              p-5
            "
          >
            <div className="flex items-start gap-3">
              <div
                className="
                  rounded-xl bg-[var(--primary-soft)] p-2
                  text-[var(--primary)]
                "
              >
                <Clock3 className="h-5 w-5" />
              </div>

              <div>
                <h2 className="font-semibold text-[var(--foreground)]">
                  چرخه رسیدگی
                </h2>

                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                  در گام بعدی، امکان تغییر وضعیت، ارجاع تیکت و ثبت پیام‌های
                  پیگیری به این بخش افزوده می‌شود.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Panel({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      className="
        rounded-2xl border border-[var(--border)]
        bg-[var(--surface)] p-5
        shadow-[0_20px_60px_var(--shadow-color)] sm:p-6
      "
    >
      <header className="mb-5 flex items-start gap-3">
        <div
          className="
            rounded-xl border border-[var(--border)]
            bg-[var(--surface-muted)] p-2.5
            text-[var(--foreground)]
          "
        >
          {icon}
        </div>

        <div>
          <h2 className="font-semibold text-[var(--foreground)]">{title}</h2>

          {description ? (
            <p className="mt-1 text-xs leading-6 text-[var(--muted)]">
              {description}
            </p>
          ) : null}
        </div>
      </header>

      {children}
    </section>
  );
}

function DetailRow({
  icon,
  label,
  value,
  direction = 'rtl',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  direction?: 'rtl' | 'ltr';
}) {
  return (
    <div
      className="
        rounded-xl border border-[var(--border)]
        bg-[var(--background)] p-3.5
      "
    >
      <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
        <span className="opacity-70">{icon}</span>
        {label}
      </div>

      <p
        dir={direction}
        className={`
          mt-2 break-words text-sm font-medium
          text-[var(--foreground)]
          ${direction === 'ltr' ? 'text-left' : 'text-right'}
        `}
      >
        {value}
      </p>
    </div>
  );
}

function InfoCard({
  title,
  value,
  icon,
  className,
}: {
  title: string;
  value: string;
  icon: ReactNode;
  className: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${className}`}>
      <div className="flex items-center gap-2 text-xs opacity-80">
        {icon}
        {title}
      </div>

      <p className="mt-3 text-lg font-bold">{value}</p>
    </div>
  );
}

function TicketDetailsLoading() {
  return (
    <div className="space-y-6 animate-pulse" dir="rtl">
      <div className="h-36 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]" />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <div className="h-64 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]" />
          <div className="h-44 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]" />
        </div>

        <div className="space-y-6">
          <div className="h-80 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]" />
          <div className="h-56 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]" />
        </div>
      </div>
    </div>
  );
}
