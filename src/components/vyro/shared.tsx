import type { ReactNode } from "react";

export function Pill({
  children,
  tone = "neutral",
  pulse = false,
}: {
  children: ReactNode;
  tone?: "neutral" | "live" | "warn" | "off";
  pulse?: boolean;
}) {
  const cls =
    tone === "live"
      ? "border-vyro-mint/40 bg-vyro-mint/10 text-vyro-mint"
      : tone === "warn"
        ? "border-vyro-amber/40 bg-vyro-amber/10 text-vyro-amber"
        : tone === "off"
          ? "border-vyro-rose/40 bg-vyro-rose/10 text-vyro-rose"
          : "border-vyro-line bg-vyro-text/5 text-vyro-mute";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] ${cls}`}>
      {pulse && (
        <span className="relative grid h-2 w-2 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60" />
          <span className="relative h-2 w-2 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}

export function Card({
  children,
  className = "",
  title,
  eyebrow,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-vyro-line bg-vyro-panel p-4 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] ${className}`}>
      {(title || eyebrow || action) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && (
              <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-mute">{eyebrow}</div>
            )}
            {title && <h3 className="mt-0.5 text-sm font-bold text-vyro-text">{title}</h3>}
          </div>
          {action}
        </header>
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
    <div className="rounded-xl border border-vyro-line bg-vyro-elev p-3">
      <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-vyro-mute">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-xl font-black tabular-nums text-vyro-text">{value}</span>
        {unit && <span className="text-[10px] font-semibold text-vyro-mute">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-[10px] text-vyro-mute">{hint}</div>}
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
    <div className="rounded-2xl border border-dashed border-vyro-line bg-vyro-elev p-6 text-center">
      <div className="text-sm font-bold text-vyro-text">{title}</div>
      {hint && <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-vyro-mute">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
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
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-vyro-mute">{eyebrow}</div>
        )}
        <h2 className="mt-1 text-3xl font-black tracking-tight text-vyro-text">{title}</h2>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-vyro-mute">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// Circular progress ring used for the readiness hero. Pure SVG so it
// renders crisp at any size and doesn't pull in a charting library.
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
      <svg width={size} height={size} className="-rotate-90 block">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--vyro-line)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--vyro-mint)"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 6px var(--vyro-mint))" }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
        <div className="text-2xl font-black tabular-nums text-vyro-text">{value ?? "—"}</div>
        {label && <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.18em] text-vyro-mute">{label}</div>}
        {sub && <div className="mt-0.5 font-mono text-[8px] text-vyro-mute">{sub}</div>}
      </div>
    </div>
  );
}

