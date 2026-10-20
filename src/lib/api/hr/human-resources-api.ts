/**
 * مسیر فایل:
 * src/lib/api/hr/human-resources-api.ts
 *
 * هدف:
 * لایه اختصاصی ارتباط فرانت‌اند با API ماژول منابع انسانی.
 * تمام درخواست‌ها از apiClient عبور می‌کنند تا توکن JWT،
 * headerها و مدیریت خطاها یکپارچه باقی بماند.
 */

import { apiClient, ApiClientError } from "@/lib/api-client";

import type {
  CreateEmployeePayload,
  CreateLeaveRequestPayload,
  BusinessTripRequest,
  CreateBusinessTripRequestPayload,
  Employee,
  EmployeeListQuery,
  HrDashboardSummary,
  HrAccess,
  HrReferenceData,
  AttendanceRecord,
  PayrollRecord,
  SaveAttendancePayload,
  SavePayrollPayload,
  LeaveRequest,
  LeaveRequestListQuery,
  LeaveRequestStatus,
  UpdateEmployeePayload,
  UpdateLeaveRequestStatusPayload,
} from "@/types/human-resources";

/**
 * سازگاری با پاسخ‌های احتمالی backend:
 * - داده مستقیم
 * - { success, data, message }
 *
 * نکته:
 * apiClient ما generic است، ولی ممکن است backend گاهی envelope برگرداند.
 */
type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

function normalizeResponse<T>(response: unknown): T {
  if (response && typeof response === "object" && "data" in (response as any)) {
    return (response as ApiEnvelope<T>).data as T;
  }

  return response as T;
}

/**
 * T;
  }

  return response as T;
}

/**
 * باشد، فیلدهای مرتبط با ساخت اکانت را ارسال نکنیم
 *   تا backend گیر اعتبارسنجی/منطق‌های اضافی نیفتد.
 * - roleIds خالی را هم حذف می‌کنیم (اختیاری).
 */
function sanitizeCreateEmployeePayload(
  payload: CreateEmployeePayload,
): CreateEmployeePayload {
  const createAccount = Boolean(payload.createAccount);

  if (!createAccount) {
    const { createAccount: _ca, username: _u, password: _p, roleIds: _r, ...rest } =
      payload;

    // بهتر است createAccount را هم نفرستیم (undefined) تا درخواست تمیز بماند
    return rest as CreateEmployeePayload;
  }

  // createAccount=true
  // اگر roleIds خالی باشد، حذفش کنیم تا بعضی backendها اشتباه برداشت نکنند
  if (!payload.roleIds || payload.roleIds.length === 0) {
    const { roleIds: _r, ...rest } = payload;
    return rest;
  }

  return payload;
}

/**
 * تبدیل فیلترهای کارکنان به query string.
 */
function buildEmployeeQueryString(query: EmployeeListQuery = {}): string {
  const params = new URLSearchParams();

  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.status && query.status !== "ALL") params.set("status", query.status);
  if (query.employmentType && query.employmentType !== "ALL") {
    params.set("employmentType", query.employmentType);
  }
  if (query.branchId) params.set("branchId", query.branchId);
  if (query.departmentId) params.set("departmentId", query.departmentId);

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

/**
 * تبدیل فیلترهای درخواست مرخصی به query string.
 */
