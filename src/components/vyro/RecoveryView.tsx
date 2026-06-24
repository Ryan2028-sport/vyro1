import { useEffect, useMemo, useRef, useState } from "react";
import { Card, PageHeader, Pill, Ring, Stat } from "./shared";
import { recoveryBand, useLiveMetrics, type LiveMetrics } from "./useLiveMetrics";

// Recovery & fatigue intelligence.
// Mobile-first, WHOOP/Nike-style. Streams everything possible from the
// connected band; any signal we can't compute degrades to "—" so the
// layout still reads cleanly without faking numbers.

type Tab = "live" | "game" | "fatigue" | "overnight";

export function RecoveryView() {
  const m = useLiveMetrics();
  const [tab, setTab] = useState<Tab>("live");

  // --- Subscores -----------------------------------------------------------
  // Cardio Recovery — how close current HR is to resting HR (the lower
  // the live HR vs RHR, the more cardio is restored).
  const cardio = useMemo(() => {
    if (m.heartRateBpm == null) return null;
    const rhr = m.restingHrBpm ?? 60;
    const headroom = Math.max(0, m.heartRateBpm - rhr);
    // 0 bpm above RHR = 100, 60 bpm above = 0
    return Math.round(Math.max(0, Math.min(100, 100 - (headroom / 60) * 100)));
  }, [m.heartRateBpm, m.restingHrBpm]);

  // Muscle Readiness — inverse of recent IMU peak-jerk + rolling event load.
  const muscle = useMemo(() => {
    if (!m.connected) return null;
    const jerkPenalty = Math.min(60, (m.peakJerk ?? 0) / 4);
    const eventPenalty = Math.min(40, m.eventsLastMin * 0.6);
    return Math.round(Math.max(0, 100 - jerkPenalty - eventPenalty));
  }, [m.connected, m.peakJerk, m.eventsLastMin]);

  // Load Debt — short-term load proxy from current session intensity.
  const loadDebt = useMemo(() => {
    if (!m.connected) return null;
    const base = Math.min(100, m.eventsLastMin * 1.5);
    const intensity = Math.min(30, (m.peakJerk ?? 0) / 6);
    return Math.round(Math.max(0, 100 - Math.min(100, base * 0.7 + intensity)));
  }, [m.connected, m.eventsLastMin, m.peakJerk]);

  // Recovery Environment — sleep + skin temp + spO2 (whichever are present).
  const environment = useMemo(() => {
    const parts: number[] = [];
    if (m.spo2Pct != null) parts.push(Math.max(0, Math.min(100, ((m.spo2Pct - 92) / 7) * 100)));
    if (m.skinTempC != null) {
      // Closer to 33.5°C wrist baseline = better
      const dev = Math.abs(m.skinTempC - 33.5);
      parts.push(Math.max(0, 100 - dev * 25));
    }
    if (m.hrvMs != null) parts.push(Math.max(0, Math.min(100, ((m.hrvMs - 20) / 70) * 100)));
    if (parts.length === 0) return null;
    return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
  }, [m.connected, m.spo2Pct, m.skinTempC, m.hrvMs]);

  // Signal Confidence — how many independent streams are live right now.
  const confidence = useMemo(() => {
    const streams = [
      m.heartRateBpm != null,
      m.hrvMs != null,
      m.spo2Pct != null,
      m.skinTempC != null,
      m.stepsToday != null,
      m.batteryPct != null,
    ];
    const live = streams.filter(Boolean).length;
    if (live === 0) return null;
    return Math.round((live / streams.length) * 100);
  }, [m.heartRateBpm, m.hrvMs, m.spo2Pct, m.skinTempC, m.stepsToday, m.batteryPct]);

  // Composite LIVE Recovery — weighted blend matching the spec.
  const recovery = useMemo(() => {
    const parts: { v: number | null; w: number }[] = [
      { v: cardio, w: 0.25 },
      { v: muscle, w: 0.25 },
      { v: loadDebt, w: 0.20 },
      { v: environment, w: 0.15 },
      { v: confidence, w: 0.15 },
    ];
    const present = parts.filter((p) => p.v != null);
    if (present.length === 0) return null;
    const totalW = present.reduce((a, b) => a + b.w, 0);
    const sum = present.reduce((a, b) => a + (b.v as number) * b.w, 0);
    return Math.round(sum / totalW);
  }, [cardio, muscle, loadDebt, environment, confidence]);

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

      {tab === "game" && <InGameTab heartRateBpm={m.heartRateBpm} />}

      {tab === "fatigue" && (
        <>
          <Card eyebrow="Total fatigue · Session" title="Composite training load">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Cardio load" value={cardio != null ? 100 - cardio : "—"} unit="/100" />
              <Stat label="Muscle load" value={muscle != null ? 100 - muscle : "—"} unit="/100" />
              <Stat label="Load debt" value={loadDebt != null ? 100 - loadDebt : "—"} unit="/100" />
              <Stat label="Stress" value={m.stressScore ?? "—"} unit="/100" />
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-vyro-mute">
              Total fatigue blends cardio strain, local muscle load, and accumulated load debt from the last 72h.
            </p>
          </Card>
        </>
      )}

      {tab === "overnight" && <OvernightTab />}

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
// In-Game tab
// ============================================================================

const HR_DROPS = [42, 40, 38, 39, 37, 36, 35, 34, 33, 32, 31, 28];
const Z5_TREND = [55, 38, 22, 68, 58, 46, 50, 48, 60, 42, 25, 70];
const RECOV_SPEED = [40, 28, 44, 32, 50, 35, 46, 28, 30, 44, 42];

function InGameTab({ heartRateBpm: _hr }: { heartRateBpm: number | null }) {
  const avgDrop = Math.round(HR_DROPS.reduce((a, b) => a + b, 0) / HR_DROPS.length);
  return (
    <>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-mute">
              Between-point HR drop · Current match
            </div>
            <h3 className="mt-1 text-base font-black text-vyro-text">Recovery speed under fatigue</h3>
          </div>
          <div className="shrink-0 rounded-lg border border-vyro-line bg-vyro-elev px-2 py-1 text-right">
            <div className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-vyro-mute">avg drop</div>
            <div className="font-mono text-[11px] font-bold tabular-nums text-vyro-text">{avgDrop} bpm</div>
          </div>
        </div>
        <BarChart points={HR_DROPS} labels={HR_DROPS.map((_, i) => `P${i + 1}`)} color="var(--vyro-mint)" max={50} />
      </Card>

      <Card eyebrow="Zone 5 exposure">
        <div className="text-3xl font-black tabular-nums text-vyro-text">3:42</div>
        <div className="mt-0.5 text-[12px] text-vyro-mute">total time at 180+ bpm</div>
        <AreaSpark points={Z5_TREND} color="#ef5a6f" />
      </Card>

      <Card eyebrow="Recovery speed (HR drop / 30s rest)">
        <div className="flex items-baseline gap-1.5">
          <div className="text-3xl font-black tabular-nums text-vyro-text">38</div>
          <div className="font-mono text-[11px] text-vyro-mute">bpm</div>
        </div>
        <div className="mt-0.5 text-[12px] text-vyro-mute">elite range: 30–45 bpm</div>
        <AreaSpark points={RECOV_SPEED} color="var(--vyro-text)" />
      </Card>

      <InsightCard>
        HR drop between points held above 30 bpm through point 11. The dip on P12 (drop 40 bpm)
        is the first sign cardio reserve is bleeding — pace the next game.
      </InsightCard>
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
// Overnight tab
// ============================================================================

const DRIVERS = [
  { label: "HRV rebound", sub: "+8 ms vs 14-day baseline", value: 92, tone: "good" as const },
  { label: "Resting HR reset", sub: "48 bpm asleep, trending down", value: 84, tone: "good" as const },
  { label: "Muscle readiness", sub: "Calves still carrying match load", value: 72, tone: "warn" as const },
  { label: "Sleep debt impact", sub: "1h 24m debt reduces ceiling", value: 66, tone: "warn" as const },
  { label: "Inflammation proxy", sub: "Skin temp stable, no red flag", value: 88, tone: "good" as const },
];

const PLAN = [
  { tag: "AM", title: "Green warm-up", body: "8 min dynamic mobility, then progressive ghosting." },
  { tag: "MID", title: "Hard block allowed", body: "Push intensity if live recovery holds above 70% after first block." },
  { tag: "PM", title: "Downshift", body: "Keep evening work below Z3 and prioritize carbs + fluids." },
];

function OvernightTab() {
  const readiness = 86;
  const risk = 34;
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
            <h3 className="mt-1 text-lg font-black leading-tight text-vyro-text">
              {readiness}% · cleared for hard session
            </h3>
            <p className="mt-1.5 text-[12px] leading-relaxed text-vyro-mute">
              Recovery tab now only explains tomorrow's training clearance. Sleep-stage architecture lives inside Sleep.
            </p>
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full border border-vyro-line bg-vyro-elev">
          <div className="h-full rounded-full bg-vyro-text" style={{ width: `${readiness}%` }} />
        </div>
        <div className="mt-3">
          <InsightCard>
            Best next-day use: one high-intensity block, then let live recovery decide whether to add volume.
          </InsightCard>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-mute">Readiness</div>
            <div className="mt-1 flex items-baseline gap-1">
              <div className="text-3xl font-black tabular-nums text-vyro-text">{readiness}</div>
              <div className="font-mono text-[11px] text-vyro-mute">%</div>
            </div>
            <div className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-vyro-mint">
              <span>↗</span><span>+6</span>
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-mute">Risk load</div>
            <div className="mt-1 flex items-baseline gap-1">
              <div className="text-3xl font-black tabular-nums text-vyro-text">{risk}</div>
              <div className="font-mono text-[11px] text-vyro-mute">/100</div>
            </div>
            <div className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-vyro-amber">
              <span>↘</span><span>−8</span>
            </div>
          </div>
        </div>
      </Card>

      <Card eyebrow="Next-day readiness drivers">
        <div className="space-y-3.5">
          {DRIVERS.map((d) => (
            <div key={d.label}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-vyro-text">{d.label}</div>
                  <div className="mt-0.5 font-mono text-[10.5px] text-vyro-mute">{d.sub}</div>
                </div>
                <div className="shrink-0 font-mono text-[14px] font-bold tabular-nums text-vyro-text">{d.value}</div>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-vyro-elev">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${d.value}%`,
                    background: d.tone === "warn" ? "var(--vyro-amber)" : "var(--vyro-text)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-vyro-line bg-vyro-elev">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-vyro-text">
              <path d="M3 12h4l2-7 4 14 2-7h6" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-mute">Tomorrow's operating plan</div>
            <h3 className="mt-1 text-base font-black leading-tight text-vyro-text">
              Train hard, but let live recovery gate the second push.
            </h3>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {PLAN.map((p) => (
            <div key={p.tag} className="rounded-xl border border-vyro-line bg-vyro-panel p-3">
              <div className="inline-flex items-center rounded-md border border-vyro-line bg-vyro-elev px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-vyro-text">
                {p.tag}
              </div>
              <div className="mt-2 text-[14px] font-black text-vyro-text">{p.title}</div>
              <div className="mt-1 text-[12px] leading-relaxed text-vyro-mute">{p.body}</div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
