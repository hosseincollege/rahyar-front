'use client';

import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { NotificationsCenter } from '@/app/(workspace)/dashboard/events/notifications-center';

export default function NotificationsPage() {
  const { locale } = usePreferences();
  return (
    <main dir={getLocaleDirection(locale)} className="w-full space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
          {uiMessage(locale, 'dashboardTools')}
        </h1>
      </header>
      <NotificationsCenter initialTab="notifications" />
    </main>
  );
}
