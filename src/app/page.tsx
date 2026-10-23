/**
 * @file src/app/page.tsx
 * @description صفحه اصلی ERP Pro.
 *
 * اگر کاربر لاگین نباشد، لندینگ عمومی نمایش داده می‌شود.
 * اگر کاربر لاگین باشد، به داشبورد داخل ورک‌اسپیس (/dashboard) هدایت می‌شود.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { PublicLanding } from '@/components/home/public-landing';
import { isUserAuthenticated } from '@/lib/api/shared/auth-api';

export default function HomePage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(
    null
  );

  useEffect(() => {
    const checkAuthentication = () => {
      const auth = isUserAuthenticated();
      setIsAuthenticated(auth);

      if (auth) {
        router.replace('/dashboard');
      }
    };

    /*
     * بررسی وضعیت احراز هویت هنگام mount
     */
    checkAuthentication();

    /*
     * هماهنگ‌سازی وضعیت احراز هویت در شرایط مختلف:
     * - بازگشت فوکوس به صفحه
     * - تغییر localStorage در تب دیگر
     * - ورود موفق
     * - خروج موفق
     */
    window.addEventListener('focus', checkAuthentication);
    window.addEventListener('storage', checkAuthentication);
    window.addEventListener('auth:login', checkAuthentication);
    window.addEventListener('auth:logout', checkAuthentication);

    return () => {
      window.removeEventListener('focus', checkAuthentication);
      window.removeEventListener('storage', checkAuthentication);
      window.removeEventListener('auth:login', checkAuthentication);
      window.removeEventListener('auth:logout', checkAuthentication);
    };
  }, [router]);

  /*
   * وضعیت احراز هویت هنوز مشخص نشده است.
   * این وضعیت از نمایش لحظه‌ای لندینگ یا داشبورد جلوگیری می‌کند.
   */
  if (isAuthenticated === null) {
    return (
      <main
        dir="rtl"
        aria-busy="true"
        aria-live="polite"
        className="
          flex
          min-h-screen
          items-center
          justify-center
          bg-[color:var(--background)]
          text-[color:var(--foreground)]
        "
      >
        <div
          role="status"
          className="
            animate-pulse
            text-sm
            text-[color:var(--muted-foreground)]
          "
        >
          در حال بارگذاری...
        </div>
      </main>
    );
  }

  /*
   * کاربر وارد شده است؛ چون هدایت به /dashboard انجام می‌شود، چیزی رندر نمی‌شود
   */
  if (isAuthenticated) {
    return null;
  }

  /*
   * کاربر وارد نشده است؛ نمایش صفحه عمومی
   */
  return <PublicLanding />;
}
