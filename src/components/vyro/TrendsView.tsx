// Trend intelligence — all numbers are derived from real Supabase `sessions`
// rows plus the rolling baselines persisted by AthleteView/RecoveryView and
// the local sleep-nights store. When there are no sessions yet, every card
// renders an empty state instead of showing demo numbers.

import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, CalendarDays, Moon, Sparkles, Zap } from "lucide-react";
import { getMySessions } from "@/lib/sessions.functions";
import {
  buildTrendCards,
  trainingLoad7d,
  agilityScore,
  durationMin,
  type RawSession,
  type TrendCard,
} from "@/lib/sessions-derived";
import { useSleepNights } from "@/lib/use-sleep-nights";

type Baselines = {
  hrvMs?: number | null;
  restingHrBpm?: number | null;
  reactMs?: number | null;
};

function readBaselines(): Baselines | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("vyro.baselines.v1");
    return raw ? (JSON.parse(raw) as Baselines) : null;
  } catch {
    return null;
  }
}

export function TrendsView() {
  const fetchSessions = useServerFn(getMySessions);
  const { data, isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => fetchSessions(),
  });

  const sessions = (data ?? []) as RawSession[];
  const baselines = readBaselines();
  const { scores: sleepScores, last: lastNight, nights } = useSleepNights();

  const cards = useMemo(
    () => buildTrendCards(sessions, baselines, sleepScores),
    [sessions, baselines, sleepScores],
  );

  const featured = cards[0];
  const hasData = sessions.length > 0;

  return (
    <div className="mx-auto max-w-[430px] space-y-7 pb-8 text-vyro-text">
      <header className="space-y-3">
        <p className="font-mono text-[13px] uppercase tracking-[0.34em] text-vyro-mute">Player dashboard · Progress</p>
        <h2 className="text-[28px] font-black leading-tight text-vyro-text">Trend intelligence</h2>
        <p className="text-[15px] leading-relaxed text-vyro-mute">
          {hasData
            ? `Computed from ${sessions.length} recorded session${sessions.length === 1 ? "" : "s"} and your live baselines.`
            : "Trends populate once you save your first tracked session."}
        </p>
        <Badge icon={<Sparkles className="h-4 w-4" />}>{hasData ? "Live" : "Awaiting data"}</Badge>
      </header>

      {isLoading ? (
        <VCard><p className="py-12 text-center text-[14px] text-vyro-mute">Loading session history…</p></VCard>
      ) : !hasData ? (
        <VCard>
          <p className="font-mono text-[13px] uppercase tracking-[0.34em] text-vyro-mute">No data yet</p>
          <h3 className="mt-4 text-[22px] font-black leading-tight">Run a tracked session.</h3>
          <p className="mt-3 text-[14px] leading-relaxed text-vyro-mute">
            Open the Session tab, pick a sport, hit Begin tracking, and end the session when you're done. Trends and AI readouts compute themselves from the saved summary.
          </p>
        </VCard>
      ) : (
        <>
          <TrajectoryCard cards={cards} />
          <FeaturedGraph card={featured} />
          <AiReadout cards={cards} sessions={sessions} />
          <RecoveryTrend baselines={baselines} sessions={sessions} />
          <CalendarView sessions={sessions} lastNight={lastNight?.score ?? null} loadToday={trainingLoad7d(sessions)} />
          <MetricTrendStack cards={cards} />
        </>
      )}

      {nights.length === 0 && hasData && (
        <VCard className="border-dashed">
          <p className="text-[13px] text-vyro-mute">
            Sleep score is empty — no synced nights yet. As soon as the band syncs a sleep frame the Sleep card and the sleep trendline both populate.
          </p>
        </VCard>
      )}
    </div>
  );
}

