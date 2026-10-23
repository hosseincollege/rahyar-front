/**
 * @file src/components/home/public-landing.tsx
 * @description لندینگ پیج عمومی یکپارچه‌شده سامانه با نمایش ادغام‌شده معرفی، ماژول‌ها و آمار بازدید
 */

'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Eye,
  Globe,
  Headphones,
  Layers,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';

import { PublicHeader } from '@/components/layout/public-header';
import { visitorStatsApi } from '@/lib/api/shared/visitor-stats-api';

type VisitStats = {
  daily: number;
  weekly: number;
  monthly: number;
  yearly: number;
};

export function PublicLanding() {
  const [stats, setStats] = useState<VisitStats>({
    daily: 0,
    weekly: 0,
    monthly: 0,
    yearly: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [statsFailed, setStatsFailed] = useState(false);

  // واکشی داده‌های آمار بازدید و ثبت بازدید
  useEffect(() => {
    let isMounted = true;

    const trackAndFetchStats = async () => {
      try {
        await visitorStatsApi.recordPageVisit();
        const data = await visitorStatsApi.get();

        if (isMounted && data?.enabled) {
          setStatsFailed(false);
          setStats({
            daily: Number(data.daily ?? 0),
            weekly: Number(data.weekly ?? 0),
            monthly: Number(data.monthly ?? 0),
            yearly: Number(data.yearly ?? 0),
          });
        } else if (isMounted) {
          setStatsFailed(true);
        }
      } catch (error) {
        if (isMounted) setStatsFailed(true);
        console.warn('عدم برقراری ارتباط با سرویس آمار:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    trackAndFetchStats();

    return () => {
      isMounted = false;
    };
  }, []);

  const features = [
    {
      icon: Headphones,
      title: 'مدیریت تیکت و پشتیبانی',
      desc: 'درخواست‌ها، تیکت‌های مشتریان و گردش کار تیم پشتیبانی را در بستری متمرکز و یکپارچه مدیریت کنید.',
      badge: 'مرکز تماس و تیکتینگ',
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      borderHover: 'hover:border-blue-500/40',
    },
    {
      icon: Users,
      title: 'مدیریت مشتریان (CRM)',
      desc: 'پرونده مشتریان، سوابق تعاملات، پیگیری‌های دوره‌ای و تاریخچه فعالیت‌ها را همیشه همراه داشته باشید.',
      badge: 'روابط سازمانی',
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
      borderHover: 'hover:border-violet-500/40',
    },
    {
      icon: ClipboardList,
      title: 'فرآیندها و کنترل پروژه‌ها',
      desc: 'تخصیص وظایف به اعضای تیم، سنجش پیشرفت و زمان‌بندی دقیق اجرای پروژه‌های خرد و کلان.',
      badge: 'جریان کاری پویا',
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      borderHover: 'hover:border-emerald-500/40',
    },
    {
      icon: BarChart3,
      title: 'گزارش‌گیری و تحلیل داده‌ها',
      desc: 'داشبوردهای تحلیلی شفاف از امور مالی، فروش و عملکرد منابع انسانی برای اتخاذ تصمیمات دقیق مدیریتی.',
      badge: 'هوش تجاری',
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      borderHover: 'hover:border-amber-500/40',
    },
  ];

  return (
    <main
      dir="rtl"
      className="relative min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary"
    >
      {/* هدر عمومی */}
      <PublicHeader />

      {/* افکت نوری پس‌زمینه */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -z-10 h-[550px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-primary/15 via-blue-500/10 to-transparent blur-[140px]" />
        <div className="absolute top-[500px] right-10 -z-10 h-[400px] w-[400px] rounded-full bg-violet-500/5 blur-[120px]" />
      </div>

      {/* بخش ادغام‌شده: معرفی و امکانات کلیدی پلتفرم */}
      <section className="relative isolate pt-12 pb-16 sm:pt-16 sm:pb-20">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
          {/* هدر و معرفی Hero */}
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary shadow-xs backdrop-blur-md">
              <Sparkles size={14} className="animate-pulse" />
              <span>پلتفرم یکپارچه مدیریت هوشمند فرآیندهای سازمانی</span>
            </div>

            <h1 className="mt-6 text-3xl font-black tracking-tight leading-[1.3] sm:text-5xl lg:text-6xl">
              کنترل یکپارچه سازمان با{' '}
              <span className="bg-gradient-to-l from-primary via-blue-500 to-indigo-500 bg-clip-text text-transparent">
                ERP Pro
              </span>
            </h1>

            <p className="mt-5 text-sm leading-8 text-muted-foreground sm:text-base sm:leading-8">
              سامانه‌ای جامع، امن و ماژولار برای نظارت بر تیکت‌ها، ارتباط با مشتریان، پایش
              امور مالی و کنترل زنجیره انبار و پروژه‌ها؛ همه‌چیز متمرکز، سریع و مطمئن.
            </p>

            {/* هایلایت‌های شاخص */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs font-semibold text-muted-foreground sm:text-sm">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={17} className="text-emerald-500" />
                <span>امنیت داده در سطح سازمانی</span>
              </div>
              <div className="h-3.5 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <Layers size={17} className="text-blue-500" />
                <span>ماژولار و قابل توسعه</span>
              </div>
              <div className="h-3.5 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <Activity size={17} className="text-primary" />
                <span>پایش لحظه‌ای عملکرد</span>
              </div>
            </div>
          </div>

          {/* کارت‌های ماژول‌ها و امکانات (به‌صورت یکپارچه در زیر معرفی) */}
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className={`group relative rounded-3xl border border-border/80 bg-card/60 p-6 backdrop-blur-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${feature.borderHover}`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${feature.bg} ${feature.color} shadow-xs transition-transform group-hover:scale-105`}
                    >
                      <Icon size={22} />
                    </div>
                    <span className="rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                      {feature.badge}
                    </span>
                  </div>

                  <h2 className="mt-5 text-base font-black text-foreground sm:text-lg">
                    {feature.title}
                  </h2>
                  <p className="mt-2.5 text-xs leading-6 text-muted-foreground sm:text-sm sm:leading-7">
                    {feature.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* بخش آمار بازدیدکنندگان */}
      <section className="border-t border-border/70 bg-muted/30 py-16 backdrop-blur-xs sm:py-20">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
          <div className="mb-10 text-center">
            <span className="inline-block rounded-lg bg-primary/10 px-3 py-1 text-xs font-extrabold text-primary">
              شاخص‌های آماری
            </span>
            <h2 className="mt-3 text-2xl font-black sm:text-3xl">
              آمار بازدیدکنندگان سامانه
            </h2>
            <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
              تعداد مراجعات منحصربه‌فرد (Unique IP) ثبت‌شده در بستر سامانه
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              {
                label: 'بازدید امروز',
                value: stats.daily,
                icon: Eye,
                color: 'text-blue-500',
                bg: 'bg-blue-500/10',
              },
              {
                label: 'بازدید این هفته',
                value: stats.weekly,
                icon: TrendingUp,
                color: 'text-emerald-500',
                bg: 'bg-emerald-500/10',
              },
              {
                label: 'بازدید این ماه',
                value: stats.monthly,
                icon: CalendarDays,
                color: 'text-violet-500',
                bg: 'bg-violet-500/10',
              },
              {
                label: 'بازدید کل سال',
                value: stats.yearly,
                icon: Globe,
                color: 'text-amber-500',
                bg: 'bg-amber-500/10',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="relative overflow-hidden rounded-3xl border border-border/80 bg-card/70 p-5 shadow-xs backdrop-blur-lg transition-all hover:border-primary/30 hover:shadow-md sm:p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-muted-foreground">
                    {item.label}
                  </span>
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.bg} ${item.color}`}
                  >
                    <item.icon size={18} />
                  </div>
                </div>

                <div className="mt-5 text-2xl font-black text-foreground sm:text-3xl">
                  {isLoading ? (
                    <div className="h-8 w-16 animate-pulse rounded-lg bg-muted" />
                  ) : statsFailed ? (
                    '—'
                  ) : (
                    Number(item.value || 0).toLocaleString('fa-IR')
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* فوتر */}
      <footer className="border-t border-border/80 bg-card/40 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-5 py-6 text-xs font-semibold text-muted-foreground sm:flex-row sm:px-8 sm:text-sm">
          <p>© تمامی حقوق برای پلتفرم جامع ERP Pro محفوظ است.</p>
          <div className="flex items-center gap-2 text-foreground/80">
            <ShieldCheck size={16} className="text-primary" />
            <span>سامانه امن و یکپارچه سازمانی</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

export default PublicLanding;
