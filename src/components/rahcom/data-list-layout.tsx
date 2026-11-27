import type { ReactNode } from 'react';
import { ArchiveRestore, Download, LoaderCircle, Plus, Search, Save, Settings2, Upload, WrapText, X } from 'lucide-react';
import { RahcomToolbar } from '@/components/rahcom/toolbar';
import { RahcomTableFrame } from '@/components/rahcom/table';

type ToolbarAction = { label: string; onClick?: () => void; disabled?: boolean; busy?: boolean };

type RahcomDataListToolbarProps = {
  compactOnNarrow?: boolean;
  count?: ReactNode;
  add?: ToolbarAction;
  settings?: ToolbarAction;
  upload?: ToolbarAction;
  uploadInput?: ReactNode;
  wrap?: { label: string; singleLineLabel: string; pressed: boolean; onToggle: () => void; disabled?: boolean };
  download?: ToolbarAction;
  search: { value: string; onChange: (value: string) => void; placeholder: string; label: string; clearLabel?: string };
  backup?: { open: boolean; onToggle: () => void; label: string; controlsId?: string; disabled?: boolean; save: ToolbarAction; restore: ToolbarAction };
};

const toolbarButtonClass = 'grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50';

/** Shared icon order, control sizing, and search capsule used by Rahcom data-list toolbars. */
export function RahcomDataListToolbar({ compactOnNarrow = false, count, add, settings, upload, uploadInput, wrap, download, search, backup }: RahcomDataListToolbarProps) {
  return <RahcomToolbar as="header" className={`flex shrink-0 items-center justify-start ${compactOnNarrow ? 'rahcom-mobile-toolbar mb-[8px] max-sm:mb-[4px] flex-wrap gap-2 overflow-visible py-1 sm:flex-nowrap sm:overflow-x-auto max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:overflow-y-hidden max-sm:pb-2' : 'flex-wrap gap-3'}`}>
    {count}
    {add && <button type="button" onClick={add.onClick} disabled={add.disabled} aria-label={add.label} title={add.label} className={toolbarButtonClass}><Plus size={18} /></button>}
    {settings && <button type="button" onClick={settings.onClick} disabled={settings.disabled || settings.busy} aria-label={settings.label} title={settings.label} className={toolbarButtonClass}>{settings.busy ? <LoaderCircle size={17} className="animate-spin" /> : <Settings2 size={17} />}</button>}
    {upload && <><button type="button" onClick={upload.onClick} disabled={upload.disabled || upload.busy} aria-label={upload.label} title={upload.label} className={toolbarButtonClass}>{upload.busy ? <LoaderCircle size={17} className="animate-spin" /> : <Upload size={17} />}</button>{uploadInput}</>}
    {wrap && <button type="button" aria-pressed={wrap.pressed} onClick={wrap.onToggle} disabled={wrap.disabled} aria-label={wrap.pressed ? wrap.singleLineLabel : wrap.label} title={wrap.pressed ? wrap.singleLineLabel : wrap.label} className={`grid size-9 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-50 ${wrap.pressed ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:border-primary hover:text-primary'}`}><WrapText size={17} aria-hidden="true" /></button>}
    {download && <button type="button" onClick={download.onClick} disabled={download.disabled || download.busy} aria-label={download.label} title={download.label} className={toolbarButtonClass}>{download.busy ? <LoaderCircle size={17} className="animate-spin" /> : <Download size={17} />}</button>}
    <label className="rahcom-search-capsule relative block w-full max-w-[15rem] rounded-full">
      <Search aria-hidden="true" size={17} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-foreground" />
      <input type="search" value={search.value} onChange={(event) => search.onChange(event.target.value)} placeholder={search.placeholder} aria-label={search.label} className={`h-9 w-full rounded-full border border-border bg-background ps-9 ${search.clearLabel && search.value ? 'pe-9' : 'pe-4'} text-sm text-foreground outline-none placeholder:text-foreground focus:border-primary`} />
      {search.clearLabel && search.value && <button type="button" onClick={() => search.onChange('')} aria-label={search.clearLabel} title={search.clearLabel} className="absolute end-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-foreground hover:bg-muted hover:text-foreground"><X size={14} /></button>}
    </label>
    {backup && <div className="flex shrink-0 items-center gap-2">
      <button type="button" aria-expanded={backup.open} aria-pressed={backup.open} aria-controls={backup.controlsId ?? 'rahcom-data-list-backup-actions'} onClick={backup.onToggle} disabled={backup.disabled} aria-label={backup.label} title={backup.label} style={backup.open ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`grid size-9 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-50 ${backup.open ? '' : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-primary'}`}><span aria-hidden="true" className="size-[26px] bg-current" style={{ maskImage: "url(/cloud-sync-exact.svg)", WebkitMaskImage: "url(/cloud-sync-exact.svg)", maskSize: 'contain', WebkitMaskSize: 'contain', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat', maskPosition: 'center', WebkitMaskPosition: 'center' }} /></button>
      {backup.open && <div id={backup.controlsId ?? 'rahcom-data-list-backup-actions'} className="flex items-center gap-2">
        <button type="button" onClick={backup.save.onClick} disabled={backup.save.disabled || backup.save.busy} aria-label={backup.save.label} title={backup.save.label} className={toolbarButtonClass}>{backup.save.busy ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}</button>
        <button type="button" onClick={backup.restore.onClick} disabled={backup.restore.disabled || backup.restore.busy} aria-label={backup.restore.label} title={backup.restore.label} className={toolbarButtonClass}>{backup.restore.busy ? <LoaderCircle size={17} className="animate-spin" /> : <ArchiveRestore size={17} />}</button>
      </div>}
    </div>}
  </RahcomToolbar>;
}

type RahcomDataListLayoutProps = {
  dir?: 'rtl' | 'ltr';
  toolbar: ReactNode;
  compactToolbarSpacing?: boolean;
  isLoading?: boolean;
  loadingMessage?: string;
  error?: string;
  emptyMessage: string;
  hasRows: boolean;
  beforeResults?: ReactNode;
  children?: ReactNode;
};

/** Shared Rahcom list-page contract: one toolbar, contextual status, and a table only when rows exist. */
export function RahcomDataListLayout({
  dir,
  toolbar,
  compactToolbarSpacing = false,
  isLoading = false,
  loadingMessage,
  error,
  emptyMessage,
  hasRows,
  beforeResults,
  children,
}: RahcomDataListLayoutProps) {
  return <section dir={dir} className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3 overflow-hidden">
    <div className={compactToolbarSpacing ? '-mb-3 shrink-0' : 'shrink-0'}>{toolbar}</div>
    {beforeResults}
    {isLoading && <p role="status" className="shrink-0 p-4 text-sm text-muted-foreground">{loadingMessage}</p>}
    {!isLoading && error && <p role="alert" className="shrink-0 rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{error}</p>}
    {!isLoading && !error && !hasRows && <p className="shrink-0 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>}
    {!isLoading && !error && hasRows && <RahcomTableFrame className="flex-1">{children}</RahcomTableFrame>}
  </section>;
}
