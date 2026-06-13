import { Card, PageHeader, Pill, Stat } from "./shared";
import { useLiveMetrics } from "./useLiveMetrics";

// Athlete health hub — 24/7 metrics from the VYRO spec. Values render as
// "—" until firmware publishes the corresponding characteristic; the IMU
// metrics already flow through from the band.
export function AthleteView() {
  const m = useLiveMetrics();
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Athlete · 24/7"
        title="Athlete health"
        subtitle="Live health and activity from the band. Streams continuously while worn."
        action={<Pill tone={m.connected ? "live" : "off"} pulse={m.connected}>{m.connected ? "live" : "no watch"}</Pill>}
      />

      <Card eyebrow="Heart" title="Cardiac">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Current HR" value="—" unit="bpm" hint="every 1 s" />
          <Stat label="Resting HR" value="—" unit="bpm" hint="nightly" />
          <Stat label="HRV (RMSSD)" value="—" unit="ms" hint="every 5 min" />
          <Stat label="Stress score" value="—" hint="HR · HRV · RR" />
        </div>
      </Card>

      <Card eyebrow="Respiration · O₂ · temp" title="Physiology">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Respiratory rate" value="—" unit="br/min" hint="every 3 min" />
          <Stat label="SpO₂" value="—" unit="%" hint="every 3 min" />
          <Stat label="Skin temp" value="—" unit="°C" hint="every 3 min" />
        </div>
      </Card>

      <Card eyebrow="Activity · all-day" title="Movement">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Steps" value="—" hint="every 1 s" />
          <Stat label="Active calories" value="—" unit="kcal" hint="every 60 s" />
          <Stat label="Resting calories" value="—" unit="kcal" hint="BMR" />
          <Stat label="Total calories" value="—" unit="kcal" />
        </div>
      </Card>

      <Card eyebrow="IMU · live from band" title="Motion (band)">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Events / min" value={m.connected ? m.eventsLastMin : "—"} hint="rolling 60 s" />
          <Stat label="Total events" value={m.connected ? m.events.length : "—"} hint="this session" />
          <Stat label="Peak accel" value={m.connected ? m.peakG.toFixed(2) : "—"} unit="g" />
          <Stat label="Peak jerk" value={m.connected ? m.peakJerk.toFixed(1) : "—"} unit="g/s" />
        </div>
      </Card>

      <Card eyebrow="Data integrity" title="Confidence">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Wear time" value="—" unit="h" hint="every 60 s" />
          <Stat label="Signal confidence" value="—" unit="%" hint="every 60 s" />
          <Stat label="Battery" value="—" unit="%" hint="every 60 s" />
        </div>
      </Card>
    </div>
  );
}
