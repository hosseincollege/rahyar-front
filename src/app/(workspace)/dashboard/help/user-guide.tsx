'use client';

import { BookOpen, Bell, Mail, Activity, LifeBuoy } from 'lucide-react';
import { usePreferences, getLocaleDirection } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';

const guideSections = [
  { icon: Activity, title: 'guideNavigationTitle', body: 'guideNavigationDescription' },
  { icon: Bell, title: 'guideNotificationsTitle', body: 'guideNotificationsDescription' },
  { icon: Mail, title: 'guideMessagesTitle', body: 'messagesDescription' },
  { icon: LifeBuoy, title: 'guideSupportTitle', body: 'guideSupportDescription' },
] as const;

export function UserGuidePage() {
  const { locale } = usePreferences();
  const t = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  return <div dir={getLocaleDirection(locale)} className="space-y-5">
    <header className="rounded-2xl border border-border bg-card p-5"><h1 className="flex items-center gap-2 text-xl font-bold text-foreground"><BookOpen size={21} className="text-primary" />{t('userGuideTitle')}</h1><p className="mt-2 text-sm text-muted-foreground">{t('userGuideDescription')}</p></header>
    <section className="grid gap-4 md:grid-cols-2">{guideSections.map(({ icon: Icon, title, body }) => <article key={title} className="rounded-2xl border border-border bg-card p-5"><h2 className="flex items-center gap-2 font-semibold text-foreground"><Icon size={18} className="text-primary" />{t(title)}</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">{t(body)}</p></article>)}</section>
  </div>;
}
