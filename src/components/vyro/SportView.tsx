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
        eyebrow="Sport"
        title={activeSport}
        action={
          <button
            onClick={() => setPickerOpen((o) => !o)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-900"
          >
            Change sport
          </button>
        }
      />
      {pickerOpen && (
        <div className="mb-4 rounded-[24px] border border-gray-200 bg-white p-3 shadow-sm">
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
                    activeSport === s ? "border-gray-300 bg-gray-100" : "border-gray-200 bg-gray-50"
                  } ${comingSoon ? "cursor-not-allowed opacity-45" : ""}`}
                >
                  <div className="font-medium">{s}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">
                    {comingSoon ? "Coming soon" : "Active"}
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
              sportTab === id ? "border-gray-300 bg-gray-100 text-gray-900" : "border-gray-200 text-gray-500"
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
  const isTennis = selectedSport === "Tennis";
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {profile.heatmap ? (
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{isTennis ? "Shot location heat map" : "Red heat map"}</h3>
            <Pill>{isTennis ? "rally landings" : "court coverage"}</Pill>
          </div>
          {isTennis ? <TennisHeatmap /> : <SquashHeatmap />}
          <div className="mt-3 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.18em] text-gray-400">
            <span>low density</span>
            <div className="mx-3 h-2 flex-1 rounded-full" style={{ background: "linear-gradient(to right, rgba(255,43,43,0.08), rgba(255,43,43,0.45), rgba(255,43,43,0.95))" }} />
            <span>hot zone</span>
          </div>
        </Card>
      ) : (
        <Card>
          <h3 className="text-lg font-semibold">No heat map for {selectedSport}</h3>
          <p className="mt-2 text-sm text-gray-500">
            Available for squash and tennis only.
          </p>
        </Card>
      )}
      <Card>
        <h3 className="text-lg font-semibold">Tendency profile</h3>
        <div className="mt-4 space-y-3">
          {profile.tendency.map((x) => (
            <div key={x} className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm">
              {x}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SquashHeatmap() {
  return (
    <div className="mt-4 aspect-[3/4] rounded-2xl border border-gray-300 bg-black p-4">
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
  );
}

function TennisHeatmap() {
  const blobs = [
    { x: 18, y: 22, r: 22, i: 0.92 },
    { x: 82, y: 22, r: 20, i: 0.78 },
    { x: 28, y: 70, r: 14, i: 0.55 },
    { x: 72, y: 132, r: 14, i: 0.5 },
    { x: 18, y: 178, r: 22, i: 0.88 },
    { x: 82, y: 178, r: 18, i: 0.7 },
    { x: 50, y: 178, r: 12, i: 0.6 },
    { x: 50, y: 100, r: 9, i: 0.35 },
  ];
  return (
    <div className="mt-4 aspect-[3/4] overflow-hidden rounded-2xl border border-gray-300 bg-[#0a3d1f] p-3">
      <div className="relative h-full w-full overflow-hidden rounded-xl" style={{ background: "linear-gradient(180deg,#0d4a26 0%,#0a3d1f 50%,#0d4a26 100%)" }}>
        <svg viewBox="0 0 100 200" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <defs>
            {blobs.map((b, idx) => (
              <radialGradient key={idx} id={`tg${idx}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ff2b2b" stopOpacity={b.i} />
                <stop offset="55%" stopColor="#ff5a1f" stopOpacity={b.i * 0.55} />
                <stop offset="100%" stopColor="#ff2b2b" stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>
          {blobs.map((b, idx) => (
            <ellipse key={idx} cx={b.x} cy={b.y} rx={b.r} ry={b.r * 1.05} fill={`url(#tg${idx})`} />
          ))}
          <g fill="none" stroke="white" strokeOpacity="0.92" strokeWidth="0.7">
            <rect x="6" y="6" width="88" height="188" />
            <line x1="14" y1="6" x2="14" y2="194" />
            <line x1="86" y1="6" x2="86" y2="194" />
            <line x1="14" y1="60" x2="86" y2="60" />
            <line x1="14" y1="140" x2="86" y2="140" />
            <line x1="50" y1="60" x2="50" y2="140" />
            <line x1="50" y1="6" x2="50" y2="10" />
            <line x1="50" y1="190" x2="50" y2="194" />
            <line x1="6" y1="100" x2="94" y2="100" strokeWidth="1.4" strokeOpacity="1" />
          </g>
          <rect x="6" y="98.5" width="88" height="3" fill="rgba(255,255,255,0.15)" />
        </svg>
        <div className="absolute left-2 top-2 font-mono text-[9px] uppercase tracking-[0.18em] text-white/70">opponent baseline</div>
        <div className="absolute bottom-2 left-2 font-mono text-[9px] uppercase tracking-[0.18em] text-white/70">your baseline</div>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 rotate-90 font-mono text-[9px] uppercase tracking-[0.18em] text-white/55">net</div>
      </div>
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
        <h3 className="text-lg font-semibold">Agility / Movement</h3>
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
        <h3 className="text-lg font-semibold">Movement technique</h3>
        <div className="mt-4 space-y-3 text-sm text-gray-600">
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
          <h3 className="text-lg font-semibold">{profile.motion}</h3>
          <Pill>slow motion</Pill>
        </div>
        <div className="relative mt-4 aspect-video overflow-hidden rounded-2xl border border-gray-300 bg-black">
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
        <h3 className="text-lg font-semibold">Motion metrics</h3>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {metrics.map((x) => (
            <div key={x} className="rounded-2xl bg-gray-50 p-3">
              <b>{x}</b>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
