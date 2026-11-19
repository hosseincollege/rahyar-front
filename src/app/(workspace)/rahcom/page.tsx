'use client';

import { getLocaleDirection, usePreferences } from '@/components/providers/preferences-provider';
import { VisitorStatsOverview } from '@/app/(workspace)/rahcom/visitor-stats-overview';

export default function RahcomPage() {
  const { locale } = usePreferences();

  return (
    <main dir={getLocaleDirection(locale)} className="mx-auto max-w-5xl">
      <VisitorStatsOverview />
    </main>
  );
}
