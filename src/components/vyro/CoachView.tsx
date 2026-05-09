import { sports } from "@/lib/vyro-data";
import { Bar, Card, PageHeader } from "./shared";

export function CoachView() {
  return (
    <>
      <PageHeader
        eyebrow="Coach-only portal"
        title="Sport-scoped roster intelligence"
        subtitle="Coaches see athletes by sport. Strength trainers can toggle sports without seeing everyone at once."
      />
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {sports.map((s) => (
          <button key={s} className="shrink-0 rounded-full border border-white/10 px-4 py-2 text-sm text-white/70">
            {s} <span className="text-white/35">{s === "Squash" ? 3 : 2}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h3 className="font-black">Squash roster</h3>
          <div className="mt-4 space-y-2">
            {[
              "Ryan Chen · Ready · load 62",
              "Alex K. · Peak · load 44",
              "Marcus W. · Caution · load 76",
            ].map((x) => (
              <div key={x} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
                {x}
                <Bar value={70} />
              </div>
            ))}
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <h3 className="font-black">Combined opponent model</h3>
          <p className="mt-2 text-sm text-white/55">
            Coach can combine Ryan's match database with teammate match databases to build a larger tendency profile for
            Player X.
          </p>
          <div className="mt-4 space-y-3">
            <div>Pressure straight drive 72%<Bar value={72} /></div>
            <div>Boast from back-left 44%<Bar value={44} color="amber" /></div>
            <div>Volley kill on loose rail 61%<Bar value={61} /></div>
          </div>
        </Card>
        <Card className="lg:col-span-3">
          <h3 className="font-black">Coach's iPad</h3>
          <p className="mt-2 text-sm text-white/55">
            For baseball, basketball, football, soccer, and hockey: live roster, substitution readiness, red-zone
            fatigue, and player availability.
          </p>
        </Card>
      </div>
    </>
  );
}
