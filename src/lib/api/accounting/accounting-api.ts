/**
 * مسیر فایل: frontend/src/lib/api/accounting/accounting-api.ts
 *
 * لایه API اختصاصی ماژول حسابداری.
 *
 * این فایل تنها محل تماس فرانت‌اند با endpointهای /accounting است.
 * صفحات React نباید مستقیماً apiClient را برای عملیات حسابداری صدا بزنند.
 *
 * endpointهای مورد انتظار backend:
 * GET    /accounting/dashboard
 * GET    /accounting/invoices
 * POST   /accounting/invoices
 * GET    /accounting/invoices/:id
 * PATCH  /accounting/invoices/:id/status
 * POST   /accounting/invoices/:id/payments
 *
 * endpointهای برنامه‌ریزی‌شده برای درخواست پرداخت:
 * GET    /accounting/payment-requests
 * POST   /accounting/payment-requests
 * POST   /accounting/payment-requests/:id/approve
 * POST   /accounting/payment-requests/:id/reject
 */

import { apiClient, ApiClientError } from "@/lib/api-client";
import type {
  AccountingDashboardSummary,
  AccountingAccess,
  AccountingDetail,
  AccountingDocumentStatus,
  AccountingListItem,
  AccountingPriority,
  CreateInvoicePayload,
  CreatePaymentRequestPayload,
  RegisterPaymentPayload,
  UpdateAccountingStatusPayload,
  AccountingAccount,
  AccountingAccountType,
  AccountingVoucher,
  AccountingLedgerLine,
  AccountingPaymentActivity,
  AccountingTrialBalance,
} from "@/types/accounting";

/**
 * بعضی endpointها ممکن است پاسخ را مستقیم برگردانند
 * و بعضی دیگر از envelope با ساختار { success, data, message } استفاده کنند.
 */
type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

/**
 * پارامترهای فیلتر فهرست فاکتورها یا درخواست‌های پرداخت.
 */
export interface AccountingListQuery {
  search?: string;
  status?: AccountingDocumentStatus | "ALL";
  priority?: AccountingPriority | "ALL";
  moduleType?: string | "ALL";
  branchId?: string;
  departmentId?: string;
  vendorOnly?: boolean;
}

/**
 * پاسخ مستقیم و پاسخ envelope را به یک ساختار واحد تبدیل می‌کند.
 */
function normalizeResponse<T>(response: unknown): T {
  const envelope = response as ApiEnvelope<T>;

  if (envelope && typeof envelope === "object" && "data" in envelope) {
    return envelope.data as T;
  }

  return response as T;
}

/**
 * تبدیل فیلترها به query string.
 *
 * مقدار ALL عمداً به backend ارسال نمی‌شود؛
 * چون ALL فقط مفهوم نمایشی در UI دارد.
 */
function buildQueryString(query: AccountingListQuery = {}): string {
  const params = new URLSearchParams();

  if (query.search?.trim()) {
    params.set("search", query.search.trim());
  }

  if (query.status && query.status !== "ALL") {
    params.set("status", query.status);
  }

  if (query.priority && query.priority !== "ALL") {
    params.set("priority", query.priority);
  }

  if (query.moduleType && query.moduleType !== "ALL") {
    params.set("moduleType", query.moduleType);
  }

  if (query.branchId) {
    params.set("branchId", query.branchId);
  }

  if (query.departmentId) {
    params.set("departmentId", query.departmentId);
  }

  if (query.vendorOnly) {
    params.set("vendorOnly", "true");
  }

  const serializedParams = params.toString();

  return serializedParams ? `?${serializedParams}` : "";
}

/**
 * APIهای دامنه حسابداری.
 */
