/**
 * مسیر فایل:
 * frontend/src/app/(workspace)/accounting/[id]/page.tsx
 *
 * هدف:
 * نمایش و مدیریت جزئیات یک فاکتور حسابداری.
 *
 * ویژگی‌ها:
 * - دریافت شناسه فاکتور از route parameter
 * - دریافت اطلاعات از accountingApi.getInvoiceById
 * - نمایش اطلاعات اصلی فاکتور
 * - نمایش اقلام و جمع مبالغ
 * - نمایش تاریخچه تغییر وضعیت
 * - نمایش پرداخت‌های ثبت‌شده
 * - تغییر وضعیت فاکتور
 * - تأیید یا رد فاکتور
 * - ثبت پرداخت
 * - مدیریت loading، خطا و not-found
 *
 * endpointهای مورد انتظار:
 * GET   /accounting/invoices/:id
 * PATCH /accounting/invoices/:id/status
 * POST  /accounting/invoices/:id/payments
 */

"use client";

import { getCalendarLocale } from '@/lib/calendar';
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  FileText,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  accountingApi,
  ApiClientError,
} from "@/app/(workspace)/accounting/accounting-api";

import type {
  AccountingDetail,
  AccountingDocumentStatus,
  AccountingPayment,
  AccountingPriority,
  PaymentMethod,
} from "@/app/(workspace)/accounting/types";
import { getLocaleDirection, usePreferences } from "@/components/preferences-provider";
import { useAccountingAccess } from "../accounting-access-context";

const STATUS_OPTIONS: Array<{
  value: AccountingDocumentStatus;
  label: string;
}> = [
  { value: "draft", label: "پیش‌نویس" },
  { value: "submitted", label: "ارسال‌شده" },
  { value: "pending_review", label: "در انتظار بررسی" },
  { value: "approved", label: "تأییدشده" },
  { value: "rejected", label: "ردشده" },
  { value: "in_progress", label: "در حال اجرا" },
  { value: "completed", label: "تکمیل‌شده" },
  { value: "cancelled", label: "لغوشده" },
];

const PAYMENT_METHOD_OPTIONS: Array<{
  value: PaymentMethod;
  label: string;
}> = [
  { value: "bank_transfer", label: "واریز بانکی" },
  { value: "cash", label: "نقدی" },
  { value: "cheque", label: "چک" },
  { value: "card", label: "کارت" },
  { value: "online", label: "آنلاین" },
  { value: "other", label: "سایر" },
];

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function formatCurrency(
  amount: number,
  currency = "IRR",
): string {
  const currencyLabels: Record<string, string> = {
    IRR: "ریال",
    toman: "تومان",
    تومان: "تومان",
    USD: "دلار",
    EUR: "یورو",
  };

  return `${formatNumber(amount)} ${
    currencyLabels[currency] ?? currency
  }`;
}

