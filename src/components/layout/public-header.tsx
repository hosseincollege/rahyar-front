/**
 * @file src/components/layout/public-header.tsx
 * @description هدر عمومی سامانه همراه با مدال راهنمای ثبت‌نام و اشاره به نسخه دمو
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  LogIn,
  Monitor,
  Moon,
  ShieldAlert,
  Sparkles,
  Workflow,
  Sun,
  UserPlus,
  X,
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { API_BASE_URL } from '@/lib/api-environment';
import { applyPublicAppearance, fetchPublicBranding, resolvePublicLogoUrl, type PublicBranding } from '@/lib/public-branding';
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
  const [branding, setBranding] = useState<PublicBranding | null>(null);
  const [showDisabledNotice, setShowDisabledNotice] = useState(false);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { locale } = usePreferences();
  const direction = getLocaleDirection(locale);
  const message = (key: UiMessage) => uiMessage(locale, key);
  const logoShadowClass = branding?.logoBackground === 'DARK'
    ? 'drop-shadow-[0_0_5px_rgba(0,0,0,0.9)]'
    : branding?.logoBackground === 'LIGHT'
      ? 'drop-shadow-[0_0_5px_rgba(255,255,255,0.95)]'
      : 'drop-shadow-none';

  useEffect(() => {
    let active = true;
    void fetchPublicBranding().then((value) => { if (active) setBranding(value); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!branding) return;
    return applyPublicAppearance(branding.settings, resolvedTheme === 'dark');
  }, [branding, resolvedTheme]);

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
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground)] transition-all duration-200 hover:bg-[var(--surface-hover)]"
            >
              <LogIn size={18} />
            </Link>

            {hasUsers === false ? (
              <Link
                href="/register"
                aria-label={message('publicHeaderRegister')}
                title={message('publicHeaderRegister')}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground)] transition-all duration-200 hover:bg-[var(--surface-hover)]"
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
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground)] transition-all duration-200 hover:bg-[var(--surface-hover)] disabled:cursor-wait disabled:opacity-60"
              >
                <UserPlus size={18} />
              </button>
            )}

            <button
              type="button"
              onClick={cycleTheme}
              aria-label={message('changeTheme')}
              title={themeTitle}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground)] transition-all duration-200 hover:bg-[var(--surface-hover)]"
            >
              <ThemeIcon size={18} />
            </button>
        </nav>

        {/* نشان سامانه در مرکز دقیق هدر */}
        <Link
          href="/"
          dir="ltr"
          className="group absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl"
          aria-label={message('publicHeaderHome')}
        >
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl ${logoShadowClass}`}>
            {branding?.logoUrl ? <Image src={resolvePublicLogoUrl(branding.logoUrl) || ''} alt={message('organizationLogo')} width={32} height={32} unoptimized className="h-full w-full object-contain" onError={() => setBranding((current) => current ? { ...current, logoUrl: null } : current)} /> : <Workflow size={23} className="text-primary" />}
          </div>

          <span className="absolute right-[calc(100%+0.0625rem)] top-1/2 hidden w-max max-w-[min(24vw,15rem)] -translate-y-1/2 truncate text-left text-sm font-black tracking-tight text-[var(--foreground)] sm:block">{branding?.name || 'Rahyar'}</span>
          <span dir="rtl" className="absolute left-[calc(100%+0.0625rem)] top-1/2 hidden -translate-y-1/2 text-[11px] font-bold tracking-wide text-primary sm:block">Rahyar</span>
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
                  مدیریت دسترسی‌های سامانه Rahyar
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
