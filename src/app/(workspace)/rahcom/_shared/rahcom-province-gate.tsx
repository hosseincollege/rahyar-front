'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePreferences, getLocaleDirection } from '@/components/providers/preferences-provider';
import { rahcomApi } from '@/lib/api/rahcom/rahcom-api';
import { uiMessage } from '@/lib/ui-messages';

type GateState = 'loading' | 'ready' | 'no-province' | 'select-province' | 'error';

export function RahcomProvinceGate({ children }: { children: ReactNode }) {
  const { locale } = usePreferences();
  const [state, setState] = useState<GateState>('loading');

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void rahcomApi.access().then((access) => {
        if (active) setState(access.provinces.length === 0 ? 'no-province' : access.hasProvinceAccess ? 'ready' : 'select-province');
      }).catch(() => { if (active) setState('error'); });
    };
    refresh();
    window.addEventListener('rahyar:province-change', refresh);
    return () => { active = false; window.removeEventListener('rahyar:province-change', refresh); };
  }, []);

  if (state === 'ready') return children;

  return <main dir={getLocaleDirection(locale)} className="flex h-full min-h-0 items-start justify-center p-5">
    <section role={state === 'error' ? 'alert' : 'status'} className={`w-full max-w-3xl rounded-xl border p-5 text-sm ${state === 'error' ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-border bg-card text-muted-foreground'}`}>
      {state === 'loading' && uiMessage(locale, 'rahcomSystemsLoading')}
      {state === 'no-province' && <>
        <p>{uiMessage(locale, 'rahcomNoProvinceConfigured')}</p>
        <Link href="/settings/organization" className="mt-3 inline-flex font-medium text-primary hover:underline">{uiMessage(locale, 'sidebarSettings')} · {uiMessage(locale, 'sidebarOrganizationStructure')}</Link>
      </>}
      {state === 'select-province' && uiMessage(locale, 'rahcomProvinceSelectionRequired')}
      {state === 'error' && uiMessage(locale, 'rahcomAccessCheckFailed')}
    </section>
  </main>;
}
