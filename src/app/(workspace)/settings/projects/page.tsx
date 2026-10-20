'use client';

import { getCalendarLocale } from '@/lib/calendar';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Archive, CheckCircle2, CircleDashed, Download, FileJson2, FolderKanban, LoaderCircle, Pencil, Plus, Search, Ticket, Trash2, Upload, Users, X } from 'lucide-react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { ApiError } from '@/lib/api-client';
import { uiMessage } from '@/lib/ui-messages';
import { projectsApi, type ProjectDraft, type ProjectImportRecord, type ProjectItem, type ProjectStatus } from '@/lib/api/shared/projects-api';
import { parseProjectsImportData, PROJECTS_IMPORT_SAMPLE, projectsToExportData } from './projects-json';
import type { UiMessage } from '@/lib/languages/types';

const EMPTY_FORM: ProjectDraft = { code: '', name: '', description: '', status: 'ACTIVE' };

export default function ProjectsSettingsPage() {
  const { locale } = usePreferences();
  const direction = getLocaleDirection(locale);
  const t = (key: UiMessage) => uiMessage(locale, key);
  const fileInput = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectItem | null>(null);
  const [form, setForm] = useState<ProjectDraft>(EMPTY_FORM);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState(false);
  const [notice, setNotice] = useState<{ key: UiMessage; count?: number } | null>(null);
  const [importPreview, setImportPreview] = useState<{ fileName: string; projects: ProjectImportRecord[] } | null>(null);
  const [importError, setImportError] = useState<UiMessage | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoadError(false);
    try { setProjects(await projectsApi.getAll()); }
    catch { setLoadError(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadProjects(); }, [loadProjects]);

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale);
    if (!normalized) return projects;
    return projects.filter((project) =>
      project.code.toLocaleLowerCase(locale).includes(normalized) ||
      project.name.toLocaleLowerCase(locale).includes(normalized) ||
      (project.description ?? '').toLocaleLowerCase(locale).includes(normalized),
    );
  }, [locale, projects, query]);

  const activeCount = projects.filter((project) => project.status === 'ACTIVE').length;
  const openNewForm = () => { setEditing(null); setForm(EMPTY_FORM); setFormError(false); setFormOpen(true); };
  const openEditForm = (project: ProjectItem) => {
    setEditing(project);
    setForm({ code: project.code, name: project.name, description: project.description ?? '', status: project.status });
    setFormError(false);
    setFormOpen(true);
  };

  const saveProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formBusy) return;
    setFormBusy(true); setFormError(false); setNotice(null);
    try {
      if (editing) {
        await projectsApi.update(editing.id, form);
        setNotice({ key: 'projectsUpdateSuccess' });
      } else {
        await projectsApi.create(form);
        setNotice({ key: 'projectsCreateSuccess' });
      }
      setFormOpen(false);
      await loadProjects();
    } catch { setFormError(true); }
    finally { setFormBusy(false); }
  };

  const removeProject = async (project: ProjectItem) => {
    if (!window.confirm(t('projectsDeleteConfirm'))) return;
    setNotice(null);
    try {
      await projectsApi.remove(project.id);
      setProjects((current) => current.filter((item) => item.id !== project.id));
      setNotice({ key: 'projectsDeleteSuccess' });
    } catch { setNotice({ key: 'projectsDeleteFailed' }); }
  };

  const downloadJson = (fileName: string, value: unknown) => {
    const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = fileName; anchor.click();
    URL.revokeObjectURL(url);
  };

  const chooseImportFile = async (file?: File) => {
    setImportPreview(null); setImportError(null);
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setImportError('projectsImportFileTooLarge'); return; }
    try {
      const text = (await file.text()).replace(/^\uFEFF/, '');
      const parsed = parseProjectsImportData(JSON.parse(text));
      setImportPreview({ fileName: file.name, projects: parsed.projects });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'invalid';
      const key = code === 'empty' ? 'projectsImportEmpty' : code === 'tooMany' ? 'projectsImportTooMany' : code === 'duplicates' ? 'projectsImportDuplicates' : 'projectsImportInvalid';
      setImportError(key);
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const importProjects = async () => {
    if (!importPreview || importBusy) return;
    setImportBusy(true); setImportError(null); setNotice(null);
    try {
      const result = await projectsApi.importMany(importPreview.projects);
      setImportPreview(null);
      setNotice({ key: 'projectsImportSuccess', count: result.imported });
      await loadProjects();
    } catch (error) {
      setImportError(error instanceof ApiError && error.status === 409 ? 'projectsImportDuplicates' : 'projectsImportFailed');
    } finally { setImportBusy(false); }
  };

  const messageWithCount = (key: UiMessage, count: number) =>
    t(key).replace('{count}', new Intl.NumberFormat(locale).format(count));
  const statusLabel = (status: ProjectStatus) => ({
    ACTIVE: 'projectsStatusActive', ON_HOLD: 'projectsStatusOnHold',
    COMPLETED: 'projectsStatusCompleted', ARCHIVED: 'projectsStatusArchived',
  })[status] as UiMessage;
  const statusStyle = (status: ProjectStatus) => ({
    ACTIVE: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    ON_HOLD: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    COMPLETED: 'bg-primary/10 text-primary',
    ARCHIVED: 'bg-muted text-muted-foreground',
  })[status];

  return (
    <main dir={direction} className="w-full space-y-5">
      <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FolderKanban size={21}/></span>
          <div><h1 className="text-lg font-bold text-foreground">{t('projectsTitle')}</h1><p className="mt-1 text-sm text-muted-foreground">{t('projectsDescription')}</p></div>
        </div>
        <button type="button" onClick={openNewForm} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"><Plus size={17}/>{t('projectsNew')}</button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <article className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><FolderKanban size={19}/></span><div><p className="text-xs text-muted-foreground">{t('projectsTotal')}</p><p className="mt-1 text-xl font-bold tabular-nums">{new Intl.NumberFormat(locale).format(projects.length)}</p></div></article>
        <article className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><CheckCircle2 size={19}/></span><div><p className="text-xs text-muted-foreground">{t('projectsActiveCount')}</p><p className="mt-1 text-xl font-bold tabular-nums">{new Intl.NumberFormat(locale).format(activeCount)}</p></div></article>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <label className="relative min-w-0 flex-1 xl:max-w-sm"><Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('projectsSearchPlaceholder')} className="h-10 w-full rounded-xl border border-border bg-background ps-9 pe-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"/></label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => downloadJson('projects-template.json', PROJECTS_IMPORT_SAMPLE)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium transition hover:bg-muted"><Download size={15}/>{t('projectsImportTemplate')}</button>
            <button type="button" onClick={() => downloadJson('projects-export.json', projectsToExportData(projects))} disabled={!projects.length} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"><FileJson2 size={15}/>{t('projectsExport')}</button>
            <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" onChange={(event) => void chooseImportFile(event.target.files?.[0])}/>
            <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 text-xs font-semibold text-primary transition hover:bg-primary/10"><Upload size={15}/>{t('projectsImportAction')}</button>
          </div>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{t('projectsImportHint')}</p>

        {importError && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">{t(importError)}</p>}
        {importPreview && <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/[0.035] p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><FileJson2 size={17} className="shrink-0 text-primary"/><span className="truncate text-sm font-semibold">{importPreview.fileName}</span><span className="text-xs text-muted-foreground">· {messageWithCount('projectsImportCount', importPreview.projects.length)}</span></div><button type="button" onClick={() => setImportPreview(null)} aria-label={t('projectsCancel')} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X size={16}/></button></div>
          <div className="max-h-36 overflow-auto rounded-lg border border-border/70 bg-background"><ul className="divide-y divide-border/70">{importPreview.projects.slice(0, 6).map((item) => <li key={item.code} className="flex items-center gap-3 px-3 py-2 text-xs"><code dir="ltr" className="font-mono font-semibold text-primary">{item.code}</code><span className="truncate">{item.name}</span><span className="ms-auto shrink-0 text-muted-foreground">{t(statusLabel(item.status ?? 'ACTIVE'))}</span></li>)}</ul>{importPreview.projects.length > 6 && <p className="px-3 py-2 text-xs text-muted-foreground">+{new Intl.NumberFormat(locale).format(importPreview.projects.length - 6)}</p>}</div>
          <div className="flex justify-end"><button type="button" onClick={() => void importProjects()} disabled={importBusy} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground disabled:opacity-60">{importBusy ? <LoaderCircle size={15} className="animate-spin"/> : <Upload size={15} />}{importBusy ? t('projectsImporting') : t('projectsImportConfirm')}</button></div>
        </div>}
      </section>

      {notice && <p role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">{notice.count === undefined ? t(notice.key) : messageWithCount(notice.key, notice.count)}</p>}
      {loadError && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"><span>{t('projectsLoadFailed')}</span><button type="button" onClick={() => void loadProjects()} className="font-semibold underline underline-offset-2">{t('projectsRetry')}</button></div>}

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"><LoaderCircle size={17} className="animate-spin"/>{t('notificationsLoading')}</div> : filteredProjects.length === 0 ? <div className="flex flex-col items-center px-6 py-14 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><CircleDashed size={23}/></span><p className="mt-3 font-semibold">{projects.length ? t('projectsNoResults') : t('projectsEmpty')}</p></div> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-start text-sm">
            <thead className="border-b border-border bg-muted/35 text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">{t('projectsCode')}</th><th className="px-4 py-3 font-medium">{t('projectsName')}</th><th className="px-4 py-3 font-medium">{t('projectsStatus')}</th><th className="px-4 py-3 font-medium">{t('projectsUpdatedAt')}</th><th className="px-4 py-3 font-medium">{t('projectsTicketCount')} / {t('projectsMemberCount')}</th><th className="px-4 py-3 font-medium"><span className="sr-only">{t('projectsEdit')}</span></th></tr></thead>
            <tbody className="divide-y divide-border/70">{filteredProjects.map((project) => <tr key={project.id} className="transition-colors hover:bg-muted/20">
              <td className="px-4 py-3"><code dir="ltr" className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold text-primary">{project.code}</code></td>
              <td className="max-w-xs px-4 py-3"><p className="truncate font-semibold text-foreground">{project.name}</p>{project.description && <p className="mt-1 truncate text-xs text-muted-foreground">{project.description}</p>}</td>
              <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle(project.status)}`}>{t(statusLabel(project.status))}</span></td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{new Intl.DateTimeFormat(getCalendarLocale(locale), { dateStyle: 'medium' }).format(new Date(project.updatedAt))}</td>
              <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Ticket size={13}/>{new Intl.NumberFormat(locale).format(project._count?.tickets ?? 0)}<Users size={13} className="ms-2"/>{new Intl.NumberFormat(locale).format(project._count?.members ?? 0)}</span></td>
              <td className="px-4 py-3"><div className="flex justify-end gap-1"><button type="button" onClick={() => openEditForm(project)} aria-label={`${t('projectsEdit')} ${project.name}`} title={t('projectsEdit')} className="rounded-lg p-2 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"><Pencil size={15}/></button><button type="button" onClick={() => void removeProject(project)} aria-label={`${t('projectsDelete')} ${project.name}`} title={t('projectsDelete')} className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"><Trash2 size={15}/></button></div></td>
            </tr>)}</tbody>
          </table></div>
        )}
      </section>

      {formOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !formBusy) setFormOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="project-form-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6">
          <header className="mb-5 flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><FolderKanban size={19}/></span><div><h2 id="project-form-title" className="font-bold">{t(editing ? 'projectsEdit' : 'projectsNew')}</h2><p className="mt-1 text-xs text-muted-foreground">{t('projectsDescription')}</p></div></div><button type="button" disabled={formBusy} onClick={() => setFormOpen(false)} aria-label={t('projectsCancel')} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={17}/></button></header>
          <form onSubmit={(event) => void saveProject(event)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-sm"><span>{t('projectsCode')}</span><input required maxLength={80} dir="ltr" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder={t('projectsCodePlaceholder')} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-start font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60" disabled={formBusy}/></label><label className="space-y-1.5 text-sm"><span>{t('projectsName')}</span><input required maxLength={180} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={t('projectsNamePlaceholder')} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-start text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" disabled={formBusy}/></label></div>
            <label className="block space-y-1.5 text-sm"><span>{t('projectsDescriptionLabel')}</span><textarea maxLength={2000} rows={4} value={form.description ?? ''} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder={t('projectsDescriptionPlaceholder')} className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-start text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" disabled={formBusy}/></label>
            {editing && <label className="block space-y-1.5 text-sm"><span>{t('projectsStatus')}</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ProjectStatus })} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" disabled={formBusy}>{(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'] as const).map((status) => <option key={status} value={status}>{t(statusLabel(status))}</option>)}</select></label>}
            {formError && <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{t('projectsSaveFailed')}</p>}
            <footer className="flex justify-end gap-2 border-t border-border pt-4"><button type="button" disabled={formBusy} onClick={() => setFormOpen(false)} className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60">{t('projectsCancel')}</button><button type="submit" disabled={formBusy} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{formBusy && <LoaderCircle size={15} className="animate-spin"/>}{formBusy ? t('projectsSaving') : t('projectsSave')}</button></footer>
          </form>
        </section>
      </div>}
    </main>
  );
}
