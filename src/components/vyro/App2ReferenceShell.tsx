import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Bell,
  Brain,
  CalendarDays,
  Gauge,
  Heart,
  LineChart,
  ListChecks,
  MessageCircle,
  Moon,
  Plus,
  Radio,
  ShieldCheck,
  Settings2,
  Sparkles,
  Stethoscope,
  Trophy,
  UserRound,
} from "lucide-react";

import { getMyProfile } from "@/lib/profile.functions";
import { BandPanel } from "./BandPanel";
import { CoachView } from "./CoachView";
import { RecoveryView } from "./RecoveryView";
import { SessionView } from "./SessionView";
import { SleepView } from "./SleepView";
import { DebugView } from "./DebugView";
import { SocialView } from "./SocialView";
import { MovementPanel, SportView } from "./SportView";
import { CourtDbView } from "./CourtDbView";
import { SwingView } from "./SwingView";
import { TendencyView } from "./TendencyView";
import { TrendsView } from "./TrendsView";
import { getKeepAliveStatus, subscribeKeepAlive, pokeKeepAlive } from "@/lib/keep-alive";
import { useLiveMetrics, type LiveMetrics } from "./useLiveMetrics";
import { useVyroScores } from "./VyroScoresProvider";
import {
  addTrainingPlanItem,
  deleteTrainingPlanItem,
  listTrainingPlan,
} from "@/lib/training-plan.functions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SegmentedTabs } from "./shared";
import "./app2-reference.css";


// Baselines, recovery, readiness, strain and RTP all come from
// <VyroScoresProvider /> now — see VyroScoresProvider.tsx. This file no longer
// computes any score of its own, which is what caused the same metric to read
// 31 on one tab and 87 on another.

type App2View =
  | "athlete"
  | "trends"
  | "sport"
  | "recovery"
  | "sleep"
  | "debug"
  | "session"
  | "coach"
  | "social"
  | "band";

type PlanItem = {
  time: string;
  title: string;
  load: string;
  color: "green" | "amber" | "red";
};

const dateLabel = new Date().toLocaleDateString([], {
  weekday: "long",
  month: "long",
  day: "numeric",
});

function Logo() {
  return (
    <div className="app2-logo">
      <img
        src="/vyro-logo.png"
        alt="VYRO"
        className="app2-logo-img"
        width={96}
        height={28}
        loading="eager"
      />
    </div>
  );
}

function toneVar(value: number | null | undefined) {
  if (value == null) return "hsl(0 0% 100% / 0.28)";
  if (value >= 67) return "var(--vyro-mint)";
  if (value >= 34) return "var(--vyro-amber)";
  return "var(--vyro-rose)";
}

/* ---------------------------------------------------------------------------
   Home presentation primitives — Apple-inspired material cards, Activity-style
   rings, colour-coded metric tiles. Pure styling: every data point that
   existed before still renders through these.
--------------------------------------------------------------------------- */

type Accent = "green" | "blue" | "teal" | "orange" | "red" | "indigo" | "pink" | "yellow" | "purple" | "mute";

const ACCENT: Record<Accent, string> = {
  green: "var(--vyro-mint)",
  blue: "var(--vyro-blue)",
  teal: "var(--vyro-teal)",
  orange: "var(--vyro-amber)",
  red: "var(--vyro-rose)",
  indigo: "var(--vyro-indigo)",
  pink: "var(--vyro-pink)",
  yellow: "var(--vyro-yellow)",
  purple: "var(--vyro-purple)",
  mute: "rgba(235,235,245,0.45)",
};

function GlassCard({
  children,
  className = "",
  glow,
}: {
  children: ReactNode;
  className?: string;
  glow?: string;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-[26px] border border-white/[0.09] bg-white/[0.055] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_28px_60px_-34px_rgba(0,0,0,1)] backdrop-blur-2xl ${className}`}
    >
      {glow && (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[130%] -translate-x-1/2 rounded-full blur-[64px]"
          style={{ background: glow, opacity: 0.14 }}
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/30 to-transparent"
      />
      <div className="relative">{children}</div>
    </section>
  );
}

function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
  accent = "green",
  trailing,
}: {
  icon?: typeof Activity;
  eyebrow: string;
  title?: string;
  accent?: Accent;
  trailing?: ReactNode;
}) {
  const color = ACCENT[accent];
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[11px] border"
            style={{ background: `color-mix(in oklab, ${color} 16%, transparent)`, borderColor: `color-mix(in oklab, ${color} 26%, transparent)`, color }}
          >
            <Icon size={15} strokeWidth={2.4} />
          </span>
        )}
        <div className="min-w-0">
          <div
            className="truncate font-[family-name:var(--font-display)] text-[9px] font-bold uppercase tracking-[0.2em]"
            style={{ color }}
          >
            {eyebrow}
          </div>
          {title && (
            <h2 className="mt-0.5 truncate font-[family-name:var(--font-display)] text-[18px] font-bold tracking-[-0.03em] text-vyro-text">
              {title}
            </h2>
          )}
        </div>
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}

function Eyebrow({ children, tone = "mint" }: { children: ReactNode; tone?: "mint" | "amber" | "rose" | "mute" }) {
  const color =
    tone === "amber"
      ? "text-vyro-amber"
      : tone === "rose"
        ? "text-vyro-rose"
        : tone === "mute"
          ? "text-vyro-mute"
          : "text-vyro-mint";
  return (
    <div className={`font-[family-name:var(--font-display)] text-[9px] font-bold uppercase tracking-[0.2em] ${color}`}>
      {children}
    </div>
  );
}

/** Apple Activity-style concentric rings: readiness (outer), recovery, sleep. */
function Ring({
  value,
  recovery,
  sleep,
}: {
  value: number | null;
  recovery?: number | null;
  sleep?: number | null;
}) {
  // This is the Readiness dial. Never paint secondary score arcs while the
  // canonical readiness score is unavailable: doing so made a lone Recovery
  // value look like a completed readiness measurement during calibration.
  const hasReadiness = value != null && Number.isFinite(value);
  const arcs = [
    { r: 50, width: 11, v: value, color: toneVar(value), id: "readiness" },
    { r: 37, width: 10, v: hasReadiness ? recovery ?? null : null, color: "var(--vyro-blue)", id: "recovery" },
    { r: 25, width: 9, v: hasReadiness ? sleep ?? null : null, color: "var(--vyro-indigo)", id: "sleep" },
  ];
  const color = toneVar(value);
  const pending = !hasReadiness;

  return (
    <div className="relative h-[212px] w-[212px] shrink-0">
      {/* ambient bloom */}
      <div
        aria-hidden
        className="absolute inset-8 rounded-full blur-[38px] transition-opacity duration-1000"
        style={{ background: color, opacity: pending ? 0.05 : 0.28 }}
      />
      {/* dial plate */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full border border-white/[0.06]"
        style={{
          background:
            "radial-gradient(circle at 50% 22%, rgba(255,255,255,0.055), rgba(255,255,255,0.012) 58%, transparent 72%)",
        }}
      />
      <svg
        viewBox="0 0 112 112"
        className="relative h-full w-full -rotate-90"
        role="img"
        aria-label={pending ? "Readiness pending" : `Readiness ${value} out of 100`}
      >
        <defs>
          {arcs.map((arc) => (
            <linearGradient key={arc.id} id={`vyro-arc-${arc.id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={arc.color} stopOpacity="0.45" />
              <stop offset="55%" stopColor={arc.color} stopOpacity="1" />
              <stop offset="100%" stopColor={arc.color} stopOpacity="0.9" />
            </linearGradient>
          ))}
        </defs>
        {arcs.map((arc) => {
          const c = 2 * Math.PI * arc.r;
          const clamped = Math.max(0, Math.min(100, arc.v ?? 0));
          return (
            <g key={arc.r}>
              <circle
                cx="56"
                cy="56"
                r={arc.r}
                fill="none"
                stroke="hsl(0 0% 100% / 0.055)"
                strokeWidth={arc.width}
              />
              {arc.v != null && Number.isFinite(arc.v) && (
                <circle
                  cx="56"
                  cy="56"
                  r={arc.r}
                  fill="none"
                  stroke={`url(#vyro-arc-${arc.id})`}
                  strokeLinecap="round"
                  strokeWidth={arc.width}
                  strokeDasharray={c}
                  strokeDashoffset={c - (clamped / 100) * c}
                  style={{
                    filter: `drop-shadow(0 0 7px color-mix(in oklab, ${arc.color} 65%, transparent))`,
                    transition: "stroke-dashoffset 1100ms cubic-bezier(0.32,0.72,0,1)",
                  }}
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <div className="font-[family-name:var(--font-display)] text-[9px] font-bold uppercase leading-none tracking-[0.32em] text-vyro-mute">
          Readiness
        </div>

        {pending ? (
          <div className="mt-3 flex items-center gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/25"
                style={{ animationDelay: `${i * 180}ms`, animationDuration: "1400ms" }}
              />
            ))}
          </div>
        ) : (
          <div className="mt-2 flex items-baseline justify-center gap-[3px]">
            <span
              className="font-[family-name:var(--font-display)] text-[58px] font-black leading-[0.86] tracking-[-0.06em] tabular-nums text-white"
              style={{ textShadow: `0 0 30px color-mix(in oklab, ${color} 45%, transparent)` }}
            >
              {value}
            </span>
            <span className="translate-y-[-6px] font-[family-name:var(--font-display)] text-[13px] font-bold tracking-[-0.02em] text-white/35">
              /100
            </span>
          </div>
        )}

        <div className="mt-2.5 max-w-[132px] text-[10px] font-semibold leading-tight tracking-[-0.01em] text-vyro-mute">
          {pending ? "Calibrating baseline" : value >= 75 ? "Primed to perform" : value >= 50 ? "Train with control" : "Prioritise recovery"}
        </div>
      </div>

    </div>
  );
}

/** Legend row under the hero ring — one dot + label + value per ring. */
function RingLegend({
  items,
}: {
  items: { label: string; value: number | null; color: string }[];
}) {
  return (
    <div className="grid w-full grid-cols-3 gap-2">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-2xl border border-white/[0.07] bg-white/[0.035] px-2.5 py-2.5 text-center"
        >
          <div className="flex items-center justify-center gap-1.5">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: it.color, boxShadow: `0 0 6px ${it.color}` }}
            />
            <span className="truncate text-[8.5px] font-bold uppercase tracking-[0.14em] text-vyro-mute">
              {it.label}
            </span>
          </div>
          <div
            className="mt-1 font-[family-name:var(--font-display)] text-[19px] font-extrabold leading-none tracking-[-0.04em] tabular-nums"
            style={{ color: it.value == null ? "rgba(235,235,245,0.35)" : "#fff" }}
          >
            {it.value ?? "––"}
          </div>
        </div>
      ))}
    </div>
  );
}


