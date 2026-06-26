import { useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import type { ViewId } from "./Layout";
import { useVyroBandCtx } from "./VyroBandProvider";
import { computeSubScores, liveRecoveryFromMetrics, useLiveMetrics } from "./useLiveMetrics";
import { Bar, Card, HeroCard, PageHeader, Pill, ScoreRing, Spark } from "./shared";

const DASH = "\u2014";

type MetricStatus = {
  label: string;
  tone: "live" | "off" | "warn" | "neutral";
  pulse?: boolean;
};

type HomeMetric = {
  id: string;
  label: string;
  value: number | null;
  color: "amber" | "teal";
  target: ViewId;
  tab?: string;
};

function useNow(intervalMs = 10_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function ageLabel(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 5) return "now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function metricStatus(
  connected: boolean,
  value: unknown,
  at: number | null | undefined,
  now: number,
  freshMs: number,
): MetricStatus {
  if (!connected) return { label: "no watch", tone: "off" };
  if (value == null) return { label: "waiting", tone: "neutral" };
  if (at == null) return { label: "received", tone: "warn" };
  const age = now - at;
  if (age >= 0 && age <= freshMs) return { label: "live", tone: "live", pulse: true };
  return { label: ageLabel(age), tone: "warn" };
}

function formatNumber(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return DASH;
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatDistanceMeters(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return DASH;
  if (value < 1000) return formatNumber(value, 0);
  return formatNumber(value / 1000, 2);
}

function MetricCard({
  label,
  value,
  unit,
  status,
  muted,
}: {
  label: string;
  value: string;
  unit?: string;
  status: MetricStatus;
  muted?: boolean;
}) {
  return (
    <Card className={muted ? "bg-gray-50/80" : ""}>
      <div className="flex min-h-[92px] flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">{label}</div>
          <Pill tone={status.tone} pulse={status.pulse}>{status.label}</Pill>
        </div>
        <div>
          <div className={`mt-3 text-3xl font-semibold tabular-nums leading-none ${muted ? "text-gray-400" : "text-gray-900"}`}>
            {value}
            {unit && value !== DASH && <span className="ml-1 text-xs text-gray-400">{unit}</span>}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function HomeView({ jump }: { jump: (v: ViewId, tab?: string) => void }) {
  const ctx = useVyroBandCtx();
  const m = useLiveMetrics();
  const now = useNow();

  const recovery = useMemo(() => liveRecoveryFromMetrics(m), [m]);
  const subscores = useMemo(
    () =>
      computeSubScores({
        connected: m.connected,
        hrvMs: m.hrvMs,
        restingHrBpm: m.restingHrBpm,
        stress: m.stressScore,
        peakJerk: m.peakJerk,
        peakG: m.peakG,
        eventsLastMin: m.eventsLastMin,
        reactMin: m.reactMin,
      }),
    [m.connected, m.hrvMs, m.restingHrBpm, m.stressScore, m.peakJerk, m.peakG, m.eventsLastMin, m.reactMin],
  );

  const heroMetrics: HomeMetric[] = [
    { id: "fatigue", label: "Fatigue", value: subscores.fatigue, color: "amber", target: "recovery", tab: "fatigue" },
    { id: "recovery", label: "Recovery", value: recovery.score, color: "teal", target: "recovery", tab: "live" },
    { id: "agility", label: "Agility", value: subscores.agility, color: "teal", target: "sport", tab: "agility" },
    { id: "sleep", label: "Sleep", value: subscores.sleep, color: "teal", target: "sleep", tab: "overall" },
  ];

  const liveSummary = m.connected
    ? m.pairedName || "Band streaming"
    : m.connecting
      ? "Connecting to watch"
      : "Waiting for watch";

  const activeCalories = m.connected ? ctx.caloriesKcal : null;
  const calorieGoal = 2600;
  const caloriePct = activeCalories == null ? 0 : Math.min(100, Math.round((activeCalories / calorieGoal) * 100));

  const vitals = [
    {
      label: "Current HR",
      value: ctx.heartRateBpm,
      display: m.connected ? formatNumber(ctx.heartRateBpm) : DASH,
      unit: "bpm",
      at: ctx.heartRateAt,
      freshMs: 15_000,
    },
    {
      label: "Resting HR",
      value: ctx.restingHrBpm,
      display: m.connected ? formatNumber(ctx.restingHrBpm) : DASH,
      unit: "bpm",
      at: ctx.signalAt.restingHrAt,
      freshMs: 5 * 60_000,
    },
    {
      label: "HRV",
      value: ctx.hrvMs,
      display: m.connected ? formatNumber(ctx.hrvMs) : DASH,
      unit: "ms",
      at: ctx.signalAt.hrvAt,
      freshMs: 20 * 60_000,
    },
    {
      label: "SpO2",
      value: ctx.spo2Pct,
      display: m.connected ? formatNumber(ctx.spo2Pct) : DASH,
      unit: "%",
      at: ctx.signalAt.spo2At,
      freshMs: 20 * 60_000,
    },
    {
      label: "Skin Temp",
      value: ctx.skinTempC,
      display: m.connected ? formatNumber(ctx.skinTempC, 1) : DASH,
      unit: "C",
      at: ctx.signalAt.skinTempAt,
      freshMs: 20 * 60_000,
    },
    {
      label: "Stress",
      value: ctx.stressScore,
      display: m.connected ? formatNumber(ctx.stressScore) : DASH,
      unit: "/100",
      at: ctx.signalAt.stressAt,
      freshMs: 20 * 60_000,
    },
    {
      label: "Battery",
      value: ctx.batteryPct,
      display: m.connected ? formatNumber(ctx.batteryPct) : DASH,
      unit: "%",
      at: ctx.signalAt.batteryAt,
      freshMs: 5 * 60_000,
    },
    {
      label: "Steps",
      value: ctx.stepsToday,
      display: m.connected ? formatNumber(ctx.stepsToday) : DASH,
      at: ctx.signalAt.stepsAt,
      freshMs: 2 * 60_000,
    },
  ];

  const activity = [
    {
      label: "Steps",
      value: ctx.stepsToday,
      display: m.connected ? formatNumber(ctx.stepsToday) : DASH,
      at: ctx.signalAt.stepsAt,
      freshMs: 2 * 60_000,
    },
    {
      label: "Distance",
      value: ctx.distanceM,
      display: m.connected ? formatDistanceMeters(ctx.distanceM) : DASH,
      unit: ctx.distanceM != null && ctx.distanceM >= 1000 ? "km" : "m",
      at: ctx.signalAt.distanceAt,
      freshMs: 2 * 60_000,
    },
    {
      label: "Calories",
      value: ctx.caloriesKcal,
      display: m.connected ? formatNumber(ctx.caloriesKcal) : DASH,
      unit: "kcal",
      at: ctx.signalAt.caloriesAt,
      freshMs: 2 * 60_000,
    },
  ];

  const trendPreview = [
    { label: "Peak G", value: m.connected && m.peakG > 0 ? m.peakG.toFixed(2) : DASH, unit: "g", delta: m.peakG > 0 ? "motion" : "waiting" },
    { label: "Events / min", value: m.connected ? String(m.eventsLastMin) : DASH, unit: "", delta: m.eventsLastMin > 0 ? "live" : "waiting" },
    { label: "Reaction", value: m.connected && m.reactMin != null ? m.reactMin.toFixed(0) : DASH, unit: "ms", delta: m.reactMin != null ? "best" : "waiting" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Good morning, Ryan."
        subtitle={liveSummary}
        action={
          <Pill tone={m.connected ? "live" : m.connecting ? "warn" : "off"} pulse={m.connected}>
            {m.connected ? "live" : m.connecting ? "connecting" : "offline"}
          </Pill>
        }
      />

      <div className="mb-6 grid grid-cols-4 gap-2 place-items-center">
        {heroMetrics.map((metric) => (
          <ScoreRing key={metric.id} metric={metric} onClick={() => jump(metric.target, metric.tab)} />
        ))}
      </div>
      <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500">
        Live vitals
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <HeroCard className="col-span-2">
          <button onClick={() => jump("diet")} className="w-full text-left">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500">Active burn</div>
              <div className="mt-2 text-4xl font-semibold tabular-nums leading-none">
                {formatNumber(activeCalories)}
                {activeCalories != null && (
                  <>
                    <span className="text-gray-400">/</span>{calorieGoal.toLocaleString()}
                  </>
                )}
                <span className="ml-1 text-xs text-gray-400">kcal</span>
              </div>
              <div className="mt-1.5 text-xs text-gray-400">
                {activeCalories == null ? "Waiting for watch activity" : "Watch calories today"}
              </div>
            </div>
            <div className="mt-4">
              <Bar value={caloriePct} color="amber" />
            </div>
          </button>
        </HeroCard>
        {vitals.map((vital) => {
          const status = metricStatus(m.connected, vital.value, vital.at, now, vital.freshMs);
          return (
            <MetricCard
              key={vital.label}
              label={vital.label}
              value={vital.display}
              unit={vital.unit}
              status={status}
              muted={vital.value == null || !m.connected}
            />
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {activity.map((metric) => {
          const status = metricStatus(m.connected, metric.value, metric.at, now, metric.freshMs);
          return (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.display}
              unit={metric.unit}
              status={status}
              muted={metric.value == null || !m.connected}
            />
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500">Return-to-Play</div>
              <h3 className="mt-1 text-lg font-semibold">RTP Validator</h3>
            </div>
            <Pill color="amber">hold</Pill>
          </div>
          <p className="mt-3 text-sm text-gray-500">
            Clearance blocked - video symmetry and wearable power must be within 5% of baseline.
          </p>
          <div className="mt-4 space-y-3">
            <div>Video symmetry <b className="float-right">93/100</b><Bar value={93} /></div>
            <div>Wearable power <b className="float-right">91/100</b><Bar value={91} /></div>
            <div>Clearance gap <b className="float-right">4%</b><Bar value={60} color="amber" /></div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500">Cognitive load</div>
              <h3 className="mt-1 text-lg font-semibold">Cognitive Fatigue Divergence</h3>
            </div>
            <Pill color="red">watch</Pill>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-2xl bg-gray-50/80 p-3"><b>{m.connected && m.reactMin != null ? `${m.reactMin.toFixed(0)}ms` : DASH}</b><br /><span className="text-gray-400">Best reaction</span></div>
            <div className="rounded-2xl bg-gray-50/80 p-3"><b>{m.connected && ctx.heartRateBpm != null ? `${ctx.heartRateBpm} bpm` : DASH}</b><br /><span className="text-gray-400">Heart rate</span></div>
            <div className="rounded-2xl bg-gray-50/80 p-3"><b>{subscores.fatigue != null ? `${subscores.fatigue}/100` : DASH}</b><br /><span className="text-gray-400">Fatigue read</span></div>
          </div>
        </Card>
      </div>
      <button onClick={() => jump("trends")} className="mt-6 w-full text-left">
        <Card className="transition-colors hover:bg-gray-50/50 active:scale-[0.99]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gray-400" />
              <h3 className="font-semibold">Trends</h3>
            </div>
            <span className="text-xs text-gray-400">View all -&gt;</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {trendPreview.map((metric) => (
              <div key={metric.label} className="rounded-xl bg-gray-50/80 p-3">
                <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-gray-400">{metric.label}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{metric.value}<span className="ml-0.5 text-xs text-gray-400">{metric.unit}</span></div>
                <div className="mt-1 text-xs text-emerald-600">{metric.delta}</div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Spark points={[60, 64, 62, 70, 73, 78, 80, 84]} color="#6b7280" />
          </div>
        </Card>
      </button>
    </>
  );
}
