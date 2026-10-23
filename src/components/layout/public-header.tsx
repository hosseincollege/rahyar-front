/**
 * @file src/components/layout/public-header.tsx
 * @description هدر عمومی سامانه همراه با مدال راهنمای ثبت‌نام و اشاره به نسخه دمو
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LogIn,
  Monitor,
  Moon,
  ShieldAlert,
  Sparkles,
  ShieldCheck,
  Sun,
  UserPlus,
  X,
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { API_BASE_URL } from '@/lib/api-environment';
import { uiMessage } from '@/lib/ui-messages';
import type { UiMessage } from '@/languages/types';

type SetupStatusResponse = {
  hasUsers: boolean;
  isFirstInstall?: boolean;
};

function getBackendBaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_BACKEND_BASE_URL ||
    API_BASE_URL;
  return url.replace(/\/+$/, '');
}

async function fetchSetupStatus(): Promise<SetupStatusResponse> {
  const baseUrl = getBackendBaseUrl();
  const response = await fetch(`${baseUrl}/setup/status`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('عدم دریافت وضعیت راه‌اندازی');
  }

  return response.json() as Promise<SetupStatusResponse>;
}

export function PublicHeader() {
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);
  const [showDisabledNotice, setShowDisabledNotice] = useState(false);
  const { theme, setTheme } = useTheme();
  const { locale } = usePreferences();
  const direction = getLocaleDirection(locale);
  const message = (key: UiMessage) => uiMessage(locale, key);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const data = await fetchSetupStatus();
        setHasUsers(data.hasUsers);
      } catch (error) {
        setHasUsers(true);
      }
    };

    void checkStatus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showDisabledNotice) {
        setShowDisabledNotice(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDisabledNotice]);

  const cycleTheme = () => {
    const nextTheme =
      theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';

    setTheme(nextTheme);
  };

  const ThemeIcon =
    theme === 'system' ? Monitor : theme === 'light' ? Sun : Moon;
  const themeTitle = message(theme === 'system' ? 'themeSystem' : theme === 'light' ? 'themeLight' : 'themeDark');

  return (
    <>
      <header
        dir={direction}
        className="sticky top-0 z-40 relative flex h-16 items-center border-b border-[var(--border)] bg-[var(--surface)]/90 px-5 backdrop-blur-md transition-colors duration-200"
      >
        {/* ورود، ثبت‌نام و تم در سمت راست؛ هم‌ارتفاع و هم‌جایگاه با هدر برنامه */}
        <nav className="absolute start-2 flex items-center gap-1.5 md:start-5" aria-label={message('publicHeaderActions')}>
            <Link
              href="/login"
              aria-label={message('publicHeaderLogin')}
              title={message('publicHeaderLogin')}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground)] transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800/80"
            >
              <LogIn size={18} />
            </Link>

            {hasUsers === false ? (
              <Link
                href="/register"
                aria-label={message('publicHeaderRegister')}
                title={message('publicHeaderRegister')}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground)] transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800/80"
              >
                <UserPlus size={18} />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setShowDisabledNotice(true)}
                aria-label={message('publicHeaderRegister')}
                title={message('publicHeaderRegister')}
                disabled={hasUsers === null}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground)] transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 disabled:cursor-wait disabled:opacity-60"
              >
                <UserPlus size={18} />
              </button>
            )}

            <button
              type="button"
              onClick={cycleTheme}
              aria-label={message('changeTheme')}
              title={themeTitle}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground)] transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800/80"
            >
              <ThemeIcon size={18} />
            </button>
        </nav>

        {/* نشان سامانه در مرکز دقیق هدر */}
        <Link
          href="/"
          className="group absolute left-1/2 flex -translate-x-1/2 items-center gap-2.5 rounded-xl"
          aria-label={message('publicHeaderHome')}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-primary transition-opacity group-hover:opacity-85 sm:h-12 sm:w-12">
            <ShieldCheck size={24} />
          </div>

          <div className="hidden text-start sm:block">
            <div className="text-base font-black tracking-tight text-foreground sm:text-lg">ERP Pro</div>
            <div className="hidden text-[11px] text-muted-foreground sm:block">سامانه یکپارچه سازمانی</div>
          </div>
        </Link>
      </header>

      {/* مدال راهنمای ثبت‌نام */}
      {showDisabledNotice && (
        <div
          dir="rtl"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm transition-all animate-in fade-in duration-200"
          onClick={() => setShowDisabledNotice(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 sm:p-7 shadow-2xl transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* دکمه بستن */}
            <button
              type="button"
              onClick={() => setShowDisabledNotice(false)}
              className="absolute left-4 top-4 rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="بستن پنجره"
            >
              <X size={20} />
            </button>

            {/* هدر مدال */}
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-foreground">
                  ثبت‌نام مستقیم غیرفعال است
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  مدیریت دسترسی‌های سامانه ERP Pro
                </p>
              </div>
            </div>

            {/* توضیحات به سبک قبلی ولی شسته، رفته و خلاصه */}
            <div className="mt-5 space-y-3 text-xs sm:text-sm leading-6 text-foreground/85">
              <p>
                امکان ثبت‌نام مستقیم صرفاً جهت راه‌اندازی اولیه و ساخت نخستین مدیر ارشد فعال بوده است.
              </p>
              <p>
                در حال حاضر افزودن کاربران جدید و تخصیص نقش‌ها فقط توسط مدیر سامانه و از طریق بخش مدیریت کاربران انجام می‌شود. جهت دریافت دسترسی، با مدیر سامانه در ارتباط باشید.
              </p>
              <p className="text-xs text-muted-foreground pt-1 border-t border-border/60">
                💡 <span className="font-semibold text-foreground/90">تست آزمایشی:</span> در صفحه ورود امکان ورود بصورت دمو قرار داده شده است.
              </p>
            </div>

            {/* دکمه‌ها */}
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDisabledNotice(false)}
                className="h-10 rounded-xl border border-border px-4 text-xs sm:text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                متوجه شدم
              </button>
              <Link
                href="/login"
                onClick={() => setShowDisabledNotice(false)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-xs sm:text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:opacity-95 active:scale-95"
              >
                <LogIn size={16} />
                <span>رفتن به صفحه ورود</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default PublicHeader;
