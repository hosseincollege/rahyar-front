'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePreferences, getLocaleDirection } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { accountingApi } from '@/app/(workspace)/accounting/accounting-api';
import type { AccountingAccess } from '@/app/(workspace)/accounting/types';
import { AccountingAccessProvider } from './accounting-access-context';

export default function AccountingLayout({ children }: { children: ReactNode }) {
  const { locale } = usePreferences();
  const [access, setAccess] = useState<AccountingAccess | null>(null);

  useEffect(() => {
    let active = true;
    accountingApi.getAccess().then((access) => {
      if (active) setAccess(access);
    }).catch(() => {
      if (active) setAccess({ canView: false, canManage: false });
    });
    return () => { active = false; };
  }, []);

  if (access === null) return <div aria-busy="true" className="min-h-48 animate-pulse rounded-2xl bg-muted/30" />;
  if (!access.canView) return <main dir={getLocaleDirection(locale)} role="alert" className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">{uiMessage(locale, 'accountingAccessDenied')}</main>;
  return <AccountingAccessProvider access={access}>{children}</AccountingAccessProvider>;
}
