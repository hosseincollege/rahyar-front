'use client';

import Link from 'next/link';
import { Activity, ArrowLeft, Database, FileCode2, Lock, ShieldCheck, Users } from 'lucide-react';
import { usePreferences } from '@/components/preferences-provider';
import { getLocaleDirection } from '@/components/preferences-provider';

export function SettingsHomeContent() {
  const { locale } = usePreferences();
  const cards = [
        { title: 'تنظیمات عمومی', status: 'لوگو و رنگ پوسته', detail: 'مدیریت نمایش سامانه', href: '/settings/company', icon: Database, color: 'bg-emerald-500/10 text-emerald-500' },
        { title: 'ساختار سازمانی', status: 'شعب و دپارتمان‌ها', detail: 'مدیریت اجزای سازمان', href: '/settings/organization', icon: Activity, color: 'bg-blue-500/10 text-blue-500' },
        { title: 'ورود و خروج اطلاعات', status: 'درون‌ریزی و برون‌بری', detail: 'انتقال تنظیمات با فایل JSON', href: '/settings/organization', icon: FileCode2, color: 'bg-amber-500/10 text-amber-500' },
        { title: 'حساب‌های کاربری', status: 'کاربران و نقش‌ها', detail: 'مدیریت حساب‌ها و مجوزها', href: '/settings/accounts', icon: Lock, color: 'bg-violet-500/10 text-violet-500' },
      ];

  return (
    <div dir={getLocaleDirection(locale)} className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ icon: Icon, ...card }) => (
          <Link href={card.href} key={card.title} className="block rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{card.title}</p>
                <p className="mt-2 text-base font-bold text-foreground">{card.status}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{card.detail}</p>
              </div>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.color}`}><Icon size={20} /></div>
            </div>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Activity size={20} /></div>
            <div>
              <h2 className="text-sm font-bold text-foreground">{"پیکربندی و مدیریت ماژولار"}</h2>
              <p className="mt-1.5 text-xs leading-6 text-muted-foreground">
                {"برای مدیریت مشخصات شرکت، شعب، دپارتمان‌ها، کاربران و نقش‌ها از بخش‌های تنظیمات استفاده کنید. تغییرات پس از ثبت هر فرم در سامانه ذخیره می‌شوند؛ این صفحه وضعیت زندهٔ سرویس‌ها را نمایش نمی‌دهد."}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div>
            <h3 className="text-xs font-bold text-foreground">{"دسترسی سریع"}</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">{"مدیریت کاربران، نقش‌ها و ساختار پایه"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/settings/company" className="inline-flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-accent hover:text-primary"><span>{"تنظیمات عمومی"}</span><ArrowLeft size={13} /></Link>
            <Link href="/settings/accounts" className="inline-flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-accent hover:text-primary"><span className="flex items-center gap-1.5"><Users size={14} />{"حساب‌های کاربری"}</span><ArrowLeft size={13} /></Link>
          </div>
        </div>
      </section>

      <footer className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-muted-foreground">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
        <p className="leading-5 text-amber-200/90"><strong className="font-bold text-amber-400">{"توجه امنیتی:"}</strong>{' '}{"تغییر در ساختار سازمان، تعریف شعب و مجوزهای نقش‌ها مستقیماً بر سطح دسترسی کاربران و گردش اسناد در سایر ماژول‌ها تأثیرگذار خواهد بود."}</p>
      </footer>
    </div>
  );
}
