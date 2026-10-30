// Path: frontend/src/lib/api/settings/settings-api.ts
// Frontend - Next.js
// این فایل مسئول برقراری ارتباط با APIهای بخش تنظیمات و سازمان در بک‌اند است.
//
// نکته مهم: apiClient مستقیماً به بک‌اند (NEXT_PUBLIC_API_BASE_URL یا
// http://localhost:3006) درخواست می‌زند و بک‌اند پیشوند /api ندارد؛
// بنابراین همه مسیرها باید بدون /api باشند. فقط مسیرهای پروکسی Next.js
// (زیر src/app/api/...) با پیشوند /api فراخوانی می‌شوند.

import { API_BASE_URL, apiClient, getAccessToken } from '@/lib/api-client';

export interface CompanySettings {
  id?: string;
  name: string;
  slug?: string;
  legalName?: string;
  registrationNumber?: string;
  nationalId?: string;
  economicCode?: string;
  taxOffice?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  postalCode?: string;
  currency?: string;
  fiscalYearStart?: string;
  logoUrl?: string;
  logoTone?: 'LIGHT' | 'DARK';
  logoBackground?: 'NONE' | 'DARK' | 'LIGHT';
  status?: string;
}

export interface OrganizationAccess {
  canView: boolean;
  canEdit: boolean;
  canViewRahcom: boolean;
  canManageRahcom: boolean;
}

export interface OrganizationBranding {
  name: string;
  logoUrl: string | null;
  logoTone: 'LIGHT' | 'DARK';
  logoBackground: 'NONE' | 'DARK' | 'LIGHT';
}

/*
 * فقط فیلدهایی که DTO بک‌اند برای
 * PUT /settings/organization/:id
 * قبول می‌کند.
 *
 * فیلدهایی مانند id، slug، ownerId، branches و departments
 * نباید در درخواست ویرایش سازمان ارسال شوند.
 */
export interface UpdateOrganizationSettingsRequest {
  name?: string;
  legalName?: string;
  nationalId?: string;
  registrationNumber?: string;
  economicCode?: string;
  taxOffice?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  postalCode?: string;
  currency?: string;
  fiscalYearStart?: string;
  logoUrl?: string;
  logoTone?: 'LIGHT' | 'DARK';
  logoBackground?: 'NONE' | 'DARK' | 'LIGHT';
  status?: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
}

export interface CreateOrganizationRequest {
  name: string;
  slug: string;
  legalName?: string;
  nationalId?: string;
  registrationNumber?: string;
  economicCode?: string;
  taxOffice?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  postalCode?: string;
  currency?: string;
  fiscalYearStart?: string;
  logoUrl?: string;
  logoTone?: 'LIGHT' | 'DARK';
  logoBackground?: 'NONE' | 'DARK' | 'LIGHT';
}

export interface CreateOrganizationResponse {
  organization: CompanySettings;
  membership: {
    id: string;
    organizationId: string;
    userId: string;
  };
  organizationId: string;
}

export interface BranchItem {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  postalCode?: string;
  isActive: boolean;
  isHeadquarters: boolean;
  isMain?: boolean;
  organizationId: string;
}

type BranchApiResponse = Omit<BranchItem, 'isHeadquarters' | 'isMain'> & {
  isHeadquarters?: boolean;
  isMain?: boolean;
};

function normalizeBranch(branch: BranchApiResponse): BranchItem {
  return { ...branch, isHeadquarters: branch.isHeadquarters ?? branch.isMain ?? false };
}

export interface DepartmentItem {
  id: string;
  name: string;
  code: string;
  branchId?: string;
  managerEmployeeId?: string | null;
  branch?: {
    id: string;
    name: string;
  };
}

export interface DepartmentEmployeeSummary {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  status: string;
  departmentId: string | null;
  managerId: string | null;
  manager: Pick<DepartmentEmployeeSummary, 'id' | 'firstName' | 'lastName' | 'jobTitle'> | null;
  roles: Array<{ key: string; name: string }>;
}

export interface DepartmentTeamSummary {
  id: string;
  name: string;
  code: string;
  manager: DepartmentEmployeeSummary | null;
  members: DepartmentEmployeeSummary[];
  memberCount: number;
}

export interface DepartmentOverview {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  branch: { id: string; name: string } | null;
  manager: DepartmentEmployeeSummary | null;
  employees: DepartmentEmployeeSummary[];
  teams: DepartmentTeamSummary[];
}

export interface DepartmentTeamPayload {
  name: string;
  code: string;
  managerEmployeeId?: string | null;
  employeeIds?: string[];
}

