import { Bar, Card, PageHeader } from "./shared";

type Tab = "overall" | "timeline" | "wakeups" | "performance";

export function SleepView({ sleepTab, setSleepTab }: { sleepTab: Tab; setSleepTab: (t: Tab) => void }) {
  const tabs: [Tab, string][] = [
    ["overall", "Overall Sleep"],
    ["timeline", "Sleep Zones"],
    ["wakeups", "Wakeups"],
    ["performance", "Performance"],
  ];
  return (
    <>
      <PageHeader
        eyebrow="Sleep"
        title="Sleep"
      />
      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto">
        {tabs.map(([id, label]) => (
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
