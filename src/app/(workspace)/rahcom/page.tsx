'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Clock3, LoaderCircle, MapPinned, Waypoints } from 'lucide-react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { getTickets } from '@/lib/api/tickets/ticket-api';
import type { Ticket } from '@/types/ticket';

type RahcomTab = 'map' | 'requests';

export default function RahkamPage() {
  const { locale } = usePreferences();
  const [activeTab, setActiveTab] = useState<RahcomTab>('map');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setTickets(await getTickets());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'requests') void loadTickets();
  }, [activeTab, loadTickets]);

  const statusLabel: Record<Ticket['status'], string> = {
    OPEN: 'باز', IN_PROGRESS: 'در حال پیگیری', WAITING_FOR_CUSTOMER: 'منتظر پاسخ',
    RESOLVED: 'حل‌شده', CLOSED: 'بسته‌شده', CANCELLED: 'لغوشده',
  };
  const priorityLabel: Record<Ticket['priority'], string> = {
    LOW: 'کم', MEDIUM: 'متوسط', HIGH: 'زیاد', URGENT: 'فوری',
  };
  const dateLabel = (value: string) => new Intl.DateTimeFormat(
    locale === 'fa' ? 'fa-IR' : locale,
    { dateStyle: 'medium' },
  ).format(new Date(value));

  return (
    <main dir={getLocaleDirection(locale)} className="mx-auto max-w-5xl space-y-5">
      <header className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Waypoints size={21} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-foreground">{uiMessage(locale, 'sidebarRahkam')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">درخواست‌ها و پیگیری‌های سامانه</p>
        </div>
      </header>

      <nav aria-label={uiMessage(locale, 'sidebarRahkam')} className="flex gap-2 overflow-x-auto border-b border-border/60">
        {([
          { id: 'map', label: uiMessage(locale, 'rahcomMap'), Icon: MapPinned },
          { id: 'requests', label: uiMessage(locale, 'rahcomRequests'), Icon: Waypoints },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-t-lg border-b-2 px-4 text-sm font-medium transition-colors ${activeTab === id ? 'border-primary bg-primary/10 text-primary' : 'border-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground'}`}
          >
            <Icon size={16} aria-hidden="true" />{label}
          </button>
        ))}
      </nav>

      {activeTab === 'map' ? (
        <section role="tabpanel" aria-label={uiMessage(locale, 'rahcomMap')} className="relative isolate flex min-h-[360px] items-center justify-center overflow-hidden rounded-2xl border border-border bg-card p-6 text-center sm:min-h-[460px]">
          <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-70">
            <svg viewBox="0 0 900 500" preserveAspectRatio="xMidYMid slice" className="h-full w-full text-primary/15" fill="none">
              <path d="M-30 90 170 145 320 45 480 130 655 54 930 120M-20 390 190 335 350 430 540 340 730 420 920 330M105-30 160 150 115 315 210 530M380-20 340 110 415 250 345 510M660-20 610 150 700 270 635 520M-10 255 175 220 315 275 470 220 615 285 910 215" stroke="currentColor" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M-30 90 170 145 320 45 480 130 655 54 930 120M-20 390 190 335 350 430 540 340 730 420 920 330M105-30 160 150 115 315 210 530M380-20 340 110 415 250 345 510M660-20 610 150 700 270 635 520M-10 255 175 220 315 275 470 220 615 285 910 215" stroke="var(--card)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M230 100 270 132M520 168 565 190M250 355 295 370M690 310 740 285M455 70 470 95M130 285 170 275" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
            </svg>
          </div>
          <div className="max-w-sm rounded-2xl border border-border/70 bg-card/90 p-6 shadow-lg backdrop-blur-sm">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><MapPinned size={28} /></span>
            <h2 className="mt-4 text-base font-bold text-foreground">{uiMessage(locale, 'rahcomMap')}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{uiMessage(locale, 'rahcomMapPlaceholder')}</p>
          </div>
        </section>
      ) : (
        <section role="tabpanel" aria-label={uiMessage(locale, 'rahcomRequests')} className="space-y-3">
          <h2 className="text-sm font-bold text-foreground">{uiMessage(locale, 'rahcomRequests')} <span className="font-normal text-muted-foreground">({tickets.length})</span></h2>
          {loading ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground"><LoaderCircle size={16} className="animate-spin" />در حال دریافت درخواست‌ها…</div>
          ) : failed ? (
            <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300"><AlertCircle size={16} />دریافت درخواست‌ها انجام نشد.<button type="button" onClick={() => void loadTickets()} className="font-semibold underline underline-offset-4">تلاش دوباره</button></div>
          ) : tickets.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">هنوز درخواستی ثبت نشده است.</p>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <article key={ticket.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">درخواست شمارهٔ {ticket.ticketNumber}</p>
                      <h3 className="mt-1 font-semibold text-foreground">{ticket.subject}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">{statusLabel[ticket.status]}</span>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">اولویت {priorityLabel[ticket.priority]}</span>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{ticket.description}</p>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 size={13} />{dateLabel(ticket.createdAt)}{ticket.category ? <span> · {ticket.category}</span> : null}</div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
