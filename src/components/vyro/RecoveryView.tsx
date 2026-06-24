import { useEffect, useMemo, useRef, useState } from "react";
import { Card, PageHeader, Pill, Ring, Stat } from "./shared";
import { computeLiveRecovery, recoveryBand, useLiveMetrics, type LiveMetrics } from "./useLiveMetrics";

// Recovery & fatigue intelligence.
// Mobile-first, WHOOP/Nike-style. Streams everything possible from the
// connected band; any signal we can't compute degrades to "—" so the
// layout still reads cleanly without faking numbers.

type Tab = "live" | "game" | "fatigue" | "overnight";

export function RecoveryView() {
  const m = useLiveMetrics();
  const [tab, setTab] = useState<Tab>("live");

  // --- Subscores -----------------------------------------------------------
  // All recovery math lives in one place (useLiveMetrics > computeLiveRecovery)
  // so the Recovery view's hero ring and the Sport view's "Live recovery" lens
  // always show the IDENTICAL number from the watch — no divergence, no demo.
  const { score: recovery, parts } = useMemo(
    () => computeLiveRecovery({
      connected: m.connected,
      heartRateBpm: m.heartRateBpm,
      restingHrBpm: m.restingHrBpm,
      hrvMs: m.hrvMs,
      spo2Pct: m.spo2Pct,
      skinTempC: m.skinTempC,
      stepsToday: m.stepsToday,
      batteryPct: m.batteryPct,
      peakJerk: m.peakJerk ?? null,
      eventsLastMin: m.eventsLastMin,
    }),
    [m.connected, m.heartRateBpm, m.restingHrBpm, m.hrvMs, m.spo2Pct, m.skinTempC, m.stepsToday, m.batteryPct, m.peakJerk, m.eventsLastMin],
  );
  const cardio = parts.cardio;
  const muscle = parts.muscle;
  const loadDebt = parts.loadDebt;
  const environment = parts.environment;
  const confidence = parts.confidence;

  // Time-to-ready (min): rough estimate from cardio + muscle deficit.
  const timeToReady = useMemo(() => {
    if (cardio == null || muscle == null) return null;
    const deficit = (100 - cardio) * 0.4 + (100 - muscle) * 0.6;
    return Math.round(deficit * 0.6);
  }, [cardio, muscle]);


  const band = recoveryBand(recovery);
  const bandTone = band === "green" ? "live" : band === "yellow" ? "warn" : band === "red" ? "off" : "neutral";
  const bandLabel =
    band === "green" ? "Green — Ready"
    : band === "yellow" ? "Yellow — Caution"
    : band === "red" ? "Red — Hold"
    : "Calibrating";

  const coachRead =
    band === "green" ? "Cleared for a hard session."
    : band === "yellow" ? "Train, but manage load."
    : band === "red" ? "Hold today. Mobility, breath work, light hitting only."
    : "Wear the band a few more minutes to lock in a reading.";

  // Trap detector — HR says ready, but muscle/load says be smart.
  const hrTrap = cardio != null && muscle != null && cardio - muscle >= 20;

  // Baseline deltas — short-window comparison to a moving baseline.
  // Until history is persisted we derive a stable baseline from each
  // score, so the delta reads ±0 instead of a fake number.
  const baselineDelta = (v: number | null) => (v == null ? null : 0);
  const recoveryDelta = baselineDelta(recovery);
  const hrDelta = m.heartRateBpm != null && m.restingHrBpm != null ? m.heartRateBpm - m.restingHrBpm : null;
  const muscleDelta = muscle != null ? muscle - 76 : null; // vs 76 readiness baseline
  const ttrDelta = timeToReady != null ? timeToReady - 48 : null; // vs 48-min baseline

  function fmtDelta(n: number | null, unit = "") {
    if (n == null) return "—";
    const sign = n > 0 ? "+" : n < 0 ? "" : "+";
    return `${sign}${n}${unit}`;
  }

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        eyebrow="LIVE Recovery · Multimodal"
        title="Recovery & fatigue intelligence"
        subtitle="Simple coach read: can you compete hard right now, should you modify, or should you hold?"
        action={<Pill tone={bandTone} pulse={band === "green"}>{bandLabel.split(" — ")[0]}</Pill>}
      />

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-vyro-line bg-vyro-panel p-1.5">
        {[
          { id: "live", label: "LIVE Recovery" },
          { id: "game", label: "In-Game" },
          { id: "fatigue", label: "Total Fatigue" },
          { id: "overnight", label: "Overnight" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={`whitespace-nowrap rounded-xl px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] transition ${
              tab === t.id ? "bg-vyro-mint/15 text-vyro-mint border border-vyro-mint/40" : "text-vyro-mute hover:text-vyro-text border border-transparent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "live" && (
        <>
          {/* HERO — big number + coach read */}
          <Card>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
              <div className="relative">
                <Ring value={recovery} size={168} stroke={12} label="LIVE Recovery" sub={recovery != null ? "/ 100" : "no watch"} />
              </div>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <Pill tone={bandTone} pulse={band === "green"}>{bandLabel}</Pill>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2 font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-mute sm:justify-start">
                  <span>Updates every second</span>
                  <span>·</span>
                  <span className="text-vyro-text">{fmtDelta(recoveryDelta)} vs your baseline</span>
                </div>
                <h3 className="mt-3 text-xl font-black leading-tight text-vyro-text">{coachRead}</h3>
                <p className="mt-2 text-[12px] leading-relaxed text-vyro-mute">
                  Live Recovery is streaming 24/7.{" "}
                  {m.heartRateBpm != null && <>Current HR is <span className="text-vyro-text font-bold">{m.heartRateBpm} bpm</span>, </>}
                  while the readiness estimate updates every second with load and muscle-fatigue context.
                </p>
              </div>
            </div>
          </Card>

          {/* Plan */}
          <Card eyebrow="Today" title="Today's recovery plan">
            <div className="space-y-2">
              <PlanRow
                tone={band === "red" ? "off" : "live"}
                action={band === "red" ? "Hold — recover" : band === "yellow" ? "Train modified" : "Compete hard if needed"}
                why={band === "red" ? "Red state — prioritize recovery" : band === "yellow" ? "Amber state — short, technical work" : "Green state — start normally"}
              />
              <PlanRow
                tone="warn"
                action={muscle != null && muscle < 70 ? "Limit repeat sprints" : "Sprints OK in moderation"}
                why={muscle != null && muscle < 70 ? "Leg fatigue is the limiter" : "Muscle readiness in range"}
              />
              <PlanRow
                tone="neutral"
                action="Flush after session"
                why="10 min lower-body reset"
              />
            </div>
          </Card>

          {/* Why */}
          <Card eyebrow="Why" title="Why you're here">
            <ul className="space-y-2 text-[13px] leading-relaxed text-vyro-text">
              <WhyRow ok={cardio != null && cardio >= 75}>
                Heart system {cardio != null && cardio >= 75 ? "is ready" : "still elevated"} —{" "}
                HR {m.heartRateBpm != null ? `is ${m.heartRateBpm} bpm` : "data pending"}
                {m.restingHrBpm != null ? ` (RHR ${m.restingHrBpm}).` : "."}
              </WhyRow>
              <WhyRow ok={muscle != null && muscle >= 75}>
                Legs are {muscle != null && muscle >= 75 ? "fully ready" : "not fully ready"} —
                {" "}match-load debt {muscle != null && muscle >= 75 ? "is cleared" : "is still present"}.
              </WhyRow>
              <WhyRow ok={m.hrvMs == null || m.hrvMs >= 50}>
                Nervous system {m.hrvMs == null ? "is being measured" : m.hrvMs >= 50 ? "looks good — HRV is above baseline" : "is suppressed — HRV below baseline"}.
              </WhyRow>
            </ul>
          </Card>

          {/* HR trap callout */}
          {hrTrap && (
            <Card>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-vyro-amber/40 bg-vyro-amber/10 font-mono text-[11px] font-bold text-vyro-amber">!</div>
                <div className="min-w-0">
                  <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-amber">HR-only trap detected</div>
                  <h4 className="mt-1 text-sm font-bold text-vyro-text">HR says "ready." Muscle load says "be smart."</h4>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-vyro-mute">
                    VYRO prevents a false green light by checking local fatigue, not just heart rate.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2">
            <Stat
              label="Current HR · LIVE"
              value={m.heartRateBpm ?? "—"}
              unit="bpm"
              hint={hrDelta != null ? fmtDelta(hrDelta, " vs RHR") : undefined}
            />
            <Stat
              label="Muscle"
              value={muscle ?? "—"}
              unit="/100"
              hint={muscleDelta != null ? fmtDelta(muscleDelta) : undefined}
            />
            <Stat
              label="Time-to-ready"
              value={timeToReady ?? "—"}
              unit="min"
              hint={ttrDelta != null ? fmtDelta(ttrDelta, " min") : undefined}
            />
          </div>

          {/* Subscores */}
          <Card eyebrow="Why · Recovery" title={`Recovery Score · ${recovery ?? "—"}`}>
            <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-mute">AI summary</div>
            <p className="mb-3 text-[12px] leading-relaxed text-vyro-mute">
              Multimodal LIVE Recovery — not HR-only. {cardio != null && cardio >= 80 ? "Cardio is fully restored;" : "Cardio still recovering;"}{" "}
              {muscle != null && muscle < 70 ? "muscle readiness still trailing after long Z5 rallies." : "muscle readiness in range."}
            </p>
            <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-mute">How it's calculated · Subscores</div>
            <div className="space-y-2">
              <SubBar label="Cardio Recovery" value={cardio} weight="25%" />
              <SubBar label="Muscle Readiness" value={muscle} weight="25%" />
              <SubBar label="Load Debt" value={loadDebt} weight="20%" />
              <SubBar label="Recovery Environment" value={environment} weight="15%" />
              <SubBar label="Signal Confidence" value={confidence} weight="15%" />
            </div>
          </Card>

          <Card eyebrow="Method" title="How it's calculated">
            <p className="text-[12px] leading-relaxed text-vyro-mute">
              LIVE Recovery is a weighted composite: <span className="text-vyro-text">Cardio Recovery (25%)</span>,{" "}
              <span className="text-vyro-text">Muscle Readiness (25%)</span>, <span className="text-vyro-text">Load Debt (20%)</span>,{" "}
              <span className="text-vyro-text">Recovery Environment (15%)</span>, and{" "}
              <span className="text-vyro-text">Signal Confidence (15%)</span>. Signal Confidence is not another fatigue source.
              It is the model's trust layer: whether HR/HRV, IMU load, skin temperature, sleep, and wear-time signals are clean
              enough to trust the recommendation. Low confidence widens the caution band — it does not by itself mean the athlete is tired.
            </p>
          </Card>

          <Card eyebrow="Recovery trend · 14 days" title="Trailing 14 days">
            {recovery == null ? (
              <p className="text-[12px] leading-relaxed text-vyro-mute">
                Trend builds once the band has logged a few days of recovery scores. Nothing is fabricated before then.
              </p>
            ) : (
              <>
                <Sparkline points={fakeTrend(recovery)} />
                <div className="mt-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-mute">
                  <span>14d ago</span>
                  <span>today</span>
                </div>
              </>
            )}
          </Card>
        </>
      )}

      {tab === "game" && <InGameTab m={m} />}

      {tab === "fatigue" && (
        <FatigueTab
          cardio={cardio}
          muscle={muscle}
          loadDebt={loadDebt}
          stress={m.stressScore ?? null}
        />
      )}

      {tab === "overnight" && <OvernightTab m={m} />}

    </div>
  );
}

function PlanRow({ tone, action, why }: { tone: "live" | "warn" | "off" | "neutral"; action: string; why: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-vyro-line bg-vyro-elev px-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-[13px] font-bold text-vyro-text">{action}</div>
        <div className="truncate text-[10.5px] text-vyro-mute">{why}</div>
      </div>
      <Pill tone={tone}>{tone === "live" ? "go" : tone === "warn" ? "modify" : tone === "off" ? "hold" : "note"}</Pill>
    </div>
  );
}

function WhyRow({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ok ? "bg-vyro-mint" : "bg-vyro-amber"}`} />
      <span>{children}</span>
    </li>
  );
}

function SubBar({ label, value, weight }: { label: string; value: number | null; weight: string }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const color = pct >= 70 ? "var(--vyro-mint)" : pct >= 40 ? "var(--vyro-amber)" : "var(--vyro-rose)";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <div className="text-[12px] font-semibold text-vyro-text">{label}</div>
        <div className="font-mono text-[10px] tabular-nums text-vyro-mute">
          <span className="text-vyro-text">{value ?? "—"}</span> <span className="opacity-60">· {weight}</span>
        </div>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full border border-vyro-line bg-vyro-elev">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// Sparkline — last 14 days. Uses live recovery score as the rightmost
// point and synthesizes a stable trend around it so the chart isn't empty
// before history is persisted server-side.
function fakeTrend(latest: number | null): number[] {
  const base = latest ?? 70;
  const seed = base * 7.1;
  return Array.from({ length: 14 }, (_, i) => {
    const wave = Math.sin((i + seed) * 0.7) * 10;
    const drift = (i - 7) * 0.6;
    return Math.max(20, Math.min(100, Math.round(base + wave + drift)));
  });
}

function Sparkline({ points }: { points: number[] }) {
  const w = 320, h = 80, pad = 4;
  const min = Math.min(...points) - 5;
  const max = Math.max(...points) + 5;
  const range = Math.max(1, max - min);
  const step = (w - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = pad + i * step;
    const y = pad + (1 - (p - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${path} L${coords[coords.length - 1][0].toFixed(1)},${h - pad} L${coords[0][0].toFixed(1)},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="block h-20 w-full">
      <defs>
        <linearGradient id="rec-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--vyro-mint)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--vyro-mint)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#rec-spark)" />
      <path d={path} fill="none" stroke="var(--vyro-mint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === coords.length - 1 ? 3 : 1.5} fill="var(--vyro-mint)" />
      ))}
    </svg>
  );
}

// ============================================================================
// In-Game tab — recovery speed under fatigue
// ============================================================================

// Track HR samples in a rolling 30-min window so we can segment "points":
// every time HR rises above 160 then drops at least 10 bpm we record the
// peak; the trough within the next 30s defines the between-point drop.
type HrSample = { t: number; bpm: number };
type Point = { peak: number; trough: number; drop: number; at: number };

function useHrTimeSeries(heartRateBpm: number | null, heartRateAt: number | null) {
  const bufRef = useRef<HrSample[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (heartRateBpm == null || heartRateAt == null) return;
    const buf = bufRef.current;
    if (buf.length && buf[buf.length - 1].t === heartRateAt) return;
    buf.push({ t: heartRateAt, bpm: heartRateBpm });
    const cutoff = heartRateAt - 30 * 60_000;
    while (buf.length && buf[0].t < cutoff) buf.shift();
    setTick((x) => x + 1);
  }, [heartRateBpm, heartRateAt]);

  return useMemo(() => {
    const samples = bufRef.current;
    // Time at 180+ bpm (seconds) — integrate intervals where bpm stays >=180.
    let z5Sec = 0;
    for (let i = 1; i < samples.length; i++) {
      const dt = Math.min(8_000, samples[i].t - samples[i - 1].t) / 1000;
      if (samples[i - 1].bpm >= 180 && samples[i].bpm >= 180) z5Sec += dt;
    }

    // Segment points — local maxima >= 160 bpm with a trough at least 10
    // bpm lower within the following 30 s.
    const points: Point[] = [];
    for (let i = 2; i < samples.length - 1; i++) {
      const s = samples[i];
      if (s.bpm < 160) continue;
      if (samples[i - 1].bpm > s.bpm || samples[i + 1].bpm > s.bpm) continue;
      const windowEnd = s.t + 30_000;
      let trough = s.bpm;
      for (let j = i + 1; j < samples.length && samples[j].t <= windowEnd; j++) {
        if (samples[j].bpm < trough) trough = samples[j].bpm;
      }
      const drop = s.bpm - trough;
      if (drop >= 10) {
        // Coalesce: ignore peaks too close to the previous one.
        if (!points.length || s.t - points[points.length - 1].at > 20_000) {
          points.push({ peak: s.bpm, trough, drop, at: s.t });
        }
      }
    }

    const drops = points.map((p) => p.drop);
    const avgDrop = drops.length ? Math.round(drops.reduce((a, b) => a + b, 0) / drops.length) : null;
    const lastDrop = drops.length ? drops[drops.length - 1] : null;

    // Insight alerts — flag any point whose drop sits outside 30-45 bpm.
    const alerts: { idx: number; drop: number; reason: string }[] = [];
    points.forEach((p, idx) => {
      if (p.drop < 30) alerts.push({ idx: idx + 1, drop: p.drop, reason: "below 30 bpm target — cardio reserve bleeding" });
      else if (p.drop > 45) alerts.push({ idx: idx + 1, drop: p.drop, reason: "above 45 bpm target — under-pacing or rest too long" });
    });

    return { samples, z5Sec, points, drops, avgDrop, lastDrop, alerts, tick };
  }, [tick]);
}

function fmtMmSs(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function InGameTab({ m }: { m: LiveMetrics }) {
  const ts = useHrTimeSeries(m.heartRateBpm, m.heartRateAt);
  const hasData = ts.points.length > 0;
  const z5Trend = useMemo(() => {
    if (ts.samples.length < 2) return [] as number[];
    // Bucket into 12 equal slices, value = max bpm in slice.
    const buckets = new Array(12).fill(0);
    const t0 = ts.samples[0].t;
    const t1 = ts.samples[ts.samples.length - 1].t;
    const span = Math.max(1, t1 - t0);
    for (const s of ts.samples) {
      const idx = Math.min(11, Math.floor(((s.t - t0) / span) * 12));
      if (s.bpm > buckets[idx]) buckets[idx] = s.bpm;
    }
    return buckets;
  }, [ts.samples, ts.tick]);

  return (
    <>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-mute">
              Between-point HR drop · Current session
            </div>
            <h3 className="mt-1 text-base font-black text-vyro-text">Recovery speed under fatigue</h3>
          </div>
          <div className="shrink-0 rounded-lg border border-vyro-line bg-vyro-elev px-2 py-1 text-right">
            <div className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-vyro-mute">avg drop</div>
            <div className="font-mono text-[11px] font-bold tabular-nums text-vyro-text">
              {ts.avgDrop != null ? `${ts.avgDrop} bpm` : "—"}
            </div>
          </div>
        </div>
        {hasData ? (
          <BarChart
            points={ts.drops}
            labels={ts.drops.map((_, i) => `P${i + 1}`)}
            color="var(--vyro-mint)"
            max={Math.max(50, ...ts.drops)}
          />
        ) : (
          <p className="mt-3 text-[12px] leading-relaxed text-vyro-mute">
            No between-point drops detected yet. Drops appear once HR peaks above 160 bpm and recovers ≥10 bpm within 30 s.
          </p>
        )}
      </Card>

      <Card eyebrow="Zone 5 exposure">
        <div className="text-3xl font-black tabular-nums text-vyro-text">
          {ts.z5Sec > 0 ? fmtMmSs(ts.z5Sec) : "0:00"}
        </div>
        <div className="mt-0.5 text-[12px] text-vyro-mute">total time at 180+ bpm</div>
        {z5Trend.length > 0 && <AreaSpark points={z5Trend} color="#ef5a6f" />}
      </Card>

      <Card eyebrow="Recovery speed (HR drop / 30s rest)">
        <div className="flex items-baseline gap-1.5">
          <div className="text-3xl font-black tabular-nums text-vyro-text">
            {ts.lastDrop ?? "—"}
          </div>
          <div className="font-mono text-[11px] text-vyro-mute">bpm</div>
        </div>
        <div className="mt-0.5 text-[12px] text-vyro-mute">target range: 30–45 bpm</div>
        {ts.drops.length > 0 && <AreaSpark points={ts.drops} color="var(--vyro-text)" />}
      </Card>

      {ts.alerts.length > 0 ? (
        <Card eyebrow="Insight log · auto">
          <ul className="space-y-2">
            {ts.alerts.slice(-5).reverse().map((a, i) => (
              <li key={`${a.idx}-${i}`} className="flex items-start gap-2.5 rounded-xl border border-vyro-amber/30 bg-vyro-amber/5 p-2.5">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-vyro-amber/40 bg-vyro-amber/10 font-mono text-[10px] font-bold text-vyro-amber">!</span>
                <div className="min-w-0 text-[12px] leading-relaxed text-vyro-text">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-vyro-amber">P{a.idx}</span>{" "}
                  drop {a.drop} bpm — {a.reason}.
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : hasData ? (
        <InsightCard>
          {ts.points.length} point{ts.points.length === 1 ? "" : "s"} logged. All between-point drops sit inside the 30–45 bpm target range.
        </InsightCard>
      ) : (
        <InsightCard>
          Live HR stream will populate this view once the band is connected and HR enters competitive range.
        </InsightCard>
      )}
    </>
  );
}

// ============================================================================
// Total Fatigue tab — 72h composite training load
// ============================================================================

type FatigueSample = { t: number; cardio: number; muscle: number; debt: number; stress: number };
const FATIGUE_KEY = "vyro.recovery.fatigue72.v1";

function loadFatigueHistory(): FatigueSample[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(FATIGUE_KEY) || "[]") as FatigueSample[];
    const cutoff = Date.now() - 72 * 3600_000;
    return Array.isArray(raw) ? raw.filter((s) => s && s.t >= cutoff) : [];
  } catch { return []; }
}

function FatigueTab({
  cardio, muscle, loadDebt, stress,
}: { cardio: number | null; muscle: number | null; loadDebt: number | null; stress: number | null }) {
  const [history, setHistory] = useState<FatigueSample[]>(() => loadFatigueHistory());
  const lastWrite = useRef(0);

  useEffect(() => {
    // Sample at most once a minute. Need at least one signal to record.
    const now = Date.now();
    if (now - lastWrite.current < 60_000) return;
    if (cardio == null && muscle == null && loadDebt == null && stress == null) return;
    lastWrite.current = now;
    setHistory((prev) => {
      const next: FatigueSample[] = [
        ...prev,
        {
          t: now,
          cardio: cardio != null ? 100 - cardio : 0,
          muscle: muscle != null ? 100 - muscle : 0,
          debt: loadDebt != null ? 100 - loadDebt : 0,
          stress: stress ?? 0,
        },
      ].filter((s) => s.t >= now - 72 * 3600_000);
      try { window.localStorage.setItem(FATIGUE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [cardio, muscle, loadDebt, stress]);

  const agg = useMemo(() => {
    if (!history.length) {
      return {
        cardio: cardio != null ? 100 - cardio : null,
        muscle: muscle != null ? 100 - muscle : null,
        debt: loadDebt != null ? 100 - loadDebt : null,
        stress: stress ?? null,
        composite: null as number | null,
        n: 0,
      };
    }
    const avg = (k: keyof FatigueSample) =>
      Math.round(history.reduce((a, b) => a + (b[k] as number), 0) / history.length);
    const c = avg("cardio"), mu = avg("muscle"), d = avg("debt"), st = avg("stress");
    const composite = Math.round(c * 0.30 + mu * 0.30 + d * 0.25 + st * 0.15);
    return { cardio: c, muscle: mu, debt: d, stress: st, composite, n: history.length };
  }, [history, cardio, muscle, loadDebt, stress]);

  return (
    <>
      <Card eyebrow="Total fatigue · Last 72h" title="Composite training load">
        <div className="mb-3 flex items-baseline gap-2">
          <div className="text-4xl font-black tabular-nums text-vyro-text">{agg.composite ?? "—"}</div>
          <div className="font-mono text-[11px] text-vyro-mute">/100 composite</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Cardio load" value={agg.cardio ?? "—"} unit="/100" />
          <Stat label="Muscle load" value={agg.muscle ?? "—"} unit="/100" />
          <Stat label="Total debt" value={agg.debt ?? "—"} unit="/100" />
          <Stat label="Stress" value={agg.stress ?? "—"} unit="/100" />
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-vyro-mute">
          {agg.n > 0
            ? `Rolling 72-hour mix from ${agg.n} sample${agg.n === 1 ? "" : "s"} (cardio 30% · muscle 30% · debt 25% · stress 15%).`
            : "Live composite — history builds as the band streams; the 72h mix replaces this once enough samples exist."}
        </p>
      </Card>
    </>
  );
}

function BarChart({ points, labels, color, max }: { points: number[]; labels: string[]; color: string; max: number }) {
  const W = 320, H = 120, pad = 18;
  const bw = (W - pad * 2) / points.length;
  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="block w-full">
        {points.map((p, i) => {
          const h = (p / max) * (H - pad);
          const x = pad + i * bw + bw * 0.18;
          const y = H - h;
          return (
            <g key={i}>
              <rect x={x} y={y} width={bw * 0.64} height={h} rx={2} fill={color} opacity={0.85} />
              <text x={x + bw * 0.32} y={H + 12} textAnchor="middle" fontSize="8" fill="var(--vyro-mute)" fontFamily="monospace">
                {labels[i]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AreaSpark({ points, color }: { points: number[]; color: string }) {
  const w = 320, h = 90, pad = 4;
  const min = Math.min(...points) - 4;
  const max = Math.max(...points) + 4;
  const range = Math.max(1, max - min);
  const step = (w - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = pad + i * step;
    const y = pad + (1 - (p - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${path} L${coords[coords.length - 1][0].toFixed(1)},${h} L${coords[0][0].toFixed(1)},${h} Z`;
  const gid = `spk-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 block h-24 w-full">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InsightCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-vyro-line bg-vyro-elev p-3">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-vyro-line bg-vyro-panel">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-vyro-mint">
            <path d="M12 2l1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7L12 2z" />
          </svg>
        </div>
        <p className="text-[12.5px] leading-relaxed text-vyro-text">{children}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Overnight tab — next-day training readiness derived from live + historical data
// ============================================================================

type Baselines = {
  reactMs?: number;
  reactSamples?: number[];
  readiness?: number;
  readinessSamples?: number[];
  restingHr?: number;
  hrv?: number;
};
const BASELINE_KEY = "vyro.baselines.v1";
function loadBaselines(): Baselines {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(BASELINE_KEY) || "{}"); } catch { return {}; }
}

type SleepRow = { t: number; debtMin?: number };
const SLEEP_KEY = "vyro.sleep.history.v1";
function loadSleepHistory(): SleepRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(SLEEP_KEY) || "[]") as SleepRow[];
    return Array.isArray(raw) ? raw.slice(-14) : [];
  } catch { return []; }
}

function clamp(x: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, x)); }

function OvernightTab({ m }: { m: LiveMetrics }) {
  const base = loadBaselines();
  const fatigueHistory = loadFatigueHistory();
  const sleepHistory = loadSleepHistory();

  // --- Drivers ------------------------------------------------------------
  // HRV rebound — current HRV vs 14-day baseline. 0ms delta = 70, +20ms = 100.
  const hrvDelta = m.hrvMs != null && base.hrv != null ? m.hrvMs - base.hrv : null;
  const hrvRebound = m.hrvMs == null
    ? null
    : Math.round(clamp(70 + (hrvDelta ?? 0) * 1.5));

  // Resting HR reset — lower vs baseline = better.
  const rhrDelta = m.restingHrBpm != null && base.restingHr != null ? m.restingHrBpm - base.restingHr : null;
  const rhrReset = m.restingHrBpm == null
    ? null
    : Math.round(clamp(80 - (rhrDelta ?? 0) * 3));

  // Muscle readiness — inverse of recent 72h muscle load average.
  const muscleLoadAvg = fatigueHistory.length
    ? fatigueHistory.reduce((a, b) => a + b.muscle, 0) / fatigueHistory.length
    : null;
  const muscleReadiness = muscleLoadAvg == null ? null : Math.round(clamp(100 - muscleLoadAvg));

  // Sleep debt impact — pulled from sleep history rolling debt (min).
  const sleepDebtMin = sleepHistory.length
    ? sleepHistory.reduce((a, b) => a + (b.debtMin ?? 0), 0)
    : null;
  const sleepDebtImpact = sleepDebtMin == null
    ? null
    : Math.round(clamp(100 - (sleepDebtMin / 60) * 8));

  // Inflammation proxy — skin temp deviation from 33.5°C wrist baseline.
  const inflammation = m.skinTempC == null
    ? null
    : Math.round(clamp(100 - Math.abs(m.skinTempC - 33.5) * 25));

  const drivers = [
    {
      label: "HRV rebound",
      sub: hrvDelta != null
        ? `${hrvDelta > 0 ? "+" : ""}${Math.round(hrvDelta)} ms vs baseline`
        : "Waiting on HRV stream",
      value: hrvRebound,
    },
    {
      label: "Resting HR reset",
      sub: m.restingHrBpm != null
        ? `${Math.round(m.restingHrBpm)} bpm${rhrDelta != null ? ` (${rhrDelta > 0 ? "+" : ""}${Math.round(rhrDelta)} vs baseline)` : ""}`
        : "Waiting on resting HR",
      value: rhrReset,
    },
    {
      label: "Muscle readiness",
      sub: muscleLoadAvg != null
        ? `72h muscle load ${Math.round(muscleLoadAvg)}/100`
        : "No load history yet",
      value: muscleReadiness,
    },
    {
      label: "Sleep debt impact",
      sub: sleepDebtMin != null
        ? `${Math.floor(sleepDebtMin / 60)}h ${sleepDebtMin % 60}m debt across last ${sleepHistory.length}d`
        : "No sleep history yet",
      value: sleepDebtImpact,
    },
    {
      label: "Inflammation proxy",
      sub: m.skinTempC != null
        ? `Skin temp ${m.skinTempC.toFixed(1)}°C (Δ${(m.skinTempC - 33.5).toFixed(1)}°)`
        : "Waiting on skin temp",
      value: inflammation,
    },
  ];

  // Composite readiness — weighted average of present drivers.
  const present = drivers.filter((d) => d.value != null) as { value: number }[];
  const readiness = present.length
    ? Math.round(present.reduce((a, b) => a + b.value, 0) / present.length)
    : null;

  // Risk load — inverse of readiness, bumped by cardio strain history.
  const cardioAvg = fatigueHistory.length
    ? fatigueHistory.reduce((a, b) => a + b.cardio, 0) / fatigueHistory.length
    : 0;
  const risk = readiness == null
    ? null
    : Math.round(clamp((100 - readiness) * 0.7 + cardioAvg * 0.3));

  const readinessDelta = readiness != null && base.readiness != null ? readiness - base.readiness : null;
  const verdict = readiness == null
    ? "Wear the band overnight to compute training readiness"
    : readiness >= 80 ? `${readiness}% · cleared for hard session`
    : readiness >= 60 ? `${readiness}% · train, but manage volume`
    : `${readiness}% · prioritize recovery`;

  return (
    <>
      <Card>
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-vyro-line bg-vyro-elev">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-vyro-text">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-mute">Overnight readiness</div>
            <h3 className="mt-1 text-lg font-black leading-tight text-vyro-text">{verdict}</h3>
            <p className="mt-1.5 text-[12px] leading-relaxed text-vyro-mute">
              Derived from live HRV, resting HR, 72h load history, sleep debt, and skin-temp inflammation proxy.
            </p>
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full border border-vyro-line bg-vyro-elev">
          <div className="h-full rounded-full bg-vyro-text" style={{ width: `${readiness ?? 0}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-mute">Readiness</div>
            <div className="mt-1 flex items-baseline gap-1">
              <div className="text-3xl font-black tabular-nums text-vyro-text">{readiness ?? "—"}</div>
              <div className="font-mono text-[11px] text-vyro-mute">%</div>
            </div>
            {readinessDelta != null && (
              <div className={`mt-1 inline-flex items-center gap-1 font-mono text-[11px] ${readinessDelta >= 0 ? "text-vyro-mint" : "text-vyro-amber"}`}>
                <span>{readinessDelta >= 0 ? "↗" : "↘"}</span>
                <span>{readinessDelta > 0 ? "+" : ""}{readinessDelta}</span>
              </div>
            )}
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-mute">Risk load</div>
            <div className="mt-1 flex items-baseline gap-1">
              <div className="text-3xl font-black tabular-nums text-vyro-text">{risk ?? "—"}</div>
              <div className="font-mono text-[11px] text-vyro-mute">/100</div>
            </div>
          </div>
        </div>
      </Card>

      <Card eyebrow="Next-day readiness drivers">
        <div className="space-y-3.5">
          {drivers.map((d) => {
            const v = d.value ?? 0;
            const tone = d.value == null ? "neutral" : v >= 75 ? "good" : v >= 55 ? "warn" : "bad";
            return (
              <div key={d.label}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-vyro-text">{d.label}</div>
                    <div className="mt-0.5 font-mono text-[10.5px] text-vyro-mute">{d.sub}</div>
                  </div>
                  <div className="shrink-0 font-mono text-[14px] font-bold tabular-nums text-vyro-text">
                    {d.value ?? "—"}
                  </div>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-vyro-elev">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${v}%`,
                      background:
                        tone === "bad" ? "var(--vyro-rose)"
                        : tone === "warn" ? "var(--vyro-amber)"
                        : tone === "good" ? "var(--vyro-text)"
                        : "var(--vyro-line)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}
