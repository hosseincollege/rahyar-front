// src/components/status/log-console.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Terminal,
  Trash2,
} from 'lucide-react';

import {
  clearLogs,
  subscribeLogs,
  type LogEntry,
} from '@/lib/log-store';

const levelStyles: Record<LogEntry['level'], string> = {
  info: 'text-sky-400',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  error: 'text-red-400',
};

const levelLabels: Record<LogEntry['level'], string> = {
  info: 'اطلاع',
  success: 'موفق',
  warning: 'هشدار',
  error: 'خطا',
};

function getLogTime(log: LogEntry): string {
  const logWithTime = log as LogEntry & {
    time?: string;
    timestamp?: string;
  };

  return logWithTime.time ?? logWithTime.timestamp ?? '';
}

export function LogConsole() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeLogs(setLogs);

    return () => {
      unsubscribe();
    };
  }, []);

  const handleCopy = async () => {
    const text = logs
      .map(
        (log) =>
          `[${getLogTime(log)}] [${levelLabels[log.level]}] ${log.message}`,
      )
      .join('\n');

    await navigator.clipboard.writeText(text);
    setCopied(true);

    window.setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  const errorCount = logs.filter(
    (log) => log.level === 'error',
  ).length;

  return (
    <section
      dir="rtl"
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      {/* هدر کنسول */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-muted px-4 py-2.5">
        <Terminal
          size={15}
          className="text-muted-foreground"
        />

        <span className="text-xs font-bold">
          لاگ‌ها
        </span>

        <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold">
          ({logs.length})
        </span>

        {errorCount > 0 && (
          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-500">
            {errorCount} خطا
          </span>
        )}

        <div className="ms-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold hover:bg-surface-hover"
          >
            {expanded ? (
              <ChevronUp size={12} />
            ) : (
              <ChevronDown size={12} />
            )}

            {expanded ? 'بستن' : 'بازکردن'}
          </button>

          <button
            type="button"
            onClick={handleCopy}
            disabled={!logs.length}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold hover:bg-surface-hover disabled:opacity-50"
          >
            {copied ? (
              <Check
                size={12}
                className="text-emerald-500"
              />
            ) : (
              <Copy size={12} />
            )}

            {copied ? 'کپی شد' : 'کپی'}
          </button>

          <button
            type="button"
            onClick={clearLogs}
            disabled={!logs.length}
            className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-500 hover:bg-red-500/20 disabled:opacity-50"
          >
            <Trash2 size={12} />
            پاکسازی
          </button>
        </div>
      </div>

      {/* بدنه لاگ‌ها */}
      {expanded && (
        <div className="erp-scrollbar max-h-56 overflow-y-auto p-3 font-mono text-[11px] leading-6">
          {logs.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">
              هنوز لاگی ثبت نشده است.
            </p>
          ) : (
            <ul className="space-y-1">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="flex items-start gap-2"
                >
                  <span className="text-muted-foreground">
                    {getLogTime(log)}
                  </span>

                  <span
                    className={`font-bold ${levelStyles[log.level]}`}
                  >
                    [{levelLabels[log.level]}]
                  </span>

                  <span
                    className="break-all"
                    dir="auto"
                  >
                    {log.message}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
