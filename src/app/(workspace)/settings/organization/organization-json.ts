// Frontend — src/app/(workspace)/settings/general/organization-json.ts
// منطق JSON ساختار سازمانی: نمونه، اعتبارسنجی و تبدیل شعب و دپارتمان‌ها.

import type {
  BranchItem,
  DepartmentItem,
  OrganizationImportPayload,
} from '@/lib/api/settings/settings-api';

/**
 * دادهٔ هر شعبه در فایل JSON ورودی/خروجی.
 *
 * organizationId از فایل JSON گرفته نمی‌شود؛
 * بک‌اند سازمان کاربر احراز هویت‌شده را تشخیص می‌دهد.
 */
export type OrganizationStructureBranchData = {
  name: string;
  code: string;
  phone?: string;
  email?: string;
  address?: string;
  postalCode?: string;
  isMain?: boolean;
};

/**
 * دادهٔ هر دپارتمان در فایل JSON ورودی/خروجی.
 *
 * به جای branchId از branchName استفاده می‌شود تا فایل JSON
 * به شناسه‌های داخلی دیتابیس وابسته نباشد.
 */
export type OrganizationStructureDepartmentData = {
  name: string;
  code: string;
  description?: string;
  branchName?: string;
};

/**
 * ساختار کامل فایل Import/Export ساختار سازمانی.
 */
export type OrganizationStructureImportData = {
  branches: OrganizationStructureBranchData[];
  departments: OrganizationStructureDepartmentData[];
};

/**
 * دادهٔ نمونه برای دانلود و تکمیل توسط کاربر.
 */
export const organizationStructureImportSample: OrganizationStructureImportData =
  {
    branches: [
      {
        name: 'شعبه مرکزی تهران',
        code: 'TEH-001',
        phone: '02112345678',
        email: 'tehran@example.com',
        address: 'تهران، خیابان نمونه، پلاک ۱',
        postalCode: '1234567890',
        isMain: true,
      },
      {
        name: 'شعبه اصفهان',
        code: 'ISF-001',
        phone: '03112345678',
        email: 'isfahan@example.com',
        address: 'اصفهان، خیابان نمونه، پلاک ۲',
        postalCode: '8134567890',
        isMain: false,
      },
    ],
    departments: [
      {
        name: 'مدیریت مالی',
        code: 'FIN',
        description: 'مسئول امور مالی، حسابداری و پرداخت‌ها',
        branchName: 'شعبه مرکزی تهران',
      },
      {
        name: 'منابع انسانی',
        code: 'HR',
        description: 'مسئول امور کارکنان و استخدام',
        branchName: 'شعبه مرکزی تهران',
      },
      {
        name: 'فروش اصفهان',
        code: 'SALE-ISF',
        description: 'واحد فروش و ارتباط با مشتریان در اصفهان',
        branchName: 'شعبه اصفهان',
      },
    ],
  };

function getOptionalString(
  source: Record<string, unknown>,
  fieldName: string,
): string | undefined {
  const value = source[fieldName];

  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(`فیلد «${fieldName}» باید از نوع متن باشد.`);
  }

  return value.trim() || undefined;
}

function getRequiredString(
  source: Record<string, unknown>,
  fieldName: string,
  label: string,
): string {
  const value = getOptionalString(source, fieldName);

  if (!value) {
    throw new Error(`فیلد «${label}» الزامی است.`);
  }

  return value;
}

function parseBranch(
  rawBranch: unknown,
  index: number,
): OrganizationStructureBranchData {
  if (
    !rawBranch ||
    typeof rawBranch !== 'object' ||
    Array.isArray(rawBranch)
  ) {
    throw new Error(`اطلاعات شعبه در ردیف ${index + 1} معتبر نیست.`);
  }

  const branch = rawBranch as Record<string, unknown>;
  const email = getOptionalString(branch, 'email');
  const isMain = branch.isMain;

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`ایمیل شعبه در ردیف ${index + 1} معتبر نیست.`);
  }

  if (
    isMain !== undefined &&
    isMain !== null &&
    typeof isMain !== 'boolean'
  ) {
    throw new Error(
      `فیلد «isMain» در شعبه ردیف ${index + 1} باید true یا false باشد.`,
    );
  }

  return {
    name: getRequiredString(branch, 'name', `نام شعبه در ردیف ${index + 1}`),
    code: getRequiredString(branch, 'code', `کد شعبه در ردیف ${index + 1}`),
    phone: getOptionalString(branch, 'phone'),
    email,
    address: getOptionalString(branch, 'address'),
    postalCode: getOptionalString(branch, 'postalCode'),
    isMain: isMain as boolean | undefined,
  };
}

function parseDepartment(
  rawDepartment: unknown,
  index: number,
  branchNames: Set<string>,
): OrganizationStructureDepartmentData {
  if (
    !rawDepartment ||
    typeof rawDepartment !== 'object' ||
    Array.isArray(rawDepartment)
  ) {
    throw new Error(`اطلاعات دپارتمان در ردیف ${index + 1} معتبر نیست.`);
  }

  const department = rawDepartment as Record<string, unknown>;
  const branchName = getOptionalString(department, 'branchName');

  if (branchName && !branchNames.has(branchName)) {
    throw new Error(
      `شعبه «${branchName}» برای دپارتمان ردیف ${
        index + 1
      } در فهرست شعب فایل پیدا نشد.`,
    );
  }

  return {
    name: getRequiredString(
      department,
      'name',
      `نام دپارتمان در ردیف ${index + 1}`,
    ),
    code: getRequiredString(
      department,
      'code',
      `کد دپارتمان در ردیف ${index + 1}`,
    ),
    description: getOptionalString(department, 'description'),
    branchName,
  };
}

