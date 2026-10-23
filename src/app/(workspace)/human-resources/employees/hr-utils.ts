/**
 * مسیر فایل:
 * src/app/(workspace)/hr/hr-utils.ts
 *
 * هدف:
 * تجمیع labelهای فارسی و توابع کمکی HR برای استفاده مجدد.
*/

import { getCalendarLocale } from '@/lib/calendar';

import type {
  Employee,
  EmployeeStatus,
  EmploymentType,
  LeaveRequestStatus,
  LeaveType,
} from "@/app/(workspace)/human-resources/types";

// برچسب‌ها و متون فارسی
export const employeeStatusLabels: Record<EmployeeStatus, string> = {
  ACTIVE: "فعال",
  ON_LEAVE: "در مرخصی",
  INACTIVE: "غیرفعال",
  TERMINATED: "خاتمه‌یافته",
};

export const employmentTypeLabels: Record<EmploymentType, string> = {
  FULL_TIME: "تمام‌وقت",
  PART_TIME: "پاره‌وقت",
  CONTRACTOR: "قراردادی",
  INTERN: "کارآموز",
  TEMPORARY: "موقت",
};

export const leaveTypeLabels: Record<LeaveType, string> = {
  ANNUAL: "استحقاقی",
  SICK: "استعلاجی",
  UNPAID: "بدون حقوق",
  HOURLY: "ساعتی",
  MATERNITY: "زایمان",
  PATERNITY: "پدری",
  OTHER: "سایر",
};

export const leaveStatusLabels: Record<LeaveRequestStatus, string> = {
  DRAFT: "پیش‌نویس",
  PENDING: "در انتظار بررسی",
  APPROVED: "تأیید شده",
  REJECTED: "رد شده",
  CANCELLED: "لغو شده",
};

// توابع کمکی فرمت‌دهی
export function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(getCalendarLocale("fa-IR"), {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatDuration(minutes: number) {
  if (!minutes || minutes < 1) return "—";

  const days = Math.floor(minutes / 1440);
  const remainingMinutes = minutes % 1440;
  const hours = Math.floor(remainingMinutes / 60);
  const mins = remainingMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} روز`);
  if (hours > 0) parts.push(`${hours} ساعت`);
  if (mins > 0 && days === 0) parts.push(`${mins} دقیقه`);

  return parts.join(" و ");
}

export function getEmployeeName(employee?: Employee) {
  if (!employee) return "کارمند نامشخص";
  return `${employee.firstName} ${employee.lastName}`.trim();
}