function TrajectoryCard({ cards }: { cards: TrendCard[] }) {
  const improving = cards.filter((c) => c.deltaPct != null && (c.higherIsBetter ? c.deltaPct > 0 : c.deltaPct < 0));
  return (
    <VCard className="border-vyro-text/42">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <p className="font-mono text-[13px] uppercase tracking-[0.34em] text-vyro-mute">Performance trajectory</p>
        <span className="rounded-xl border border-vyro-text/32 bg-vyro-text/8 px-4 py-2 font-mono text-[14px] uppercase tracking-[0.16em] text-vyro-text">Last 14 days</span>
      </div>
      <h3 className="mt-5 text-[27px] font-black leading-tight text-vyro-text">
        {improving.length > 0
          ? `Improving on ${improving.length} of ${cards.filter((c) => c.deltaPct != null).length} metrics.`
          : "Not enough recent history to score a trend."}
      </h3>
      <div className="mt-7 space-y-4">
        {cards.slice(0, 3).map((c) => (
          <TrajectoryMetric
            key={c.label}
            label={c.label}
            value={fmtDelta(c, true)}
            hint={c.higherIsBetter ? "Higher is better" : "Lower is better"}
          />
        ))}
      </div>
    </VCard>
  );
}

function FeaturedGraph({ card }: { card: TrendCard }) {
  return (
    <VCard className="bg-vyro-elev/75">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div>
          <p className="font-mono text-[13px] uppercase tracking-[0.34em] text-vyro-mute">Featured graph</p>
          <h3 className="mt-4 text-[24px] font-black leading-none text-vyro-text">{card.label}</h3>
        </div>
        <span className="rounded-lg border border-vyro-text/32 bg-vyro-text/8 px-3 py-2 font-mono text-[14px] text-vyro-text">
          {card.current ?? "—"}{card.unit}
        </span>
      </div>
      {card.spark.length >= 2 ? (
        <GraphSvg data={card.spark} height={170} className="mt-7 rounded-[18px] border border-vyro-line bg-vyro-panel/70" />
      ) : (
        <div className="mt-7 flex h-[170px] items-center justify-center rounded-[18px] border border-dashed border-vyro-line text-[13px] text-vyro-mute">
          Need a few more sessions to chart this.
        </div>
      )}
      <InsightBox>
        {card.deltaPct == null
          ? "Trend will appear once you have at least two scoreable windows."
          : `${card.label} ${card.deltaPct >= 0 ? "is up" : "is down"} ${Math.abs(card.deltaPct).toFixed(1)}% over the comparison window.`}
      </InsightBox>
    </VCard>
  );
}

function AiReadout({ cards, sessions }: { cards: TrendCard[]; sessions: RawSession[] }) {
  const insights: string[] = [];
  for (const c of cards) {
    if (c.deltaPct == null) continue;
    const dirGood = c.higherIsBetter ? c.deltaPct > 3 : c.deltaPct < -3;
    if (dirGood) insights.push(`${c.label} ${c.deltaPct >= 0 ? "improved" : "improved (lower)"} ${Math.abs(c.deltaPct).toFixed(1)}%.`);
  }
  if (!insights.length) {
    insights.push(`Latest session: ${sessions[0]?.sport ?? "—"} for ${Math.round(durationMin(sessions[0] ?? ({} as RawSession)))} min.`);
  }
  return (
    <VCard className="bg-vyro-elev/75">
      <p className="font-mono text-[13px] uppercase tracking-[0.34em] text-vyro-mute">AI readout</p>
      <div className="mt-5 space-y-4">
        {insights.slice(0, 4).map((line, i) => <InsightBox key={i}>{line}</InsightBox>)}
      </div>
    </VCard>
  );
}

function RecoveryTrend({ baselines, sessions }: { baselines: Baselines | null; sessions: RawSession[] }) {
  const load = trainingLoad7d(sessions);
  const recoveryHint = load >= 70 ? "High 7-day load — protect sleep tonight." : load >= 40 ? "Moderate load — typical session OK." : "Low load — fine to push tomorrow.";
  return (
    <VCard className="border-vyro-text/42">
      <p className="font-mono text-[13px] uppercase tracking-[0.34em] text-vyro-mute">7-day training load</p>
      <p className="mt-6 text-[40px] font-black leading-none text-vyro-text">{load}<span className="text-[20px] text-vyro-mute">/100</span></p>
      <p className="mt-4 font-mono text-[15px] tracking-[0.12em] text-vyro-mute">
        {baselines?.hrvMs ? `HRV baseline ${Math.round(baselines.hrvMs)}ms` : "Tracking baselines…"}
      </p>
      <InsightBox>{recoveryHint}</InsightBox>
    </VCard>
  );
}