export const accountingApi = {
  async getAccounts(): Promise<AccountingAccount[]> { return normalizeResponse<AccountingAccount[]>(await apiClient.get<unknown>('/accounting/accounts')); },
  async createAccount(payload: { code: string; name: string; type: AccountingAccountType }): Promise<AccountingAccount> { return normalizeResponse<AccountingAccount>(await apiClient.post<unknown>('/accounting/accounts', payload)); },
  async getVouchers(): Promise<AccountingVoucher[]> { return normalizeResponse<AccountingVoucher[]>(await apiClient.get<unknown>('/accounting/vouchers')); },
  async createVoucher(payload: { date: string; description: string; lines: Array<{ accountId: string; description?: string; debit: number; credit: number }> }): Promise<AccountingVoucher> { return normalizeResponse<AccountingVoucher>(await apiClient.post<unknown>('/accounting/vouchers', payload)); },
  async postVoucher(id: string): Promise<AccountingVoucher> { return normalizeResponse<AccountingVoucher>(await apiClient.post<unknown>(`/accounting/vouchers/${id}/post`, {})); },
  async getLedger(accountId?: string): Promise<AccountingLedgerLine[]> { return normalizeResponse<AccountingLedgerLine[]>(await apiClient.get<unknown>(`/accounting/ledger${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ''}`)); },
  async getPayments(): Promise<AccountingPaymentActivity[]> { return normalizeResponse<AccountingPaymentActivity[]>(await apiClient.get<unknown>('/accounting/payments')); },
  async getTrialBalance(): Promise<AccountingTrialBalance> { return normalizeResponse<AccountingTrialBalance>(await apiClient.get<unknown>('/accounting/reports/trial-balance')); },
  async getAccess(): Promise<AccountingAccess> {
    const response = await apiClient.get<unknown>("/accounting/access");
    return normalizeResponse<AccountingAccess>(response);
  },
  /**
   * دریافت آمار dashboard حسابداری.
   */
  async getDashboard(): Promise<AccountingDashboardSummary> {
    const response = await apiClient.get<unknown>("/accounting/dashboard");

    return normalizeResponse<AccountingDashboardSummary>(response);
  },

  /**
   * دریافت فهرست فاکتورهای خرید.
   */
  async getInvoices(
    query: AccountingListQuery = {},
  ): Promise<AccountingListItem[]> {
    const queryString = buildQueryString(query);

    const response = await apiClient.get<unknown>(
      `/accounting/invoices${queryString}`,
    );

    return normalizeResponse<AccountingListItem[]>(response);
  },

  /**
   * دریافت جزئیات یک فاکتور بر اساس شناسه آن.
   */
  async getInvoiceById(id: string): Promise<AccountingDetail> {
    const response = await apiClient.get<unknown>(`/accounting/invoices/${id}`);

    return normalizeResponse<AccountingDetail>(response);
  },

  /**
   * ثبت فاکتور خرید جدید.
   */
  async createInvoice(
    payload: CreateInvoicePayload,
  ): Promise<AccountingDetail> {
    const response = await apiClient.post<unknown>(
      "/accounting/invoices",
      payload,
    );

    return normalizeResponse<AccountingDetail>(response);
  },

  /**
   * تغییر وضعیت فاکتور؛
   * مثلاً submitted، approved، rejected یا completed.
   */
  async updateInvoiceStatus(
    id: string,
    payload: UpdateAccountingStatusPayload,
  ): Promise<AccountingDetail> {
    const response = await apiClient.patch<unknown>(
      `/accounting/invoices/${id}/status`,
      payload,
    );

    return normalizeResponse<AccountingDetail>(response);
  },

  /**
   * ثبت پرداخت فاکتور توسط خزانه‌داری.
   */
  async registerPayment(
    id: string,
    payload: RegisterPaymentPayload,
  ): Promise<AccountingDetail> {
    const response = await apiClient.post<unknown>(
      `/accounting/invoices/${id}/payments`,
      payload,
    );

    return normalizeResponse<AccountingDetail>(response);
  },

  /**
   * دریافت فهرست درخواست‌های پرداخت.
   *
   * توجه: این endpoint پس از تکمیل backend در دسترس خواهد بود.
   */
  async getPaymentRequests(
    query: AccountingListQuery = {},
  ): Promise<AccountingListItem[]> {
    const queryString = buildQueryString(query);

    const response = await apiClient.get<unknown>(
      `/accounting/payment-requests${queryString}`,
    );

    return normalizeResponse<AccountingListItem[]>(response);
  },

  /**
   * ایجاد درخواست پرداخت.
   *
   * توجه: این endpoint پس از تکمیل backend در دسترس خواهد بود.
   */
  async createPaymentRequest(
    payload: CreatePaymentRequestPayload,
  ): Promise<AccountingDetail> {
    const response = await apiClient.post<unknown>(
      "/accounting/payment-requests",
      payload,
    );

    return normalizeResponse<AccountingDetail>(response);
  },

  /**
   * تأیید درخواست پرداخت توسط مدیر مالی یا تأییدکننده مجاز.
   */
  async approvePaymentRequest(
    id: string,
    note?: string,
  ): Promise<AccountingDetail> {
    const response = await apiClient.post<unknown>(
      `/accounting/payment-requests/${id}/approve`,
      { note },
    );

    return normalizeResponse<AccountingDetail>(response);
  },

  /**
   * رد درخواست پرداخت توسط مدیر مالی یا تأییدکننده مجاز.
   */
  async rejectPaymentRequest(
    id: string,
    note?: string,
  ): Promise<AccountingDetail> {
    const response = await apiClient.post<unknown>(
      `/accounting/payment-requests/${id}/reject`,
      { note },
    );

    return normalizeResponse<AccountingDetail>(response);
  },
};

/**
 * برای اینکه صفحه‌ها در صورت نیاز بتوانند خطاهای API را type-safe بررسی کنند.
 */
export { ApiClientError };
