// File: frontend/src/app/(workspace)/settings/users/users-json.ts
// Frontend - منطق JSON حساب‌های کاربری: نمونه، اعتبارسنجی و تبدیل داده‌ها

import type { UserItem, UserRoleItem } from '@/lib/api/settings/settings-api';

/**
 * ساختار هر کاربر در فایل JSON ورودی و خروجی.
 */
export interface UserImportData {
  id?: string;
  name: string;
  username?: string;
  password?: string;
  email: string;
  role: string;
  department?: string;
  isActive?: boolean;
}

/**
 * ساختار کامل فایل JSON کاربران.
 */
export interface UsersImportData {
  users: UserImportData[];
}

/**
 * نتیجهٔ تبدیل اطلاعات ورودی به مدل داخلی تنظیمات.
 */
export interface UsersImportResult {
  users: UserItem[];
}

/**
 * فایل نمونه برای دانلود از رابط کاربری همراه با کاربر دمو.
 */
export const usersImportSample: UsersImportData = {
  users: [
    {
      name: 'کاربر نمایشی (دمو)',
      username: 'demo',
      password: 'GAPGPTMASKTOKENin931f88goX0X',
      email: 'demo@example.com',
      role: 'ADMIN',
      department: 'فناوری اطلاعات',
      isActive: true,
    },
    {
      name: 'علی رضایی',
      username: 'ali.rezaei',
      password: 'GAPGPTMASKTOKENin931f88goX1X',
      email: 'ali.rezaei@example.com',
      role: 'ADMIN',
      department: 'مدیریت',
      isActive: true,
    },
    {
      name: 'مریم احمدی',
      username: 'maryam.a',
      password: 'GAPGPTMASKTOKENin931f88goX2X',
      email: 'maryam.ahmadi@example.com',
      role: 'ACCOUNTANT',
      department: 'امور مالی',
      isActive: true,
    },
    {
      name: 'سارا کریمی',
      username: 'sara.k',
      password: 'GAPGPTMASKTOKENin931f88goX3X',
      email: 'sara.karimi@example.com',
      role: 'HR_MANAGER',
      department: 'منابع انسانی',
      isActive: true,
    },
    {
      name: 'رضا محمدی',
      username: 'reza.m',
      password: 'GAPGPTMASKTOKENin931f88goX4X',
      email: 'reza.mohammadi@example.com',
      role: 'USER',
      department: 'فروش',
      isActive: false,
    },
  ],
};

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue || undefined;
}

function normalizeRequiredString(value: unknown): string {
  return normalizeOptionalString(value) ?? '';
}

function normalizeEmail(value: unknown): string {
  return normalizeRequiredString(value).toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseUser(
  item: unknown,
  index: number,
  errors: string[],
): UserImportData | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    errors.push(`کاربر ردیف ${index + 1}: ساختار داده نامعتبر است.`);
    return null;
  }

  const record = item as Record<string, unknown>;

  const id = normalizeOptionalString(record.id);
  const name = normalizeRequiredString(record.name);
  const username = normalizeOptionalString(record.username);
  const password = normalizeOptionalString(record.password);
  const email = normalizeEmail(record.email);
  const role = normalizeRequiredString(record.role);
  const department = normalizeOptionalString(record.department);

  if (!name) {
    errors.push(`کاربر ردیف ${index + 1}: فیلد «name» الزامی است.`);
  }

  if (!email) {
    errors.push(`کاربر ردیف ${index + 1}: فیلد «email» الزامی است.`);
  } else if (!isValidEmail(email)) {
    errors.push(`کاربر ردیف ${index + 1}: ایمیل «${email}» معتبر نیست.`);
  }

  if (!role) {
    errors.push(`کاربر ردیف ${index + 1}: فیلد «role» الزامی است.`);
  }

  if (
    record.isActive !== undefined &&
    typeof record.isActive !== 'boolean'
  ) {
    errors.push(
      `کاربر ردیف ${index + 1}: فیلد «isActive» باید مقدار boolean داشته باشد.`,
    );
  }

  if (!name || !email || !isValidEmail(email) || !role) {
    return null;
  }

  return {
    id,
    name,
    username,
    password,
    email,
    role,
    department,
    isActive:
      typeof record.isActive === 'boolean'
        ? record.isActive
        : true,
  };
}