function CalendarView({ sessions, lastNight, loadToday }: { sessions: RawSession[]; lastNight: number | null; loadToday: number }) {
  const days = useMemo(() => {
    const ref = Date.now();
    return Array.from({ length: 12 }).map((_, i) => {
      const dayStart = new Date(ref - (11 - i) * 86_400_000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = dayStart.getTime() + 86_400_000;
      const inDay = sessions.filter((s) => {
        const t = new Date(s.started_at).getTime();
        return t >= dayStart.getTime() && t < dayEnd;
      });
      const avgAgility = inDay.length
        ? Math.round(inDay.map(agilityScore).filter((v): v is number => v != null).reduce((a, b) => a + b, 0) / Math.max(1, inDay.length))
        : 0;
      const tone = avgAgility >= 75 ? "good" : avgAgility >= 60 ? "warn" : avgAgility > 0 ? "bad" : "off";
      return { day: dayStart.getDate(), score: avgAgility, tone, active: i === 11 };
    });
  }, [sessions]);

  return (
    <VCard className="bg-vyro-elev/75">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div>
          <p className="flex items-center gap-2 font-mono text-[13px] uppercase tracking-[0.28em] text-vyro-mute">
            <CalendarDays className="h-4 w-4" /> Calendar view
          </p>
          <h3 className="mt-4 text-[24px] font-black leading-tight text-vyro-text">Recent training history</h3>
          <p className="mt-3 text-[15px] leading-relaxed text-vyro-mute">
            Daily agility score from your saved sessions. Empty cells = no session that day.
          </p>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-7 gap-2 text-center font-mono text-[12px] text-vyro-mute">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={`${d}-${i}`}>{d}</span>)}
      </div>
      <div className="mt-5 grid grid-cols-7 gap-2">
        {days.map((day, i) => <CalendarDay key={i} {...day} />)}
      </div>
      <div className="mt-6 space-y-4">
        <CalendarMetric icon={<Activity className="h-5 w-5" />} label="7d load" value={`${loadToday}/100`} />
        <CalendarMetric icon={<Moon className="h-5 w-5" />} label="Sleep" value={lastNight != null ? String(lastNight) : "—"} />
        <CalendarMetric icon={<Zap className="h-5 w-5" />} label="Sessions" value={String(sessions.length)} />
      </div>
    </VCard>
  );
}

function MetricTrendStack({ cards }: { cards: TrendCard[] }) {
  return (
    <div className="space-y-5">
      {cards.map((card) => <MetricTrendCard key={card.label} card={card} />)}
    </div>
  );
}

function MetricTrendCard({ card }: { card: TrendCard }) {
  return (
    <VCard className="bg-vyro-elev/75">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[18px] font-black text-vyro-text">{card.label}</h3>
          <p className="mt-1 font-mono text-[14px] text-vyro-mute">
            {card.previous != null ? `Previous ${card.previous}${card.unit}` : "No prior window"}
          </p>
        </div>
        <span className="rounded-lg border border-vyro-text/32 bg-vyro-text/8 px-3 py-1.5 font-mono text-[14px] text-vyro-text">
          {fmtDelta(card, false)}
        </span>
      </div>
      <div className="mt-7 grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)] items-end gap-4">
        <div className="min-w-0">
          <span className="text-[40px] font-black leading-none text-vyro-text">
            {card.current ?? "—"}
          </span>
          <span className="ml-2 text-[18px] font-black text-vyro-mute">{card.unit}</span>
        </div>
        {card.spark.length >= 2 ? <SmallSpark data={card.spark} /> : <div className="h-[72px]" />}
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-vyro-text/8">
        <span className="block h-full rounded-full bg-vyro-text" style={{ width: `${Math.max(0, Math.min(100, card.progress))}%` }} />
      </div>
    </VCard>
  );
}

function fmtDelta(card: TrendCard, withArrow: boolean): string {
  if (card.deltaPct == null) return "—";
  const arrow = card.deltaPct >= 0 ? "↗" : "↘";
  const num = `${card.deltaPct >= 0 ? "+" : ""}${card.deltaPct.toFixed(1)}%`;
  return withArrow ? `${arrow} ${num}` : num;
}

function VCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[26px] border border-vyro-line bg-vyro-panel p-4 shadow-[inset_0_1px_0_color-mix(in_oklab,var(--vyro-text)_8%,transparent)] ${className}`}>{children}</section>;
}

function Badge({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <span className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-vyro-text/35 bg-vyro-text/5 px-3 font-mono text-[13px] uppercase tracking-[0.16em] text-vyro-text">{icon}{children}</span>;
}

function TrajectoryMetric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[20px] border border-vyro-line bg-vyro-panel/70 p-4">
      <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-vyro-mute">{label}</p>
      <p className="mt-3 text-[38px] font-black leading-none text-vyro-text">{value}</p>
      <p className="mt-3 text-[14px] text-vyro-mute">{hint}</p>
    </div>
  );
}

function InsightBox({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 rounded-[16px] border border-vyro-text/30 bg-vyro-text/12 p-4 text-[16px] leading-relaxed text-vyro-text/90">
      <Sparkles className="mt-1 h-5 w-5 shrink-0 text-vyro-text" />
      <span>{children}</span>
    </div>
  );
}

function SmallSpark({ data }: { data: number[] }) {
  return <GraphSvg data={data} height={72} compact />;
}

function GraphSvg({ data, height, className = "", stroke = "var(--vyro-text)", fill = "var(--vyro-text)", compact = false }: { data: number[]; height: number; className?: string; stroke?: string; fill?: string; compact?: boolean }) {
  const width = 300;
  const pad = compact ? 6 : 10;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = (width - pad * 2) / Math.max(1, data.length - 1);
  const coords = data.map((value, index) => [pad + index * step, pad + (height - pad * 2) * (1 - (value - min) / range)] as const);
  const path = coords.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${path} L${width - pad},${height - pad} L${pad},${height - pad} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`block w-full ${className}`} aria-hidden="true">
      {!compact && Array.from({ length: 7 }).map((_, i) => <line key={`v-${i}`} x1={(width / 6) * i} x2={(width / 6) * i} y1="0" y2={height} stroke="var(--vyro-line)" />)}
      {!compact && Array.from({ length: 5 }).map((_, i) => <line key={`h-${i}`} x1="0" x2={width} y1={(height / 4) * i} y2={(height / 4) * i} stroke="var(--vyro-line)" />)}
      <path d={area} fill={fill} opacity="0.16" />
      <path d={path} fill="none" stroke={stroke} strokeLinecap="round" strokeLinejoin="round" strokeWidth={compact ? 3 : 2.4} />
      {!compact && coords.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.4" fill={stroke} />)}
    </svg>
  );
}

function CalendarDay({ day, score, tone, active }: { day: number; score: number; tone: string; active?: boolean }) {
  const dot = tone === "good" ? "bg-vyro-mint" : tone === "bad" ? "bg-vyro-rose" : tone === "warn" ? "bg-vyro-amber" : "bg-vyro-line";
  return (
    <div className={`relative min-h-[48px] rounded-xl border bg-vyro-panel/70 p-2 text-left ${active ? "border-vyro-text" : "border-vyro-line"}`}>
      <span className={`absolute right-3 top-3 h-2.5 w-2.5 rounded-full ${dot}`} />
      <span className="block text-[15px] font-black text-vyro-text">{day}</span>
      <span className="mt-2 block text-[22px] font-black leading-none text-vyro-text">{score || "—"}</span>
    </div>
  );
}

function CalendarMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-vyro-line bg-vyro-panel/70 p-4">
      <p className="flex items-center gap-2 font-mono text-[13px] uppercase tracking-[0.22em] text-vyro-mute">{icon}{label}</p>
      <p className="mt-4 text-[28px] font-black leading-none text-vyro-text">{value}</p>
    </div>
  );
}
