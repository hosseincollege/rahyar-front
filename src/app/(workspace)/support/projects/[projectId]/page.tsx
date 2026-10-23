'use client';

import { getCalendarLocale } from '@/lib/calendar';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowRight, FolderKanban, Plus, Ticket as TicketIcon } from 'lucide-react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { isReducedEdition } from '@/lib/product-edition';
import { readShellVisibility } from '@/lib/module-visibility';
import { projectsApi, type SupportProjectItem } from '@/lib/api/shared/projects-api';
import { ticketApi } from '@/app/(workspace)/support/ticket-api';
import type { Ticket } from '@/app/(workspace)/support/types';

export default function SupportProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { locale } = usePreferences();
  const [navigationVisibility, setNavigationVisibility] = useState(() => readShellVisibility(isReducedEdition).navigationItems ?? {});
  const [project, setProject] = useState<SupportProjectItem | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const refresh = () => setNavigationVisibility(readShellVisibility(isReducedEdition).navigationItems ?? {});
    window.addEventListener('erp-module-visibility-change', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('erp-module-visibility-change', refresh); };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setProject(null);
    Promise.all([projectsApi.getSupportProjects(), ticketApi.getTickets({ projectId })])
      .then(([projects, rows]) => {
        if (!active) return;
        setProject(projects.find((item) => item.id === projectId) ?? null);
        setTickets(rows);
      })
      .catch(() => active && setError(uiMessage(locale, 'supportLoadFailed')))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [locale, projectId]);

  const canCreate = project?.supportRole !== 'VIEWER';
  return <main dir={getLocaleDirection(locale)} className="space-y-5">
    <Link href="/support" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"><ArrowRight size={16}/>{uiMessage(locale, 'sidebarSupport')}</Link>
    <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><FolderKanban size={21}/></span><div><p className="text-xs text-muted-foreground">{uiMessage(locale, 'supportProjectLabel')}</p><h1 className="mt-1 text-xl font-bold text-foreground">{project?.name ?? (loading ? uiMessage(locale, 'supportLoading') : '')}</h1>{project && <p dir="ltr" className="mt-1 text-start font-mono text-xs text-muted-foreground">{project.code}</p>}</div></div>
      {project && canCreate && navigationVisibility['/support/new'] !== false && <Link href={`/support/new?projectId=${encodeURIComponent(project.id)}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"><Plus size={17}/>{uiMessage(locale, 'supportNewTicket')}</Link>}
    </header>
    {error && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600">{error}</div>}
    {project?.supportRole === 'VIEWER' && <p className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">{uiMessage(locale, 'supportProjectViewOnly')}</p>}
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border p-4"><TicketIcon size={18} className="text-primary"/><h2 className="font-bold text-foreground">{uiMessage(locale, 'sidebarAllTickets')}</h2><span className="ms-auto text-xs text-muted-foreground">{tickets.length}</span></div>
      {loading ? <p className="p-8 text-center text-sm text-muted-foreground">{uiMessage(locale, 'supportLoading')}</p> : tickets.length === 0 ? <p className="p-10 text-center text-sm text-muted-foreground">{uiMessage(locale, 'supportTicketsEmpty')}</p> : <ul className="divide-y divide-border">{tickets.map((ticket) => <li key={ticket.id}><Link href={`/support/${encodeURIComponent(ticket.id)}`} className="flex items-center justify-between gap-4 p-4 transition hover:bg-muted/40"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-foreground">{ticket.subject}</span><span className="mt-1 block font-mono text-xs text-muted-foreground">TCK-{ticket.ticketNumber}</span></span><span className="shrink-0 text-xs text-muted-foreground">{new Intl.DateTimeFormat(getCalendarLocale(locale), { dateStyle: 'medium' }).format(new Date(ticket.createdAt))}</span></Link></li>)}</ul>}
    </section>
  </main>;
}
