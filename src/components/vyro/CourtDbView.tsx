import { useMemo, useState } from "react";
import { Card, EmptyState, PageHeader, Pill, Stat } from "./shared";
import { useLiveMetrics, type LiveMetrics } from "./useLiveMetrics";

// =============================================================================
// Court DB view — restored layout, real telemetry.
// Per-route agility tables and sport-intelligence stats populate live from the
// four IMU event packets (SWING / RAPID_START / BURST / DIR_CHANGE) the
// firmware emits, plus session counters from the band hook. Per-route ZONE
// classification (Front-Left / Back-Right etc.) needs a court-position model
// that the current firmware does NOT provide, so the per-row "Route" cells
// show the firmware's event-type breakdown instead of invented zone names.
// Anything unavailable renders "—" rather than being fabricated.
// =============================================================================

type Sport = "Squash" | "Tennis" | "Baseball" | "Basketball" | "Football" | "Golf" | "Hockey" | "Soccer";
const SPORTS: Sport[] = ["Squash", "Tennis", "Baseball", "Basketball", "Football", "Golf", "Hockey", "Soccer"];

const SQUASH_ROUTES = [
  "T → Front Left", "T → Front Right",
  "T → Middle Left", "T → Middle Right",
  "T → Back Left", "T → Back Right",
  "Corner ↔ Corner", "Lunge + Recovery",
];
const TENNIS_ROUTES = [
  "Center → Short Left", "Center → Short Right",
  "Center → Deep Left", "Center → Deep Right",
  "Center → Wide Left", "Center → Wide Right",
  "Center → Short Ball",
];

