'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, Eye, Globe, TrendingUp } from 'lucide-react';

import { PublicHeader } from '@/components/layout/public-header';
import { visitorStatsApi } from '@/lib/api/shared/visitor-stats-api';

type VisitStats = {
  daily: number;
  weekly: number;
  monthly: number;
  yearly: number;
};

export function PublicLanding() {
  const [stats, setStats] = useState<VisitStats>({ daily: 0, weekly: 0, monthly: 0, yearly: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [statsFailed, setStatsFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const loadStats = async () => {
      try {
        await visitorStatsApi.recordPageVisit();
        const data = await visitorStatsApi.get();
        if (!active) return;
        setStatsFailed(!data?.enabled);
        if (data?.enabled) {
          setStats({
            daily: Number(data.daily ?? 0),
            weekly: Number(data.weekly ?? 0),
            monthly: Number(data.monthly ?? 0),
            yearly: Number(data.yearly ?? 0),
          });
        }
      } catch (error) {
        if (active) setStatsFailed(true);
        console.warn('Could not load visitor statistics:', error);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadStats();
    return () => { active = false; };
  }, []);

  const metrics = [
    { label: 'بازدید امروز', value: stats.daily, icon: Eye, tone: 'text-sky-500 dark:text-sky-400', tile: 'bg-sky-500/10' },
    { label: 'این هفته', value: stats.weekly, icon: TrendingUp, tone: 'text-emerald-600 dark:text-emerald-400', tile: 'bg-emerald-500/10' },
    { label: 'این ماه', value: stats.monthly, icon: CalendarDays, tone: 'text-violet-600 dark:text-violet-400', tile: 'bg-violet-500/10' },
    { label: 'امسال', value: stats.yearly, icon: Globe, tone: 'text-amber-600 dark:text-amber-400', tile: 'bg-amber-500/10' },
  ];

  return (
    <main dir="rtl" className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <div className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-6xl flex-col justify-center px-5 pb-8 pt-7 sm:px-8 sm:pt-10">
        <section className="relative isolate flex flex-col items-center px-2 pb-7 text-center sm:pb-9">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 -z-10 mx-auto h-40 max-w-3xl rounded-full bg-primary/10 blur-[80px]" />
          <h1 className="max-w-4xl text-3xl font-black leading-[1.5] tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            کنترل یکپارچه سازمان با <span className="whitespace-nowrap text-blue-600 dark:text-sky-400">رهیار</span>
          </h1>
          <div aria-hidden="true" className="mt-4 h-1 w-16 rounded-full bg-blue-600 dark:bg-sky-400" />
        </section>

        <section aria-labelledby="visitor-stats-title">
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/70 shadow-lg shadow-black/5 backdrop-blur-sm sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-3.5 sm:px-7">
              <h2 id="visitor-stats-title" className="text-base font-extrabold text-slate-900 dark:text-white sm:text-lg">آمار بازدیدکنندگان</h2>
            </div>
            <div className="grid grid-cols-2 divide-x divide-x-reverse divide-y divide-border/70 sm:grid-cols-4 sm:divide-y-0">
              {metrics.map(({ label, value, icon: Icon, tone, tile }) => (
                <article key={label} className="flex min-h-24 items-center justify-between gap-3 px-4 py-4 sm:px-6">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground sm:text-sm">{label}</p>
                    <p className="mt-1.5 text-xl font-black tabular-nums text-slate-900 dark:text-white sm:text-2xl">
                      {isLoading ? <span className="inline-block h-7 w-12 animate-pulse rounded-md bg-muted align-middle" /> : statsFailed ? '—' : Number(value).toLocaleString('fa-IR')}
                    </p>
                  </div>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tile} ${tone}`}>
                    <Icon size={19} aria-hidden="true" />
                  </span>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default PublicLanding;
