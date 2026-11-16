import type { ReactNode } from 'react';

export function SettingsPageToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="rahcom-page-toolbar rahcom-mobile-toolbar max-sm:-mb-2 flex shrink-0 flex-wrap items-center gap-2 overflow-visible sm:flex-nowrap sm:overflow-x-auto max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:overflow-y-hidden max-sm:pb-2">
      {children}
    </div>
  );
}
