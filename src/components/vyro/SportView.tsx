import { useMemo } from "react";
import { Card, EmptyState, PageHeader, Pill, Stat } from "./shared";
import { useVyroScores, type SportId } from "./VyroScoresProvider";
import { type LiveMetrics } from "./useLiveMetrics";

// ============================================================================
// Sport overview — STRICT real-telemetry-only mode.
// Every value is derived from the four IMU event packets the firmware emits
// (SWING / RAPID_START / BURST / DIR_CHANGE) plus the live BLE characteristics.
// The selected sport comes from the GLOBAL scores provider, so switching to
// Tennis switches every label, lever-arm constant and route set in the app —
// no squash data bleeds through.
// ============================================================================

function fmt(n: number | null | undefined, digits = 0, unit = ""): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}${unit}`;
}

export const SPORT_META: Record<SportId, {
  label: string;
  emoji: string;
  /** wrist → racket-head lever arm in metres, used for head-speed estimation */
  leverArmM: number;
  /** effective racket + ball mass in kg, used for impact force estimation */
  effectiveMassKg: number;
  routes: string[];
  courtNote: string;
}> = {
  squash: {
    label: "Squash",
    emoji: "🎾",
    leverArmM: 0.40,
    effectiveMassKg: 0.18,
    routes: [
      "T → Front Left", "T → Front Right",
      "T → Middle Left", "T → Middle Right",
      "T → Back Left", "T → Back Right",
      "Corner ↔ Corner", "Lunge + Recovery",
    ],
    courtNote: "T-zone recovery drives squash movement scoring.",
  },
  tennis: {
    label: "Tennis",
    emoji: "🎾",
    leverArmM: 0.55,
    effectiveMassKg: 0.30,
    routes: [
      "Center → Short Left", "Center → Short Right",
      "Center → Deep Left", "Center → Deep Right",
      "Center → Wide Left", "Center → Wide Right",
      "Baseline → Net approach",
    ],
    courtNote: "Baseline recovery and wide-ball coverage drive tennis movement scoring.",
  },
};

export function SportView() {
  const s = useVyroScores();
  const m = s.m;
  const meta = SPORT_META[s.sport];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={`${meta.label} · Live telemetry`}
        title={`${meta.label} session metrics`}
        subtitle="All values come from the band's IMU event packets plus the BLE vitals characteristics. Anything we can't measure shows as “—”."
        action={
          <Pill tone={m.connected ? "live" : "off"} pulse={m.connected}>
            {m.connected ? "BAND LIVE" : "BAND OFFLINE"}
          </Pill>
        }
      />

      <SportSwitcher />
      <SnapshotCard />
      <PerformanceLensesCard />
      <EventCountsCard m={m} />
      <SwingCard m={m} />
      <VitalsCard m={m} />

      <Card eyebrow="Past sessions" title="0 logged">
        <EmptyState
          title={`No ${meta.label.toLowerCase()} sessions yet`}
          hint="Start a session from the Session tab. Once the band is streaming, your IMU event totals are recorded here for this sport only."
        />
      </Card>
    </div>
  );
}

export function SportSwitcher() {
  const { sport, setSport } = useVyroScores();
  return (
    <div className="flex gap-1 rounded-full border border-vyro-line bg-vyro-text/[0.035] p-1">
      {(Object.keys(SPORT_META) as SportId[]).map((id) => {
        const active = sport === id;
        return (
          <button
            key={id}
            onClick={() => setSport(id)}
            aria-pressed={active}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[11.5px] transition-all duration-200 ease-out active:scale-[0.97] ${
              active
                ? "bg-vyro-mint/[0.14] font-extrabold text-vyro-mint shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "font-semibold text-vyro-mute hover:bg-vyro-text/[0.05] hover:text-vyro-text"
            }`}
          >
            <span aria-hidden="true" className="text-[12px] leading-none">{SPORT_META[id].emoji}</span>
            {SPORT_META[id].label}
          </button>
        );
      })}
    </div>
  );
}


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

