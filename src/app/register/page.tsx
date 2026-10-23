// frontend/src/app/register/page.tsx

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  FileDown,
  FileUp,
  Loader2,
  UserPlus,
} from 'lucide-react';

import { apiClient } from '@/lib/api-client';
import { register } from '@/lib/api/shared/auth-api';
import { PublicHeader } from '@/components/layout/public-header';

interface SetupStatusResponse {
  hasUsers: boolean;
  isFirstInstall: boolean;
}

interface RegisterFormData {
  username: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  nationalCode: string;
  birthDate: string;
  phone: string;
  email: string;
  address: string;
}

const EMPTY_FORM: RegisterFormData = {
  username: '',
  password: '',
  confirmPassword: '',
  firstName: '',
  lastName: '',
  fatherName: '',
  nationalCode: '',
  birthDate: '',
  phone: '',
  email: '',
  address: '',
};

const SAMPLE_JSON: RegisterFormData = {
  username: 'admin',
  password: '',
  confirmPassword: '',
  firstName: 'مدیر',
  lastName: 'سیستم',
  fatherName: '',
  nationalCode: '0012345678',
  birthDate: '1990-01-01',
  phone: '',
  email: 'admin@example.com',
  address: '',
};

async function getSetupStatus(): Promise<SetupStatusResponse> {
  return apiClient.get<SetupStatusResponse>('/setup/status');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'ثبت‌نام ناموفق بود.';
}

function normalizeImportedForm(data: unknown): RegisterFormData {
  if (!isObject(data)) {
    return EMPTY_FORM;
  }

  return {
    username: toStringValue(data.username),
    password: toStringValue(data.password),
    confirmPassword: toStringValue(
      data.confirmPassword ?? data.password,
    ),
    firstName: toStringValue(data.firstName),
    lastName: toStringValue(data.lastName),
    fatherName: toStringValue(data.fatherName),
    nationalCode: toStringValue(data.nationalCode),
    birthDate: toStringValue(data.birthDate),
    phone: toStringValue(data.phone),
    email: toStringValue(data.email),
    address: toStringValue(data.address),
  };
}

