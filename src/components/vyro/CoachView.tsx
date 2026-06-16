import { useState } from "react";
import { Card, EmptyState, PageHeader, Pill, Stat } from "./shared";
import { SportView } from "./SportView";

type Tab = "team" | "sport" | "match" | "opponent" | "plan" | "heatmap";

const TABS: { id: Tab; label: string }[] = [
  { id: "team", label: "Team Status" },
  { id: "sport", label: "Sport DB" },
  { id: "match", label: "Match DB" },
  { id: "opponent", label: "Opponent Model" },
  { id: "plan", label: "Plan" },
  { id: "heatmap", label: "Heatmap" },
];

type Status = "ready" | "modified" | "attention" | "unavailable";
const STATUS_TONE: Record<Status, "live" | "warn" | "off" | "neutral"> = {
  ready: "live",
  modified: "warn",
  attention: "off",
  unavailable: "neutral",
};
const STATUS_LABEL: Record<Status, string> = {
  ready: "Ready",
  modified: "Modified training",
  attention: "Needs attention",
  unavailable: "Unavailable",
};

const ROSTER: {
  name: string;
  status: Status;
  recovery: number;
  hr: number;
  tControl: number;
  swingConsistency: number;
  decel: number;
  action: string;
}[] = [
  { name: "Maya Torres", status: "ready", recovery: 88, hr: 72, tControl: 78, swingConsistency: 84, decel: 92, action: "Greenlight hard block" },
  { name: "Jalen Brooks", status: "modified", recovery: 64, hr: 81, tControl: 71, swingConsistency: 78, decel: 80, action: "Cap court time 40 min" },
  { name: "Eli Morgan", status: "attention", recovery: 41, hr: 88, tControl: 62, swingConsistency: 70, decel: 67, action: "Hold — recovery focus" },
  { name: "Nina Park", status: "ready", recovery: 82, hr: 69, tControl: 76, swingConsistency: 81, decel: 88, action: "Reactive ghosting × 6" },
  { name: "Owen Lee", status: "modified", recovery: 68, hr: 76, tControl: 69, swingConsistency: 73, decel: 79, action: "Easy session" },
  { name: "Lucas Reed", status: "ready", recovery: 79, hr: 71, tControl: 74, swingConsistency: 79, decel: 86, action: "Match practice cleared" },
  { name: "Mateo Silva", status: "unavailable", recovery: 0, hr: 0, tControl: 0, swingConsistency: 0, decel: 0, action: "Travel day" },
  { name: "Zoe Kim", status: "ready", recovery: 84, hr: 70, tControl: 80, swingConsistency: 85, decel: 90, action: "Drill: decel to T" },
];

