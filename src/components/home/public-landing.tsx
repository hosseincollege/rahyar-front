'use client';

import { useEffect, useState } from 'react';
import { Activity, CalendarDays, Eye, TrendingUp, ShieldCheck } from 'lucide-react';
import { PublicHeader } from '@/components/layout/public-header';
import { visitorStatsApi } from '@/lib/api/shared/visitor-stats-api';

type Stats = { online: number; daily: number; weekly: number; monthly: number; yearly: number };

export function PublicLanding() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        await visitorStatsApi.recordPageVisit();
        const data = await visitorStatsApi.get();
        if (active && data.enabled) setStats({ online: data.online, daily: data.daily, weekly: data.weekly, monthly: data.monthly, yearly: data.yearly });
      } catch { if (active) setStats(null); }
    };
    void load();
    return () => { active = false; };
  }, []);

  const items = [
    { label: 'افراد آنلاین', value: stats?.online, icon: Activity },
    { label: 'بازدید امروز (IP یکتا)', value: stats?.daily, icon: Eye },
    { label: 'بازدید این هفته (IP یکتا)', value: stats?.weekly, icon: TrendingUp },
    { label: 'بازدید این ماه (IP یکتا)', value: stats?.monthly, icon: CalendarDays },
    { label: 'بازدید امسال (IP یکتا)', value: stats?.yearly, icon: CalendarDays },
  ];

  return (
    <main dir="rtl" className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <section className="relative mx-auto w-full max-w-6xl overflow-hidden px-5 py-12 sm:px-8 sm:py-16">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-1/4 top-0 h-48 rounded-full bg-primary/10 blur-3xl" />
        <section aria-label="آمار بازدیدکنندگان" className="relative rounded-3xl border border-border/80 bg-card/60 p-5 shadow-sm backdrop-blur-sm sm:p-8">
          <div className="mb-6 flex items-center justify-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Activity size={19} /></span>
            <h1 className="text-lg font-bold sm:text-xl">آمار بازدیدکنندگان</h1>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {items.map(({ label, value, icon: Icon }) => (
              <article key={label} className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card/90 p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-primary/70 via-primary/20 to-transparent opacity-70" />
                <div className="flex min-h-10 items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>{label}</span><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-105"><Icon size={18} /></span>
                </div>
                <p className="mt-4 text-3xl font-black tabular-nums">{value === undefined ? '—' : value.toLocaleString('fa-IR')}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

export default PublicLanding;
