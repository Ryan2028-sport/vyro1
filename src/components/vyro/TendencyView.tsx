import { useMemo, useState } from "react";
import { Card, PageHeader, Pill, Stat } from "./shared";

interface Opponent {
  id: string;
  name: string;
  style: string;
  region: string;
  topPressureShot: string;
  weakZone: string;
  matrix: Record<Zone, { favorite: string; target: string; tell: string }>;
  notes: string;
}
type Zone = "Back left" | "Back right" | "Front left" | "Front right" | "Mid";

const OPPONENTS: Opponent[] = [
  {
    id: "alex",
    name: "Alex K.",
    style: "Northeast junior",
    region: "Princeton",
    topPressureShot: "Straight drive · deep",
    weakZone: "Front right cross",
    notes: "Opens with cross-court when LED at 4-all. Watch first 3 rallies of game 3.",
    matrix: {
      "Back left": { favorite: "Straight drive", target: "Back-right corner", tell: "Late hip turn → drive" },
      "Back right": { favorite: "Cross-court drive", target: "Volley straight", tell: "Drops racket head" },
      "Front left": { favorite: "Counter drop", target: "Volley kill", tell: "Loose wrist" },
      "Front right": { favorite: "Volley cross", target: "Straight drive out", tell: "Steps forward early" },
      "Mid": { favorite: "Volley straight", target: "Front-left counter", tell: "—" },
    },
  },
  {
    id: "marcus",
    name: "Marcus W.",
    style: "Mid-Atlantic baseliner",
    region: "DC Pro Crew",
    topPressureShot: "Cross-court flick",
    weakZone: "Back left retrieval",
    notes: "Patterns through 7+ shots before pulling trigger. Late-game velo retention drops.",
    matrix: {
      "Back left": { favorite: "Cross-court drive", target: "Straight drive out", tell: "Crossover step" },
      "Back right": { favorite: "Straight drive", target: "Counter drop", tell: "Brake step late" },
      "Front left": { favorite: "Volley drop", target: "Volley kill", tell: "Set into contact" },
      "Front right": { favorite: "Volley cross", target: "Straight drive", tell: "Open racket face" },
      "Mid": { favorite: "Cross-court flick", target: "Front-right cross", tell: "Lead foot in" },
    },
  },
  {
    id: "diego",
    name: "Diego R.",
    style: "Florida returner",
    region: "Yale 2026",
    topPressureShot: "Volley kill",
    weakZone: "Counter drop coverage",
    notes: "Split-step timing is best in the game. Pull him deep early to neutralise.",
    matrix: {
      "Back left": { favorite: "Cross-court drive", target: "Volley straight", tell: "—" },
      "Back right": { favorite: "Volley straight", target: "Counter drop", tell: "Drop step" },
      "Front left": { favorite: "Volley kill", target: "Cross-court flick", tell: "Plant step early" },
      "Front right": { favorite: "Volley cross", target: "Straight drive out", tell: "Closed racket face" },
      "Mid": { favorite: "Straight drive", target: "Volley drop", tell: "Right lead" },
    },
  },
];

const ZONES: Zone[] = ["Back left", "Back right", "Front left", "Front right", "Mid"];

export function TendencyView() {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(OPPONENTS[0].id);
  const filtered = useMemo(
    () => OPPONENTS.filter((o) => `${o.name} ${o.style} ${o.region}`.toLowerCase().includes(query.toLowerCase())),
    [query],
  );
  const active = OPPONENTS.find((o) => o.id === activeId) ?? OPPONENTS[0];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Tendencies · scouting"
        title="Player tendency database"
        subtitle="Heat maps, court zones, critical-point shot tendencies, and opponent scouting."
        action={<Pill tone="warn">3 opponents</Pill>}
      />

      <Card eyebrow="Search opponent scouting" title="Player DB" action={<button className="rounded-full border border-vyro-mint bg-vyro-mint/10 px-2.5 py-1 text-[10px] font-semibold text-vyro-mint">Add player</button>}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search style, name, pattern..."
          className="mb-3 w-full rounded-xl border border-vyro-line bg-vyro-panel px-3 py-2 text-sm text-vyro-text outline-none focus:border-vyro-text/40"
        />
        <ul className="divide-y divide-vyro-line/60">
          {filtered.map((o) => (
            <li key={o.id}>
              <button
                onClick={() => setActiveId(o.id)}
                className={`flex w-full items-center justify-between py-2.5 text-left ${o.id === activeId ? "text-vyro-text" : "text-vyro-mute"}`}
              >
                <div>
                  <div className="text-sm font-bold">{o.name}</div>
                  <div className="font-mono text-[10px] uppercase tracking-wider">{o.style} · {o.region}</div>
                </div>
                <Pill tone={o.id === activeId ? "live" : "neutral"}>{o.id === activeId ? "Open" : "View"}</Pill>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card eyebrow="Detailed tendency profile" title={active.name}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Style" value={active.style} />
          <Stat label="Top pressure shot" value={active.topPressureShot} />
          <Stat label="Weak zone" value={active.weakZone} />
        </div>
        <p className="mt-3 rounded-xl border border-vyro-line bg-vyro-elev p-3 text-[12px] text-vyro-mute">
          <span className="font-mono text-[9px] uppercase tracking-wider text-vyro-text">Coach note · </span>
          {active.notes}
        </p>
      </Card>

      <Card eyebrow="Shot choice by court position" title="Critical / non-critical">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="text-vyro-mute">
                <th className="py-1 pr-2 font-mono text-[9px] uppercase tracking-wider">Zone</th>
                <th className="py-1 pr-2 font-mono text-[9px] uppercase tracking-wider">Favorite</th>
                <th className="py-1 pr-2 font-mono text-[9px] uppercase tracking-wider">Target</th>
                <th className="py-1 font-mono text-[9px] uppercase tracking-wider">Tell</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vyro-line/60">
              {ZONES.map((z) => {
                const cell = active.matrix[z];
                return (
                  <tr key={z}>
                    <td className="py-2 pr-2 font-semibold text-vyro-text">{z}</td>
                    <td className="py-2 pr-2 text-vyro-text">{cell.favorite}</td>
                    <td className="py-2 pr-2 text-vyro-mute">{cell.target}</td>
                    <td className="py-2 text-vyro-mute">{cell.tell}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Pill tone="warn">Critical point</Pill>
          <Pill tone="neutral">Non-critical</Pill>
          <Pill tone="live">Favorite</Pill>
        </div>
      </Card>

      <Card eyebrow="Situation-aware scouting" title="Critical vs. non-critical reads">
        <ul className="space-y-1.5 text-[12px] text-vyro-mute">
          <li>• At critical points, {active.name.split(" ")[0]} hides intent until late hip turn — read the racket face, not the body.</li>
          <li>• Non-critical points reveal pattern: {active.matrix["Back left"].favorite} from back-left when behind, {active.matrix["Front right"].favorite} from front-right when ahead.</li>
          <li>• Tag this opponent in the Coach tab to share the read with your squad.</li>
        </ul>
      </Card>

      <p className="text-center text-[11px] text-vyro-mute">
        Once athletes upload sport-specific sessions, the coach sees only this sport's opponent history here.
      </p>
    </div>
  );
}
