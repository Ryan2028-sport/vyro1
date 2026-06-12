import { heroMetrics, vitals, type ViewId } from "@/lib/vyro-data";
import { Bar, Card, PageHeader, Pill, ScoreRing } from "./shared";
import { LiveMetrics } from "./LiveMetrics";

export function HomeView({ jump }: { jump: (v: ViewId, tab?: string) => void }) {
  return (
    <>
      <PageHeader
        eyebrow="Athlete Dashboard"
        title="Good morning, Ryan."
        subtitle="Tactical performance intelligence synced from your VYRO watch."
      />

      <div className="mb-4">
        <LiveMetrics />
      </div>

      <div className="mb-4 grid grid-cols-4 gap-3">
        {heroMetrics.map((m) => (
          <ScoreRing key={m.id} metric={m} onClick={() => jump(m.target, m.tab)} />
        ))}
      </div>
      <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
        Vitals · streamed from the VYRO band IMU
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card className="col-span-2">
          <button onClick={() => jump("diet")} className="w-full text-left">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">Diet Coach</div>
                <div className="mt-2 text-4xl font-black tabular-nums">
                  2,600<span className="ml-1 text-xs text-white/45">kcal</span>
                </div>
                <div className="mt-1 text-xs text-white/45">Intake goal · projected today</div>
              </div>
              <Pill color="amber">live</Pill>
            </div>
            <div className="mt-4">
              <Bar value={26} />
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[10px]">
              <div><b>1,842</b><br /><span className="text-white/45">Burn</span></div>
              <div><b>680</b><br /><span className="text-white/45">Eaten</span></div>
              <div><b>2,600</b><br /><span className="text-white/45">Goal</span></div>
              <div><b>1,920</b><br /><span className="text-white/45">Left</span></div>
            </div>
          </button>
        </Card>
        {vitals.map((v) => (
          <Card key={v[0]}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">{v[0]}</div>
                <div className="mt-2 text-3xl font-black tabular-nums">
                  {v[1]}
                  <span className="ml-1 text-xs text-white/45">{v[2]}</span>
                </div>
                <div className={`mt-1 text-xs ${v[3] === "LIVE" ? "text-[#ff2b2b]" : "text-white/45"}`}>{v[3]}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">Return-to-Play</div>
              <h3 className="mt-1 text-lg font-black">RTP Validator</h3>
            </div>
            <Pill color="amber">hold</Pill>
          </div>
          <p className="mt-3 text-sm text-white/60">
            Clearance is blocked until wearable power and AI Video symmetry are both within 5% of pre-injury baseline.
          </p>
          <div className="mt-4 space-y-3">
            <div>Video symmetry <b className="float-right">93/100</b><Bar value={93} /></div>
            <div>Wearable power <b className="float-right">91/100</b><Bar value={91} /></div>
            <div>Clearance gap <b className="float-right">4%</b><Bar value={60} color="amber" /></div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">Cognitive load</div>
              <h3 className="mt-1 text-lg font-black">Cognitive Fatigue Divergence</h3>
            </div>
            <Pill color="red">watch</Pill>
          </div>
          <p className="mt-3 text-sm text-white/60">
            Detects when your brain is tired before your body is by comparing video reaction cues against first wearable burst.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-xl bg-white/5 p-3"><b>+214ms</b><br /><span className="text-white/45">Decision delay</span></div>
            <div className="rounded-xl bg-white/5 p-3"><b>Normal</b><br /><span className="text-white/45">Heart rate</span></div>
            <div className="rounded-xl bg-white/5 p-3"><b>Cognitive flag</b><br /><span className="text-white/45">VYRO read</span></div>
          </div>
        </Card>
      </div>
    </>
  );
}