export default function RegisterPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [setupAllowed, setSetupAllowed] = useState(false);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState<RegisterFormData>(EMPTY_FORM);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const status = await getSetupStatus();

        if (!mounted) {
          return;
        }

        setSetupAllowed(status.isFirstInstall);
      } catch {
        if (!mounted) {
          return;
        }

        setSetupAllowed(false);
        setError('دریافت وضعیت راه‌اندازی سیستم ناموفق بود.');
      } finally {
        if (mounted) {
          setLoadingSetup(false);
        }
      }
    };

    void init();

    return () => {
      mounted = false;
    };
  }, []);

  const updateField = (
    key: keyof RegisterFormData,
    value: string,
  ) => {
    setFormData((previousFormData) => ({
      ...previousFormData,
      [key]: value,
    }));
  };

  const downloadSampleJson = () => {
    const samplePassword = 'ChangeMe123!';
    const sampleJsonText = JSON.stringify({
      ...SAMPLE_JSON,
      password: samplePassword,
      confirmPassword: samplePassword,
    }, null, 2);
    const blob = new Blob([sampleJsonText], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = 'register-sample.json';
    anchor.click();

    URL.revokeObjectURL(url);
  };

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleJsonImport = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const normalized = normalizeImportedForm(parsed);

      setFormData((previousFormData) => ({
        ...previousFormData,
        ...normalized,
      }));

      setSuccess('فایل JSON با موفقیت بارگذاری شد.');
      setError('');
    } catch {
      setSuccess('');
      setError('فایل JSON معتبر نیست.');
    }
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    const username = formData.username.trim();
    const firstName = formData.firstName.trim();
    const lastName = formData.lastName.trim();
    const email = formData.email.trim();
    const phone = formData.phone.trim();
    const nationalCode = formData.nationalCode.trim();
    const birthDate = formData.birthDate.trim();

    if (!setupAllowed) {
      setError('ثبت‌نام فقط در حالت نصب اولیه فعال است.');
      return;
    }

    if (!username) {
      setError('نام کاربری الزامی است.');
      return;
    }

    if (!firstName || !lastName) {
      setError('نام و نام خانوادگی الزامی است.');
      return;
    }

    if (!formData.password || formData.password.length < 8) {
      setError('رمز عبور باید حداقل ۸ کاراکتر باشد.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('رمز عبور و تکرار رمز عبور یکسان نیستند.');
      return;
    }

    if (nationalCode && !/^\d{10}$/.test(nationalCode)) {
      setError('کد ملی باید دقیقاً ۱۰ رقم باشد.');
      return;
    }

    if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      setError('تاریخ تولد باید با فرمت YYYY-MM-DD باشد.');
      return;
    }

    setLoading(true);

    try {
      await register({
        username,
        password: formData.password,
        firstName,
        lastName,
        phone: phone || undefined,
        email: email || undefined,
      });

      setSuccess('ثبت‌نام با موفقیت انجام شد.');
      router.replace('/');
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  };

  if (loadingSetup) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
        <PublicHeader />
        <div className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          در حال بررسی وضعیت راه‌اندازی...
        </div>
        </div>
      </div>
    );
  }

  if (!setupAllowed) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--background)] px-4 text-[var(--foreground)]">
        <PublicHeader />
        <div className="m-auto w-full max-w-md border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex items-center gap-3 text-rose-300">
            <AlertCircle className="h-5 w-5" />
            <h1 className="text-lg font-semibold">
              ثبت‌نام غیرفعال است
            </h1>
          </div>

          <p className="mt-4 text-sm text-[var(--muted-foreground)]">
            ثبت‌نام فقط برای راه‌اندازی اولیه سیستم در دسترس است.
          </p>

          <div className="mt-6 flex items-center justify-between">
            <Link
              className="text-sm text-sky-300 hover:text-sky-200"
              href="/login"
            >
              رفتن به ورود
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[var(--background)] text-[var(--foreground)]"
      dir="rtl"
    >
      <PublicHeader />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-3 py-4 sm:px-4 sm:py-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold">
              ثبت‌نام اولیه
            </h1>

            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              اطلاعات کاربر اصلی سیستم را وارد کنید یا از فایل JSON
              استفاده کنید.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={downloadSampleJson}
              className="inline-flex items-center gap-2 border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] hover:bg-muted"
            >
              <FileDown className="h-4 w-4" />
              دانلود نمونه
            </button>

            <button
              type="button"
              onClick={triggerFilePicker}
              className="inline-flex items-center gap-2 border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] hover:bg-muted"
            >
              <FileUp className="h-4 w-4" />
              بارگذاری JSON
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleJsonImport}
            />
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6"
        >
          {error ? (
            <div className="mb-4 flex items-center gap-2 border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {success ? (
            <div className="mb-4 flex items-center gap-2 border border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
              <Check className="h-4 w-4 shrink-0" />
              <span>{success}</span>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="نام کاربری">
              <input
                type="text"
                name="username"
                autoComplete="username"
                required
                value={formData.username}
                onChange={(event) =>
                  updateField('username', event.target.value)
                }
                className="w-full border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-sky-500"
              />
            </Field>

            <Field label="ایمیل">
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={formData.email}
                onChange={(event) =>
                  updateField('email', event.target.value)
                }
                className="w-full border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-sky-500"
              />
            </Field>

            <Field label="نام">
              <input
                type="text"
                name="firstName"
                autoComplete="given-name"
                required
                value={formData.firstName}
                onChange={(event) =>
                  updateField('firstName', event.target.value)
                }
                className="w-full border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-sky-500"
              />
            </Field>

            <Field label="نام خانوادگی">
              <input
                type="text"
                name="lastName"
                autoComplete="family-name"
                required
                value={formData.lastName}
                onChange={(event) =>
                  updateField('lastName', event.target.value)
                }
                className="w-full border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-sky-500"
              />
            </Field>

            <Field label="نام پدر">
              <input
                type="text"
                name="fatherName"
                value={formData.fatherName}
                onChange={(event) =>
                  updateField('fatherName', event.target.value)
                }
                className="w-full border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-sky-500"
              />
            </Field>

            <Field label="کد ملی">
              <input
                type="text"
                name="nationalCode"
                inputMode="numeric"
                maxLength={10}
                value={formData.nationalCode}
                onChange={(event) =>
                  updateField('nationalCode', event.target.value)
                }
                className="w-full border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-sky-500"
                dir="ltr"
              />
            </Field>

            <Field label="تاریخ تولد">
              <input
                type="date"
                name="birthDate"
                value={formData.birthDate}
                onChange={(event) =>
                  updateField('birthDate', event.target.value)
                }
                className="w-full border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-sky-500"
                dir="ltr"
              />
            </Field>

            <Field label="شماره تلفن">
              <input
                type="tel"
                name="phone"
                autoComplete="tel"
                value={formData.phone}
                onChange={(event) =>
                  updateField('phone', event.target.value)
                }
                className="w-full border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-sky-500"
                dir="ltr"
              />
            </Field>

            <Field label="رمز عبور">
              <div className="flex items-center gap-2 border border-[var(--border)] bg-[var(--background)] px-3 py-2 focus-within:border-sky-500">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={(event) =>
                    updateField('password', event.target.value)
                  }
                  className="w-full bg-transparent text-sm outline-none"
                  dir="ltr"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((currentValue) => !currentValue)
                  }
                  aria-label={
                    showPassword
                      ? 'مخفی کردن رمز عبور'
                      : 'نمایش رمز عبور'
                  }
                  title={
                    showPassword
                      ? 'مخفی کردن رمز عبور'
                      : 'نمایش رمز عبور'
                  }
                  className="shrink-0 text-[var(--muted-foreground)] hover:text-white"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </Field>

            <Field label="تکرار رمز عبور">
              <div className="flex items-center gap-2 border border-[var(--border)] bg-[var(--background)] px-3 py-2 focus-within:border-sky-500">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={formData.confirmPassword}
                  onChange={(event) =>
                    updateField(
                      'confirmPassword',
                      event.target.value,
                    )
                  }
                  className="w-full bg-transparent text-sm outline-none"
                  dir="ltr"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(
                      (currentValue) => !currentValue,
                    )
                  }
                  aria-label={
                    showConfirmPassword
                      ? 'مخفی کردن تکرار رمز عبور'
                      : 'نمایش تکرار رمز عبور'
                  }
                  title={
                    showConfirmPassword
                      ? 'مخفی کردن تکرار رمز عبور'
                      : 'نمایش تکرار رمز عبور'
                  }
                  className="shrink-0 text-[var(--muted-foreground)] hover:text-white"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </Field>

            <Field label="آدرس" className="md:col-span-2">
              <textarea
                name="address"
                autoComplete="street-address"
                value={formData.address}
                onChange={(event) =>
                  updateField('address', event.target.value)
                }
                rows={4}
                className="w-full resize-y border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-sky-500"
              />
            </Field>
          </div>

          <div className="mt-6 flex items-center justify-between gap-4">
            <Link
              href="/login"
              className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              رفتن به ورود
            </Link>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}

              ثبت‌نام
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm text-[var(--muted-foreground)]">
        {label}
      </span>

      {children}
    </label>
  );
}