/** Whoop-style scannable metric row: mini arc, label, status, value, track. */
function MetricRow({
  label,
  value,
  accent = "mute",
  status,
  invert = false,
  emptyHint,
}: {
  label: string;
  value: number | null | undefined;
  accent?: Accent;
  status?: string;
  invert?: boolean;
  emptyHint?: string;
}) {
  const has = value != null && Number.isFinite(value);
  const pct = has ? Math.max(0, Math.min(100, value as number)) : 0;
  const color = ACCENT[accent];
  const size = 34;
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className="flex items-center gap-3.5 py-3 first:pt-0 last:pb-0">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 block">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(0 0% 100% / 0.08)" strokeWidth={3.5} />
          {has && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c - (pct / 100) * c}
              style={{
                filter: `drop-shadow(0 0 5px color-mix(in oklab, ${color} 55%, transparent))`,
                transition: "stroke-dashoffset 800ms cubic-bezier(0.32,0.72,0,1)",
              }}
            />
          )}
        </svg>
        {!has && (
          <span className="absolute inset-0 grid place-items-center text-[9px] font-bold text-white/25">?</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-bold tracking-[-0.015em] text-white">{label}</div>
        <div
          className="mt-0.5 truncate text-[10px] font-semibold tracking-[-0.01em]"
          style={{ color: has ? `color-mix(in oklab, ${color} 70%, white)` : "rgba(235,235,245,0.3)" }}
        >
          {has ? (status ?? (invert ? "load index" : "score")) : (emptyHint ?? "awaiting signal")}
        </div>
        <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-white/[0.07]">
          <span
            className="block h-full rounded-full transition-[width] duration-700 ease-out"
            style={{
              width: `${has ? Math.max(2, pct) : 0}%`,
              background: `linear-gradient(90deg, color-mix(in oklab, ${color} 45%, transparent), ${color})`,
            }}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-baseline gap-[2px]">
        {has ? (
          <span className="font-[family-name:var(--font-display)] text-[22px] font-extrabold leading-none tracking-[-0.05em] tabular-nums text-white">
            {Math.round(value as number)}
          </span>
        ) : (
          <span className="block h-[18px] w-[34px] animate-pulse rounded-md bg-white/[0.07]" aria-hidden />
        )}
        <span className="text-[9.5px] font-bold text-white/30">/100</span>
      </div>
    </div>
  );
}

/** Apple Health-style dense vitals row: accent bar, label, trend, value + unit. */
function VitalRow({
  label,
  value,
  unit,
  trend,
  live,
  accent = "mute",
}: {
  label: string;
  value: string | number;
  unit?: string;
  trend?: string;
  live?: boolean;
  accent?: Accent;
}) {
  const dim = value == null || value === "—" || value === "––" || value === "";
  const color = ACCENT[accent];
  return (
    <div className="grid grid-cols-[3px_minmax(0,1fr)_auto] items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <span
        aria-hidden
        className="h-7 w-[3px] rounded-full"
        style={{
          background: dim ? "hsl(0 0% 100% / 0.09)" : color,
          boxShadow: dim ? "none" : `0 0 8px color-mix(in oklab, ${color} 60%, transparent)`,
        }}
      />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[11.5px] font-bold uppercase tracking-[0.09em] text-white/80">{label}</span>
          {live && (
            <span
              aria-label="live"
              className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full"
              style={{ background: color, boxShadow: `0 0 6px ${color}` }}
            />
          )}
        </div>
        <div
          className="mt-0.5 truncate text-[10px] font-semibold tracking-[-0.01em]"
          style={{ color: dim ? "rgba(235,235,245,0.28)" : `color-mix(in oklab, ${color} 65%, white)` }}
        >
          {dim ? "awaiting signal" : (trend ?? "live")}
        </div>
      </div>
      <div className="flex shrink-0 items-baseline gap-[3px]">
        {dim ? (
          <span className="block h-[16px] w-[30px] animate-pulse rounded-md bg-white/[0.07]" aria-hidden />
        ) : (
          <span className="font-[family-name:var(--font-display)] text-[21px] font-extrabold leading-none tracking-[-0.05em] tabular-nums text-white">
            {value}
          </span>
        )}
        {unit && <span className="text-[9.5px] font-bold text-white/30">{unit}</span>}
      </div>
    </div>
  );
}

