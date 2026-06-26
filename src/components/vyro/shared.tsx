import { useEffect, useRef, useState, type ReactNode } from "react";

export function Pill({
  children,
  color,
  tone,
  pulse,
}: {
  children: ReactNode;
  color?: "white" | "amber" | "red";
  tone?: "live" | "off" | "warn" | "neutral";
  pulse?: boolean;
}) {
  const resolved = tone === "live" ? "white" : tone === "warn" ? "amber" : tone === "off" || tone === "neutral" ? "white" : (color ?? "white");
  const cls =
    resolved === "amber"
      ? "border-vyro-amber/40 bg-vyro-amber/10 text-vyro-amber"
      : resolved === "red"
        ? "border-vyro-red/40 bg-vyro-red/10 text-vyro-red"
        : "border-gray-200 bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] ${cls}`}>
      {pulse && <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
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

export function Card({
  children,
  className = "",
  eyebrow,
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  eyebrow?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm ${className}`}>
      {(eyebrow || title || action) && (
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            {eyebrow && <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-gray-400">{eyebrow}</div>}
            {title && <div className="mt-0.5 text-sm font-bold text-gray-900">{title}</div>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
      <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-gray-400">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-xl font-black tabular-nums text-gray-900">{value}</span>
        {unit && <span className="text-[10px] font-semibold text-gray-400">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-[10px] text-gray-400">{hint}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
      <div className="text-sm font-bold text-gray-900">{title}</div>
      {hint && <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-gray-500">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Ring({
  value,
  max = 100,
  size = 132,
  stroke = 10,
  label,
  sub,
}: {
  value: number | null;
  max?: number;
  size?: number;
  stroke?: number;
  label?: string;
  sub?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value == null ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 block" style={{ overflow: "visible" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(0,0,0,0.06)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--vyro-teal, #10b981)"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
        <div className="text-2xl font-black tabular-nums text-gray-900">{value ?? "—"}</div>
        {label && <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.18em] text-gray-500">{label}</div>}
        {sub && <div className="mt-0.5 font-mono text-[8px] text-gray-500">{sub}</div>}
      </div>
    </div>
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
  metric: { label: string; value: number | null; color: "amber" | "teal"; target?: string; tab?: string };
  onClick?: () => void;
}) {
  const ringColor = metric.color === "amber" ? "var(--vyro-amber)" : "var(--vyro-teal)";
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = requestAnimationFrame(() => setProgress(metric.value ?? 0));
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
          <span className="text-2xl font-semibold tabular-nums leading-none text-gray-900">{metric.value ?? "\u2014"}</span>
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
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-gray-500">{eyebrow}</div>}
        <h2 className="mt-1 text-3xl font-bold tracking-tight leading-tight text-gray-900">{title}</h2>
        {subtitle && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
