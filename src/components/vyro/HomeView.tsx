import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ChevronRight,
  Footprints,
  HeartPulse,
  LineChart,
  Moon,
  Plus,
  Sparkles,
  Target,
  Utensils,
  Zap,
} from "lucide-react";
import { getCoachInsight } from "@/lib/coach-insight.functions";
import { getMyProfile } from "@/lib/profile.functions";
import { Card, EmptyState, Pill, Ring, Stat } from "./shared";
import type { ViewId } from "./Layout";
import { computeReadiness, computeSubScores, recoveryBand, useLiveMetrics } from "./useLiveMetrics";

type Tone = "mint" | "amber" | "rose" | "spatial";

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
  score: number | null;
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
        <span className="font-mono text-[10px] font-bold tabular-nums text-vyro-mute">{score == null ? "—" : `${score}/100`}</span>
      </div>
      <div className="mt-5">
        <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-mute">{label}</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-3xl font-black tabular-nums tracking-tight text-vyro-text">{value}</span>
          {unit && <span className="text-[11px] font-bold text-vyro-mute">{unit}</span>}
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <ProgressLine value={score ?? 0} tone={tone} />
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

function VitalTile({
  label,
  value,
  unit,
  tone,
  hint,
  live,
}: {
  label: string;
  value: string;
  unit?: string;
  tone: Tone;
  hint?: string;
  live?: boolean;
}) {
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
      {hint && (
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-[9px] text-vyro-mute">{hint}</span>
        </div>
      )}
      {!hint && <div className="mt-0.5 h-2" />}
    </div>
  );
}