/**
 * باز کردن wrapperهای احتمالی فایل JSON (مانند خروجی export بک‌اند).
 */
function unwrapImportRoot(
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (Array.isArray(data.branches)) {
    return data;
  }

  const potentialWrappers = ['organization', 'data', 'result'] as const;

  for (const key of potentialWrappers) {
    const wrapper = data[key];
    if (
      wrapper &&
      typeof wrapper === 'object' &&
      !Array.isArray(wrapper) &&
      Array.isArray((wrapper as Record<string, unknown>).branches)
    ) {
      return wrapper as Record<string, unknown>;
    }
  }

  return data;
}

/**
 * اعتبارسنجی فایل JSON ساختار سازمانی.
 *
 * قواعد:
 * - ریشهٔ فایل باید Object باشد.
 * - branches و departments باید آرایه باشند.
 * - نام و کد شعبه نباید تکراری باشد.
 * - تنها یک شعبه می‌تواند isMain: true داشته باشد.
 * - هر branchName در دپارتمان باید به شعبه‌ای در همان فایل اشاره کند.
 * - نام دپارتمان در هر شعبه نباید تکراری باشد.
 */
export function parseOrganizationStructureImportData(
  rawData: unknown,
): OrganizationStructureImportData {
  if (
    !rawData ||
    typeof rawData !== 'object' ||
    Array.isArray(rawData)
  ) {
    throw new Error(
      'ساختار فایل نامعتبر است. ریشه فایل باید یک شیء JSON باشد.',
    );
  }

  const unwrapped = unwrapImportRoot(rawData as Record<string, unknown>);

  if (!Array.isArray(unwrapped.branches)) {
    throw new Error('فیلد «branches» باید یک آرایه از شعب باشد.');
  }

  if (!Array.isArray(unwrapped.departments)) {
    throw new Error(
      'فیلد «departments» باید یک آرایه از دپارتمان‌ها باشد.',
    );
  }

  const branches = (unwrapped.branches as unknown[]).map(parseBranch);
  const branchNames = new Set<string>();
  const branchCodes = new Set<string>();
  let mainBranchCount = 0;

  for (const branch of branches) {
    if (branchNames.has(branch.name)) {
      throw new Error(`نام شعبه «${branch.name}» تکراری است.`);
    }

    if (branchCodes.has(branch.code)) {
      throw new Error(`کد شعبه «${branch.code}» تکراری است.`);
    }

    if (branch.isMain) {
      mainBranchCount += 1;
    }

    branchNames.add(branch.name);
    branchCodes.add(branch.code);
  }

  if (mainBranchCount > 1) {
    throw new Error('در فایل JSON فقط یک شعبه می‌تواند شعبه اصلی باشد.');
  }

  const departments = (unwrapped.departments as unknown[]).map(
    (department, index) => parseDepartment(department, index, branchNames),
  );

  const departmentKeys = new Set<string>();

  for (const department of departments) {
    const uniqueKey = `${
      department.branchName || 'بدون-شعبه'
    }::${department.name}`;

    if (departmentKeys.has(uniqueKey)) {
      throw new Error(
        `دپارتمان «${department.name}» در شعبه «${
          department.branchName || 'بدون شعبه'
        }» تکراری است.`,
      );
    }

    departmentKeys.add(uniqueKey);
  }

  return {
    branches,
    departments,
  };
}

/**
 * تبدیل اطلاعات معتبر JSON به payload مورد انتظار API.
 */
export function organizationStructureToApiPayload(
  data: OrganizationStructureImportData,
): OrganizationImportPayload {
  return {
    branches: data.branches.map((branch) => ({
      name: branch.name,
      code: branch.code,
      phone: branch.phone,
      email: branch.email,
      address: branch.address,
      postalCode: branch.postalCode,
      isActive: true,
      isMain: branch.isMain,
    })),
    departments: data.departments.map((department) => ({
      name: department.name,
      code: department.code,
      description: department.description,
      branchName: department.branchName,
    })),
  };
}

/**
 * تبدیل اطلاعات دریافتی از API به فایل JSON قابل دانلود.
 *
 * نام شعبه، به جای شناسهٔ دیتابیس، در branchName قرار می‌گیرد.
 */
export function organizationStructureToExportData(
  branches: BranchItem[],
  departments: DepartmentItem[],
): OrganizationStructureImportData {
  return {
    branches: branches.map((branch) => ({
      name: branch.name,
      code: branch.code || '',
      phone: branch.phone || undefined,
      email: branch.email || undefined,
      address: branch.address || undefined,
      postalCode: branch.postalCode || undefined,
      isMain: branch.isHeadquarters ?? branch.isActive ?? false,
    })),
    departments: departments.map((department) => ({
      name: department.name,
      code: department.code || '',
      branchName: department.branch?.name || undefined,
    })),
  };
}