function buildLeaveRequestQueryString(
  query: LeaveRequestListQuery = {},
): string {
  const params = new URLSearchParams();

  if (query.employeeId) params.set("employeeId", query.employeeId);
  if (query.status && query.status !== "ALL") params.set("status", query.status);
  if (query.leaveType && query.leaveType !== "ALL") {
    params.set("leaveType", query.leaveType);
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export const humanResourcesApi = {
  async getAttendance(date?: string): Promise<AttendanceRecord[]> {
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    return normalizeResponse<AttendanceRecord[]>(await apiClient.get<unknown>(`/human-resources/attendance${query}`));
  },
  async saveAttendance(payload: SaveAttendancePayload): Promise<AttendanceRecord> {
    return normalizeResponse<AttendanceRecord>(await apiClient.post<unknown>("/human-resources/attendance", payload));
  },
  async checkIn(): Promise<AttendanceRecord> {
    return normalizeResponse<AttendanceRecord>(await apiClient.post<unknown>("/human-resources/attendance/check-in", {}));
  },
  async checkOut(): Promise<AttendanceRecord> {
    return normalizeResponse<AttendanceRecord>(await apiClient.post<unknown>("/human-resources/attendance/check-out", {}));
  },
  async getPayroll(period?: string): Promise<PayrollRecord[]> {
    const query = period ? `?period=${encodeURIComponent(period)}` : "";
    return normalizeResponse<PayrollRecord[]>(await apiClient.get<unknown>(`/human-resources/payroll${query}`));
  },
  async savePayroll(payload: SavePayrollPayload): Promise<PayrollRecord> {
    return normalizeResponse<PayrollRecord>(await apiClient.post<unknown>("/human-resources/payroll", payload));
  },
  async updatePayrollStatus(id: string, status: "APPROVED" | "PAID"): Promise<PayrollRecord> {
    return normalizeResponse<PayrollRecord>(await apiClient.patch<unknown>(`/human-resources/payroll/${encodeURIComponent(id)}/status`, { status }));
  },
  async getReferenceData(): Promise<HrReferenceData> {
    return normalizeResponse<HrReferenceData>(await apiClient.get<unknown>("/human-resources/options"));
  },
  async getAccess(): Promise<HrAccess> {
    return normalizeResponse<HrAccess>(await apiClient.get<unknown>("/human-resources/access"));
  },
  /**
   * دریافت آمار داشبورد منابع انسانی.
   * GET /human-resources/dashboard
   */
  async getDashboard(): Promise<HrDashboardSummary> {
    const response = await apiClient.get<unknown>("/human-resources/dashboard");
    return normalizeResponse<HrDashboardSummary>(response);
  },

  /**
   * دریافت فهرست کارکنان به همراه فیلترهای اختیاری.
   * GET /human-resources/employees
   */
  async getEmployees(query: EmployeeListQuery = {}): Promise<Employee[]> {
    const queryString = buildEmployeeQueryString(query);

    const response = await apiClient.get<unknown>(
      `/human-resources/employees${queryString}`,
    );

    return normalizeResponse<Employee[]>(response);
  },

  /**
   * دریافت جزئیات یک کارمند.
   * GET /human-resources/employees/:id
   */
  async getEmployeeById(id: string): Promise<Employee> {
    const response = await apiClient.get<unknown>(
      `/human-resources/employees/${id}`,
    );

    return normalizeResponse<Employee>(response);
  },

  /**
   * ایجاد کارمند جدید (Employee-First + ساخت اکانت اختیاری).
   * POST /human-resources/employees
   */
  async createEmployee(payload: CreateEmployeePayload): Promise<Employee> {
    const sanitized = sanitizeCreateEmployeePayload(payload);

    const response = await apiClient.post<unknown>(
      "/human-resources/employees",
      sanitized,
    );

    return normalizeResponse<Employee>(response);
  },

  /**
   * ویرایش اطلاعات کارمند.
   * PATCH /human-resources/employees/:id
   */
  async updateEmployee(
    id: string,
    payload: UpdateEmployeePayload,
  ): Promise<Employee> {
    const response = await apiClient.patch<unknown>(
      `/human-resources/employees/${id}`,
      payload,
    );

    return normalizeResponse<Employee>(response);
  },

  /**
   * دریافت فهرست درخواست‌های مرخصی.
   * GET /human-resources/leave-requests
   */
  async getLeaveRequests(
    query: LeaveRequestListQuery = {},
  ): Promise<LeaveRequest[]> {
    const queryString = buildLeaveRequestQueryString(query);

    const response = await apiClient.get<unknown>(
      `/human-resources/leave-requests${queryString}`,
    );

    return normalizeResponse<LeaveRequest[]>(response);
  },

  /**
   * دریافت جزئیات یک درخواست مرخصی.
   * GET /human-resources/leave-requests/:id
   */
  async getLeaveRequestById(id: string): Promise<LeaveRequest> {
    const response = await apiClient.get<unknown>(
      `/human-resources/leave-requests/${id}`,
    );

    return normalizeResponse<LeaveRequest>(response);
  },

  /**
   * ثبت درخواست مرخصی جدید.
   * POST /human-resources/leave-requests
   */
  async createLeaveRequest(
    payload: CreateLeaveRequestPayload,
  ): Promise<LeaveRequest> {
    const response = await apiClient.post<unknown>(
      "/human-resources/leave-requests",
      payload,
    );

    return normalizeResponse<LeaveRequest>(response);
  },

  /**
   * تأیید، رد، لغو یا تغییر وضعیت درخواست مرخصی.
   * PATCH /human-resources/leave-requests/:id/status
   */
  async updateLeaveRequestStatus(
    id: string,
    payload: UpdateLeaveRequestStatusPayload,
  ): Promise<LeaveRequest> {
    const response = await apiClient.patch<unknown>(
      `/human-resources/leave-requests/${id}/status`,
      payload,
    );

    return normalizeResponse<LeaveRequest>(response);
  },

  async getBusinessTripRequests(status: LeaveRequestStatus | "ALL" = "ALL"): Promise<BusinessTripRequest[]> {
    const query = status === "ALL" ? "" : `?status=${encodeURIComponent(status)}`;
    return normalizeResponse<BusinessTripRequest[]>(await apiClient.get<unknown>(`/human-resources/business-trip-requests${query}`));
  },

  async createBusinessTripRequest(payload: CreateBusinessTripRequestPayload): Promise<BusinessTripRequest> {
    return normalizeResponse<BusinessTripRequest>(await apiClient.post<unknown>("/human-resources/business-trip-requests", payload));
  },

  async updateBusinessTripRequestStatus(id: string, payload: UpdateLeaveRequestStatusPayload): Promise<BusinessTripRequest> {
    return normalizeResponse<BusinessTripRequest>(await apiClient.patch<unknown>(`/human-resources/business-trip-requests/${encodeURIComponent(id)}/status`, payload));
  },
};

export { ApiClientError };
