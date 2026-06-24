import { useState } from "react";
import { Card, EmptyState, PageHeader, Pill } from "./shared";

// =============================================================================
// Court DB view — was previously populated with invented route tables and
// step-length numbers for Squash/Tennis. None of that came from the band
// or from a real opponent database. The view now ships only the schematic
// court diagram and explicit empty states until a real movement-DB is wired
// to recorded sessions.
// =============================================================================

type Sport = "Squash" | "Tennis" | "Baseball" | "Basketball" | "Football" | "Golf" | "Hockey" | "Soccer";
const SPORTS: Sport[] = ["Squash", "Tennis", "Baseball", "Basketball", "Football", "Golf", "Hockey", "Soccer"];

export function CourtDbView() {
  const [sport, setSport] = useState<Sport>("Squash");
  const isSquash = sport === "Squash";
  const isTennis = sport === "Tennis";

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Movement database"
        title="Court coverage & routes"
        subtitle="Heat maps and per-route agility populate from recorded sessions and AI Video. Schematic only until that data exists."
        action={<Pill tone="off">No data</Pill>}
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
          Heat map activates after the band has recorded enough positional movement during a session.
        </p>
      </Card>

      {(isSquash || isTennis) && (
        <Card eyebrow="Per-route agility" title="Movement score table">
          <EmptyState
            title="No routes recorded yet"
            hint="Per-route steps, time to position and decel will appear once recorded sessions provide enough IMU data."
          />
        </Card>
      )}

      <Card eyebrow="Performance · agility" title="Sport intelligence">
        <EmptyState
          title="Awaiting real session data"
          hint="Agility, first-step burst, lateral cut, return control and zone occupancy all derive from saved sessions plus the band's IMU stream."
        />
      </Card>
    </div>
  );
}

function CourtSchematic({ sport }: { sport: Sport }) {
  if (sport === "Squash") {
    return (
      <svg viewBox="0 0 320 240" className="h-full w-full">
        <rect x="20" y="20" width="280" height="200" fill="hsl(220 30% 12%)" stroke="hsl(220 20% 30%)" strokeWidth="2" />
        <line x1="20" y1="120" x2="300" y2="120" stroke="hsl(220 20% 30%)" />
        <line x1="160" y1="120" x2="160" y2="220" stroke="hsl(220 20% 30%)" />
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