function MiniMetric({


  label,
  value,
  unit,
  trend,
  live,
  accent = "mute",
}: {
  label: string;
  value: string | number;
  unit?: string;
  trend?: string;
  live?: boolean;
  accent?: Accent;
}) {
  const num = typeof value === "number" ? value : Number(value);
  const dim = value == null || value === "—" || value === "––" || !Number.isFinite(num);
  const color = ACCENT[accent];
  const showBar = !dim && unit === "/100";
  return (
    <div
      className="group relative overflow-hidden rounded-[18px] border border-white/[0.08] bg-white/[0.045] p-3.5 transition-all duration-200 ease-out hover:border-white/[0.16] hover:bg-white/[0.075] active:scale-[0.985]"
      style={!dim ? { boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 12%, transparent)` } : undefined}
    >
      {!dim && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full blur-2xl"
          style={{ background: color, opacity: 0.2 }}
        />
      )}
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <span className="min-w-0 truncate text-[9.5px] font-bold uppercase tracking-[0.12em] text-vyro-mute">
          {label}
        </span>
        {live ? (
          <span
            className="flex shrink-0 items-center gap-1 text-[8px] font-bold uppercase tracking-[0.1em]"
            style={{ color }}
          >
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full"
              style={{ background: color, boxShadow: `0 0 7px ${color}` }}
            />
            live
          </span>
        ) : dim ? (
          <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-[3px] text-[7.5px] font-bold uppercase tracking-[0.12em] text-white/35">
            no data
          </span>
        ) : null}
      </div>

      {dim ? (
        <div className="relative mt-3 flex items-center gap-2">
          <span className="block h-[26px] w-[52px] animate-pulse rounded-lg bg-white/[0.07]" aria-hidden />
          <span className="text-[10px] font-semibold tracking-[-0.01em] text-white/25">awaiting signal</span>
        </div>
      ) : (
        <div className="relative mt-2 flex items-baseline gap-[3px]">
          <span
            className="font-[family-name:var(--font-display)] text-[28px] font-extrabold leading-none tracking-[-0.05em] tabular-nums text-white"
          >
            {value}
          </span>
          {unit && (
            <span className="translate-y-[-2px] text-[10.5px] font-bold tracking-[-0.01em] text-white/35">
              {unit}
            </span>
          )}
        </div>
      )}

      {showBar && (
        <div className="relative mt-3 h-[3px] overflow-hidden rounded-full bg-white/[0.08]">
          <span
            className="block h-full rounded-full transition-[width] duration-700 ease-out"
            style={{
              width: `${Math.max(2, Math.min(100, num))}%`,
              background: `linear-gradient(90deg, color-mix(in oklab, ${color} 55%, transparent), ${color})`,
              boxShadow: `0 0 8px color-mix(in oklab, ${color} 60%, transparent)`,
            }}
          />
        </div>
      )}

      {trend && !dim && (
        <div
          className="relative mt-2 truncate text-[10px] font-semibold tracking-[-0.01em]"
          style={{ color: `color-mix(in oklab, ${color} 72%, white)` }}
        >
          {trend}
        </div>
      )}
    </div>
  );
}


function InfoCard({
  eyebrow,
  title,
  children,
  icon,
  accent = "green",
  trailing,
}: {
  eyebrow: string;
  title?: string;
  children: ReactNode;
  icon?: typeof Activity;
  accent?: Accent;
  trailing?: ReactNode;
}) {
  return (
    <GlassCard glow={ACCENT[accent]}>
      <SectionHeader icon={icon} eyebrow={eyebrow} title={title} accent={accent} trailing={trailing} />
      <div className="mt-4">{children}</div>
    </GlassCard>
  );
}

/** Compact insight banner: icon chip, headline, supporting line. */
function OpportunityCard({ agility, recovery }: { agility: number | null; recovery: number | null }) {
  const { headline, detail, accent } = useMemo(() => {
    if (agility != null && agility >= 75) {
      return {
        headline: "Push the intervals today",
        detail: `Agility is ${agility}/100 — a good day for interval ghosting and speed work.`,
        accent: "green" as Accent,
      };
    }
    if (recovery != null && recovery < 50) {
      return {
        headline: "Protect tomorrow",
        detail: `Recovery is ${recovery}/100 — keep it to mobility and breath work.`,
        accent: "red" as Accent,
      };
    }
    return {
      headline: "Train inside your zones",
      detail: "Reassess after your next session — VYRO will sharpen this as data lands.",
      accent: "yellow" as Accent,
    };
  }, [agility, recovery]);

  const color = ACCENT[accent];

  return (
    <GlassCard glow={color}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3.5">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[13px]"
          style={{
            background: `color-mix(in oklab, ${color} 16%, transparent)`,
            boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 40%, transparent)`,
          }}
        >
          <Sparkles size={17} strokeWidth={2.4} style={{ color }} />
        </span>
        <div className="min-w-0">
          <div
            className="text-[9.5px] font-bold uppercase tracking-[0.16em]"
            style={{ color: `color-mix(in oklab, ${color} 80%, white)` }}
          >
            top opportunity
          </div>
          <div className="mt-1 text-[15.5px] font-extrabold leading-tight tracking-[-0.03em] text-vyro-text">
            {headline}
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-vyro-mute">{detail}</p>
        </div>
      </div>
    </GlassCard>
  );
}

/** Horizontal gauge row used by RTP: label, note, value and a thin accent track. */
function GaugeRow({
  label,
  value,
  accent = "green",
  note,
}: {
  label: string;
  value: number | null | undefined;
  accent?: Accent;
  note?: string;
}) {
  const has = value != null && Number.isFinite(value);
  const pct = has ? Math.max(0, Math.min(100, value as number)) : 0;
  const color = ACCENT[accent];
  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.1em] text-white/75">
          {label}
        </span>
        <span className="flex shrink-0 items-baseline gap-[2px]">
          {has ? (
            <span className="font-[family-name:var(--font-display)] text-[18px] font-extrabold leading-none tracking-[-0.05em] tabular-nums text-white">
              {Math.round(value as number)}
            </span>
          ) : (
            <span className="block h-[15px] w-[26px] animate-pulse rounded-md bg-white/[0.08]" aria-hidden />
          )}
          <span className="text-[9px] font-bold text-white/30">/100</span>
        </span>
      </div>
      <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-white/[0.07]">
        <span
          className="block h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${has ? Math.max(2, pct) : 0}%`,
            background: `linear-gradient(90deg, color-mix(in oklab, ${color} 45%, transparent), ${color})`,
            boxShadow: has ? `0 0 8px color-mix(in oklab, ${color} 55%, transparent)` : "none",
          }}
        />
      </div>
      <div
        className="mt-1.5 truncate text-[10px] font-semibold tracking-[-0.01em]"
        style={{ color: has ? `color-mix(in oklab, ${color} 65%, white)` : "rgba(235,235,245,0.28)" }}
      >
        {has ? (note ?? "live") : "awaiting signal"}
      </div>
    </div>
  );
}

