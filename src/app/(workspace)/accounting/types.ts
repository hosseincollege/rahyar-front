/**
 * مسیر فایل: frontend/src/types/accounting.ts
 *
 * قرارداد typeهای دامنه حسابداری در فرانت‌اند.
 *
 * این فایل نباید به API، React یا UI وابسته باشد.
 * هدف آن ایجاد زبان مشترک میان:
 * - accounting-api.ts
 * - صفحه فهرست حسابداری
 * - فرم ثبت فاکتور
 * - صفحه جزئیات فاکتور
 * - backend آینده در مسیر /accounting
 */

/**
 * ماژولی که سند یا درخواست مالی از آن ایجاد شده است.
 *
 * در فاز فعلی تمرکز روی accounting است؛
 * اما نگه‌داشتن purchases، inventory و hr کمک می‌کند
 * هسته Workflow در آینده میان ماژول‌ها قابل استفاده باشد.
 */
export type AccountingModuleType =
  | "accounting"
  | "purchases"
  | "inventory"
  | "hr";

/**
 * چرخه وضعیت مشترک برای فاکتورها و درخواست‌های پرداخت.
 */
export type AccountingDocumentStatus =
  | "draft"
  | "submitted"
  | "pending_review"
  | "approved"
  | "rejected"
  | "in_progress"
  | "completed"
  | "cancelled";

/**
 * سطح فوریت درخواست یا سند مالی.
 */
export type AccountingPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

/**
 * روش پرداخت ثبت‌شده توسط خزانه‌داری.
 */
export type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "cheque"
  | "card"
  | "online"
  | "other";

/**
 * یک ردیف از اقلام فاکتور.
 */
export interface AccountingLineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  total?: number;
}

/**
 * داده لازم برای ایجاد فاکتور خرید در backend.
 */
export interface CreateInvoicePayload {
  title: string;
  description?: string;
  vendorName?: string;
  branchId?: string;
  departmentId?: string;
  dueDate?: string | null;
  currency?: string;
  priority?: AccountingPriority;
  lineItems: AccountingLineItem[];
  metadata?: Record<string, unknown>;
}

/**
 * داده لازم برای ایجاد درخواست پرداخت.
 *
 * در فازهای بعدی می‌توان invoiceId را اجباری کرد؛
 * فعلاً درخواست پرداخت می‌تواند مستقل از فاکتور هم ثبت شود.
 */
export interface CreatePaymentRequestPayload {
  title: string;
  description?: string;
  amount: number;
  currency?: string;
  vendorName?: string;
  invoiceId?: string;
  branchId?: string;
  departmentId?: string;
  priority?: AccountingPriority;
  metadata?: Record<string, unknown>;
}

/**
 * payload تغییر وضعیت یک سند مالی.
 */
export interface UpdateAccountingStatusPayload {
  status: AccountingDocumentStatus;
  note?: string;
}

/**
 * داده لازم برای ثبت پرداخت توسط خزانه‌داری.
 */
export interface RegisterPaymentPayload {
  paidAmount: number;
  paidAt?: string;
  method?: PaymentMethod;
  referenceNumber?: string;
  note?: string;
  metadata?: Record<string, unknown>;
}

/**
 * مشخصات خلاصه شخص انجام‌دهنده‌ی یک اقدام.
 */
export interface AccountingActor {
  id: string;
  fullName?: string | null;
  username?: string | null;
}

/**
 * یک رکورد از تاریخچه تغییر وضعیت سند.
 */
export interface AccountingStatusHistoryItem {
  id: string;
  status: AccountingDocumentStatus;
  note?: string | null;
  actedBy?: AccountingActor | null;
  createdAt: string;
}

/**
 * اطلاعات ثبت یک پرداخت برای سند یا فاکتور.
 */
export interface AccountingPayment {
  id: string;
  paidAmount: number;
  paidAt: string;
  method?: PaymentMethod | null;
  referenceNumber?: string | null;
  note?: string | null;
  createdAt: string;
}

/**
 * مدل خلاصه برای نمایش در جدول صفحه حسابداری.
 */
export interface AccountingListItem {
  id: string;
  documentNumber: string;
  title: string;
  description?: string | null;
  moduleType: AccountingModuleType;
  status: AccountingDocumentStatus;
  priority: AccountingPriority;
  totalAmount: number;
  currency: string;
  vendorName?: string | null;
  branchName?: string | null;
  departmentName?: string | null;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * مدل کامل یک فاکتور یا درخواست پرداخت برای صفحه جزئیات.
 */
export interface AccountingDetail extends AccountingListItem {
  assignedTo?: AccountingActor | null;
  createdBy?: AccountingActor | null;
  lineItems: AccountingLineItem[];
  statusHistory: AccountingStatusHistoryItem[];
  payments: AccountingPayment[];
  metadata?: Record<string, unknown> | null;
}

/**
 * آمار موردنیاز dashboard حسابداری.
 */
export interface AccountingDashboardSummary {
  totalInvoices: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  paid: number;
  overdue: number;
}

export interface AccountingAccess {
  canView: boolean;
  canManage: boolean;
}

export type AccountingAccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export interface AccountingAccount { id: string; code: string; name: string; type: AccountingAccountType; isActive: boolean; }
export interface AccountingVoucherLine { id?: string; accountId: string; description?: string | null; debit: number; credit: number; account?: Pick<AccountingAccount, 'id' | 'code' | 'name'>; }
export interface AccountingVoucher { id: string; number: string; date: string; description: string; status: 'DRAFT' | 'POSTED'; lines: AccountingVoucherLine[]; }
export interface AccountingLedgerLine extends AccountingVoucherLine { account: AccountingAccount; voucher: Pick<AccountingVoucher, 'id' | 'number' | 'date' | 'description'>; }
export interface AccountingPaymentActivity { id: string; paidAmount: number; paidAt: string; method?: string | null; referenceNumber?: string | null; note?: string | null; invoice: { id: string; documentNumber: string; title: string; vendorName?: string | null; currency: string }; }
export interface AccountingTrialBalance { rows: Array<Pick<AccountingAccount, 'id' | 'code' | 'name' | 'type'> & { debit: number; credit: number }>; debitTotal: number; creditTotal: number; }
