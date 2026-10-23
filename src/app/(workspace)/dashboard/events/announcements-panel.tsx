'use client';

import { useCallback, useEffect, useState } from 'react';
import { Megaphone, RefreshCw, Send, Trash2 } from 'lucide-react';
import { usePreferences, getLocaleDirection } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { getCalendarLocale } from '@/lib/calendar';
import { notificationsApi, notifyNotificationsChanged, type Announcement } from '@/lib/api/shared/notifications-api';

export function AnnouncementsPanel() {
  const { locale } = usePreferences();
  const t = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const [messages, setMessages] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [users, setUsers] = useState<Array<{id:string;username:string;firstName:string;lastName:string}>>([]);
  const [drafts, setDrafts] = useState<Record<string,string>>({});
  const [mentions, setMentions] = useState<Record<string,string[]>>({});
  const load = useCallback(async () => {
    setLoading(true); setFailed(false);
    try { const [announcements, access] = await Promise.all([notificationsApi.getAnnouncements(), notificationsApi.getAnnouncementAccess()]); setMessages(announcements); setUsers(access.mentionUsers ?? []); }
    catch { setFailed(true); }
    finally { setLoading(false); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load synchronizes this panel with its API.
  useEffect(() => { void load(); }, [load]);
  const date = (value: string) => new Intl.DateTimeFormat(getCalendarLocale(locale), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  const categoryLabel = (category: string) => t(({ general: 'announcementCategoryGeneral', operations: 'announcementCategoryOperations', finance: 'announcementCategoryFinance', hr: 'announcementCategoryHr', technical: 'announcementCategoryTechnical' } as const)[category as 'general' | 'operations' | 'finance' | 'hr' | 'technical'] ?? 'announcementCategoryGeneral');
  const markRead = async (item: Announcement) => {
    if (!item.notificationId || item.readAt) return;
    setBusyId(item.id);
    try { await notificationsApi.markRead(item.notificationId); notifyNotificationsChanged(); setMessages((current) => current.map((message) => message.id === item.id ? { ...message, readAt: new Date().toISOString() } : message)); }
    catch { setFailed(true); }
    finally { setBusyId(null); }
  };
  const react = async (item: Announcement, emoji: string) => { try { await notificationsApi.toggleReaction(item.id, emoji); await load(); } catch { setFailed(true); } };
  const comment = async (item: Announcement) => { const body = drafts[item.id]?.trim(); if (!body) return; try { await notificationsApi.addComment(item.id, body, mentions[item.id] ?? []); setDrafts(v=>({...v,[item.id]:''})); setMentions(v=>({...v,[item.id]:[]})); await load(); } catch { setFailed(true); } };
  const removeComment = async (item: Announcement, commentId: string) => { try { await notificationsApi.deleteComment(item.id, commentId); await load(); } catch { setFailed(true); } };

  return <section dir={getLocaleDirection(locale)} className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-xl font-bold text-foreground"><Megaphone size={21} className="text-primary" />{t('messagesTitle')}</h1><p className="mt-1 text-sm text-muted-foreground">{t('messagesDescription')}</p></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />{t('notificationsRetry')}</button></header>
    {failed && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{t('messagesLoadFailed')} <button type="button" onClick={() => void load()} className="ms-2 underline">{t('notificationsRetry')}</button></div>}
    {loading && <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{t('notificationsLoading')}</p>}
    {!loading && !failed && !messages.length && <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{t('messagesEmpty')}</p>}
    {!loading && !failed && messages.map((item) => <article key={item.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm"><header className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Megaphone size={17} /></span><div className="min-w-0"><h2 className="font-semibold text-foreground">{item.title}</h2><p className="mt-1 text-xs text-muted-foreground">{date(item.createdAt)} · {categoryLabel(item.category)}{item.branch ? ` · ${item.branch.name}` : ''}</p></div></div>{!item.readAt && item.notificationId && <button type="button" onClick={() => void markRead(item)} disabled={busyId === item.id} className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50">{busyId === item.id ? t('notificationsLoading') : t('notificationsMarkRead')}</button>}</header>{item.summary && <p className="mt-4 font-medium text-foreground">{item.summary}</p>}<p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{item.body}</p>
      {(item.allowLikes || item.allowReactions) && <div className="mt-4 flex flex-wrap gap-2">{(item.allowLikes ? ['👍'] : []).concat(item.allowReactions ? ['❤️','😂','🎉','👏'] : []).map(emoji=>{const reaction=item.reactions.find(r=>r.emoji===emoji); return <button key={emoji} type="button" onClick={()=>void react(item,emoji)} className={`rounded-full border px-3 py-1 text-sm ${reaction?.reacted?'border-primary bg-primary/10 text-primary':'border-border hover:bg-muted'}`}>{emoji} {reaction?.count ?? 0}</button>})}</div>}
      {item.allowComments && <section className="mt-5 border-t border-border pt-4"><h3 className="mb-3 text-sm font-semibold">{t('announcementComments')} ({item.comments.length})</h3><div className="space-y-3">{item.comments.map(c=><div key={c.id} className="flex items-start justify-between gap-2 rounded-xl bg-muted/40 p-3"><div><p className="text-xs font-semibold">{c.user.firstName} {c.user.lastName}<span className="ms-2 font-normal text-muted-foreground">{date(c.createdAt)}</span></p><p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>{c.mentions.length>0&&<p className="mt-1 text-xs text-primary">{c.mentions.map(m=>`@${users.find(u=>u.id===m.userId)?.username ?? m.userId}`).join(' ')}</p>}</div><button type="button" title={t('announcementDeleteComment')} onClick={()=>void removeComment(item,c.id)} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 size={14}/></button></div>)}</div><textarea value={drafts[item.id]??''} onChange={e=>setDrafts(v=>({...v,[item.id]:e.target.value}))} maxLength={2000} rows={2} placeholder={t('announcementCommentPlaceholder')} className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"/>{item.allowMentions && <select multiple value={mentions[item.id]??[]} onChange={e=>setMentions(v=>({...v,[item.id]:Array.from(e.target.selectedOptions,o=>o.value)}))} aria-label={t('announcementMentionUsers')} className="mt-2 w-full rounded-xl border border-border bg-background p-2 text-sm">{users.map(u=><option key={u.id} value={u.id}>@{u.username} — {u.firstName} {u.lastName}</option>)}</select>}<button type="button" onClick={()=>void comment(item)} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"><Send size={14}/>{t('announcementCommentSend')}</button></section>}</article>)}
  </section>;
}
