import { heroMetrics, trendMetrics, vitals, type ViewId } from "@/lib/vyro-data";
import { TrendingUp } from "lucide-react";
import { Bar, Card, HeroCard, PageHeader, Pill, ScoreRing, Spark } from "./shared";

export function HomeView({ jump }: { jump: (v: ViewId, tab?: string) => void }) {
  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Good morning, Ryan."
      />

      <div className="mb-6 grid grid-cols-4 gap-2 place-items-center">
        {heroMetrics.map((m) => (
          <ScoreRing key={m.id} metric={m} onClick={() => jump(m.target, m.tab)} />
        ))}
      </div>
      <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500">
        Live vitals
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <HeroCard className="col-span-2">
          <button onClick={() => jump("diet")} className="w-full text-left">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500">Diet Coach</div>
              <div className="mt-2 text-4xl font-semibold tabular-nums leading-none">
                680<span className="text-gray-400">/</span>2,600<span className="ml-1 text-xs text-gray-400">kcal</span>
              </div>
              <div className="mt-1.5 text-xs text-gray-400">Intake goal · projected today</div>
            </div>
            <div className="mt-4">
              <Bar value={26} color="amber" />
            </div>
          </button>
        </HeroCard>
        {vitals.map((v) => (
          <Card key={v[0]}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">{v[0]}</div>
                <div className="mt-2 text-3xl font-semibold tabular-nums leading-none">
                  {v[1]}
                  <span className="ml-1 text-xs text-gray-400">{v[2]}</span>
                </div>
                <div className={`mt-1 text-xs ${v[3] === "LIVE" ? "text-vyro-red" : "text-gray-400"}`}>{v[3]}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500">Return-to-Play</div>
              <h3 className="mt-1 text-lg font-semibold">RTP Validator</h3>
            </div>
            <Pill color="amber">hold</Pill>
          </div>
          <p className="mt-3 text-sm text-gray-500">
            Clearance blocked — video symmetry and wearable power must be within 5% of baseline.
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
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500">Cognitive load</div>
              <h3 className="mt-1 text-lg font-semibold">Cognitive Fatigue Divergence</h3>
            </div>
            <Pill color="red">watch</Pill>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-2xl bg-gray-50/80 p-3"><b>+214ms</b><br /><span className="text-gray-400">Decision delay</span></div>
            <div className="rounded-2xl bg-gray-50/80 p-3"><b>Normal</b><br /><span className="text-gray-400">Heart rate</span></div>
            <div className="rounded-2xl bg-gray-50/80 p-3"><b>Cognitive flag</b><br /><span className="text-gray-400">VYRO read</span></div>
          </div>
        </Card>
      </div>
      <button onClick={() => jump("trends")} className="mt-6 w-full text-left">
        <Card className="transition-colors hover:bg-gray-50/50 active:scale-[0.99]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gray-400" />
              <h3 className="font-semibold">Trends</h3>
            </div>
            <span className="text-xs text-gray-400">View all →</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {trendMetrics.slice(0, 3).map((m, i) => (
              <div key={m[0]} className="rounded-xl bg-gray-50/80 p-3">
                <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-gray-400">{m[0]}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{m[1]}<span className="ml-0.5 text-xs text-gray-400">{m[2]}</span></div>
                <div className="mt-1 text-xs text-emerald-600">{m[3]}</div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Spark points={[60, 64, 62, 70, 73, 78, 80, 84]} color="#6b7280" />
          </div>
        </Card>
      </button>
    </>
  );
}
