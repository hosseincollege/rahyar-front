/**
 * مسیر فایل:
 * src/app/(workspace)/hr/hr-badges.tsx
 *
 * هدف:
 * کامپوننت‌های نشانگر وضعیت (Badges) در ماژول منابع انسانی.
 */

import React from "react";
import type { EmployeeStatus, LeaveRequestStatus } from "@/app/(workspace)/human-resources/types";
import { employeeStatusLabels, leaveStatusLabels } from "./hr-utils";

export function HrEmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  const config: Record<EmployeeStatus, { bg: string; text: string }> = {
    ACTIVE: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
    ON_LEAVE: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
    INACTIVE: { bg: "bg-muted", text: "text-muted-foreground" },
    TERMINATED: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400" },
  };

  const c = config[status] ?? config.INACTIVE;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${c.bg} ${c.text}`}
    >
      {employeeStatusLabels[status]}
    </span>
  );
}

export function HrLeaveStatusBadge({ status, label }: { status: LeaveRequestStatus; label?: string }) {
  const config: Record<LeaveRequestStatus, { bg: string; text: string }> = {
    DRAFT: { bg: "bg-muted", text: "text-muted-foreground" },
    PENDING: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" },
    APPROVED: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
    REJECTED: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400" },
    CANCELLED: { bg: "bg-muted", text: "text-muted-foreground line-through" },
  };

  const c = config[status] ?? config.DRAFT;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${c.bg} ${c.text}`}
    >
      {label ?? leaveStatusLabels[status]}
    </span>
  );
}
