'use client';

import { Clock3, FileSpreadsheet, Rows3 } from 'lucide-react';
import { uiMessage } from '@/lib/ui-messages';

export function RahcomRecordSummary({ locale, source, fileName, recordDate, count, savedAt, bare = false, showRecordDate = true, showSource = true, showCount = true, countLabel }: {
  locale: Parameters<typeof uiMessage>[0]; source: string; fileName?: string | null; recordDate: string; count: number; savedAt?: string | null; bare?: boolean; showRecordDate?: boolean; showSource?: boolean; showCount?: boolean; countLabel?: string;
}) {
  const timestamp = savedAt && !Number.isNaN(new Date(savedAt).getTime())
    ? new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR-u-ca-persian' : locale, { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23', timeZone: 'Asia/Tehran' }).format(new Date(savedAt))
    : '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(recordDate)
    ? new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR-u-ca-persian' : locale, { dateStyle: 'medium', timeZone: 'Asia/Tehran' }).format(new Date(`${recordDate}T12:00:00Z`))
    : recordDate;
  const format = fileName?.match(/\.([a-z0-9]+)$/i)?.[1]?.toUpperCase();
  const displayFileName = fileName?.replace(/\.[a-z0-9]+$/i, '');
  return <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground ${bare ? '' : 'rounded-xl border border-border bg-card px-4 py-3'}`}>
    {showSource && <span className="inline-flex min-w-0 items-center gap-2 text-foreground"><FileSpreadsheet size={15} className="shrink-0 text-primary" /><strong className="font-semibold">{displayFileName || source}</strong>{format && <bdi style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' }} className="rounded-md border px-1.5 py-0.5 font-mono text-[10px]">{format}</bdi>}</span>}
    {showCount && <span className="inline-flex items-center gap-1.5"><Rows3 size={14} />{countLabel ?? uiMessage(locale, 'rahcomRoadListRows')}: <strong className="tabular-nums text-foreground">{new Intl.NumberFormat(locale).format(count)}</strong></span>}
    {showRecordDate && <span>{uiMessage(locale, 'rahcomVisitDate')}: <strong className="text-foreground">{date}</strong></span>}
    <span className="inline-flex items-center gap-1.5"><Clock3 size={14} />{uiMessage(locale, 'rahcomRoadListLastUpdated')}: <time dir="auto" className="text-foreground">{timestamp}</time></span>
  </div>;
}
