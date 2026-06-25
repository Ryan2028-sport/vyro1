import { useMemo, useState } from "react";
import { comingSoonSports, sports } from "@/lib/vyro-data";
import { Bar, Card, PageHeader, Pill } from "./shared";

type Athlete = {
  name: string;
  initials: string;
  status: "Ready" | "Peak" | "Caution" | "Recover";
  load: number;
  hrv: number;
  resting: number;
  sleep: number;
  agility: number;
  matches: number;
  wins: number;
};

const initialsOf = (n: string) =>
  n.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

const rosters: Record<string, Athlete[]> = {
  Squash: [
    { name: "Yow Ng", initials: "YN", status: "Peak", load: 52, hrv: 84, resting: 47, sleep: 88, agility: 84, matches: 22, wins: 17 },
    { name: "Marina Stefanoni", initials: "MS", status: "Ready", load: 61, hrv: 76, resting: 49, sleep: 84, agility: 82, matches: 24, wins: 18 },
    { name: "Sam Todd", initials: "ST", status: "Peak", load: 49, hrv: 81, resting: 46, sleep: 87, agility: 83, matches: 21, wins: 16 },
    { name: "Yusuf Sheikh", initials: "YS", status: "Ready", load: 64, hrv: 73, resting: 51, sleep: 80, agility: 79, matches: 23, wins: 15 },
    { name: "Adam Hawal", initials: "AH", status: "Caution", load: 78, hrv: 62, resting: 56, sleep: 71, agility: 77, matches: 22, wins: 14 },
    { name: "Shaurya Bawa", initials: "SB", status: "Ready", load: 67, hrv: 71, resting: 50, sleep: 82, agility: 80, matches: 20, wins: 13 },
    { name: "Thomas Soltanian", initials: "TS", status: "Recover", load: 83, hrv: 57, resting: 58, sleep: 68, agility: 74, matches: 19, wins: 11 },
  ],
  Tennis: [
    { name: "Adam Walton", initials: "AW", status: "Peak", load: 51, hrv: 83, resting: 47, sleep: 88, agility: 85, matches: 26, wins: 21 },
    { name: "Michael Zheng", initials: "MZ", status: "Ready", load: 62, hrv: 75, resting: 50, sleep: 83, agility: 82, matches: 24, wins: 17 },
    { name: "Nicolas Kotzen", initials: "NK", status: "Peak", load: 54, hrv: 80, resting: 48, sleep: 86, agility: 84, matches: 22, wins: 16 },
    { name: "Alex Kotzen", initials: "AK", status: "Ready", load: 66, hrv: 72, resting: 51, sleep: 81, agility: 80, matches: 23, wins: 15 },
    { name: "Andrew Kotzen", initials: "AK", status: "Caution", load: 77, hrv: 63, resting: 55, sleep: 72, agility: 78, matches: 21, wins: 13 },
  ],
};

type Tendency = { zone: string; shot: string; pct: number; sample: number };

