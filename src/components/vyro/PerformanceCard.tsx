import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TOKENS, type VyroMetricType } from "@/lib/vyro-tokens";

interface PerformanceCardProps {
  metricType: VyroMetricType;
  value: number | string;
  label: string;
  unit?: string;
  children?: ReactNode;
  className?: string;
}

const ACCENT: Record<VyroMetricType, string> = {
  RECOVERY: "text-vyro-recovery",
  SPATIAL: "text-vyro-spatial",
  WARNING: "text-vyro-fatigue",
  FATIGUE: "text-vyro-fatigue",
};

/**
 * High-clarity light-mode bento card. Surface = #F5F5F7,
 * value typography pulls the metric's accent color.
 */
export function PerformanceCard({
  metricType,
  value,
  label,
  unit,
  children,
  className,
}: PerformanceCardProps) {
  return (
    <section
      className={cn(
        "bg-vyro-surface text-neutral-900",
        TOKENS.RADIUS,
        TOKENS.SHADOW,
        "p-5 flex flex-col gap-2",
        className,
      )}
    >
      <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className={cn("text-4xl font-semibold tabular-nums tracking-tight", ACCENT[metricType])}>
          {value}
        </span>
        {unit && <span className="text-sm font-medium text-neutral-500">{unit}</span>}
      </div>
      {children}
    </section>
  );
}
