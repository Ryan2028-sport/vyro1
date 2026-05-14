import { Bar, Card, PageHeader, ScoreRing, Spark } from "./shared";

type Tab = "live" | "ingame" | "fatigue" | "overnight";

export function RecoveryView({ recoveryTab, setRecoveryTab }: { recoveryTab: Tab; setRecoveryTab: (t: Tab) => void }) {
  const tabs: [Tab, string][] = [
    ["live", "LIVE Recovery"],
    ["ingame", "In-Game"],
    ["fatigue", "Total Fatigue"],
    ["overnight", "Overnight"],
  ];
  return (
    <>
      <PageHeader
        eyebrow="LIVE Recovery · Multimodal"
        title="Recovery & fatigue intelligence"
        subtitle="Not just heart rate. Cardio + muscle + load + environment + confidence."
      />
      <div className="mb-5 flex gap-2 overflow-x-auto">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setRecoveryTab(id)}
            className={`rounded-full border px-4 py-2 text-sm ${
              recoveryTab === id ? "border-white/25 bg-white/15" : "border-white/10 text-white/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {recoveryTab === "live" && <RecoveryLive />}
      {recoveryTab === "fatigue" && <RecoveryFatigue />}
      {recoveryTab === "ingame" && <RecoveryInGame />}
      {recoveryTab === "overnight" && <RecoveryOvernight />}
    </>
  );
}

function RecoveryLive() {
  const subscores = [
    "Cardio Recovery 92",
    "Muscle Readiness 64",
    "Load Debt 71",
    "Recovery Environment 88",
    "Confidence 81",
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <ScoreRing metric={{ label: "LIVE Recovery", value: 78, color: "teal" }} />
      </Card>
      <Card className="lg:col-span-2">
        <h3 className="font-black">Subscores</h3>
        <div className="mt-4 space-y-3">
          {subscores.map((x) => {
            const v = parseInt(x.match(/\d+/)![0]);
            return (
              <div key={x}>
                {x}
                <Bar value={v} color={v < 70 ? "amber" : "white"} />
              </div>
            );
          })}
        </div>
      </Card>
      <Card className="lg:col-span-3">
        <h3 className="font-black text-[#ffb020]">HR-only trap detected</h3>
        <p className="mt-2 text-sm text-white/60">
          Heart rate has recovered to within 6 bpm of baseline, but muscle readiness is still 64/100 after long Z5
          rallies. VYRO sees the load debt.
        </p>
      </Card>
    </div>
  );
}

function RecoveryFatigue() {
  const items = ["Court coverage fatigue 71", "Cardio fatigue 48", "Total fatigue 62"];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {items.map((x) => {
        const v = parseInt(x.match(/\d+/)![0]);
        return (
          <Card key={x}>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
              {x.replace(/\d+/, "")}
            </div>
            <div className="mt-2 text-5xl font-black">{v}</div>
            <Bar value={v} color="amber" />
          </Card>
        );
      })}
      <Card className="lg:col-span-3">
        <h3 className="font-black">Fatigue decay · last 14 days</h3>
        <Spark points={[42, 51, 58, 64, 71, 68, 62, 56, 49, 54, 61, 65, 60, 62]} color="#ffb020" />
      </Card>
    </div>
  );
}

function RecoveryInGame() {
  const hrDrops = [178, 166, 158, 149, 171, 160, 151, 144, 182, 169, 156, 148];
  const fatigueRecovery = [96, 92, 88, 83, 79, 75, 71, 68];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="min-h-[260px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-black">Between-point HR drop · current match</h3>
            <p className="mt-1 text-sm text-white/45">Mock rally recovery from peak HR to ready state.</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black tabular-nums">30</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">bpm drop</div>
          </div>
        </div>
        <MatchLineChart data={hrDrops} min={120} max={190} unit="bpm" className="mt-5 text-vyro-recovery" />
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-white/55">
          <div className="rounded-2xl bg-white/[0.06] p-3"><span className="block text-lg font-black text-white">178</span>peak</div>
          <div className="rounded-2xl bg-white/[0.06] p-3"><span className="block text-lg font-black text-white">148</span>recovered</div>
          <div className="rounded-2xl bg-white/[0.06] p-3"><span className="block text-lg font-black text-white">0:42</span>time</div>
        </div>
      </Card>
      <Card className="min-h-[260px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-black">Recovery speed under fatigue</h3>
            <p className="mt-1 text-sm text-white/45">Mock late-match recovery speed trend by rally block.</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black tabular-nums">68%</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">speed</div>
          </div>
        </div>
        <MatchLineChart data={fatigueRecovery} min={60} max={100} unit="%" className="mt-5 text-vyro-fatigue" />
        <div className="mt-4 space-y-3 text-sm text-white/65">
          <div>
            Fast recovery reserve
            <Bar value={68} color="amber" />
          </div>
          <p className="text-xs leading-relaxed text-white/45">Recovery is slowing after repeated Zone 5 points; flag substitution, hydration, or tactical pacing.</p>
        </div>
      </Card>
      <Card className="lg:col-span-2">
        <h3 className="font-black">Zone 5 exposure</h3>
        <div className="mt-2 text-5xl font-black">3:42</div>
        <p className="text-sm text-white/45">time at 180+ bpm</p>
      </Card>
    </div>
  );
}

function MatchLineChart({
  data,
  min,
  max,
  unit,
  className = "",
}: {
  data: number[];
  min: number;
  max: number;
  unit: string;
  className?: string;
}) {
  const width = 320;
  const height = 132;
  const top = 12;
  const right = 14;
  const bottom = 24;
  const left = 34;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const points = data.map((value, index) => {
    const x = left + (index / Math.max(1, data.length - 1)) * plotWidth;
    const y = top + (1 - (value - min) / (max - min)) * plotHeight;
    return { x, y, value };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${left},${height - bottom} ${line} ${width - right},${height - bottom}`;

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[150px] w-full overflow-visible" role="img" aria-label={`${unit} recovery chart`}>
        <line x1={left} y1={top} x2={left} y2={height - bottom} stroke="rgba(255,255,255,0.14)" />
        <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} stroke="rgba(255,255,255,0.14)" />
        {[0.25, 0.5, 0.75].map((tick) => {
          const y = top + tick * plotHeight;
          return <line key={tick} x1={left} y1={y} x2={width - right} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 6" />;
        })}
        <polygon points={area} fill="currentColor" opacity="0.12" />
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <circle key={`${point.value}-${index}`} cx={point.x} cy={point.y} r="4" fill="currentColor" stroke="#0b0b0c" strokeWidth="2" />
        ))}
        <text x="0" y={top + 4} fill="rgba(255,255,255,0.45)" fontSize="10" fontFamily="monospace">{max}{unit}</text>
        <text x="0" y={height - bottom + 3} fill="rgba(255,255,255,0.45)" fontSize="10" fontFamily="monospace">{min}{unit}</text>
        <text x={left} y={height - 2} fill="rgba(255,255,255,0.45)" fontSize="10" fontFamily="monospace">R1</text>
        <text x={width - right - 20} y={height - 2} fill="rgba(255,255,255,0.45)" fontSize="10" fontFamily="monospace">R{data.length}</text>
      </svg>
    </div>
  );
}

function RecoveryOvernight() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="font-black">Sleep stages</h3>
        <div className="mt-4 flex h-12 overflow-hidden rounded-xl">
          <div className="bg-[#ffb020]" style={{ width: "4%" }} />
          <div className="bg-white/45" style={{ width: "54%" }} />
          <div className="bg-[#5aa7ff]" style={{ width: "23%" }} />
          <div className="bg-white" style={{ width: "19%" }} />
        </div>
      </Card>
      <Card>
        <h3 className="font-black">Next-day readiness</h3>
        <div className="mt-2 text-5xl font-black">86%</div>
        <Bar value={86} />
      </Card>
    </div>
  );
}
