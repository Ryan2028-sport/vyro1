import { useState } from "react";
import { Card, PageHeader, Pill, Stat } from "./shared";

type Sport = "Squash" | "Tennis" | "Baseball" | "Basketball" | "Football" | "Golf" | "Hockey" | "Soccer";
const SPORTS: Sport[] = ["Squash", "Tennis", "Baseball", "Basketball", "Football", "Golf", "Hockey", "Soccer"];

const SQUASH_ZONES = [
  "Back left", "Back right",
  "Left middle volley", "Right middle volley",
  "Left front", "Right front",
  "Center mark",
];

const SQUASH_ROUTES = [
  { route: "T → Back left",  score: 78, steps: 4, time: 1.42, decel: 0.62, lead: "Right" },
  { route: "T → Back right", score: 82, steps: 4, time: 1.36, decel: 0.71, lead: "Left" },
  { route: "T → Front left", score: 74, steps: 3, time: 1.18, decel: 0.55, lead: "Right" },
  { route: "T → Front right",score: 80, steps: 3, time: 1.12, decel: 0.61, lead: "Left" },
  { route: "Crossover 1",    score: 86, steps: 2, time: 0.78, decel: 0.49, lead: "Left" },
  { route: "Crossover 2",    score: 81, steps: 2, time: 0.82, decel: 0.52, lead: "Right" },
  { route: "Wide-to-wide recovery", score: 69, steps: 5, time: 1.91, decel: 0.78, lead: "Mixed" },
];

const TENNIS_ROUTES = [
  { route: "Deep wide-left",  score: 76, steps: 5, time: 1.65, decel: 0.71, lead: "Right" },
  { route: "Deep wide-right", score: 79, steps: 5, time: 1.58, decel: 0.69, lead: "Left" },
  { route: "Lateral wide-left",  score: 84, steps: 3, time: 1.10, decel: 0.55, lead: "Left" },
  { route: "Lateral wide-right", score: 82, steps: 3, time: 1.12, decel: 0.58, lead: "Right" },
  { route: "Diagonal forward-left",  score: 81, steps: 4, time: 1.32, decel: 0.61, lead: "Left" },
  { route: "Diagonal forward-right", score: 80, steps: 4, time: 1.34, decel: 0.63, lead: "Right" },
  { route: "Short ball",      score: 88, steps: 2, time: 0.74, decel: 0.42, lead: "Right" },
];