export interface UserRoleItem {
  id: string;
  name: string;
  key: string;
  description?: string | null;
}

export interface UserItem {
  id?: string;
  username: string;
  password?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  nationalId?: string | null;
  status?: string;
  isSystemUser?: boolean;
  role?: string | null;
  roleKey?: string | null;
  roles?: UserRoleItem[] | string[];
  roleIds?: string[];
  department?: string;
  branchId?: string | null;
  branchName?: string | null;
  departmentId?: string | null;
  isActive?: boolean;
}

export interface RoleItem {
  id: string;
  name: string;
  key: string;
  description?: string;
  userCount: number;
  permissions: string[];
  isSystemRole?: boolean;
}

/*
 * Payload ایمپورت ساختار سازمانی — دقیقاً مطابق ImportOrganizationDto بک‌اند:
 * - branches: name و code اجباری
 * - departments: name و code اجباری
 */
export interface OrganizationImportPayload {
  organizationId?: string;
  organization?: {
    name?: string;
    legalName?: string;
    nationalId?: string;
    registrationNumber?: string;
    economicCode?: string;
    taxOffice?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    postalCode?: string;
    currency?: string;
    fiscalYearStart?: string;
    logoUrl?: string;
    logoTone?: 'LIGHT' | 'DARK';
    logoBackground?: 'NONE' | 'DARK' | 'LIGHT';
  };
  branches: Array<{
    id?: string;
    name: string;
    code: string;
    address?: string;
    phone?: string;
    email?: string;
    postalCode?: string;
    isMain?: boolean;
    isActive?: boolean;
  }>;
  departments: Array<{
    id?: string;
    name: string;
    code: string;
    branchId?: string;
    branchName?: string;
    isActive?: boolean;
  }>;
}

/*
 * اعتبارسنجی organizationId قبل از هر درخواستی که به شناسه نیاز دارد.
 */
function assertOrgId(orgId: string | undefined | null): string {
  const id = (orgId ?? '').trim();
  if (!id) {
    throw new Error(
      'شناسه سازمان در دسترس نیست. کاربر به هیچ سازمانی متصل نیست یا توکن معتبر ندارد.',
    );
  }
  return encodeURIComponent(id);
}

