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
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
        : tone === "off"
          ? "border-rose-500/40 bg-rose-500/10 text-rose-700"
          : "border-vyro-text/10 bg-vyro-text/[0.04] text-vyro-text/70";
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
    <section className={`rounded-2xl border border-vyro-text/[0.07] bg-vyro-panel p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)] ${className}`}>
      {(title || eyebrow || action) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {eyebrow && (
              <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-text/45">{eyebrow}</div>
            )}
            {title && <h3 className="text-sm font-bold text-vyro-text">{title}</h3>}
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
    <div className="rounded-xl border border-vyro-text/[0.06] bg-vyro-text/[0.02] p-3">
      <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-vyro-text/45">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-xl font-black tabular-nums text-vyro-text">{value}</span>
        {unit && <span className="text-[10px] font-semibold text-vyro-text/50">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-[10px] text-vyro-text/45">{hint}</div>}
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
    <div className="rounded-2xl border border-dashed border-vyro-text/15 bg-vyro-text/[0.02] p-6 text-center">
      <div className="text-sm font-bold text-vyro-text">{title}</div>
      {hint && <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-vyro-text/55">{hint}</p>}
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
      <div>
        {eyebrow && (
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-vyro-text/45">{eyebrow}</div>
        )}
        <h2 className="mt-1 text-2xl font-black tracking-tight text-vyro-text">{title}</h2>
        {subtitle && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-vyro-text/55">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
