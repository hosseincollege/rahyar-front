'use client';

import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { developmentApi, type ImpersonationContext } from '@/lib/api/development/development-api';

export function ImpersonationBanner() {
  const { locale } = usePreferences();
  const [context, setContext] = useState<ImpersonationContext | null>(null);

  useEffect(() => {
    let active = true;
    developmentApi.getImpersonationContext()
      .then((result) => { if (active) setContext(result); })
      .catch(() => { if (active) setContext({ isImpersonating: false }); });
    return () => { active = false; };
  }, []);

  if (!context?.isImpersonating) return null;

  return (
    <section
      dir={getLocaleDirection(locale)}
      aria-live="polite"
      className="z-40 flex shrink-0 flex-wrap items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-100 sm:px-5"
    >
      <div className="flex min-w-0 items-center gap-2 text-xs sm:text-sm">
        <UserRound size={16} className="shrink-0" />
        <span>{uiMessage(locale, 'developmentCurrentlyViewingAs')}</span>
        <strong className="truncate">{context.target?.name ?? context.target?.username ?? '—'}</strong>
      </div>
    </section>
  );
}
