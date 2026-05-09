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
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="font-black">Between-point HR drop</h3>
        <Spark points={[55, 62, 68, 60, 65, 72, 66, 70]} color="#fff" />
      </Card>
      <Card>
        <h3 className="font-black">Zone 5 exposure</h3>
        <div className="mt-2 text-5xl font-black">3:42</div>
        <p className="text-sm text-white/45">time at 180+ bpm</p>
      </Card>
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
