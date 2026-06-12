import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  BarChart3,
  Bluetooth,
  ChevronRight,
  Dumbbell,
  History,
  Radio,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { getMyProfile } from "@/lib/profile.functions";
import { Card, EmptyState, PageHeader, Pill, Stat } from "./shared";
import { useLiveMetrics, fmtNum } from "./useLiveMetrics";
import type { ViewId } from "./Layout";
import { FEATURE_SPECS } from "./featureSpecs";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function HomeView({ setView }: { setView: (v: ViewId) => void }) {
  const fetchProfile = useServerFn(getMyProfile);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const first = (profile?.display_name || "").trim().split(/\s+/)[0] || "Athlete";

  const m = useLiveMetrics();
  const statusTone = !m.connected ? (m.connecting ? "warn" : "off") : m.sessionState === "live" ? "live" : "warn";
  const statusText = !m.connected
    ? (m.connecting ? "Connecting…" : "Watch offline")
    : m.sessionState === "live" ? "Live session" : "Connected · idle";

  const totalEvents = m.counts.swing + m.counts.rapid_start + m.counts.burst + m.counts.direction_change;

  const primaryActions: ActionTileProps[] = [
    {
      id: "session",
      eyebrow: "Workout",
      label: "Session console",
      value: m.sessionState === "live" ? "Live now" : "Start",
      hint: "Start, pause, end, and save band sessions.",
      icon: Activity,
      tone: "session",
    },
    {
      id: "profile",
      eyebrow: "Device",
      label: "Profile & band",
      value: m.pairedName || (m.pairedId ? "Paired" : "Pair band"),
      hint: "Connect the watch, set sport, handedness.",
      icon: Bluetooth,
      tone: "spatial",
    },
    {
      id: "history",
      eyebrow: "Saved",
      label: "Session history",
      value: "Review",
      hint: "Logged swings, bursts, direction changes.",
      icon: History,
      tone: "recovery",
    },
    {
      id: "more",
      eyebrow: "Modules",
      label: "Everything else",
      value: "Open",
      hint: "Sleep, recovery, coach, video, social, diet.",
      icon: BarChart3,
      tone: "coach",
    },
  ];

  const performanceLab: ActionTileProps[] = [
    {
      id: "sport",
      eyebrow: "Calibration",
      label: "Sport profiles",
      value: profile?.sport || "Squash",
      hint: "Sport-specific thresholds and movement model.",
      icon: Dumbbell,
      tone: "spatial",
    },
    {
      id: "activity",
      eyebrow: "All-day",
      label: "Activity load",
      value: m.connected ? `${totalEvents}` : "—",
      hint: "Active minutes and motion intensity from IMU.",
      icon: Radio,
      tone: "recovery",
    },
    {
      id: "trends",
      eyebrow: "Trends",
      label: "Training load",
      value: m.connected ? `${m.eventsLastMin}/min` : "—",
      hint: "Weekly volume, peaks, and workload changes.",
      icon: BarChart3,
      tone: "fatigue",
    },
    {
      id: "coach",
      eyebrow: "AI",
      label: "Coach plan",
      value: "Plan",
      hint: "Drills, rest cues, and weekly focus.",
      icon: ShieldCheck,
      tone: "coach",
    },
  ];

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <PageHeader
        eyebrow="Athlete Dashboard"
        title={`${greeting()}, ${first}.`}
        subtitle={m.connected
          ? "Live IMU data streaming from your VYRO band."
          : "Pair your band to stream live motion data into every widget."}
        action={<Pill tone={statusTone} pulse={m.sessionState === "live"}>{statusText}</Pill>}
      />

      <section className="rounded-2xl border border-black/[0.07] bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
        <div className="mb-3 flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-black/45">Today</div>
            <h3 className="mt-1 text-base font-black text-black">Your full VYRO home</h3>
          </div>
          <Pill tone={m.connected ? "live" : "off"}>{m.connected ? "watch data" : "no watch"}</Pill>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniMetric label="Motion events" value={m.connected ? totalEvents : "—"} />
          <MiniMetric label="Session" value={m.sessionState} />
          <MiniMetric label="Peak accel" value={fmtNum(m.peakG, m.connected, 2)} unit="g" />
          <MiniMetric label="Fastest react" value={fmtNum(m.reactMin, m.connected, 0)} unit="ms" />
        </div>
      </section>

      {!m.pairedId && (
        <EmptyState
          title="No band paired"
          hint="Pair your VYRO band to start streaming swings, peaks, and reaction times."
          action={
            <button
              onClick={() => setView("profile")}
              className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-black/85"
            >
              Pair your band
            </button>
          }
        />
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {primaryActions.map((item) => (
          <ActionTile key={item.id} {...item} onClick={() => setView(item.id)} />
        ))}
      </div>

      {/* Event counts */}
      <Card eyebrow="Live · From Watch" title="Motion events this session">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Swings" value={m.connected ? m.counts.swing : "—"} />
          <Stat label="Rapid starts" value={m.connected ? m.counts.rapid_start : "—"} />
          <Stat label="Bursts" value={m.connected ? m.counts.burst : "—"} />
          <Stat label="Direction Δ" value={m.connected ? m.counts.direction_change : "—"} />
        </div>
      </Card>

      {/* Peak motion */}
      <Card eyebrow="Peak IMU" title="Maximum motion seen">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Peak accel" value={fmtNum(m.peakG, m.connected, 2)} unit="g" />
          <Stat label="Peak gyro" value={fmtNum(m.peakDps, m.connected, 0)} unit="dps" />
          <Stat label="Peak jerk" value={fmtNum(m.peakJerk, m.connected, 1)} unit="g/s" />
        </div>
      </Card>

      {/* Swing quality */}
      <Card eyebrow="Swing Quality" title="Per-swing analytics">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Max intensity" value={fmtNum(m.swingIntMax, m.connected, 0)} unit="/100" />
          <Stat label="Avg intensity (10)" value={fmtNum(m.swingIntAvg, m.connected, 0)} unit="/100" />
          <Stat label="Max duration" value={fmtNum(m.swingDurMax, m.connected, 0)} unit="ms" />
          <Stat label="Avg duration (10)" value={fmtNum(m.swingDurAvg, m.connected, 0)} unit="ms" />
        </div>
      </Card>

      {/* Reaction + throughput */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card eyebrow="Reaction" title="Fastest direction change">
          <Stat label="Min gap" value={fmtNum(m.reactMin, m.connected, 0)} unit="ms"
                hint={m.reactMin == null && m.connected ? "No direction changes yet" : undefined} />
        </Card>
        <Card eyebrow="Throughput" title="Event rate">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Events / min" value={m.connected ? m.eventsLastMin : "—"} hint="rolling 60s" />
            <Stat label="Total events" value={m.connected ? m.events.length : "—"} hint="this session" />
          </div>
        </Card>
      </div>

      <Card eyebrow="Performance lab" title="Sport performance">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {performanceLab.map((item) => (
            <ActionTile key={item.id} {...item} compact onClick={() => setView(item.id)} />
          ))}
        </div>
      </Card>

      <Card eyebrow="Recovery · Fuel · Team" title="Complete VYRO module stack">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_SPECS.map((spec) => {
            const Icon = spec.icon;
            return (
              <button
                key={spec.id}
                onClick={() => setView(spec.id)}
                className="group flex min-w-0 items-center gap-3 rounded-xl border border-black/[0.06] bg-black/[0.02] p-3 text-left transition-colors hover:border-black/20 hover:bg-black/[0.04]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-black shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-black text-black">{spec.label}</span>
                  <span className="mt-0.5 line-clamp-2 block text-[10px] leading-snug text-black/55">
                    {spec.blurb}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-black/30 group-hover:text-black/65" />
              </button>
            );
          })}
        </div>
      </Card>

      <button
        onClick={() => setView("session")}
        className="w-full rounded-2xl border border-emerald-600/30 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-100"
      >
        Open session console →
      </button>
    </div>
  );
}

type TileTone = "recovery" | "spatial" | "fatigue" | "session" | "coach";

interface ActionTileProps {
  id: ViewId;
  eyebrow: string;
  label: string;
  value: ReactNode;
  hint: string;
  icon: LucideIcon;
  tone: TileTone;
}

function toneClasses(tone: TileTone) {
  if (tone === "recovery") return "bg-vyro-recovery/10 text-vyro-recovery";
  if (tone === "spatial") return "bg-vyro-spatial/10 text-vyro-spatial";
  if (tone === "fatigue") return "bg-vyro-fatigue/10 text-vyro-fatigue";
  if (tone === "session") return "bg-vyro-session/10 text-vyro-session";
  return "bg-vyro-coach/10 text-vyro-coach";
}

function ActionTile({
  eyebrow,
  label,
  value,
  hint,
  icon: Icon,
  tone,
  compact = false,
  onClick,
}: ActionTileProps & { compact?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex min-w-0 flex-col rounded-xl border border-black/[0.07] bg-white p-3 text-left transition-colors hover:border-black/20 hover:bg-black/[0.02]"
    >
      <span className="mb-3 flex min-w-0 items-start justify-between gap-2">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${toneClasses(tone)}`}>
          <Icon className="h-4 w-4" />
        </span>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-black/25 group-hover:text-black/65" />
      </span>
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-black/40">{eyebrow}</span>
      <span className="mt-1 block min-w-0 truncate text-sm font-black text-black">{label}</span>
      <span className="mt-1 block min-w-0 truncate text-lg font-black tabular-nums text-black">{value}</span>
      {!compact && <span className="mt-1 line-clamp-2 text-[11px] leading-snug text-black/55">{hint}</span>}
    </button>
  );
}

function MiniMetric({ label, value, unit }: { label: string; value: ReactNode; unit?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-black/[0.06] bg-black/[0.02] p-3">
      <div className="truncate font-mono text-[9px] uppercase tracking-[0.16em] text-black/45">{label}</div>
      <div className="mt-1 flex min-w-0 items-baseline gap-1">
        <span className="min-w-0 truncate text-lg font-black capitalize tabular-nums text-black">{value}</span>
        {unit && <span className="shrink-0 text-[10px] font-bold text-black/45">{unit}</span>}
      </div>
    </div>
  );
}
