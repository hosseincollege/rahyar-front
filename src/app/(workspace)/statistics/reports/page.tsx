"use client";

import Link from "next/link";
import { BarChart3, Boxes, FileText, Users } from "lucide-react";
import { getLocaleDirection, usePreferences } from "@/components/preferences-provider";
import { uiMessage } from "@/lib/ui-messages";
import type { UiMessage } from "@/languages/types";

const categories: Array<{ href: string; title: UiMessage; icon: typeof BarChart3 }> = [
  { href: "/statistics/reports/financial", title: "sidebarFinancialReports", icon: FileText },
  { href: "/statistics/reports/sales", title: "sidebarSalesReports", icon: BarChart3 },
  { href: "/statistics/reports/hr", title: "sidebarHrReports", icon: Users },
  { href: "/statistics/reports/inventory", title: "sidebarInventoryReports", icon: Boxes },
];

export default function ReportsCatalogPage() {
  const { locale } = usePreferences();

  return (
    <main dir={getLocaleDirection(locale)} className="mx-auto max-w-5xl space-y-5">
      <header className="rounded-2xl border border-border bg-card p-5">
        <h1 className="text-xl font-bold text-foreground">
          {uiMessage(locale, "sidebarReports")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {uiMessage(locale, "reportsDescription")}
        </p>
      </header>
      <section aria-label={uiMessage(locale, "sidebarReports")} className="grid gap-3 sm:grid-cols-2">
        {categories.map(({ href, title, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-20 items-center gap-3 rounded-2xl border border-border bg-card p-4 text-start shadow-sm transition hover:border-primary/40 hover:bg-muted/30"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon size={19} />
            </span>
            <span className="font-semibold text-foreground">
              {uiMessage(locale, title)}
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
