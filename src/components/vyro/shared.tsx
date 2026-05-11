import type { ComponentType, ReactNode } from "react";
import type { HeroMetric, ViewId } from "@/lib/vyro-data";

/* ---------- Pill (light) ---------- */
type PillColor = "white" | "amber" | "red" | "spatial" | "positive" | "session" | "coach";
const PILL_CLS: Record<PillColor, string> = {
  white: "border-black/8 bg-vyro-surface text-neutral-700",
  amber: "border-vyro-coach/30 bg-vyro-coach/10 text-vyro-coach",
  red: "border-vyro-alert/30 bg-vyro-alert/10 text-vyro-alert",
  spatial: "border-vyro-spatial/30 bg-vyro-spatial/10 text-vyro-spatial",
  positive: "border-vyro-positive/30 bg-vyro-positive/10 text-vyro-positive",
  session: "border-vyro-session/30 bg-vyro-session/10 text-vyro-session",
  coach: "border-vyro-coach/30 bg-vyro-coach/10 text-vyro-coach",
};

export function Pill({ children, color = "white" }: { children: ReactNode; color?: PillColor }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] ${PILL_CLS[color]}`}>
      {children}
    </span>
  );
}

/* ---------- Card (light bento, slim) ---------- */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-black/5 bg-vyro-surface p-4 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

/* ---------- Bar ---------- */
export function Bar({ value, color = "spatial" }: { value: number; color?: "spatial" | "amber" | "red" | "positive" }) {
  const fill =
    color === "amber" ? "bg-vyro-coach" :
    color === "red" ? "bg-vyro-alert" :
    color === "positive" ? "bg-vyro-positive" :
    "bg-vyro-spatial";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-black/6">
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/* ---------- Score ring (light) ----------
   Each metric gets its semantic ring color; track is neutral. */
export function ScoreRing({
  metric,
  onClick,
}: {
  metric: HeroMetric | { label: string; value: number; color: "amber" | "teal"; target?: ViewId; tab?: string };
  onClick?: () => void;
}) {
  // Map label → semantic color
  const lbl = metric.label.toLowerCase();
  let ringColor = "var(--vyro-spatial)";
  if (lbl.includes("fatigue")) ringColor = "var(--vyro-alert)";
  else if (lbl.includes("recovery")) ringColor = "var(--vyro-positive)";
  else if (lbl.includes("agility")) ringColor = "var(--vyro-spatial)";
  else if (lbl.includes("sleep")) ringColor = "var(--vyro-session)";

  return (
    <button
      onClick={onClick}
      className="rounded-3xl border border-black/5 bg-vyro-surface p-3 text-center transition-transform active:scale-[0.98]"
    >
      <div
        className="relative mx-auto grid h-[78px] w-[78px] place-items-center rounded-full"
        style={{
          background: `conic-gradient(${ringColor} ${metric.value * 3.6}deg, rgba(0,0,0,0.07) 0deg)`,
        }}
      >
        <div className="grid h-[64px] w-[64px] place-items-center rounded-full bg-white">
          <span className="text-2xl font-black tabular-nums text-neutral-900">{metric.value}</span>
        </div>
      </div>
      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">{metric.label}</div>
    </button>
  );
}

/* ---------- Spark ---------- */
export function Spark({ points, color = "currentColor" }: { points: number[]; color?: string }) {
  const pts = points
    .map((p, i) => `${i * (180 / (points.length - 1))},${54 - (p / 100) * 46 - 4}`)
    .join(" ");
  return (
    <svg viewBox="0 0 180 54" className="h-16 w-full overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

/* ---------- PageHeader ---------- */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-500">{eyebrow}</div>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-neutral-900">{title}</h2>
        {subtitle && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-neutral-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------- ActionPill (colored quick-action buttons) ---------- */
export function ActionPill({
  label,
  color,
  icon: Icon,
  onClick,
}: {
  label: string;
  color: "spatial" | "session" | "coach" | "alert" | "positive";
  icon: ComponentType<{ className?: string }>;
  onClick?: () => void;
}) {
  const tone = {
    spatial: "text-vyro-spatial bg-vyro-spatial/10 border-vyro-spatial/20",
    session: "text-vyro-session bg-vyro-session/10 border-vyro-session/20",
    coach: "text-vyro-coach bg-vyro-coach/10 border-vyro-coach/20",
    alert: "text-vyro-alert bg-vyro-alert/10 border-vyro-alert/20",
    positive: "text-vyro-positive bg-vyro-positive/10 border-vyro-positive/20",
  }[color];

  return (
    <button
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-transform active:scale-95 ${tone}`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

/* ---------- CompactMetric (slim bento number) ---------- */
export function CompactMetric({
  label,
  value,
  unit,
  color = "spatial",
}: {
  label: string;
  value: string | number;
  unit?: string;
  color?: "spatial" | "positive" | "alert" | "session" | "coach" | "neutral";
}) {
  const accent = {
    spatial: "text-vyro-spatial",
    positive: "text-vyro-positive",
    alert: "text-vyro-alert",
    session: "text-vyro-session",
    coach: "text-vyro-coach",
    neutral: "text-neutral-900",
  }[color];

  return (
    <section className="rounded-3xl border border-black/5 bg-vyro-surface px-4 py-3 shadow-sm">
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-black tabular-nums tracking-tight ${accent}`}>{value}</span>
        {unit && <span className="text-[11px] font-medium text-neutral-500">{unit}</span>}
      </div>
      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">{label}</div>
    </section>
  );
}
