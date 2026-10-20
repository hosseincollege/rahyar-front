/**
 * مسیر فایل:
 * src/types/human-resources.ts
 *
 * هدف:
 * تعریف typeها، enumهای متنی و قرارداد داده‌های ماژول منابع انسانی
 * برای ارتباط type-safe بین API و رابط کاربری.
 */

export type EmployeeStatus =
  | "ACTIVE"
  | "ON_LEAVE"
  | "INACTIVE"
  | "TERMINATED";

export type EmploymentType =
  | "FULL_TIME"
  | "PART_TIME"
  | "CONTRACTOR"
  | "INTERN"
  | "TEMPORARY";

export type LeaveType =
  | "ANNUAL"
  | "SICK"
  | "UNPAID"
  | "HOURLY"
  | "MATERNITY"
  | "PATERNITY"
  | "OTHER";

export type LeaveRequestStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type UserStatus =
  | "INVITED"
  | "ACTIVE"
  | "DISABLED"
  | "ARCHIVED";

/**
 * نوع نقش قابل انتساب به عضو سازمان.
 */
export interface HrRole {
  id: string;
  name?: string | null;
  key?: string | null;
  description?: string | null;
  scope?: "SYSTEM" | "ORGANIZATION" | string;
}

/**
 * نوع ساده برای relationهای شعبه و دپارتمان.
 */
export interface HrOrganizationRelation {
  id: string;
  name?: string | null;
  title?: string | null;
  code?: string | null;
}

/**
 * اطلاعات پایه کاربر مرتبط با Employee یا LeaveRequest.
 */
export interface HrUserRelation {
  id: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: UserStatus | null;
}

/**
 * مدل کارمند مطابق مدل Employee در Prisma backend.
 */
export interface Employee {
  id: string;
  organizationId: string;

  userId?: string | null;
  branchId?: string | null;
  departmentId?: string | null;

  employeeCode: string;
  firstName: string;
  lastName: string;

  nationalId?: string | null;
  phone?: string | null;
  email?: string | null;
  jobTitle?: string | null;

  employmentType: EmploymentType;
  status: EmployeeStatus;

  hiredAt: string;
  terminatedAt?: string | null;
  birthDate?: string | null;

  address?: string | null;
  emergencyPhone?: string | null;
  notes?: string | null;

  createdAt: string;
  updatedAt: string;

  user?: HrUserRelation | null;
  branch?: HrOrganizationRelation | null;
  department?: HrOrganizationRelation | null;

  leaveRequests?: LeaveRequest[];
}

/**
 * رکورد تاریخچه تغییر وضعیت یک درخواست مرخصی.
 */
export interface LeaveRequestStatusHistory {
  id: string;
  leaveRequestId: string;
  actedById: string;

  status: LeaveRequestStatus;
  note?: string | null;
  createdAt: string;

  actedBy?: HrUserRelation | null;
}

/**
 * مدل درخواست مرخصی مطابق LeaveRequest در backend.
 */
export interface LeaveRequest {
  id: string;
  organizationId: string;

  employeeId: string;
  reviewedById?: string | null;

  leaveType: LeaveType;
  status: LeaveRequestStatus;

  startAt: string;
  endAt: string;
  durationMinutes: number;

  reason?: string | null;
  reviewerNote?: string | null;
  reviewedAt?: string | null;
  cancelledAt?: string | null;

  createdAt: string;
  updatedAt: string;

  employee?: Employee;
  reviewedBy?: HrUserRelation | null;
  statusHistory?: LeaveRequestStatusHistory[];
}

export interface BusinessTripRequest {
  id: string;
  organizationId: string;
  employeeId: string;
  reviewedById?: string | null;
  destination: string;
  purpose: string;
  startAt: string;
  endAt: string;
  estimatedCost?: string | number | null;
  currency: string;
  status: LeaveRequestStatus;
  reviewerNote?: string | null;
  reviewedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: Pick<Employee, "id" | "employeeCode" | "firstName" | "lastName">;
}

export interface CreateBusinessTripRequestPayload {
  destination: string;
  purpose: string;
  startAt: string;
  endAt: string;
  estimatedCost?: number;
  currency?: string;
}

/**
 * خروجی endpoint:
 * GET /human-resources/dashboard
 */
export interface HrDashboardSummary {
  employees: {
    total: number;
    active: number;
    onLeave: number;
    terminated: number;
  };

  leaveRequests: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
}

export interface HrAccess {
  canViewOrganization: boolean;
  canManage: boolean;
  canViewEmployees: boolean;
  canManageEmployees: boolean;
  canViewLeaves: boolean;
  canManageLeaves: boolean;
  canReviewLeave: boolean;
  canViewAttendance: boolean;
  canManageAttendance: boolean;
  canViewPayroll: boolean;
  canManagePayroll: boolean;
  canRequestLeave: boolean;
  employeeId: string | null;
}

