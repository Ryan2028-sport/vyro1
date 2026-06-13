import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Brain,
  ChevronRight,
  Footprints,

  HeartPulse,
  LineChart,
  Moon,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  TrendingUp,
  Utensils,
  
  Zap,
} from "lucide-react";
import { getCoachInsight } from "@/lib/coach-insight.functions";
import { getMyProfile } from "@/lib/profile.functions";
import { Card, EmptyState, Pill, Ring, Stat } from "./shared";
import type { ViewId } from "./Layout";
import { computeReadiness, computeSubScores, recoveryBand, useLiveMetrics } from "./useLiveMetrics";

type Tone = "mint" | "amber" | "rose" | "spatial";

// Top-of-page quick links jump to sections WITHIN the Athlete tab so the
// page doesn't feel like endless scrolling. The bottom tab bar handles
// cross-view navigation (Session / Recovery / Sleep / More).
const QUICK_LINKS: { anchor: string; label: string; icon: LucideIcon }[] = [
  { anchor: "section-vitals", label: "Vitals", icon: HeartPulse },
  { anchor: "section-coach", label: "Coach", icon: Sparkles },
  { anchor: "section-diet", label: "Fuel", icon: Utensils },
  { anchor: "section-court", label: "Court", icon: Target },
  { anchor: "section-plan", label: "Plan", icon: Activity },
  { anchor: "section-trends", label: "Trends", icon: LineChart },
];

function scrollToAnchor(id: string) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}


function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function toneToken(tone: Tone) {
  if (tone === "amber") return "var(--vyro-amber)";
  if (tone === "rose") return "var(--vyro-rose)";
  if (tone === "spatial") return "var(--vyro-spatial)";
  return "var(--vyro-mint)";
}

function toneClasses(tone: Tone) {
  if (tone === "amber") return "border-vyro-amber/30 bg-vyro-amber/10 text-vyro-amber";
  if (tone === "rose") return "border-vyro-rose/30 bg-vyro-rose/10 text-vyro-rose";
  if (tone === "spatial") return "border-vyro-spatial/30 bg-vyro-spatial/10 text-vyro-spatial";
  return "border-vyro-mint/30 bg-vyro-mint/10 text-vyro-mint";
}

function ProgressLine({ value, tone = "mint" }: { value: number; tone?: Tone }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-vyro-line">
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: toneToken(tone) }} />
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  score,
  tone = "mint",
  caption,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  unit?: string;
  score: number;
  tone?: Tone;
  caption: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border ${toneClasses(tone)}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="font-mono text-[10px] font-bold tabular-nums text-vyro-mute">{score}/100</span>
      </div>
      <div className="mt-5">
        <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-mute">{label}</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-3xl font-black tabular-nums tracking-tight text-vyro-text">{value}</span>
          {unit && <span className="text-[11px] font-bold text-vyro-mute">{unit}</span>}
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <ProgressLine value={score} tone={tone} />
        <p className="min-h-8 text-[11px] leading-relaxed text-vyro-mute">{caption}</p>
      </div>
    </>
  );

  const cls = "snap-start rounded-2xl border border-vyro-line bg-vyro-panel p-4 text-left shadow-[0_1px_0_var(--vyro-line)_inset]";
  if (onClick) {
    return (
      <button onClick={onClick} className={`${cls} w-[72vw] shrink-0 sm:w-64`}>
        {content}
      </button>
    );
  }
  return <div className={`${cls} w-[72vw] shrink-0 sm:w-64`}>{content}</div>;
}

