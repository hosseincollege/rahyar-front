/**
 * @file frontend/src/lib/api/tickets/ticket-api.ts
 * @description لایه API ماژول تیکت در فرانت‌اند.
 */

import { apiClient, ApiClientError } from '@/lib/api-client';
import type {
  CreateTicketPayload,
  Ticket,
  TicketDetails,
  TicketPriority,
  TicketStatus,
} from '@/types/ticket';

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

export type TicketListQuery = {
  projectId?: string;
  search?: string;
  status?: TicketStatus | 'ALL';
  priority?: TicketPriority | 'ALL';
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function unwrapApiData<T>(response: unknown): T {
  if (isRecord(response) && 'data' in response) {
    return (response as ApiEnvelope<T>).data as T;
  }

  return response as T;
}

function buildQueryString(query?: TicketListQuery): string {
  if (!query) {
    return '';
  }

  const params = new URLSearchParams();

  if (query.projectId) params.set('projectId', query.projectId);

  if (query.search?.trim()) {
    params.set('search', query.search.trim());
  }

  if (query.status && query.status !== 'ALL') {
    params.set('status', query.status);
  }

  if (query.priority && query.priority !== 'ALL') {
    params.set('priority', query.priority);
  }

  const serializedQuery = params.toString();

  return serializedQuery ? `?${serializedQuery}` : '';
}

function normalizeError(error: unknown, fallbackMessage: string): never {
  if (error instanceof ApiClientError) {
    throw new Error(error.message || fallbackMessage);
  }

  if (error instanceof Error) {
    throw new Error(error.message || fallbackMessage);
  }

  throw new Error(fallbackMessage);
}

/**
 * دریافت فهرست تیکت‌ها.
 */
export async function getTickets(
  query?: TicketListQuery,
): Promise<Ticket[]> {
  try {
    const response = await apiClient.get<unknown>(
      `/tickets${buildQueryString(query)}`,
    );

    const data = unwrapApiData<unknown>(response);

    if (!Array.isArray(data)) {
      return [];
    }

    return data as Ticket[];
  } catch (error) {
    normalizeError(error, 'دریافت فهرست تیکت‌ها با خطا مواجه شد.');
  }
}

/**
 * دریافت جزئیات یک تیکت.
 */
export async function getTicketById(id: string): Promise<TicketDetails> {
  if (!id?.trim()) {
    throw new Error('شناسه تیکت معتبر نیست.');
  }

  try {
    const response = await apiClient.get<unknown>(`/tickets/${id}`);

    return unwrapApiData<TicketDetails>(response);
  } catch (error) {
    normalizeError(error, 'دریافت جزئیات تیکت با خطا مواجه شد.');
  }
}

/**
 * ثبت تیکت جدید.
 */
export async function createTicket(
  payload: CreateTicketPayload,
): Promise<Ticket> {
  const subject = payload.subject?.trim();
  const description = payload.description?.trim();

  if (!subject) {
    throw new Error('عنوان تیکت الزامی است.');
  }

  if (!description) {
    throw new Error('شرح تیکت الزامی است.');
  }

  try {
    const backendPayload: Record<string, unknown> = {
      projectId: payload.projectId,
      subject,
      description,
      ...(payload.type !== undefined && {
        type: payload.type,
      }),
      ...(payload.priority !== undefined && {
        priority: payload.priority,
      }),
      ...(payload.visibility !== undefined && {
        visibility: payload.visibility,
      }),
      ...(payload.category?.trim() && {
        category: payload.category.trim(),
      }),
      ...(payload.dueAt && {
        dueAt: payload.dueAt,
      }),
    };

    const response = await apiClient.post<unknown>(
      '/tickets',
      backendPayload,
    );

    return unwrapApiData<Ticket>(response);
  } catch (error) {
    normalizeError(error, 'ثبت تیکت با خطا مواجه شد.');
  }
}

export const ticketApi = {
  getTickets,
  getTicketById,
  createTicket,
} as const;
