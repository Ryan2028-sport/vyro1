import { Card, PageHeader, Pill, Stat } from "./shared";

// Coach roster + tendency view (combined into one nav tile per the new
// nav). Roster data needs a multi-athlete DB schema (Phase 3); tendency
// data needs match-tagging.
export function CoachView() {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Roster · plan"
        title="Coach"
        subtitle="Player load, match-day readiness, weekly plan and tendency database."
        action={<Pill tone="warn">roster pending</Pill>}
      />

      <Card eyebrow="Roster · today" title="Squad readiness">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Players" value="—" />
          <Stat label="Avg recovery" value="—" unit="%" />
          <Stat label="In green" value="—" />
          <Stat label="In red" value="—" />
        </div>
      </Card>

      <Card eyebrow="Per-player" title="Live state">
        <div className="rounded-xl border border-dashed border-vyro-text/15 bg-vyro-text/[0.02] p-4 text-center text-[11px] text-vyro-text/45">
          Roster list — needs Coach DB schema (Phase 3)
        </div>
      </Card>

      <Card eyebrow="AI · weekly plan" title="Weekly plan">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Focus" value="—" />
          <Stat label="Target sessions" value="—" />
          <Stat label="Suggested rest" value="—" />
          <Stat label="Drill 1" value="—" />
          <Stat label="Drill 2" value="—" />
          <Stat label="Drill 3" value="—" />
        </div>
      </Card>
    </div>
  );
}
