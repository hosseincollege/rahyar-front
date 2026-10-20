// File: frontend/src/app/(workspace)/settings/users/roles-json.ts

import type { RoleItem } from '@/lib/api/settings/settings-api';

export type RoleImportData = {
  key?: string;
  name: string;
  description?: string | null;
  permissions: string[];
};

export type RolesImportData = {
  roles: RoleImportData[];
};

export type ImportedRoleItem = Omit<RoleItem, 'id' | 'userCount'>;

export const rolesImportSample: RolesImportData = {
  roles: [
    {
      key: 'ADMIN',
      name: 'مدیر سیستم',
      description: 'دسترسی کامل به تنظیمات و عملیات سازمان',
      permissions: [
        'settings.read',
        'settings.write',
        'users.read',
        'users.write',
      ],
    },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getRequiredString(
  value: unknown,
  fieldName: string,
  index: number,
): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(
      `فیلد «${fieldName}» برای نقش شماره ${index + 1} الزامی است.`,
    );
  }

  return value.trim();
}

function getOptionalString(
  value: unknown,
  fieldName: string,
  index: number,
): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(
      `فیلد «${fieldName}» برای نقش شماره ${index + 1} باید متن باشد.`,
    );
  }

  return value.trim() || undefined;
}

function getPermissions(value: unknown, index: number): string[] {
  if (!Array.isArray(value)) {
    throw new Error(
      `فیلد «permissions» برای نقش شماره ${index + 1} باید یک آرایه باشد.`,
    );
  }

  const permissions = value.map((permission, permissionIndex) => {
    if (typeof permission !== 'string' || !permission.trim()) {
      throw new Error(
        `دسترسی شماره ${permissionIndex + 1} در نقش شماره ${
          index + 1
        } معتبر نیست.`,
      );
    }

    return permission.trim();
  });

  const uniquePermissions = [...new Set(permissions)];

  if (uniquePermissions.length !== permissions.length) {
    throw new Error(
      `دسترسی‌های تکراری در نقش شماره ${index + 1} مجاز نیستند.`,
    );
  }

  return uniquePermissions;
}

/**
 * اعتبارسنجی محتوای JSON ورودی نقش‌ها.
 */
export function parseRolesImportData(value: unknown): RolesImportData {
  if (!isRecord(value)) {
    throw new Error('ساختار فایل JSON نقش‌ها معتبر نیست.');
  }

  if (!Array.isArray(value.roles)) {
    throw new Error('فیلد «roles» باید یک آرایه باشد.');
  }

  if (value.roles.length === 0) {
    throw new Error('فایل درون‌ریزی باید حداقل شامل یک نقش باشد.');
  }

  const roleNames = new Set<string>();
  const roleKeys = new Set<string>();

  const roles = value.roles.map((item, index): RoleImportData => {
    if (!isRecord(item)) {
      throw new Error(`اطلاعات نقش شماره ${index + 1} معتبر نیست.`);
    }

    const name = getRequiredString(item.name, 'name', index);
    const key = getOptionalString(item.key, 'key', index);
    const description = getOptionalString(
      item.description,
      'description',
      index,
    );
    const permissions = getPermissions(item.permissions, index);

    const normalizedName = name.toLocaleLowerCase('fa-IR');

    if (roleNames.has(normalizedName)) {
      throw new Error(`نام نقش «${name}» در فایل تکراری است.`);
    }

    roleNames.add(normalizedName);

    if (key) {
      const normalizedKey = key.toUpperCase();

      if (roleKeys.has(normalizedKey)) {
        throw new Error(`کلید نقش «${key}» در فایل تکراری است.`);
      }

      roleKeys.add(normalizedKey);
    }

    return {
      name,
      ...(key ? { key: key.toUpperCase() } : {}),
      ...(description ? { description } : {}),
      permissions,
    };
  });

  return { roles };
}

/**
 * تبدیل دادهٔ JSON به مدل قابل ذخیره‌سازی.
 */
export function rolesImportDataToItems(
  data: RolesImportData,
): ImportedRoleItem[] {
  return data.roles.map((role): ImportedRoleItem => ({
    key: role.key ?? '',
    name: role.name,
    ...(role.description
      ? { description: role.description }
      : {}),
    permissions: role.permissions,
  }));
}

/**
 * تبدیل نقش‌های API به ساختار قابل خروجی گرفتن در JSON.
 */
export function rolesToExportData(roles: RoleItem[]): RolesImportData {
  return {
    roles: roles.map((role) => ({
      ...(role.key ? { key: role.key } : {}),
      name: role.name.trim(),
      ...(role.description?.trim()
        ? { description: role.description.trim() }
        : {}),
      permissions: [...new Set(role.permissions.map((item) => item.trim()))]
        .filter(Boolean)
        .sort(),
    })),
  };
}
