// Shared ticket labels and styles for the tickets module.

import type {
  TicketPriority,
  TicketStatus,
  TicketType,
  TicketVisibility,
} from '@/app/(workspace)/support/types';

// پیکربندی بصری وضعیت‌های تیکت
export const statusConfig: Record<
  TicketStatus,
  { label: string; className: string }
> = {
  OPEN: {
    label: 'باز',
    className: 'bg-cyan-100 text-cyan-800 border-cyan-500',
  },

  IN_PROGRESS: {
    label: 'در حال کار',
    className: 'bg-indigo-100 text-indigo-800 border-indigo-500',
  },

  WAITING_FOR_CUSTOMER: {
    label: 'در انتظار مشتری',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-500',
  },

  RESOLVED: {
    label: 'حل‌شده',
    className: 'bg-green-100 text-green-800 border-green-500',
  },

  CLOSED: {
    label: 'بسته',
    className: 'bg-zinc-100 text-zinc-800 border-zinc-500',
  },

  CANCELLED: {
    label: 'لغو شده',
    className: 'bg-stone-100 text-stone-800 border-stone-500',
  },
};

// پیکربندی بصری اولویت‌های تیکت
export const priorityConfig: Record<
  TicketPriority,
  { label: string; className: string }
> = {
  LOW: {
    label: 'پایین',
    className: 'bg-gray-200 text-gray-700',
  },

  MEDIUM: {
    label: 'متوسط',
    className: 'bg-green-200 text-green-700',
  },

  HIGH: {
    label: 'بالا',
    className: 'bg-yellow-200 text-yellow-700',
  },

  URGENT: {
    label: 'فوری',
    className: 'bg-orange-200 text-orange-700',
  },
};

// برچسب نوع تیکت
export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  SUPPORT: 'پشتیبانی',
  INCIDENT: 'رخداد / خرابی',
  REQUEST: 'درخواست',
  QUESTION: 'سؤال',
  COMPLAINT: 'شکایت',
};

// برچسب سطح دسترسی تیکت
export const TICKET_VISIBILITY_LABELS: Record<TicketVisibility, string> = {
  INTERNAL: 'داخلی',
  CUSTOMER: 'قابل مشاهده برای مشتری',
};
