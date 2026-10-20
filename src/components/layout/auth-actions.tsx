/**
 * =====================================================
 *  فایل: src/components/layout/auth-actions.tsx
 *  هدف: مدیریت وضعیت حساب کاربری واردشده (نام و خروج)
 *  توضیح: این کامپوننت در هدر پنل کاربری لاگین‌شده استفاده می‌شود.
 * =====================================================
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut, UserCircle2 } from 'lucide-react';
import { logout } from '@/lib/api/shared/auth-api';

type AuthActionsProps = {
  userName?: string | null;
};

export function AuthActions({ userName }: AuthActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await logout();
    } catch (error) {
      console.error('Logout failed, redirecting anyway:', error);
    } finally {
      // هدایت به صفحه اصلی و تازه‌سازی کامل وضعیت احراز هویت
      router.replace('/');
      router.refresh();
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="flex items-center gap-3">
      {/* نمایش مشخصات کاربر لاگین‌شده */}
      <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-1.5 text-xs text-foreground/80 border border-border/60">
        <UserCircle2 size={16} className="text-primary shrink-0" />
        <span className="font-medium max-w-[140px] truncate">
          {userName || 'کاربر سیستم'}
        </span>
      </div>

      {/* دکمه خروج */}
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        title="خروج از حساب کاربری"
        aria-label="خروج از حساب کاربری"
        className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-all hover:bg-destructive hover:text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <LogOut size={14} className="rotate-180" />
        )}
        <span>{loading ? 'درحال خروج...' : 'خروج'}</span>
      </button>
    </div>
  );
}
