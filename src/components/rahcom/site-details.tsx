import type { RahcomInfoField } from './information';

/** Full window site information, with the same field layout used throughout Rahcom. */
export function RahcomSiteDetails({ title, fields }: { title: string; fields: RahcomInfoField[] }) {
  return <section aria-label={title} className="space-y-2">
    <h3 className="border-b border-border/70 pb-1 text-sm font-semibold text-foreground">{title}</h3>
    <div className="rahcom-details-grid grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((field, index) => <div key={`${field.label}:${index}`} className="min-w-0 rounded-lg border border-border/70 bg-card p-3">
        <div className="text-xs text-muted-foreground">{field.label}</div>
        <div dir="auto" className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{field.value || '—'}</div>
      </div>)}
    </div>
  </section>;
}
