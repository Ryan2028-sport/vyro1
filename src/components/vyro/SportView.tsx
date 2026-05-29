import { useState } from "react";
import { comingSoonSports, liveSports, sportProfiles, sports, type SportProfile } from "@/lib/vyro-data";
import { Bar, Card, PageHeader, Pill } from "./shared";

type Tab = "database" | "agility" | "swing";

export function SportView({
  selectedSport,
  setSelectedSport,
  sportTab,
  setSportTab,
}: {
  selectedSport: string;
  setSelectedSport: (s: string) => void;
  sportTab: Tab;
  setSportTab: (t: Tab) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const activeSport = liveSports.includes(selectedSport) ? selectedSport : "Squash";
  const profile = sportProfiles[activeSport];

  return (
    <>
      <PageHeader
        eyebrow="Sport Intelligence"
        title={`${activeSport} performance lab.`}
        subtitle={profile.db}
        action={
          <button
            onClick={() => setPickerOpen((o) => !o)}
            className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold"
          >
            Change sport
          </button>
        }
      />
      {pickerOpen && (
        <div className="mb-4 rounded-[24px] border border-white/10 bg-white/[0.055] p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {sports.map((s) => {
              const comingSoon = comingSoonSports.includes(s);
              return (
                <button
                  key={s}
                  disabled={comingSoon}
                  onClick={() => {
                    if (comingSoon) return;
                    setSelectedSport(s);
                    setSportTab("database");
                    setPickerOpen(false);
                  }}
                  className={`rounded-2xl border px-4 py-3 text-left ${
                    activeSport === s ? "border-white/30 bg-white/15" : "border-white/10 bg-black/20"
                  } ${comingSoon ? "cursor-not-allowed opacity-45" : ""}`}
                >
                  <div className="font-bold">{s}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
                    {comingSoon ? "Coming soon" : "Active VYRO sport module"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="mb-5 flex gap-2 overflow-x-auto">
        {(
          [
            ["database", "Database"],
            ["agility", "Agility"],
            ["swing", "Swing / Motion"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSportTab(id)}
            className={`rounded-full border px-4 py-2 text-sm ${
              sportTab === id ? "border-white/25 bg-white/15" : "border-white/10 text-white/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {sportTab === "database" && <SportDatabase profile={profile} selectedSport={activeSport} />}
      {sportTab === "agility" && <SportAgility selectedSport={activeSport} />}
      {sportTab === "swing" && <SportSwing profile={profile} />}
    </>
  );
}

function SportDatabase({ profile, selectedSport }: { profile: SportProfile; selectedSport: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {profile.heatmap ? (
        <Card>
          <h3 className="text-lg font-black">Red heat map</h3>
          <div className="mt-4 aspect-[3/4] rounded-2xl border border-white/15 bg-black p-4">
            <div className="relative h-full w-full rounded-xl border-2 border-white/60">
              <div className="absolute left-0 right-0 top-[14%] border-t border-white/50" />
              <div className="absolute left-0 right-0 top-[38%] border-t border-white/50" />
              <div className="absolute left-1/2 top-[38%] h-[62%] border-l border-white/50" />
              <div className="absolute inset-0 grid grid-cols-6 grid-rows-8 gap-1 p-2">
                {Array.from({ length: 48 }, (_, i) => (
                  <div key={i} className="rounded" style={{ background: `rgba(255,43,43,${0.08 + (i % 11) / 12})` }} />
                ))}
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <h3 className="text-lg font-black">No heat map for {selectedSport}</h3>
          <p className="mt-2 text-sm text-white/55">
            Heat maps stay limited to squash and tennis. This sport uses tendency profiles and motion intelligence
            instead.
          </p>
        </Card>
      )}
      <Card>
        <h3 className="text-lg font-black">Tendency profile</h3>
        <div className="mt-4 space-y-3">
          {profile.tendency.map((x) => (
            <div key={x} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
              {x}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SportAgility({ selectedSport }: { selectedSport: string }) {
  const isSquash = selectedSport === "Squash";
  const baseLabel = isSquash ? "T" : "middle of the court";
  const returnLabel = isSquash ? "Return-to-T" : "Return-to-middle";
  const items = [
    "First-step burst 88",
    "Acceleration 86",
    "Deceleration 82",
    "Return control 79",
    "Technique efficiency 84",
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="text-lg font-black">Agility / Movement breakdown</h3>
        <p className="mt-2 text-sm text-white/55">
          First-step burst, acceleration, deceleration, change of direction, and return control are mapped to
          sport-specific mechanics.
        </p>
        <div className="mt-4 space-y-3">
          {items.map((x) => (
            <div key={x}>
              {x}
              <Bar value={parseInt(x.match(/\d+/)![0])} />
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h3 className="text-lg font-black">Movement technique</h3>
        <div className="mt-4 space-y-3 text-sm text-white/65">
          <div>First step from {baseLabel}: 2.4 ft</div>
          <div>Steps to target zone: 3.1 avg</div>
          <div>{returnLabel}: 1.37s</div>
          <div>Critical point movement decay: 8%</div>
        </div>
      </Card>
    </div>
  );
}

export function SportSwing({ profile }: { profile: SportProfile }) {
  const metrics = [
    "Head speed 82 mph",
    "Force 91 N",
    "Contact quality 87",
    "Backswing 31 in",
    "Follow-through 42 in",
    "Face angle 11° closed",
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black">{profile.motion}</h3>
          <Pill>slow motion</Pill>
        </div>
        <div className="relative mt-4 aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
          <svg viewBox="0 0 500 280" className="h-full w-full">
            <path d="M80 210 C160 80 310 70 420 120" fill="none" stroke="white" strokeWidth="7" strokeLinecap="round" />
            <circle cx="355" cy="115" r="18" fill="#fff" />
            <path d="M250 160 l92 -38" stroke="#ffb020" strokeWidth="13" strokeLinecap="round" />
            <circle cx="238" cy="166" r="22" fill="none" stroke="#fff" strokeWidth="5" />
            <path d="M150 95 L215 165 L185 232" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="8" strokeLinecap="round" />
            <text x="40" y="40" fill="white" fontSize="18" fontFamily="monospace">FACE: 11° CLOSED · CONTACT SIDE VISIBLE</text>
          </svg>
        </div>
      </Card>
      <Card>
        <h3 className="text-lg font-black">Motion metrics</h3>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {metrics.map((x) => (
            <div key={x} className="rounded-2xl bg-white/[0.05] p-3">
              <b>{x}</b>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