export function parseUsersImportData(rawData: unknown): UsersImportData {
  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
    throw new Error(
      'ساختار فایل نامعتبر است. فایل باید یک شیء JSON شامل آرایهٔ «users» باشد.',
    );
  }

  const data = rawData as Record<string, unknown>;
  const rawUsers = data.users;
  const errors: string[] = [];

  if (!Array.isArray(rawUsers)) {
    throw new Error('بخش «users» باید یک آرایه باشد.');
  }

  if (rawUsers.length === 0) {
    throw new Error('حداقل یک کاربر باید در بخش «users» ثبت شده باشد.');
  }

  const users: UserImportData[] = [];
  const normalizedEmails = new Set<string>();
  const normalizedIds = new Set<string>();

  rawUsers.forEach((item, index) => {
    const parsedUser = parseUser(item, index, errors);

    if (!parsedUser) {
      return;
    }

    const emailKey = parsedUser.email.toLowerCase();

    if (normalizedEmails.has(emailKey)) {
      errors.push(`ایمیل تکراری در فایل: «${parsedUser.email}»`);
    } else {
      normalizedEmails.add(emailKey);
    }

    if (parsedUser.id) {
      const idKey = parsedUser.id.toLowerCase();

      if (normalizedIds.has(idKey)) {
        errors.push(`شناسهٔ تکراری در فایل: «${parsedUser.id}»`);
      } else {
        normalizedIds.add(idKey);
      }
    }

    users.push(parsedUser);
  });

  if (errors.length > 0) {
    throw new Error(errors.slice(0, 10).join('\n'));
  }

  return { users };
}

/**
 * تبدیل داده‌های اعتبارسنجی‌شده به ساختار کامل UserItem با تمامی فیلدهای الزامی
 */
export function usersImportDataToItems(
  data: UsersImportData,
): UsersImportResult {
  return {
    users: data.users.map((user): UserItem => {
      const trimmedName = user.name.trim();
      const nameParts = trimmedName ? trimmedName.split(/\s+/) : [];
      const firstName = nameParts[0] || user.name || '';
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      const username = user.username || user.email.split('@')[0] || `user_${Date.now()}`;
      const isActive = user.isActive ?? true;

      const roleItem: UserRoleItem = {
        id: `role-${user.role.toLowerCase()}`,
        key: user.role,
        name: user.role,
      };

      const generatedId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `usr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      return {
        id: user.id || generatedId,
        username,
        name: user.name,
        firstName,
        lastName,
        email: user.email,
        phone: null,
        status: isActive ? 'ACTIVE' : 'DISABLED',
        isSystemUser: false,
        role: user.role,
        roleKey: user.role,
        roles: [roleItem],
        department: user.department || 'عمومی',
        isActive,
      };
    }),
  };
}

export function parseUsersToItems(rawData: unknown): UsersImportResult {
  const parsedData = parseUsersImportData(rawData);
  return usersImportDataToItems(parsedData);
}

export function usersToExportData(users: UserItem[]): UsersImportData {
  return {
    users: users.map((user) => {
      const firstRole = user.roles?.[0];
      const roleFromRoles =
        typeof firstRole === 'string'
          ? firstRole
          : firstRole?.key;

      return {
        name: user.name || 'نامشخص',
        username: user.username,
        email: user.email ?? '',
        role: user.role || roleFromRoles || 'USER',
        department: user.department || undefined,
        isActive: user.isActive ?? (user.status === 'ACTIVE'),
      };
    }),
  };
}
