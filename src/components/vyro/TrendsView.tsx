import { trendMetrics } from "@/lib/vyro-data";
import { Card, PageHeader, Pill, Spark } from "./shared";

export function TrendsView() {
  return (
    <>
      <PageHeader
        eyebrow="Trends"
        title="Progress"
        action={<Pill>AI insights</Pill>}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {trendMetrics.map((m, i) => (
          <Card key={m[0]}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{m[0]}</h3>
                <div className="text-xs text-gray-400">Current {m[1]}{m[2]}</div>
              </div>
              <Pill>{m[3]}</Pill>
            </div>
            <div className="mt-4">
              <Spark
                points={[60 + i * 3, 64 + i * 2, 62 + i, 70, 73 + i, 78, 80 + i, 84]}
                color="#16a34a"
              />
            </div>
            <p className="mt-3 text-sm text-gray-500">{m[4]}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