export function CourtDbView() {
  const [sport, setSport] = useState<Sport>("Squash");
  const isSquash = sport === "Squash";
  const isTennis = sport === "Tennis";
  const routes = isTennis ? TENNIS_ROUTES : isSquash ? SQUASH_ROUTES : [];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Movement database"
        title={isSquash ? "T movement by zone" : isTennis ? "Center-mark footwork by zone" : "Movement database"}
        subtitle="Heat maps + opponent tendencies. Tennis court zones, wide-ball movement, serve-plus-one reads, and pressure-point shot profiles."
        action={<Pill tone="live" pulse>Live</Pill>}
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

      <Card eyebrow="Heat map" title={`${sport} court coverage`}>
        <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-xl border border-vyro-line bg-vyro-elev">
          <HeatmapPlaceholder sport={sport} />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-wider text-vyro-mute">Low</span>
          <div className="mx-3 h-2 flex-1 rounded-full" style={{ background: "linear-gradient(90deg, hsl(220 60% 20%), hsl(180 70% 40%), hsl(140 70% 50%), hsl(60 90% 55%), hsl(20 90% 55%), hsl(0 80% 55%))" }} />
          <span className="font-mono text-[9px] uppercase tracking-wider text-vyro-mute">High</span>
        </div>
      </Card>

      {isSquash && (
        <Card eyebrow="Zones · squash" title="Center mark · zone occupancy">
          <ul className="grid grid-cols-2 gap-1.5 text-[11px] sm:grid-cols-3">
            {SQUASH_ZONES.map((z) => (
              <li key={z} className="rounded-lg border border-vyro-line bg-vyro-elev px-2.5 py-2 text-vyro-text">{z}</li>
            ))}
          </ul>
        </Card>
      )}

      {(isSquash || isTennis) && (
        <Card eyebrow={isTennis ? "Movement score table · tennis" : "Movement score table · squash"} title="Per-route agility">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="text-vyro-mute">
                  <th className="py-1 pr-2 font-mono text-[9px] uppercase tracking-wider">Route</th>
                  <th className="py-1 pr-2 font-mono text-[9px] uppercase tracking-wider">Score</th>
                  <th className="py-1 pr-2 font-mono text-[9px] uppercase tracking-wider">Steps</th>
                  <th className="py-1 pr-2 font-mono text-[9px] uppercase tracking-wider">Time</th>
                  <th className="py-1 pr-2 font-mono text-[9px] uppercase tracking-wider">Decel</th>
                  <th className="py-1 font-mono text-[9px] uppercase tracking-wider">Lead</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-vyro-line/60">
                {routes.map((r) => (
                  <tr key={r.route}>
                    <td className="py-2 pr-2 text-vyro-text">{r.route}</td>
                    <td className="py-2 pr-2 font-bold tabular-nums text-vyro-text">{r.score}</td>
                    <td className="py-2 pr-2 tabular-nums text-vyro-mute">{r.steps}</td>
                    <td className="py-2 pr-2 tabular-nums text-vyro-mute">{r.time.toFixed(2)}s</td>
                    <td className="py-2 pr-2 tabular-nums text-vyro-mute">{r.decel.toFixed(2)}g</td>
                    <td className="py-2 text-vyro-mute">{r.lead}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-vyro-mute">
            Columns: <span className="text-vyro-text">Steps to position</span> · <span className="text-vyro-text">Time to position</span> · <span className="text-vyro-text">Decel into position</span> · Leading foot in/out.
          </p>
        </Card>
      )}

      {isTennis && (
        <Card eyebrow="Tennis step-length profile" title="Length × acceleration">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Avg step length" value="0.74" unit="m" />
            <Stat label="Burst step length" value="1.08" unit="m" />
            <Stat label="Avg accel" value="3.4" unit="m/s²" />
            <Stat label="Peak accel" value="6.2" unit="m/s²" />
          </div>
        </Card>
      )}

      <Card eyebrow="Performance · agility" title="Sport intelligence">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Agility score" value="—" unit="/100" />
          <Stat label="First-step burst" value="—" unit="g" />
          <Stat label="Lateral cut" value="—" unit="/100" />
          <Stat label="Return control" value="—" unit="/100" />
          <Stat label="Deceleration" value="—" unit="/100" />
          <Stat label="Change of direction" value="—" unit="/100" />
          <Stat label="Movement tech" value="—" unit="/100" />
          <Stat label="Zone occupancy" value="—" unit="s" />
        </div>
        <p className="mt-2 text-[11px] text-vyro-mute">Glossary: <span className="text-vyro-text">Change of direction</span>, not shorthand average.</p>
      </Card>
    </div>
  );
}

function HeatmapPlaceholder({ sport }: { sport: Sport }) {
  if (sport === "Squash") {
    return (
      <svg viewBox="0 0 320 240" className="h-full w-full">
        <rect x="20" y="20" width="280" height="200" fill="hsl(220 30% 12%)" stroke="hsl(220 20% 30%)" strokeWidth="2" />
        <line x1="20" y1="120" x2="300" y2="120" stroke="hsl(220 20% 30%)" />
        <line x1="160" y1="120" x2="160" y2="220" stroke="hsl(220 20% 30%)" />
        <rect x="120" y="80" width="80" height="80" fill="hsl(140 70% 50% / 0.55)" />
        <rect x="60" y="140" width="60" height="60" fill="hsl(60 90% 55% / 0.45)" />
        <rect x="200" y="140" width="60" height="60" fill="hsl(60 90% 55% / 0.45)" />
        <rect x="140" y="30" width="40" height="50" fill="hsl(20 90% 55% / 0.40)" />
        <text x="160" y="234" fill="hsl(220 10% 60%)" fontSize="10" textAnchor="middle" fontFamily="monospace">T-zone occupancy</text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 320 240" className="h-full w-full">
      <rect x="20" y="20" width="280" height="200" fill="hsl(220 30% 12%)" stroke="hsl(220 20% 30%)" strokeWidth="2" />
      <line x1="160" y1="20" x2="160" y2="220" stroke="hsl(220 20% 30%)" />
      <line x1="20" y1="120" x2="300" y2="120" stroke="hsl(220 20% 30%)" />
      <rect x="120" y="100" width="80" height="40" fill="hsl(140 70% 50% / 0.55)" />
      <rect x="30" y="100" width="60" height="40" fill="hsl(60 90% 55% / 0.35)" />
      <rect x="230" y="100" width="60" height="40" fill="hsl(60 90% 55% / 0.35)" />
      <text x="160" y="234" fill="hsl(220 10% 60%)" fontSize="10" textAnchor="middle" fontFamily="monospace">{sport} coverage</text>
    </svg>
  );
}
