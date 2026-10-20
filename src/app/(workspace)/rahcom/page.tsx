"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Clock3, LoaderCircle, Waypoints } from "lucide-react";
import { getLocaleDirection, usePreferences } from "@/components/preferences-provider";
import { uiMessage } from "@/lib/ui-messages";
import { getTickets } from "@/lib/api/tickets/ticket-api";
import type { Ticket } from "@/types/ticket";

export default function RahkamPage() {
  const { locale } = usePreferences();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => { void loadTickets(); }, [loadTickets]);

  const statusLabel: Record<Ticket["status"], string> = {
    OPEN: "باز",
    IN_PROGRESS: "در حال پیگیری",
    WAITING_FOR_CUSTOMER: "منتظر پاسخ",
    RESOLVED: "حل‌شده",
    CLOSED: "بسته‌شده",
    CANCELLED: "لغوشده",
  };
  const priorityLabel: Record<Ticket["priority"], string> = {
    LOW: "کم",
    MEDIUM: "متوسط",
    HIGH: "زیاد",
    URGENT: "فوری",
  };
  const dateLabel = (value: string) => new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : locale, { dateStyle: "medium" }).format(new Date(value));

  return (
    <main dir={getLocaleDirection(locale)} className="mx-auto max-w-5xl space-y-5">
      <header className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Waypoints size={21} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-foreground">{uiMessage(locale, "sidebarRahkam")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">درخواست‌ها و پیگیری‌های سامانه</p>
        </div>
      </header>
      <section className="space-y-3" aria-labelledby="rahcom-tickets-title">
        <h2 id="rahcom-tickets-title" className="text-sm font-bold text-foreground">درخواست‌ها <span className="font-normal text-muted-foreground">({tickets.length})</span></h2>
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
    </main>
  );
}