const opponentDataBySport: Record<string, { focus: string; data: Record<string, Tendency[]> }> = {
  Squash: {
    focus: "Chelsea Chan",
    data: {
      "Yow Ng": [
        { zone: "Back-left", shot: "Straight drive on pressure", pct: 74, sample: 38 },
        { zone: "Back-right", shot: "Cross-court reset", pct: 52, sample: 31 },
        { zone: "Front-left", shot: "Counter-drop", pct: 61, sample: 22 },
        { zone: "Mid-court volley", shot: "Volley kill on loose rail", pct: 58, sample: 19 },
      ],
      "Marina Stefanoni": [
        { zone: "Back-left", shot: "Straight drive on pressure", pct: 70, sample: 41 },
        { zone: "Back-right", shot: "Cross-court reset", pct: 47, sample: 28 },
        { zone: "Front-left", shot: "Counter-drop", pct: 55, sample: 24 },
        { zone: "Mid-court volley", shot: "Volley kill on loose rail", pct: 64, sample: 26 },
      ],
      "Sam Todd": [
        { zone: "Back-left", shot: "Straight drive on pressure", pct: 71, sample: 34 },
        { zone: "Back-right", shot: "Cross-court reset", pct: 49, sample: 30 },
        { zone: "Front-left", shot: "Counter-drop", pct: 59, sample: 21 },
        { zone: "Mid-court volley", shot: "Volley kill on loose rail", pct: 60, sample: 23 },
      ],
      "Adam Hawal": [
        { zone: "Back-left", shot: "Straight drive on pressure", pct: 69, sample: 44 },
        { zone: "Back-right", shot: "Cross-court reset", pct: 54, sample: 36 },
        { zone: "Front-left", shot: "Counter-drop", pct: 57, sample: 27 },
        { zone: "Mid-court volley", shot: "Volley kill on loose rail", pct: 62, sample: 29 },
      ],
    },
  },
  Tennis: {
    focus: "Adam Walton",
    data: {
      "Michael Zheng": [
        { zone: "Wide forehand corner", shot: "Cross-court forehand", pct: 58, sample: 44 },
        { zone: "Backhand corner", shot: "Down-the-line slice reset", pct: 39, sample: 36 },
        { zone: "Serve +1", shot: "Forehand inside-out", pct: 47, sample: 41 },
        { zone: "Break point return", shot: "Block return to body", pct: 52, sample: 28 },
      ],
      "Nicolas Kotzen": [
        { zone: "Wide forehand corner", shot: "Cross-court forehand", pct: 61, sample: 39 },
        { zone: "Backhand corner", shot: "Down-the-line slice reset", pct: 42, sample: 33 },
        { zone: "Serve +1", shot: "Forehand inside-out", pct: 44, sample: 38 },
        { zone: "Break point return", shot: "Block return to body", pct: 49, sample: 25 },
      ],
      "Alex Kotzen": [
        { zone: "Wide forehand corner", shot: "Cross-court forehand", pct: 55, sample: 42 },
        { zone: "Backhand corner", shot: "Down-the-line slice reset", pct: 37, sample: 34 },
        { zone: "Serve +1", shot: "Forehand inside-out", pct: 50, sample: 36 },
        { zone: "Break point return", shot: "Block return to body", pct: 54, sample: 27 },
      ],
      "Andrew Kotzen": [
        { zone: "Wide forehand corner", shot: "Cross-court forehand", pct: 57, sample: 40 },
        { zone: "Backhand corner", shot: "Down-the-line slice reset", pct: 41, sample: 31 },
        { zone: "Serve +1", shot: "Forehand inside-out", pct: 46, sample: 35 },
        { zone: "Break point return", shot: "Block return to body", pct: 51, sample: 26 },
      ],
    },
  },
};

const statusColor = (s: Athlete["status"]) =>
  s === "Peak" ? "white" : s === "Ready" ? "white" : s === "Caution" ? "amber" : "red";