function CourtLoadMap({
  agility,
  strain,
  fatigue,
  eventsLastMin,
  peakG,
  connected,
}: {
  agility: number;
  strain: number;
  fatigue: number;
  eventsLastMin: number;
  peakG: number;
  connected: boolean;
}) {
  // Real squash court (top-down, front wall at top, back wall at bottom):
  // 6.4 m wide × 9.75 m long; short line 5.49 m from front wall; service
  // boxes 1.6 m × 1.6 m in the back corners against the short line.
  const X = 8, Y = 8, W = 112, H = 164;
  const shortY = Y + (5.49 / 9.75) * H;
  const halfX = X + W / 2;
  const sbW = (1.6 / 6.4) * W;
  const sbH = (1.6 / 9.75) * H;

  const a = Math.max(0, Math.min(1, agility / 100));
  const s = Math.max(0, Math.min(1, strain / 100));
  const f = Math.max(0, Math.min(1, fatigue / 100));
  const burst = Math.max(0, Math.min(1, (peakG || 0) / 6));
  const tempo = Math.max(0, Math.min(1, (eventsLastMin || 0) / 90));
  const backLeft = Math.min(1, 0.30 + s * 0.55 + f * 0.30);
  const backRight = Math.min(1, 0.18 + s * 0.45 + tempo * 0.25);
  const frontLeft = Math.min(1, 0.16 + a * 0.45 + burst * 0.25);
  const frontRight = Math.min(1, 0.20 + a * 0.55 + tempo * 0.20);
  const tZone = Math.min(1, 0.30 + a * 0.30 + tempo * 0.30);

  const heat = (v: number) => `color-mix(in oklab, var(--vyro-amber) ${Math.round(v * 70)}%, transparent)`;
  const status = backLeft > 0.75 || s > 0.72 ? "high load" : backLeft > 0.55 ? "watch" : "stable";

  return (
    <div className="overflow-hidden rounded-2xl border border-vyro-line bg-vyro-elev">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4">
        <div className="min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-mute">Squash court load</div>
          <h3 className="mt-1 text-base font-black text-vyro-text">Pressure map</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-vyro-mute">
            {connected ? "Live zone heat from band motion." : "Projected zones — connect band for live data."}
          </p>
        </div>
        <Pill tone={status === "stable" ? "live" : "warn"}>{status}</Pill>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-t border-vyro-line p-4">
        <svg viewBox="0 0 128 180" className="block h-72 w-full" role="img" aria-label="Squash court pressure map">
          <rect x={X} y={Y} width={W} height={H} rx="2" fill="var(--vyro-panel)" stroke="var(--vyro-line)" strokeWidth="1.2" />
          <rect x={X} y={Y} width={W / 2} height={shortY - Y} fill={heat(frontLeft)} />
          <rect x={halfX} y={Y} width={W / 2} height={shortY - Y} fill={heat(frontRight)} />
          <rect x={X} y={shortY} width={W / 2} height={Y + H - shortY} fill={heat(backLeft)} />
          <rect x={halfX} y={shortY} width={W / 2} height={Y + H - shortY} fill={heat(backRight)} />
          <circle cx={halfX} cy={shortY} r="14" fill={heat(tZone)} opacity="0.6" />
          <line x1={X} y1={shortY} x2={X + W} y2={shortY} stroke="var(--vyro-text)" strokeOpacity="0.55" strokeWidth="1.4" />
          <line x1={halfX} y1={shortY} x2={halfX} y2={Y + H} stroke="var(--vyro-text)" strokeOpacity="0.55" strokeWidth="1.4" />
          <rect x={X} y={shortY} width={sbW} height={sbH} fill="none" stroke="var(--vyro-text)" strokeOpacity="0.55" strokeWidth="1.2" />
          <rect x={X + W - sbW} y={shortY} width={sbW} height={sbH} fill="none" stroke="var(--vyro-text)" strokeOpacity="0.55" strokeWidth="1.2" />
          <line x1={X} y1={Y} x2={X + W} y2={Y} stroke="var(--vyro-mint)" strokeWidth="2" />
          <circle cx={halfX} cy={shortY} r="2.4" fill="var(--vyro-mint)" />
          <text x={halfX + 4} y={shortY - 4} fill="var(--vyro-text)" fontSize="6" fontWeight="800">T</text>
          <text x={X + W / 2} y={Y - 2} textAnchor="middle" fill="var(--vyro-mute)" fontSize="5" fontFamily="monospace">FRONT WALL</text>
          <text x={X + W / 2} y={Y + H + 6} textAnchor="middle" fill="var(--vyro-mute)" fontSize="5" fontFamily="monospace">BACK WALL</text>
          {backLeft > 0.7 && (
            <>
              <circle cx={X + sbW / 2} cy={shortY + sbH / 2} r="7" fill="var(--vyro-rose)" opacity="0.22" />
              <circle cx={X + sbW / 2} cy={shortY + sbH / 2} r="2.6" fill="var(--vyro-rose)" />
            </>
          )}
        </svg>
        <div className="flex w-24 shrink-0 flex-col gap-2 text-[10px]">
          {[
            ["Back-L", backLeft],
            ["Back-R", backRight],
            ["T zone", tZone],
            ["Front-L", frontLeft],
            ["Front-R", frontRight],
          ].map(([label, v]) => (
            <div key={String(label)} className="space-y-1">
              <div className="flex items-center justify-between font-mono uppercase tracking-[0.14em] text-vyro-mute">
                <span>{label}</span><span>{Math.round(Number(v) * 100)}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-vyro-line">
                <div className="h-full rounded-full" style={{ width: `${Math.round(Number(v) * 100)}%`, background: "var(--vyro-amber)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CoachBrief({
  title,
  body,
  tone = "mint",
  icon: Icon,
}: {
  title: string;
  body: string;
  tone?: Tone;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-vyro-line bg-vyro-elev p-4">
      <div className="flex items-start gap-3">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border ${toneClasses(tone)}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-black text-vyro-text">{title}</div>
          <p className="mt-1 text-[12px] leading-relaxed text-vyro-mute">{body}</p>
        </div>
      </div>
    </div>
  );
}

function VitalTile({
  label,
  value,
  unit,
  delta,
  tone,
  hint,
  live,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  tone: Tone;
  hint?: string;
  live?: boolean;
}) {
  const deltaCls = !delta || delta === "0" ? "text-vyro-mute" : tone === "rose" ? "text-vyro-rose" : tone === "amber" ? "text-vyro-amber" : "text-vyro-mint";
  return (
    <div className="rounded-xl border border-vyro-line bg-vyro-elev p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-mute">{label}</div>
        {live && <Pill tone="live" pulse>live</Pill>}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-xl font-black tabular-nums text-vyro-text">{value}</span>
        {unit && <span className="text-[10px] font-semibold text-vyro-mute">{unit}</span>}
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        {delta && <span className={`font-mono text-[10px] font-bold tabular-nums ${deltaCls}`}>{delta}</span>}
        {hint && <span className="truncate text-[9px] text-vyro-mute">{hint}</span>}
      </div>
    </div>
  );
}



export function HomeView({ setView }: { setView: (v: ViewId) => void }) {
  const fetchProfile = useServerFn(getMyProfile);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const first = (profile?.display_name || "").trim().split(/\s+/)[0] || "Athlete";
  const m = useLiveMetrics();

  const { score: liveReadiness } = computeReadiness({
    connected: m.connected,
    peakJerk: m.peakJerk || null,
  });

  const subs = computeSubScores({
    connected: m.connected,
    peakJerk: m.peakJerk || null,
    peakG: m.peakG || null,
    eventsLastMin: m.eventsLastMin,
    reactMin: m.reactMin,
  });

  const demo = { readiness: 78, recovery: 78, sleep: 87, fatigue: 41, agility: 88, strain: 64 };
  const readiness = liveReadiness ?? demo.readiness;
  const recovery = subs.recovery ?? demo.recovery;
  const sleep = subs.sleep ?? demo.sleep;
  const fatigue = subs.fatigue ?? demo.fatigue;
  const agility = subs.agility ?? demo.agility;
  const liveStrain = m.connected ? Math.round(Math.min(100, m.eventsLastMin * 1.2 + Math.min(42, m.peakJerk / 6))) : null;
  const strain = liveStrain ?? demo.strain;
  const usingDemo = liveReadiness == null && subs.recovery == null && subs.sleep == null && subs.fatigue == null && subs.agility == null;

  const band = recoveryBand(readiness);
  const bandTone = band === "green" ? "live" : band === "red" ? "off" : "warn";
  const statusLabel = band === "green" ? "Primed" : band === "red" ? "Recover" : "Manage";
  const readinessCopy =
    readiness >= 67
      ? "Push court speed, keep back-left decels clean."
      : readiness >= 34
        ? "Build quality without chasing max volume."
        : "Protect tissue, mobility first, hitting light.";
  const todayLabel = new Date().toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

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
    recentSessionLoad: strain,
  };
  const fetchInsight = useServerFn(getCoachInsight);
  const { data: insight, isFetching: insightLoading } = useQuery({
    queryKey: ["coach-insight", coachInput],
    queryFn: () => fetchInsight({ data: coachInput }),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const plan = useMemo(() => {
    if (readiness >= 67) {
      return [
        { title: "Neural warm-up", detail: "6 min skips · banded hips · split-step rhythm", tone: "mint" as Tone },
        { title: "Ghosting intervals", detail: "6×30 s hard · 60 s walk-back recovery", tone: "amber" as Tone },
        { title: "Pressure games", detail: "Front-court hold, then protect back-left corner", tone: "spatial" as Tone },
      ];
    }
    if (readiness >= 34) {
      return [
        { title: "Mobility primer", detail: "Hips, calves, T-spine · stay conversational", tone: "mint" as Tone },
        { title: "Technique blocks", detail: "Rails, boasts, serve-return patterns", tone: "spatial" as Tone },
        { title: "Short finisher", detail: "2×20 s ghosting if HR settles fast", tone: "amber" as Tone },
      ];
    }
    return [
      { title: "Recovery circuit", detail: "Walk, mobility, calf isometrics", tone: "mint" as Tone },
      { title: "Light hit", detail: "No max lunges, no repeated redline rallies", tone: "amber" as Tone },
      { title: "Sleep target", detail: "Move training stress to tomorrow", tone: "rose" as Tone },
    ];
  }, [readiness]);

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden">
      <section className="space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-vyro-mute">{todayLabel}</div>
            <h1 className="mt-1 truncate text-3xl font-black tracking-tight text-vyro-text">{greeting()}, {first}</h1>
            <p className="mt-1.5 text-[12px] leading-relaxed text-vyro-mute">Squash readiness, strain, fuel and recovery in one command view.</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Pill tone={m.connected ? "live" : "off"} pulse={m.connected}>{
              m.connected
                ? (m.heartRateBpm != null
                    ? `${m.heartRateBpm} bpm`
                    : (m.batteryPct != null ? `band ${m.batteryPct}%` : "live"))
                : "offline"
            }</Pill>
            <button
              onClick={() => setView("profile")}
              className="rounded-full border border-vyro-line bg-vyro-panel px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-vyro-text/80 hover:border-vyro-mint/40 hover:text-vyro-mint"
            >
              {m.pairedId ? "Manage band" : "Pair band"}
            </button>
          </div>
        </div>

        <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4">
          {QUICK_LINKS.map(({ anchor, label, icon: Icon }) => (
            <button
              key={anchor}
              onClick={() => scrollToAnchor(anchor)}
              className="inline-flex shrink-0 snap-start items-center gap-2 rounded-full border border-vyro-line bg-vyro-panel px-3.5 py-2 text-[12px] font-bold text-vyro-text/80 hover:border-vyro-mint/40 hover:text-vyro-mint"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </section>

      <section
        className="overflow-hidden rounded-2xl border border-vyro-line bg-vyro-panel shadow-[0_1px_0_var(--vyro-line)_inset]"
        style={{
          background:
            "radial-gradient(circle at 24% 0%, color-mix(in oklab, var(--vyro-mint) 20%, transparent), transparent 36%), linear-gradient(155deg, var(--vyro-panel), var(--vyro-elev))",
        }}
      >
        <div className="p-4 pb-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={bandTone} pulse={band === "green"}>{statusLabel}</Pill>
                {usingDemo && <Pill tone="warn">demo</Pill>}
                <Pill tone={insightLoading ? "warn" : "live"}>{insightLoading ? "AI reading" : "AI coach"}</Pill>
              </div>
              <h2 className="mt-4 text-[30px] font-black leading-[0.95] tracking-tight text-vyro-text">
                {insight?.headline ?? readinessCopy}
              </h2>
              <p className="mt-3 text-[13px] leading-relaxed text-vyro-mute">{readinessCopy}</p>
            </div>
            <button onClick={() => setView("recovery")} className="shrink-0" aria-label="Open recovery">
              <Ring value={readiness} label="Ready" sub="/100" size={122} stroke={9} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-4 border-t border-vyro-line bg-vyro-ink/20">
          {[
            ["Recovery", recovery, "mint" as Tone],
            ["Strain", strain, strain > 72 ? "rose" as Tone : "amber" as Tone],
            ["Sleep", sleep, "spatial" as Tone],
            ["Agility", agility, "mint" as Tone],
          ].map(([label, value, tone]) => (
            <div key={String(label)} className="border-r border-vyro-line p-3 last:border-r-0">
              <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-vyro-mute">{label}</div>
              <div className="mt-1 text-xl font-black tabular-nums text-vyro-text">{value}</div>
              <div className="mt-2">
                <ProgressLine value={Number(value)} tone={tone as Tone} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* What changed — quick delta strip */}
      <section className="grid grid-cols-3 gap-2">
        {[
          { label: "Recovery", delta: "+6", tone: "mint" as Tone },
          { label: "HRV", delta: "+8 ms", tone: "mint" as Tone },
          { label: "Sleep debt", delta: "1h 24m", tone: "amber" as Tone },
        ].map((d) => (
          <div key={d.label} className="rounded-2xl border border-vyro-line bg-vyro-panel p-3">
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-mute">{d.label}</div>
            <div className={`mt-1 text-base font-black tabular-nums ${d.tone === "mint" ? "text-vyro-mint" : "text-vyro-amber"}`}>{d.delta}</div>
          </div>
        ))}
      </section>


      <section className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4">
        <MetricCard
          icon={HeartPulse}
          label="Recovery"
          value={recovery}
          unit="%"
          score={recovery}
          caption="Green enough to absorb sharp change-of-direction work."
          onClick={() => setView("recovery")}
        />
        <MetricCard
          icon={Zap}
          label="Squash strain"
          value={strain}
          unit="load"
          score={strain}
          tone={strain > 72 ? "rose" : "amber"}
          caption={m.connected ? `${m.eventsLastMin} events/min · ${m.peakG.toFixed(1)} g peak acceleration.` : "Projected from recent court workload until the band streams."}
          onClick={() => setView("session")}
        />
        <MetricCard
          icon={Moon}
          label="Sleep"
          value={sleep}
          unit="score"
          score={sleep}
          tone="spatial"
          caption="Enough base for speed work; keep tonight protected."
          onClick={() => setView("sleep")}
        />
        <MetricCard
          icon={Footprints}
          label="Agility"
          value={agility}
          unit="sharp"
          score={agility}
          caption="Split-step timing is trending high for return drills."
          onClick={() => setView("swing")}
        />
      </section>

      {/* Recent session */}
      <Card
        eyebrow="Recent session"
        title={<span className="inline-flex items-center gap-2"><Trophy className="h-4 w-4 text-vyro-mint" /> Match practice vs. Alex K.</span>}
        action={<Pill tone="live">W 3-1</Pill>}
      >
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-vyro-mute">
          <span>Squash</span><span>·</span><span>Yesterday</span><span>·</span><span>47 min</span><span>·</span><span className="text-vyro-amber">load 71</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="T-control" value="78" unit="%" />
          <Stat label="Decel quality" value="82" />
          <Stat label="Recovery cost" value="64" />
        </div>
      </Card>

      {/* Base readiness — 4 stat panel mirroring the brief */}
      <div id="section-trends" className="scroll-mt-24">
      <Card
        eyebrow="Base readiness"
        title="Today's subscores"
        action={<button onClick={() => setView("trends")} className="text-[11px] font-bold text-vyro-mint hover:underline">Trends</button>}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Fatigue", value: fatigue, tone: fatigue > 60 ? "rose" : fatigue > 40 ? "amber" : "mint" },
            { label: "Recovery", value: recovery, tone: "mint" },
            { label: "Agility", value: agility, tone: "mint" },
            { label: "Sleep", value: sleep, tone: "spatial" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-vyro-line bg-vyro-elev p-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-mute">{s.label}</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-black tabular-nums text-vyro-text">{s.value}</span>
                <span className="text-[10px] text-vyro-mute">/100</span>
              </div>
              <div className="mt-2"><ProgressLine value={Number(s.value)} tone={s.tone as Tone} /></div>
            </div>
          ))}
        </div>
      </Card>
      </div>

      {/* Full vitals — Goodix GH3026 + ST 6-axis IMU readout */}
      <div id="section-vitals" className="scroll-mt-24">
      <Card
        eyebrow="Vitals · Goodix GH3026 + ST 6-axis IMU"
        title={<span className="inline-flex items-center gap-2"><HeartPulse className="h-4 w-4 text-vyro-rose" /> Live body signals</span>}
        action={<Pill tone={m.connected ? (m.heartRateBpm != null ? "live" : "warn") : "off"} pulse={m.heartRateBpm != null}>{m.connected ? (m.heartRateBpm != null ? "streaming" : "imu only") : "off"}</Pill>}
      >
        {/* HR + battery tiles populate from standard GATT services on the */}
        {/* connected watch (0x180D Heart Rate, 0x180F Battery). PPG-derived */}
        {/* metrics still need their own characteristics on the band.       */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <VitalTile
            label="Current HR"
            value={m.heartRateBpm != null ? String(m.heartRateBpm) : "—"}
            unit="bpm"
            tone="rose"
            hint={m.heartRateBpm != null ? "live from watch" : "awaiting HR characteristic"}
            live={m.heartRateBpm != null}
          />
          <VitalTile
            label="Resting HR"
            value={m.restingHrBpm != null ? String(m.restingHrBpm) : "—"}
            unit="bpm"
            tone="mint"
            hint={m.restingHrBpm != null ? "5-min rolling baseline" : "needs 5+ min of HR"}
            live={m.restingHrBpm != null}
          />
          <VitalTile
            label="HRV (RMSSD)"
            value={m.hrvMs != null ? String(m.hrvMs) : "—"}
            unit="ms"
            tone="mint"
            hint={m.hrvMs != null ? "60-sec rolling RR-interval" : "needs 60s of HR"}
            live={m.hrvMs != null}
          />
          <VitalTile
            label="Resp. Rate"
            value={m.respRateBrpm != null ? String(m.respRateBrpm) : "—"}
            unit="br/min"
            tone="mint"
            hint={m.respRateBrpm != null ? "HR-derived estimate" : "needs 60s of HR"}
            live={m.respRateBrpm != null}
          />
          <VitalTile
            label="Stress"
            value={m.stressScore != null ? String(m.stressScore) : "—"}
            unit="/100"
            tone="mint"
            hint={m.stressScore != null ? "HR load · HRV" : "needs HR + HRV"}
            live={m.stressScore != null}
          />
          <VitalTile
            label="SpO₂"
            value={m.spo2Pct != null ? String(m.spo2Pct) : "—"}
            unit="%"
            tone="mint"
            hint={m.spo2Pct != null ? "from watch" : "measuring — finger still on watch"}
            live={m.spo2Pct != null}
          />
          <VitalTile
            label="Watch battery"
            value={m.batteryPct != null ? String(m.batteryPct) : "—"}
            unit="%"
            tone="mint"
            hint={
              m.batteryPct != null
                ? m.batteryCharging
                  ? "charging"
                  : "from watch"
                : "awaiting battery service"
            }
          />
          <VitalTile
            label="Peak Accel"
            value={m.connected && m.peakG ? m.peakG.toFixed(2) : "—"}
            unit="g"
            tone="mint"
            hint={m.connected ? `${m.eventsLastMin} events / min` : "needs band"}
            live={m.connected}
          />
        </div>
        <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-mute">
          {m.heartRateBpm != null
            ? "Heart rate streaming from watch (GATT 0x2A37). HRV / SpO₂ / skin-temp require firmware support."
            : "Connected — waiting for the watch to publish its heart-rate characteristic."}
        </p>
      </Card>
      </div>

      {/* Diet coach — daily kcal balance */}
      <div id="section-diet" className="scroll-mt-24">
      <Card
        eyebrow="Diet Coach"
        title={<span className="inline-flex items-center gap-2"><Utensils className="h-4 w-4 text-vyro-amber" /> 2,600 kcal intake goal</span>}
        action={<Pill tone="live">live</Pill>}
      >
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Eaten" value="680" unit="kcal" hint="680 / 2,600" />
          <Stat label="Burn" value="1,842" unit="kcal" hint="active + RMR" />
          <Stat label="Left" value="1,920" unit="kcal" hint="to hit goal" />
        </div>
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-mute">
            <span>Intake</span><span>680 / 2,600</span>
          </div>
          <ProgressLine value={(680 / 2600) * 100} tone="amber" />
        </div>
        <button onClick={() => setView("diet")} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-vyro-amber/30 bg-vyro-amber/10 px-3 py-2 text-[12px] font-bold text-vyro-amber hover:bg-vyro-amber/15">
          <Plus className="h-3.5 w-3.5" /> Log a meal
        </button>
      </Card>
      </div>



      <section id="section-court" className="scroll-mt-24 grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <CourtLoadMap
          agility={agility}
          strain={strain}
          fatigue={fatigue}
          eventsLastMin={m.connected ? m.eventsLastMin : 0}
          peakG={m.connected ? m.peakG : 0}
          connected={m.connected}
        />
        <div id="section-coach" className="scroll-mt-24">
        <Card
          eyebrow="AI coach"
          title={<span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-vyro-mint" /> Today's edge</span>}
          action={<Pill tone={insightLoading ? "warn" : "live"}>{insightLoading ? "thinking" : "live"}</Pill>}
        >
          <div className="space-y-3">
            <CoachBrief
              icon={TrendingUp}
              title="Opportunity"
              body={insight?.opportunity ?? "Agility is peaking — push interval ghosting while keeping rally volume controlled."}
            />
            <CoachBrief
              icon={ShieldCheck}
              title="Protection"
              tone={strain > 72 ? "rose" : "amber"}
              body={insight?.risk ?? "Watch back-left deceleration and calf push-off if fatigue climbs late in the session."}
            />
          </div>
        </Card>
        </div>
      </section>

      <div id="section-plan" className="scroll-mt-24">
      <Card
        eyebrow="Today's plan"
        title="Next best session"
        action={<Pill tone="neutral">Editable</Pill>}
      >
        <div className="space-y-2">
          {plan.map((row, i) => {
            const elevated = row.tone === "rose" || row.tone === "amber";
            return (
              <button key={row.title} onClick={() => setView("session")} className="block w-full text-left">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-vyro-line bg-vyro-elev p-3">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border font-mono text-[10px] font-black ${toneClasses(row.tone)}`}>
                    {`0${i + 1}`}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-black text-vyro-text">{row.title}</div>
                    <div className="truncate text-[11px] text-vyro-mute">{row.detail}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Pill tone="live">Optimal</Pill>
                    <Pill tone={elevated ? "warn" : "neutral"}>Elevated</Pill>
                  </div>
                </div>
              </button>
            );
          })}
          <button onClick={() => setView("session")} className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-vyro-line bg-vyro-elev px-3 py-3 text-[12px] font-bold text-vyro-mute hover:border-vyro-mint/40 hover:text-vyro-mint">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
      </Card>
      </div>


      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card
          eyebrow="Live vitals"
          title={<span className="inline-flex items-center gap-2"><Activity className="h-4 w-4 text-vyro-mint" /> Band stream</span>}
          action={<Pill tone={m.connected ? "live" : "neutral"}>{m.connected ? "1s" : "demo"}</Pill>}
        >
          <div className="grid grid-cols-2 gap-2">
            <Stat label="HR" value={m.connected ? "74" : "—"} unit="bpm" hint="current" />
            <Stat label="HRV" value="76" unit="ms" hint="RMSSD" />
            <Stat label="Peak g" value={m.connected ? m.peakG.toFixed(1) : "—"} unit="g" />
            <Stat label="Reaction" value={m.connected && m.reactMin != null ? m.reactMin.toFixed(0) : "214"} unit="ms" />
          </div>
        </Card>

        <Card
          eyebrow="Fuel"
          title={<span className="inline-flex items-center gap-2"><Utensils className="h-4 w-4 text-vyro-amber" /> Match window</span>}
          action={<button onClick={() => setView("diet")} className="text-[11px] font-bold text-vyro-mint hover:underline">Open</button>}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Carbs" value="42" unit="g" hint="pre-court" />
              <Stat label="Water" value="500" unit="ml" hint="next hour" />
            </div>
            <ProgressLine value={64} tone="amber" />
            <p className="text-[11px] leading-relaxed text-vyro-mute">Add sodium if the session pushes past 45 minutes.</p>
          </div>
        </Card>
      </section>

      <Card
        eyebrow="Return-to-play"
        title={<span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-vyro-amber" /> Clearance signal</span>}
        action={<Pill tone="warn">hold</Pill>}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-mute">
                <span>Video symmetry</span><span>93</span>
              </div>
              <ProgressLine value={93} />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-mute">
                <span>Wearable power</span><span>91</span>
              </div>
              <ProgressLine value={91} tone="amber" />
            </div>
          </div>
          <div className="rounded-2xl border border-vyro-amber/30 bg-vyro-amber/10 p-4 text-center">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-amber">Gap</div>
            <div className="mt-1 text-3xl font-black text-vyro-text">4%</div>
            <div className="text-[10px] text-vyro-mute">needs ≤ 5%</div>
          </div>
        </div>
      </Card>

      <Card
        eyebrow="Cognitive load"
        title={<span className="inline-flex items-center gap-2"><Brain className="h-4 w-4 text-vyro-mint" /> Decision speed</span>}
        action={<Pill tone="warn">watch</Pill>}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
          <div className="rounded-2xl border border-vyro-line bg-vyro-elev p-4 text-center">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-mute">Delay</div>
            <div className="mt-1 text-4xl font-black tabular-nums text-vyro-text">+214</div>
            <div className="text-[10px] font-bold text-vyro-amber">ms</div>
          </div>
          <p className="text-[12px] leading-relaxed text-vyro-mute">Heart looks ready, but reaction timing is above the 200 ms alert line. Keep decisions crisp before volume climbs.</p>
        </div>
      </Card>

      {m.sessionState === "live" && (
        <Card eyebrow="Session" title="Session is live">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Swings" value={m.counts.swing} />
            <Stat label="Events/min" value={m.eventsLastMin} />
            <Stat label="Peak g" value={m.peakG.toFixed(2)} unit="g" />
            <Stat label="Peak jerk" value={m.peakJerk.toFixed(1)} unit="g/s" />
          </div>
          <button onClick={() => setView("session")} className="mt-3 w-full rounded-xl bg-vyro-mint px-4 py-3 text-sm font-bold text-vyro-ink hover:bg-vyro-mint/85">
            Open session console
          </button>
        </Card>
      )}

      {!m.pairedId && (
        <EmptyState
          title="No band paired"
          hint="Pair your VYRO band to stream live HR, motion and recovery."
          action={
            <button onClick={() => setView("profile")} className="rounded-full bg-vyro-mint px-4 py-2 text-xs font-semibold text-vyro-ink hover:bg-vyro-mint/85">
              Pair your band
            </button>
          }
        />
      )}

      <div className="flex items-center justify-center gap-1.5 pt-2 font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-mute">
        <Target className="h-3 w-3" /> VYRO Athlete Intelligence
      </div>
    </div>
  );
}
