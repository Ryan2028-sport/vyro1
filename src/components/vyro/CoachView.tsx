import { useMemo, useState } from "react";
import { sports } from "@/lib/vyro-data";
import { Bar, Card, PageHeader, Pill } from "./shared";

type Athlete = {
  name: string;
  initials: string;
  status: "Ready" | "Peak" | "Caution" | "Recover";
  load: number; // 0-100
  hrv: number;
  resting: number;
  sleep: number;
  agility: number;
  matches: number;
  wins: number;
};

const squashRoster: Athlete[] = [
  { name: "Sam Yu", initials: "SY", status: "Peak", load: 48, hrv: 82, resting: 46, sleep: 89, agility: 86, matches: 24, wins: 18 },
  { name: "Kathryn Chung", initials: "KC", status: "Ready", load: 61, hrv: 74, resting: 51, sleep: 84, agility: 81, matches: 22, wins: 15 },
  { name: "Chelsea Chan", initials: "CC", status: "Caution", load: 78, hrv: 58, resting: 56, sleep: 71, agility: 77, matches: 26, wins: 17 },
  { name: "Savannah Moxham", initials: "SM", status: "Ready", load: 64, hrv: 71, resting: 49, sleep: 82, agility: 83, matches: 21, wins: 14 },
];

const strengthRoster: Athlete[] = [
  { name: "Yow", initials: "YO", status: "Peak", load: 52, hrv: 79, resting: 47, sleep: 88, agility: 84, matches: 19, wins: 13 },
  { name: "Marina", initials: "MA", status: "Ready", load: 66, hrv: 70, resting: 52, sleep: 80, agility: 79, matches: 23, wins: 14 },
  { name: "Sam Todd", initials: "ST", status: "Recover", load: 81, hrv: 54, resting: 58, sleep: 68, agility: 74, matches: 18, wins: 10 },
];

// Opponent tendency database: per-athlete observations of opponent "Player X"
// (the consolidated database combines what each athlete has seen).
type Tendency = {
  zone: string;
  shot: string;
  pct: number; // observed by this athlete
  sample: number; // # of rallies observed
};

const opponentData: Record<string, Tendency[]> = {
  "Savannah Moxham": [
    { zone: "Back-left", shot: "Straight drive on pressure", pct: 74, sample: 38 },
    { zone: "Back-right", shot: "Cross-court reset", pct: 52, sample: 31 },
    { zone: "Front-left", shot: "Counter-drop", pct: 61, sample: 22 },
    { zone: "Mid-court volley", shot: "Volley kill on loose rail", pct: 58, sample: 19 },
  ],
  "Sam Yu": [
    { zone: "Back-left", shot: "Straight drive on pressure", pct: 70, sample: 41 },
    { zone: "Back-right", shot: "Cross-court reset", pct: 47, sample: 28 },
    { zone: "Front-left", shot: "Counter-drop", pct: 55, sample: 24 },
    { zone: "Mid-court volley", shot: "Volley kill on loose rail", pct: 64, sample: 26 },
  ],
  "Kathryn Chung": [
    { zone: "Back-left", shot: "Straight drive on pressure", pct: 71, sample: 34 },
    { zone: "Back-right", shot: "Cross-court reset", pct: 49, sample: 30 },
    { zone: "Front-left", shot: "Counter-drop", pct: 59, sample: 21 },
    { zone: "Mid-court volley", shot: "Volley kill on loose rail", pct: 60, sample: 23 },
  ],
  "Chelsea Chan": [
    { zone: "Back-left", shot: "Straight drive on pressure", pct: 69, sample: 44 },
    { zone: "Back-right", shot: "Cross-court reset", pct: 54, sample: 36 },
    { zone: "Front-left", shot: "Counter-drop", pct: 57, sample: 27 },
    { zone: "Mid-court volley", shot: "Volley kill on loose rail", pct: 62, sample: 29 },
  ],
};

const statusColor = (s: Athlete["status"]) =>
  s === "Peak" ? "white" : s === "Ready" ? "white" : s === "Caution" ? "amber" : "red";

