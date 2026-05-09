import type { ReactNode } from "react";
import type { HeroMetric, ViewId } from "@/lib/vyro-data";

export function Pill({ children, color = "white" }: { children: ReactNode; color?: "white" | "amber" | "red" }) {
  const cls =
    color === "amber"
      ? "border-[#ffb020]/40 bg-[#ffb020]/10 text-[#ffb020]"
      : color === "red"
        ? "border-[#ff2b2b]/40 bg-[#ff2b2b]/10 text-[#ff2b2b]"
        : "border-white/15 bg-white/10 text-white";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] ${cls}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[24px] border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/30 ${className}`}>
      {children}
    </section>
  );
}

export function Bar({ value, color = "white" }: { value: number; color?: "white" | "amber" | "red" }) {
  const fill = color === "amber" ? "bg-[#ffb020]" : color === "red" ? "bg-[#ff2b2b]" : "bg-white";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function ScoreRing({
  metric,
  onClick,
}: {
  metric: HeroMetric | { label: string; value: number; color: "amber" | "teal"; target?: ViewId; tab?: string };
  onClick?: () => void;
}) {
  const ringColor = metric.color === "amber" ? "#ffb020" : "#ffffff";
  return (
    <button
      onClick={onClick}
      className="rounded-[24px] border border-white/10 bg-white/[0.055] p-3 text-center active:scale-[0.98] transition-transform"
    >
      <div
        className="relative mx-auto grid h-[78px] w-[78px] place-items-center rounded-full"
        style={{
          background: `conic-gradient(${ringColor} ${metric.value * 3.6}deg, rgba(255,255,255,0.09) 0deg)`,
        }}
      >
        <div className="grid h-[62px] w-[62px] place-items-center rounded-full bg-[#0b0b0c]">
          <span className="text-2xl font-black tabular-nums">{metric.value}</span>
        </div>
      </div>
      <div className="mt-2 text-[10px] font-mono uppercase tracking-[0.18em] text-white/55">{metric.label}</div>
    </button>
  );
}

export function Spark({ points, color = "white" }: { points: number[]; color?: string }) {
  const pts = points
    .map((p, i) => `${i * (180 / (points.length - 1))},${54 - (p / 100) * 46 - 4}`)
    .join(" ");
  return (
    <svg viewBox="0 0 180 54" className="h-16 w-full overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

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
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/45">{eyebrow}</div>
        <h2 className="mt-1 text-2xl font-black tracking-tight">{title}</h2>
        {subtitle && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/55">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
