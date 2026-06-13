import { Card, PageHeader, Pill, Stat } from "./shared";

// Player match database / tendency view. Requires match-tagging + shot
// outcome capture; layout matches the spec.
export function TendencyView() {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Tendencies · opponents"
        title="Match database"
        subtitle="Shot tendencies by position and score, rally length, point outcomes, threat index."
        action={<Pill tone="warn">needs match tagging</Pill>}
      />

      <Card eyebrow="Tendencies" title="Shot tendency">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Shot types" value="—" />
          <Stat label="Critical points" value="—" />
          <Stat label="Avg rally length" value="—" />
          <Stat label="Threat index" value="—" />
        </div>
      </Card>

      <Card eyebrow="Outcomes" title="Point outcomes">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Winners" value="—" />
          <Stat label="Forced errors" value="—" />
          <Stat label="Unforced errors" value="—" />
        </div>
      </Card>

      <Card eyebrow="Opponents" title="Opponent profile">
        <div className="rounded-xl border border-dashed border-vyro-text/15 bg-vyro-text/[0.02] p-4 text-center text-[11px] text-vyro-text/45">
          Opponent / tendency builder — Phase 2
        </div>
      </Card>
    </div>
  );
}
