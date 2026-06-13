import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMySessions } from "@/lib/sessions.functions";
import { Card, EmptyState, PageHeader } from "./shared";

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

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Saved" title="Session history" subtitle="Every session you end is saved here." />

      {isLoading && <div className="text-sm text-vyro-text/55">Loading…</div>}

      {!isLoading && (!sessions || sessions.length === 0) && (
        <EmptyState
          title="No sessions yet"
          hint="Start and end a session from the Session tab to see it here."
        />
      )}

      <div className="space-y-3">
        {sessions?.map((s: any) => {
          const summary = (s.summary || {}) as Record<string, any>;
          return (
            <Card key={s.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-vyro-text capitalize">{s.sport}</div>
                  <div className="font-mono text-[11px] text-vyro-text/55">
                    {new Date(s.started_at).toLocaleString()} · {fmtDur(s.started_at, s.ended_at)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-vyro-text/45">Events</div>
                  <div className="text-lg font-black tabular-nums text-vyro-text">
                    {(s.swing_count ?? 0) + (s.rapid_count ?? 0) + (s.burst_count ?? 0) + (s.dir_change_count ?? 0)}
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <Mini label="Swings" v={s.swing_count} />
                <Mini label="Rapid" v={s.rapid_count} />
                <Mini label="Bursts" v={s.burst_count} />
                <Mini label="Dir Δ" v={s.dir_change_count} />
              </div>
              {Object.keys(summary).length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {summary.peakG != null && <Mini label="Peak g" v={Number(summary.peakG).toFixed(2)} />}
                  {summary.peakDps != null && <Mini label="Peak dps" v={Math.round(summary.peakDps)} />}
                  {summary.peakJerk != null && <Mini label="Peak jerk" v={Number(summary.peakJerk).toFixed(1)} />}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Mini({ label, v }: { label: string; v: any }) {
  return (
    <div className="rounded-lg bg-vyro-text/[0.04] py-1.5">
      <div className="font-mono text-[9px] uppercase tracking-wider text-vyro-text/45">{label}</div>
      <div className="text-sm font-bold tabular-nums text-vyro-text">{v ?? "—"}</div>
    </div>
  );
}
