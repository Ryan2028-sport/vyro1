import { Bar, Card, ScoreRing, Spark } from "./shared";

type RecoveryTab = "live" | "ingame" | "fatigue" | "overnight";
type SleepTab = "overall" | "timeline" | "wakeups" | "performance";
type TopSection = "recovery" | "sleep";

export function RecoveryView({
  recoveryTab,
  setRecoveryTab,
  sleepTab,
  setSleepTab,
  section,
  setSection,
}: {
  recoveryTab: RecoveryTab;
  setRecoveryTab: (t: RecoveryTab) => void;
  sleepTab: SleepTab;
  setSleepTab: (t: SleepTab) => void;
  section: TopSection;
  setSection: (s: TopSection) => void;
}) {
  const recoveryTabs: [RecoveryTab, string][] = [
    ["live", "LIVE Recovery"],
    ["ingame", "In-Game"],
    ["fatigue", "Total Fatigue"],
    ["overnight", "Overnight"],
  ];
  const sleepTabs: [SleepTab, string][] = [
    ["overall", "Overall Sleep"],
    ["timeline", "Sleep Zones"],
    ["wakeups", "Wakeups"],
    ["performance", "Performance"],
  ];
  return (
    <>
      <div className="mx-auto mb-8 flex w-full max-w-xs items-center gap-1 rounded-2xl border border-gray-200/80 bg-gray-100/60 p-1.5 backdrop-blur-sm">
        <button
          onClick={() => setSection("recovery")}
          className={`flex-1 rounded-xl py-2.5 text-center text-sm tracking-wide transition-all duration-200 ${
            section === "recovery"
              ? "bg-white text-gray-900 font-medium shadow-sm"
              : "text-gray-400"
          }`}
        >
          Recovery
        </button>
        <button
          onClick={() => setSection("sleep")}
          className={`flex-1 rounded-xl py-2.5 text-center text-sm tracking-wide transition-all duration-200 ${
            section === "sleep"
              ? "bg-white text-gray-900 font-medium shadow-sm"
              : "text-gray-400"
          }`}
        >
          Sleep
        </button>
      </div>
      {section === "recovery" && (
        <>
          <div className="mb-5 flex gap-2 overflow-x-auto">
            {recoveryTabs.map(([id, label]) => (
              <button
                key={id}
                onClick={() => setRecoveryTab(id)}
                className={`rounded-full border px-4 py-2 text-sm ${
                  recoveryTab === id ? "border-gray-300 bg-gray-100 text-gray-900" : "border-gray-200 text-gray-500"
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
      )}
      {section === "sleep" && (
        <>
          <div className="mb-5 flex gap-2 overflow-x-auto">
            {sleepTabs.map(([id, label]) => (
              <button
                key={id}
                onClick={() => setSleepTab(id)}
                className={`rounded-full border px-4 py-2 text-sm ${
                  sleepTab === id ? "border-gray-300 bg-gray-100 text-gray-900" : "border-gray-200 text-gray-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <SleepContent sleepTab={sleepTab} />
        </>
      )}
    </>
  );
}

function SleepContent({ sleepTab }: { sleepTab: SleepTab }) {
  return (
    <>
      {sleepTab === "overall" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="font-semibold">Sleep Score</h3>
            <div className="mt-4 text-6xl font-semibold tabular-nums">87</div>
            <p className="text-gray-400">6h 46m asleep · 4 wakeups · 1h 24m sleep debt</p>
          </Card>
          <Card>
            <h3 className="font-semibold">Recovery interpretation</h3>
            <div className="mt-4 space-y-3 text-sm text-gray-600">
              <p>Deep sleep carried early-night muscle repair.</p>
              <p>REM supports reaction timing and shot selection.</p>
              <p>The 2:27 AM HR spike is a recovery-quality flag after high Z5 rallies.</p>
            </div>
          </Card>
        </div>
      )}
      {sleepTab === "timeline" && (
        <Card>
          <h3 className="font-semibold">Sleep zones</h3>
          <div className="mt-5 flex h-16 overflow-hidden rounded-2xl border border-gray-200">
            <div className="bg-vyro-amber" style={{ width: "4%" }} />
            <div className="bg-gray-300" style={{ width: "54%" }} />
            <div className="bg-vyro-blue-light" style={{ width: "23%" }} />
            <div className="bg-gray-900" style={{ width: "19%" }} />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-3 text-center text-sm">
            <div>Awake<br /><b>18m</b></div>
            <div>Light<br /><b>3h 38m</b></div>
            <div>REM<br /><b>1h 32m</b></div>
            <div>Deep<br /><b>1h 18m</b></div>
          </div>
        </Card>
      )}
      {sleepTab === "wakeups" && (
        <Card>
          <h3 className="font-semibold">Wake events</h3>
          <div className="mt-4 space-y-3">
            {[
              "12:45 AM · 4 min · Short movement spike",
              "2:27 AM · 6 min · HR +8 bpm above baseline",
              "5:01 AM · 3 min · Restless turn cluster",
              "6:04 AM · 5 min · Final wake window",
            ].map((x) => (
              <div key={x} className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm">
                {x}
              </div>
            ))}
          </div>
        </Card>
      )}
      {sleepTab === "performance" && (
        <Card>
          <h3 className="font-semibold">Sleep performance</h3>
          <div className="mt-4 space-y-4">
            <div>Performance 83<Bar value={83} /></div>
            <div>Consistency 91<Bar value={91} /></div>
            <div>Restorative share 42<Bar value={42} color="amber" /></div>
          </div>
        </Card>
      )}
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
      <div className="flex items-center justify-center">
        <ScoreRing metric={{ label: "LIVE Recovery", value: 78, color: "teal" }} />
      </div>
      <Card className="lg:col-span-2">
        <h3 className="font-semibold">Subscores</h3>
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
        <h3 className="font-semibold text-vyro-amber">HR-only trap detected</h3>
        <p className="mt-2 text-sm text-gray-500">
          HR within 6 bpm of baseline, but muscle readiness still 64/100 after Z5 rallies.
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
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">
              {x.replace(/\d+/, "")}
            </div>
            <div className="mt-2 text-5xl font-semibold tabular-nums">{v}</div>
            <Bar value={v} color="amber" />
          </Card>
        );
      })}
      <Card className="lg:col-span-3">
        <h3 className="font-semibold">Fatigue decay · 14 days</h3>
        <Spark points={[42, 51, 58, 64, 71, 68, 62, 56, 49, 54, 61, 65, 60, 62]} color="var(--vyro-amber)" />
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
            <h3 className="font-semibold">Between-point HR drop</h3>
          </div>
          <div className="text-right">
            <div className="text-3xl font-semibold tabular-nums">30</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">
              bpm drop
            </div>
          </div>
        </div>
        <MatchLineChart
          data={hrDrops}
          min={120}
          max={190}
          unit="bpm"
          className="mt-5 text-vyro-recovery"
        />
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-gray-500">
          <div className="rounded-2xl bg-gray-50/80 p-3">
            <span className="block text-lg font-semibold tabular-nums text-gray-900">178</span>peak
          </div>
          <div className="rounded-2xl bg-gray-50/80 p-3">
            <span className="block text-lg font-semibold tabular-nums text-gray-900">148</span>recovered
          </div>
          <div className="rounded-2xl bg-gray-50/80 p-3">
            <span className="block text-lg font-semibold tabular-nums text-gray-900">0:42</span>time
          </div>
        </div>
      </Card>
      <Card className="min-h-[260px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">Recovery speed under fatigue</h3>
          </div>
          <div className="text-right">
            <div className="text-3xl font-semibold tabular-nums">68%</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">
              speed
            </div>
          </div>
        </div>
        <MatchLineChart
          data={fatigueRecovery}
          min={60}
          max={100}
          unit="%"
          className="mt-5 text-vyro-fatigue"
        />
        <div className="mt-4 space-y-3 text-sm text-gray-600">
          <div>
            Fast recovery reserve
            <Bar value={68} color="amber" />
          </div>
          <p className="text-xs leading-relaxed text-gray-400">
            Recovery is slowing after repeated Zone 5 points; flag substitution, hydration, or
            tactical pacing.
          </p>
        </div>
      </Card>
      <Card className="lg:col-span-2">
        <h3 className="font-semibold">Zone 5 exposure</h3>
        <div className="mt-2 text-5xl font-semibold tabular-nums">3:42</div>
        <p className="text-sm text-gray-400">time at 180+ bpm</p>
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
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[150px] w-full overflow-visible"
        role="img"
        aria-label={`${unit} recovery chart`}
      >
        <line x1={left} y1={top} x2={left} y2={height - bottom} stroke="rgba(0,0,0,0.08)" />
        <line
          x1={left}
          y1={height - bottom}
          x2={width - right}
          y2={height - bottom}
          stroke="rgba(0,0,0,0.08)"
        />
        {[0.25, 0.5, 0.75].map((tick) => {
          const y = top + tick * plotHeight;
          return (
            <line
              key={tick}
              x1={left}
              y1={y}
              x2={width - right}
              y2={y}
              stroke="rgba(0,0,0,0.06)"
              strokeDasharray="4 6"
            />
          );
        })}
        <polygon points={area} fill="currentColor" opacity="0.12" />
        <polyline
          points={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, index) => (
          <circle
            key={`${point.value}-${index}`}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="currentColor"
            stroke="white"
            strokeWidth="2"
          />
        ))}
        <text x="0" y={top + 4} fill="rgba(0,0,0,0.4)" fontSize="10" fontFamily="monospace">
          {max}
          {unit}
        </text>
        <text
          x="0"
          y={height - bottom + 3}
          fill="rgba(0,0,0,0.4)"
          fontSize="10"
          fontFamily="monospace"
        >
          {min}
          {unit}
        </text>
        <text
          x={left}
          y={height - 2}
          fill="rgba(0,0,0,0.4)"
          fontSize="10"
          fontFamily="monospace"
        >
          R1
        </text>
        <text
          x={width - right - 20}
          y={height - 2}
          fill="rgba(0,0,0,0.4)"
          fontSize="10"
          fontFamily="monospace"
        >
          R{data.length}
        </text>
      </svg>
    </div>
  );
}

function RecoveryOvernight() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="font-semibold">Sleep stages</h3>
        <div className="mt-4 flex h-12 overflow-hidden rounded-xl">
          <div className="bg-vyro-amber" style={{ width: "4%" }} />
          <div className="bg-gray-300" style={{ width: "54%" }} />
          <div className="bg-vyro-blue-light" style={{ width: "23%" }} />
          <div className="bg-gray-900" style={{ width: "19%" }} />
        </div>
      </Card>
      <Card>
        <h3 className="font-semibold">Next-day readiness</h3>
        <div className="mt-2 text-5xl font-semibold tabular-nums">86%</div>
        <Bar value={86} />
      </Card>
    </div>
  );
}
