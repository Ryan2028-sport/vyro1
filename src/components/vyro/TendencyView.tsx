import { Card, EmptyState, PageHeader, Pill } from "./shared";

// =============================================================================
// Tendency view — opponent scouting database. The previous version was
// seeded with fictional opponents (Alex K., Marcus W., Diego R.) and
// invented matrices. With no real opponent-record table behind it, every
// card now shows an empty state until you actually log a scouted opponent.
// =============================================================================

export function TendencyView() {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Tendencies · scouting"
        title="Player tendency database"
        subtitle="Heat maps, shot tendencies and opponent reads will populate once you tag verified matches against a named opponent."
        action={<Pill tone="off">0 opponents</Pill>}
      />

      <Card eyebrow="Search opponent scouting" title="Player DB">
        <EmptyState
          title="No opponents tagged yet"
          hint="Open a finished session and add an opponent name to start building their tendency profile from your real match data."
        />
      </Card>

      <Card eyebrow="Shot choice by court position" title="Critical / non-critical">
        <EmptyState
          title="Need a tagged match"
          hint="Per-zone favourites, targets and tells fill in here once at least one match has been recorded against this opponent."
        />
      </Card>
    </div>
  );
}
