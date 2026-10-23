/**
 * مسیر فایل:
 * src/app/(workspace)/settings/page.tsx
 *
 * هدف:
 * صفحه اصلی تنظیمات (معرفی قابلیت‌های موجود و دسترسی سریع بدون تغییر در چیدمان کلی).
 */

import type { Metadata } from 'next';
import { SettingsHomeContent } from './settings-home-content';

export const metadata: Metadata = {
  title: 'تنظیمات سیستم | ERP Pro',
  description: 'مدیریت اطلاعات شرکت، ساختار سازمانی، کاربران و دسترسی‌ها',
};

export default function SettingsPage() {
  return <SettingsHomeContent />;
}
