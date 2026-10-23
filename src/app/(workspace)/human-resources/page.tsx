/**
 * مسیر فایل:
 * src/app/(workspace)/hr/page.tsx
 *
 * داشبورد منابع انسانی (HR) بر اساس استاندارد مینیمال ERP Pro:
 * - شروع مستقیم با ۴ کارت شاخص عملکرد (KPIs)
 * - تب‌بندی تفکیک‌شده برای پرسنل و مرخصی‌ها
 * - ابزارهای جستجو، فیلتر و دکمه به‌روزرسانی در نوار ابزار
 * - قابلیت ثبت کارمند جدید تکی و ورود گروهی کارکنان (JSON)
 */

"use client";

import { getCalendarLocale } from '@/lib/calendar';
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertCircle,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Clock,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Upload,
  UserCheck,
  UserMinus,
  Users,
  XCircle,
} from "lucide-react";

import { ApiClientError, humanResourcesApi } from "@/app/(workspace)/human-resources/human-resources-api";
import type {
  CreateEmployeePayload,
  CreateLeaveRequestPayload,
  CreateBusinessTripRequestPayload,
  BusinessTripRequest,
  Employee,
  EmployeeListQuery,
  EmployeeStatus,
  EmploymentType,
  HrDashboardSummary,
  HrAccess,
  HrReferenceData,
  LeaveRequest,
  LeaveRequestListQuery,
  LeaveRequestStatus,
  LeaveType,
} from "@/app/(workspace)/human-resources/types";

import {
  employeeStatusLabels,
  employmentTypeLabels,
  getEmployeeName,
} from "./employees/hr-utils";
import { HrEmployeeStatusBadge, HrLeaveStatusBadge } from "./employees/hr-badges";
import { EmployeeFormModal } from "./employees/employee-form-modal";
import { EmployeeImportModal } from "./employees/employee-import-modal";
import { usePreferences } from "@/components/preferences-provider";
import { uiMessage } from "@/lib/ui-messages";
import type { UiMessage } from "@/languages/types";
import type { Locale } from "@/languages";

type HrTab = "overview" | "employees" | "leaves";
type HrRequestKind = "leave" | "mission";

const leaveTypeMessageKeys: Record<LeaveType, UiMessage> = {
  ANNUAL: "hrLeaveAnnual", SICK: "hrLeaveSick", UNPAID: "hrLeaveUnpaid", HOURLY: "hrLeaveHourly",
  MATERNITY: "hrLeaveMaternity", PATERNITY: "hrLeavePaternity", OTHER: "hrLeaveOther",
};
const requestStatusMessageKeys: Record<LeaveRequestStatus, UiMessage> = {
  DRAFT: "hrStatusDraft", PENDING: "hrLeavePending", APPROVED: "hrLeaveApproved",
  REJECTED: "hrLeaveRejected", CANCELLED: "hrRequestStatusCancelled",
};
function formatHrDate(value: string | null | undefined, locale: Locale) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(getCalendarLocale(locale), { year: "numeric", month: "short", day: "numeric" }).format(date);
}
function formatHrDuration(minutes: number, locale: Locale) {
  if (!minutes || minutes < 1) return "—";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remaining = minutes % 60;
  return [days && `${new Intl.NumberFormat(locale).format(days)} ${uiMessage(locale, "hrDurationDay")}`, hours && `${new Intl.NumberFormat(locale).format(hours)} ${uiMessage(locale, "hrDurationHour")}`, remaining && days === 0 && `${new Intl.NumberFormat(locale).format(remaining)} ${uiMessage(locale, "hrDurationMinute")}`].filter(Boolean).join(" · ") || "—";
}

