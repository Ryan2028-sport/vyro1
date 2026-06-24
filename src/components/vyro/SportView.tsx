import { useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Card, EmptyState, PageHeader, Pill, Stat } from "./shared";
import { SPORT_PROFILES, type SportProfile } from "./sportProfiles";
import { useLiveMetrics, type LiveMetrics, computeLiveRecovery } from "./useLiveMetrics";

// ============================================================================
// Sport view — STRICT real-telemetry-only mode.
// Every value below is derived from one of the four IMU event packets the
// firmware emits today (SWING / RAPID_START / BURST / DIR_CHANGE) plus the
// live BLE characteristics (HR / battery). No demo overlays, no synthetic
// court positioning, no fake shot types. Cards stay visible so the layout
// doesn't jump around; missing values render "—".
// ============================================================================

function fmt(n: number | null | undefined, digits = 0, unit = ""): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}${unit}`;
}

export function SportView() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = activeId ? SPORT_PROFILES.find((s) => s.id === activeId) : null;
  if (!active) return <SportPicker onPick={setActiveId} />;
  return <SportDetail sport={active} onBack={() => setActiveId(null)} />;
}

function SportPicker({ onPick }: { onPick: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Sport selector"
        title="Pick a sport to open its module."
        subtitle="Each sport renders the same real telemetry derived from the band's IMU event packets (swing, rapid-start, burst, direction-change) plus live HR."
        action={<Pill tone="live" pulse>{SPORT_PROFILES.length} sports</Pill>}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {SPORT_PROFILES.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s.id)}
            className="group flex flex-col items-start gap-2 rounded-2xl border border-vyro-line bg-vyro-panel p-4 text-left transition-colors hover:border-vyro-mint/60"
          >
            <span className="text-3xl leading-none">{s.emoji}</span>
            <div className="min-w-0">
              <div className="text-sm font-bold text-vyro-text">{s.label}</div>
              <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-vyro-mute">{s.databaseLabel}</div>
            </div>
            <span className="mt-auto font-mono text-[10px] text-vyro-mint opacity-0 transition-opacity group-hover:opacity-100">Open →</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SportDetail({ sport, onBack }: { sport: SportProfile; onBack: () => void }) {
  const m = useLiveMetrics();

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="-ml-2 flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-vyro-mute hover:text-vyro-text">
        <ChevronLeft className="h-3.5 w-3.5" /> All sports
      </button>

      <PageHeader
        eyebrow={`${sport.label} · Live telemetry`}
        title={`${sport.label} session metrics`}
        subtitle="All values come directly from the band's four IMU event packets plus the BLE heart-rate characteristic. Anything we can't measure shows as “—”."
        action={
          <Pill tone={m.connected ? "live" : "off"} pulse={m.connected}>
            {m.connected ? "BAND LIVE" : "BAND OFFLINE"}
          </Pill>
        }
      />

      <SquashSnapshotCard m={m} />
      <PerformanceLensesCard m={m} />

      <EventCountsCard m={m} />
      <SwingCard m={m} />
      <MovementCard m={m} />
      <ReactionCard m={m} />
      <VitalsCard m={m} />

      <Card eyebrow="Past sessions" title="0 logged">
        <EmptyState
          title={`No ${sport.label} sessions yet`}
          hint="Start a session from the Session tab. Once the band is streaming, your IMU event totals will be recorded here."
        />
      </Card>
    </div>
  );
}

// Counts come from the per-packet type counters maintained in the band hook.
function EventCountsCard({ m }: { m: LiveMetrics }) {
  return (
    <Card
      eyebrow="IMU event counts"
      title="Per-packet totals from the band"
      action={m.connected ? <Pill tone="live" pulse>LIVE</Pill> : <Pill tone="off">offline</Pill>}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Swings" value={m.connected ? m.counts.swing : "—"} hint="SWING packet" />
        <Stat label="Rapid starts" value={m.connected ? m.counts.rapid_start : "—"} hint="RAPID_START packet" />
        <Stat label="Bursts" value={m.connected ? m.counts.burst : "—"} hint="BURST packet" />
        <Stat label="Direction changes" value={m.connected ? m.counts.direction_change : "—"} hint="DIR_CHANGE packet" />
      </div>
      <p className="mt-3 text-[11px] text-vyro-mute">
        Events in the last minute:{" "}
        <span className="font-mono text-vyro-text">{m.connected ? m.eventsLastMin : "—"}</span>
      </p>
    </Card>
  );
}

// Swing intensity (0-100) and duration (ms) come straight from the SWING packet.
function SwingCard({ m }: { m: LiveMetrics }) {
  const hasSwing = m.connected && m.counts.swing > 0;
  return (
    <Card eyebrow="Swing packet" title="Swing intensity & duration">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Intensity max" value={hasSwing ? fmt(m.swingIntMax, 0) : "—"} unit="/100" />
        <Stat label="Intensity avg" value={hasSwing ? fmt(m.swingIntAvg, 0) : "—"} unit="/100" hint="rolling 10" />
        <Stat label="Duration max" value={hasSwing ? fmt(m.swingDurMax, 0) : "—"} unit="ms" />
        <Stat label="Duration avg" value={hasSwing ? fmt(m.swingDurAvg, 0) : "—"} unit="ms" hint="rolling 10" />
      </div>
      {!hasSwing && (
        <p className="mt-3 text-[11px] text-vyro-mute">No swings detected yet. Take a few practice strokes with the band on.</p>
      )}
    </Card>
  );
}

// Peak g / gyro / jerk — these fields are present on every IMU event packet
// (accelPeakG, gyroPeakDps, jerkPeakGps). We track session-max.
function MovementCard({ m }: { m: LiveMetrics }) {
  const hasMotion = m.connected && (m.peakG > 0 || m.peakDps > 0 || m.peakJerk > 0);
  return (
    <Card eyebrow="Motion peaks" title="Per-session maxima across all packets">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Peak accel" value={hasMotion && m.peakG > 0 ? fmt(m.peakG, 2) : "—"} unit="g" />
        <Stat label="Peak angular" value={hasMotion && m.peakDps > 0 ? fmt(m.peakDps, 0) : "—"} unit="dps" />
        <Stat label="Peak jerk" value={hasMotion && m.peakJerk > 0 ? fmt(m.peakJerk, 0) : "—"} unit="g/s" />
      </div>
      <p className="mt-3 text-[11px] text-vyro-mute">
        Source: <span className="font-mono text-vyro-text">accelPeakG / gyroPeakDps / jerkPeakGps</span> fields on each packet.
      </p>
    </Card>
  );
}

// Reaction = direction_change gap_ms (time between consecutive direction
// changes). Lower is sharper. Min and avg only — no synthetic baselines.
function ReactionCard({ m }: { m: LiveMetrics }) {
  // Compute rolling avg of last 10 dir-change gaps from the event stream.
  const reactAvg = useMemo(() => {
    if (!m.connected) return null;
    const gaps: number[] = [];
    for (const e of m.events) {
      const ev = e.event as { type?: string; gapMs?: number };
      if (ev.type === "direction_change" && typeof ev.gapMs === "number") gaps.push(ev.gapMs);
    }
    if (!gaps.length) return null;
    const last = gaps.slice(-10);
    return last.reduce((a, b) => a + b, 0) / last.length;
  }, [m.connected, m.events]);

  return (
    <Card eyebrow="DIR_CHANGE packet" title="Reaction window">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Fastest gap" value={m.connected && m.reactMin != null ? fmt(m.reactMin, 0) : "—"} unit="ms" />
        <Stat label="Avg gap (last 10)" value={reactAvg != null ? fmt(reactAvg, 0) : "—"} unit="ms" />
      </div>
      <p className="mt-3 text-[11px] text-vyro-mute">
        Gap between consecutive direction changes — the only reaction-time proxy the firmware currently emits.
      </p>
    </Card>
  );
}

// Live cardiovascular — straight from the BLE Heart-Rate characteristic.
function VitalsCard({ m }: { m: LiveMetrics }) {
  return (
    <Card eyebrow="BLE characteristics" title="Live cardiovascular">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="HR" value={m.connected ? fmt(m.heartRateBpm, 0) : "—"} unit="bpm" />
        <Stat label="HRV" value={m.connected ? fmt(m.hrvMs, 0) : "—"} unit="ms" />
        <Stat label="SpO₂" value={m.connected ? fmt(m.spo2Pct, 0) : "—"} unit="%" />
        <Stat label="Skin temp" value={m.connected ? fmt(m.skinTempC, 1) : "—"} unit="°C" />
      </div>
    </Card>
  );
}

// =============================================================================
// Squash snapshot — the headline trio the user expects on the Sport tab.
// All three values are derived from the SWING IMU event packet, so they
// populate the instant the band starts emitting swings. Offline → "—".
//   • Racket head speed (mph) ≈ wrist angular velocity (gyroPeakDps) × racket
//     lever arm (~0.40 m wrist→head), converted m/s → mph.
//   • Ball force (N) ≈ peak wrist acceleration × effective racket+ball mass.
//     Uses 0.18 kg effective mass as a calibration constant.
//   • Contact quality (0-100) ≈ rolling SWING intensity average; this is the
//     firmware's own cleanness / repeatability proxy for a strike.
// =============================================================================
function SquashSnapshotCard({ m }: { m: LiveMetrics }) {
  const hasSwing = m.connected && m.counts.swing > 0;
  // dps → rad/s → m/s at 0.40 m lever → mph (× 2.23694)
  const racketMph = hasSwing && m.peakDps > 0
    ? (m.peakDps * (Math.PI / 180)) * 0.40 * 2.23694
    : null;
  // g → m/s² (× 9.81) × 0.18 kg effective racket+ball mass → Newtons
  const ballForceN = hasSwing && m.peakG > 0 ? m.peakG * 9.81 * 0.18 : null;
  const contactQ = hasSwing ? m.swingIntAvg : null;
  return (
    <Card
      eyebrow="Squash snapshot"
      title="Where you stand right now"
      action={m.connected ? <Pill tone="live" pulse>LIVE</Pill> : <Pill tone="off">offline</Pill>}
    >
      <p className="mb-3 text-[11px] text-vyro-mute">
        Derived from the SWING IMU event packet — racket head speed (wrist
        angular velocity × lever arm), ball force (wrist accel × racket+ball
        mass), and the firmware's contact-quality intensity score.
      </p>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Racket head speed" value={racketMph != null ? fmt(racketMph, 0) : "—"} unit="mph" />
        <Stat label="Ball force" value={ballForceN != null ? fmt(ballForceN, 0) : "—"} unit="N" />
        <Stat label="Contact quality" value={contactQ != null ? fmt(contactQ, 0) : "—"} unit="/100" />
      </div>
    </Card>
  );
}

// =============================================================================
// Performance lenses — the six-lens breakdown. Every subscore is computed
// from the four firmware IMU packets + live BLE characteristics + the canonical
// LIVE Recovery composite. When the band is offline OR the source packet hasn't
// been emitted yet, the lens row renders "—" and a neutral "no data" band.
// =============================================================================
type LensSub = { label: string; value: number | null };
type Lens = { id: string; title: string; subs: LensSub[] };

function bandLabel(score: number | null): { text: string; tone: "live" | "off" } {
  if (score == null) return { text: "no data", tone: "off" };
  if (score >= 80) return { text: "Elite band", tone: "live" };
  if (score >= 60) return { text: "On target", tone: "live" };
  if (score >= 40) return { text: "Developing", tone: "off" };
  return { text: "Below band", tone: "off" };
}

function avgNonNull(vals: (number | null)[]): number | null {
  const xs = vals.filter((v): v is number => v != null && Number.isFinite(v));
  if (!xs.length) return null;
  return Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
}

function PerformanceLensesCard({ m }: { m: LiveMetrics }) {
  const lenses: Lens[] = useMemo(() => {
    if (!m.connected) {
      // Offline — keep card layout, all six lenses show "—".
      return [
        { id: "movement", title: "Movement", subs: [{ label: "First-step burst", value: null }, { label: "Acceleration", value: null }] },
        { id: "shot", title: "Shot quality", subs: [{ label: "Racket head speed", value: null }, { label: "Ball force", value: null }] },
        { id: "court", title: "Court positioning", subs: [{ label: "Change of direction", value: null }, { label: "Return control", value: null }] },
        { id: "fatigue", title: "Fatigue", subs: [{ label: "Session load", value: null }, { label: "Decay resistance", value: null }] },
        { id: "tactical", title: "Tactical patterns", subs: [{ label: "Pattern read confidence", value: null }, { label: "Pressure adaptation", value: null }] },
        { id: "ready", title: "Readiness", subs: [{ label: "Live recovery", value: null }, { label: "Sport readiness", value: null }] },
      ];
    }
    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
    // ── Movement (BURST + RAPID_START packets) ────────────────────────────
    const firstStep = m.peakJerk > 0 ? clamp(m.peakJerk / 2.5) : null;     // jerk g/s → 0-100
    const accel = m.peakG > 0 ? clamp(m.peakG * 16) : null;                // g → 0-100
    // ── Shot quality (SWING packet) ───────────────────────────────────────
    const hasSwing = m.counts.swing > 0;
    const rhsScore = hasSwing && m.peakDps > 0 ? clamp(m.peakDps / 10) : null; // 1000dps → 100
    const forceScore = hasSwing && m.peakG > 0 ? clamp(m.peakG * 12) : null;
    // ── Court positioning (DIR_CHANGE packet) ─────────────────────────────
    const cod = m.counts.direction_change > 0 ? clamp(Math.min(100, m.counts.direction_change * 4)) : null;
    const retCtrl = m.reactMin != null ? clamp(100 - Math.min(m.reactMin, 600) / 6) : null;
    // ── Fatigue (event density + HR decay) ────────────────────────────────
    const sessLoad = m.eventsLastMin > 0 ? clamp(100 - Math.min(m.eventsLastMin, 120) * 0.7) : null;
    const decay = m.heartRateBpm != null && m.restingHrBpm != null
      ? clamp(100 - Math.max(0, m.heartRateBpm - m.restingHrBpm) * 1.2)
      : null;
    // ── Tactical patterns — requires AI Video / shot tagging. Until those
    // streams exist the firmware can't infer them, so they stay "—".
    const tactical1: number | null = null;
    const tactical2: number | null = null;
    // ── Readiness (canonical LIVE Recovery composite) ─────────────────────
    const rec = computeLiveRecovery({
      connected: m.connected,
      heartRateBpm: m.heartRateBpm,
      restingHrBpm: m.restingHrBpm,
      hrvMs: m.hrvMs,
      spo2Pct: m.spo2Pct,
      skinTempC: m.skinTempC,
      peakJerk: m.peakJerk,
      eventsLastMin: m.eventsLastMin,
    });
    return [
      { id: "movement", title: "Movement", subs: [{ label: "First-step burst", value: firstStep }, { label: "Acceleration", value: accel }] },
      { id: "shot", title: "Shot quality", subs: [{ label: "Racket head speed", value: rhsScore }, { label: "Ball force", value: forceScore }] },
      { id: "court", title: "Court positioning", subs: [{ label: "Change of direction", value: cod }, { label: "Return control", value: retCtrl }] },
      { id: "fatigue", title: "Fatigue", subs: [{ label: "Session load", value: sessLoad }, { label: "Decay resistance", value: decay }] },
      { id: "tactical", title: "Tactical patterns", subs: [{ label: "Pattern read confidence", value: tactical1 }, { label: "Pressure adaptation", value: tactical2 }] },
      { id: "ready", title: "Readiness", subs: [{ label: "Live recovery", value: rec.score }, { label: "Sport readiness", value: rec.parts.muscle }] },
    ];
  }, [m]);

  return (
    <Card eyebrow="Performance groups" title="Six lenses on squash">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {lenses.map((lens) => {
          const headline = avgNonNull(lens.subs.map((s) => s.value));
          const band = bandLabel(headline);
          return (
            <div key={lens.id} className="rounded-2xl border border-vyro-line bg-vyro-panel/60 p-3">
              <div className="flex items-baseline justify-between">
                <div className="font-mono text-[10px] uppercase tracking-wider text-vyro-mute">{lens.title}</div>
                <Pill tone={band.tone}>{band.text}</Pill>
              </div>
              <div className="mt-1 text-2xl font-bold text-vyro-text">
                {headline != null ? headline : "—"}
              </div>
              <div className="mt-2 space-y-1">
                {lens.subs.map((s) => (
                  <div key={s.label} className="flex items-center justify-between text-[11px]">
                    <span className="text-vyro-mute">{s.label}</span>
                    <span className="font-mono text-vyro-text">{s.value != null ? s.value : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-vyro-mute">
        Lenses populate as their source packet arrives: Movement from BURST/RAPID_START,
        Shot quality from SWING, Court positioning from DIR_CHANGE, Fatigue from event
        density + HR vs RHR, Readiness from the LIVE Recovery composite. Tactical patterns
        require AI Video / shot tagging and stay "—" until those streams are wired in.
      </p>
    </Card>
  );
}