/** Timeline row for a training block. */
function PlanRow({
  time,
  title,
  load,
  tone = "green",
  live,
  onRemove,
}: {
  time: string;
  title: string;
  load?: string;
  tone?: PlanItem["color"];
  live?: boolean;
  onRemove?: () => void;
}) {
  const color = tone === "red" ? ACCENT.red : tone === "amber" ? ACCENT.orange : ACCENT.green;
  return (
    <div className="relative">
      <span
        aria-hidden
        className="absolute -left-[26px] top-[18px] grid h-[15px] w-[15px] place-items-center rounded-full"
        style={{ background: "var(--vyro-ink, #000)" }}
      >
        <span
          className={`h-[7px] w-[7px] rounded-full ${live ? "animate-pulse" : ""}`}
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
        />
      </span>
      <div
        className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[16px] border border-white/[0.07] bg-white/[0.035] px-3.5 py-3 transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.06]"
        style={live ? { boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 32%, transparent)` } : undefined}
      >
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="shrink-0 rounded-full px-2 py-[3px] text-[9.5px] font-extrabold tabular-nums tracking-[0.04em]"
              style={{ background: `color-mix(in oklab, ${color} 15%, transparent)`, color }}
            >
              {time}
            </span>
            <span className="truncate text-[13.5px] font-bold tracking-[-0.025em] text-vyro-text">{title}</span>
          </div>
          {load && <div className="mt-1 truncate text-[10.5px] font-semibold text-vyro-mute">{load}</div>}
        </div>
        {onRemove ? (
          <button
            aria-label="Remove plan item"
            onClick={onRemove}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[16px] leading-none text-white/30 transition-colors hover:bg-vyro-rose/15 hover:text-vyro-rose"
          >
            ×
          </button>
        ) : (
          <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color }}>
            live
          </span>
        )}
      </div>
    </div>
  );
}


function CognitiveFatigueCard({
  m,
  baselineMs,
  hrvBaselineMs,
}: {
  m: LiveMetrics;
  baselineMs?: number;
  hrvBaselineMs?: number;
}) {
  // Primary signal is reaction latency vs personal baseline. When the band
  // streams no motion/reaction frames we fall back to autonomic divergence:
  // HRV suppression vs the 7-day HRV baseline, which is the standard
  // physiological proxy for cognitive load.
  const { delay, status, vyroRead, caption, baselineText, meterPct } = useMemo(() => {
    const off = {
      delay: "—",
      status: "Offline",
      vyroRead: "Awaiting band",
      caption: "reaction vs baseline",
      baselineText: "—",
      meterPct: null as number | null,
    };
    if (!m.connected) return off;

    // --- Reaction-time mode -------------------------------------------------
    if (m.reactMin != null) {
      const caption = "reaction vs baseline";
      if (baselineMs == null) {
        return {
          delay: `${Math.round(m.reactMin)}ms`,
          status: "Calibrating",
          vyroRead: "Building baseline",
          caption,
          baselineText: "—",
          meterPct: null,
        };
      }
      const diff = m.reactMin - baselineMs;
      const sign = diff >= 0 ? "+" : "−";
      let status: string;
      let vyroRead: string;
      if (diff < 60) { status = "Normal"; vyroRead = "Sharp"; }
      else if (diff < 150) { status = "Slowing"; vyroRead = "Mild fatigue"; }
      else if (diff < 250) { status = "Elevated"; vyroRead = "Watch decision speed"; }
      else { status = "Diverged"; vyroRead = "Cognitively fried"; }
      return {
        delay: `${sign}${Math.abs(Math.round(diff))}ms`,
        status,
        vyroRead,
        caption,
        baselineText: `${Math.round(baselineMs)}ms`,
        meterPct: Math.max(0, Math.min(100, (diff / 300) * 100)),
      };
    }

    // --- Autonomic (HRV) mode ----------------------------------------------
    if (m.hrvMs != null) {
      const caption = "hrv vs baseline";
      if (hrvBaselineMs == null || hrvBaselineMs <= 0) {
        return {
          delay: `${Math.round(m.hrvMs)}ms`,
          status: "Calibrating",
          vyroRead: "Building HRV baseline",
          caption,
          baselineText: "—",
          meterPct: null,
        };
      }
      const pct = ((m.hrvMs - hrvBaselineMs) / hrvBaselineMs) * 100; // negative = suppressed
      const sign = pct >= 0 ? "+" : "−";
      const drop = -pct; // positive = suppression
      let status: string;
      let vyroRead: string;
      if (drop < 5) { status = "Normal"; vyroRead = "Sharp"; }
      else if (drop < 12) { status = "Slowing"; vyroRead = "Mild cognitive load"; }
      else if (drop < 20) { status = "Elevated"; vyroRead = "Watch decision speed"; }
      else { status = "Diverged"; vyroRead = "Cognitively fried"; }
      return {
        delay: `${sign}${Math.abs(Math.round(pct))}%`,
        status,
        vyroRead,
        caption,
        baselineText: `${Math.round(hrvBaselineMs)}ms`,
        meterPct: Math.max(0, Math.min(100, (drop / 25) * 100)),
      };
    }

    return { ...off, status: "Waiting", vyroRead: "No HRV yet" };
  }, [m.connected, m.reactMin, m.hrvMs, baselineMs, hrvBaselineMs]);

  const hrStatus = useMemo(() => {
    if (!m.connected || m.heartRateBpm == null) return "—";
    if (m.heartRateBpm < 60) return "Low";
    if (m.heartRateBpm > 100) return "Elevated";
    return "Normal";
  }, [m.connected, m.heartRateBpm]);

  const hasDelay = delay !== "—";
  const indigo = ACCENT.indigo;


  return (
    <GlassCard glow={indigo}>
      <SectionHeader
        icon={Brain}
        eyebrow="Cognitive load"
        title="Fatigue divergence"
        accent="indigo"
        trailing={
          <span
            className="rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em]"
            style={{
              background: `color-mix(in oklab, ${indigo} 16%, transparent)`,
              color: `color-mix(in oklab, ${indigo} 75%, white)`,
              boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${indigo} 38%, transparent)`,
            }}
          >
            {status}
          </span>
        }
      />

      <div className="mt-4 rounded-[20px] border border-white/[0.07] bg-white/[0.035] p-3.5">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[9.5px] font-bold uppercase tracking-[0.15em] text-vyro-mute">
              {caption}
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              {hasDelay ? (
                <span className="font-[family-name:var(--font-display)] text-[34px] font-extrabold leading-none tracking-[-0.05em] tabular-nums text-white">
                  {delay}
                </span>
              ) : (
                <span className="block h-[26px] w-[74px] animate-pulse rounded-lg bg-white/[0.07]" aria-hidden />
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[9.5px] font-bold uppercase tracking-[0.13em] text-vyro-mute">baseline</div>
            <div className="mt-1 font-[family-name:var(--font-display)] text-[14px] font-extrabold tabular-nums text-white/80">
              {baselineText}
            </div>
          </div>
        </div>

        <div className="relative mt-3.5 h-[6px] overflow-hidden rounded-full bg-white/[0.07]">
          <span
            className="block h-full rounded-full transition-[width] duration-700 ease-out"
            style={{
              width: `${meterPct != null ? Math.max(3, meterPct) : 0}%`,
              background: `linear-gradient(90deg, ${ACCENT.green}, ${ACCENT.orange} 70%, ${ACCENT.red})`,
            }}
          />
          <span
            aria-hidden
            className="absolute inset-y-[-3px] w-px bg-white/25"
            style={{ left: "66.6%" }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[9px] font-bold uppercase tracking-[0.1em] text-white/25">
          <span>sharp</span>
          <span>{caption.startsWith("hrv") ? "17% threshold" : "200ms threshold"}</span>
          <span>fried</span>
        </div>
      </div>


      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <div className="rounded-[16px] border border-white/[0.07] bg-white/[0.03] p-3">
          <div className="text-[9px] font-bold uppercase tracking-[0.13em] text-vyro-mute">heart rate</div>
          <div className="mt-1.5 text-[13.5px] font-bold tracking-[-0.02em] text-vyro-text">{hrStatus}</div>
        </div>
        <div className="rounded-[16px] border border-white/[0.07] bg-white/[0.03] p-3">
          <div className="text-[9px] font-bold uppercase tracking-[0.13em] text-vyro-mute">vyro read</div>
          <div className="mt-1.5 truncate text-[13.5px] font-bold tracking-[-0.02em] text-vyro-text">{vyroRead}</div>
        </div>
      </div>

      <div className="mt-2.5 flex items-start gap-2.5 rounded-[16px] border border-vyro-indigo/18 bg-vyro-indigo/[0.07] p-3">
        <Activity size={15} className="mt-[1px] shrink-0 text-vyro-indigo" />
        <span className="text-[11.5px] leading-relaxed text-vyro-mute">
          {meterPct != null
            ? caption.startsWith("hrv")
              ? "HRV suppressed more than ~17% below your baseline means decision speed drops before your body feels tired — ease off late-game intensity."
              : "Past 200ms of divergence, decision speed drops before your body feels tired — ease off late-game intensity."
            : "Keep wearing the band — a few days of HRV (or a logged session) seeds the cognitive baseline."}
        </span>
      </div>
    </GlassCard>
  );

}



function EmbeddedView({
  view,
  profileSport,
}: {
  view: App2View;
  profileSport: "squash" | "tennis";
}) {
  if (view === "trends") {
    return (
      <div className="app2-scroll-embed">
        <TrendsView />
      </div>
    );
  }
  if (view === "session") {
    return (
      <div className="app2-scroll-embed">
        <SessionView />
      </div>
    );
  }
  if (view === "sport") {
    return (
      <div className="app2-scroll-embed">
        <SportTabs />
      </div>
    );
  }
  if (view === "recovery") {
    return (
      <div className="app2-scroll-embed">
        <RecoveryView />
      </div>
    );
  }
  if (view === "sleep") {
    return (
      <div className="app2-scroll-embed">
        <SleepView />
      </div>
    );
  }
  if (view === "debug") {
    return (
      <div className="app2-scroll-embed">
        <DebugView />
      </div>
    );
  }
  if (view === "coach") {
    return (
      <div className="app2-scroll-embed">
        <CoachView />
      </div>
    );
  }
  if (view === "social") {
    return (
      <div className="app2-scroll-embed">
        <SocialView />
      </div>
    );
  }
  if (view === "band") return <BandView defaultSport={profileSport} />;
  return null;
}

function BandView({ defaultSport }: { defaultSport: "squash" | "tennis" }) {
  const fetchProfile = useServerFn(getMyProfile);
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
  });

  return (
    <div className="app2-scroll-embed">
      <BandPanel
        pairedId={profile?.paired_band_id ?? null}
        pairedName={profile?.paired_band_name ?? null}
        defaultSport={defaultSport}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sport tab — Overview / Court DB / Movement / Motion / Tendencies.
// These views existed in the codebase but were never reachable from the nav.
// ---------------------------------------------------------------------------
type SportTab = "overview" | "court" | "movement" | "motion" | "tendency";

const SPORT_TABS: { id: SportTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "court", label: "Court DB" },
  { id: "movement", label: "Movement" },
  { id: "motion", label: "Motion" },
  { id: "tendency", label: "Tendencies" },
];

