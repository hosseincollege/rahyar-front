'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { AccountingAccess } from '@/app/(workspace)/accounting/types';

const AccountingAccessContext = createContext<AccountingAccess | null>(null);

export function AccountingAccessProvider({ access, children }: { access: AccountingAccess; children: ReactNode }) {
  return <AccountingAccessContext.Provider value={access}>{children}</AccountingAccessContext.Provider>;
}

export function useAccountingAccess() {
  return useContext(AccountingAccessContext) ?? { canView: false, canManage: false };
}
