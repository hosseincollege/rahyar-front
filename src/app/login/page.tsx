/**
 * @file src/app/login/page.tsx
 * @description صفحه ورود با هدر عمومی، سازگاری کامل تم لایت/دارک، باکس حساب آزمایشی (Demo) و رفع تداخل Autofill.
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { login } from '@/lib/api/shared/auth-api';
import { ApiError } from '@/lib/api-client';
import { uiMessage } from '@/lib/ui-messages';
import { PublicHeader } from '@/components/layout/public-header';

export default function LoginPage() {
  const router = useRouter();
  const { locale } = usePreferences();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ email: '', password: '' });

  const handleFillDemo = () => {
    setFormData({ email: 'demo', password: 'demo' });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login(formData);
      router.push('/');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'خطای ناشناخته در ورود';

      if (err instanceof ApiError && err.status === 429) {
        setError(uiMessage(locale, 'authRateLimited'));
      } else if (message.includes('identifier')) {
        setError('نام کاربری یا ایمیل وارد شده یافت نشد.');
      } else {
        setError(message.replace(/\|/g, '، '));
      }
    } finally {
      setLoading(false);
    }
  };

  // تابع پر کردن خودکار اطلاعات دمو

  return (
    <main dir={getLocaleDirection(locale)} className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <style jsx global>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px var(--surface) inset !important;
          -webkit-text-fill-color: var(--foreground) !important;
          caret-color: var(--foreground) !important;
          transition: background-color 9999s ease-out 0s;
        }
      `}</style>

      <PublicHeader />

      <section className="flex min-h-[calc(100vh-5rem)] items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-8">
          <h1 className="mb-6 text-center text-2xl font-bold text-[var(--foreground)]">
            ورود به سیستم
          </h1>

          <div className="mb-5 rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm">
            <p className="font-semibold">{uiMessage(locale, 'loginDemoTitle')}</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{uiMessage(locale, 'loginDemoCredentials')}</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span><span className="text-muted-foreground">{uiMessage(locale, 'loginDemoUsernameLabel')}: </span><b dir="ltr" className="font-mono">demo</b></span>
                <span><span className="text-muted-foreground">{uiMessage(locale, 'loginDemoPasswordLabel')}: </span><b dir="ltr" className="font-mono">demo</b></span>
              </div>
              <button type="button" onClick={handleFillDemo} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
                {uiMessage(locale, 'loginFillDemo')}
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </div>
            ) : null}

            <div>
              <label htmlFor="login-identifier" className="mb-1 block text-sm text-[var(--foreground)]">
                ایمیل یا نام کاربری
              </label>
              <input
                id="login-identifier"
                type="text"
                required
                value={formData.email}
                dir="ltr"
                name="username"
                autoComplete="username"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-left text-[var(--foreground)] outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary"
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1 block text-sm text-[var(--foreground)]">
                رمز عبور
              </label>
              <input
                id="login-password"
                type="password"
                required
                value={formData.password}
                dir="ltr"
                name="password"
                autoComplete="current-password"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-left text-[var(--foreground)] outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary"
                onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'در حال ورود...' : 'ورود'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
            اگر حساب کاربری ندارید، با مدیر سیستم تماس بگیرید.
          </p>
        </div>
      </section>
    </main>
  );
}
