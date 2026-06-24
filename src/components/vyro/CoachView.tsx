// Coach view — single-athlete (current user) edition. The roster is built
// from real live ctx + recent saved sessions instead of mocked teammates.
// Team / opponent / aggregated views remain as empty states until a true
// coach data model (other users, consent, team membership) exists.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, EmptyState, PageHeader, Pill, Stat } from "./shared";
import { SportView } from "./SportView";
import { useLiveMetrics, fmtNum } from "./useLiveMetrics";
import { getMySessions } from "@/lib/sessions.functions";
import {
  agilityScore,
  avgTControl,
  swingConsistency,
  trainingLoad7d,
  type RawSession,
} from "@/lib/sessions-derived";
import { useSleepNights } from "@/lib/use-sleep-nights";

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

type Roster = {
  name: string;
  status: Status;
  recovery: number;
  hr: number;
  tControl: number;
  swingConsistency: number;
  decel: number;
  action: string;
};

function buildSelfRoster(
  liveHr: number | null,
  liveRecovery: number | null,
  sessions: RawSession[],
  pairedName: string | null,
): Roster {
  const t = avgTControl(sessions.slice(0, 10));
  const sw = swingConsistency(sessions.slice(0, 10));
  const recent = sessions[0];
  const decel = recent ? Math.min(100, Math.round(agilityScore(recent) ?? 0)) : 0;
  const recovery = liveRecovery ?? 0;
  const status: Status =
    recovery >= 75 ? "ready" : recovery >= 50 ? "modified" : recovery > 0 ? "attention" : "unavailable";
  const action =
    status === "ready"
      ? "Greenlight hard block"
      : status === "modified"
        ? "Cap court time 40 min"
        : status === "attention"
          ? "Hold — recovery focus"
          : "Pair band to populate metrics";

  return {
    name: pairedName ?? "You",
    status,
    recovery,
    hr: liveHr ?? 0,
    tControl: t ?? 0,
    swingConsistency: sw ?? 0,
    decel,
    action,
  };
}

// Quick recovery proxy from live ctx (mirrors AthleteHome): higher HRV/lower
// resting HR → higher readiness. 0–100. Returns null when no signal.
function liveRecoveryScore(live: ReturnType<typeof useLiveMetrics>): number | null {
  const hrv = live.hrvMs;
  const rhr = live.restingHrBpm;
  if (hrv == null && rhr == null) return null;
  const hrvScore = hrv == null ? 60 : Math.max(0, Math.min(100, (hrv - 20) * 2));
  const rhrScore = rhr == null ? 60 : Math.max(0, Math.min(100, 120 - rhr));
  return Math.round(hrvScore * 0.55 + rhrScore * 0.45);
}