export function HomeView({ setView }: { setView: (v: ViewId) => void }) {
  const fetchProfile = useServerFn(getMyProfile);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const first = (profile?.display_name || "").trim().split(/\s+/)[0] || "Athlete";
  const m = useLiveMetrics();

  // STRICT: every score is null until the band actually reports the signal
  // that drives it. No demo fallbacks anywhere. Cards stay visible and
  // render "—" when their underlying score is null.
  const { score: liveReadiness } = computeReadiness({
    connected: m.connected,
    hrvMs: m.hrvMs,
    restingHrBpm: m.restingHrBpm,
    stress: m.stressScore,
    spo2: m.spo2Pct,
    peakJerk: m.peakJerk || null,
  });

  const subs = computeSubScores({
    connected: m.connected,
    hrvMs: m.hrvMs,
    restingHrBpm: m.restingHrBpm,
    stress: m.stressScore,
    peakJerk: m.peakJerk || null,
    peakG: m.peakG || null,
    eventsLastMin: m.eventsLastMin,
    reactMin: m.reactMin,
  });

  const readiness = liveReadiness;
  const recovery = subs.recovery;
  const sleep = subs.sleep;
  const fatigue = subs.fatigue;
  const agility = subs.agility;

  const strain = m.connected
    ? Math.round(Math.min(100, m.eventsLastMin * 1.2 + Math.min(42, m.peakJerk / 6)))
    : null;

  const band = recoveryBand(readiness);
  const bandTone = band === "green" ? "live" : band === "red" ? "off" : band === "yellow" ? "warn" : "neutral";
  const statusLabel =
    readiness == null ? "No signal" : band === "green" ? "Primed" : band === "red" ? "Recover" : "Manage";
  const readinessCopy =
    readiness == null
      ? "Pair and wear the VYRO band to compute readiness from real cardio + IMU signal."
      : readiness >= 67
        ? "Push court speed, keep back-left decels clean."
        : readiness >= 34
          ? "Build quality without chasing max volume."
          : "Protect tissue, mobility first, hitting light.";
  const todayLabel = new Date().toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

  // AI coach insight only runs when we have at least one real subscore.
  const coachInput = readiness != null ? {
    sport: "squash",
    readiness,
    recovery: recovery ?? 0,
    sleepScore: sleep ?? 0,
    fatigue: fatigue ?? 0,
    agility: agility ?? 0,
    eventsLastMin: m.connected ? m.eventsLastMin : null,
    peakG: m.connected && m.peakG > 0 ? m.peakG : null,
    peakJerk: m.connected && m.peakJerk > 0 ? m.peakJerk : null,
    recentSessionLoad: strain,
  } : null;
  const fetchInsight = useServerFn(getCoachInsight);
  const { data: insight, isFetching: insightLoading } = useQuery({
    queryKey: ["coach-insight", coachInput],
    queryFn: () => fetchInsight({ data: coachInput! }),
    enabled: coachInput != null,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const plan = useMemo(() => {
    if (readiness == null) return null;
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

  const fmt = (v: number | null | undefined) => (v == null ? "—" : String(v));

  return (
    <div className="min-w-0 space-y-5">
      <section className="space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-vyro-mute">{todayLabel}</div>
            <h1 className="mt-1 break-words text-3xl font-black tracking-tight text-vyro-text">{greeting()}, {first}</h1>
            <p className="mt-1.5 text-[12px] leading-relaxed text-vyro-mute">Live readiness, strain, fuel and recovery from your VYRO band.</p>
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
                <Pill tone={insightLoading ? "warn" : coachInput ? "live" : "off"}>
                  {insightLoading ? "AI reading" : coachInput ? "AI coach" : "AI idle"}
                </Pill>
              </div>
              <h2 className="mt-4 text-[30px] font-black leading-[0.95] tracking-tight text-vyro-text">
                {insight?.headline ?? readinessCopy}
              </h2>
              {insight?.headline && (
                <p className="mt-3 text-[13px] leading-relaxed text-vyro-mute">{readinessCopy}</p>
              )}
            </div>
            <button onClick={() => setView("recovery")} className="shrink-0" aria-label="Open recovery">
              <Ring value={readiness} label="Ready" sub="/100" size={122} stroke={9} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-4 border-t border-vyro-line bg-vyro-ink/20">
          {[
            ["Recovery", recovery, "mint" as Tone],
            ["Strain", strain, (strain ?? 0) > 72 ? "rose" as Tone : "amber" as Tone],
            ["Sleep", sleep, "spatial" as Tone],
            ["Agility", agility, "mint" as Tone],
          ].map(([label, value, tone]) => (
            <div key={String(label)} className="border-r border-vyro-line p-3 last:border-r-0">
              <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-vyro-mute">{label}</div>
              <div className="mt-1 text-xl font-black tabular-nums text-vyro-text">{value == null ? "—" : String(value)}</div>
              <div className="mt-2">
                <ProgressLine value={Number(value) || 0} tone={tone as Tone} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4">
        <MetricCard
          icon={HeartPulse}
          label="Recovery"
          value={recovery ?? "—"}
          unit={recovery == null ? undefined : "%"}
          score={recovery}
          caption={recovery == null ? "Needs HRV + resting HR from the band." : "Composite of HRV, resting HR and stress."}
          onClick={() => setView("recovery")}
        />
        <MetricCard
          icon={Zap}
          label="Squash strain"
          value={strain ?? "—"}
          unit={strain == null ? undefined : "load"}
          score={strain}
          tone={(strain ?? 0) > 72 ? "rose" : "amber"}
          caption={m.connected ? `${m.eventsLastMin} events/min · ${m.peakG.toFixed(1)} g peak.` : "Pair the band to stream live IMU load."}
          onClick={() => setView("session")}
        />
        <MetricCard
          icon={Moon}
          label="Sleep"
          value={sleep ?? "—"}
          unit={sleep == null ? undefined : "score"}
          score={sleep}
          tone="spatial"
          caption={sleep == null ? "No overnight HR/HRV/temp recorded yet." : "Derived from overnight cardiac + thermal stability."}
          onClick={() => setView("sleep")}
        />
        <MetricCard
          icon={Footprints}
          label="Agility"
          value={agility ?? "—"}
          unit={agility == null ? undefined : "sharp"}
          score={agility}
          caption={agility == null ? "Needs IMU peak g + direction-change reaction." : "From peak g + reaction window."}
          onClick={() => setView("swing")}
        />
      </section>

      {/* Base readiness — 4 stat panel */}
      <div id="section-trends" className="scroll-mt-24">
        <Card
          eyebrow="Base readiness"
          title="Today's subscores"
          action={<button onClick={() => setView("trends")} className="text-[11px] font-bold text-vyro-mint hover:underline">Trends</button>}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Fatigue", value: fatigue, tone: (fatigue ?? 0) > 60 ? "rose" : (fatigue ?? 0) > 40 ? "amber" : "mint" },
              { label: "Recovery", value: recovery, tone: "mint" },
              { label: "Agility", value: agility, tone: "mint" },
              { label: "Sleep", value: sleep, tone: "spatial" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-vyro-line bg-vyro-elev p-3">
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-mute">{s.label}</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-black tabular-nums text-vyro-text">{s.value ?? "—"}</span>
                  <span className="text-[10px] text-vyro-mute">/100</span>
                </div>
                <div className="mt-2"><ProgressLine value={Number(s.value) || 0} tone={s.tone as Tone} /></div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Full vitals — direct from band characteristics */}
      <div id="section-vitals" className="scroll-mt-24">
        <Card
          eyebrow="Vitals · band stream"
          title={<span className="inline-flex items-center gap-2"><HeartPulse className="h-4 w-4 text-vyro-rose" /> Live body signals</span>}
          action={<Pill tone={m.connected ? (m.heartRateBpm != null ? "live" : "warn") : "off"} pulse={m.heartRateBpm != null}>{m.connected ? (m.heartRateBpm != null ? "streaming" : "imu only") : "off"}</Pill>}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <VitalTile label="Current HR" value={fmt(m.heartRateBpm)} unit="bpm" tone="rose" hint={m.heartRateBpm != null ? "live from band" : "awaiting HR"} live={m.heartRateBpm != null} />
            <VitalTile label="Resting HR" value={fmt(m.restingHrBpm)} unit="bpm" tone="mint" hint={m.restingHrBpm != null ? "rolling baseline" : "needs 5+ min of HR"} live={m.restingHrBpm != null} />
            <VitalTile label="HRV (RMSSD)" value={fmt(m.hrvMs)} unit="ms" tone="mint" hint={m.hrvMs != null ? "from band" : "next cycle ≤ 5 min"} live={m.hrvMs != null} />
            <VitalTile label="Stress" value={fmt(m.stressScore)} unit="/100" tone="mint" hint={m.stressScore != null ? "from one-key" : "next ≤ 5 min"} live={m.stressScore != null} />
            <VitalTile label="SpO₂" value={fmt(m.spo2Pct)} unit="%" tone="mint" hint={m.spo2Pct != null ? "from band" : "measuring"} live={m.spo2Pct != null} />
            <VitalTile label="Skin Temp" value={m.skinTempC != null ? m.skinTempC.toFixed(1) : "—"} unit="°C" tone="mint" hint={m.skinTempC != null ? "from band" : "next cycle ≤ 5 min"} live={m.skinTempC != null} />
            <VitalTile label="Steps" value={m.stepsToday != null ? m.stepsToday.toLocaleString() : "—"} tone="mint" hint={m.stepsToday != null ? `${((m.distanceM ?? 0) / 1000).toFixed(2)} km · ${m.caloriesKcal ?? 0} kcal` : "polling 30 s"} live={m.stepsToday != null} />
            <VitalTile label="Battery" value={fmt(m.batteryPct)} unit="%" tone="mint" hint={m.batteryPct != null ? (m.batteryCharging ? "charging" : "from band") : "awaiting"} live={m.batteryPct != null} />
          </div>
          <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-mute">
            {m.heartRateBpm != null
              ? "HR + steps + battery stream continuously. HRV / Stress / SpO₂ / Skin-Temp cycle every 5 min."
              : m.connected
                ? "Connected — waiting for the band to publish heart rate."
                : "Band offline — pair to populate every tile above."}
          </p>
        </Card>
      </div>

      {/* Diet snippet — only real burn from band */}
      <div id="section-diet" className="scroll-mt-24">
        <Card
          eyebrow="Fuel"
          title={<span className="inline-flex items-center gap-2"><Utensils className="h-4 w-4 text-vyro-amber" /> Calorie balance</span>}
          action={<Pill tone={m.caloriesKcal != null ? "live" : "off"}>{m.caloriesKcal != null ? "live" : "no data"}</Pill>}
        >
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Burn" value={m.caloriesKcal ?? "—"} unit="kcal" hint={m.caloriesKcal != null ? "from band" : "needs band"} />
            <Stat label="Eaten" value="—" unit="kcal" hint="log meals →" />
            <Stat label="Goal" value="—" unit="kcal" hint="set in Fuel" />
          </div>
          <button onClick={() => setView("diet")} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-vyro-amber/30 bg-vyro-amber/10 px-3 py-2 text-[12px] font-bold text-vyro-amber hover:bg-vyro-amber/15">
            <Plus className="h-3.5 w-3.5" /> Log a meal
          </button>
        </Card>
      </div>

      {/* Coach + court row */}
      <section id="section-court" className="scroll-mt-24 grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <Card eyebrow="Court load" title="Pressure map">
          {m.connected ? (
            <div className="space-y-3">
              <p className="text-[12px] text-vyro-mute">
                Live court-zone heat requires positional tracking the firmware doesn't yet emit. The Sport tab shows the real per-packet load instead.
              </p>
              <button onClick={() => setView("sport")} className="inline-flex items-center gap-1 rounded-xl border border-vyro-line bg-vyro-elev px-3 py-2 text-[12px] font-bold text-vyro-text hover:border-vyro-mint/40 hover:text-vyro-mint">
                Open Sport view <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <EmptyState title="Band offline" hint="Pair and wear the band to derive on-court load from the IMU stream." />
          )}
        </Card>

        <div id="section-coach" className="scroll-mt-24">
          <Card
            eyebrow="AI coach"
            title={<span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-vyro-mint" /> Today's edge</span>}
            action={<Pill tone={insightLoading ? "warn" : coachInput ? "live" : "off"}>{insightLoading ? "thinking" : coachInput ? "live" : "idle"}</Pill>}
          >
            {coachInput == null ? (
              <EmptyState title="No signal" hint="The AI coach activates as soon as the band produces at least one readiness subscore." />
            ) : (
              <div className="space-y-3">
                {insight?.opportunity && <CoachBrief title="Opportunity" body={insight.opportunity} tone="mint" />}
                {insight?.risk && <CoachBrief title="Protection" body={insight.risk} tone="amber" />}
                {!insight && <p className="text-[12px] text-vyro-mute">Computing your daily edge…</p>}
              </div>
            )}
          </Card>
        </div>
      </section>

      <div id="section-plan" className="scroll-mt-24">
        <Card eyebrow="Today's plan" title="Next best session" action={<Pill tone="neutral">Editable</Pill>}>
          {plan == null ? (
            <EmptyState title="Need readiness" hint="Pair the band so we can pick a session matched to your real readiness." />
          ) : (
            <div className="space-y-2">
              {plan.map((row, i) => (
                <button key={row.title} onClick={() => setView("session")} className="block w-full text-left">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-vyro-line bg-vyro-elev p-3">
                    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border font-mono text-[10px] font-black ${toneClasses(row.tone)}`}>
                      {`0${i + 1}`}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-black text-vyro-text">{row.title}</div>
                      <div className="truncate text-[11px] text-vyro-mute">{row.detail}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

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

function CoachBrief({ title, body, tone = "mint" }: { title: string; body: string; tone?: Tone }) {
  return (
    <div className="rounded-2xl border border-vyro-line bg-vyro-elev p-4">
      <div className="flex items-start gap-3">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border ${toneClasses(tone)}`}>
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-black text-vyro-text">{title}</div>
          <p className="mt-1 text-[12px] leading-relaxed text-vyro-mute">{body}</p>
        </div>
      </div>
    </div>
  );
}
