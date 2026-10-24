'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePreferences } from '@/components/preferences-provider';
import { projectsApi } from '@/lib/api/shared/projects-api';
import { ticketApi } from '@/app/(workspace)/support/ticket-api';
import type { Ticket } from '@/app/(workspace)/support/types';
import { uiMessage } from '@/lib/ui-messages';

export function RahcomTickets() {
  const { locale } = usePreferences();
  const searchParams = useSearchParams(); const systemFilter = searchParams.get('system')?.toLocaleLowerCase(locale) ?? '';
  const [projectId, setProjectId] = useState(''); const [tickets, setTickets] = useState<Ticket[]>([]); const [error, setError] = useState('');
  useEffect(() => { let active = true; void projectsApi.getRahcomProject().then(async project => { if (!active) return; setProjectId(project.id); const rows = await ticketApi.getTickets({ projectId: project.id }); if (active) setTickets(rows); }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : ''); }); return () => { active = false; }; }, []);
  const visible = tickets.filter(ticket => !systemFilter || `${ticket.subject} ${ticket.description}`.toLocaleLowerCase(locale).includes(systemFilter));
  return <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold text-foreground">{uiMessage(locale, 'rahcomTickets')}</h2>{projectId && <Link href={`/support/new?projectId=${encodeURIComponent(projectId)}`} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{uiMessage(locale, 'supportNewTicket')}</Link>}</div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}{visible.length ? <ul className="divide-y divide-border rounded-xl border border-border">{visible.map(ticket => <li key={ticket.id}><Link href="/support/all" className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm hover:bg-muted/40"><span className="font-semibold text-foreground">#{ticket.ticketNumber} · {ticket.subject}</span><span className="text-muted-foreground">{ticket.status} · {ticket.priority}</span></Link></li>)}</ul> : !error && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{uiMessage(locale, 'searchNoResults')}</p>}</section>;
}
