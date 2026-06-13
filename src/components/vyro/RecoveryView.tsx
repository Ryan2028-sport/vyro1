import { Card, PageHeader, Pill, Stat } from "./shared";
import { recoveryBand, useLiveMetrics } from "./useLiveMetrics";

// Recovery & fatigue dashboard from the VYRO spec. Recovery score itself
// requires HRV + RHR + sleep + load — none of which the firmware ships yet,
// so we render placeholders and show the "unknown" band rather than faking
// a green light. Layout matches the spec so wiring is a one-line change
// per metric when the firmware lands.
export function RecoveryView() {
  const m = useLiveMetrics();
  const score: number | null = null; // populated when HRV/RHR/sleep arrive
  const band = recoveryBand(score);
  const tone = band === "green" ? "live" : band === "red" ? "off" : "warn";
  const bandLabel =
    band === "green" ? "READY" : band === "red" ? "NOT READY" : band === "yellow" ? "CAUTION" : "PENDING";

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Readiness · live"
        title="Recovery & fatigue"
        subtitle="LIVE recovery streams every second from HR, HRV, load, sleep and skin temp."
        action={<Pill tone={tone} pulse={band === "green"}>{bandLabel}</Pill>}
      />

      <Card eyebrow="LIVE recovery" title="Readiness">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Recovery score" value="—" unit="%" hint="every 1 s" />
          <Stat label="Time to 80%" value="—" unit="min" />
          <Stat label="Time-to-ready" value="—" unit="min" />
          <Stat label="Overnight readiness" value="—" unit="%" hint="after wake" />
        </div>
      </Card>

      <Card eyebrow="Fatigue · composite" title="Total fatigue">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Total fatigue" value="—" unit="/100" />
          <Stat label="Court coverage" value="—" unit="/100" />
          <Stat label="Cardio fatigue" value="—" unit="/100" />
          <Stat label="Muscle load debt" value="—" unit="/100" />
          <Stat label="HRV suppression" value="—" unit="%" />
          <Stat label="Sleep debt impact" value="—" unit="%" />
        </div>
      </Card>

      <Card eyebrow="Markers" title="Recovery markers">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Cardio recovery" value="—" hint="HR return curve" />
          <Stat label="Muscle readiness" value="—" hint="IMU decel load" />
          <Stat label="Cognitive divergence" value="—" hint="HR vs reaction" />
        </div>
      </Card>

      <Card eyebrow="Tournament" title="Return-to-Play">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="RTP validator" value="—" hint="symmetry · power" />
          <Stat label="Load debt" value="—" hint="rolling 7-day" />
          <Stat label="Recovery environment" value="—" hint="sleep · temp · resp" />
        </div>
      </Card>

      <Card eyebrow="Band signal" title="What the band is sending now">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Events / min" value={m.connected ? m.eventsLastMin : "—"} />
          <Stat label="Peak accel" value={m.connected ? m.peakG.toFixed(2) : "—"} unit="g" />
          <Stat label="Session state" value={m.sessionState} />
        </div>
      </Card>
    </div>
  );
}
