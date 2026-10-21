'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { developmentApi } from '@/lib/api/development/development-api';
import { ApiError } from '@/lib/api-client';
import { uiMessage } from '@/lib/ui-messages';

export default function AccountSwitchingPage() {
  const { locale } = usePreferences();
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [failed, setFailed] = useState(false);
  const t = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);

  const checkAccess = useCallback(async () => {
    setLoading(true); setDenied(false); setFailed(false);
    try {
      await developmentApi.getAccounts();
    } catch (error) {
      setDenied(error instanceof ApiError && error.status === 403);
      setFailed(!(error instanceof ApiError && error.status === 403));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void checkAccess(); }, [checkAccess]);

  return (
    <main dir={getLocaleDirection(locale)} className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ArrowLeftRight size={21} /></span>
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('developmentAccountSwitching')}</h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('developmentAccountSwitchingDescription')}</p>
        </div>
      </header>
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        {loading ? <p className="text-sm text-muted-foreground">{t('developmentAccountListLoading')}</p>
          : denied ? <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t('developmentAccessDenied')}</p>
          : failed ? <div role="alert" className="space-y-2"><p className="text-sm text-red-700 dark:text-red-300">{t('developmentAccountListFailed')}</p><button type="button" onClick={() => void checkAccess()} className="text-sm font-semibold text-primary underline">{t('projectsRetry')}</button></div>
          : <div className="rounded-xl border border-border p-4">
            <p className="text-sm font-semibold text-foreground">{t('developmentShowSwitcherInHeader')}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('developmentShowSwitcherInHeaderDescription')}</p>
          </div>}
      </section>
    </main>
  );
}