export interface HrReferenceData {
  branches: Array<{ id: string; name: string; code: string }>;
  departments: Array<{ id: string; name: string; code: string; branchId: string | null }>;
  managers: Array<{ id: string; employeeCode: string; firstName: string; lastName: string; jobTitle?: string | null }>;
  employees: Array<{ id: string; employeeCode: string; firstName: string; lastName: string; jobTitle?: string | null }>;
  availableUsers: Array<{ id: string; username: string; firstName: string; lastName: string; email?: string | null }>;
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "REMOTE" | "HALF_DAY";
export interface AttendanceRecord {
  id: string;
  employeeId: string;
  workDate: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  status: AttendanceStatus;
  note?: string | null;
  employee: Pick<Employee, "id" | "employeeCode" | "firstName" | "lastName"> & { jobTitle?: string | null; branch?: { id: string; name: string } | null; department?: { id: string; name: string } | null };
}

export type PayrollStatus = "DRAFT" | "APPROVED" | "PAID";
export interface PayrollRecord {
  id: string;
  employeeId: string;
  period: string;
  currency: string;
  baseSalary: string | number;
  overtime: string | number;
  allowances: string | number;
  deductions: string | number;
  netAmount: string | number;
  status: PayrollStatus;
  note?: string | null;
  approvedAt?: string | null;
  paidAt?: string | null;
  employee: Pick<Employee, "id" | "employeeCode" | "firstName" | "lastName"> & { jobTitle?: string | null; branch?: { name: string } | null; department?: { name: string } | null };
}

export interface SaveAttendancePayload {
  employeeId: string;
  workDate: string;
  checkInAt?: string;
  checkOutAt?: string;
  status?: AttendanceStatus;
  note?: string;
}

export interface SavePayrollPayload {
  employeeId: string;
  period: string;
  currency?: string;
  baseSalary: number;
  overtime?: number;
  allowances?: number;
  deductions?: number;
  note?: string;
}

/**
 * پارامترهای فیلتر endpoint:
 * GET /human-resources/employees
 */
export interface EmployeeListQuery {
  search?: string;
  status?: EmployeeStatus | "ALL";
  employmentType?: EmploymentType | "ALL";
  branchId?: string;
  departmentId?: string;
}

/**
 * پارامترهای فیلتر endpoint:
 * GET /human-resources/leave-requests
 */
export interface LeaveRequestListQuery {
  employeeId?: string;
  status?: LeaveRequestStatus | "ALL";
  leaveType?: LeaveType | "ALL";
}

/**
 * payload ایجاد کارمند:
 * POST /human-resources/employees
 *
 * اگر createAccount برابر true باشد، username و password
 * برای ایجاد حساب کاربری هم‌زمان استفاده می‌شوند.
 */
export interface CreateEmployeePayload {
  employeeCode: string;
  firstName: string;
  lastName: string;
  hiredAt: string;

  createAccount?: boolean;
  username?: string;
  password?: string;
  roleIds?: string[];

  userId?: string;
  branchId?: string;
  departmentId?: string;
  managerId?: string;

  nationalId?: string;
  phone?: string;
  email?: string;
  jobTitle?: string;

  employmentType?: EmploymentType;
  status?: EmployeeStatus;

  birthDate?: string;
  address?: string;
  emergencyPhone?: string;
  notes?: string;
}

/**
 * نوع کمکی برای فرم ایجاد کارمند.
 *
 * در فرم، مقادیر فیلدها معمولاً به‌صورت رشته دریافت می‌شوند؛
 * هنگام ارسال باید به CreateEmployeePayload تبدیل شوند.
 */
export interface CreateEmployeeFormValues {
  employeeCode: string;
  firstName: string;
  lastName: string;
  hiredAt: string;

  createAccount: boolean;
  username: string;
  password: string;
  roleIds: string[];

  userId: string;
  branchId: string;
  departmentId: string;
  managerId: string;

  nationalId: string;
  phone: string;
  email: string;
  jobTitle: string;

  employmentType: EmploymentType;
  status: EmployeeStatus;

  birthDate: string;
  address: string;
  emergencyPhone: string;
  notes: string;
}

/**
 * payload ویرایش کارمند:
 * PATCH /human-resources/employees/:id
 */
export interface UpdateEmployeePayload {
  employeeCode?: string;

  userId?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  managerId?: string | null;

  firstName?: string;
  lastName?: string;
  nationalId?: string;
  phone?: string;
  email?: string;
  jobTitle?: string;

  employmentType?: EmploymentType;
  status?: EmployeeStatus;

  hiredAt?: string;
  terminatedAt?: string | null;
  birthDate?: string | null;

  address?: string | null;
  emergencyPhone?: string;
  notes?: string | null;
}

/**
 * payload ایجاد درخواست مرخصی:
 * POST /human-resources/leave-requests
 */
export interface CreateLeaveRequestPayload {
  employeeId: string;
  leaveType: LeaveType;
  startAt: string;
  endAt: string;
  reason?: string;
}

/**
 * payload تغییر وضعیت مرخصی:
 * PATCH /human-resources/leave-requests/:id/status
 */
export interface UpdateLeaveRequestStatusPayload {
  status: LeaveRequestStatus;
  reviewerNote?: string;
}
