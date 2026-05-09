import { trendMetrics } from "@/lib/vyro-data";
import { Card, PageHeader, Pill, Spark } from "./shared";

export function TrendsView() {
  return (
    <>
      <PageHeader
        eyebrow="Player Dashboard · Progress"
        title="Ryan's trend intelligence"
        subtitle="All tracked metrics translated into progress graphs and AI coaching notes."
        action={<Pill>AI insights</Pill>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {["Agility +10.5%", "Resting HR -5 bpm", "T-control +20.6%"].map((x) => (
          <Card key={x}>
            <div className="text-sm text-white/45">Performance signal</div>
            <div className="mt-2 text-3xl font-black">{x}</div>
          </Card>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {trendMetrics.map((m, i) => (
          <Card key={m[0]}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold">{m[0]}</h3>
                <div className="text-xs text-white/45">Current {m[1]}{m[2]}</div>
              </div>
              <Pill>{m[3]}</Pill>
            </div>
            <div className="mt-4">
              <Spark
                points={[60 + i * 3, 64 + i * 2, 62 + i, 70, 73 + i, 78, 80 + i, 84]}
                color={i === 1 ? "#ffb020" : "#ffffff"}
              />
            </div>
            <p className="mt-3 text-sm text-white/60">{m[4]}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
