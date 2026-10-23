/**
 * @file src/lib/api-client.ts
 * @description Central HTTP client for ERP Pro frontend with JWT auth, token storage, logout, standardized errors, and status panel logging.
 */

import { levelFromStatus, useStatusStore } from './status-store';
import { API_BASE_URL } from './api-environment';
export { API_BASE_URL } from './api-environment';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiSuccessResponse<T> {
  success?: boolean;
  message?: string;
  data?: T;
  access_token?: string;
}

export interface ApiErrorPayload {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly payload?: ApiErrorPayload | unknown;

  constructor(
    message: string,
    status = 500,
    payload?: ApiErrorPayload | unknown,
  ) {
    super(message);

    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;

    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Backward-compatible alias.
 */
export { ApiError as ApiClientError };

export const ACCESS_TOKEN_KEY = 'access_token';
let authRedirectStarted = false;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  if (!isBrowser()) return;
  authRedirectStarted = false;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}

export function buildAuthHeaders(customHeaders?: HeadersInit): Headers {
  const headers = new Headers(customHeaders);

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return headers;
}

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // مسیرهای /api متعلق به Route Handlerهای Next.js هستند
  if (
    typeof window !== 'undefined' &&
    (normalizedPath === '/api' || normalizedPath.startsWith('/api/'))
  ) {
    return normalizedPath;
  }

  return `${API_BASE_URL}${normalizedPath}`;
}

function extractErrorMessage(
  payload: ApiErrorPayload | string | null,
  status: number,
): string {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.message) && payload.message.length > 0) {
      return payload.message.join(' | ');
    }

    if (
      typeof payload.message === 'string' &&
      payload.message.trim().length > 0
    ) {
      return payload.message;
    }

    if (
      typeof payload.error === 'string' &&
      payload.error.trim().length > 0
    ) {
      return payload.error;
    }
  }

  switch (status) {
    case 401:
      return 'دسترسی غیرمجاز است. لطفاً دوباره وارد حساب کاربری شوید.';
    case 403:
      return 'شما مجوز انجام این عملیات را ندارید.';
    case 404:
      return 'منبع موردنظر پیدا نشد.';
    case 422:
      return 'اطلاعات ارسال‌شده معتبر نیست.';
    default:
      return `خطا در ارتباط با سرور. کد خطا: ${status}`;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  let payload: unknown = null;

  if (isJson) {
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
  } else {
    try {
      payload = await response.text();
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearAccessToken();
      // هدایت خودکار کاربر به صفحه لاگین هنگام نامعتبر بودن یا انقضای توکن
      if (
        isBrowser() &&
        !authRedirectStarted &&
        !window.location.pathname.startsWith('/login')
      ) {
        authRedirectStarted = true;
        window.location.replace('/login');
      }
    }

    const errorPayload = payload as ApiErrorPayload | string | null;
    const message = extractErrorMessage(errorPayload, response.status);

    throw new ApiError(message, response.status, errorPayload);
  }

  return payload as T;
}

async function request<T>(
  path: string,
  method: HttpMethod,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const headers = buildAuthHeaders(init?.headers);

  const requestInit: RequestInit = {
    ...init,
    method,
    headers,
  };

  if (body !== undefined) {
    requestInit.body = JSON.stringify(body);
  }

  let response: Response;

  try {
    response = await fetch(buildUrl(path), requestInit);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'امکان برقراری ارتباط با سرور وجود ندارد.';

    if (isBrowser()) {
      useStatusStore.getState().pushLog({
        method,
        url: path,
        status: null,
        level: 'error',
        message: `عدم دسترسی به سرور: ${message}`,
      });
    }

    throw new ApiError(message, 0, error);
  }

  if (isBrowser()) {
    useStatusStore.getState().pushLog({
      method,
      url: path,
      status: response.status,
      level: levelFromStatus(response.status),
      message: response.ok
        ? `${method} ${path} با موفقیت انجام شد`
        : `خطای HTTP ${response.status} در ${method} ${path}`,
    });
  }

  return parseResponse<T>(response);
}

function unwrapData<T>(response: T | ApiSuccessResponse<T>): T {
  if (
    response !== null &&
    typeof response === 'object' &&
    'data' in (response as Record<string, unknown>)
  ) {
    return (response as ApiSuccessResponse<T>).data as T;
  }

  return response as T;
}

export const apiClient = {
  async get<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await request<T | ApiSuccessResponse<T>>(
      path,
      'GET',
      undefined,
      init,
    );
    return unwrapData<T>(response);
  },

  async post<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    init?: RequestInit,
  ): Promise<TResponse> {
    const response = await request<
      TResponse | ApiSuccessResponse<TResponse>
    >(path, 'POST', body, init);
    return unwrapData<TResponse>(response);
  },

  async put<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    init?: RequestInit,
  ): Promise<TResponse> {
    const response = await request<
      TResponse | ApiSuccessResponse<TResponse>
    >(path, 'PUT', body, init);
    return unwrapData<TResponse>(response);
  },

  async patch<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    init?: RequestInit,
  ): Promise<TResponse> {
    const response = await request<
      TResponse | ApiSuccessResponse<TResponse>
    >(path, 'PATCH', body, init);
    return unwrapData<TResponse>(response);
  },

  async delete<TResponse>(
    path: string,
    init?: RequestInit,
  ): Promise<TResponse> {
    const response = await request<
      TResponse | ApiSuccessResponse<TResponse>
    >(path, 'DELETE', undefined, init);
    return unwrapData<TResponse>(response);
  },

  async deleteWithBody<TResponse, TBody = unknown>(
    path: string,
    body: TBody,
    init?: RequestInit,
  ): Promise<TResponse> {
    const response = await request<
      TResponse | ApiSuccessResponse<TResponse>
    >(path, 'DELETE', body, init);
    return unwrapData<TResponse>(response);
  },
};

export function logout(): void {
  clearAccessToken();
  if (isBrowser()) {
    window.location.href = '/login';
  }
}
