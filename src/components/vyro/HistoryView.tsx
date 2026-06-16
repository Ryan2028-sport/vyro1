import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMySessions } from "@/lib/sessions.functions";
import { Card, EmptyState, PageHeader, Pill, Stat } from "./shared";

function fmtDur(startISO: string, endISO: string | null) {
  if (!endISO) return "—";
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

interface TrendMetric {
  id: string;
  label: string;
  current: number;
  previous: number;
  unit?: string;
  data: number[];
  insight: string;
}

const TREND_METRICS: TrendMetric[] = [
  { id: "agility", label: "Agility score", current: 84, previous: 76, data: [70, 72, 73, 75, 74, 76, 77, 79, 80, 82, 83, 84], insight: "Agility score is up 10.5% over the last 12 sessions. The biggest driver is cleaner deceleration back to the T." },
  { id: "tcontrol", label: "T-control", current: 78, previous: 56, unit: "%", data: [56, 58, 60, 63, 64, 66, 68, 70, 72, 74, 76, 78], insight: "Up 22 points over 14 days. The T is becoming home." },
  { id: "swing", label: "Swing force consistency", current: 87, previous: 80, data: [78, 79, 80, 81, 82, 83, 83, 84, 85, 86, 86, 87], insight: "Swing force consistency is up 8.6%, which points to better repeatability late in rallies." },
  { id: "sleep", label: "Sleep score", current: 87, previous: 81, data: [78, 80, 79, 82, 83, 81, 84, 85, 83, 86, 85, 87], insight: "Sleep score is trending up. Hold bedtime within 30 min of target." },
  { id: "rhr", label: "Resting HR", current: 52, previous: 58, unit: "bpm", data: [58, 58, 57, 56, 56, 55, 55, 54, 53, 53, 52, 52], insight: "RHR dropped 6 bpm — clean aerobic adaptation." },
  { id: "z5z2", label: "Z5 → Z2 recovery", current: 72, previous: 54, unit: "bpm/30s", data: [54, 56, 58, 60, 62, 63, 65, 66, 68, 70, 71, 72], insight: "Cardiac zone recovery is your biggest gain. +18 bpm in 14 days." },
  { id: "decel", label: "Decel back to T", current: 1.18, previous: 1.43, unit: "s", data: [1.43, 1.40, 1.38, 1.35, 1.33, 1.30, 1.28, 1.26, 1.24, 1.22, 1.20, 1.18], insight: "Cuts down 0.25s — direct ROI on plyometric work." },
];

export function HistoryView() {
  const fetchSessions = useServerFn(getMySessions);
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => fetchSessions(),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Player Dashboard · Progress"
        title="All-time trends"
        subtitle="All tracked VYRO metrics translated into trend graphs, progress signals, and AI coaching notes."
        action={<Pill tone="live" pulse>14 days</Pill>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TREND_METRICS.map((m) => (
          <TrendCard key={m.id} m={m} />
        ))}
      </div>

      <Card eyebrow="Session log · verified" title="Recent sessions">
        {isLoading && <div className="text-sm text-vyro-mute">Loading…</div>}
        {!isLoading && (!sessions || sessions.length === 0) && (
          <EmptyState
            title="No sessions yet"
            hint="Start and end a session from the Session tab to see it here with verified per-session metrics."
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

      <Card eyebrow="May training history" title="Calendar">
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 31 }, (_, i) => {
            const day = i + 1;
            const r = (day * 73) % 100;
            const tone = r < 25 ? "bg-vyro-mute/20" : r < 55 ? "bg-vyro-mint/40" : r < 85 ? "bg-vyro-amber/50" : "bg-vyro-rose/55";
            return (
              <div key={day} className={`grid aspect-square place-items-center rounded text-[9px] font-mono ${tone} text-vyro-text/80`}>
                {day}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Pill tone="neutral">Rest</Pill>
          <Pill tone="live">Easy</Pill>
          <Pill tone="warn">Hard</Pill>
          <Pill tone="off">Max</Pill>
        </div>
      </Card>
    </div>
  );
}

function TrendCard({ m }: { m: TrendMetric }) {
  const delta = m.current - m.previous;
  const positive = delta > 0;
  const upIsGood = !["rhr", "decel"].includes(m.id);
  const good = positive === upIsGood;
  const tone = good ? "live" : "warn";

  return (
    <Card eyebrow={m.label} title={
      <div className="flex items-baseline gap-2">
        <span className="text-2xl">{m.current}</span>
        {m.unit && <span className="text-[11px] font-semibold text-vyro-mute">{m.unit}</span>}
        <Pill tone={tone}>{positive ? "+" : ""}{Number(delta.toFixed(2))}</Pill>
      </div>
    }>
      <Spark data={m.data} good={good} />
      <p className="mt-2 text-[11px] text-vyro-mute">{m.insight}</p>
    </Card>
  );
}

function Spark({ data, good }: { data: number[]; good: boolean }) {
  const w = 220, h = 48, pad = 4;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const step = (w - pad * 2) / (data.length - 1);
  const points = data.map((v, i) => `${pad + i * step},${pad + (h - pad * 2) * (1 - (v - min) / range)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-full">
      <polyline points={points} fill="none" stroke={good ? "var(--vyro-mint)" : "var(--vyro-amber)"} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
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
