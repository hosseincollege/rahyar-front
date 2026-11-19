import type { RahcomInfoField } from './information';
import { RahcomElectricityDetails } from './electricity-details';
import { RahcomSiteDetails } from './site-details';

export type RahcomInformationSection = { title: string; fields: RahcomInfoField[]; kind?: 'electricity' | 'site' };

/** Shared expanded information layout, including the dedicated electricity section. */
export function RahcomInformationDetails({ sections }: { sections: RahcomInformationSection[] }) {
  return <div className="space-y-4 p-1">{sections.map((group) => group.kind === 'electricity'
    ? <RahcomElectricityDetails key={group.title} title={group.title} fields={group.fields} />
    : group.kind === 'site' ? <RahcomSiteDetails key={group.title} title={group.title} fields={group.fields} /> : <section key={group.title} aria-label={group.title} className="space-y-2"><h3 className="border-b border-border/70 pb-1 text-sm font-semibold text-foreground">{group.title}</h3><div className="rahcom-details-grid grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{group.fields.map((field) => <div key={field.label} className="min-w-0 rounded-lg border border-border/70 bg-card p-3"><div className="text-xs text-muted-foreground">{field.label}</div><div dir="auto" className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{field.value || '—'}</div></div>)}</div></section>)}</div>;
}
