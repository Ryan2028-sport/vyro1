import { Card, PageHeader, Pill, Stat } from "./shared";
import { fmtNum, useLiveMetrics } from "./useLiveMetrics";

// Swing & racket-motion view from the VYRO spec. Per-swing peaks already
// come from the band's swing event; technical labels (face angle, contact
// side, contact point) need AI Video or model calibration.
export function SwingView() {
  const m = useLiveMetrics();
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Per-swing · IMU"
        title="Swing & racket motion"
        subtitle="Live wrist-IMU shot detection. Pair AI Video for face angle and contact labels."
        action={<Pill tone={m.connected ? "live" : "off"} pulse={m.sessionState === "live"}>
          {m.sessionState === "live" ? "RECORDING" : m.connected ? "READY" : "OFFLINE"}
        </Pill>}
      />

      <Card eyebrow="Detection · live" title="Swing counts">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Swings" value={m.connected ? m.counts.swing : "—"} />
          <Stat label="Bursts" value={m.connected ? m.counts.burst : "—"} />
          <Stat label="Direction Δ" value={m.connected ? m.counts.direction_change : "—"} />
          <Stat label="Rapid starts" value={m.connected ? m.counts.rapid_start : "—"} />
        </div>
      </Card>

      <Card eyebrow="Power" title="Racket motion">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Peak accel" value={fmtNum(m.peakG, m.connected, 2)} unit="g" />
          <Stat label="Peak gyro" value={fmtNum(m.peakDps, m.connected, 0)} unit="dps" />
          <Stat label="Peak jerk" value={fmtNum(m.peakJerk, m.connected, 1)} unit="g/s" />
          <Stat label="Head speed" value="—" unit="mph" hint="calibration needed" />
        </div>
      </Card>

      <Card eyebrow="Per-swing" title="Quality & duration">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Max intensity" value={fmtNum(m.swingIntMax, m.connected, 0)} unit="/100" />
          <Stat label="Avg (10) intensity" value={fmtNum(m.swingIntAvg, m.connected, 0)} unit="/100" />
          <Stat label="Max duration" value={fmtNum(m.swingDurMax, m.connected, 0)} unit="ms" />
          <Stat label="Avg (10) duration" value={fmtNum(m.swingDurAvg, m.connected, 0)} unit="ms" />
        </div>
      </Card>

      <Card eyebrow="Technique · needs AI Video" title="Shape & contact">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Racket face angle" value="—" hint="open / square / closed" />
          <Stat label="Contact side" value="—" />
          <Stat label="Contact point" value="—" hint="ahead of body" />
          <Stat label="Back-swing dist" value="—" unit="cm" />
          <Stat label="Follow-through" value="—" unit="cm" />
          <Stat label="Height variance" value="—" />
        </div>
      </Card>

      <Card eyebrow="Profiles · post-session" title="Optimization">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Stat label="Power-optimized" value="—" hint="highest force pattern" />
          <Stat label="Accuracy-optimized" value="—" hint="highest margin pattern" />
          <Stat label="Power + accuracy" value="—" hint="best combined" />
        </div>
      </Card>
    </div>
  );
}
