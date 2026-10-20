/**
 * مسیر فایل:
 * src/components/status/api-status-panel.tsx
 * هدف: پنل وضعیت سامانه، خلاصه لاگ‌های اخیر شبکه و مودال تاریخچه کامل ارتباطات API
 */

'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  Copy,
  Check,
  Trash2,
  X,
  FileText,
} from 'lucide-react';
import { useStatusStore, type StatusLevel } from '@/lib/status-store';

const statusConfig: Record<
  StatusLevel,
  {
    dot: string;
    badgeBg: string;
    label: string;
    defaultMessage: string;
    icon: typeof CheckCircle2;
  }
> = {
  ok: {
    dot: 'bg-emerald-500',
    badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
    label: 'متصل',
    defaultMessage: 'ارتباط با سرویس‌ها برقرار است',
    icon: CheckCircle2,
  },
  warning: {
    dot: 'bg-amber-500',
    badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
    label: 'هشدار',
    defaultMessage: 'پاسخ سرور با تاخیر یا هشدار مواجه شد',
    icon: AlertTriangle,
  },
  error: {
    dot: 'bg-red-500',
    badgeBg: 'bg-red-500/15 border-red-500/30 text-red-400',
    label: 'قطع ارتباط',
    defaultMessage: 'خطا در برقراری ارتباط با سرور',
    icon: XCircle,
  },
  idle: {
    dot: 'bg-slate-500',
    badgeBg: 'bg-slate-800 border-slate-700 text-slate-400',
    label: 'آماده',
    defaultMessage: 'سامانه آماده تبادل داده است',
    icon: Activity,
  },
};

