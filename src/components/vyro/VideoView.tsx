import { useRef, useState } from "react";
import { Camera, Play, Upload, Zap, Activity, Target, Eye, TrendingUp, Footprints } from "lucide-react";
import { sportProfiles } from "@/lib/vyro-data";
import { Bar, Card, PageHeader, Pill } from "./shared";
import { SportSwing } from "./SportView";

type Tab = "overview" | "footwork" | "swing" | "tcourt" | "tactics" | "physio";

export function VideoView() {
  const [state, setState] = useState<"idle" | "ready">("idle");
  const [tab, setTab] = useState<Tab>("overview");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setUploadError("Please choose a video file (MP4, MOV, or WebM).");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setUploadError("Clip is larger than 500MB. Trim it and try again.");
      return;
    }
    setUploadError(null);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(URL.createObjectURL(file));
    setVideoName(file.name);
    setState("ready");
  };



  if (state === "idle") {
    return (
      <>
        <PageHeader
          eyebrow="AI Video Analyzer · Squash"
          title="Frame-level squash intelligence"
          subtitle="Explosive steps, swing biomechanics, T-court control, shot selection, and opponent tendency — all synced with IMU and HR signatures from your VYRO watch."
        />
        <Card>
          <div
            className="py-12 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer.files?.[0]);
            }}
          >
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-white/15 bg-white/10">
              <Camera className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-xl font-black">Upload match or drill clip</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/55">
              Drag &amp; drop or pick a file — MP4, MOV, or WebM up to 500MB.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black"
              >
                <Upload className="mr-2 inline h-4 w-4" /> Upload clip
              </button>
              <button
                onClick={() => {
                  if (videoUrl) URL.revokeObjectURL(videoUrl);
                  setVideoUrl(null);
                  setVideoName(null);
                  setUploadError(null);
                  setState("ready");
                }}
                className="rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold"
              >
                Use sample match
              </button>
            </div>
            {uploadError && <p className="mt-3 text-sm text-[#ff2b2b]">{uploadError}</p>}

            <div className="mx-auto mt-6 grid max-w-2xl grid-cols-2 gap-2 text-left sm:grid-cols-3">
              {[
                ["Explosive steps", "1st-step burst, lunge depth"],
                ["Swing detection", "Drive · volley · boast · drop"],
                ["T-court tracking", "Return-to-T, court %"],
                ["Shot selection", "Right vs wrong call"],
                ["Rally load", "HR · stride · recovery"],
                ["Opponent model", "Tendency learning"],
              ].map(([t, s]) => (
                <div key={t} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs">
                  <b className="block">{t}</b>
                  <span className="text-white/55">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </>
    );
  }

  const tabs: [Tab, string, typeof Eye][] = [
    ["overview", "Overview", Eye],
    ["footwork", "Explosive steps", Footprints],
    ["swing", "Swing detection", Zap],
    ["tcourt", "T-court tracking", Target],
    ["tactics", "Shot selection", TrendingUp],
    ["physio", "Load & recovery", Activity],
  ];

  return (
    <>
      <PageHeader
        eyebrow="AI Video Analyzer · Squash"
        title={videoName ? `Clip · ${videoName}` : "Match clip · Ryan Chen vs Player X"}
        subtitle={
          videoName
            ? "Analyzing rallies, swings, footwork, and T-court control."
            : "Game 3 · 11–9 · 4:42 of rally footage analyzed · 38 rallies · 312 swings"
        }
        action={
          <button
            onClick={() => {
              if (videoUrl) URL.revokeObjectURL(videoUrl);
              setVideoUrl(null);
              setVideoName(null);
              setState("idle");
            }}
            className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold"
          >
            New clip
          </button>
        }
      />


      <div className="mb-5 flex gap-2 overflow-x-auto">
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm flex items-center gap-2 ${
              tab === id ? "border-white/25 bg-white/15" : "border-white/10 text-white/60"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview />}
      {tab === "footwork" && <Footwork />}
      {tab === "swing" && <Swing />}
      {tab === "tcourt" && <TCourt />}
      {tab === "tactics" && <Tactics />}
      {tab === "physio" && <Physio />}
    </>
  );
}

