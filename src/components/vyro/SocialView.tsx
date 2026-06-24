import { Building2, Users, Trophy } from "lucide-react";
import { Card, EmptyState, PageHeader, Pill } from "./shared";

// =============================================================================
// Social view — leaderboards only populate when multiple verified athletes
// in your group have synced sessions. No fabricated rivalries, no demo
// challenge boards. Each category just shows an empty state.
// =============================================================================

const CATEGORIES = [
  { id: "school", label: "School vs School", icon: Building2 },
  { id: "club", label: "Club vs Club", icon: Building2 },
  { id: "group", label: "Group vs Group", icon: Users },
  { id: "squash", label: "Squash Global", icon: Trophy },
  { id: "tennis", label: "Tennis Global", icon: Trophy },
] as const;

export function SocialView() {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Social · leaderboards"
        title="Verified competitions"
        subtitle="Challenges and live matchups populate when multiple linked bands in your group sync verified sessions."
        action={<Pill tone="off">No groups joined</Pill>}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CATEGORIES.map(({ id, label, icon: Icon }) => (
          <div key={id} className="flex flex-col items-start gap-2 rounded-2xl border border-vyro-line bg-vyro-panel p-3">
            <Icon className="h-4 w-4 text-vyro-mute" />
            <div className="text-[12px] font-bold text-vyro-text">{label}</div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-vyro-mute">No entrants</div>
          </div>
        ))}
      </div>

      <Card eyebrow="Active challenges" title="Live boards">
        <EmptyState
          title="No active challenges"
          hint="Once two or more linked-band athletes opt into a shared group, leaderboards compute from verified session data only."
        />
      </Card>

      <Card eyebrow="Live matchups" title="School / club / group">
        <EmptyState
          title="No matchups in progress"
          hint="Real-time team comparisons need at least one athlete from each side streaming a verified session."
        />
      </Card>
    </div>
  );
}