export function ApiStatusPanel() {
  const { level, logs, clear } = useStatusStore();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const current = statusConfig[level] || statusConfig.idle;
  const IconComponent = current.icon;

  // نمایش ۲ الی ۳ لاگ آخر در کادر پیش‌نمایش
  const recentLogs = logs.slice(0, 2);

  // بستن مودال با کلید Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const handleCopyLogs = async () => {
    if (logs.length === 0) return;
    const textToCopy = logs
      .map(
        (log) =>
          `[${log.time}] [${log.method || 'REQ'}] ${log.status ?? 'STATUS'} ${log.url || ''} -> ${log.message || ''}`
      )
      .join('\n');
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="flex h-full w-full min-w-0 flex-1 flex-col">
      {/* کارت وضعیت — هم‌ابعاد و هم‌استایل با کارت ۶۰٪ هدر صفحات */}
      <section
        dir="rtl"
        aria-label="وضعیت شبکه"
        className="flex h-full w-full min-w-0 flex-col justify-between rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm"
      >
        {/* ردیف بالای کارت: آیکون، عنوان، بج وضعیت و دکمه مودال لاگ‌ها */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                level === 'error'
                  ? 'bg-red-500/10 text-red-500'
                  : level === 'warning'
                    ? 'bg-amber-500/10 text-amber-500'
                    : level === 'ok'
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'bg-blue-500/10 text-blue-500'
              }`}
            >
              <IconComponent size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground">وضعیت سامانه</h2>
              <p className="truncate text-xs text-muted-foreground">
                {current.defaultMessage}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${current.badgeBg}`}
            >
              <span className={`h-2 w-2 animate-pulse rounded-full ${current.dot}`} />
              <span>{current.label}</span>
            </div>

            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-all hover:bg-accent hover:text-blue-500"
            >
              <FileText size={14} className="text-blue-500" />
              <span>لاگ‌ها</span>
              {logs.length > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600/20 px-1 text-[10px] font-bold text-blue-400">
                  {logs.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* پیش‌نمایش لاگ‌های اخیر */}
        <div className="mt-3.5 space-y-1.5">
          {recentLogs.length === 0 ? (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-2 text-xs text-muted-foreground">
              هنوز درخواستی ثبت نشده است
            </div>
          ) : (
            recentLogs.map((log, index) => {
              const isErr = log.level === 'error';
              const isWarn = log.level === 'warning';

              return (
                <div
                  key={log.id || index}
                  dir="ltr"
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-1.5 font-mono text-xs ${
                    isErr
                      ? 'border-red-500/30 bg-red-500/5 text-red-300'
                      : isWarn
                        ? 'border-amber-500/30 bg-amber-500/5 text-amber-300'
                        : 'border-border bg-muted/40 text-muted-foreground'
                  }`}
                >
                  {/* متد، وضعیت و URL */}
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        log.method === 'GET'
                          ? 'bg-sky-500/20 text-sky-400'
                          : log.method === 'POST'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : log.method === 'DELETE'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {log.method || 'REQ'}
                    </span>
                    <span
                      className={`shrink-0 font-bold ${
                        isErr ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {log.status ?? '—'}
                    </span>
                    <span className="truncate text-[11px]">{log.url}</span>
                  </div>

                  {/* زمان رویداد */}
                  <span className="shrink-0 font-sans text-[11px] text-muted-foreground">
                    {log.time}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* مودال تمام‌صفحه تاریخچه لاگ‌ها */}
      {open && (
        <div
          dir="rtl"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-[85vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl"
          >
            {/* هدر مودال */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-900/60 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                  <IconComponent size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    گزارش و تاریخچه تبادلات شبکه (API Logs)
                  </h2>
                  <p className="text-xs text-slate-400">
                    نمایش فنی اندپوینت‌ها، کدهای پاسخ، وضعیت و لاگ سرور
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyLogs}
                  disabled={logs.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 hover:text-white disabled:opacity-40"
                >
                  {copied ? (
                    <>
                      <Check size={14} className="text-emerald-400" />
                      <span className="text-emerald-400">کپی شد</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>کپی تمام لاگ‌ها</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={clear}
                  disabled={logs.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-40"
                >
                  <Trash2 size={14} />
                  <span>پاک‌سازی</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                  title="بستن پنجره (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* بدنه لاگ‌ها (LTR) */}
            <div dir="ltr" className="flex-1 space-y-2.5 overflow-y-auto p-5 font-mono text-sm">
              {logs.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 font-sans text-slate-500">
                  <Activity size={36} className="text-slate-600" />
                  <p className="text-sm font-medium">No logs recorded yet.</p>
                </div>
              ) : (
                logs.map((log, index) => {
                  const isErr = log.level === 'error';
                  const isWarn = log.level === 'warning';

                  return (
                    <div
                      key={log.id || index}
                      className={`flex flex-col gap-2 rounded-xl border p-3.5 text-left ${
                        isErr
                          ? 'border-red-500/30 bg-red-950/20 text-red-200'
                          : isWarn
                            ? 'border-amber-500/30 bg-amber-950/20 text-amber-200'
                            : 'border-emerald-500/20 bg-slate-900/70 text-slate-200'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
                              log.method === 'GET'
                                ? 'bg-sky-500/20 text-sky-400'
                                : log.method === 'POST'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : log.method === 'PUT' || log.method === 'PATCH'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : log.method === 'DELETE'
                                      ? 'bg-red-500/20 text-red-400'
                                      : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {log.method || 'REQ'}
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                              isErr
                                ? 'bg-red-500/20 text-red-400'
                                : isWarn
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-emerald-500/20 text-emerald-400'
                            }`}
                          >
                            {log.status ?? 'STATUS'}
                          </span>
                          <span className="break-all text-xs font-semibold text-slate-100">
                            {log.url}
                          </span>
                        </div>
                        <span className="shrink-0 font-sans text-xs text-slate-400">
                          {log.time}
                        </span>
                      </div>

                      {log.message && (
                        <div className="flex items-center gap-2 rounded-lg border border-slate-800/60 bg-black/40 px-3 py-1.5 text-xs text-slate-300">
                          <span className="font-bold text-slate-500">↳ Result:</span>
                          <span className="break-all">{log.message}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* فوتر مودال */}
            <div className="flex shrink-0 items-center justify-between border-t border-slate-800/80 bg-slate-900/40 px-6 py-3 font-sans text-xs text-slate-400">
              <span>تعداد کل رویدادها: {logs.length}</span>
              <span>برای خروج خارج از کادر کلیک کنید یا Esc را بزنید.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
