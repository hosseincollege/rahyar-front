"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  FileText,
  RefreshCw,
  Users,
} from "lucide-react";
import {
  usePreferences,
  getLocaleDirection,
} from "@/components/preferences-provider";
import { apiClient } from "@/lib/api-client";
import { uiMessage } from "@/lib/ui-messages";
import type { UiMessage } from "@/languages/types";

type ReportCategory = "ALL" | "FINANCIAL" | "SALES" | "HR" | "INVENTORY";
type ReportPeriod = "THIS_MONTH" | "LAST_QUARTER" | "YEAR_TO_DATE";

type ReportsOverview = {
  period: ReportPeriod;
  range: { from: string; to: string };
  accounting: null | {
    invoiceCount: number;
    pendingReview: number;
    overdue: number;
  };
  humanResources: null | { activeEmployees: number; hiresInPeriod: number };
  inventory: null | {
    activeProducts: number;
    lowStockProducts: number;
    movementsInPeriod: number;
  };
  sales: null | { leadsInPeriod: number; openOpportunities: number };
};

const reportCards: {
  key: "accounting" | "humanResources" | "inventory" | "sales";
  category: Exclude<ReportCategory, "ALL">;
  title: UiMessage;
  icon: typeof BarChart3;
  metrics: {
    label: UiMessage;
    value: (
      data:
        | NonNullable<ReportsOverview["accounting"]>
        | NonNullable<ReportsOverview["humanResources"]>
        | NonNullable<ReportsOverview["inventory"]>
        | NonNullable<ReportsOverview["sales"]>,
    ) => number;
  }[];
}[] = [
  {
    key: "accounting",
    category: "FINANCIAL",
    title: "sidebarAccounting",
    icon: BarChart3,
    metrics: [
      {
        label: "accountingInvoices",
        value: (data) => ("invoiceCount" in data ? data.invoiceCount : 0),
      },
      {
        label: "accountingAwaitingReview",
        value: (data) => ("pendingReview" in data ? data.pendingReview : 0),
      },
      {
        label: "accountingOverdue",
        value: (data) => ("overdue" in data ? data.overdue : 0),
      },
    ],
  },
  {
    key: "humanResources",
    category: "HR",
    title: "sidebarHumanResources",
    icon: Users,
    metrics: [
      {
        label: "reportsActiveEmployees",
        value: (data) => ("activeEmployees" in data ? data.activeEmployees : 0),
      },
      {
        label: "reportsHiresInPeriod",
        value: (data) => ("hiresInPeriod" in data ? data.hiresInPeriod : 0),
      },
    ],
  },
  {
    key: "inventory",
    category: "INVENTORY",
    title: "sidebarInventory",
    icon: Boxes,
    metrics: [
      {
        label: "reportsActiveProducts",
        value: (data) => ("activeProducts" in data ? data.activeProducts : 0),
      },
      {
        label: "reportsLowStockProducts",
        value: (data) =>
          "lowStockProducts" in data ? data.lowStockProducts : 0,
      },
      {
        label: "reportsMovementsInPeriod",
        value: (data) =>
          "movementsInPeriod" in data ? data.movementsInPeriod : 0,
      },
    ],
  },
  {
    key: "sales",
    category: "SALES",
    title: "sidebarSales",
    icon: BarChart3,
    metrics: [
      {
        label: "reportsLeadsInPeriod",
        value: (data) => ("leadsInPeriod" in data ? data.leadsInPeriod : 0),
      },
      {
        label: "reportsOpenOpportunities",
        value: (data) =>
          "openOpportunities" in data ? data.openOpportunities : 0,
      },
    ],
  },
];

export default function ReportsPage({
  initialCategory = "ALL",
  titleKey = "sidebarBusinessIntelligence",
}: {
  initialCategory?: ReportCategory;
  titleKey?: UiMessage;
}) {
  const { locale } = usePreferences();
  const [period, setPeriod] = useState<ReportPeriod>("THIS_MONTH");
  const [data, setData] = useState<ReportsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const t = (key: UiMessage) => uiMessage(locale, key);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const response = await apiClient.get<ReportsOverview>(
        `/statistics/overview?period=${period}`,
      );
      setData(response);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatter = new Intl.NumberFormat(locale);
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
  });
  const visibleCards = reportCards.filter(
    (card) => initialCategory === "ALL" || card.category === initialCategory,
  );
  const hasVisibleData = visibleCards.some(
    (card) => data?.[card.key] !== null && data?.[card.key] !== undefined,
  );

  return (
    <div dir={getLocaleDirection(locale)} className="space-y-5">
      <header className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              {t(titleKey)}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("reportsDescription")}
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t("reportsPeriodLabel")}</span>
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as ReportPeriod)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="THIS_MONTH">{t("reportsPeriodThisMonth")}</option>
            <option value="LAST_QUARTER">
              {t("reportsPeriodLastQuarter")}
            </option>
            <option value="YEAR_TO_DATE">{t("reportsPeriodYearToDate")}</option>
          </select>
        </label>
      </header>

      {data && !loading && !failed && (
        <p className="text-xs text-muted-foreground">
          {dateFormatter.format(new Date(data.range.from))} –{" "}
          {dateFormatter.format(
            new Date(new Date(data.range.to).getTime() - 86_400_000),
          )}
        </p>
      )}

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {t("reportsLoading")}
        </div>
      ) : failed ? (
        <div
          role="alert"
          className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8 text-center"
        >
          <AlertTriangle className="mx-auto text-amber-500" size={22} />
          <p className="mt-2 text-sm font-semibold text-foreground">
            {t("reportsLoadFailed")}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
          >
            <RefreshCw size={14} />
            {t("projectsRetry")}
          </button>
        </div>
      ) : !hasVisibleData ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <FileText className="mx-auto text-muted-foreground" size={24} />
          <p className="mt-2 text-sm font-semibold text-foreground">
            {t("reportsNoData")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("reportsNoAccessHint")}
          </p>
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {visibleCards.map((card) => {
            const values = data?.[card.key];
            if (!values) return null;
            const Icon = card.icon;
            return (
              <article
                key={card.key}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Icon size={17} className="text-primary" />
                  {t(card.title)}
                </h2>
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  {card.metrics.map((metric) => {
                    const value = metric.value(values);
                    return (
                      <div
                        key={metric.label}
                        className="rounded-xl bg-muted/40 p-3"
                      >
                        <dt className="text-xs text-muted-foreground">
                          {t(metric.label)}
                        </dt>
                        <dd className="mt-1 text-lg font-bold tabular-nums text-foreground">
                          {formatter.format(value)}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
