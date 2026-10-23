'use client';

import { DashboardLiveSections } from './dashboard-live-sections';
import { NotificationsOverview } from './notifications-overview';
import { VisitorStatsOverview } from './visitor-stats-overview';

/** Authenticated dashboard backed by organization announcements, service health, and audit activity. */
export function AuthenticatedHome() {
  return <div className="mx-auto max-w-5xl space-y-4"><VisitorStatsOverview /><NotificationsOverview /><DashboardLiveSections /></div>;
}
