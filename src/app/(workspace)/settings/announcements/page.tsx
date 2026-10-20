'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Archive, Megaphone, Pin, Send, Pencil, X } from 'lucide-react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { notificationsApi, type Announcement } from '@/lib/api/shared/notifications-api';
import { uiMessage } from '@/lib/ui-messages';

export default function AnnouncementsSettingsPage() {
  const { locale } = usePreferences();
  const t = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const [canManage, setCanManage] = useState(false);
  const [items, setItems] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [branches, setBranches] = useState<Array<{id:string;name:string}>>([]);
  const [branchId, setBranchId] = useState('');
  const [allowLikes, setAllowLikes] = useState(true);
  const [allowReactions, setAllowReactions] = useState(true);
  const [allowComments, setAllowComments] = useState(true);
  const [allowMentions, setAllowMentions] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const [access, announcements] = await Promise.all([
        notificationsApi.getAnnouncementAccess(),
        notificationsApi.getAnnouncements(true),
      ]);
      setCanManage(access.canManage);
      setBranches(access.branches ?? []);
      setItems(announcements);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const publish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !body.trim() || saving) return;
    setSaving(true);
    setError(false);
    try {
      const draft = {
        title: title.trim(), summary: summary.trim(), body: body.trim(),
        locale: 'fa', isPinned, branchId: branchId || null,
        allowLikes, allowReactions, allowComments, allowMentions,
      };
      if (editingId) await notificationsApi.updateAnnouncement(editingId, draft);
      else await notificationsApi.createAnnouncement(draft);
      resetForm();
      await load();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => { setTitle(''); setSummary(''); setBody(''); setIsPinned(false); setBranchId(''); setAllowLikes(true); setAllowReactions(true); setAllowComments(true); setAllowMentions(true); setEditingId(null); };
  const edit = (item: Announcement) => { setEditingId(item.id); setTitle(item.title); setSummary(item.summary ?? ''); setBody(item.body); setIsPinned(item.isPinned); setBranchId(item.branchId ?? ''); setAllowLikes(item.allowLikes); setAllowReactions(item.allowReactions); setAllowComments(item.allowComments); setAllowMentions(item.allowMentions); window.scrollTo({top:0,behavior:'smooth'}); };

  const archive = async (item: Announcement) => {
    if (!window.confirm(t('announcementArchiveConfirm'))) return;
    try {
      await notificationsApi.archiveAnnouncement(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    } catch { setError(true); }
  };

  return <main dir={getLocaleDirection(locale)} className="mx-auto max-w-5xl space-y-5">
    <header className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Megaphone size={21}/></span>
      <div><h1 className="text-lg font-bold">{t('announcementManagementTitle')}</h1><p className="mt-1 text-sm text-muted-foreground">{t('announcementManagementDescription')}</p></div>
    </header>
    {error && <div role="alert" className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><span>{t('announcementLoadFailed')}</span><button onClick={() => void load()} className="font-semibold underline">{t('announcementRetry')}</button></div>}
    {canManage ? <form onSubmit={publish} className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm"><span>{t('announcementTitleLabel')}</span><input required maxLength={180} value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5" /></label>
        <div className="space-y-1.5 text-sm"><span>{t('languageLabel')}</span><p className="rounded-xl border border-border bg-background px-3 py-2.5">فارسی</p></div>
      </div>
      <label className="block space-y-1.5 text-sm"><span>{t('announcementSummaryLabel')}</span><input maxLength={300} value={summary} onChange={(e) => setSummary(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5" /></label>
      <label className="block space-y-1.5 text-sm"><span>{t('announcementBodyLabel')}</span><textarea required rows={5} value={body} onChange={(e) => setBody(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5" /></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-sm"><span>{t('announcementBranch')}</span><select value={branchId} onChange={e=>setBranchId(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5"><option value="">{t('announcementAllBranches')}</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><div className="grid grid-cols-2 gap-2 text-sm">{([[allowLikes,setAllowLikes,'announcementAllowLikes'],[allowReactions,setAllowReactions,'announcementAllowReactions'],[allowComments,setAllowComments,'announcementAllowComments'],[allowMentions,setAllowMentions,'announcementAllowMentions']] as const).map(([value,setter,key])=><label key={key} className="flex items-center gap-2"><input type="checkbox" checked={value} onChange={e=>setter(e.target.checked)}/>{t(key)}</label>)}</div></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} /><Pin size={15}/>{t('announcementPinned')}</label><div className="flex gap-2">{editingId && <button type="button" onClick={resetForm} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm"><X size={15}/>{t('accountCancel')}</button>}<button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"><Send size={15}/>{saving ? t('announcementPublishing') : editingId ? t('announcementSaveEdit') : t('announcementPublish')}</button></div></div>
    </form> : <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-muted-foreground">{t('announcementPermissionNotice')}</p>}
    <section className="space-y-3">
      {loading ? <p className="p-5 text-center text-sm text-muted-foreground">{t('notificationsLoading')}</p> : items.length === 0 ? <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">{t('announcementEmpty')}</p> : items.map((item) => <article key={item.id} className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-4"><div className="min-w-0"><h2 className="font-semibold">{item.title} {item.isPinned && <Pin size={14} className="inline text-primary"/>}</h2>{item.summary && <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>}<p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.body}</p><p className="mt-2 text-xs text-muted-foreground">{item.branch?.name ?? t('announcementAllBranches')}</p></div>{canManage && <div className="flex"><button type="button" onClick={() => edit(item)} title={t('projectsEdit')} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><Pencil size={17}/></button><button type="button" onClick={() => void archive(item)} title={t('announcementArchive')} aria-label={t('announcementArchive')} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-destructive"><Archive size={17}/></button></div>}</article>)}
    </section>
  </main>;
}