// Motion peaks + reaction window — the "Movement" sub-tab of the Sport tab.
export function MovementPanel() {
  const s = useVyroScores();
  const m = s.m;
  const meta = SPORT_META[s.sport];
  const hasMotion = m.connected && (m.peakG > 0 || m.peakDps > 0 || m.peakJerk > 0);

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

  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const firstStep = hasMotion && m.peakJerk > 0 ? clamp(m.peakJerk / 2.5) : null;
  const lateralCut = hasMotion && m.peakG > 0 ? clamp(m.peakG * 16) : null;
  const cod = m.connected && m.counts.direction_change > 0 ? clamp(m.counts.direction_change * 4) : null;
  const retCtrl = m.connected && m.reactMin != null ? clamp(100 - Math.min(m.reactMin, 600) / 6) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={`${meta.label} · movement`}
        title="Court movement & agility"
        subtitle={meta.courtNote}
        action={<Pill tone={m.connected ? "live" : "off"} pulse={m.connected}>{m.connected ? "BAND LIVE" : "BAND OFFLINE"}</Pill>}
      />
      <SportSwitcher />

      <Card eyebrow="Motion peaks" title="Per-session maxima across all packets">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Peak accel" value={hasMotion && m.peakG > 0 ? fmt(m.peakG, 2) : "—"} unit="g" />
          <Stat label="Peak angular" value={hasMotion && m.peakDps > 0 ? fmt(m.peakDps, 0) : "—"} unit="dps" />
          <Stat label="Peak jerk" value={hasMotion && m.peakJerk > 0 ? fmt(m.peakJerk, 0) : "—"} unit="g/s" />
        </div>
        <p className="mt-3 text-[11px] text-vyro-mute">
          Source: <span className="font-mono text-vyro-text">accelPeakG / gyroPeakDps / jerkPeakGps</span> on each packet.
        </p>
      </Card>

      <Card eyebrow="Agility" title="Derived movement scores">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="First-step burst" value={firstStep ?? "—"} unit="/100" hint="jerk peak" />
          <Stat label="Lateral cut" value={lateralCut ?? "—"} unit="/100" hint="peak g" />
          <Stat label="Change of direction" value={cod ?? "—"} unit="/100" hint="DIR_CHANGE count" />
          <Stat label="Return control" value={retCtrl ?? "—"} unit="/100" hint="reaction window" />
        </div>
      </Card>

      <Card eyebrow="DIR_CHANGE packet" title="Reaction window">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Fastest gap" value={m.connected && m.reactMin != null ? fmt(m.reactMin, 0) : "—"} unit="ms" />
          <Stat label="Avg gap (last 10)" value={reactAvg != null ? fmt(reactAvg, 0) : "—"} unit="ms" />
        </div>
        <p className="mt-3 text-[11px] text-vyro-mute">
          Gap between consecutive direction changes — the only reaction-time proxy the firmware emits today.
        </p>
      </Card>

      <Card eyebrow={`${meta.label} routes`} title="Route coverage">
        <div className="grid grid-cols-2 gap-2">
          {meta.routes.map((r) => (
            <Stat key={r} label={r} value="—" hint="needs court-position model" />
          ))}
        </div>
      </Card>
    </div>
  );
}

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