function formatDate(value?: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(getCalendarLocale("fa-IR"), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStatusLabel(
  status: AccountingDocumentStatus,
): string {
  return (
    STATUS_OPTIONS.find((item) => item.value === status)
      ?.label ?? status
  );
}

function getPriorityLabel(
  priority: AccountingPriority,
): string {
  const labels: Record<AccountingPriority, string> = {
    LOW: "کم",
    MEDIUM: "متوسط",
    HIGH: "زیاد",
    URGENT: "فوری",
  };

  return labels[priority] ?? priority;
}

function getStatusClassName(
  status: AccountingDocumentStatus,
): string {
  switch (status) {
    case "approved":
      return "bg-[var(--success-soft)] text-[var(--success)] ring-[color-mix(in_srgb,var(--success)_35%,var(--border))]";

    case "completed":
      return "bg-[var(--primary-soft)] text-[var(--primary)] ring-[color-mix(in_srgb,var(--primary)_35%,var(--border))]";

    case "rejected":
    case "cancelled":
      return "bg-[var(--danger-soft)] text-[var(--danger)] ring-[color-mix(in_srgb,var(--danger)_35%,var(--border))]";

    case "submitted":
    case "pending_review":
      return "bg-[var(--warning-soft)] text-[var(--warning)] ring-[color-mix(in_srgb,var(--warning)_35%,var(--border))]";

    case "in_progress":
      return "bg-[var(--primary-soft)] text-[var(--primary)] ring-[color-mix(in_srgb,var(--primary)_35%,var(--border))]";

    case "draft":
    default:
      return "bg-[var(--surface-muted)] text-[var(--muted-foreground)] ring-[var(--border)]";
  }
}

function getPriorityClassName(
  priority: AccountingPriority,
): string {
  switch (priority) {
    case "URGENT":
      return "bg-[var(--danger-soft)] text-[var(--danger)] ring-[color-mix(in_srgb,var(--danger)_35%,var(--border))]";

    case "HIGH":
      return "bg-[var(--warning-soft)] text-[var(--warning)] ring-[color-mix(in_srgb,var(--warning)_35%,var(--border))]";

    case "LOW":
      return "bg-[var(--surface-muted)] text-[var(--muted-foreground)] ring-[var(--border)]";

    case "MEDIUM":
    default:
      return "bg-[var(--primary-soft)] text-[var(--primary)] ring-[color-mix(in_srgb,var(--primary)_35%,var(--border))]";
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "دریافت اطلاعات فاکتور با خطا مواجه شد.";
}

function getActorName(
  actor?: {
    fullName?: string | null;
    username?: string | null;
  } | null,
): string {
  if (!actor) {
    return "—";
  }

  return actor.fullName || actor.username || "کاربر سیستم";
}

function getPaymentMethodLabel(
  method?: PaymentMethod | null,
): string {
  if (!method) {
    return "—";
  }

  return (
    PAYMENT_METHOD_OPTIONS.find(
      (item) => item.value === method,
    )?.label ?? method
  );
}

export default function AccountingInvoiceDetailPage() {
  const { locale } = usePreferences();
  const { canManage } = useAccountingAccess();
  const params = useParams<{ id: string }>();

  const invoiceId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [invoice, setInvoice] =
    useState<AccountingDetail | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] =
    useState(false);
  const [isRegisteringPayment, setIsRegisteringPayment] =
    useState(false);

  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] =
    useState<string | null>(null);

  const [selectedStatus, setSelectedStatus] =
    useState<AccountingDocumentStatus>("pending_review");

  const [statusNote, setStatusNote] = useState("");

  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("bank_transfer");
  const [paymentReference, setPaymentReference] =
    useState("");
  const [paymentNote, setPaymentNote] = useState("");

  const loadInvoice = useCallback(
    async (refresh = false) => {
      if (!invoiceId) {
        setError("شناسه فاکتور معتبر نیست.");
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

        const result =
          await accountingApi.getInvoiceById(invoiceId);

        setInvoice(result);

        if (result?.status) {
          setSelectedStatus(result.status);
        }
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [invoiceId],
  );

  useEffect(() => {
    void loadInvoice();
  }, [loadInvoice]);

  const calculatedTotals = useMemo(() => {
    if (!invoice) {
      return {
        subtotal: 0,
        taxAmount: 0,
        total: 0,
      };
    }

    let subtotal = 0;
    let total = 0;

    for (const item of invoice.lineItems ?? []) {
      const lineSubtotal =
        Number(item.quantity) * Number(item.unitPrice);

      const taxRate = Number(item.taxRate ?? 0);
      const lineTotal =
        lineSubtotal * (1 + taxRate / 100);

      subtotal += lineSubtotal;
      total += Number.isFinite(item.total ?? NaN)
        ? Number(item.total)
        : lineTotal;
    }

    return {
      subtotal,
      taxAmount: total - subtotal,
      total,
    };
  }, [invoice]);

  const paidTotal = useMemo(() => {
    if (!invoice?.payments) {
      return 0;
    }

    return invoice.payments.reduce(
      (sum, payment) => sum + Number(payment.paidAmount),
      0,
    );
  }, [invoice]);

  const remainingAmount = Math.max(
    0,
    Number(invoice?.totalAmount ?? calculatedTotals.total) -
      paidTotal,
  );

  async function handleStatusUpdate(
    nextStatus?: AccountingDocumentStatus,
  ) {
    if (!invoice) {
      return;
    }

    const status = nextStatus ?? selectedStatus;

    if (!status) {
      setActionError("وضعیت جدید را انتخاب کنید.");
      return;
    }

    try {
      setIsUpdatingStatus(true);
      setActionError(null);

      const updatedInvoice =
        await accountingApi.updateInvoiceStatus(
          invoice.id,
          {
            status,
            note: statusNote.trim() || undefined,
          },
        );

      setInvoice(updatedInvoice);
      setSelectedStatus(updatedInvoice.status);
      setStatusNote("");
    } catch (updateError) {
      setActionError(getErrorMessage(updateError));
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleRegisterPayment() {
    if (!invoice) {
      return;
    }

    const amount = Number(
      paidAmount.replace(/,/g, "").trim(),
    );

    if (!Number.isFinite(amount) || amount <= 0) {
      setActionError(
        "مبلغ پرداخت باید بیشتر از صفر باشد.",
      );
      return;
    }

    if (amount > remainingAmount) {
      setActionError(
        "مبلغ پرداخت نمی‌تواند بیشتر از مانده فاکتور باشد.",
      );
      return;
    }

    try {
      setIsRegisteringPayment(true);
      setActionError(null);

      const updatedInvoice =
        await accountingApi.registerPayment(
          invoice.id,
          {
            paidAmount: amount,
            method: paymentMethod,
            referenceNumber:
              paymentReference.trim() || undefined,
            note: paymentNote.trim() || undefined,
          },
        );

      setInvoice(updatedInvoice);
      setPaidAmount("");
      setPaymentReference("");
      setPaymentNote("");
    } catch (paymentError) {
      setActionError(getErrorMessage(paymentError));
    } finally {
      setIsRegisteringPayment(false);
    }
  }

  function renderPayment(payment: AccountingPayment) {
    return (
      <div
        key={payment.id}
        className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4"
      >
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">
              مبلغ پرداخت
            </p>

            <p className="mt-1 font-bold text-[var(--foreground)]">
              {formatCurrency(
                payment.paidAmount,
                invoice?.currency,
              )}
            </p>
          </div>

          <div>
            <p className="text-xs text-[var(--muted-foreground)]">
              روش پرداخت
            </p>

            <p className="mt-1 text-[var(--foreground)]">
              {getPaymentMethodLabel(payment.method)}
            </p>
          </div>

          <div>
            <p className="text-xs text-[var(--muted-foreground)]">
              تاریخ پرداخت
            </p>

            <p className="mt-1 text-[var(--foreground)]">
              {formatDate(payment.paidAt)}
            </p>
          </div>

          <div>
            <p className="text-xs text-[var(--muted-foreground)]">
              شماره پیگیری
            </p>

            <p className="mt-1 text-[var(--foreground)]">
              {payment.referenceNumber || "—"}
            </p>
          </div>
        </div>

        {payment.note && (
          <p className="mt-3 border-t border-[var(--border)] pt-3 text-sm text-[var(--muted-foreground)]">
            {payment.note}
          </p>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <main
        dir={getLocaleDirection(locale)}
        className="flex min-h-full items-center justify-center bg-[var(--background)] p-6 text-[var(--foreground)]"
      >
        <div className="flex flex-col items-center gap-3 text-[var(--muted-foreground)]">
          <RefreshCw
            size={26}
            className="animate-spin text-[var(--primary)]"
          />

          <p className="text-sm">
            در حال دریافت اطلاعات فاکتور...
          </p>
        </div>
      </main>
    );
  }

  if (error || !invoice) {
    return (
      <main
        dir={getLocaleDirection(locale)}
        className="flex min-h-full items-center justify-center bg-[var(--background)] p-6 text-[var(--foreground)]"
      >
        <div className="surface-card max-w-md rounded-2xl p-8 text-center">
          <div className="mx-auto mb-4 w-fit rounded-full bg-[var(--danger-soft)] p-3 text-[var(--danger)]">
            <AlertCircle size={25} />
          </div>

          <h1 className="font-bold text-[var(--foreground)]">
            فاکتور پیدا نشد
          </h1>

          <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
            {error ||
              "اطلاعات این فاکتور در دسترس نیست."}
          </p>

          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => void loadInvoice()}
              className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
            >
              تلاش مجدد
            </button>

            <Link
              href="/accounting/invoices"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-hover)]"
            >
              بازگشت
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      dir={getLocaleDirection(locale)}
      className="min-h-full space-y-6 bg-[var(--background)] p-4 text-[var(--foreground)] md:p-6"
    >
      <section className="surface-card rounded-2xl p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              href="/accounting/invoices"
              className="mb-3 inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] transition hover:text-[var(--primary)]"
            >
              <ArrowRight size={16} />
              بازگشت به حسابداری
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold text-[var(--foreground)]">
                {invoice.title}
              </h1>

              <span className="rounded-lg bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)]">
                {invoice.documentNumber}
              </span>

              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${getStatusClassName(
                  invoice.status,
                )}`}
              >
                {getStatusLabel(invoice.status)}
              </span>

              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${getPriorityClassName(
                  invoice.priority,
                )}`}
              >
                اولویت: {getPriorityLabel(invoice.priority)}
              </span>
            </div>

            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              ایجادشده در {formatDate(invoice.createdAt)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadInvoice(true)}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={
                isRefreshing ? "animate-spin" : undefined
              }
            />
            به‌روزرسانی
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="surface-card rounded-2xl p-5">
          <p className="text-sm text-[var(--muted-foreground)]">
            مبلغ کل
          </p>

          <p className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {formatCurrency(
              invoice.totalAmount ||
                calculatedTotals.total,
              invoice.currency,
            )}
          </p>
        </div>

        <div className="surface-card rounded-2xl p-5">
          <p className="text-sm text-[var(--muted-foreground)]">
            پرداخت‌شده
          </p>

          <p className="mt-2 text-xl font-bold text-[var(--success)]">
            {formatCurrency(
              paidTotal,
              invoice.currency,
            )}
          </p>
        </div>

        <div className="surface-card rounded-2xl p-5">
          <p className="text-sm text-[var(--muted-foreground)]">
            مانده
          </p>

          <p className="mt-2 text-xl font-bold text-[var(--warning)]">
            {formatCurrency(
              remainingAmount,
              invoice.currency,
            )}
          </p>
        </div>

        <div className="surface-card rounded-2xl p-5">
          <p className="text-sm text-[var(--muted-foreground)]">
            تاریخ سررسید
          </p>

          <p className="mt-2 text-base font-bold text-[var(--foreground)]">
            {formatDate(invoice.dueDate)}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="surface-card rounded-2xl p-5">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-[var(--foreground)]">
              <FileText
                size={20}
                className="text-[var(--primary)]"
              />
              اطلاعات فاکتور
            </h2>

            <div className="grid grid-cols-1 gap-5 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  تأمین‌کننده
                </p>

                <p className="mt-1 text-[var(--foreground)]">
                  {invoice.vendorName || "—"}
                </p>
              </div>

              <div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  ایجادکننده
                </p>

                <p className="mt-1 text-[var(--foreground)]">
                  {getActorName(invoice.createdBy)}
                </p>
              </div>

              <div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  شعبه
                </p>

                <p className="mt-1 text-[var(--foreground)]">
                  {invoice.branchName || "—"}
                </p>
              </div>

              <div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  دپارتمان
                </p>

                <p className="mt-1 text-[var(--foreground)]">
                  {invoice.departmentName || "—"}
                </p>
              </div>

              <div className="sm:col-span-2">
                <p className="text-xs text-[var(--muted-foreground)]">
                  توضیحات
                </p>

                <p className="mt-1 whitespace-pre-wrap leading-7 text-[var(--foreground)]">
                  {invoice.description || "—"}
                </p>
              </div>
            </div>
          </section>

          <section className="surface-card overflow-hidden rounded-2xl">
            <div className="border-b border-[var(--border)] p-5">
              <h2 className="text-lg font-bold text-[var(--foreground)]">
                اقلام فاکتور
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[700px] w-full text-right">
                <thead className="bg-[var(--surface-muted)]">
                  <tr className="border-b border-[var(--border)] text-xs text-[var(--muted-foreground)]">
                    <th className="px-5 py-4 font-medium">
                      شرح
                    </th>

                    <th className="px-5 py-4 font-medium">
                      تعداد
                    </th>

                    <th className="px-5 py-4 font-medium">
                      قیمت واحد
                    </th>

                    <th className="px-5 py-4 font-medium">
                      مالیات
                    </th>

                    <th className="px-5 py-4 font-medium">
                      مبلغ کل
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--border)]">
                  {invoice.lineItems?.map((item, index) => {
                    const quantity = Number(item.quantity);
                    const unitPrice = Number(item.unitPrice);
                    const taxRate = Number(item.taxRate ?? 0);

                    const subtotal =
                      quantity * unitPrice;

                    const calculatedTotal =
                      subtotal * (1 + taxRate / 100);

                    const itemTotal =
                      item.total ?? calculatedTotal;

                    return (
                      <tr key={item.id ?? index}>
                        <td className="px-5 py-4 text-sm text-[var(--foreground)]">
                          {item.description}
                        </td>

                        <td className="px-5 py-4 text-sm text-[var(--muted-foreground)]">
                          {formatNumber(quantity)}
                        </td>

                        <td className="px-5 py-4 text-sm text-[var(--muted-foreground)]">
                          {formatCurrency(
                            unitPrice,
                            invoice.currency,
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm text-[var(--muted-foreground)]">
                          {formatNumber(taxRate)}٪
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-[var(--foreground)]">
                          {formatCurrency(
                            itemTotal,
                            invoice.currency,
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 border-t border-[var(--border)] p-5">
              <div className="flex justify-between text-sm text-[var(--muted-foreground)]">
                <span>جمع قبل از مالیات</span>
                <span>
                  {formatCurrency(
                    calculatedTotals.subtotal,
                    invoice.currency,
                  )}
                </span>
              </div>

              <div className="flex justify-between text-sm text-[var(--muted-foreground)]">
                <span>مالیات</span>
                <span>
                  {formatCurrency(
                    calculatedTotals.taxAmount,
                    invoice.currency,
                  )}
                </span>
              </div>

              <div className="flex justify-between border-t border-[var(--border)] pt-3 font-bold text-[var(--foreground)]">
                <span>مبلغ نهایی</span>
                <span>
                  {formatCurrency(
                    invoice.totalAmount ||
                      calculatedTotals.total,
                    invoice.currency,
                  )}
                </span>
              </div>
            </div>
          </section>

          <section className="surface-card rounded-2xl p-5">
            <h2 className="mb-5 text-lg font-bold text-[var(--foreground)]">
              تاریخچه وضعیت
            </h2>

            {invoice.statusHistory?.length ? (
              <div className="space-y-4">
                {invoice.statusHistory.map((history) => (
                  <div
                    key={history.id}
                    className="relative border-r-2 border-[color-mix(in_srgb,var(--primary)_25%,var(--border))] pe-5"
                  >
                    <div className="absolute -right-[7px] top-1 h-3 w-3 rounded-full bg-[var(--primary)] ring-4 ring-[var(--primary-soft)]" />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${getStatusClassName(
                          history.status,
                        )}`}
                      >
                        {getStatusLabel(history.status)}
                      </span>

                      <span className="text-xs text-[var(--muted-foreground)]">
                        {formatDate(history.createdAt)}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                      انجام‌دهنده:{" "}
                      {getActorName(history.actedBy)}
                    </p>

                    {history.note && (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]">
                        {history.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">
                هنوز تاریخچه‌ای برای این فاکتور ثبت نشده است.
              </p>
            )}
          </section>
        </div>

        {canManage && <aside className="space-y-6">
          <section className="surface-card rounded-2xl p-5">
            <h2 className="mb-4 text-lg font-bold text-[var(--foreground)]">
              عملیات وضعیت
            </h2>

            <div className="space-y-3">
              <select
                value={selectedStatus}
                onChange={(event) =>
                  setSelectedStatus(
                    event.target.value as AccountingDocumentStatus,
                  )
                }
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>

              <textarea
                value={statusNote}
                onChange={(event) =>
                  setStatusNote(event.target.value)
                }
                rows={3}
                placeholder="یادداشت تغییر وضعیت، اختیاری"
                className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              />

              <button
                type="button"
                onClick={() =>
                  void handleStatusUpdate()
                }
                disabled={isUpdatingStatus}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-medium text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send size={16} />
                {isUpdatingStatus
                  ? "در حال ثبت..."
                  : "ثبت وضعیت"}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void handleStatusUpdate("approved")
                  }
                  disabled={isUpdatingStatus}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--success)_35%,var(--border))] bg-[var(--success-soft)] px-3 py-2.5 text-xs font-medium text-[var(--success)] transition hover:brightness-95 disabled:opacity-60"
                >
                  <CheckCircle2 size={15} />
                  تأیید
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void handleStatusUpdate("rejected")
                  }
                  disabled={isUpdatingStatus}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[var(--danger-soft)] px-3 py-2.5 text-xs font-medium text-[var(--danger)] transition hover:brightness-95 disabled:opacity-60"
                >
                  <XCircle size={15} />
                  رد
                </button>
              </div>
            </div>
          </section>

          <section className="surface-card rounded-2xl p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[var(--foreground)]">
              <CreditCard
                size={20}
                className="text-[var(--primary)]"
              />
              ثبت پرداخت
            </h2>

            <div className="space-y-3">
              <div className="rounded-xl bg-[var(--surface-muted)] p-3 text-sm">
                <div className="flex justify-between text-[var(--muted-foreground)]">
                  <span>مانده قابل پرداخت</span>
                  <span className="font-bold text-[var(--foreground)]">
                    {formatCurrency(
                      remainingAmount,
                      invoice.currency,
                    )}
                  </span>
                </div>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-[var(--foreground)]">
                  مبلغ پرداخت
                </span>

                <input
                  inputMode="decimal"
                  value={paidAmount}
                  onChange={(event) => {
                    const value = event.target.value;

                    if (
                      value === "" ||
                      /^\d*([.]\d*)?$/.test(value)
                    ) {
                      setPaidAmount(value);
                    }
                  }}
                  placeholder="0"
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-[var(--foreground)]">
                  روش پرداخت
                </span>

                <select
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(
                      event.target.value as PaymentMethod,
                    )
                  }
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                >
                  {PAYMENT_METHOD_OPTIONS.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-[var(--foreground)]">
                  شماره پیگیری
                </span>

                <input
                  value={paymentReference}
                  onChange={(event) =>
                    setPaymentReference(
                      event.target.value,
                    )
                  }
                  placeholder="اختیاری"
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-[var(--foreground)]">
                  توضیحات پرداخت
                </span>

                <textarea
                  value={paymentNote}
                  onChange={(event) =>
                    setPaymentNote(event.target.value)
                  }
                  rows={3}
                  placeholder="اختیاری"
                  className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                />
              </label>

              <button
                type="button"
                onClick={() =>
                  void handleRegisterPayment()
                }
                disabled={
                  isRegisteringPayment ||
                  remainingAmount <= 0
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--success)] px-4 py-3 text-sm font-medium text-white transition hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CreditCard size={16} />
                {isRegisteringPayment
                  ? "در حال ثبت..."
                  : "ثبت پرداخت"}
              </button>
            </div>
          </section>

          {actionError && (
            <div className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[var(--danger-soft)] p-4 text-sm leading-6 text-[var(--danger)]">
              {actionError}
            </div>
          )}
        </aside>}
      </section>

      <section className="surface-card rounded-2xl p-5">
        <h2 className="mb-5 text-lg font-bold text-[var(--foreground)]">
          پرداخت‌های ثبت‌شده
        </h2>

        {invoice.payments?.length ? (
          <div className="space-y-3">
            {invoice.payments.map((payment) =>
              renderPayment(payment),
            )}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">
            هنوز پرداختی برای این فاکتور ثبت نشده است.
          </p>
        )}
      </section>
    </main>
  );
}
