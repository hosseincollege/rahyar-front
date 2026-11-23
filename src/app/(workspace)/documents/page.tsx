'use client';

import Link from 'next/link';
import { FileText, Globe2, Package, Zap } from 'lucide-react';
import { getLocaleDirection, usePreferences } from '@/components/providers/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import type { UiMessage } from '@/lib/languages/types';

const documentLinks: Array<{ href: string; title: UiMessage; icon: typeof Zap }> = [
  { href: '/rahcom/bill-identifiers', title: 'rahcomBillIdentifiers', icon: Zap },
  { href: '/rahcom/inventory', title: 'rahcomInventory', icon: Package },
  { href: '/rahcom/invoices', title: 'accountingInvoices', icon: FileText },
  { href: '/rahcom/sites', title: 'rahcomSites', icon: Globe2 },
];

export default function DocumentsPage() {
  const { locale } = usePreferences();

  return (
    <main dir={getLocaleDirection(locale)} className="mx-auto max-w-5xl p-3 sm:p-5">
      <h1 className="mb-4 text-xl font-bold text-foreground">{uiMessage(locale, 'sidebarDocuments')}</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {documentLinks.map(({ href, title, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-20 items-center gap-3 rounded-xl border border-border bg-card p-4 text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon size={20} aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold">{uiMessage(locale, title)}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