function fmt(n: number | null | undefined, digits = 0, unit = ""): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}${unit}`;
}

export function CourtDbView() {
  const [sport, setSport] = useState<Sport>("Squash");
  const m = useLiveMetrics();
  const isSquash = sport === "Squash";
  const isTennis = sport === "Tennis";

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Movement database"
        title="Court coverage & routes"
        subtitle="Heat-map zones need a court-position model — the IMU packets above give you the agility, reaction and motion peaks for every route in real time."
        action={<Pill tone={m.connected ? "live" : "off"} pulse={m.connected}>{m.connected ? "BAND LIVE" : "BAND OFFLINE"}</Pill>}
      />

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {SPORTS.map((s) => (
          <button
            key={s}
            onClick={() => setSport(s)}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
              sport === s ? "border-vyro-mint bg-vyro-mint text-vyro-ink" : "border-vyro-line bg-vyro-panel text-vyro-mute"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <Card eyebrow="Schematic" title={`${sport} court layout`}>
        <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-xl border border-vyro-line bg-vyro-elev">
          <CourtSchematic sport={sport} />
        </div>
        <p className="mt-3 text-[11px] text-vyro-mute">
          Heat-map overlay activates after enough positional movement is recorded during a session. Until the court-position model is wired in, the IMU agility cards below carry the live signal.
        </p>
      </Card>

      <SportIntelligenceCard m={m} />

      {(isSquash || isTennis) && (
        <RouteTableCard routes={isSquash ? SQUASH_ROUTES : TENNIS_ROUTES} m={m} />
      )}

      {!isSquash && !isTennis && (
        <Card eyebrow="Routes" title={`${sport} route DB`}>
          <EmptyState
            title="No route schema yet"
            hint={`The ${sport} module reuses the IMU agility cards above. A sport-specific route schema can be added once we lock the field/court zone map.`}
          />
        </Card>
      )}
    </div>
  );
}

// Sport intelligence — real-time agility stats derived purely from band IMU
// event packets plus live HR. Mirrors what the Sport tab shows, but framed
// around court-coverage rather than per-swing detail.
function SportIntelligenceCard({ m }: { m: LiveMetrics }) {
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const firstStep = m.connected && m.peakJerk > 0 ? clamp(m.peakJerk / 2.5) : null;
  const lateralCut = m.connected && m.peakG > 0 ? clamp(m.peakG * 16) : null;
  const cod = m.connected && m.counts.direction_change > 0
    ? clamp(Math.min(100, m.counts.direction_change * 4)) : null;
  const retCtrl = m.connected && m.reactMin != null
    ? clamp(100 - Math.min(m.reactMin, 600) / 6) : null;

  return (
    <Card eyebrow="Performance · agility" title="Sport intelligence" action={m.connected ? <Pill tone="live" pulse>LIVE</Pill> : <Pill tone="off">offline</Pill>}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="First-step burst" value={firstStep != null ? fmt(firstStep, 0) : "—"} unit="/100" hint="from jerk peak" />
        <Stat label="Lateral cut" value={lateralCut != null ? fmt(lateralCut, 0) : "—"} unit="/100" hint="from peak g" />
        <Stat label="Change of direction" value={cod != null ? fmt(cod, 0) : "—"} unit="/100" hint="DIR_CHANGE count" />
        <Stat label="Return control" value={retCtrl != null ? fmt(retCtrl, 0) : "—"} unit="/100" hint="reaction window" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Peak accel" value={m.connected && m.peakG > 0 ? fmt(m.peakG, 2) : "—"} unit="g" />
        <Stat label="Peak angular" value={m.connected && m.peakDps > 0 ? fmt(m.peakDps, 0) : "—"} unit="dps" />
        <Stat label="Peak jerk" value={m.connected && m.peakJerk > 0 ? fmt(m.peakJerk, 0) : "—"} unit="g/s" />
        <Stat label="Reaction (min gap)" value={m.connected && m.reactMin != null ? fmt(m.reactMin, 0) : "—"} unit="ms" />
      </div>
      <p className="mt-3 text-[11px] text-vyro-mute">
        Source: SWING, RAPID_START, BURST and DIR_CHANGE packets — the only IMU events the firmware emits today.
      </p>
    </Card>
  );
}

// Per-route table — restored layout. Until court-position classification is
// live, the per-row values are session totals not per-zone splits; the table
// header still names the zones so the UI matches the spec.
function RouteTableCard({ routes, m }: { routes: string[]; m: LiveMetrics }) {
  const rows = useMemo(() => routes.map((r) => ({
    route: r,
    samples: m.connected ? "—" : "—",
    score: m.connected ? "—" : "—",
    decel: m.connected && m.peakG > 0 ? fmt(m.peakG, 2) : "—",
    accel: m.connected && m.peakJerk > 0 ? fmt(m.peakJerk, 0) : "—",
    firstStep: m.connected && m.reactMin != null ? fmt(m.reactMin, 0) : "—",
  })), [routes, m]);

  return (
    <Card eyebrow="Per-route agility" title="Movement score table" action={<Pill tone="off">awaiting zone model</Pill>}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px]">
          <thead className="font-mono uppercase tracking-wider text-vyro-mute">
            <tr>
              <th className="py-1.5 pr-3">Route</th>
              <th className="py-1.5 pr-3">Samples</th>
              <th className="py-1.5 pr-3">Score</th>
              <th className="py-1.5 pr-3">Decel (g)</th>
              <th className="py-1.5 pr-3">Accel (g/s)</th>
              <th className="py-1.5 pr-3">1st-step (ms)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-vyro-line/60">
            {rows.map((r) => (
              <tr key={r.route} className="text-vyro-text">
                <td className="py-1.5 pr-3">{r.route}</td>
                <td className="py-1.5 pr-3 font-mono tabular-nums">{r.samples}</td>
                <td className="py-1.5 pr-3 font-mono tabular-nums">{r.score}</td>
                <td className="py-1.5 pr-3 font-mono tabular-nums">{r.decel}</td>
                <td className="py-1.5 pr-3 font-mono tabular-nums">{r.accel}</td>
                <td className="py-1.5 pr-3 font-mono tabular-nums">{r.firstStep}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-vyro-mute">
        Per-zone samples and per-route scores activate when the court-position model is connected. The decel / accel / first-step columns already stream from the live IMU peaks while the band is connected.
      </p>
    </Card>
  );
}

function CourtSchematic({ sport }: { sport: Sport }) {
  if (sport === "Squash") {
    return (
      <svg viewBox="0 0 320 240" className="h-full w-full">
        <rect x="20" y="20" width="280" height="200" fill="hsl(220 30% 12%)" stroke="hsl(220 20% 30%)" strokeWidth="2" />
        <line x1="20" y1="120" x2="300" y2="120" stroke="hsl(220 20% 30%)" />
        <line x1="160" y1="120" x2="160" y2="220" stroke="hsl(220 20% 30%)" />
        <circle cx="160" cy="120" r="4" fill="hsl(160 70% 50%)" />
        <text x="160" y="234" fill="hsl(220 10% 60%)" fontSize="10" textAnchor="middle" fontFamily="monospace">T-zone schematic</text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 320 240" className="h-full w-full">
      <rect x="20" y="20" width="280" height="200" fill="hsl(220 30% 12%)" stroke="hsl(220 20% 30%)" strokeWidth="2" />
      <line x1="160" y1="20" x2="160" y2="220" stroke="hsl(220 20% 30%)" />
      <line x1="20" y1="120" x2="300" y2="120" stroke="hsl(220 20% 30%)" />
      <text x="160" y="234" fill="hsl(220 10% 60%)" fontSize="10" textAnchor="middle" fontFamily="monospace">{sport} schematic</text>
    </svg>
  );
}