export function CoachView() {
  const [tab, setTab] = useState<Tab>("team");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [compare, setCompare] = useState(false);

  const filtered = statusFilter === "all" ? ROSTER : ROSTER.filter((r) => r.status === statusFilter);
  const active = ROSTER.filter((r) => r.status !== "unavailable");
  const avgRecovery = Math.round(active.reduce((s, r) => s + r.recovery, 0) / active.length);
  const greenCount = ROSTER.filter((r) => r.status === "ready").length;
  const redCount = ROSTER.filter((r) => r.status === "attention").length;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Coach · iPad view"
        title="Coach"
        subtitle="Live roster, opponent model, weekly plan, and team-wide heatmap. All metrics tied to verified band data."
        action={<Pill tone="live" pulse>Live roster</Pill>}
      />

      {/* Tab bar */}
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
              tab === t.id
                ? "border-vyro-mint bg-vyro-mint text-vyro-ink"
                : "border-vyro-line bg-vyro-panel text-vyro-mute"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "team" && (
        <>
          <Card eyebrow="Squad readiness" title="Today">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Players" value={ROSTER.length} />
              <Stat label="Avg recovery" value={avgRecovery} unit="%" />
              <Stat label="In green" value={greenCount} />
              <Stat label="In red" value={redCount} />
            </div>
          </Card>

          <Card
            eyebrow="Coach's iPad · Live Roster"
            title="Current HR + Live Recovery readiness"
            action={
              <button
                onClick={() => setCompare((c) => !c)}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                  compare ? "border-vyro-mint bg-vyro-mint text-vyro-ink" : "border-vyro-line bg-vyro-panel text-vyro-mute"
                }`}
              >
                Compare mode
              </button>
            }
          >
            <div className="-mx-1 mb-2 flex gap-1 overflow-x-auto px-1">
              {(["all", "ready", "modified", "attention", "unavailable"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold capitalize ${
                    statusFilter === s
                      ? "border-vyro-text/40 bg-vyro-text/10 text-vyro-text"
                      : "border-vyro-line bg-vyro-panel text-vyro-mute"
                  }`}
                >
                  {s === "all" ? "All" : STATUS_LABEL[s]}
                </button>
              ))}
              {statusFilter !== "all" && (
                <button
                  onClick={() => setStatusFilter("all")}
                  className="whitespace-nowrap rounded-full border border-vyro-line bg-vyro-panel px-2.5 py-1 text-[10px] font-semibold text-vyro-mute"
                >
                  Clear filter
                </button>
              )}
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-vyro-line bg-vyro-elev p-4 text-center text-[11px] text-vyro-mute">
                No athletes in this filter.
              </div>
            ) : (
              <ul className="divide-y divide-vyro-line/60">
                {filtered.map((r) => (
                  <li key={r.name} className="py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-vyro-text">{r.name}</div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <Pill tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Pill>
                          <span className="font-mono text-[9px] uppercase tracking-wider text-vyro-mute">Consent: full</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-[9px] uppercase tracking-wider text-vyro-mute">Live Recovery</div>
                        <div className="text-lg font-black tabular-nums text-vyro-text">{r.recovery || "—"}</div>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
                      <Mini label="HR" v={r.hr || "—"} />
                      <Mini label="T-Ctl %" v={r.tControl || "—"} />
                      <Mini label="Swing" v={r.swingConsistency || "—"} />
                      <Mini label="Decel" v={r.decel || "—"} />
                    </div>
                    <div className="mt-2 text-[11px] text-vyro-mute">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-vyro-mute/80">Coach action · </span>
                      {r.action}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-vyro-mute">Most ready: <span className="text-vyro-text font-semibold">Maya Torres</span>. Active athletes: {active.length}.</p>
          </Card>
        </>
      )}

      {tab === "match" && (
        <>
          <Card eyebrow="Match DB · team view" title="Verified opponent history">
            <EmptyState
              title="No team match data yet"
              hint="Once athletes upload sport-specific sessions, the coach sees only this sport's opponent history here."
            />
          </Card>
        </>
      )}

      {tab === "opponent" && (
        <>
          <Card eyebrow="Aggregated · team sample" title="Combined opponent model">
            <EmptyState
              title="No combined opponent model yet."
              hint="Add tagged matches from at least 3 athletes to unlock the detailed tendency profile and top-pressure-shot reads."
            />
          </Card>
          <Card eyebrow="Detailed tendency profile" title="Team sample">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="Top pressure shot" value="—" />
              <Stat label="Critical-point tell" value="—" />
              <Stat label="Aggregated sample" value="0" unit="matches" />
            </div>
          </Card>
        </>
      )}

      {tab === "plan" && (
        <>
          <Card eyebrow="Today's recommendations" title="AI-generated · weak-point targeted">
            <ul className="space-y-2 text-sm text-vyro-text">
              <li className="flex items-start gap-2 rounded-xl border border-vyro-line bg-vyro-elev p-3">
                <Pill tone="live">Cleared</Pill>
                <span>Hard interval session cleared</span>
              </li>
              <li className="flex items-start gap-2 rounded-xl border border-vyro-line bg-vyro-elev p-3">
                <Pill tone="warn">Cap</Pill>
                <span>Cap court time at 50 min</span>
              </li>
              <li className="flex items-start gap-2 rounded-xl border border-vyro-line bg-vyro-elev p-3">
                <Pill tone="neutral">Drill</Pill>
                <span>Drill: deceleration to T</span>
              </li>
            </ul>
          </Card>

          <Card eyebrow="Personalized training" title="Weak-point targeted">
            <ul className="space-y-1.5 text-sm text-vyro-text">
              <li>• Reactive ghosting × 6 sets</li>
              <li>• Box breathing post-session</li>
              <li>• Square-to-side-wall drill</li>
              <li>• Single-leg eccentric Bulgarian split squat</li>
            </ul>
          </Card>

          <Card eyebrow="Overtraining detection" title="Today's load target">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black tabular-nums text-vyro-text">68</span>
              <span className="text-sm text-vyro-mute">/ 100</span>
            </div>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-vyro-line">
              <div className="bg-vyro-mint" style={{ width: "33%" }} />
              <div className="bg-vyro-amber" style={{ width: "35%" }} />
              <div className="bg-vyro-rose" style={{ width: "32%" }} />
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[9px] uppercase tracking-wider text-vyro-mute">
              <span>Rest</span><span>Easy</span><span>Hard</span>
            </div>
            <p className="mt-3 text-[11px] text-vyro-mute">→ Easy session recommended today.</p>
          </Card>

          <Card eyebrow="Opponent tendency DB" title="No opponent data">
            <p className="text-[12px] text-vyro-mute">Tag an upcoming opponent to surface critical-point shot choices and weak zones here.</p>
          </Card>
        </>
      )}

      {tab === "heatmap" && (
        <>
          <Card eyebrow="Team heatmap" title="HR · Live Rec · Sources">
            <div className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1">
              {["HR", "Live Rec", "Sources", "Sport", "Team model", "Athletes", "Live roster"].map((f) => (
                <button key={f} className="whitespace-nowrap rounded-full border border-vyro-line bg-vyro-panel px-2.5 py-1 text-[10px] font-semibold text-vyro-mute">
                  {f}
                </button>
              ))}
            </div>
            <div className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-vyro-line bg-vyro-elev text-[11px] text-vyro-mute">
              Aggregated team heatmap — populates as athletes complete sessions.
            </div>
            <p className="mt-2 text-[11px] text-vyro-mute">Glossary: <span className="text-vyro-text">Change of direction</span>, not shorthand average. <span className="text-vyro-text">Signal confidence</span> is a trust score, not a recovery organ system.</p>
          </Card>

          <Card eyebrow="Athlete Development" title="Long-term progress">
            <p className="text-[12px] text-vyro-mute mb-3">14-day signal — overtraining detection and personalized programming.</p>
            <ul className="space-y-2 text-[12px]">
              <li className="rounded-lg border border-vyro-line bg-vyro-elev p-2.5"><span className="font-semibold text-vyro-text">T-control trend:</span> <span className="text-vyro-mute">Up 22 points over 14 days. The T is becoming home.</span></li>
              <li className="rounded-lg border border-vyro-line bg-vyro-elev p-2.5"><span className="font-semibold text-vyro-text">RHR:</span> <span className="text-vyro-mute">Dropped 6 bpm — clean aerobic adaptation.</span></li>
              <li className="rounded-lg border border-vyro-line bg-vyro-elev p-2.5"><span className="font-semibold text-vyro-text">Agility score:</span> <span className="text-vyro-mute">Plateauing — introduce reactive ghosting drills.</span></li>
              <li className="rounded-lg border border-vyro-line bg-vyro-elev p-2.5"><span className="font-semibold text-vyro-text">Decel back to T:</span> <span className="text-vyro-mute">Cuts down 0.25s — direct ROI on plyometric work.</span></li>
              <li className="rounded-lg border border-vyro-line bg-vyro-elev p-2.5"><span className="font-semibold text-vyro-text">Z5 → Z2 recovery (bpm/30s):</span> <span className="text-vyro-mute">Cardiac zone recovery is your biggest gain. +18 bpm in 14 days.</span></li>
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

function Mini({ label, v }: { label: string; v: any }) {
  return (
    <div className="rounded-lg bg-vyro-text/[0.04] py-1">
      <div className="font-mono text-[8px] uppercase tracking-wider text-vyro-mute">{label}</div>
      <div className="text-xs font-bold tabular-nums text-vyro-text">{v}</div>
    </div>
  );
}
