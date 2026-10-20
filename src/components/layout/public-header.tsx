'use client';

import Link from 'next/link';
import { LogIn, Moon, Sun, Monitor, ShieldCheck, UserPlus } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { useEffect, useState } from 'react';

function getBackendBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_BASE_URL || (process.env.NODE_ENV === 'production' ? 'https://rahyar-back-piuy.vercel.app' : 'http://localhost:3016')).replace(/\/+$/, '');
}

export function PublicHeader() {
  const [hasUsers, setHasUsers] = useState(true);
  const [showRegisterNotice, setShowRegisterNotice] = useState(false);
  const { theme, setTheme } = useTheme();
  const nextTheme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
  const ThemeIcon = theme === 'system' ? Monitor : theme === 'light' ? Sun : Moon;

  useEffect(() => {
    let active = true;
    void fetch(`${getBackendBaseUrl()}/setup/status`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() as Promise<{ hasUsers?: boolean }> : Promise.reject())
      .then((status) => { if (active) setHasUsers(status.hasUsers !== false); })
      .catch(() => { if (active) setHasUsers(true); });
    return () => { active = false; };
  }, []);

  return (
    <>
    <header dir="rtl" className="sticky top-0 z-40 relative flex h-16 items-center border-b border-border bg-card/90 px-5 backdrop-blur-md">
      <nav className="absolute start-2 flex items-center gap-1.5 md:start-5" aria-label="منوی اصلی">
        <Link href="/login" aria-label="ورود" title="ورود" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:bg-muted"><LogIn size={18} /></Link>
        {hasUsers === true ? (
          <button type="button" onClick={() => setShowRegisterNotice(true)} aria-label="ثبت‌نام" title="ثبت‌نام" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:bg-muted"><UserPlus size={18} /></button>
        ) : hasUsers === false ? (
          <Link href="/register" aria-label="ثبت‌نام" title="ثبت‌نام" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:bg-muted"><UserPlus size={18} /></Link>
        ) : (
          <Link href="/login" aria-label="ثبت‌نام" title="ثبت‌نام" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:bg-muted"><UserPlus size={18} /></Link>
        )}
        <button type="button" onClick={() => setTheme(nextTheme)} aria-label="تغییر پوسته" title="تغییر پوسته" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:bg-muted"><ThemeIcon size={18} /></button>
      </nav>
      <Link href="/" className="group absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-xl" aria-label="صفحهٔ اصلی رهیار">
        <div className="flex h-10 w-10 items-center justify-center text-primary sm:h-11 sm:w-11"><ShieldCheck size={25} /></div>
        <span className="text-lg font-black tracking-tight sm:text-xl">رهیار</span>
      </Link>
    </header>
      {showRegisterNotice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60 p-4" role="presentation" onClick={() => setShowRegisterNotice(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="register-notice-title" dir="rtl" className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-border bg-card p-6 text-center shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h2 id="register-notice-title" className="text-lg font-black">ثبت‌نام غیرفعال است</h2>
            <p className="mt-2 text-sm text-muted-foreground">حساب مالک سامانه قبلاً ساخته شده است. برای ورود به صفحهٔ ورود بروید.</p>
            <div className="mt-5 flex justify-center gap-2">
              <button type="button" onClick={() => setShowRegisterNotice(false)} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted">بستن</button>
              <Link href="/login" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">رفتن به ورود</Link>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default PublicHeader;
