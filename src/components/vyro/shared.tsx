import type { ReactNode } from "react";

/* ==========================================================================
   VYRO shared primitives.
   Every screen (Trends, Session, Coach, Social, Recovery, Sleep, Sport, Debug)
   composes these, so the visual language is defined once here.
   ========================================================================== */

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
      ? "border-vyro-mint/30 bg-vyro-mint/10 text-vyro-mint"
      : tone === "warn"
        ? "border-vyro-amber/30 bg-vyro-amber/10 text-vyro-amber"
        : tone === "off"
          ? "border-vyro-rose/30 bg-vyro-rose/10 text-vyro-rose"
          : "border-vyro-line bg-vyro-text/5 text-vyro-mute";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] transition-colors duration-200 ${cls}`}
    >
      {pulse && (
        <span className="relative grid h-2 w-2 shrink-0 place-items-center">
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
    <section
      className={`group/card relative rounded-[20px] border border-vyro-line bg-vyro-panel bg-[linear-gradient(160deg,rgba(255,255,255,0.045),transparent_40%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_44px_-24px_rgba(0,0,0,0.9)] transition-[border-color,box-shadow] duration-200 ease-out hover:border-vyro-text/[0.12] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_28px_64px_-28px_rgba(0,0,0,0.95)] ${className}`}
    >
      {(title || eyebrow || action) && (
        <header className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            {eyebrow && (
              <div className="font-mono text-[8.5px] font-medium uppercase tracking-[0.26em] text-vyro-mute">
                {eyebrow}
              </div>
            )}
            {title && (
              <h3 className="mt-1.5 text-[15px] font-extrabold leading-tight tracking-[-0.02em] text-vyro-text">
                {title}
              </h3>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
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
    <div className="min-w-0 rounded-[14px] border border-vyro-line bg-vyro-text/[0.03] p-3 transition-[background-color,border-color,transform] duration-200 ease-out hover:-translate-y-px hover:border-vyro-text/[0.13] hover:bg-vyro-text/[0.055]">
      <div className="truncate font-mono text-[8.5px] font-medium uppercase tracking-[0.13em] text-vyro-mute">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-[22px] font-black leading-none tracking-[-0.045em] tabular-nums text-vyro-text">
          {value}
        </span>
        {unit && <span className="font-mono text-[9.5px] font-semibold text-vyro-mute">{unit}</span>}
      </div>
      {hint && <div className="mt-1.5 font-mono text-[9.5px] text-vyro-mute">{hint}</div>}
    </div>
  );
}

/** Metric tile with an optional live badge, delta line and progress bar. */
export function MetricTile({
  label,
  value,
  unit,
  delta,
  live = false,
  progress,
  tone = "mint",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: ReactNode;
  live?: boolean;
  progress?: number | null;
  tone?: "mint" | "amber" | "rose" | "spatial";
}) {
  const bar =
    tone === "amber"
      ? "bg-vyro-amber"
      : tone === "rose"
        ? "bg-vyro-rose"
        : tone === "spatial"
          ? "bg-vyro-spatial"
          : "bg-vyro-mint";
  return (
    <div className="min-w-0 rounded-[14px] border border-vyro-line bg-vyro-text/[0.03] p-3.5 transition-[background-color,border-color,transform] duration-200 ease-out hover:-translate-y-px hover:border-vyro-text/[0.13] hover:bg-vyro-text/[0.055]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <span className="truncate font-mono text-[8.5px] font-medium uppercase tracking-[0.13em] text-vyro-mute">
          {label}
        </span>
        {live && (
          <span className="shrink-0 font-mono text-[8.5px] font-semibold uppercase tracking-[0.13em] text-vyro-spatial">
            live
          </span>
        )}
      </div>
      <div className="mt-2.5 flex items-baseline gap-1">
        <span className="text-[24px] font-black leading-none tracking-[-0.045em] tabular-nums text-vyro-text">
          {value}
        </span>
        {unit && <span className="font-mono text-[9.5px] font-semibold text-vyro-mute">{unit}</span>}
      </div>
      {delta && <div className="mt-2 font-mono text-[9.5px] text-vyro-mint">{delta}</div>}
      {progress != null && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-vyro-text/10">
          <span
            className={`block h-full rounded-full transition-[width] duration-700 ease-out ${bar}`}
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <div className="font-mono text-[8.5px] font-medium uppercase tracking-[0.26em] text-vyro-mute">
            {eyebrow}
          </div>
        )}
        <h3 className="mt-1 truncate text-base font-extrabold tracking-[-0.028em] text-vyro-text">{title}</h3>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Pill-rail segmented control used by the sub-tabs on every screen. */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  className = "",
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      className={`no-scrollbar flex gap-1 overflow-x-auto rounded-full border border-vyro-line bg-vyro-text/[0.035] p-1 ${className}`}
      role="tablist"
    >
      {tabs.map(({ id, label }) => {
        const active = id === value;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[11px] transition-all duration-200 ease-out active:scale-[0.97] ${
              active
                ? "bg-vyro-text/[0.13] font-extrabold text-vyro-text shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                : "font-semibold text-vyro-mute hover:bg-vyro-text/[0.05] hover:text-vyro-text"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function SkeletonTile({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-[86px] animate-pulse rounded-[14px] border border-vyro-line bg-vyro-text/[0.04] ${className}`}
    />
  );
}

/** Lightweight inline sparkline — no charting dependency. */
export function Sparkline({
  points,
  height = 34,
  tone = "mint",
}: {
  points: number[];
  height?: number;
  tone?: "mint" | "amber" | "rose" | "spatial";
}) {
  if (points.length < 2) {
    return <div className="h-[34px] rounded-lg border border-dashed border-vyro-line" style={{ height }} />;
  }
  const stroke =
    tone === "amber"
      ? "var(--vyro-amber)"
      : tone === "rose"
        ? "var(--vyro-rose)"
        : tone === "spatial"
          ? "var(--vyro-spatial)"
          : "var(--vyro-mint)";
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 100 - ((p - min) / span) * 100;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height }} className="w-full">
      <path d={d} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
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
    <div className="rounded-[18px] border border-dashed border-vyro-line bg-vyro-text/[0.02] p-6 text-center">
      <div className="text-sm font-extrabold tracking-[-0.02em] text-vyro-text">{title}</div>
      {hint && <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-vyro-mute">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
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
          <div className="font-mono text-[9px] font-medium uppercase tracking-[0.26em] text-vyro-mute">
            {eyebrow}
          </div>
        )}
        <h2 className="mt-1.5 text-[26px] font-black leading-[1.06] tracking-[-0.04em] text-vyro-text">
          {title}
        </h2>
        {subtitle && <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-vyro-mute">{subtitle}</p>}
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
  tone = "mint",
}: {
  value: number | null;
  max?: number;
  size?: number;
  stroke?: number;
  label?: string;
  sub?: string;
  tone?: "mint" | "amber" | "rose";
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value == null ? 0 : Math.max(0, Math.min(1, value / max));
  const color =
    tone === "amber" ? "var(--vyro-amber)" : tone === "rose" ? "var(--vyro-rose)" : "var(--vyro-mint)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90 block"
        style={{ overflow: "visible" }}
      >
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--vyro-line)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.32,0.72,0,1)" }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
        <div className="text-[26px] font-black tracking-[-0.045em] tabular-nums text-vyro-text">
          {value ?? "—"}
        </div>
        {label && (
          <div className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.22em] text-vyro-mute">{label}</div>
        )}
        {sub && <div className="mt-1 font-mono text-[8px] text-vyro-mute">{sub}</div>}
      </div>
    </div>
  );
}