function SportTabs() {
  const [tab, setTab] = useState<SportTab>("overview");
  return (
    <div className="space-y-4">
      <SegmentedTabs tabs={SPORT_TABS} value={tab} onChange={setTab} />
      <div key={tab} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {tab === "overview" && <SportView />}
        {tab === "court" && <CourtDbView />}
        {tab === "movement" && <MovementPanel />}
        {tab === "motion" && <SwingView />}
        {tab === "tendency" && <TendencyView />}
      </div>
    </div>
  );
}


function AthleteHome({ setView }: { setView: (view: App2View) => void }) {
  const fetchProfile = useServerFn(getMyProfile);
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
  });
  const s = useVyroScores();
  const m = s.m;
  const firstName = (profile?.display_name || "athlete").trim().split(/\s+/)[0];

  // Live session timer (auto-driven by band.sessionState)
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    if (m.sessionState === "live" && sessionStart == null) setSessionStart(Date.now());
    if (m.sessionState === "idle" && sessionStart != null) setSessionStart(null);
  }, [m.sessionState, sessionStart]);
  useEffect(() => {
    if (m.sessionState !== "live") return;
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [m.sessionState]);

  // ---- Today's plan: real, user-owned rows from the database --------------
  const queryClient = useQueryClient();
  const fetchPlan = useServerFn(listTrainingPlan);
  const addItem = useServerFn(addTrainingPlanItem);
  const removeItem = useServerFn(deleteTrainingPlanItem);
  const { data: planItems } = useQuery({
    queryKey: ["training-plan", "today"],
    queryFn: () => fetchPlan(),
  });
  const invalidatePlan = () =>
    queryClient.invalidateQueries({ queryKey: ["training-plan", "today"] });
  const addMutation = useMutation({ mutationFn: addItem, onSuccess: invalidatePlan });
  const deleteMutation = useMutation({ mutationFn: removeItem, onSuccess: invalidatePlan });
  const items = planItems ?? [];
  const [draft, setDraft] = useState({ time: "", title: "", load: "", tone: "green" as PlanItem["color"] });

  // Every score below is the GLOBAL value — identical on every other tab.
  const { readiness, recovery, sleep, fatigue, fatigueSource, agility, agilityReason, strain, statusLabel, baselines, rtp } = s;
  const battery = m.batteryPct;
  const status = m.connected ? "BAND CONNECTED" : m.connecting ? "BAND CONNECTING" : "PAIR BAND";

  const trend = (
    cur: number | null | undefined,
    baseline: number | null | undefined,
    fmt: (d: number) => string,
    neutral = "baseline",
  ) => {
    if (cur == null || baseline == null) return undefined;
    const d = cur - baseline;
    if (Math.abs(d) < 0.5) return neutral;
    return fmt(d);
  };

  const fmtCell = (v: number | string | null | undefined) => (v == null || v === "" ? "—" : v);
  const liveCell = (v: number | string | null | undefined) => (m.connected ? fmtCell(v) : "—");

  const vitals = useMemo(
    () => [
      { label: "Current HR", value: liveCell(m.heartRateBpm), unit: "bpm", accent: "red" as Accent,
        trend: m.connected ? trend(m.heartRateBpm, m.restingHrBpm, (d) => `${d > 0 ? "+" : ""}${Math.round(d)} vs rest`) : undefined,
        live: m.connected && m.heartRateBpm != null },
      { label: "Resting HR", value: liveCell(m.restingHrBpm), unit: "bpm", accent: "pink" as Accent,
        trend: trend(m.restingHrBpm, baselines.restingHr, (d) => `${d > 0 ? "+" : ""}${Math.round(d)} vs 7d`),
        live: m.connected && m.restingHrBpm != null },
      { label: "HRV (RMSSD)", value: liveCell(m.hrvMs), unit: "ms", accent: "green" as Accent,
        trend: trend(m.hrvMs, baselines.hrv, (d) => `${d > 0 ? "+" : ""}${Math.round(d)} ms`) ?? m.metricPipeline.hrv.detail,
        live: m.connected && m.hrvMs != null },
      { label: "Steps", value: liveCell(m.stepsToday), unit: "", accent: "teal" as Accent,
        trend: m.connected && m.distanceM != null ? `${(m.distanceM / 1000).toFixed(2)} km` : undefined,
        live: m.connected && m.stepsToday != null },
      { label: "Skin Temp", value: m.connected && m.skinTempC != null ? m.skinTempC.toFixed(1) : "—", unit: "°C", accent: "orange" as Accent, trend: m.skinTempC == null ? m.metricPipeline.skinTemp.detail : undefined,
        live: m.connected && m.skinTempC != null },
      { label: "Blood Pressure", value: m.connected && m.bloodPressure ? `${m.bloodPressure.sbp}/${m.bloodPressure.dbp}` : "—", unit: "mmHg", accent: "purple" as Accent, trend: m.bloodPressure == null ? m.metricPipeline.bloodPressure.detail : undefined,
        live: m.connected && m.bloodPressure != null },
      { label: "Strain", value: fmtCell(strain), unit: "/100", accent: "yellow" as Accent,
        trend: strain != null ? (strain > 70 ? "overload" : strain > 40 ? "tempo" : "easy") : undefined,
        live: m.connected && strain != null },
      { label: "SpO₂", value: liveCell(m.spo2Pct), unit: "%", accent: "blue" as Accent,
        trend: m.connected && m.spo2Pct != null ? (m.spo2Pct >= 95 ? "stable" : "low") : m.metricPipeline.spo2.detail,
        live: m.connected && m.spo2Pct != null },
      { label: "Resp Rate", value: m.connected && m.respRateBrpm != null ? m.respRateBrpm.toFixed(1) : "—", unit: "brpm", accent: "indigo" as Accent, trend: m.respRateBrpm == null ? m.metricPipeline.respiration.detail : undefined,
        live: m.connected && m.respRateBrpm != null },
      { label: "Stress", value: liveCell(m.stressScore), unit: "/100", accent: "orange" as Accent,
        trend: m.connected && m.stressScore != null ? (m.stressScore < 40 ? "calm" : m.stressScore < 70 ? "alert" : "high") : m.metricPipeline.stress.detail,
        live: m.connected && m.stressScore != null },
    ],

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m.connected, m.heartRateBpm, m.restingHrBpm, m.hrvMs, m.stepsToday, m.distanceM, m.skinTempC, m.bloodPressure, m.spo2Pct, m.respRateBrpm, m.stressScore, m.metricPipeline, strain, baselines.hrv, baselines.restingHr],
  );

  // Auto-injected live training block (from the active session)
  const liveSessionBlock = useMemo(() => {
    if (m.sessionState === "idle" || sessionStart == null) return null;
    const elapsedMin = Math.max(0, Math.floor((nowTick - sessionStart) / 60_000));
    const load = strain ?? 0;
    const classification = load > 70 ? "Overload" : load > 40 ? "Optimal" : "Light";
    const color: PlanItem["color"] = load > 70 ? "red" : load > 40 ? "green" : "amber";
    return {
      time: new Date(sessionStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      title: `Court session — ${m.sessionState === "paused" ? "paused" : "live tracking"}`,
      load: `${classification} · ${elapsedMin} min`,
      color,
    } satisfies PlanItem;
  }, [m.sessionState, sessionStart, nowTick, strain]);

  const addPlan = () => {
    if (!draft.title.trim() && !draft.time.trim() && !draft.load.trim()) return;
    addMutation.mutate({
      data: {
        time_label: draft.time || "TBD",
        title: draft.title || "New training block",
        load_label: draft.load || "Custom",
        tone: draft.tone,
        sport: s.sport,
      },
    });
    setDraft({ time: "", title: "", load: "", tone: "green" });
  };

  return (
    <main className="app2-main">
      <div className="space-y-5 pb-2">
        {/* ---- Greeting header -------------------------------------------- */}
        <header className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.18em] text-vyro-mute">
            <CalendarDays size={11} className="shrink-0" />
            {dateLabel}
          </div>
          <h1 className="mt-2 text-[30px] font-black leading-[1.05] tracking-[-0.045em] text-vyro-text">
            Good morning, {firstName}.
          </h1>
          <p className="mt-2 max-w-[34ch] text-[13px] leading-relaxed text-vyro-mute">
            Your daily readiness command center — synced from your VYRO Band.
          </p>
          <button
            className="mt-3.5 inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.05] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-vyro-text transition-all duration-200 hover:border-white/20 hover:bg-white/[0.09] active:scale-[0.97]"
            onClick={() => setView("band")}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                m.connected
                  ? "animate-pulse bg-vyro-mint shadow-[0_0_8px_var(--vyro-mint)]"
                  : "bg-vyro-mute/60"
              }`}
            />
            {status}
            {m.connected && battery != null ? ` · ${battery}%` : ""}
          </button>
        </header>

        {/* ---- Readiness hero -------------------------------------------- */}
        <GlassCard
          glow={toneVar(readiness)}
          className="animate-in fade-in slide-in-from-bottom-3 p-5 duration-500 sm:p-6"
        >
          {/* status strip */}
          <div className="flex items-center justify-between gap-3">
            {/* Status text is driven by the canonical recovery band — a low
                recovery can no longer render a green "Ready" tag. */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.16em] ${
                s.bandTone === "warn"
                  ? "border-vyro-amber/25 bg-vyro-amber/10 text-vyro-amber"
                  : s.bandTone === "off"
                    ? "border-vyro-rose/25 bg-vyro-rose/10 text-vyro-rose"
                    : s.bandTone === "neutral"
                      ? "border-white/10 bg-white/[0.06] text-vyro-mute"
                      : "border-vyro-mint/25 bg-vyro-mint/10 text-vyro-mint"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full bg-current ${s.bandTone === "neutral" ? "" : "animate-pulse"}`}
              />
              {statusLabel}
            </span>
            <span className="truncate text-[9.5px] font-bold uppercase tracking-[0.16em] text-vyro-mute">
              {m.connected && readiness != null ? "Live · VYRO Band" : m.connected ? "Collecting signals" : "Awaiting band"}
            </span>
          </div>

          <div className="mt-4 flex flex-col items-center gap-5">
            <Ring value={readiness} recovery={recovery} sleep={sleep} />

            <RingLegend
              items={[
                { label: "Readiness", value: readiness, color: toneVar(readiness) },
                { label: "Recovery", value: readiness == null ? null : recovery, color: "var(--vyro-blue)" },
                { label: "Sleep", value: readiness == null ? null : sleep, color: "var(--vyro-indigo)" },
              ]}
            />

            <div className="w-full min-w-0">
              <h2 className="text-balance text-center font-[family-name:var(--font-display)] text-[21px] font-extrabold leading-[1.18] tracking-[-0.04em] text-vyro-text">
                {s.coachRead}
              </h2>
              <p className="mx-auto mt-2 max-w-[36ch] text-center text-[12.5px] leading-relaxed text-vyro-mute">
                {m.connected && readiness != null
                  ? "Live HRV, resting HR, SpO₂ and IMU load drive every score below."
                  : m.connected
                    ? "Connected. Waiting for enough independent body signals to calculate a trusted score."
                  : "Pair your VYRO Band to populate live signals."}
              </p>

              <div className="mt-5 h-px bg-linear-to-r from-transparent via-white/12 to-transparent" />

              <div className="mt-4">
                <Eyebrow tone="mute">What changed</Eyebrow>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {baselines.readiness != null && readiness != null ? (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10.5px] font-semibold ${
                        readiness < baselines.readiness
                          ? "border-vyro-amber/20 bg-vyro-amber/10 text-vyro-amber"
                          : "border-vyro-mint/20 bg-vyro-mint/10 text-vyro-mint"
                      }`}
                    >
                      {readiness >= baselines.readiness ? "↗" : "↘"} Readiness{" "}
                      {Math.round(readiness - baselines.readiness) > 0 ? "+" : ""}
                      {Math.round(readiness - baselines.readiness)} vs {baselines.days}d baseline
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.05] px-2.5 py-1.5 text-[10.5px] font-semibold text-vyro-mute">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                      Calibrating baseline…
                    </span>
                  )}
                  {m.connected && m.hrvMs != null && baselines.hrv != null && (
                    <span className="rounded-full border border-vyro-mint/20 bg-vyro-mint/10 px-2.5 py-1.5 text-[10.5px] font-semibold text-vyro-mint">
                      ↗ HRV {m.hrvMs - baselines.hrv > 0 ? "+" : ""}
                      {Math.round(m.hrvMs - baselines.hrv)} ms
                    </span>
                  )}
                  {strain != null && strain > 70 && (
                    <span className="rounded-full border border-vyro-rose/20 bg-vyro-rose/10 px-2.5 py-1.5 text-[10.5px] font-semibold text-vyro-rose">
                      ⚠ Strain {strain}/100
                    </span>
                  )}
                </div>
              </div>

              {!m.connected && (
                <button
                  onClick={() => setView("band")}
                  className="mt-4 w-full rounded-2xl bg-white px-4 py-3 font-[family-name:var(--font-display)] text-[12px] font-bold uppercase tracking-[0.14em] text-black transition-transform duration-200 ease-out active:scale-[0.98]"
                >
                  Pair your band
                </button>
              )}
            </div>
          </div>
        </GlassCard>


        <div className="space-y-4">
          <OpportunityCard agility={agility} recovery={recovery} />


          <InfoCard eyebrow="Watch-derived readiness" title="Core metrics" icon={Gauge} accent="green">
            <div className="divide-y divide-white/[0.06]">
              <MetricRow
                label="Fatigue"
                accent="red"
                value={fatigue}
                invert
                emptyHint="needs HRV + resting HR"
                status={
                  fatigue != null
                    ? `${fatigue < 40 ? "Controlled" : fatigue < 70 ? "Elevated" : "Overload"}${fatigueSource === "autonomic" ? " · autonomic" : fatigueSource === "motion" ? " · motion load" : ""}`
                    : undefined
                }
              />
              <MetricRow
                label="Recovery"
                accent="green"
                value={recovery}
                status={
                  trend(recovery, baselines.recovery, (d) => `${d > 0 ? "+" : ""}${Math.round(d)} vs base`) ??
                  undefined
                }
              />
              <MetricRow
                label="Agility"
                accent="teal"
                value={agility}
                emptyHint={agilityReason ?? undefined}
                status={agility != null ? (agility >= 75 ? "Peaking" : agility >= 50 ? "Steady" : "Low") : undefined}
              />
              <MetricRow
                label="Sleep"
                accent="indigo"
                value={sleep}
                emptyHint="wear the band overnight"
                status={sleep != null ? (sleep >= 80 ? "Rested" : "Short") : undefined}
              />

            </div>
          </InfoCard>


          <InfoCard
            eyebrow="Vitals"
            title="Live body signals"
            icon={Heart}
            accent="blue"
            trailing={
              <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${m.connected ? "border-vyro-mint/25 bg-vyro-mint/10 text-vyro-mint" : "border-white/10 bg-white/[0.06] text-vyro-mute"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${m.connected ? "animate-pulse bg-vyro-mint" : "bg-vyro-mute/60"}`} />
                {m.connected ? "streaming" : "offline"}
              </span>
            }
          >
            <div className="divide-y divide-white/[0.055]">
              {vitals.map((vital) => (
                <VitalRow key={vital.label} {...vital} />
              ))}
            </div>

          </InfoCard>

          <CognitiveFatigueCard
            m={m}
            baselineMs={baselines.reactMs ?? undefined}
            hrvBaselineMs={baselines.hrv ?? undefined}
          />

          <InfoCard
            eyebrow="Return-to-play"
            title="RTP Validator"
            icon={ShieldCheck}
            accent={rtp.withinBaseline ? "green" : "orange"}
            trailing={
              <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${rtp.withinBaseline ? "border-vyro-mint/25 bg-vyro-mint/10 text-vyro-mint" : "border-vyro-amber/25 bg-vyro-amber/10 text-vyro-amber"}`}>
                {rtp.wearablePower == null || rtp.baseline == null ? "calibrating" : rtp.withinBaseline ? "cleared" : "hold"}
              </span>
            }
          >
            {rtp.wearablePower == null || rtp.baseline == null ? (
              <div className="rounded-[20px] border border-vyro-amber/18 bg-vyro-amber/[0.06] p-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-vyro-amber">
                    baseline capture
                  </span>
                  <span className="font-[family-name:var(--font-display)] text-[13px] font-extrabold tabular-nums text-vyro-text">
                    {baselines.days}
                    <span className="text-[10px] font-bold text-white/35">/7 days</span>
                  </span>
                </div>
                <div className="mt-2.5 flex gap-1">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <span
                      key={i}
                      className="h-[5px] flex-1 rounded-full transition-colors duration-500"
                      style={{
                        background: i < baselines.days ? ACCENT.orange : "hsl(0 0% 100% / 0.08)",
                        boxShadow: i < baselines.days ? `0 0 8px color-mix(in oklab, ${ACCENT.orange} 55%, transparent)` : "none",
                      }}
                    />
                  ))}
                </div>
                <p className="mt-2.5 text-[11.5px] leading-relaxed text-vyro-mute">
                  RTP clearance unlocks once a full week of your own readiness history is stored.
                </p>
              </div>
            ) : (
              <p className="text-[12.5px] leading-relaxed text-vyro-mute">
                {rtp.withinBaseline
                  ? `Cleared — wearable power within ±5% of your ${baselines.days}-day baseline (${rtp.deviationPct!.toFixed(1)}%).`
                  : `Hold — wearable power ${rtp.deviationPct! > 0 ? "above" : "below"} baseline by ${Math.abs(rtp.deviationPct!).toFixed(1)}% (target ±5%).`}
              </p>
            )}

            <div className="mt-3.5 divide-y divide-white/[0.06] overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.03] px-3.5">
              <GaugeRow
                label="Wearable power"
                accent="green"
                value={rtp.wearablePower}
                note={rtp.baseline != null ? `baseline ${rtp.baseline}` : undefined}
              />
              <GaugeRow
                label="Clearance"
                accent="blue"
                value={rtp.clearance}
                note={rtp.withinBaseline ? "in range" : rtp.deviationPct != null ? "out of range" : undefined}
              />
              <GaugeRow label="Muscle readiness" accent="orange" value={s.parts.muscle} note="IMU load" />
              <GaugeRow
                label="Recovery environment"
                accent="teal"
                value={s.parts.environment}
                note="SpO₂ · temp · HRV"
              />
            </div>
          </InfoCard>



          <InfoCard
            eyebrow="Today's plan"
            title="Training blocks"
            icon={ListChecks}
            accent="purple"
            trailing={
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-vyro-mute">
                {items.length + (liveSessionBlock ? 1 : 0)} block{items.length + (liveSessionBlock ? 1 : 0) === 1 ? "" : "s"}
              </span>
            }
          >
            {items.length === 0 && !liveSessionBlock ? (
              <div className="rounded-[20px] border border-dashed border-white/[0.12] bg-white/[0.02] px-4 py-6 text-center">
                <div className="text-[13px] font-bold tracking-[-0.02em] text-vyro-text">Nothing scheduled</div>
                <p className="mx-auto mt-1 max-w-[240px] text-[11.5px] leading-relaxed text-vyro-mute">
                  Add your first block below and VYRO will score the load against today's readiness.
                </p>
              </div>
            ) : (
              <div className="relative pl-[26px]">
                <span
                  aria-hidden
                  className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-white/[0.16] via-white/[0.09] to-transparent"
                />
                <div className="space-y-2">
                  {liveSessionBlock && (
                    <PlanRow
                      time={liveSessionBlock.time}
                      title={liveSessionBlock.title}
                      load={`${liveSessionBlock.load} · live now`}
                      tone="green"
                      live
                    />
                  )}
                  {items.map((item) => (
                    <PlanRow
                      key={item.id}
                      time={item.time_label}
                      title={item.title}
                      load={item.load_label}
                      tone={(item.tone as PlanItem["color"]) ?? "green"}
                      onRemove={() => deleteMutation.mutate({ data: { id: item.id } })}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 rounded-[20px] border border-white/[0.08] bg-white/[0.035] p-3">
              <div className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-vyro-mute">
                <Plus size={11} strokeWidth={3} />
                add a block
              </div>

              <div className="mt-3 grid grid-cols-[76px_minmax(0,1fr)] gap-2">
                <input
                  className="rounded-[12px] border border-white/[0.08] bg-black/25 px-2.5 py-2.5 text-center text-[12.5px] font-bold tabular-nums text-vyro-text outline-none transition-colors placeholder:font-semibold placeholder:text-vyro-mute/50 focus:border-vyro-mint/45"
                  placeholder="7:30"
                  value={draft.time}
                  onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))}
                />
                <input
                  className="rounded-[12px] border border-white/[0.08] bg-black/25 px-3 py-2.5 text-[12.5px] font-semibold text-vyro-text outline-none transition-colors placeholder:font-medium placeholder:text-vyro-mute/50 focus:border-vyro-mint/45"
                  placeholder="Session name"
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                />
              </div>

              <input
                className="mt-2 w-full rounded-[12px] border border-white/[0.08] bg-black/25 px-3 py-2.5 text-[12.5px] font-semibold text-vyro-text outline-none transition-colors placeholder:font-medium placeholder:text-vyro-mute/50 focus:border-vyro-mint/45"
                placeholder="Load — e.g. 45 min · zone 3"
                value={draft.load}
                onChange={(event) => setDraft((current) => ({ ...current, load: event.target.value }))}
              />

              <div className="mt-3 flex items-center gap-2">
                <div className="flex min-w-0 flex-1 gap-1 rounded-[12px] border border-white/[0.07] bg-black/25 p-1">
                  {([
                    { value: "green", label: "Optimal", accent: "green" as Accent },
                    { value: "amber", label: "Elevated", accent: "orange" as Accent },
                    { value: "red", label: "High", accent: "red" as Accent },
                  ] as const).map((tone) => {
                    const active = draft.tone === tone.value;
                    const color = ACCENT[tone.accent];
                    return (
                      <button
                        key={tone.value}
                        onClick={() => setDraft((current) => ({ ...current, tone: tone.value as PlanItem["color"] }))}
                        className="min-w-0 flex-1 truncate rounded-[9px] px-1 py-[7px] text-[10px] font-bold uppercase tracking-[0.02em] transition-all duration-200"
                        style={
                          active
                            ? {
                                background: `color-mix(in oklab, ${color} 20%, transparent)`,
                                color,
                                boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 45%, transparent)`,
                              }
                            : { color: "rgba(235,235,245,0.4)" }
                        }
                      >
                        {tone.label}
                      </button>
                    );
                  })}
                </div>
                <button
                  className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[12px] bg-vyro-mint text-vyro-ink shadow-[0_6px_18px_-6px_var(--vyro-mint)] transition-all duration-200 hover:brightness-110 active:scale-[0.94] disabled:opacity-40"
                  onClick={addPlan}
                  disabled={addMutation.isPending || !draft.title.trim()}
                  aria-label="Add plan item"
                >
                  <Plus size={17} strokeWidth={2.8} />
                </button>
              </div>
            </div>
          </InfoCard>

        </div>
      </div>
    </main>
  );
}