// Sport-aware snapshot. Lever arm and effective mass differ per sport, so the
// same wrist IMU frame yields sport-correct head speed and impact force.
function SnapshotCard() {
  const s = useVyroScores();
  const m = s.m;
  const meta = SPORT_META[s.sport];
  const hasSwing = m.connected && m.counts.swing > 0;
  const racketMph = hasSwing && m.peakDps > 0
    ? (m.peakDps * (Math.PI / 180)) * meta.leverArmM * 2.23694
    : null;
  const ballForceN = hasSwing && m.peakG > 0 ? m.peakG * 9.81 * meta.effectiveMassKg : null;
  const contactQ = hasSwing ? m.swingIntAvg : null;
  return (
    <Card
      eyebrow={`${meta.label} snapshot`}
      title="Where you stand right now"
      action={m.connected ? <Pill tone="live" pulse>LIVE</Pill> : <Pill tone="off">offline</Pill>}
    >
      <p className="mb-3 text-[11px] text-vyro-mute">
        Derived from the SWING IMU packet using {meta.label.toLowerCase()} constants
        (lever arm {meta.leverArmM.toFixed(2)} m, effective mass {meta.effectiveMassKg.toFixed(2)} kg).
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
// Performance lenses. "Live recovery" reads the SAME canonical composite the
// Recovery tab shows — no averaging, no second formula.
// =============================================================================
type LensSub = { label: string; value: number | null };
type Lens = { id: string; title: string; headline: number | null; subs: LensSub[] };

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

function PerformanceLensesCard() {
  const s = useVyroScores();
  const m = s.m;
  const meta = SPORT_META[s.sport];

  const lenses: Lens[] = useMemo(() => {
    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
    const on = m.connected;
    const firstStep = on && m.peakJerk > 0 ? clamp(m.peakJerk / 2.5) : null;
    const accel = on && m.peakG > 0 ? clamp(m.peakG * 16) : null;
    const hasSwing = on && m.counts.swing > 0;
    const rhsScore = hasSwing && m.peakDps > 0 ? clamp(m.peakDps / (s.sport === "tennis" ? 14 : 10)) : null;
    const forceScore = hasSwing && m.peakG > 0 ? clamp(m.peakG * 12) : null;
    const cod = on && m.counts.direction_change > 0 ? clamp(m.counts.direction_change * 4) : null;
    const retCtrl = on && m.reactMin != null ? clamp(100 - Math.min(m.reactMin, 600) / 6) : null;
    const sessLoad = on && m.eventsLastMin > 0 ? clamp(100 - Math.min(m.eventsLastMin, 120) * 0.7) : null;
    const decay = on && m.heartRateBpm != null && m.restingHrBpm != null
      ? clamp(100 - Math.max(0, m.heartRateBpm - m.restingHrBpm) * 1.2)
      : null;

    const movement: Lens = { id: "movement", title: "Movement", headline: avgNonNull([firstStep, accel]), subs: [{ label: "First-step burst", value: firstStep }, { label: "Acceleration", value: accel }] };
    const shot: Lens = { id: "shot", title: "Shot quality", headline: avgNonNull([rhsScore, forceScore]), subs: [{ label: "Racket head speed", value: rhsScore }, { label: "Ball force", value: forceScore }] };
    const court: Lens = { id: "court", title: "Court positioning", headline: avgNonNull([cod, retCtrl]), subs: [{ label: "Change of direction", value: cod }, { label: "Return control", value: retCtrl }] };
    const fatigueLens: Lens = { id: "fatigue", title: "Fatigue", headline: avgNonNull([sessLoad, decay]), subs: [{ label: "Session load", value: sessLoad }, { label: "Decay resistance", value: decay }] };
    const tactical: Lens = { id: "tactical", title: "Tactical patterns", headline: null, subs: [{ label: "Pattern read confidence", value: null }, { label: "Pressure adaptation", value: null }] };
    // Readiness lens = the canonical recovery composite, verbatim.
    const ready: Lens = {
      id: "ready",
      title: "Readiness",
      headline: s.recovery,
      subs: [
        { label: "Live recovery", value: s.recovery },
        { label: "Muscle readiness", value: s.parts.muscle },
      ],
    };
    return [movement, shot, court, fatigueLens, tactical, ready];
  }, [m, s.recovery, s.parts.muscle, s.sport]);

  return (
    <Card eyebrow="Performance groups" title={`Six lenses on ${meta.label.toLowerCase()}`}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {lenses.map((lens) => {
          const band = bandLabel(lens.headline);
          return (
            <div key={lens.id} className="rounded-2xl border border-vyro-line bg-vyro-panel/60 p-3">
              <div className="flex items-baseline justify-between">
                <div className="font-mono text-[10px] uppercase tracking-wider text-vyro-mute">{lens.title}</div>
                <Pill tone={band.tone}>{band.text}</Pill>
              </div>
              <div className="mt-1 text-2xl font-bold text-vyro-text">{lens.headline ?? "—"}</div>
              <div className="mt-2 space-y-1">
                {lens.subs.map((sub) => (
                  <div key={sub.label} className="flex items-center justify-between text-[11px]">
                    <span className="text-vyro-mute">{sub.label}</span>
                    <span className="font-mono text-vyro-text">{sub.value ?? "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-vyro-mute">
        Movement comes from BURST/RAPID_START, Shot quality from SWING, Court positioning from DIR_CHANGE,
        Fatigue from event density + HR, and Readiness from the same LIVE Recovery composite the Recovery tab shows.
      </p>
    </Card>
  );
}
