'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpLeft, FolderKanban, Ticket as TicketIcon } from 'lucide-react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { isReducedEdition } from '@/lib/product-edition';
import { readShellVisibility } from '@/lib/module-visibility';
import { projectsApi, type SupportProjectItem } from '@/lib/api/shared/projects-api';
import { ticketApi } from '@/app/(workspace)/support/ticket-api';

export default function SupportHomePage() {
  const { locale } = usePreferences();
  const [navigationVisibility, setNavigationVisibility] = useState(() => readShellVisibility(isReducedEdition).navigationItems ?? {});
  const [projects, setProjects] = useState<SupportProjectItem[]>([]);
  const [ticketCount, setTicketCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const refresh = () => setNavigationVisibility(readShellVisibility(isReducedEdition).navigationItems ?? {});
    window.addEventListener('erp-module-visibility-change', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('erp-module-visibility-change', refresh); window.removeEventListener('storage', refresh); };
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([projectsApi.getSupportProjects(), ticketApi.getTickets()])
      .then(([projectItems, tickets]) => {
        if (!active) return;
        setProjects(projectItems);
        setTicketCount(tickets.length);
      })
      .catch(() => active && setError(uiMessage(locale, 'supportLoadFailed')))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [locale]);

  return <main dir={getLocaleDirection(locale)} className="space-y-6">
    <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div><p className="text-sm font-semibold text-primary">ERP</p><h1 className="mt-2 text-2xl font-bold text-foreground">{uiMessage(locale, 'sidebarSupport')}</h1><p className="mt-2 text-sm text-muted-foreground">{uiMessage(locale, 'supportProjectsDescription')}</p></div>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3"><TicketIcon size={19} className="text-primary"/><span className="text-sm font-semibold text-foreground">{ticketCount} {uiMessage(locale, 'supportTicketCount')}</span></div>
    </header>
    {error && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600">{error}</div>}
    <section className="space-y-3">
      <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-foreground">{uiMessage(locale, 'supportProjectsTitle')}</h2>{navigationVisibility['/support/all'] !== false && <Link href="/support/all" className="text-sm font-semibold text-primary hover:underline">{uiMessage(locale, 'sidebarAllTickets')}</Link>}</div>
      {loading ? <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{uiMessage(locale, 'supportLoading')}</div> : projects.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center"><FolderKanban className="mx-auto text-muted-foreground" size={30}/><p className="mt-3 text-sm text-muted-foreground">{uiMessage(locale, 'supportNoProjects')}</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <Link key={project.id} href={`/support/projects/${encodeURIComponent(project.id)}`} className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"><div className="flex items-start justify-between gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><FolderKanban size={21}/></span><ArrowUpLeft size={17} className="text-muted-foreground transition group-hover:text-primary"/></div><h3 className="mt-4 text-base font-bold text-foreground">{project.name}</h3><p dir="ltr" className="mt-1 text-start font-mono text-xs text-muted-foreground">{project.code}</p><p className="mt-4 text-xs text-muted-foreground">{project._count?.tickets ?? 0} {uiMessage(locale, 'supportTicketCount')}</p></Link>)}</div>}
    </section>
  </main>;
}
