// Frontend — src/app/(workspace)/settings/general/company-json.ts

/**
 * ساختار فایل JSON برای Import/Export تنظیمات شرکت.
 *
 * این فیلدها با DTO بک‌اند هماهنگ‌اند:
 * backend/src/settings/dto/update-organization-settings.dto.ts
 */
export type CompanyImportData = {
  name: string;
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
};

/**
 * داده‌ای که با دکمهٔ «دانلود فایل نمونه» به کاربر داده می‌شود.
 */
export const companyImportSample: CompanyImportData = {
  name: "شرکت نمونه",
  legalName: "شرکت نمونه ایرانیان",
  registrationNumber: "12345",
  nationalId: "12345678901",
  economicCode: "123456789012",
  taxOffice: "حوزه مالیاتی تهران",
  phone: "02112345678",
  email: "info@example.com",
  website: "https://example.com",
  address: "تهران، خیابان نمونه، پلاک ۱",
  postalCode: "1234567890",
  currency: "IRR",
  fiscalYearStart: "1405-01-01",
  logoUrl: "",
  logoTone: 'DARK',
  logoBackground: 'NONE',
};

/**
 * JSON خوانده‌شده از فایل کاربر را بررسی و به payload معتبر تبدیل می‌کند.
 * در صورت نامعتبر بودن فایل، Error پرتاب می‌شود تا UI آن را به کاربر نمایش دهد.
 */
export function parseCompanyImportData(rawData: unknown): CompanyImportData {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
    throw new Error(
      "ساختار فایل نامعتبر است. فایل باید یک شیء JSON شامل اطلاعات شرکت باشد.",
    );
  }

  const data = rawData as Record<string, unknown>;

  const getOptionalString = (fieldName: string): string | undefined => {
    const value = data[fieldName];

    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    if (typeof value !== "string") {
      throw new Error(`فیلد «${fieldName}» باید از نوع متن باشد.`);
    }

    return value.trim() || undefined;
  };

  const name = getOptionalString("name");

  if (!name) {
    throw new Error("فیلد «name» یا نام شرکت الزامی است.");
  }

  const email = getOptionalString("email");

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("مقدار فیلد «email» معتبر نیست.");
  }

  const website = getOptionalString("website");
  const logoTone = getOptionalString("logoTone");
  const logoBackground = getOptionalString("logoBackground");

  if (logoTone && logoTone !== 'LIGHT' && logoTone !== 'DARK') {
    throw new Error("فیلد «logoTone» باید LIGHT یا DARK باشد.");
  }

  if (logoBackground && !['NONE', 'DARK', 'LIGHT'].includes(logoBackground)) {
    throw new Error('INVALID_LOGO_BACKGROUND');
  }

  if (website) {
    try {
      new URL(website);
    } catch {
      throw new Error(
        "مقدار فیلد «website» معتبر نیست. نمونه: https://example.com",
      );
    }
  }

  return {
    name,
    legalName: getOptionalString("legalName"),
    registrationNumber: getOptionalString("registrationNumber"),
    nationalId: getOptionalString("nationalId"),
    economicCode: getOptionalString("economicCode"),
    taxOffice: getOptionalString("taxOffice"),
    phone: getOptionalString("phone"),
    email,
    website,
    address: getOptionalString("address"),
    postalCode: getOptionalString("postalCode"),
    currency: getOptionalString("currency"),
    fiscalYearStart: getOptionalString("fiscalYearStart"),
    logoUrl: getOptionalString("logoUrl"),
    logoTone: (logoTone as 'LIGHT' | 'DARK' | undefined) || 'DARK',
    logoBackground: (logoBackground as 'NONE' | 'DARK' | 'LIGHT' | undefined) || 'NONE',
  };
}

/**
 * دادهٔ فعلی فرم شرکت را برای دانلود به فایل JSON تبدیل می‌کند.
 * فیلدهای داخلی مانند id، slug و status عمداً Export نمی‌شوند.
 */
export function companyToExportData(
  company: Partial<CompanyImportData>,
): CompanyImportData {
  return {
    name: company.name?.trim() || "",
    legalName: company.legalName?.trim() || undefined,
    registrationNumber: company.registrationNumber?.trim() || undefined,
    nationalId: company.nationalId?.trim() || undefined,
    economicCode: company.economicCode?.trim() || undefined,
    taxOffice: company.taxOffice?.trim() || undefined,
    phone: company.phone?.trim() || undefined,
    email: company.email?.trim() || undefined,
    website: company.website?.trim() || undefined,
    address: company.address?.trim() || undefined,
    postalCode: company.postalCode?.trim() || undefined,
    currency: company.currency?.trim() || "IRR",
    fiscalYearStart: company.fiscalYearStart?.trim() || undefined,
    logoUrl: company.logoUrl?.trim() || undefined,
    logoTone: company.logoTone || 'DARK',
    logoBackground: company.logoBackground || 'NONE',
  };
}
