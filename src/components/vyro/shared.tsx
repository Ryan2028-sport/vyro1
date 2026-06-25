import { useEffect, useRef, useState, type ReactNode } from "react";
import type { HeroMetric, ViewId } from "@/lib/vyro-data";

export function Pill({ children, color = "white" }: { children: ReactNode; color?: "white" | "amber" | "red" }) {
  const cls =
    color === "amber"
      ? "border-vyro-amber/40 bg-vyro-amber/10 text-vyro-amber"
      : color === "red"
        ? "border-vyro-red/40 bg-vyro-red/10 text-vyro-red"
        : "border-gray-200 bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] ${cls}`}>
      {children}
    </span>
  );
}

export function HeroCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[28px] border border-gray-200/80 bg-white p-6 shadow-md ${className}`}>
      {children}
    </section>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export function Bar({ value, color = "white" }: { value: number; color?: "white" | "amber" | "red" }) {
  const fill = color === "amber" ? "bg-vyro-amber" : color === "red" ? "bg-vyro-red" : "bg-gray-700";
  const ref = useRef<HTMLDivElement>(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
      <div
        className={`h-full rounded-full ${fill} transition-[width] duration-600 ease-out`}
        ref={ref}
        style={{ width: animated ? `${Math.max(0, Math.min(100, value))}%` : "0%" }}
      />
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
  const ringColor = metric.color === "amber" ? "var(--vyro-amber)" : "var(--vyro-teal)";
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = requestAnimationFrame(() => setProgress(metric.value));
    return () => cancelAnimationFrame(timer);
  }, [metric.value]);

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center text-center active:scale-[0.97] transition-all duration-150"
    >
      <div
        className="relative mx-auto grid h-[78px] w-[78px] place-items-center rounded-full transition-all duration-700 ease-out"
        style={{
          background: `conic-gradient(${ringColor} ${progress * 3.6}deg, rgba(0,0,0,0.06) 0deg)`,
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.06))",
        }}
      >
        <div className="grid h-[62px] w-[62px] place-items-center rounded-full bg-gradient-to-b from-white to-gray-50/50">
          <span className="text-2xl font-semibold tabular-nums leading-none text-gray-900">{metric.value}</span>
        </div>
      </div>
      <div className="mt-2 text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500">{metric.label}</div>
    </button>
  );
}

export function Spark({ points, color = "#6b7280" }: { points: number[]; color?: string }) {
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
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-gray-500">{eyebrow}</div>
        <h2 className="mt-1 text-3xl font-bold tracking-tight leading-tight text-gray-900">{title}</h2>
        {subtitle && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
