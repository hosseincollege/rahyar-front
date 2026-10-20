import { apiClient } from '@/lib/api-client';

export type NotificationText = string | Partial<Record<string, string>>;

export type AppNotification = {
  id: string;
  source: string;
  eventKey: string;
  title: NotificationText;
  body: NotificationText | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationsResult = {
  items: AppNotification[];
  unreadCount: number;
  unreadBySource?: Record<string, number>;
  nextCursor?: string | null;
};

export type Announcement = {
  id: string; title: string; summary: string | null; body: string; locale: string;
  category: string; priority: string; isPinned: boolean; createdAt: string;
  notificationId: string | null; readAt: string | null;
  allowLikes: boolean; allowReactions: boolean; allowComments: boolean; allowMentions: boolean;
  branchId: string | null; branch?: { id: string; name: string } | null;
  reactions: Array<{ emoji: string; count: number; reacted: boolean }>;
  comments: Array<{ id: string; body: string; createdAt: string; user: { firstName: string; lastName: string }; mentions: Array<{ userId: string }> }>;
};
export type AnnouncementDraft = Pick<Announcement, 'title' | 'body' | 'locale'> &
  Partial<Pick<Announcement, 'summary' | 'category' | 'priority' | 'isPinned' | 'allowLikes' | 'allowReactions' | 'allowComments' | 'allowMentions' | 'branchId'>>;

export const notificationsApi = {
  getList(filter: 'all' | 'unread' = 'all', cursor?: string | null): Promise<NotificationsResult> {
    const query = new URLSearchParams({ filter });
    if (cursor) query.set('cursor', cursor);
    return apiClient.get<NotificationsResult>(`/notifications?${query.toString()}`);
  },
  getSummary(): Promise<NotificationsResult> {
    return apiClient.get<NotificationsResult>('/notifications/summary');
  },
  markRead(id: string): Promise<AppNotification> {
    return apiClient.patch<AppNotification>(`/notifications/${encodeURIComponent(id)}/read`);
  },
  markAllRead(): Promise<{ updated: number }> {
    return apiClient.post<{ updated: number }>('/notifications/read-all');
  },
  getAnnouncements(management = false): Promise<Announcement[]> {
    return apiClient.get<Announcement[]>(`/notifications/announcements${management ? '?management=true' : ''}`);
  },
  getAnnouncementAccess(): Promise<{ canManage: boolean; branches?: Array<{id:string;name:string}>; mentionUsers?: Array<{id:string;username:string;firstName:string;lastName:string}> }> {
    return apiClient.get('/notifications/announcements/access');
  },
  createAnnouncement(draft: AnnouncementDraft): Promise<Announcement & { recipientCount: number }> {
    return apiClient.post('/notifications/announcements', draft);
  },
  archiveAnnouncement(id: string): Promise<Announcement> {
    return apiClient.patch(`/notifications/announcements/${encodeURIComponent(id)}/archive`);
  },
  updateAnnouncement(id: string, draft: AnnouncementDraft): Promise<Announcement> {
    return apiClient.patch(`/notifications/announcements/${encodeURIComponent(id)}`, draft);
  },
  toggleReaction(id: string, emoji: string): Promise<{ active: boolean }> {
    return apiClient.post(`/notifications/announcements/${encodeURIComponent(id)}/reactions`, { emoji });
  },
  addComment(id: string, body: string, mentionedUserIds: string[]): Promise<Announcement['comments'][number]> {
    return apiClient.post(`/notifications/announcements/${encodeURIComponent(id)}/comments`, { body, mentionedUserIds });
  },
  deleteComment(id: string, commentId: string): Promise<{ deleted: boolean }> {
    return apiClient.delete(`/notifications/announcements/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}`);
  },
};

export function getLocalizedNotificationText(
  text: NotificationText | null | undefined,
  locale: string,
): string {
  if (typeof text === 'string') return text;
  if (!text || typeof text !== 'object') return '';
  return text[locale] || text.fa || text.en || Object.values(text)[0] || '';
}

export function getSafeNotificationHref(href: string | null | undefined, fallback: string): string {
  if (!href || !href.startsWith('/') || href.startsWith('//') || href.includes('\\')) {
    return fallback;
  }
  return href;
}

export function notifyNotificationsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('notifications-updated'));
  }
}