function VideoPanel({ caption }: { caption: string }) {
  return (
    <Card>
      <div className="relative grid aspect-video place-items-center overflow-hidden rounded-2xl border border-white/10 bg-black">
        <div className="grid h-16 w-16 place-items-center rounded-full border border-white/20 bg-white/10">
          <Play className="h-8 w-8" />
        </div>
        <div className="absolute left-3 top-3 flex gap-2">
          <Pill color="red">LIVE TAG</Pill>
          <Pill>30 fps · 4K</Pill>
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.18em] text-white/70">
          <span>{caption}</span>
          <span>02:14 / 04:42</span>
        </div>
      </div>
    </Card>
  );
}

function Overview() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <VideoPanel caption="Game 3 · Rally 14 · Back-left retrieval" />
      </div>
      <Card>
        <h3 className="font-black">Match summary</h3>
        <div className="mt-3 space-y-3 text-sm">
          {[
            ["Swings detected", "312"],
            ["Lunges (≥45°)", "84"],
            ["Avg return-to-T", "1.31s"],
            ["Avg first-step burst", "2.6 ft"],
            ["Court coverage", "71%"],
            ["Right-shot calls", "78%"],
            ["Avg HR in rally", "168 bpm"],
            ["Peak HR", "192 bpm"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-white/55">{k}</span>
              <b className="tabular-nums">{v}</b>
            </div>
          ))}
        </div>
      </Card>
      <Card className="lg:col-span-3">
        <div className="flex items-center justify-between">
          <h3 className="font-black">Rally timeline</h3>
          <Pill color="amber">red zones = fatigue swing decay</Pill>
        </div>
        <div className="mt-4 flex h-10 w-full overflow-hidden rounded-xl border border-white/10">
          {Array.from({ length: 38 }).map((_, i) => {
            const intensity = 0.25 + ((i * 37) % 100) / 130;
            const fatigue = i > 26 && i % 3 === 0;
            return (
              <div
                key={i}
                className="flex-1 border-r border-black/40"
                style={{
                  background: fatigue
                    ? `rgba(255,43,43,${0.4 + intensity / 2})`
                    : `rgba(255,255,255,${0.08 + intensity / 2})`,
                }}
                title={`Rally ${i + 1}`}
              />
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-mono uppercase tracking-[0.18em] text-white/45">
          <span>R1</span>
          <span>R19</span>
          <span>R38</span>
        </div>
      </Card>
    </div>
  );
}

function Footwork() {
  const steps = [
    ["First-step burst", 88, "2.6 ft avg push-off from T"],
    ["Acceleration", 86, "0–4 ft in 0.41s"],
    ["Deceleration control", 79, "stop into lunge inside 2 strides"],
    ["Lunge depth", 84, "front-knee 112° avg · trail-leg 168°"],
    ["Split-step timing", 81, "fires 0.18s before opponent contact"],
    ["Recovery push", 77, "back-to-T 1.31s avg"],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <VideoPanel caption="Explosive step → front-right lunge · pose overlay" />
      </div>
      <Card>
        <h3 className="font-black">Explosive step breakdown</h3>
        <div className="mt-4 space-y-3 text-sm">
          {steps.map(([k, v, sub]) => (
            <div key={k as string}>
              <div className="flex items-center justify-between">
                <span>{k}</span>
                <b className="tabular-nums">{v}</b>
              </div>
              <Bar value={v as number} color={(v as number) < 80 ? "amber" : "white"} />
              <div className="mt-1 text-[11px] text-white/45">{sub}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="lg:col-span-3">
        <h3 className="font-black">Step pattern from the T</h3>
        <p className="mt-2 text-sm text-white/55">
          Reconstructed from pose + IMU. Color = ground-contact time. Red dots = explosive push-offs (&gt;3.2 m/s²).
        </p>
        <div className="mt-4 aspect-[2/1] rounded-2xl border border-white/15 bg-black p-4">
          <svg viewBox="0 0 600 300" className="h-full w-full">
            <rect x="20" y="20" width="560" height="260" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
            <line x1="300" y1="20" x2="300" y2="280" stroke="rgba(255,255,255,0.3)" />
            <line x1="20" y1="180" x2="580" y2="180" stroke="rgba(255,255,255,0.3)" />
            <circle cx="300" cy="180" r="14" fill="none" stroke="white" strokeWidth="2" />
            <text x="310" y="176" fill="white" fontSize="11" fontFamily="monospace">T</text>
            {[
              [300, 180, 90, 70, "#ff2b2b"],
              [220, 90, 60, 60, "#ffb020"],
              [120, 80, 40, 50, "#ffb020"],
              [300, 180, 90, 70, "#ff2b2b"],
              [440, 110, 70, 60, "#ffb020"],
              [510, 60, 35, 55, "#fff"],
              [300, 180, 90, 70, "#ff2b2b"],
              [180, 240, 45, 65, "#ffb020"],
              [110, 260, 30, 70, "#fff"],
            ].map(([x, y, r, , c], i, arr) => (
              <g key={i}>
                {i > 0 && (
                  <line
                    x1={arr[i - 1][0] as number}
                    y1={arr[i - 1][1] as number}
                    x2={x as number}
                    y2={y as number}
                    stroke="rgba(255,255,255,0.25)"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                )}
                <circle cx={x as number} cy={y as number} r={(r as number) / 12} fill={c as string} opacity="0.85" />
              </g>
            ))}
          </svg>
        </div>
      </Card>
    </div>
  );
}

function Swing() {
  const profile = sportProfiles.Squash;
  const counts = [
    ["Straight drive", 112, "white"],
    ["Cross-court", 58, "white"],
    ["Boast", 31, "amber"],
    ["Volley drive", 47, "white"],
    ["Volley kill", 19, "white"],
    ["Drop", 28, "amber"],
    ["Lob", 17, "white"],
  ] as const;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SportSwing profile={profile} />
      <Card>
        <h3 className="font-black">Swing detection · 312 swings</h3>
        <div className="mt-4 space-y-2 text-sm">
          {counts.map(([k, v, c]) => (
            <div key={k} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center justify-between">
                <b>{k}</b>
                <span className="tabular-nums text-white/65">{v}</span>
              </div>
              <Bar value={(v / 112) * 100} color={c} />
            </div>
          ))}
        </div>
      </Card>
      <Card className="lg:col-span-2">
        <h3 className="font-black">Biomechanics per swing type</h3>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          {[
            ["Racket head speed", "82 mph"],
            ["Wrist snap angle", "47°"],
            ["Shoulder rotation", "94°"],
            ["Hip-shoulder separation", "38°"],
            ["Contact height", "1.18 m"],
            ["Contact in front of body", "+22 cm"],
            ["Follow-through length", "42 in"],
            ["Late-rally speed decay", "−7% after R20"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-white/[0.05] p-3">
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/50">{k}</div>
              <b className="text-base">{v}</b>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function TCourt() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="font-black">T-occupancy heat map</h3>
        <p className="mt-2 text-sm text-white/55">71% of rally time within 0.9 m of the T.</p>
        <div className="mt-4 aspect-[3/4] rounded-2xl border border-white/15 bg-black p-4">
          <div className="relative h-full w-full rounded-xl border-2 border-white/60">
            <div className="absolute left-0 right-0 top-[14%] border-t border-white/50" />
            <div className="absolute left-0 right-0 top-[38%] border-t border-white/50" />
            <div className="absolute left-1/2 top-[38%] h-[62%] border-l border-white/50" />
            <div className="absolute inset-0 grid grid-cols-6 grid-rows-8 gap-1 p-2">
              {Array.from({ length: 48 }, (_, i) => {
                const tZone = i === 21 || i === 22 || i === 27 || i === 28;
                const intensity = tZone ? 0.95 : 0.08 + (i % 9) / 14;
                return (
                  <div
                    key={i}
                    className="rounded"
                    style={{ background: `rgba(255,43,43,${intensity})` }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </Card>
      <Card>
        <h3 className="font-black">Return-to-T metrics</h3>
        <div className="mt-4 space-y-3 text-sm">
          {[
            ["Avg return-to-T", "1.31s", 82],
            ["Fastest return", "0.94s", 96],
            ["Slowest return", "2.18s", 38],
            ["After back-left retrieval", "1.62s", 64],
            ["After front-right drop chase", "1.47s", 71],
            ["Late-game decay", "+0.21s", 55],
          ].map(([k, v, n]) => (
            <div key={k as string}>
              <div className="flex items-center justify-between">
                <span>{k}</span>
                <b className="tabular-nums">{v}</b>
              </div>
              <Bar value={n as number} color={(n as number) < 70 ? "amber" : "white"} />
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/50">Coach note</div>
          You concede the T 0.21s slower in games 3–5. Crossover-step out of the back-left lunge is the unlock.
        </div>
      </Card>
    </div>
  );
}

function Tactics() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="font-black">Shot selection grading</h3>
        <p className="mt-2 text-sm text-white/55">
          Each shot graded vs the optimal call given opponent position, ball height, your court position, and rally length.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[
            ["Right call", "78%", "white"],
            ["Forced error", "9%", "amber"],
            ["Wrong call", "13%", "red"],
          ].map(([k, v, c]) => (
            <div key={k as string} className="rounded-2xl bg-white/[0.05] p-3">
              <div className={`text-2xl font-black ${c === "red" ? "text-[#ff2b2b]" : c === "amber" ? "text-[#ffb020]" : ""}`}>{v}</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/55">{k}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2 text-sm">
          {[
            "Back-left under pressure → straight drive 72% (optimal)",
            "Front-right loose ball → counter-drop chosen 58% (kill was open 41%)",
            "Mid-court volley → boast 22% (low-percentage, opponent reads it)",
          ].map((x) => (
            <div key={x} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">{x}</div>
          ))}
        </div>
      </Card>
      <Card>
        <h3 className="font-black">Opponent tendency learned</h3>
        <p className="mt-2 text-sm text-white/55">VYRO updates Player X's profile after every match.</p>
        <div className="mt-4 space-y-3 text-sm">
          {[
            ["Back-right: straight drive on critical points", 71],
            ["Front-left: counter-drop under pressure", 64],
            ["Serve return: cross-court 58%", 58],
            ["Tin risk on stretched forehand drop", 44],
            ["Boast frequency rises in game 4–5", 49],
          ].map(([k, v]) => (
            <div key={k as string}>
              <div className="flex items-center justify-between">
                <span>{k}</span>
                <b className="tabular-nums">{v}%</b>
              </div>
              <Bar value={v as number} color={(v as number) > 60 ? "red" : "amber"} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Physio() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="font-black">Rally load · HR + stride</h3>
        <div className="mt-4 aspect-[2/1] rounded-2xl border border-white/15 bg-black p-4">
          <svg viewBox="0 0 600 240" className="h-full w-full">
            <path
              d="M0 200 C 60 140, 120 60, 180 80 S 300 200, 360 110 S 480 40, 540 90 L600 70 L600 240 L0 240 Z"
              fill="rgba(255,43,43,0.18)"
              stroke="#ff2b2b"
              strokeWidth="3"
            />
            <path
              d="M0 180 C 80 150, 160 120, 240 130 S 400 180, 480 130 L600 110"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeDasharray="5 4"
            />
            <text x="10" y="20" fill="#ff2b2b" fontSize="11" fontFamily="monospace">HR (bpm)</text>
            <text x="10" y="36" fill="white" fontSize="11" fontFamily="monospace">stride freq</text>
          </svg>
        </div>
      </Card>
      <Card>
        <h3 className="font-black">Per-rally load</h3>
        <div className="mt-4 space-y-3 text-sm">
          {[
            ["Avg rally length", "11.4 shots"],
            ["Longest rally", "38 shots · 47s"],
            ["Time above 180 bpm", "6:12"],
            ["HRV drop in-match", "−18ms"],
            ["Estimated calories", "612 kcal"],
            ["Post-match recovery target", "62 min @ 110 bpm"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-white/55">{k}</span>
              <b className="tabular-nums">{v}</b>
            </div>
          ))}
        </div>
      </Card>
      <Card className="lg:col-span-2">
        <h3 className="font-black">Injury & overload flags</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["Front-knee landing angle", "112° → 104° in G5", "amber"],
            ["Trail-leg drag on lunge", "+8% late game", "amber"],
            ["Asymmetry (L/R push-off)", "11% L-dominant", "red"],
          ].map(([k, v, c]) => (
            <div key={k} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center justify-between">
                <b className="text-sm">{k}</b>
                <Pill color={c as "amber" | "red"}>flag</Pill>
              </div>
              <div className="mt-1 text-xs text-white/55">{v}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
