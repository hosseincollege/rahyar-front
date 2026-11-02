'use client';

import { MapPin } from 'lucide-react';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';

export function RahcomCountCapsule({ count }: { count: number }) {
  const { locale } = usePreferences();
  const label = uiMessage(locale, 'rahcomSystemsCount');
  return <span role="status" aria-label={`${new Intl.NumberFormat(locale).format(count)} ${label}`} title={label} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm text-foreground"><MapPin size={16} className="text-primary" /><strong className="font-bold tabular-nums">{new Intl.NumberFormat(locale).format(count)}</strong></span>;
}
