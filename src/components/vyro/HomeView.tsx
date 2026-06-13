import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUpRight,
  Activity,
  Brain,
  ChevronRight,
  Flame,
  HeartPulse,
  ShieldCheck,
  TrendingUp,
  Utensils,
} from "lucide-react";
import { getMyProfile } from "@/lib/profile.functions";
import { getCoachInsight } from "@/lib/coach-insight.functions";
import { Card, EmptyState, Pill, Ring, Stat } from "./shared";
import { computeReadiness, recoveryBand, useLiveMetrics } from "./useLiveMetrics";
import type { ViewId } from "./Layout";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const SHORTCUTS: { id: ViewId; label: string }[] = [
  { id: "recovery", label: "Recovery" },
  { id: "sleep", label: "Sleep" },
  { id: "session", label: "Session" },
  { id: "diet", label: "Diet" },
  { id: "coach", label: "Coach" },
  { id: "trends", label: "Trends" },
];

// Small inline trend chip — green for positive, amber for negative-but-watch
function Chip({
  tone = "good",
  icon: Icon,
  label,
  delta,
}: {
  tone?: "good" | "warn";
  icon: typeof TrendingUp;
  label: string;
  delta: string;
}) {
  const cls =
    tone === "good"
      ? "border-vyro-mint/30 bg-vyro-mint/10 text-vyro-mint"
      : "border-vyro-amber/30 bg-vyro-amber/10 text-vyro-amber";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      <Icon className="h-3 w-3" /> {label} <span className="font-mono opacity-80">{delta}</span>
    </span>
  );
}

// Compact vital tile — used for the vitals grid (HR / HRV / RR / SpO2 etc.)
function Vital({
  label,
  value,
  unit,
  delta,
  hint,
  live = false,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  hint?: string;
  live?: boolean;
}) {
  return (
    <div className="rounded-xl border border-vyro-line bg-vyro-elev p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-mute">{label}</div>
        {live && <Pill tone="live" pulse>LIVE</Pill>}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-black tabular-nums text-vyro-text">{value}</span>
        {unit && <span className="text-[10px] font-semibold text-vyro-mute">{unit}</span>}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        {delta && (
          <span className={`font-mono text-[10px] ${delta.startsWith("-") ? "text-vyro-rose" : delta.startsWith("+") ? "text-vyro-mint" : "text-vyro-mute"}`}>
            {delta}
          </span>
        )}
        {hint && <span className="text-[9px] text-vyro-mute">{hint}</span>}
      </div>
    </div>
  );
}

// Mini ring for the Base-readiness 4-up grid
function MiniRing({ value, label, tone = "mint" }: { value: number | null; label: string; tone?: "mint" | "amber" | "rose" }) {
  const stroke = tone === "amber" ? "var(--vyro-amber)" : tone === "rose" ? "var(--vyro-rose)" : "var(--vyro-mint)";
  const size = 86, sw = 8, r = (size - sw) / 2, c = 2 * Math.PI * r;
  const pct = value == null ? 0 : Math.max(0, Math.min(1, value / 100));
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 block">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--vyro-line)" strokeWidth={sw} fill="none" />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={stroke} strokeWidth={sw} fill="none"
            strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${stroke})` }}
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-base font-black tabular-nums text-vyro-text">{value ?? "—"}</div>
        </div>
      </div>
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-mute">{label}</div>
    </div>
  );
}

function Bar({ label, value, tone = "mint" }: { label: string; value: number; tone?: "mint" | "amber" }) {
  const color = tone === "amber" ? "bg-vyro-amber" : "bg-vyro-mint";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-mute">{label}</span>
        <span className="text-[11px] font-black tabular-nums text-vyro-text">{value}/100</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-vyro-line">
        <div className={`h-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

