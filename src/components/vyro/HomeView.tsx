import { heroMetrics, type ViewId } from "@/lib/vyro-data";
import { Bar, Card, PageHeader, Pill, ScoreRing } from "./shared";
import { LiveMetrics } from "./LiveMetrics";
import { useVyroBandCtx } from "./VyroBandProvider";
import { useMemo } from "react";

function maxOf<T>(arr: T[], pick: (t: T) => number | undefined): number {
  let m = 0;
  for (const x of arr) {
    const v = pick(x);
    if (typeof v === "number" && v > m) m = v;
  }
  return m;
}

export function HomeView({ jump }: { jump: (v: ViewId, tab?: string) => void }) {
  const { events, connected, sessionState } = useVyroBandCtx();

  // Real IMU-derived metrics computed from the live event stream.
  const peaks = useMemo(() => {
    const evs = events.map((e) => e.event);
    return {
      accelG: maxOf(evs, (e) => (e as any).accelPeakG?.value),
      gyroDps: maxOf(evs, (e) => (e as any).gyroPeakDps?.value),
      jerkGps: maxOf(evs, (e) => (e as any).jerkPeakGps?.value),
      maxIntensity: maxOf(evs, (e) => (e.type === "swing" ? e.intensity : 0)),
      maxSwingDurMs: maxOf(evs, (e) => (e.type === "swing" ? e.durationMs : 0)),
      minGapMs: (() => {
        let m = Infinity;
        for (const e of evs)
          if (e.type === "direction_change" && e.gapMs > 0 && e.gapMs < m) m = e.gapMs;
        return Number.isFinite(m) ? m : 0;
      })(),
      total: evs.length,
    };
  }, [events]);

  const liveLabel = connected
    ? sessionState === "live"
      ? "LIVE"
      : "READY"
    : "OFFLINE";

  // Only metrics the firmware actually emits (per packets.ts).
  const liveVitals: [string, string, string, string][] = [
    ["Peak Accel", peaks.accelG ? peaks.accelG.toFixed(2) : "—", "g", liveLabel],
    ["Peak Gyro", peaks.gyroDps ? peaks.gyroDps.toFixed(0) : "—", "dps", liveLabel],
    ["Peak Jerk", peaks.jerkGps ? peaks.jerkGps.toFixed(0) : "—", "g/s", liveLabel],
    ["Max Swing", peaks.maxIntensity ? `${peaks.maxIntensity}` : "—", "/100", "intensity"],
    ["Swing Dur", peaks.maxSwingDurMs ? `${peaks.maxSwingDurMs}` : "—", "ms", "longest"],
    ["Reaction", peaks.minGapMs ? `${peaks.minGapMs}` : "—", "ms", "fastest Δ"],
    ["Events", `${peaks.total}`, "", "session total"],
  ];

  return (
    <>
      <PageHeader
        eyebrow="Athlete Dashboard"
        title="Good morning, Ryan."
        subtitle="Tactical performance intelligence streamed live from your VYRO band IMU."
      />

      <div className="mb-4">
        <LiveMetrics />
      </div>

      <div className="mb-4 grid grid-cols-4 gap-3">
        {heroMetrics.map((m) => (
          <ScoreRing key={m.id} metric={m} onClick={() => jump(m.target, m.tab)} />
        ))}
      </div>
      <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
        Motion metrics · live from the VYRO band IMU
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card className="col-span-2">
          <button onClick={() => jump("diet")} className="w-full text-left">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">Diet Coach</div>
                <div className="mt-2 text-4xl font-black tabular-nums">
                  2,600<span className="ml-1 text-xs text-white/45">kcal</span>
                </div>
                <div className="mt-1 text-xs text-white/45">Intake goal · projected today</div>
              </div>
              <Pill color="amber">manual</Pill>
            </div>
            <div className="mt-4">
              <Bar value={26} />
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[10px]">
              <div><b>—</b><br /><span className="text-white/45">Burn</span></div>
              <div><b>680</b><br /><span className="text-white/45">Eaten</span></div>
              <div><b>2,600</b><br /><span className="text-white/45">Goal</span></div>
              <div><b>1,920</b><br /><span className="text-white/45">Left</span></div>
            </div>
          </button>
        </Card>
        {liveVitals.map((v) => (
          <Card key={v[0]}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">{v[0]}</div>
                <div className="mt-2 text-3xl font-black tabular-nums">
                  {v[1]}
                  <span className="ml-1 text-xs text-white/45">{v[2]}</span>
                </div>
                <div className={`mt-1 text-xs ${v[3] === "LIVE" ? "text-[#ff2b2b]" : "text-white/45"}`}>{v[3]}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
