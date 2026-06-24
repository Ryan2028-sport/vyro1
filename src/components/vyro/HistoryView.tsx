import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMySessions } from "@/lib/sessions.functions";
import { Card, EmptyState, PageHeader, Pill } from "./shared";

// =============================================================================
// History view — strict real-data mode. Trends only render once we have
// at least two saved sessions; otherwise every card shows an empty state.
// No invented sparklines, no random-colored calendar.
// =============================================================================

function fmtDur(startISO: string, endISO: string | null) {
  if (!endISO) return "—";
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function HistoryView() {
  const fetchSessions = useServerFn(getMySessions);
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => fetchSessions(),
  });

  const count = sessions?.length ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Player Dashboard · Progress"
        title="Session history"
        subtitle="Every metric here comes from real sessions you've saved. Cards stay blank until the data exists."
        action={<Pill tone={count > 0 ? "live" : "off"}>{count} session{count === 1 ? "" : "s"}</Pill>}
      />

      <Card eyebrow="Session log · verified" title="Recent sessions">
        {isLoading && <div className="text-sm text-vyro-mute">Loading…</div>}
        {!isLoading && count === 0 && (
          <EmptyState
            title="No sessions yet"
            hint="Start and end a session from the Session tab to record your first verified entry."
          />
        )}
        <div className="space-y-3">
          {sessions?.map((s: any) => {
            const summary = (s.summary || {}) as Record<string, any>;
            return (
              <div key={s.id} className="rounded-xl border border-vyro-line bg-vyro-elev p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold capitalize text-vyro-text">{s.sport}</div>
                    <div className="font-mono text-[11px] text-vyro-mute">
                      {new Date(s.started_at).toLocaleString()} · {fmtDur(s.started_at, s.ended_at)}
                    </div>
                  </div>
                  <Pill tone="live">Verified</Pill>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  <Mini label="Swings" v={s.swing_count} />
                  <Mini label="Rapid" v={s.rapid_count} />
                  <Mini label="Bursts" v={s.burst_count} />
                  <Mini label="Dir Δ" v={s.dir_change_count} />
                </div>
                {Object.keys(summary).length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    {summary.peakG != null && <Mini label="Peak g" v={Number(summary.peakG).toFixed(2)} />}
                    {summary.peakDps != null && <Mini label="Peak dps" v={Math.round(summary.peakDps)} />}
                    {summary.peakJerk != null && <Mini label="Peak jerk" v={Number(summary.peakJerk).toFixed(1)} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card eyebrow="Trends" title="All-time progress">
        <EmptyState
          title={count < 2 ? "Need at least two sessions" : "Trends live in the Trends tab"}
          hint={count < 2
            ? "Record a second session and trend graphs will compute themselves from the saved summaries — no synthetic data."
            : "Open the Trends tab for the full progression view derived directly from these sessions."}
        />
      </Card>
    </div>
  );
}

function Mini({ label, v }: { label: string; v: any }) {
  return (
    <div className="rounded-lg bg-vyro-text/[0.04] py-1.5">
      <div className="font-mono text-[9px] uppercase tracking-wider text-vyro-mute">{label}</div>
      <div className="text-sm font-bold tabular-nums text-vyro-text">{v ?? "—"}</div>
    </div>
  );
}