function formatTripAmount(locale: string, amount: string | number, currency: string) {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount));
  } catch {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Number(amount))} ${currency}`;
  }
}

export default function HrPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = usePreferences();
  const activeTab: HrTab = pathname === "/human-resources/leaves"
    ? "leaves"
    : pathname === "/human-resources/employees"
      ? "employees"
      : "overview";
  const setActiveTab = (tab: HrTab) => {
    router.push(tab === "leaves" ? "/human-resources/leaves" : tab === "employees" ? "/human-resources/employees" : "/human-resources");
  };
  const [dashboard, setDashboard] = useState<HrDashboardSummary | null>(null);
  const [access, setAccess] = useState<HrAccess | null>(null);
  const [referenceData, setReferenceData] = useState<HrReferenceData | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [businessTripRequests, setBusinessTripRequests] = useState<BusinessTripRequest[]>([]);
  const [businessTripLoadError, setBusinessTripLoadError] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // استیت‌های مربوط به مودال‌های ثبت کارمند
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSavingEmployee, setIsSavingEmployee] = useState(false);

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeStatus, setEmployeeStatus] = useState<EmployeeStatus | "ALL">("ALL");
  const [employmentType, setEmploymentType] = useState<EmploymentType | "ALL">("ALL");

  const [leaveStatus, setLeaveStatus] = useState<LeaveRequestStatus | "ALL">("PENDING");
  const [leaveType, setLeaveType] = useState<LeaveType | "ALL">("ALL");

  const [updatingLeaveId, setUpdatingLeaveId] = useState<string | null>(null);
  const [isLeaveFormOpen, setIsLeaveFormOpen] = useState(false);
  const [isSavingLeave, setIsSavingLeave] = useState(false);
  const [newLeave, setNewLeave] = useState({ leaveType: "ANNUAL" as LeaveType, startAt: "", endAt: "", reason: "" });
  const [requestKind, setRequestKind] = useState<HrRequestKind>("leave");
  const [isTripFormOpen, setIsTripFormOpen] = useState(false);
  const [isSavingTrip, setIsSavingTrip] = useState(false);
  const [updatingTripId, setUpdatingTripId] = useState<string | null>(null);
  const [newTrip, setNewTrip] = useState({ destination: "", purpose: "", startAt: "", endAt: "", estimatedCost: "", currency: "IRR" });

  const employeeQuery = useMemo<EmployeeListQuery>(
    () => ({
      search: employeeSearch,
      status: employeeStatus,
      employmentType,
    }),
    [employeeSearch, employeeStatus, employmentType],
  );

  const leaveQuery = useMemo<LeaveRequestListQuery>(
    () => ({
      status: leaveStatus,
      leaveType,
    }),
    [leaveStatus, leaveType],
  );

  const loadDashboard = useCallback(async () => {
    const result = await humanResourcesApi.getDashboard();
    setDashboard(result);
  }, []);

  const loadEmployees = useCallback(async () => {
    setEmployees(await humanResourcesApi.getEmployees(employeeQuery));
  }, [employeeQuery]);

  const loadLeaveRequests = useCallback(async () => {
    const result = await humanResourcesApi.getLeaveRequests(leaveQuery);
    setLeaveRequests(result);
  }, [leaveQuery]);

  const loadBusinessTripRequests = useCallback(async () => {
    try {
      setBusinessTripRequests(await humanResourcesApi.getBusinessTripRequests(leaveStatus));
      setBusinessTripLoadError(false);
    } catch {
      setBusinessTripLoadError(true);
    }
  }, [leaveStatus]);

  const loadAllData = useCallback(
    async (showRefreshState = false) => {
      try {
        setError(null);
        if (showRefreshState) setRefreshing(true);
        else setLoading(true);

        const [, , , , currentAccess] = await Promise.all([
          loadDashboard(), loadEmployees(), loadLeaveRequests(), loadBusinessTripRequests(), humanResourcesApi.getAccess(),
        ]);
        setAccess(currentAccess);
      } catch (requestError) {
        if (requestError instanceof ApiClientError) {
          setError(requestError.message);
        } else {
          setError("دریافت اطلاعات منابع انسانی با خطای غیرمنتظره مواجه شد.");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadDashboard, loadEmployees, loadLeaveRequests, loadBusinessTripRequests],
  );

  useEffect(() => {
    void loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    let cancelled = false;
    if (!access?.canManageEmployees) {
      setReferenceData(null);
      return;
    }
    humanResourcesApi.getReferenceData()
      .then((result) => { if (!cancelled) setReferenceData(result); })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "دریافت فهرست‌های سازمانی ناموفق بود.");
      });
    return () => { cancelled = true; };
  }, [access?.canManageEmployees]);

  // ثبت کارمند جدید و بروزرسانی داده‌های صفحه
  const handleCreateEmployee = async (payload: CreateEmployeePayload) => {
    try {
      setIsSavingEmployee(true);
      setError(null);
      await humanResourcesApi.createEmployee(payload);
      await Promise.all([loadDashboard(), loadEmployees()]);
    } finally {
      setIsSavingEmployee(false);
    }
  };

  const handleCreateLeaveRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!access?.employeeId) return;
    try {
      setIsSavingLeave(true);
      setError(null);
      const payload: CreateLeaveRequestPayload = {
        employeeId: access.employeeId,
        leaveType: newLeave.leaveType,
        startAt: new Date(newLeave.startAt).toISOString(),
        endAt: new Date(newLeave.endAt).toISOString(),
        reason: newLeave.reason.trim() || undefined,
      };
      await humanResourcesApi.createLeaveRequest(payload);
      setIsLeaveFormOpen(false);
      setNewLeave({ leaveType: "ANNUAL", startAt: "", endAt: "", reason: "" });
      await Promise.all([loadDashboard(), loadLeaveRequests()]);
    } catch (requestError) {
      setError(requestError instanceof ApiClientError ? requestError.message : "ثبت درخواست مرخصی ناموفق بود.");
    } finally {
      setIsSavingLeave(false);
    }
  };

  const handleCreateBusinessTrip = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setIsSavingTrip(true);
      setError(null);
      const payload: CreateBusinessTripRequestPayload = {
        destination: newTrip.destination.trim(), purpose: newTrip.purpose.trim(),
        startAt: newTrip.startAt, endAt: newTrip.endAt,
        ...(newTrip.estimatedCost ? { estimatedCost: Number(newTrip.estimatedCost) } : {}),
        currency: newTrip.currency,
      };
      await humanResourcesApi.createBusinessTripRequest(payload);
      setNewTrip({ destination: "", purpose: "", startAt: "", endAt: "", estimatedCost: "", currency: "IRR" });
      setIsTripFormOpen(false);
      await Promise.all([loadDashboard(), loadBusinessTripRequests()]);
    } catch (requestError) {
      setError(requestError instanceof ApiClientError ? requestError.message : uiMessage(locale, "hrTripSaveFailed"));
    } finally {
      setIsSavingTrip(false);
    }
  };

  const updateBusinessTripStatus = async (id: string, status: LeaveRequestStatus) => {
    try {
      setUpdatingTripId(id);
      setError(null);
      await humanResourcesApi.updateBusinessTripRequestStatus(id, { status });
      await Promise.all([loadDashboard(), loadBusinessTripRequests()]);
    } catch (requestError) {
      setError(requestError instanceof ApiClientError ? requestError.message : uiMessage(locale, "hrTripSaveFailed"));
    } finally {
      setUpdatingTripId(null);
    }
  };

  async function updateLeaveStatus(leaveRequestId: string, status: "APPROVED" | "REJECTED" | "CANCELLED") {
    const actionLabel = status === "APPROVED" ? "تأیید" : status === "REJECTED" ? "رد" : "لغو";
    const reviewerNote = status === "CANCELLED" ? undefined : window.prompt(`یادداشت ${actionLabel} درخواست مرخصی را وارد کنید (اختیاری):`);
    if (reviewerNote === null) return;

    try {
      setUpdatingLeaveId(leaveRequestId);
      setError(null);

      await humanResourcesApi.updateLeaveRequestStatus(leaveRequestId, {
        status,
        reviewerNote: reviewerNote?.trim() || undefined,
      });

      await Promise.all([loadDashboard(), loadLeaveRequests()]);
    } catch (requestError) {
      if (requestError instanceof ApiClientError) setError(requestError.message);
      else setError(`عملیات ${actionLabel} درخواست مرخصی انجام نشد.`);
    } finally {
      setUpdatingLeaveId(null);
    }
  }

  return (
    <div dir="rtl" className="space-y-5">
      {/* هشدار خطا در صورت بروز */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs font-medium text-rose-600 dark:text-rose-400"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadAllData(true)}
            className="rounded-lg border border-rose-500/30 px-3 py-1 font-bold transition-all hover:bg-rose-500/20"
          >
            تلاش مجدد
          </button>
        </div>
      )}

      {/* ۱. کارت‌های شاخص‌های کلیدی منابع انسانی (KPIs) */}
      {activeTab === "overview" && <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-blue-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">کل کارکنان</p>
              <p className="mt-2 text-xl font-bold text-foreground">{dashboard?.employees.total ?? 0}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">نیروی ثبت‌شده در سامانه</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <Users size={20} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-emerald-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">کارکنان فعال</p>
              <p className="mt-2 text-xl font-bold text-emerald-500">{dashboard?.employees.active ?? 0}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">مشغول به کار</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <UserCheck size={20} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-amber-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">کارکنان در مرخصی</p>
              <p className="mt-2 text-xl font-bold text-amber-500">{dashboard?.employees.onLeave ?? 0}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">عدم حضور امروز</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <UserMinus size={20} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-purple-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">درخواست‌های در انتظار</p>
              <p className="mt-2 text-xl font-bold text-purple-500">{dashboard?.leaveRequests.pending ?? 0}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">نیازمند بررسی و تأیید</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
              <CalendarClock size={20} />
            </div>
          </div>
        </div>
      </section>}

      {/* ۲. بخش تب‌ها و جداول عملیاتی */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        {/* نوار جابجایی تب‌ها و ابزار به‌روزرسانی */}
        <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-muted/60 p-1">
            {(access?.canViewEmployees || access?.employeeId) && <button
              type="button"
              onClick={() => setActiveTab("employees")}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === "employees"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users size={14} />
              <span>فهرست کارکنان ({employees.length})</span>
            </button>}

            {(access?.canViewLeaves || access?.canRequestLeave) && <button
              type="button"
              onClick={() => setActiveTab("leaves")}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === "leaves"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarClock size={14} />
              <span>درخواست‌های مرخصی ({leaveRequests.length})</span>
            </button>}
          </div>

          <div className="flex items-center gap-2.5">
            {/* دکمه ورود گروهی پرسنل (JSON) */}
            {access?.canManageEmployees && activeTab === "employees" && <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex h-9.5 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground transition-all hover:bg-muted active:scale-95"
            >
              <Upload size={14} className="text-muted-foreground" />
              <span>ورود گروهی (JSON)</span>
            </button>}

            {/* دکمه ثبت کارمند جدید */}
            {access?.canManageEmployees && activeTab === "employees" && <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex h-9.5 items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-95"
            >
              <Plus size={15} />
              <span>ثبت کارمند جدید</span>
            </button>}

            {activeTab === "leaves" && ((requestKind === "leave" && access?.canRequestLeave) || (requestKind === "mission" && access?.employeeId)) && (
              <button
                type="button"
                onClick={() => requestKind === "leave" ? setIsLeaveFormOpen((open) => !open) : setIsTripFormOpen((open) => !open)}
                className="inline-flex h-9.5 items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
              >
                <Plus size={15} />
                <span>{uiMessage(locale, requestKind === "leave" ? "hrLeaveRequestNew" : "hrTripRequestNew")}</span>
              </button>
            )}

            {/* دکمه به‌روزرسانی */}
            <button
              type="button"
              onClick={() => void loadAllData(true)}
              disabled={refreshing || loading}
              title="به‌روزرسانی داده‌ها"
              className="inline-flex h-9.5 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground transition-all hover:bg-muted active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">{refreshing ? "در حال دریافت..." : "به‌روزرسانی"}</span>
            </button>
          </div>
        </div>

        {/* تب ۱: فهرست کارکنان */}
        {activeTab === "overview" && (
          <div className="grid gap-4 md:grid-cols-2">
            {(access?.canViewEmployees || access?.employeeId) && (
            <Link href="/human-resources/employees" className="group flex min-h-32 items-center justify-between rounded-2xl border border-border bg-background p-5 transition-colors hover:border-primary/50 hover:bg-primary/5">
              <span className="flex items-center gap-3"><Users className="text-primary" size={22} /><span className="font-bold">{uiMessage(locale, "sidebarEmployeeRecords")}</span></span>
              <span className="text-sm text-muted-foreground">{dashboard?.employees.total ?? 0}</span>
            </Link>
            )}
            {(access?.canViewLeaves || access?.canRequestLeave) && (
            <Link href="/human-resources/leaves" className="group flex min-h-32 items-center justify-between rounded-2xl border border-border bg-background p-5 transition-colors hover:border-primary/50 hover:bg-primary/5">
              <span className="flex items-center gap-3"><CalendarClock className="text-primary" size={22} /><span className="font-bold">{uiMessage(locale, "sidebarLeaveRequests")}</span></span>
              <span className="text-sm text-muted-foreground">{dashboard?.leaveRequests.pending ?? 0}</span>
            </Link>
            )}
            {(access?.canViewAttendance || access?.employeeId) && <Link href="/human-resources/attendance" className="flex min-h-32 items-center gap-3 rounded-2xl border border-border bg-background p-5 transition-colors hover:border-primary/50 hover:bg-primary/5"><Clock className="text-primary" size={22}/><span className="font-bold">{uiMessage(locale, "sidebarAttendance")}</span></Link>}
            {(access?.canViewPayroll || access?.employeeId) && <Link href="/human-resources/payroll" className="flex min-h-32 items-center gap-3 rounded-2xl border border-border bg-background p-5 transition-colors hover:border-primary/50 hover:bg-primary/5"><Briefcase className="text-primary" size={22}/><span className="font-bold">{uiMessage(locale, "sidebarPayroll")}</span></Link>}
          </div>
        )}

        {activeTab === "employees" && (
          <div className="space-y-4">
            {/* فیلترهای بخش پرسنل */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={15}
                />
                <input
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  placeholder="جست‌وجو با نام، کد پرسنلی، تلفن یا ایمیل..."
                  className="h-9.5 w-full rounded-xl border border-border bg-background pr-9 pl-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="relative">
                <Filter
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={14}
                />
                <select
                  value={employeeStatus}
                  onChange={(e) => setEmployeeStatus(e.target.value as EmployeeStatus | "ALL")}
                  className="h-9.5 w-full appearance-none rounded-xl border border-border bg-background pr-8 pl-3 text-xs text-foreground focus:border-blue-500 focus:outline-none"
                >
                  <option value="ALL">همه وضعیت‌ها</option>
                  {Object.entries(employeeStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <Briefcase
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={14}
                />
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value as EmploymentType | "ALL")}
                  className="h-9.5 w-full appearance-none rounded-xl border border-border bg-background pr-8 pl-3 text-xs text-foreground focus:border-blue-500 focus:outline-none"
                >
                  <option value="ALL">همه انواع استخدام</option>
                  {Object.entries(employmentTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* جدول پرسنل */}
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs font-bold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3.5">کد پرسنلی</th>
                      <th className="px-4 py-3.5">نام کارمند</th>
                      <th className="px-4 py-3.5">سمت شغلی</th>
                      <th className="px-4 py-3.5">نوع قرارداد</th>
                      <th className="px-4 py-3.5">شعبه / دپارتمان</th>
                      <th className="px-4 py-3.5 text-center">وضعیت</th>
                      <th className="px-4 py-3.5 text-center">تاریخ استخدام</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border">
                    {loading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td className="px-4 py-4">
                            <div className="h-4 w-20 rounded bg-muted" />
                          </td>
                          <td className="px-4 py-4">
                            <div className="h-4 w-32 rounded bg-muted" />
                          </td>
                          <td className="px-4 py-4">
                            <div className="h-4 w-24 rounded bg-muted" />
                          </td>
                          <td className="px-4 py-4">
                            <div className="h-4 w-20 rounded bg-muted" />
                          </td>
                          <td className="px-4 py-4">
                            <div className="h-4 w-28 rounded bg-muted" />
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="mx-auto h-5 w-16 rounded bg-muted" />
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="mx-auto h-4 w-20 rounded bg-muted" />
                          </td>
                        </tr>
                      ))
                    ) : employees.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center">
                          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                            <AlertCircle size={20} />
                          </div>
                          <p className="mt-2 text-sm font-bold text-foreground">کارمندی یافت نشد</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            با تغییر فیلترها یا عبارت جستجو مجدداً تلاش کنید.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      employees.map((employee) => (
                        <tr key={employee.id} className="transition-colors hover:bg-muted/30">
                          <td className="px-4 py-4 font-mono text-xs font-semibold text-muted-foreground">
                            {employee.employeeCode}
                          </td>

                          <td className="px-4 py-4">
                            <div className="font-semibold text-foreground">{getEmployeeName(employee)}</div>
                            <div className="text-xs text-muted-foreground">{employee.phone || employee.email || "—"}</div>
                          </td>

                          <td className="px-4 py-4 text-foreground/80">{employee.jobTitle || "—"}</td>

                          <td className="px-4 py-4 text-xs text-muted-foreground">
                            {employmentTypeLabels[employee.employmentType]}
                          </td>

                          <td className="px-4 py-4">
                            <div className="text-foreground">{employee.branch?.name || employee.branch?.title || "—"}</div>
                            <div className="text-xs text-muted-foreground">
                              {employee.department?.name || employee.department?.title || "—"}
                            </div>
                          </td>

                          <td className="px-4 py-4 text-center">
                            <HrEmployeeStatusBadge status={employee.status} />
                          </td>

                          <td className="px-4 py-4 text-center text-xs text-muted-foreground">{formatHrDate(employee.hiredAt, locale)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* تب ۲: درخواست‌های مرخصی */}
        {activeTab === "leaves" && (
          <div className="space-y-4">
            <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1" role="tablist" aria-label={uiMessage(locale, "sidebarLeaveRequests")}>
              {(["leave", "mission"] as const).map((kind) => (
                <button key={kind} type="button" role="tab" aria-selected={requestKind === kind} onClick={() => { setRequestKind(kind); setIsLeaveFormOpen(false); setIsTripFormOpen(false); }} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${requestKind === kind ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {uiMessage(locale, kind === "leave" ? "hrRequestsLeave" : "hrRequestsMission")}
                </button>
              ))}
            </div>
            {requestKind === "leave" && <div className="grid gap-3 sm:grid-cols-3">
              {([
                { label: "hrLeavePending", count: dashboard?.leaveRequests.pending ?? 0, icon: Clock, tone: "text-amber-600 bg-amber-500/10" },
                { label: "hrLeaveApproved", count: dashboard?.leaveRequests.approved ?? 0, icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-500/10" },
                { label: "hrLeaveRejected", count: dashboard?.leaveRequests.rejected ?? 0, icon: XCircle, tone: "text-rose-600 bg-rose-500/10" },
              ] as const).map(({ label, count, icon: Icon, tone }) => (
                <article key={label} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                  <span className={`rounded-xl p-2.5 ${tone}`}><Icon size={18} /></span>
                  <div><p className="text-xs text-muted-foreground">{uiMessage(locale, label)}</p><p className="mt-1 text-xl font-bold tabular-nums">{new Intl.NumberFormat(locale).format(count)}</p></div>
                </article>
              ))}
            </div>}
            {requestKind === "leave" && isLeaveFormOpen && access?.employeeId && (
              <form onSubmit={(event) => void handleCreateLeaveRequest(event)} className="grid gap-3 rounded-2xl border border-border bg-background p-4 sm:grid-cols-2 lg:grid-cols-5">
                <label className="space-y-1 text-xs font-semibold">
                  <span>{uiMessage(locale, "hrLeaveType")}</span>
                  <select value={newLeave.leaveType} onChange={(event) => setNewLeave((value) => ({ ...value, leaveType: event.target.value as LeaveType }))} className="h-10 w-full rounded-xl border border-border bg-card px-3">
                    {Object.entries(leaveTypeMessageKeys).map(([key, labelKey]) => <option key={key} value={key}>{uiMessage(locale, labelKey)}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-xs font-semibold">
                  <span>{uiMessage(locale, "hrLeaveStartAt")}</span>
                  <input required type="datetime-local" value={newLeave.startAt} onChange={(event) => setNewLeave((value) => ({ ...value, startAt: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-card px-3" />
                </label>
                <label className="space-y-1 text-xs font-semibold">
                  <span>{uiMessage(locale, "hrLeaveEndAt")}</span>
                  <input required type="datetime-local" value={newLeave.endAt} onChange={(event) => setNewLeave((value) => ({ ...value, endAt: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-card px-3" />
                </label>
                <label className="space-y-1 text-xs font-semibold lg:col-span-2">
                  <span>{uiMessage(locale, "hrLeaveReason")}</span>
                  <input maxLength={2000} value={newLeave.reason} onChange={(event) => setNewLeave((value) => ({ ...value, reason: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-card px-3" />
                </label>
                <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
                  <button disabled={isSavingLeave} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">{uiMessage(locale, "hrLeaveSubmit")}</button>
                  <button type="button" onClick={() => setIsLeaveFormOpen(false)} className="rounded-xl border border-border px-4 py-2 text-xs font-semibold">{uiMessage(locale, "hrLeaveCancel")}</button>
                </div>
              </form>
            )}
            {requestKind === "mission" && isTripFormOpen && access?.employeeId && (
              <form onSubmit={(event) => void handleCreateBusinessTrip(event)} className="grid gap-3 rounded-2xl border border-border bg-background p-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-1 text-xs font-semibold"><span>{uiMessage(locale, "hrTripDestination")}</span><input required maxLength={160} value={newTrip.destination} onChange={(event) => setNewTrip((value) => ({ ...value, destination: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-card px-3" /></label>
                <label className="space-y-1 text-xs font-semibold"><span>{uiMessage(locale, "hrLeaveStartAt")}</span><input required type="datetime-local" value={newTrip.startAt} onChange={(event) => setNewTrip((value) => ({ ...value, startAt: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-card px-3" /></label>
                <label className="space-y-1 text-xs font-semibold"><span>{uiMessage(locale, "hrLeaveEndAt")}</span><input required type="datetime-local" value={newTrip.endAt} onChange={(event) => setNewTrip((value) => ({ ...value, endAt: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-card px-3" /></label>
                <label className="space-y-1 text-xs font-semibold"><span>{uiMessage(locale, "hrTripEstimatedCost")}</span><input min="0" step="0.01" type="number" value={newTrip.estimatedCost} onChange={(event) => setNewTrip((value) => ({ ...value, estimatedCost: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-card px-3" dir="ltr" /></label>
                <label className="space-y-1 text-xs font-semibold"><span>{uiMessage(locale, "hrTripCostCurrency")}</span><input required minLength={3} maxLength={3} value={newTrip.currency} onChange={(event) => setNewTrip((value) => ({ ...value, currency: event.target.value.toUpperCase() }))} className="h-10 w-full rounded-xl border border-border bg-card px-3" dir="ltr" /></label>
                <label className="space-y-1 text-xs font-semibold sm:col-span-2 lg:col-span-4"><span>{uiMessage(locale, "hrTripPurpose")}</span><textarea required maxLength={2000} rows={3} value={newTrip.purpose} onChange={(event) => setNewTrip((value) => ({ ...value, purpose: event.target.value }))} className="w-full rounded-xl border border-border bg-card px-3 py-2" /></label>
                <div className="flex gap-2 sm:col-span-2 lg:col-span-4"><button disabled={isSavingTrip} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">{uiMessage(locale, isSavingTrip ? "preferencesSaving" : "hrLeaveSubmit")}</button><button type="button" onClick={() => setIsTripFormOpen(false)} className="rounded-xl border border-border px-4 py-2 text-xs font-semibold">{uiMessage(locale, "hrLeaveCancel")}</button></div>
              </form>
            )}
            {/* فیلترهای درخواست */}
            <div className={`grid gap-3 ${requestKind === "leave" ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
              <div className="relative">
                  <Filter
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={14}
                />
                <select
                  value={leaveStatus}
                  onChange={(e) => setLeaveStatus(e.target.value as LeaveRequestStatus | "ALL")}
                  className="h-9.5 w-full appearance-none rounded-xl border border-border bg-background pr-8 pl-3 text-xs text-foreground focus:border-blue-500 focus:outline-none"
                >
                  <option value="ALL">{uiMessage(locale, "notificationsAll")}</option>
                  <option value="PENDING">{uiMessage(locale, "hrLeavePending")}</option>
                  <option value="APPROVED">{uiMessage(locale, "hrLeaveApproved")}</option>
                  <option value="REJECTED">{uiMessage(locale, "hrLeaveRejected")}</option>
                  <option value="CANCELLED">{uiMessage(locale, "hrRequestStatusCancelled")}</option>
                  <option value="DRAFT">{uiMessage(locale, "hrStatusDraft")}</option>
                </select>
              </div>

              {requestKind === "leave" && <div className="relative">
                <CalendarClock
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={14}
                />
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveType | "ALL")}
                  className="h-9.5 w-full appearance-none rounded-xl border border-border bg-background pr-8 pl-3 text-xs text-foreground focus:border-blue-500 focus:outline-none"
                >
                  <option value="ALL">همه انواع مرخصی</option>
                  {Object.entries(leaveTypeMessageKeys).map(([value, labelKey]) => (
                    <option key={value} value={value}>
                      {uiMessage(locale, labelKey)}
                    </option>
                  ))}
                </select>
              </div>}
            </div>

            {/* جدول مرخصی‌ها */}
            <div className={`overflow-hidden rounded-xl border border-border ${requestKind === "leave" ? "" : "hidden"}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-start text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs font-bold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3.5">{uiMessage(locale, "hrEmployee")}</th>
                      <th className="px-4 py-3.5">{uiMessage(locale, "hrLeaveType")}</th>
                      <th className="px-4 py-3.5">{uiMessage(locale, "hrDateRange")}</th>
                      <th className="px-4 py-3.5">{uiMessage(locale, "hrRequestDuration")}</th>
                      <th className="px-4 py-3.5 text-center">{uiMessage(locale, "hrRequestStatus")}</th>
                      <th className="px-4 py-3.5 text-center">{uiMessage(locale, "hrRequestActions")}</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border">
                    {loading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td className="px-4 py-4">
                            <div className="h-4 w-32 rounded bg-muted" />
                          </td>
                          <td className="px-4 py-4">
                            <div className="h-4 w-20 rounded bg-muted" />
                          </td>
                          <td className="px-4 py-4">
                            <div className="h-4 w-36 rounded bg-muted" />
                          </td>
                          <td className="px-4 py-4">
                            <div className="h-4 w-16 rounded bg-muted" />
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="mx-auto h-5 w-20 rounded bg-muted" />
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="mx-auto h-7 w-24 rounded bg-muted" />
                          </td>
                        </tr>
                      ))
                    ) : leaveRequests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center">
                          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                            <AlertCircle size={20} />
                          </div>
                          <p className="mt-2 text-sm font-bold text-foreground">درخواست مرخصی یافت نشد</p>
                          <p className="mt-1 text-xs text-muted-foreground">هیچ درخواستی با فیلترهای انتخابی مطابقت ندارد.</p>
                        </td>
                      </tr>
                    ) : (
                      leaveRequests.map((leaveRequest) => {
                        const isPending = leaveRequest.status === "PENDING";
                        const isUpdating = updatingLeaveId === leaveRequest.id;

                        return (
                          <tr key={leaveRequest.id} className="transition-colors hover:bg-muted/30">
                            <td className="px-4 py-4">
                              <div className="font-semibold text-foreground">{getEmployeeName(leaveRequest.employee)}</div>
                              <div className="font-mono text-xs text-muted-foreground">
                                {leaveRequest.employee?.employeeCode || "—"}
                              </div>
                            </td>

                            <td className="px-4 py-4 text-foreground/80">{uiMessage(locale, leaveTypeMessageKeys[leaveRequest.leaveType])}</td>

                            <td className="px-4 py-4">
                              <div className="flex items-center gap-1.5 text-xs text-foreground">
                                <Clock size={13} className="text-muted-foreground" />
                                <span>{formatHrDate(leaveRequest.startAt, locale)}</span>
                                <span className="text-muted-foreground">→</span>
                                <span>{formatHrDate(leaveRequest.endAt, locale)}</span>
                              </div>
                            </td>

                            <td className="px-4 py-4 font-semibold text-foreground">{formatHrDuration(leaveRequest.durationMinutes, locale)}</td>

                            <td className="px-4 py-4 text-center">
                              <HrLeaveStatusBadge status={leaveRequest.status} label={uiMessage(locale, requestStatusMessageKeys[leaveRequest.status])} />
                            </td>

                            <td className="px-4 py-4 text-center">
                              {isPending && access?.canReviewLeave ? (
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() => void updateLeaveStatus(leaveRequest.id, "APPROVED")}
                                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-bold text-white shadow-sm shadow-emerald-600/20 transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                                  >
                                    <CheckCircle2 size={13} />
                                    <span>{isUpdating ? "..." : uiMessage(locale, "hrLeaveApprove")}</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() => void updateLeaveStatus(leaveRequest.id, "REJECTED")}
                                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-rose-600 px-2.5 text-xs font-bold text-white shadow-sm shadow-rose-600/20 transition-all hover:bg-rose-700 active:scale-95 disabled:opacity-50"
                                  >
                                    <XCircle size={13} />
                                    <span>{uiMessage(locale, "hrLeaveReject")}</span>
                                  </button>
                                </div>
                              ) : isPending && access?.employeeId === leaveRequest.employeeId ? (
                                <button type="button" disabled={isUpdating} onClick={() => void updateLeaveStatus(leaveRequest.id, "CANCELLED")} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50">{uiMessage(locale, "hrLeaveCancel")}</button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {requestKind === "mission" && <div className="overflow-hidden rounded-xl border border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-start text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs font-bold text-muted-foreground"><tr><th className="px-4 py-3.5">{uiMessage(locale, "hrEmployee")}</th><th className="px-4 py-3.5">{uiMessage(locale, "hrTripDestination")}</th><th className="px-4 py-3.5">{uiMessage(locale, "hrTripDuration")}</th><th className="px-4 py-3.5">{uiMessage(locale, "hrTripEstimatedCost")}</th><th className="px-4 py-3.5 text-center">{uiMessage(locale, "hrRequestStatus")}</th><th className="px-4 py-3.5 text-center">{uiMessage(locale, "hrRequestActions")}</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {loading ? <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">{uiMessage(locale, "notificationsLoading")}</td></tr> : businessTripLoadError ? <tr><td colSpan={6} className="px-4 py-10 text-center text-rose-600">{uiMessage(locale, "hrTripLoadFailed")} <button type="button" onClick={() => void loadBusinessTripRequests()} className="ms-2 underline">{uiMessage(locale, "hrRetry")}</button></td></tr> : businessTripRequests.length === 0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground"><div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><Briefcase size={19}/></div>{uiMessage(locale, "hrTripEmpty")}</td></tr> : businessTripRequests.map((request) => {
                      const pending = request.status === "PENDING";
                      const updating = updatingTripId === request.id;
                      return <tr key={request.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-4"><div className="font-semibold">{request.employee ? `${request.employee.firstName} ${request.employee.lastName}`.trim() : uiMessage(locale, "hrEmployee")}</div><div className="font-mono text-xs text-muted-foreground">{request.employee?.employeeCode || "—"}</div></td>
                        <td className="max-w-56 px-4 py-4"><div className="font-semibold">{request.destination}</div><div className="truncate text-xs text-muted-foreground" title={request.purpose}>{request.purpose}</div></td>
                        <td className="px-4 py-4 text-xs"><div>{formatHrDate(request.startAt, locale)}</div><div className="text-muted-foreground">{formatHrDate(request.endAt, locale)}</div></td>
                        <td className="px-4 py-4 tabular-nums">{request.estimatedCost == null ? "—" : formatTripAmount(locale, request.estimatedCost, request.currency)}</td>
                        <td className="px-4 py-4 text-center"><HrLeaveStatusBadge status={request.status} label={uiMessage(locale, requestStatusMessageKeys[request.status])}/></td>
                        <td className="px-4 py-4 text-center">{pending && access?.canReviewLeave ? <div className="inline-flex items-center gap-2"><button type="button" disabled={updating} onClick={() => void updateBusinessTripStatus(request.id, "APPROVED")} className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-bold text-white disabled:opacity-50"><CheckCircle2 size={13}/>{uiMessage(locale, "hrLeaveApprove")}</button><button type="button" disabled={updating} onClick={() => void updateBusinessTripStatus(request.id, "REJECTED")} className="inline-flex h-8 items-center gap-1 rounded-lg bg-rose-600 px-2.5 text-xs font-bold text-white disabled:opacity-50"><XCircle size={13}/>{uiMessage(locale, "hrLeaveReject")}</button></div> : pending && access?.employeeId === request.employeeId ? <button type="button" disabled={updating} onClick={() => void updateBusinessTripStatus(request.id, "CANCELLED")} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground disabled:opacity-50">{uiMessage(locale, "hrLeaveCancel")}</button> : <span className="text-xs text-muted-foreground">—</span>}</td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </div>}
          </div>
        )}
      </section>

      {/* مودال ثبت کارمند جدید تکی */}
      <EmployeeFormModal
        isOpen={isCreateModalOpen}
        isSaving={isSavingEmployee}
        referenceData={referenceData}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleCreateEmployee}
      />

      {/* مودال ورود گروهی پرسنل از طریق فایل JSON */}
      <EmployeeImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={async () => {
          await loadAllData(true);
        }}
      />
    </div>
  );
}
