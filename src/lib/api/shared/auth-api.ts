// frontend/src/lib/api/shared/auth-api.ts

import {
  apiClient,
  ApiError,
  ApiClientError,
  clearAccessToken,
  getAccessToken,
  isAuthenticated,
  setAccessToken,
} from '@/lib/api-client';

export { ApiError, ApiClientError };

export interface AuthUser {
  id?: string;
  name: string;
  email?: string;
  role?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  phone?: string;
  organizationId?: string | null;
}

export interface MyProfile {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  email: string | null;
  phone: string | null;
  organizationId?: string | null;
}

export interface OrganizationDirectoryEmployee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  status: 'ACTIVE' | 'ON_LEAVE';
  branchId: string | null;
  departmentId: string | null;
  managerId: string | null;
  branch: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  manager: Pick<OrganizationDirectoryEmployee, 'id' | 'firstName' | 'lastName' | 'jobTitle'> | null;
}

export interface OrganizationDirectory {
  organization: {
    id: string;
    name: string;
    legalName: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    address: string | null;
    branches: Array<{
      id: string;
      name: string;
      code: string;
      address: string | null;
      phone: string | null;
      email: string | null;
      isMain: boolean;
    }>;
    departments: Array<{
      id: string;
      name: string;
      code: string;
      branchId: string | null;
      branch: { id: string; name: string } | null;
      manager: Pick<OrganizationDirectoryEmployee, 'id' | 'firstName' | 'lastName' | 'jobTitle'> | null;
    }>;
  };
  employees: OrganizationDirectoryEmployee[];
}

export interface UpdateMyProfile {
  firstName: string;
  lastName: string;
  phone: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface AuthResponseUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string;
  organizationId?: string | null;
}

export interface AuthResponse {
  access_token: string;
  user: AuthResponseUser;
}

const USER_STORAGE_KEY = 'auth_user';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function getUserDisplayName(user: {
  name?: string;
  firstName?: string;
  lastName?: string;
}): string {
  if (user.name) return user.name;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || 'کاربر';
}

function normalizeUser(
  responseUser: AuthResponseUser | undefined,
  fallback: Partial<AuthUser> = {},
): AuthUser {
  const firstName = responseUser?.firstName ?? fallback.firstName;
  const lastName = responseUser?.lastName ?? fallback.lastName;

  return {
    id: responseUser?.id ?? fallback.id,
    name: getUserDisplayName({
      firstName,
      lastName,
      name: fallback.name,
    }),
    email: responseUser?.email ?? fallback.email ?? undefined,
    role: responseUser?.role ?? fallback.role ?? 'user',
    username: responseUser?.username ?? fallback.username,
    firstName,
    lastName,
    avatarUrl: responseUser?.avatarUrl ?? fallback.avatarUrl ?? null,
    phone: responseUser?.phone ?? fallback.phone,
    organizationId: responseUser?.organizationId ?? fallback.organizationId ?? null,
  };
}

function saveUser(user: AuthUser): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

function clearUser(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(USER_STORAGE_KEY);
}

function persistSession(response: AuthResponse, fallbackUser: Partial<AuthUser>): AuthUser {
  if (response.access_token) {
    setAccessToken(response.access_token);
  }

  const user = normalizeUser(response.user, fallbackUser);
  saveUser(user);
  if (isBrowser()) window.dispatchEvent(new Event('auth:login'));
  return user;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const response = await apiClient.post<
    AuthResponse,
    { identifier: string; password: string }
  >('/auth/login', {
    identifier: payload.email,
    password: payload.password, // FIX
  });

  persistSession(response, {
    name: payload.email.split('@')[0] || 'کاربر',
    email: payload.email,
  });

  return response;
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse, RegisterPayload>('/auth/register', {
    username: payload.username,
    email: payload.email || undefined,
    phone: payload.phone || undefined,
    firstName: payload.firstName,
    lastName: payload.lastName,
    password: payload.password, // FIX
  });

  persistSession(response, {
    name: `${payload.firstName} ${payload.lastName}`.trim(),
    email: payload.email,
    phone: payload.phone,
    username: payload.username,
    firstName: payload.firstName,
    lastName: payload.lastName,
  });

  return response;
}

export function getCurrentUser(): AuthUser | null {
  if (!isBrowser()) return null;

  const rawUser = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser) as AuthUser;
  } catch {
    clearUser();
    return null;
  }
}

export async function getMyProfile(): Promise<MyProfile> {
  const response = await apiClient.get<{ user: MyProfile }>('/auth/me');
  return response.user;
}

export async function updateMyProfile(data: UpdateMyProfile): Promise<MyProfile> {
  const response = await apiClient.patch<{ user: MyProfile }, UpdateMyProfile>('/auth/me', data);
  const cached = getCurrentUser();
  if (cached) {
    saveUser({
      ...cached,
      id: response.user.id,
      username: response.user.username,
      firstName: response.user.firstName,
      lastName: response.user.lastName,
      avatarUrl: response.user.avatarUrl ?? cached.avatarUrl ?? null,
      name: getUserDisplayName(response.user),
      email: response.user.email ?? undefined,
      phone: response.user.phone ?? undefined,
      organizationId: response.user.organizationId ?? cached.organizationId ?? null,
    });
    if (isBrowser()) window.dispatchEvent(new Event('auth:user-updated'));
  }
  return response.user;
}

export async function getOrganizationDirectory(): Promise<OrganizationDirectory | null> {
  return apiClient.get<OrganizationDirectory | null>('/auth/organization-directory');
}

export function getCurrentOrganizationId(): string | null {
  return getCurrentUser()?.organizationId ?? null;
}

export function isUserAuthenticated(): boolean {
  return Boolean(getAccessToken() || isAuthenticated() || getCurrentUser());
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } catch (error) {
    console.warn('Logout request failed:', error);
  } finally {
    clearAccessToken();
    clearUser();

    if (isBrowser()) {
      window.dispatchEvent(new Event('auth:logout'));
    }
  }
}
