import { heroMetrics, vitals, type ViewId } from "@/lib/vyro-data";
import { Bar, Card, CompactMetric, PageHeader, Pill, ScoreRing } from "./shared";

export function HomeView({ jump }: { jump: (v: ViewId, tab?: string) => void }) {
  return (
    <>
      <PageHeader
        eyebrow="Athlete Dashboard"
        title="Good morning, Ryan."
        subtitle="Tactical performance intelligence synced from your VYRO watch."
      />

      {/* Hero rings */}
      <div className="mb-5 grid grid-cols-4 gap-2.5">
        {heroMetrics.map((m) => (
          <ScoreRing key={m.id} metric={m} onClick={() => jump(m.target, m.tab)} />
        ))}
      </div>

      {/* Live vitals — slim bento grid */}
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500">
        Vitals · Goodix GH3026 + ST 6-axis IMU
      </div>
      <div className="mb-5 grid grid-cols-2 gap-2.5">
        {vitals.slice(0, 6).map((v) => (
          <CompactMetric
            key={v[0]}
            label={v[0]}
            value={v[1]}
            unit={v[2]}
            color={v[3] === "LIVE" ? "alert" : "neutral"}
          />
        ))}
      </div>

      {/* Diet coach */}
      <Card className="mb-4">
        <button onClick={() => jump("diet")} className="w-full text-left">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500">Diet Coach</div>
              <div className="mt-1.5 text-3xl font-black tabular-nums">
                2,600<span className="ml-1 text-xs font-medium text-neutral-500">kcal</span>
              </div>
              <div className="mt-0.5 text-xs text-neutral-500">Intake goal · projected today</div>
            </div>
            <Pill color="coach">live</Pill>
          </div>
          <div className="mt-3"><Bar value={26} color="positive" /></div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[10px]">
            <div><b>1,842</b><br /><span className="text-neutral-500">Burn</span></div>
            <div><b>680</b><br /><span className="text-neutral-500">Eaten</span></div>
            <div><b>2,600</b><br /><span className="text-neutral-500">Goal</span></div>
            <div><b>1,920</b><br /><span className="text-neutral-500">Left</span></div>
          </div>
        </button>
      </Card>

      {/* RTP + Cognitive */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500">Return-to-Play</div>
              <h3 className="mt-1 text-base font-black">RTP Validator</h3>
            </div>
            <Pill color="amber">hold</Pill>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-neutral-500">
            Clearance is blocked until wearable power and AI Video symmetry are both within 5% of pre-injury baseline.
          </p>
          <div className="mt-3 space-y-2 text-xs">
            <div>Video symmetry <b className="float-right">93/100</b><Bar value={93} color="positive" /></div>
            <div>Wearable power <b className="float-right">91/100</b><Bar value={91} color="positive" /></div>
            <div>Clearance gap <b className="float-right">4%</b><Bar value={60} color="amber" /></div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500">Cognitive load</div>
              <h3 className="mt-1 text-base font-black">Fatigue Divergence</h3>
            </div>
            <Pill color="red">watch</Pill>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-neutral-500">
            Detects when your brain is tired before your body is by comparing video reaction cues against the first wearable burst.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-2xl bg-white p-2.5 ring-1 ring-black/5"><b>+214ms</b><br /><span className="text-neutral-500">Decision delay</span></div>
            <div className="rounded-2xl bg-white p-2.5 ring-1 ring-black/5"><b>Normal</b><br /><span className="text-neutral-500">Heart rate</span></div>
            <div className="rounded-2xl bg-white p-2.5 ring-1 ring-black/5"><b>Cognitive flag</b><br /><span className="text-neutral-500">VYRO read</span></div>
          </div>
        </Card>
      </div>
    </>
  );
}
