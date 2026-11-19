// صفحه اطلاعات و تنظیمات شرکت.
// رابط کاربری اطلاعات شرکت: حالت نمایش/ویرایش به همراه اکشن‌های سریع JSON در هدر.
// اصلاح‌شده: اتصال توکن احراز هویت معتبر از api-client و مدیریت خطاهای ۴۰۱، ۴۰۳ و اعتبارسنجی سازمان.

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  Edit3,
  FileCheck,
  FileDown,
  FileSpreadsheet,
  FileUp,
  Globe,
  Image as ImageIcon,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  RotateCcw,
  Save,
  X,
} from 'lucide-react';
import { SettingsPageToolbar } from '../components/settings-page-toolbar';

import { getCurrentOrganizationId } from '@/lib/api/shared/auth-api';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import {
  resolveOrganizationLogoUrl,
  settingsApi,
  type CompanySettings,
} from '@/lib/api/settings/settings-api';

import {
  companyImportSample,
  parseCompanyImportData,
  type CompanyImportData,
} from './company-json';

function createSlugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function downloadJsonFile(fileName: string, data: unknown) {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], {
    type: 'application/json;charset=utf-8',
  });

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(objectUrl);
}

export function CompanyInformationPage() {
  const { locale } = usePreferences();
  const message = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const [data, setData] = useState<CompanySettings>({
    name: '',
    slug: '',
    legalName: '',
    registrationNumber: '',
    nationalId: '',
    economicCode: '',
    taxOffice: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    postalCode: '',
    currency: 'IRR',
    fiscalYearStart: '01-01',
    logoUrl: '',
    logoTone: 'DARK',
    logoBackground: 'NONE',
    status: 'ACTIVE',
  });

  const [formData, setFormData] = useState<CompanySettings>(data);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // استیت‌های فرآیند اعتبارسنجی و ثبت مرحله‌ای فایل جیسون
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isImportPanelOpen, setIsImportPanelOpen] = useState(false);
  const [validatedData, setValidatedData] = useState<CompanyImportData | null>(null);
  const [importing, setImporting] = useState(false);
  const [jsonValidationMessage, setJsonValidationMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    setToast({ type, text });

    timerRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const companyRequestIdRef = useRef(0);
  const fetchCompanyData = useCallback(async () => {
    const requestId = ++companyRequestIdRef.current;
    const resolvedOrgId = getCurrentOrganizationId();
    const isCurrentRequest = () => requestId === companyRequestIdRef.current
      && getCurrentOrganizationId() === resolvedOrgId;
    try {
      if (!resolvedOrgId) {
        throw new Error('سازمان فعال در نشست کاربر پیدا نشد.');
      }

      const [serverData, access] = await Promise.all([
        settingsApi.getOrganization(resolvedOrgId),
        settingsApi.getOrganizationAccess(resolvedOrgId),
      ]);
      if (!isCurrentRequest()) return;
      setOrgId(resolvedOrgId);
      setCanEdit(access.canEdit);

      if (serverData) {
        const formatted: CompanySettings = {
          id: serverData.id || '',
          name: serverData.name || '',
          slug: serverData.slug || '',
          legalName: serverData.legalName || '',
          registrationNumber: serverData.registrationNumber || '',
          nationalId: serverData.nationalId || '',
          economicCode: serverData.economicCode || '',
          taxOffice: serverData.taxOffice || '',
          phone: serverData.phone || '',
          email: serverData.email || '',
          website: serverData.website || '',
          address: serverData.address || '',
          postalCode: serverData.postalCode || '',
          currency: serverData.currency || 'IRR',
          fiscalYearStart: serverData.fiscalYearStart || '01-01',
          logoUrl: serverData.logoUrl || '',
          logoTone: serverData.logoTone || 'DARK',
          logoBackground: serverData.logoBackground || 'NONE',
          status: serverData.status || 'ACTIVE',
        };

        setData(formatted);
        setFormData(formatted);
      }
    } catch (error) {
      if (!isCurrentRequest()) return;
      const status = (error as { status?: number })?.status;
      showToast(
        'error',
        status === 401
          ? 'دسترسی غیرمجاز است. لطفاً دوباره وارد حساب کاربری شوید.'
          : status === 403
          ? 'شما مجوز مشاهده اطلاعات این سازمان را ندارید.'
          : 'دریافت اطلاعات سازمان با خطا مواجه شد. لطفاً دوباره تلاش کنید.',
      );
    } finally {
      if (requestId === companyRequestIdRef.current) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void fetchCompanyData();
    });
    return () => {
      active = false;
      companyRequestIdRef.current += 1;
    };
  }, [fetchCompanyData]);

  const handleChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleCancel = () => {
    setFormData(data);
    setIsEditing(false);
  };

  const handleLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setIsImportPanelOpen(true);

    if (!orgId) {
      showToast('error', 'شناسه سازمان برای بارگذاری لوگو در دسترس نیست.');
      return;
    }

    setUploadingLogo(true);
    try {
      const uploaded = await settingsApi.uploadOrganizationLogo(orgId, file);
      const updatedData = { ...data, logoUrl: uploaded.logoUrl };
      setData(updatedData);
      setFormData((current) => ({ ...current, logoUrl: uploaded.logoUrl }));
      window.dispatchEvent(new Event('organization-branding-changed'));
      showToast('success', 'لوگو بارگذاری و ذخیره شد.');
    } catch (error) {
      showToast(
        'error',
        error instanceof Error ? error.message : 'بارگذاری لوگو ناموفق بود.',
      );
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      showToast('error', 'وارد کردن نام سازمان الزامی است.');
      return;
    }

    setSaving(true);

    try {
      const currentOrgId = orgId || formData.id || undefined;
      const computedSlug =
        formData.slug?.trim() || createSlugFromName(formData.name);

      const payload: CompanySettings = {
        ...formData,
        id: formData.id || undefined,
        name: formData.name.trim(),
        slug: computedSlug,
        legalName: formData.legalName?.trim() || undefined,
        registrationNumber:
          formData.registrationNumber?.trim() || undefined,
        nationalId: formData.nationalId?.trim() || undefined,
        economicCode: formData.economicCode?.trim() || undefined,
        taxOffice: formData.taxOffice?.trim() || undefined,
        phone: formData.phone?.trim() || undefined,
        email: formData.email?.trim() || undefined,
        website: formData.website?.trim() || undefined,
        address: formData.address?.trim() || undefined,
        postalCode: formData.postalCode?.trim() || undefined,
        currency: formData.currency || 'IRR',
        fiscalYearStart: formData.fiscalYearStart || '01-01',
        logoUrl: formData.logoUrl?.trim() ?? '',
        status: formData.status || 'ACTIVE',
      };

      const updated = await settingsApi.updateOrganization(
        payload,
        currentOrgId,
      );

      const updatedData: CompanySettings = {
        ...formData,
        ...updated,
        id: updated.id || formData.id || '',
        name: updated.name || formData.name,
        slug: updated.slug || computedSlug,
        currency: updated.currency || formData.currency || 'IRR',
        fiscalYearStart:
          updated.fiscalYearStart || formData.fiscalYearStart || '01-01',
        status: updated.status || formData.status || 'ACTIVE',
      };

      setData(updatedData);
      setFormData(updatedData);

      if (updatedData.id) {
        setOrgId(updatedData.id);
      }

      setIsEditing(false);
      window.dispatchEvent(new Event('organization-branding-changed'));
      showToast('success', 'اطلاعات شرکت با موفقیت ذخیره شد.');
    } catch (error) {
      const status = (error as { status?: number })?.status;

      showToast(
        'error',
        status === 401
          ? 'دسترسی غیرمجاز است. لطفاً دوباره وارد حساب کاربری شوید.'
          : status === 403
            ? 'شما مجوز ویرایش اطلاعات این سازمان را ندارید.'
            : 'خطا در ذخیره اطلاعات. لطفاً مقادیر وارد شده را بررسی کنید.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadCompanySample = () => {
    downloadJsonFile(
      'company-settings-template.json',
      companyImportSample,
    );
    showToast('success', 'فایل نمونهٔ اطلاعات شرکت دانلود شد.');
  };

  // ۱. انتخاب و اعتبارسنجی فایل (Validation Step)
  const handleFileSelectAndValidate = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      setSelectedFileName(null);
      setValidatedData(null);
      setJsonValidationMessage({
        type: 'error',
        text: 'فقط فایل با فرمت JSON قابل بررسی و بارگذاری است.',
      });
      return;
    }

    try {
      const fileContent = await file.text();
      const rawData: unknown = JSON.parse(fileContent);
      const parsedData: CompanyImportData = parseCompanyImportData(rawData);

      setSelectedFileName(file.name);
      setValidatedData(parsedData);
      setJsonValidationMessage({
        type: 'success',
        text: `فایل «${file.name}» با موفقیت اعتبارسنجی شد و ساختار آن صحیح است. جهت اعمال نهایی روی دکمه ثبت کلیک کنید.`,
      });
    } catch (error) {
      setSelectedFileName(null);
      setValidatedData(null);
      const message =
        error instanceof Error
          ? error.message === 'INVALID_LOGO_BACKGROUND'
            ? uiMessage(locale, 'invalidLogoShadow')
            : error.message
          : 'ساختار فایل JSON معتبر نیست یا فیلدهای مورد نیاز یافت نشدند.';
      setJsonValidationMessage({
        type: 'error',
        text: message,
      });
    }
  };

  // لغو یا ریست کردن فایل بارگذاری شده
  const handleCancelJsonImport = () => {
    setSelectedFileName(null);
    setValidatedData(null);
    setJsonValidationMessage(null);
    setIsImportPanelOpen(false);
  };

  // ۲. ارسال و ثبت قطعی داده‌های اعتبارسنجی‌شده (Confirm Step)
  const handleConfirmImport = async () => {
    if (!validatedData) return;

    setImporting(true);

    try {
      if (!orgId) throw new Error('سازمان فعال در نشست کاربر پیدا نشد.');
      await settingsApi.importOrganization(orgId, {
        organization: validatedData,
        branches: [],
        departments: [],
      });

      await fetchCompanyData();
      handleCancelJsonImport();
      showToast(
        'success',
        'اطلاعات شرکت از طریق فایل با موفقیت در پایگاه داده ثبت شد.',
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'خطا در ثبت اطلاعات فایل در سرور.';
      showToast('error', message);
    } finally {
      setImporting(false);
    }
  };

  const getCurrencyLabel = (code?: string) => {
    switch (code) {
      case 'IRR':
        return 'ریال ایران (IRR)';
      case 'IRT':
        return 'تومان ایران (IRT)';
      case 'USD':
        return 'دلار آمریکا (USD)';
      case 'EUR':
        return 'یورو (EUR)';
      default:
        return code || '—';
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-border/70 bg-card/60">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>در حال دریافت اطلاعات شرکت...</span>
        </div>
      </div>
    );
  }

  return (
    <div dir={getLocaleDirection(locale)} className="space-y-4">
      {/* پیام Toast */}
      {toast && (
        <div
          className={`flex items-center gap-3 rounded-xl border p-4 text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          }`}
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{toast.text}</span>
        </div>
      )}

      <SettingsPageToolbar>
        {canEdit && !isEditing && (
          <button type="button" onClick={() => { setFormData(data); setIsEditing(true); }} disabled={importing || Boolean(validatedData)} aria-label="ویرایش اطلاعات شرکت" title="ویرایش اطلاعات شرکت" className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50">
            <Edit3 className="size-4" aria-hidden="true" />
          </button>
        )}
        {canEdit && (
          <>
            <button type="button" onClick={handleDownloadCompanySample} disabled={importing} aria-label="دانلود نمونه اطلاعات شرکت" title="دانلود نمونه اطلاعات شرکت" className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50">
              <FileDown className="size-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={importing || saving || isEditing} aria-label={selectedFileName ? 'انتخاب فایل دیگر برای ورود اطلاعات شرکت' : 'بارگذاری و بررسی فایل اطلاعات شرکت'} title={selectedFileName ? 'انتخاب فایل دیگر' : 'بارگذاری و بررسی فایل اطلاعات شرکت'} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50">
              <FileUp className="size-4" aria-hidden="true" />
            </button>
          </>
        )}
        <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleFileSelectAndValidate} className="hidden" />
        {canEdit && validatedData && (
          <>
            <button type="button" onClick={handleCancelJsonImport} disabled={importing} aria-label="لغو ورود اطلاعات شرکت" title="لغو ورود اطلاعات شرکت" className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50">
              <RotateCcw className="size-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={handleConfirmImport} disabled={importing || saving} aria-label={importing ? 'در حال ثبت اطلاعات شرکت' : 'تأیید و ثبت اطلاعات شرکت'} title={importing ? 'در حال ثبت اطلاعات شرکت' : 'تأیید و ثبت اطلاعات شرکت'} className="grid size-9 shrink-0 place-items-center rounded-full border border-emerald-600 bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">
              {importing ? <RefreshCw className="size-4 animate-spin" aria-hidden="true" /> : <FileCheck className="size-4" aria-hidden="true" />}
            </button>
          </>
        )}
        {canEdit && isEditing && (
          <>
            <button type="button" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo || importing} aria-label="انتخاب فایل لوگو" title={uploadingLogo ? 'در حال بارگذاری لوگو' : 'انتخاب فایل لوگو'} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50">
              <ImageIcon className="size-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={handleCancel} disabled={saving || importing} aria-label="انصراف از ویرایش" title="انصراف از ویرایش" className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50">
              <X className="size-4" aria-hidden="true" />
            </button>
            <button type="submit" form="company-form" disabled={saving || importing} aria-label={saving ? 'در حال ذخیره اطلاعات' : 'ذخیره تغییرات شرکت'} title={saving ? 'در حال ذخیره اطلاعات' : 'ذخیره تغییرات شرکت'} className="grid size-9 shrink-0 place-items-center rounded-full border border-primary bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
              {saving ? <RefreshCw className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            </button>
          </>
        )}
        {!canEdit && <span className="inline-flex h-9 shrink-0 items-center rounded-full border border-border bg-background px-3 text-xs text-muted-foreground">دسترسی فقط مشاهده</span>}
      </SettingsPageToolbar>

      {/* بخش ۱: دریافت قالب و ورود اطلاعات؛ فقط برای کاربران دارای مجوز ویرایش */}
      {canEdit && <details open={isImportPanelOpen} onToggle={(event) => setIsImportPanelOpen(event.currentTarget.open)} className="group rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground sm:text-base">
                ورود اطلاعات از طریق فایل JSON
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                دانلود فایل نمونه، بارگذاری جهت اعتبارسنجی و سپس ثبت قطعی
              </p>
            </div>
          </div>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>

        {/* وضعیت اعتبارسنجی و اکشن ثبت قطعی فایل */}
        {jsonValidationMessage && (
          <div className="mt-4 space-y-3">
            <div
              className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs font-medium ${
                jsonValidationMessage.type === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-destructive/30 bg-destructive/10 text-destructive'
              }`}
            >
              {jsonValidationMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{jsonValidationMessage.text}</span>
            </div>

          </div>
        )}
      </details>}

      {/* بخش ۲: فرم و اطلاعات هویتی و ثبتی شرکت */}
      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground sm:text-lg">
                پروفایل و هویت حقوقی سازمان
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                اطلاعات ثبتی، مالیاتی، کد اقتصادی و ساختار ارتباطی شرکت
              </p>
            </div>
          </div>

          <span className="text-xs text-muted-foreground">{isEditing ? 'برای ثبت تغییرات از دکمهٔ ذخیره در نوار ابزار بالا استفاده کنید.' : 'برای تغییر مشخصات، ویرایش را از نوار ابزار بالا انتخاب کنید.'}</span>
        </div>

        {/* حالت نمایش (View Mode) */}
        {!isEditing ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/50 bg-background/50 p-5">
              <h3 className="mb-4 text-xs font-bold text-muted-foreground">
                مشخصات عمومی و ثبتی
              </h3>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <span className="block text-xs font-semibold text-muted-foreground">نام سازمان / برند</span>
                  <span className="mt-1.5 block text-sm font-semibold text-foreground">{data.name || '—'}</span>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-muted-foreground">نام کامل رسمی</span>
                  <span className="mt-1.5 block text-sm font-medium text-foreground">{data.legalName || '—'}</span>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-muted-foreground">شناسه یکتا (Slug)</span>
                  <span className="mt-1.5 block font-mono text-sm font-medium text-foreground dir-ltr text-end">{data.slug || '—'}</span>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-muted-foreground">شناسه ملی</span>
                  <span className="mt-1.5 block font-mono text-sm font-medium text-foreground dir-ltr text-end">{data.nationalId || '—'}</span>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-muted-foreground">شماره ثبت</span>
                  <span className="mt-1.5 block font-mono text-sm font-medium text-foreground dir-ltr text-end">{data.registrationNumber || '—'}</span>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-muted-foreground">کد اقتصادی</span>
                  <span className="mt-1.5 block font-mono text-sm font-medium text-foreground dir-ltr text-end">{data.economicCode || '—'}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-background/50 p-5">
              <h3 className="mb-4 text-xs font-bold text-muted-foreground">
                تنظیمات مالیاتی و مالی
              </h3>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <span className="block text-xs font-semibold text-muted-foreground">حوزه مالیاتی</span>
                  <span className="mt-1.5 block text-sm font-medium text-foreground">{data.taxOffice || '—'}</span>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-muted-foreground">واحد پول پایه</span>
                  <span className="mt-1.5 block text-sm font-medium text-foreground">{getCurrencyLabel(data.currency)}</span>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-muted-foreground">شروع سال مالی</span>
                  <span className="mt-1.5 block font-mono text-sm font-medium text-foreground dir-ltr text-end">{data.fiscalYearStart || '—'}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-background/50 p-5">
              <h3 className="mb-4 text-xs font-bold text-muted-foreground">
                اطلاعات تماس و نشانی
              </h3>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex items-start gap-3">
                  <Phone className="mt-1 h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <span className="block text-xs font-semibold text-muted-foreground">شماره تماس</span>
                    <span className="mt-1 block font-mono text-sm font-medium text-foreground dir-ltr text-end">{data.phone || '—'}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="mt-1 h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <span className="block text-xs font-semibold text-muted-foreground">پست الکترونیکی</span>
                    <span className="mt-1 block font-mono text-sm font-medium text-foreground dir-ltr text-end">{data.email || '—'}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Globe className="mt-1 h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <span className="block text-xs font-semibold text-muted-foreground">وب‌سایت</span>
                    <span className="mt-1 block font-mono text-sm font-medium text-foreground dir-ltr text-end">{data.website || '—'}</span>
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-muted-foreground">کد پستی</span>
                  <span className="mt-1.5 block font-mono text-sm font-medium text-foreground dir-ltr text-end">{data.postalCode || '—'}</span>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-muted-foreground">آدرس نشان/لوگو (URL)</span>
                  <span className="mt-2 flex items-center gap-2">
                    {data.logoUrl ? (
                      <Image
                        src={resolveOrganizationLogoUrl(data.logoUrl) || ''}
                        alt={`لوگوی ${data.name}`}
                        width={40}
                        height={40}
                        unoptimized
                        className="h-10 w-10 rounded-lg border border-border object-contain"
                      />
                    ) : null}
                    <span className="block truncate font-mono text-xs text-muted-foreground dir-ltr text-end">
                      {data.logoUrl || '—'}
                    </span>
                  </span>
                </div>

                <div className="sm:col-span-2 lg:col-span-3 flex items-start gap-3">
                  <MapPin className="mt-1 h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <span className="block text-xs font-semibold text-muted-foreground">نشانی دقیق شرکت</span>
                    <p className="mt-1 text-sm font-medium leading-relaxed text-foreground">{data.address || '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <form id="company-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-xl border border-border/50 bg-background/50 p-5">
              <h3 className="mb-4 text-xs font-bold text-muted-foreground">
                ویرایش اطلاعات عمومی و حقوقی
              </h3>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label htmlFor="name" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    نام سازمان / شرکت <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="مثلاً: شرکت داده‌پردازی نوین"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label htmlFor="legalName" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    نام کامل رسمی (ثبت شده)
                  </label>
                  <input
                    id="legalName"
                    name="legalName"
                    type="text"
                    value={formData.legalName || ''}
                    onChange={handleChange}
                    placeholder="مثلاً: شرکت داده‌پردازی نوین عصر سهامی خاص"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label htmlFor="slug" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    شناسه یکتا (Slug انگلیسی)
                  </label>
                  <input
                    id="slug"
                    name="slug"
                    type="text"
                    dir="ltr"
                    readOnly
                    value={formData.slug || ''}
                    placeholder="پس از ثبت سازمان تعیین می‌شود"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label htmlFor="nationalId" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    شناسه ملی
                  </label>
                  <input
                    id="nationalId"
                    name="nationalId"
                    type="text"
                    dir="ltr"
                    value={formData.nationalId || ''}
                    onChange={handleChange}
                    placeholder="۱۰۱۰۱۲۳۴۵۶۷"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label htmlFor="registrationNumber" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    شماره ثبت
                  </label>
                  <input
                    id="registrationNumber"
                    name="registrationNumber"
                    type="text"
                    dir="ltr"
                    value={formData.registrationNumber || ''}
                    onChange={handleChange}
                    placeholder="۱۲۳۴۵۶"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label htmlFor="economicCode" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    کد اقتصادی
                  </label>
                  <input
                    id="economicCode"
                    name="economicCode"
                    type="text"
                    dir="ltr"
                    value={formData.economicCode || ''}
                    onChange={handleChange}
                    placeholder="۴۱۱۱۲۳۴۵۶۷۸۹"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-background/50 p-5">
              <h3 className="mb-4 text-xs font-bold text-muted-foreground">
                ویرایش تنظیمات مالیاتی و مالی
              </h3>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label htmlFor="taxOffice" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    حوزه مالیاتی
                  </label>
                  <input
                    id="taxOffice"
                    name="taxOffice"
                    type="text"
                    value={formData.taxOffice || ''}
                    onChange={handleChange}
                    placeholder="اداره کل امور مالیاتی مرکز تهران"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label htmlFor="currency" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    واحد پول پایه
                  </label>
                  <select
                    id="currency"
                    name="currency"
                    value={formData.currency || 'IRR'}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="IRR">ریال ایران (IRR)</option>
                    <option value="IRT">تومان ایران (IRT)</option>
                    <option value="USD">دلار آمریکا (USD)</option>
                    <option value="EUR">یورو (EUR)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="fiscalYearStart" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    شروع سال مالی
                  </label>
                  <input
                    id="fiscalYearStart"
                    name="fiscalYearStart"
                    type="text"
                    dir="ltr"
                    value={formData.fiscalYearStart || '01-01'}
                    onChange={handleChange}
                    placeholder="01-01"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-background/50 p-5">
              <h3 className="mb-4 text-xs font-bold text-muted-foreground">
                ویرایش اطلاعات تماس و نشانی
              </h3>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label htmlFor="phone" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    شماره تماس
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="text"
                    dir="ltr"
                    value={formData.phone || ''}
                    onChange={handleChange}
                    placeholder="۰۲۱-۸۸۸۸۸۸۸۸"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    پست الکترونیکی (ایمیل)
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    dir="ltr"
                    value={formData.email || ''}
                    onChange={handleChange}
                    placeholder="info@novin-tech.com"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label htmlFor="website" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    وب‌سایت
                  </label>
                  <input
                    id="website"
                    name="website"
                    type="text"
                    dir="ltr"
                    value={formData.website || ''}
                    onChange={handleChange}
                    placeholder="https://novin-tech.com"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label htmlFor="postalCode" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    کد پستی
                  </label>
                  <input
                    id="postalCode"
                    name="postalCode"
                    type="text"
                    dir="ltr"
                    value={formData.postalCode || ''}
                    onChange={handleChange}
                    placeholder="۱۹۹۹۹۹۹۹۹۹"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label htmlFor="logoUrl" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    آدرس نشان/لوگو (URL)
                  </label>
                  <input
                    id="logoUrl"
                    name="logoUrl"
                    type="text"
                    dir="ltr"
                    value={formData.logoUrl || ''}
                    onChange={handleChange}
                    placeholder="https://example.com/logo.png"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                    <span className="text-xs text-muted-foreground">
                      PNG، JPG یا WebP؛ حداکثر ۵ مگابایت. بارگذاری فایل روی بک‌اند محلی انجام می‌شود.
                    </span>
                  </div>
                  <div className="mt-4 max-w-sm">
                    <label htmlFor="logoBackground" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                      {message('logoShadowTitle')}
                    </label>
                    <select
                      id="logoBackground"
                      name="logoBackground"
                      value={formData.logoBackground || 'NONE'}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="NONE">{message('shadowNone')}</option>
                      <option value="DARK">{message('shadowDark')}</option>
                      <option value="LIGHT">{message('shadowLight')}</option>
                    </select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {message('logoShadowHint')}
                    </p>
                  </div>
                  {formData.logoUrl ? (
                    <Image
                      src={resolveOrganizationLogoUrl(formData.logoUrl) || ''}
                      alt={`پیش‌نمایش لوگوی ${formData.name || 'شرکت'}`}
                      width={56}
                      height={56}
                      unoptimized
                      className={`mt-2 h-14 w-14 rounded-lg object-contain ${formData.logoBackground === 'DARK' ? 'drop-shadow-[0_0_5px_rgba(0,0,0,0.9)]' : formData.logoBackground === 'LIGHT' ? 'drop-shadow-[0_0_5px_rgba(255,255,255,0.95)]' : 'drop-shadow-none'}`}
                    />
                  ) : null}
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                  <label htmlFor="address" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    نشانی دقیق شرکت
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    rows={3}
                    value={formData.address || ''}
                    onChange={handleChange}
                    placeholder="تهران، خیابان ولیعصر، بعد از تقاطع میرداماد..."
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
