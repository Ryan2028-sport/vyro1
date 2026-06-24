import { useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Card, EmptyState, PageHeader, Pill, Stat } from "./shared";
import { SPORT_PROFILES, type SportProfile } from "./sportProfiles";
import { useLiveMetrics, type LiveMetrics } from "./useLiveMetrics";

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
