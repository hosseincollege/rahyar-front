/**
 * @file frontend/src/types/ticket.ts
 * @description Typeهای مربوط به ماژول تیکت - نسخه اصلاح شده برای سازگاری با بک‌اند
 */

export type TicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_CUSTOMER'
  | 'RESOLVED'
  | 'CLOSED'
  | 'CANCELLED';

export type TicketPriority =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'URGENT';

export type TicketType =
  | 'SUPPORT'
  | 'INCIDENT'
  | 'REQUEST'
  | 'QUESTION'
  | 'COMPLAINT';

export type TicketVisibility =
  | 'INTERNAL'
  | 'CUSTOMER';

export type TicketSource =
  | 'PANEL'
  | 'EMAIL'
  | 'PHONE'
  | 'OTHER';

/**
 * Payload برای ایجاد تیکت جدید
 * مطابقت داده شده با CreateTicketDto در بک‌اند
 */
export type CreateTicketPayload = {
  projectId: string;
  subject: string; // تغییر از title به subject
  description: string;
  type?: TicketType;
  priority?: TicketPriority;
  visibility?: TicketVisibility;
  category?: string;
  dueAt?: string;
};

/**
 * ساختار اصلی تیکت دریافتی از API
 */
export type Ticket = {
  id: string;
  projectId?: string | null;
  project?: { id: string; name: string; code: string } | null;
  ticketNumber: number;
  subject: string;
  description: string;
  type: TicketType;
  status: TicketStatus;
  priority: TicketPriority;
  visibility: TicketVisibility;
  source?: TicketSource; // اضافه شده برای سازگاری
  category?: string | null;
  dueAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  creatorId: string;
  assigneeId?: string | null;
  createdAt: string;
  updatedAt: string;
  // اضافه شده برای جلوگیری از خطای Type Mismatch هنگام دریافت لیست تیکت‌ها
  creator?: {
    username: string;
  } | null;
};

export type TicketMessage = {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TicketDetails = Ticket & {
  messages?: TicketMessage[];
};