export function HomeView({ setView }: { setView: (v: ViewId) => void }) {
  const fetchProfile = useServerFn(getMyProfile);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const first = (profile?.display_name || "").trim().split(/\s+/)[0] || "Athlete";

  const m = useLiveMetrics();
  // Compute readiness live from band signals.
  const { score: liveReadiness } = computeReadiness({
    connected: m.connected,
    peakJerk: m.peakJerk || null,
    // hrvMs / restingHrBpm / sleepScore / recoveryScore / stress / spo2
    // will be wired here as soon as the band publishes each characteristic.
  });
  // Until any real signal arrives, fall back to demo numbers so the dashboard
  // is fully populated (matches the VYRO reference). Replaced 1:1 the moment
  // the band streams its first metric.
  const usingDemo = liveReadiness == null;
  const readiness = liveReadiness ?? 78;
  const recovery = liveReadiness ?? 78;
  const sleep = 87;
  const fatigue = 41;
  const agility = 88;
  const band = recoveryBand(readiness);
  const bandTone = band === "green" ? "live" : band === "red" ? "off" : "warn";
  const bandLabel =
    band === "green" ? "READY" : band === "red" ? "NOT READY" : band === "yellow" ? "CAUTION" : "PENDING";

  const todayLabel = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  // Lovable AI coach insight — keyed on the metrics we send so it refreshes
  // as the band's signal set changes. Returns a safe fallback on failure.
  const coachInput = {
    sport: "squash",
    readiness,
    recovery,
    sleepScore: sleep,
    fatigue,
    agility,
    eventsLastMin: m.connected ? m.eventsLastMin : null,
    peakG: m.connected && m.peakG > 0 ? m.peakG : null,
    peakJerk: m.connected && m.peakJerk > 0 ? m.peakJerk : null,
  };
  const fetchInsight = useServerFn(getCoachInsight);
  const { data: insight, isFetching: insightLoading } = useQuery({
    queryKey: ["coach-insight", coachInput],
    queryFn: () => fetchInsight({ data: coachInput }),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });


  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden">
      {/* Header */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-vyro-mute">{todayLabel}</div>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-vyro-text">{greeting()}, {first}.</h1>
        <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-vyro-mute">
          Your daily readiness command center — synced from your VYRO Band.
        </p>
        <div className="mt-3">
          {m.connected
            ? <Pill tone="live" pulse>Band connected · 94%</Pill>
            : <Pill tone="off">Band offline</Pill>}
        </div>
      </div>

      {/* Shortcuts */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {SHORTCUTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setView(s.id)}
            className="shrink-0 rounded-full border border-vyro-line bg-vyro-panel px-3.5 py-1.5 text-xs font-semibold text-vyro-text/80 hover:border-vyro-mint/40 hover:text-vyro-mint"
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* READINESS HERO */}
      <button
        onClick={() => setView("recovery")}
        className="w-full rounded-2xl border border-vyro-line bg-vyro-panel p-4 text-left shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] hover:border-vyro-mint/40"
      >
        <div className="flex items-start gap-4">
          <Ring value={readiness} label="Readiness" sub="/100" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <Pill tone={bandTone} pulse={band === "green"}>{bandLabel}</Pill>
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-mute">
                Recovery {recovery ?? "—"} · Sleep {sleep ?? "—"}
              </span>
            </div>
            <p className="mt-3 text-lg font-black leading-tight text-vyro-text">
              {insight?.headline ??
                (readiness == null
                  ? "Waiting on band signals…"
                  : readiness >= 67 ? "You're ready to train."
                  : readiness >= 34 ? "Train with caution."
                  : "Prioritize recovery.")}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-vyro-mute">
              Readiness is computed live from HRV, resting HR, sleep, stress, SpO₂ and accumulated load as the band reports them.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-vyro-mute">
              Readiness is computed live from HRV, resting HR, sleep, stress, SpO₂ and accumulated load as the band reports them.
            </p>
          </div>
        </div>

        <div className="mt-4 border-t border-vyro-line pt-3">
          <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-mute">What changed</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip icon={TrendingUp} label="Recovery" delta="+6" />
            <Chip icon={TrendingUp} label="HRV" delta="+8 ms" />
            <Chip tone="warn" icon={ArrowUpRight} label="Sleep debt" delta="1h 24m" />
          </div>
        </div>
      </button>

      {/* Top opportunity + risk — generated by Lovable AI from current metrics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card
          eyebrow="Top opportunity"
          title="Push this today"
          action={<Pill tone="live" pulse={insightLoading}>{insightLoading ? "AI" : "AI · live"}</Pill>}
        >
          <p className="text-xs leading-relaxed text-vyro-mute">
            {insight?.opportunity ?? "Once HRV, sleep and load stream from the band, your top opportunity for the day will appear here."}
          </p>
        </Card>
        <Card eyebrow="Top risk" title="Protect against">
          <p className="text-xs leading-relaxed text-vyro-mute">
            {insight?.risk ?? "Risk callouts unlock as soon as the band reports recovery, stress and accumulated load."}
          </p>
        </Card>
      </div>

      {/* Recent session */}
      <Card
        eyebrow="Recent session"
        title="Match practice vs. Alex K."
        action={<Pill tone="live">W 3-1</Pill>}
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-vyro-mute">
          Squash · Yesterday · 47 min · load 71
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="T-control" value="78" unit="%" />
          <Stat label="Decel quality" value="82" />
          <Stat label="Recovery cost" value="64" />
        </div>
        <button
          onClick={() => setView("history")}
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-vyro-mint hover:underline"
        >
          Review session <ChevronRight className="h-3 w-3" />
        </button>
      </Card>

      {/* Base readiness rings */}
      <Card eyebrow="Base readiness" title="System scores">
        <div className="grid grid-cols-4 gap-2">
          <MiniRing value={fatigue} label="Fatigue" tone="amber" />
          <MiniRing value={recovery} label="Recovery" />
          <MiniRing value={agility} label="Agility" />
          <MiniRing value={sleep} label="Sleep" />
        </div>
      </Card>

      {/* Vitals */}
      <Card eyebrow="Vitals — Goodix GH3026 + ST 6-axis IMU" title="Live from band">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Vital label="Resting HR" value="48" unit="bpm" delta="-2" />
          <Vital label="Current HR" value="74" unit="bpm" delta="+2" live hint="updates every second" />
          <Vital label="Resp. Rate" value="14.4" unit="br/min" delta="0" hint="every few minutes" />
          <Vital label="HRV (RMSSD)" value="76" unit="ms" delta="+8" />
          <Vital label="Stress" value="28" unit="/100" delta="-6" hint="every few minutes" />
          <Vital label="SpO₂" value="98" unit="%" delta="0" hint="every few minutes" />
          <Vital label="Skin Temp" value="34" unit="°C" delta="+0.1" hint="every few minutes" />
          <Vital label="Steps" value="11,877" delta="+35" live hint="updates every second" />
        </div>
      </Card>

      {/* Diet coach */}
      <Card
        eyebrow="Diet Coach"
        title={<span className="inline-flex items-center gap-2"><Utensils className="h-4 w-4 text-vyro-mint" /> 2,600 kcal · projected today</span>}
        action={<Pill tone="live" pulse>LIVE</Pill>}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Eaten" value="680" unit="/ 2,600" />
          <Stat label="Burn" value="1,842" unit="kcal" />
          <Stat label="Goal" value="2,600" unit="kcal" />
          <Stat label="Left" value="1,920" unit="kcal" />
        </div>
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-vyro-line">
            <div className="h-full bg-vyro-mint" style={{ width: `${(680 / 2600) * 100}%` }} />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-mute">
            <span>26% of intake goal</span>
            <button onClick={() => setView("diet")} className="text-vyro-mint">Open diet →</button>
          </div>
        </div>
      </Card>

      {/* Return-to-Play Validator */}
      <Card
        eyebrow="Return-to-Play"
        title={<span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-vyro-amber" /> RTP Validator</span>}
        action={<Pill tone="warn">Hold</Pill>}
      >
        <p className="text-xs leading-relaxed text-vyro-mute">
          Full clearance is blocked until wearable power and AI Video symmetry are both within
          <span className="font-semibold text-vyro-text"> 5% </span> of your pre-injury baseline.
        </p>
        <div className="mt-3 space-y-3">
          <div>
            <Bar label="Video symmetry" value={93} />
            <div className="mt-1 text-[10px] text-vyro-mute">Joint mechanics vs. baseline</div>
          </div>
          <div>
            <Bar label="Wearable power" value={91} />
            <div className="mt-1 text-[10px] text-vyro-mute">IMU force signature vs. baseline</div>
          </div>
          <div className="rounded-xl border border-vyro-amber/30 bg-vyro-amber/10 p-3">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-amber">Clearance gap</div>
            <div className="mt-0.5 text-base font-black text-vyro-text">4%</div>
            <div className="text-[10px] text-vyro-mute">Needs ≤ 5% variance</div>
          </div>
        </div>
      </Card>

      {/* Cognitive Fatigue Divergence */}
      <Card
        eyebrow="Cognitive load"
        title={<span className="inline-flex items-center gap-2"><Brain className="h-4 w-4 text-vyro-mint" /> Cognitive Fatigue Divergence</span>}
        action={<Pill tone="warn">Watch</Pill>}
      >
        <p className="text-xs leading-relaxed text-vyro-mute">
          Detects when your brain is tired before your body is by comparing video reaction cues against first wearable burst.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Stat label="Decision-to-movement delay" value="+214" unit="ms" />
          <Stat label="Heart rate status" value="Normal" />
          <Stat label="VYRO read" value="Cognitively fried" />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-vyro-mute">
          Heart looks ready, but reaction timing has slowed past the 200 ms alert line.
          Best use case: goalies, batters, returners, late-game decision makers.
        </p>
      </Card>

      {/* Today's plan */}
      <Card
        eyebrow="Today's plan"
        title="Editable"
        action={<button onClick={() => setView("session")} className="text-[11px] font-semibold text-vyro-mint hover:underline">Edit →</button>}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { name: "Warm-up · mobility", load: "Optimal" },
            { name: "Ghosting · 6×30s", load: "Elevated" },
            { name: "Match practice", load: "Elevated" },
          ].map((row) => (
            <div key={row.name} className="rounded-xl border border-vyro-line bg-vyro-elev p-3">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-vyro-mint" />
                <span className="text-xs font-bold text-vyro-text">{row.name}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Pill tone={row.load === "Optimal" ? "live" : "warn"}>{row.load}</Pill>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setView("session")}
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-vyro-mint hover:underline"
        >
          <Flame className="h-3 w-3" /> Add session
        </button>
      </Card>

      {/* Live session CTA when band is active */}
      {m.sessionState === "live" && (
        <Card eyebrow="Session" title="Session is live">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Swings" value={m.counts.swing} />
            <Stat label="Events/min" value={m.eventsLastMin} />
            <Stat label="Peak g" value={m.peakG.toFixed(2)} unit="g" />
            <Stat label="Peak jerk" value={m.peakJerk.toFixed(1)} unit="g/s" />
          </div>
          <button
            onClick={() => setView("session")}
            className="mt-3 w-full rounded-xl bg-vyro-mint px-4 py-3 text-sm font-bold text-vyro-ink hover:bg-vyro-mint/85"
          >
            Open session console →
          </button>
        </Card>
      )}

      {!m.pairedId && (
        <EmptyState
          title="No band paired"
          hint="Pair your VYRO band to stream live HR, motion and recovery."
          action={
            <button
              onClick={() => setView("profile")}
              className="rounded-full bg-vyro-mint px-4 py-2 text-xs font-semibold text-vyro-ink hover:bg-vyro-mint/85"
            >
              Pair your band
            </button>
          }
        />
      )}

      {/* Footer hint */}
      <div className="flex items-center justify-center gap-1.5 pt-2 font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-mute">
        <HeartPulse className="h-3 w-3" /> VYRO Athlete Intelligence
      </div>
    </div>
  );
}
