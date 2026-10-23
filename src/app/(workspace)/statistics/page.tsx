"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BarChart3, Boxes, FileText, RefreshCw, Users } from "lucide-react";
import { getLocaleDirection, usePreferences } from "@/components/preferences-provider";
import { apiClient } from "@/lib/api-client";
import { uiMessage } from "@/lib/ui-messages";
import type { UiMessage } from "@/languages/types";

type AnalysisOverview = {
  accounting: null | { invoiceCount: number };
  humanResources: null | { activeEmployees: number };
  inventory: null | { lowStockProducts: number };
  sales: null | { leadsInPeriod: number };
};

const summaryCards: Array<{
  key: keyof AnalysisOverview;
  valueKey: string;
  label: UiMessage;
  icon: typeof BarChart3;
}> = [
  { key: "accounting", valueKey: "invoiceCount", label: "accountingInvoices", icon: FileText },
  { key: "humanResources", valueKey: "activeEmployees", label: "reportsActiveEmployees", icon: Users },
  { key: "inventory", valueKey: "lowStockProducts", label: "reportsLowStockProducts", icon: Boxes },
  { key: "sales", valueKey: "leadsInPeriod", label: "reportsLeadsInPeriod", icon: BarChart3 },
];

export default function AnalysisPage() {
  const { locale } = usePreferences();
  const [data, setData] = useState<AnalysisOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setData(await apiClient.get<AnalysisOverview>("/statistics/overview?period=THIS_MONTH"));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleCards = summaryCards.filter((card) => data?.[card.key] !== null && data?.[card.key] !== undefined);
  const formatter = new Intl.NumberFormat(locale);

  return (
    <main dir={getLocaleDirection(locale)} className="mx-auto max-w-5xl space-y-5">
      <header className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><BarChart3 size={21} /></span>
        <div><h1 className="text-xl font-bold text-foreground">{uiMessage(locale, "sidebarStatistics")}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{uiMessage(locale, "analysisDescription")}</p></div>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{uiMessage(locale, "reportsLoading")}</div>
      ) : failed ? (
        <section role="alert" className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8 text-center">
          <AlertTriangle className="mx-auto text-amber-500" size={22} />
          <p className="mt-2 text-sm font-semibold text-foreground">{uiMessage(locale, "reportsLoadFailed")}</p>
          <button type="button" onClick={() => void load()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><RefreshCw size={14} />{uiMessage(locale, "projectsRetry")}</button>
        </section>
      ) : visibleCards.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm font-semibold text-foreground">{uiMessage(locale, "reportsNoData")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{uiMessage(locale, "reportsNoAccessHint")}</p>
        </section>
      ) : (
        <section aria-label={uiMessage(locale, "sidebarStatistics")} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {visibleCards.map(({ key, valueKey, label, icon: Icon }) => {
            const value = data?.[key]?.[valueKey as keyof NonNullable<AnalysisOverview[typeof key]>];
            return <article key={key} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon size={18} /></span><div className="min-w-0"><p className="text-xs text-muted-foreground">{uiMessage(locale, label)}</p><p className="mt-1 text-xl font-bold tabular-nums text-foreground">{formatter.format(Number(value ?? 0))}</p></div></article>;
          })}
        </section>
      )}
    </main>
  );
}
