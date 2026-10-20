import type { LucideIcon } from "lucide-react";
import { ArrowDownLeft, ArrowUpLeft, Minus } from "lucide-react";

type StatTone = "primary" | "success" | "warning" | "danger";

type StatCardProps = {
  label: string;
  value: string;
  hint: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  tone?: StatTone;
  icon: LucideIcon;
};

const toneStyles: Record<
  StatTone,
  {
    icon: string;
    iconBackground: string;
  }
> = {
  primary: {
    icon: "text-[var(--primary)]",
    iconBackground: "bg-[var(--primary-soft)]",
  },
  success: {
    icon: "text-[var(--success)]",
    iconBackground: "bg-[var(--success-soft)]",
  },
  warning: {
    icon: "text-[var(--warning)]",
    iconBackground: "bg-[var(--warning-soft)]",
  },
  danger: {
    icon: "text-[var(--danger)]",
    iconBackground: "bg-[var(--danger-soft)]",
  },
};

export function StatCard({
  label,
  value,
  hint,
  change,
  trend = "neutral",
  tone = "primary",
  icon: Icon,
}: StatCardProps) {
  const style = toneStyles[tone];

  const TrendIcon =
    trend === "up"
      ? ArrowUpLeft
      : trend === "down"
        ? ArrowDownLeft
        : Minus;

  const trendColor =
    trend === "up"
      ? "text-[var(--success)]"
      : trend === "down"
        ? "text-[var(--danger)]"
        : "text-[var(--muted)]";

  return (
    <article className="interactive-card surface-card relative overflow-hidden p-5">
      <div
        aria-hidden="true"
        className="absolute -left-10 -top-10 size-28 rounded-full bg-[var(--primary)] opacity-[0.035] blur-2xl"
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--muted)]">{label}</p>

          <div className="mt-3 flex items-end gap-3">
            <strong className="text-3xl font-bold leading-none tracking-tight text-[var(--foreground)]">
              {value}
            </strong>

            {change ? (
              <span
                className={`mb-0.5 inline-flex items-center gap-1 text-xs font-semibold ${trendColor}`}
              >
                <TrendIcon aria-hidden="true" size={14} />
                {change}
              </span>
            ) : null}
          </div>
        </div>

        <div
          className={`grid size-11 shrink-0 place-items-center rounded-2xl ${style.iconBackground} ${style.icon}`}
        >
          <Icon aria-hidden="true" size={21} strokeWidth={2} />
        </div>
      </div>

      <p className="relative mt-4 truncate text-xs text-[var(--muted)]">
        {hint}
      </p>
    </article>
  );
}