// Shows whether the band keeps streaming while the app is off-screen.
function AlwaysOnPill({ connected }: { connected: boolean }) {
  const [ka, setKa] = useState(() => getKeepAliveStatus());
  useEffect(() => subscribeKeepAlive(setKa), []);
  const on = connected && ka.active && (ka.audio || ka.native);
  const label = !connected ? "Always-on off" : on ? "Always on" : "Tap to arm";
  return (
    <button
      type="button"
      className="app2-live-pill"
      title={
        on
          ? "Background session active — the band keeps streaming when the app is minimized."
          : "Tap anywhere once to arm the background session so the band keeps streaming off-screen."
      }
      onClick={() => pokeKeepAlive()}
      aria-live="polite"
    >
      <span className={on ? "app2-dot app2-pulse" : "app2-dot"} />
      {label}
    </button>
  );
}

export function App2ReferenceShell() {

  const [view, setView] = useState<App2View>("athlete");
  const fetchProfile = useServerFn(getMyProfile);
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
  });
  const m = useLiveMetrics();
  const sport = (profile?.sport as "squash" | "tennis" | undefined) ?? "squash";
  const initials =
    (profile?.display_name || "Ryan Carter")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "RC";
  const title = view === "trends" ? "Player Dashboard" : view === "athlete" ? "Athlete" : view[0].toUpperCase() + view.slice(1);
  const topButtons = [
    { id: "trends" as App2View, label: "Trends", icon: LineChart },
    { id: "session" as App2View, label: "Session", icon: Radio },
    { id: "coach" as App2View, label: "Coach", icon: UserRound },
    { id: "social" as App2View, label: "Social", icon: MessageCircle },
  ];
  const tabs = [
    { id: "athlete" as App2View, label: "Athlete", icon: Activity },
    { id: "sport" as App2View, label: "Sport", icon: Trophy },
    { id: "recovery" as App2View, label: "Recovery", icon: Heart },
    { id: "sleep" as App2View, label: "Sleep", icon: Moon },
    { id: "debug" as App2View, label: "Debug", icon: Stethoscope },
  ];

  return (
    <div className="app2-ref">
      <div className="app2-phone">
        {/* Real iOS status bar shows through via safe-area inset; no fake status bar */}
        <header className="app2-shell-header">
          <div className="app2-topbar">
            <div>
              <Logo />
              <div className="app2-kicker">VYRO IOS</div>
              <div className="app2-title">{title}</div>
            </div>
            <div>
              <div className="app2-actions">
                <AlwaysOnPill connected={m.connected} />
                <button className="app2-sync" onClick={() => setView("band")}>
                  <span className={m.connected ? "app2-dot app2-pulse" : "app2-dot"} />
                  Sync now
                </button>

                <button
                  className="app2-icon-btn"
                  aria-label="Device settings"
                  onClick={() => setView("band")}
                >
                  <Settings2 size={17} />
                </button>
                <button className="app2-icon-btn" aria-label="Notifications">
                  <Bell size={17} />
                  <span className="app2-badge">2</span>
                </button>
              </div>
              <button className="app2-avatar" onClick={() => setView("band")}>
                {initials}
              </button>
            </div>
          </div>
          <nav className="app2-module-nav" aria-label="VYRO modules">
            {topButtons.map(({ id, label, icon: Icon }) => (
              <button key={label} className={`app2-chip ${view === id ? "active" : ""}`} onClick={() => setView(id)}>
                <Icon size={14} />
                {label}
              </button>
            ))}
          </nav>
        </header>

        {view === "athlete" ? (
          <AthleteHome setView={setView} />
        ) : (
          <main className="app2-main">
            <EmbeddedView view={view} profileSport={sport} />
          </main>
        )}

        <nav className="app2-bottom-nav" aria-label="Primary navigation">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`app2-tab ${view === id ? "active" : ""}`}
              onClick={() => setView(id)}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