export const settingsApi = {
  /*
   * GET /settings/organization/:id
   */
  async getCompanySettings(orgId: string): Promise<CompanySettings> {
    const id = assertOrgId(orgId);
    return apiClient.get<CompanySettings>(`/settings/organization/${id}`);
  },

  async uploadOrganizationLogo(
    orgId: string,
    file: File,
  ): Promise<{ logoUrl: string }> {
    const id = assertOrgId(orgId);
    const formData = new FormData();
    formData.append('file', file);

    const token = getAccessToken();
    const response = await fetch(
      `${API_BASE_URL}/settings/organization/${id}/logo`,
      {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      },
    );
    const result = (await response.json().catch(() => null)) as
      | { logoUrl?: string; message?: string | string[] }
      | null;

    if (!response.ok || !result?.logoUrl) {
      const message = Array.isArray(result?.message)
        ? result.message.join(' | ')
        : result?.message;
      throw new Error(message || 'بارگذاری لوگو انجام نشد.');
    }

    return { logoUrl: result.logoUrl };
  },

  async saveCompanySettings(
    data: CompanySettings,
    orgId: string,
  ): Promise<CompanySettings> {
    const payload: UpdateOrganizationSettingsRequest = {
      name: data.name,
      legalName: data.legalName,
      nationalId: data.nationalId,
      registrationNumber: data.registrationNumber,
      economicCode: data.economicCode,
      taxOffice: data.taxOffice,
      phone: data.phone,
      email: data.email,
      website: data.website,
      address: data.address,
      postalCode: data.postalCode,
      currency: data.currency,
      fiscalYearStart: data.fiscalYearStart,
      logoUrl: data.logoUrl,
      logoTone: data.logoTone,
      logoBackground: data.logoBackground,
    };

    const id = assertOrgId(orgId);
    return apiClient.put<CompanySettings>(
      `/settings/organization/${id}`,
      payload,
    );
  },

  /*
   * POST /settings/organization
   */
  async createCompany(
    data: CreateOrganizationRequest,
  ): Promise<CreateOrganizationResponse> {
    return apiClient.post<
      CreateOrganizationResponse,
      CreateOrganizationRequest
    >('/settings/organization', data);
  },

  async getBranches(orgId: string): Promise<BranchItem[]> {
    const id = assertOrgId(orgId);
    const branches = await apiClient.get<BranchApiResponse[]>(`/settings/branches/${id}`);
    return branches.map(normalizeBranch);
  },

  async createBranch(data: Omit<BranchItem, 'id'>): Promise<BranchItem> {
    assertOrgId(data.organizationId);
    const { isHeadquarters, isMain, ...rest } = data;
    const payload = { ...rest, isMain: isMain ?? isHeadquarters };
    const created = await apiClient.post<BranchApiResponse, typeof payload>(
      '/settings/branches',
      payload,
    );
    return normalizeBranch(created);
  },

  async updateBranch(
    id: string,
    data: Partial<BranchItem>,
  ): Promise<BranchItem> {
    const { organizationId: _ignored, isHeadquarters, isMain, ...rest } = data;
    const payload = { ...rest, ...((isHeadquarters !== undefined || isMain !== undefined) ? { isMain: isMain ?? isHeadquarters } : {}) };
    const updated = await apiClient.put<BranchApiResponse, typeof payload>(
      `/settings/branches/${encodeURIComponent(id)}`,
      payload,
    );
    return normalizeBranch(updated);
  },

  async deleteBranch(id: string): Promise<void> {
    await apiClient.delete<void>(`/settings/branches/${encodeURIComponent(id)}`);
  },

  async getDepartments(orgId: string): Promise<DepartmentItem[]> {
    const id = assertOrgId(orgId);
    return apiClient.get<DepartmentItem[]>(`/settings/departments/${id}`);
  },

  async getDepartmentOverview(id: string): Promise<DepartmentOverview> {
    return apiClient.get<DepartmentOverview>(
      `/settings/departments/${encodeURIComponent(id)}/overview`,
    );
  },

  async getBranchEmployees(id: string): Promise<DepartmentEmployeeSummary[]> {
    return apiClient.get<DepartmentEmployeeSummary[]>(`/settings/branches/${encodeURIComponent(id)}/employees`);
  },

  async getAvailableDepartmentEmployees(
    id: string,
  ): Promise<DepartmentEmployeeSummary[]> {
    return apiClient.get<DepartmentEmployeeSummary[]>(
      `/settings/departments/${encodeURIComponent(id)}/available-employees`,
    );
  },

  async setDepartmentManager(
    id: string,
    managerEmployeeId: string | null,
  ): Promise<DepartmentOverview> {
    return apiClient.put<DepartmentOverview>(
      `/settings/departments/${encodeURIComponent(id)}/manager`,
      { managerEmployeeId },
    );
  },

  async assignDepartmentEmployee(
    id: string,
    employeeId: string,
  ): Promise<DepartmentOverview> {
    return apiClient.post<DepartmentOverview>(
      `/settings/departments/${encodeURIComponent(id)}/employees`,
      { employeeId },
    );
  },

  async removeDepartmentEmployee(
    id: string,
    employeeId: string,
  ): Promise<DepartmentOverview> {
    return apiClient.delete<DepartmentOverview>(
      `/settings/departments/${encodeURIComponent(id)}/employees/${encodeURIComponent(employeeId)}`,
    );
  },

  async setEmployeeManager(
    departmentId: string,
    employeeId: string,
    managerId: string | null,
  ): Promise<DepartmentOverview> {
    return apiClient.put<DepartmentOverview>(
      `/settings/departments/${encodeURIComponent(departmentId)}/employees/${encodeURIComponent(employeeId)}/manager`,
      { managerId },
    );
  },

  async createDepartmentTeam(
    departmentId: string,
    data: DepartmentTeamPayload,
  ): Promise<DepartmentOverview> {
    return apiClient.post<DepartmentOverview>(
      `/settings/departments/${encodeURIComponent(departmentId)}/teams`,
      data,
    );
  },

  async updateDepartmentTeam(
    teamId: string,
    data: DepartmentTeamPayload,
  ): Promise<DepartmentOverview> {
    return apiClient.put<DepartmentOverview>(
      `/settings/teams/${encodeURIComponent(teamId)}`,
      data,
    );
  },

  async deleteDepartmentTeam(
    teamId: string,
  ): Promise<DepartmentOverview> {
    return apiClient.delete<DepartmentOverview>(
      `/settings/teams/${encodeURIComponent(teamId)}`,
    );
  },

  async createDepartment(
    data: Omit<DepartmentItem, 'id'> & { organizationId: string },
  ): Promise<DepartmentItem> {
    assertOrgId(data.organizationId);
    return apiClient.post<
      DepartmentItem,
      Omit<DepartmentItem, 'id'> & { organizationId: string }
    >('/settings/departments', data);
  },

  async updateDepartment(
    id: string,
    data: Partial<DepartmentItem>,
  ): Promise<DepartmentItem> {
    return apiClient.put<DepartmentItem, Partial<DepartmentItem>>(
      `/settings/departments/${encodeURIComponent(id)}`,
      data,
    );
  },

  async deleteDepartment(id: string): Promise<void> {
    await apiClient.delete<void>(
      `/settings/departments/${encodeURIComponent(id)}`,
    );
  },

  async getUsers(orgId: string): Promise<UserItem[]> {
    const id = assertOrgId(orgId);
    return apiClient.get<UserItem[]>(`/settings/users/${id}`);
  },

  async saveUsers(
    users: UserItem[],
    orgId: string,
  ): Promise<UserItem[]> {
    const id = assertOrgId(orgId);
    return apiClient.put<UserItem[], UserItem[]>(
      `/settings/users/${id}`,
      users,
    );
  },

  async removeUser(orgId: string, userId: string): Promise<UserItem[]> {
    const organization = assertOrgId(orgId);
    const user = encodeURIComponent(userId.trim());
    if (!user) throw new Error();
    return apiClient.delete<UserItem[]>(
      `/settings/users/${organization}/${user}`,
    );
  },

  async getRoles(orgId: string): Promise<RoleItem[]> {
    const id = assertOrgId(orgId);
    return apiClient.get<RoleItem[]>(`/settings/roles/${id}`);
  },

  async saveRoles(
    roles: RoleItem[],
    orgId: string,
  ): Promise<RoleItem[]> {
    const id = assertOrgId(orgId);
    return apiClient.put<RoleItem[], RoleItem[]>(`/settings/roles/${id}`, roles);
  },

  async importOrganization(
    orgId: string,
    data: OrganizationImportPayload,
  ): Promise<CompanySettings> {
    assertOrgId(orgId);
    return apiClient.post<CompanySettings, OrganizationImportPayload>(
      '/settings/organization/import',
      data,
    );
  },

  async getOrganization(orgId?: string): Promise<CompanySettings> {
    if (!orgId?.trim()) {
      throw new Error('شناسه سازمان برای دریافت اطلاعات الزامی است.');
    }
    return this.getCompanySettings(orgId);
  },

  async getOrganizationAccess(orgId: string): Promise<OrganizationAccess> {
    const id = assertOrgId(orgId);
    return apiClient.get<OrganizationAccess>(
      `/settings/organization/${id}/access`,
    );
  },

  async getOrganizationShellVisibility(orgId: string): Promise<{ shellVisibility: Record<string, unknown> }> {
    const id = assertOrgId(orgId);
    return apiClient.get(`/settings/organization/${id}/shell-visibility`);
  },

  async updateOrganizationShellVisibility(orgId: string, shellVisibility: Record<string, unknown>): Promise<{ shellVisibility: Record<string, unknown> }> {
    const id = assertOrgId(orgId);
    return apiClient.put(`/settings/organization/${id}/shell-visibility`, { shellVisibility });
  },

  async getOrganizationBranding(
    orgId: string,
  ): Promise<OrganizationBranding> {
    const id = assertOrgId(orgId);
    return apiClient.get<OrganizationBranding>(
      `/settings/organization/${id}/branding`,
    );
  },

  async updateOrganization(
    data: CompanySettings,
    orgId?: string,
  ): Promise<CompanySettings> {
    if (!orgId?.trim()) {
      throw new Error('شناسه سازمان برای ذخیره‌سازی الزامی است.');
    }
    return this.saveCompanySettings(data, orgId);
  },
};

export function resolveOrganizationLogoUrl(
  logoUrl?: string | null,
): string | null {
  if (!logoUrl) return null;
  if (logoUrl.startsWith('/uploads/')) return `${API_BASE_URL}${logoUrl}`;
  return logoUrl;
}

export const getUsers = (orgId: string): Promise<UserItem[]> =>
  settingsApi.getUsers(orgId);

export const saveUsers = (
  users: UserItem[],
  orgId: string,
): Promise<UserItem[]> => settingsApi.saveUsers(users, orgId);

export const getRoles = (orgId: string): Promise<RoleItem[]> =>
  settingsApi.getRoles(orgId);

export const saveRoles = (
  roles: RoleItem[],
  orgId: string,
): Promise<RoleItem[]> => settingsApi.saveRoles(roles, orgId);