export function CoachView() {
  const [selectedSport, setSelectedSport] = useState("Squash");
  const [selected, setSelected] = useState<string[]>(["Savannah Moxham", "Sam Yu", "Kathryn Chung"]);

  const consolidated = useMemo(() => {
    const buckets = new Map<string, { zone: string; shot: string; totalPct: number; totalSample: number; n: number }>();
    selected.forEach((name) => {
      (opponentData[name] || []).forEach((t) => {
        const key = `${t.zone}__${t.shot}`;
        const cur = buckets.get(key) || { zone: t.zone, shot: t.shot, totalPct: 0, totalSample: 0, n: 0 };
        // sample-weighted average
        cur.totalPct += t.pct * t.sample;
        cur.totalSample += t.sample;
        cur.n += 1;
        buckets.set(key, cur);
      });
    });
    return Array.from(buckets.values())
      .map((b) => ({
        zone: b.zone,
        shot: b.shot,
        pct: b.totalSample ? Math.round(b.totalPct / b.totalSample) : 0,
        sample: b.totalSample,
        contributors: b.n,
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [selected]);

  const toggle = (name: string) =>
    setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));

  return (
    <>
      <PageHeader
        eyebrow="Coach-only portal"
        title="Sport-scoped roster intelligence"
        subtitle="Coaches see athletes by sport. Strength trainers can toggle sports without seeing everyone at once."
      />
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {sports.map((s) => {
          const count = s === "Squash" ? squashRoster.length : s === "Tennis" ? strengthRoster.length : Math.floor(Math.random() * 3) + 2;
          const active = s === selectedSport;
          return (
            <button
              key={s}
              onClick={() => setSelectedSport(s)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm ${
                active ? "border-white/30 bg-white/15 text-white" : "border-white/10 text-white/70"
              }`}
            >
              {s} <span className="text-white/35">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="font-black">{selectedSport} roster</h3>
            <Pill>{selectedSport === "Squash" ? squashRoster.length : strengthRoster.length} athletes</Pill>
          </div>
          <div className="mt-4 space-y-2">
            {(selectedSport === "Squash" ? squashRoster : strengthRoster).map((a) => (
              <div key={a.name} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-[11px] font-black">
                    {a.initials}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold">{a.name}</div>
                    <div className="text-[11px] text-white/45">
                      {a.matches} matches · {a.wins}W-{a.matches - a.wins}L · HRV {a.hrv}ms
                    </div>
                  </div>
                  <Pill color={statusColor(a.status) as "white" | "amber" | "red"}>{a.status}</Pill>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-white/45">Load</span>
                  <div className="flex-1">
                    <Bar value={a.load} color={a.load > 75 ? "amber" : "white"} />
                  </div>
                  <span className="text-[10px] tabular-nums text-white/55">{a.load}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-black">Combined opponent model · Player X</h3>
              <p className="mt-1 text-sm text-white/55">
                Toggle which athletes' match databases to combine. Percentages are sample-weighted across all selected rallies.
              </p>
            </div>
            <Pill>{consolidated[0]?.sample ?? 0} rallies</Pill>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {Object.keys(opponentData).map((name) => {
              const on = selected.includes(name);
              return (
                <button
                  key={name}
                  onClick={() => toggle(name)}
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    on ? "border-white/30 bg-white/15 text-white" : "border-white/10 text-white/55"
                  }`}
                >
                  {on ? "✓ " : "+ "}
                  {name}
                </button>
              );
            })}
          </div>

          <div className="mt-5 space-y-4">
            {consolidated.length === 0 && (
              <p className="text-sm text-white/45">Select at least one athlete to build a tendency database.</p>
            )}
            {consolidated.map((row) => (
              <div key={row.zone + row.shot}>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-bold">{row.zone}</span>{" "}
                    <span className="text-white/55">· {row.shot}</span>
                  </div>
                  <div className="tabular-nums text-white/70">
                    {row.pct}% <span className="text-[11px] text-white/40">· n={row.sample} · {row.contributors} sources</span>
                  </div>
                </div>
                <Bar value={row.pct} color={row.pct >= 65 ? "white" : row.pct >= 50 ? "amber" : "white"} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <h3 className="font-black">Coach's iPad · live match board</h3>
          <p className="mt-2 text-sm text-white/55">
            Live roster, substitution readiness, red-zone fatigue, and player availability.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Available now", value: 5, sub: "of 7 on roster" },
              { label: "Red-zone fatigue", value: 2, sub: "Chelsea, Sam Todd" },
              { label: "Avg team HRV", value: 70, sub: "ms · 7-day" },
              { label: "Win rate · 30d", value: 67, sub: "% across rosters" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">{s.label}</div>
                <div className="mt-1 text-3xl font-black tabular-nums">{s.value}</div>
                <div className="text-[11px] text-white/45">{s.sub}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