export function CoachView() {
  const [selectedSport, setSelectedSport] = useState<"Squash" | "Tennis">("Squash");

  const roster = rosters[selectedSport] ?? [];
  const sportOpp = opponentDataBySport[selectedSport];
  const oppNames = Object.keys(sportOpp.data);

  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, string[]>>({
    Squash: ["Yow Ng", "Marina Stefanoni", "Sam Todd"],
    Tennis: ["Michael Zheng", "Nicolas Kotzen", "Alex Kotzen"],
  });
  const selected = selectedByGroup[selectedSport] ?? [];

  const consolidated = useMemo(() => {
    const buckets = new Map<string, { zone: string; shot: string; totalPct: number; totalSample: number; n: number }>();
    selected.forEach((name) => {
      (sportOpp.data[name] || []).forEach((t) => {
        const key = `${t.zone}__${t.shot}`;
        const cur = buckets.get(key) || { zone: t.zone, shot: t.shot, totalPct: 0, totalSample: 0, n: 0 };
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
  }, [selected, sportOpp]);

  const toggle = (name: string) =>
    setSelectedByGroup((all) => {
      const cur = all[selectedSport] ?? [];
      const next = cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name];
      return { ...all, [selectedSport]: next };
    });

  return (
    <>
      <PageHeader
        eyebrow="Coach"
        title="Roster"
      />
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {sports.map((s) => {
          const comingSoon = comingSoonSports.includes(s);
          const count = rosters[s]?.length ?? 0;
          const active = s === selectedSport;
          return (
            <button
              key={s}
              disabled={comingSoon}
              onClick={() => {
                if (!comingSoon) setSelectedSport(s as "Squash" | "Tennis");
              }}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm ${
                active ? "border-gray-300 bg-gray-100 text-gray-900" : "border-gray-200 text-gray-500"
              } ${comingSoon ? "cursor-not-allowed opacity-45" : ""}`}
            >
              {s} <span className="text-gray-400">{comingSoon ? "Coming soon" : count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Columbia {selectedSport.toLowerCase()}</h3>
            <Pill>{roster.length} athletes</Pill>
          </div>
          <div className="mt-4 space-y-2">
            {roster.map((a) => (
              <div key={a.name} className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-gray-200 text-[11px] font-semibold">
                    {initialsOf(a.name)}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{a.name}</div>
                    <div className="text-[11px] text-gray-400">
                      {a.matches} matches · {a.wins}W-{a.matches - a.wins}L · HRV {a.hrv}ms
                    </div>
                  </div>
                  <Pill color={statusColor(a.status) as "white" | "amber" | "red"}>{a.status}</Pill>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">Load</span>
                  <div className="flex-1">
                    <Bar value={a.load} color={a.load > 75 ? "amber" : "white"} />
                  </div>
                  <span className="text-[10px] tabular-nums text-gray-500">{a.load}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold">Opponent model · {sportOpp.focus}</h3>
            </div>
            <Pill>{consolidated[0]?.sample ?? 0} rallies</Pill>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {oppNames.map((name) => {
              const on = selected.includes(name);
              return (
                <button
                  key={name}
                  onClick={() => toggle(name)}
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    on ? "border-gray-300 bg-gray-100 text-gray-900" : "border-gray-200 text-gray-500"
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
              <p className="text-sm text-gray-400">Select at least one teammate to build a tendency database.</p>
            )}
            {consolidated.map((row) => (
              <div key={row.zone + row.shot}>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{row.zone}</span>{" "}
                    <span className="text-gray-500">· {row.shot}</span>
                  </div>
                  <div className="tabular-nums text-gray-600">
                    {row.pct}% <span className="text-[11px] text-gray-400">· n={row.sample} · {row.contributors} sources</span>
                  </div>
                </div>
                <Bar value={row.pct} color={row.pct >= 65 ? "white" : row.pct >= 50 ? "amber" : "white"} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <h3 className="font-semibold">Match board</h3>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Available now", value: roster.filter((a) => a.status !== "Recover").length, sub: `of ${roster.length} on roster` },
              { label: "Red-zone fatigue", value: roster.filter((a) => a.load > 75).length, sub: roster.filter((a) => a.load > 75).map((a) => a.name.split(" ")[0]).join(", ") || "—" },
              { label: "Avg team HRV", value: Math.round(roster.reduce((s, a) => s + a.hrv, 0) / Math.max(1, roster.length)), sub: "ms · 7-day" },
              { label: "Win rate · 30d", value: Math.round((roster.reduce((s, a) => s + a.wins, 0) / Math.max(1, roster.reduce((s, a) => s + a.matches, 0))) * 100), sub: "% across rosters" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-gray-200 bg-gray-50/80 p-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">{s.label}</div>
                <div className="mt-1 text-3xl font-semibold tabular-nums">{s.value}</div>
                <div className="text-[11px] text-gray-400">{s.sub}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