export function CoachView() {
  const [tab, setTab] = useState<Tab>("team");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [compare, setCompare] = useState(false);

  const live = useLiveMetrics();
  const fetchSessions = useServerFn(getMySessions);
  const { data } = useQuery({ queryKey: ["sessions"], queryFn: () => fetchSessions() });
  const sessions = (data ?? []) as RawSession[];
  const { last: lastNight } = useSleepNights();

  const recovery = liveRecoveryScore(live);
  const self = useMemo(
    () => buildSelfRoster(live.heartRateBpm ?? null, recovery, sessions, live.pairedName ?? null),
    [live.heartRateBpm, recovery, sessions, live.pairedName],
  );

  const ROSTER: Roster[] = [self];
  const filtered = statusFilter === "all" ? ROSTER : ROSTER.filter((r) => r.status === statusFilter);
  const active = ROSTER.filter((r) => r.status !== "unavailable");
  const avgRecovery = active.length ? Math.round(active.reduce((s, r) => s + r.recovery, 0) / active.length) : 0;
  const greenCount = ROSTER.filter((r) => r.status === "ready").length;
  const redCount = ROSTER.filter((r) => r.status === "attention").length;
  const load = trainingLoad7d(sessions);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Coach · iPad view"
        title="Coach"
        subtitle="Live roster of athletes whose bands are linked to your account. Aggregated and per-athlete views populate as more athletes opt in."
        action={<Pill tone={live.connected ? "live" : "neutral"} pulse={live.connected}>{live.connected ? "Live roster" : "Offline"}</Pill>}
      />

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
            <p className="mt-3 text-[11px] text-vyro-mute">
              Only athletes who have paired their band to this account appear here.
            </p>
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
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-vyro-line bg-vyro-elev p-4 text-center text-[11px] text-vyro-mute">
                No athletes match this filter.
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
                          <span className="font-mono text-[9px] uppercase tracking-wider text-vyro-mute">
                            {live.connected ? "Live · band linked" : "Band offline"}
                          </span>
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
                      <Mini label="Agility" v={r.decel || "—"} />
                    </div>
                    <div className="mt-2 text-[11px] text-vyro-mute">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-vyro-mute/80">Coach action · </span>
                      {r.action}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-vyro-mute">
              Sessions on file: <span className="text-vyro-text font-semibold">{sessions.length}</span>
            </p>
          </Card>
        </>
      )}

      {tab === "sport" && <CoachSportTab roster={ROSTER} live={live} />}

      {tab === "match" && (
        <Card eyebrow="Match DB · team view" title="Verified opponent history">
          <EmptyState
            title="No team match data yet"
            hint="Once athletes upload sport-specific sessions, the coach sees only this sport's opponent history here."
          />
        </Card>
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
          <Card eyebrow="Today's recommendations" title="Derived from your readiness + 7-day load">
            <ul className="space-y-2 text-sm text-vyro-text">
              {planItems(recovery, load).map((p, i) => (
                <li key={i} className="flex items-start gap-2 rounded-xl border border-vyro-line bg-vyro-elev p-3">
                  <Pill tone={p.tone}>{p.label}</Pill>
                  <span>{p.text}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card eyebrow="Overtraining detection" title="Today's load target">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black tabular-nums text-vyro-text">{load}</span>
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
            <p className="mt-3 text-[11px] text-vyro-mute">
              {load >= 70 ? "→ Easy session recommended today." : load >= 40 ? "→ Moderate intensity is fine." : "→ Plenty of headroom to push."}
            </p>
          </Card>
        </>
      )}

      {tab === "heatmap" && (
        <Card eyebrow="Team heatmap" title="HR · Live Rec · Sources">
          <EmptyState
            title={sessions.length === 0 ? "No sessions yet" : "Solo sample"}
            hint="Aggregated team heatmap populates as more athletes complete sessions on linked bands."
          />
          <ul className="mt-3 space-y-2 text-[12px]">
            <li className="rounded-lg border border-vyro-line bg-vyro-elev p-2.5">
              <span className="font-semibold text-vyro-text">Avg HR:</span>{" "}
              <span className="text-vyro-mute">{fmtNum(live.heartRateBpm, live.connected, 0)} bpm</span>
            </li>
            <li className="rounded-lg border border-vyro-line bg-vyro-elev p-2.5">
              <span className="font-semibold text-vyro-text">HRV baseline:</span>{" "}
              <span className="text-vyro-mute">{fmtNum(live.hrvMs, live.connected, 0)} ms</span>
            </li>
            <li className="rounded-lg border border-vyro-line bg-vyro-elev p-2.5">
              <span className="font-semibold text-vyro-text">Last sleep score:</span>{" "}
              <span className="text-vyro-mute">{lastNight?.score ?? "—"}</span>
            </li>
          </ul>
        </Card>
      )}
    </div>
  );
}

function planItems(recovery: number | null, load: number): { tone: "live" | "warn" | "off" | "neutral"; label: string; text: string }[] {
  const items: { tone: "live" | "warn" | "off" | "neutral"; label: string; text: string }[] = [];
  if (recovery == null) {
    items.push({ tone: "neutral", label: "Pending", text: "Pair the band to compute readiness." });
    return items;
  }
  if (recovery >= 75 && load < 70) items.push({ tone: "live", label: "Cleared", text: "Hard interval session cleared." });
  else if (recovery >= 50) items.push({ tone: "warn", label: "Cap", text: "Cap court time at 50 min." });
  else items.push({ tone: "off", label: "Hold", text: "Recovery focus today — skip the hard block." });

  if (load >= 70) items.push({ tone: "warn", label: "Drill", text: "Drill: deceleration to T — keep intensity low." });
  else items.push({ tone: "neutral", label: "Drill", text: "Reactive ghosting × 6 sets." });
  return items;
}

function Mini({ label, v }: { label: string; v: any }) {
  return (
    <div className="rounded-lg bg-vyro-text/[0.04] py-1">
      <div className="font-mono text-[8px] uppercase tracking-wider text-vyro-mute">{label}</div>
      <div className="text-xs font-bold tabular-nums text-vyro-text">{v}</div>
    </div>
  );
}

function CoachSportTab({ roster, live }: { roster: Roster[]; live: ReturnType<typeof useLiveMetrics> }) {
  const active = roster.filter((r) => r.status !== "unavailable");
  const [mode, setMode] = useState<"aggregated" | "individual">("individual");
  const athlete = active[0];

  return (
    <div className="space-y-4">
      <Card
        eyebrow="Sport intelligence · Coach scope"
        title="All sport modules, team-wide or per athlete."
        action={
          <div className="flex gap-1">
            <button
              onClick={() => setMode("aggregated")}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                mode === "aggregated" ? "border-vyro-mint bg-vyro-mint text-vyro-ink" : "border-vyro-line bg-vyro-panel text-vyro-mute"
              }`}
            >
              Aggregated
            </button>
            <button
              onClick={() => setMode("individual")}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                mode === "individual" ? "border-vyro-mint bg-vyro-mint text-vyro-ink" : "border-vyro-line bg-vyro-panel text-vyro-mute"
              }`}
            >
              Per athlete
            </button>
          </div>
        }
      >
        {mode === "aggregated" ? (
          <p className="text-[12px] text-vyro-mute">
            Aggregated view activates with ≥2 athletes on linked bands. You currently have {active.length}.
          </p>
        ) : (
          athlete ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Recovery" value={athlete.recovery} unit="%" />
              <Stat label="T-Ctl" value={athlete.tControl} unit="%" />
              <Stat label="Swing" value={athlete.swingConsistency} unit="%" />
              <Stat label="Agility" value={athlete.decel} unit="%" />
            </div>
          ) : (
            <EmptyState title="No athletes linked" hint="Pair a band to view sport metrics." />
          )
        )}
      </Card>

      <div className="rounded-2xl border border-vyro-line bg-vyro-panel/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-vyro-mute">Embedded · Sport selector</span>
          <Pill tone={live.connected ? "live" : "neutral"}>
            {athlete ? `Solo · ${athlete.name}` : "—"}
          </Pill>
        </div>
        <SportView />
      </div>
    </div>
  );
}
