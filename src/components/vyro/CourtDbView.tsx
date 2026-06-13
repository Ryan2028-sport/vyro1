import { Card, PageHeader, Pill, Stat } from "./shared";

const SQUASH_ROUTES = [
  "T → Front Left",
  "T → Front Right",
  "T → Middle Left",
  "T → Middle Right",
  "T → Back Left",
  "T → Back Right",
  "Corner ↔ Corner",
  "Lunge + Recovery",
];

const TENNIS_ROUTES = [
  "Center → Short L",
  "Center → Short R",
  "Center → Deep L",
  "Center → Deep R",
  "Center → Wide L",
  "Center → Wide R",
  "Center → Short Ball",
];

// Court database / heat-map / movement view from the VYRO spec. Heat-map
// canvas comes in Phase 2 once the court-position model lands; here we
// already lay out every section the spec calls for.
export function CourtDbView() {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Sport · movement"
        title="Court database"
        subtitle="Heat maps, route DB, zone occupancy and agility from session IMU."
        action={<Pill tone="warn">needs court model</Pill>}
      />

      <Card eyebrow="Heat maps" title="Court heat map">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Stat label="Movement density" value="—" hint="per zone" />
          <Stat label="Fatigue cost" value="—" hint="decel × density" />
          <Stat label="Attack conversion" value="—" unit="%" />
        </div>
        <div className="mt-3 grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-black/15 bg-black/[0.02] text-[11px] text-black/45">
          Heat-map render — Phase 2
        </div>
      </Card>

      <Card eyebrow="Zones · agility" title="Performance">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Agility score" value="—" unit="/100" />
          <Stat label="First-step burst" value="—" unit="g" />
          <Stat label="Lateral cut" value="—" unit="/100" />
          <Stat label="Return control" value="—" unit="/100" />
          <Stat label="Decel quality" value="—" unit="/100" />
          <Stat label="Change of direction" value="—" unit="/100" />
          <Stat label="Movement tech" value="—" unit="/100" />
          <Stat label="Zone occupancy" value="—" unit="s" />
        </div>
      </Card>

      <Card eyebrow="Route DB · squash" title="T → zones">
        <ul className="divide-y divide-black/[0.06]">
          {SQUASH_ROUTES.map((r) => (
            <li key={r} className="flex items-center justify-between py-2 text-xs">
              <span className="font-mono text-[11px] text-black/75">{r}</span>
              <span className="font-mono text-[10px] text-black/40">samples — · score — · band —</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card eyebrow="Route DB · tennis" title="Center → zones">
        <ul className="divide-y divide-black/[0.06]">
          {TENNIS_ROUTES.map((r) => (
            <li key={r} className="flex items-center justify-between py-2 text-xs">
              <span className="font-mono text-[11px] text-black/75">{r}</span>
              <span className="font-mono text-[10px] text-black/40">samples — · score — · band —</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
