import type { ReactNode } from "react";
import { Activity, CalendarDays, LineChart, Moon, Sparkles, Trophy, Zap } from "lucide-react";

const trendCards = [
  { label: "Agility score", previous: "76/100", value: "84", unit: "/100", delta: "+10.5%", progress: 84, data: [18, 28, 24, 42, 54, 50, 64, 72, 78, 76, 86, 91] },
  { label: "Resting HR", previous: "53bpm", value: "48", unit: "bpm", delta: "-9.4%", progress: 52, data: [82, 82, 72, 62, 70, 52, 52, 44, 44, 34, 24, 24] },
  { label: "T-control", previous: "68%", value: "82", unit: "%", delta: "+20.6%", progress: 82, data: [20, 26, 32, 29, 40, 47, 56, 65, 74, 78, 85, 88] },
  { label: "Swing force consistency", previous: "81%", value: "88", unit: "%", delta: "+8.6%", progress: 88, data: [28, 34, 45, 39, 52, 58, 70, 76, 84, 84, 90, 96] },
  { label: "Sleep score", previous: "80/100", value: "87", unit: "/100", delta: "+8.8%", progress: 87, data: [20, 48, 60, 32, 66, 82, 74, 90, 78, 86, 96, 88] },
];

const calendarDays = [
  { day: 1, score: 64, tone: "bad" },
  { day: 2, score: 68, tone: "warn" },
  { day: 3, score: 71, tone: "warn" },
  { day: 4, score: 69, tone: "warn" },
  { day: 5, score: 73, tone: "warn" },
  { day: 6, score: 76, tone: "good" },
  { day: 7, score: 78, tone: "good", active: true },
  { day: 8, score: 74, tone: "warn" },
  { day: 9, score: 82, tone: "good" },
  { day: 10, score: 67, tone: "warn" },
  { day: 11, score: 58, tone: "bad" },
  { day: 12, score: 72, tone: "warn" },
];

export function TrendsView() {
  return (
    <div className="mx-auto max-w-[430px] space-y-7 pb-8 text-vyro-text">
      <header className="space-y-3">
        <p className="font-mono text-[13px] uppercase tracking-[0.34em] text-vyro-mute">Player dashboard · Progress</p>
        <h2 className="text-[28px] font-black leading-tight text-vyro-text">Ryan's trend intelligence</h2>
        <p className="text-[15px] leading-relaxed text-vyro-mute">
          All tracked VYRO metrics translated into trend graphs, progress signals, and AI coaching notes.
        </p>
        <Badge icon={<Sparkles className="h-4 w-4" />}>AI insights</Badge>
      </header>

      <TrajectoryCard />
      <FeaturedGraph />
      <AiReadout />
      <RecoveryTrend />
      <CalendarView />
      <MetricTrendStack />
    </div>
  );
}

function TrajectoryCard() {
  return (
    <VCard className="border-vyro-text/42">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <p className="font-mono text-[13px] uppercase tracking-[0.34em] text-vyro-mute">Performance trajectory</p>
        <span className="rounded-xl border border-vyro-text/32 bg-vyro-text/8 px-4 py-2 font-mono text-[14px] uppercase tracking-[0.16em] text-vyro-text">Last 30 days</span>
      </div>
      <h3 className="mt-5 text-[27px] font-black leading-tight text-vyro-text">Improving across 4 of 5 core metrics.</h3>
      <div className="mt-7 space-y-4">
        <TrajectoryMetric label="Agility" value="+10.5%" hint="Higher is better" />
        <TrajectoryMetric label="Resting HR" value="-5 bpm" hint="Lower is better" />
        <TrajectoryMetric label="T-control" value="+20.6%" hint="Higher is better" />
      </div>
    </VCard>
  );
}

function FeaturedGraph() {
  return (
    <VCard className="bg-vyro-elev/75">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div>
          <p className="font-mono text-[13px] uppercase tracking-[0.34em] text-vyro-mute">Featured graph</p>
          <h3 className="mt-4 text-[24px] font-black leading-none text-vyro-text">Agility score</h3>
        </div>
        <span className="rounded-lg border border-vyro-text/32 bg-vyro-text/8 px-3 py-2 font-mono text-[14px] text-vyro-text">84/100</span>
      </div>
      <BigGraph />
      <InsightBox>Agility score is up 10.5% over the last 12 sessions. The biggest driver is cleaner deceleration back to the T.</InsightBox>
    </VCard>
  );
}

function AiReadout() {
  return (
    <VCard className="bg-vyro-elev/75">
      <p className="font-mono text-[13px] uppercase tracking-[0.34em] text-vyro-mute">AI readout</p>
      <div className="mt-5 space-y-4">
        <InsightBox>Resting heart rate has dropped 5 bpm versus the prior month, suggesting improved aerobic fitness and recovery capacity.</InsightBox>
        <InsightBox>T-control is up 20.6%. You are winning more middle-court positioning after deep back-right retrievals.</InsightBox>
        <InsightBox>Swing force consistency is up 8.6%, which points to better repeatability late in rallies.</InsightBox>
      </div>
    </VCard>
  );
}

function RecoveryTrend() {
  return (
    <VCard className="border-vyro-text/42">
      <p className="font-mono text-[13px] uppercase tracking-[0.34em] text-vyro-mute">7-day recovery</p>
      <p className="mt-6 text-[40px] font-black leading-none text-vyro-text">+12%</p>
      <p className="mt-4 font-mono text-[15px] tracking-[0.12em] text-vyro-mute">vs prior week · moved from Athlete</p>
      <RecoverySpark />
      <InsightBox>Trend is up. Hold sleep above 8h and you'll peak Sunday for the league match.</InsightBox>
    </VCard>
  );
}

function CalendarView() {
  return (
    <VCard className="bg-vyro-elev/75">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div>
          <p className="flex items-center gap-2 font-mono text-[13px] uppercase tracking-[0.28em] text-vyro-mute">
            <CalendarDays className="h-4 w-4" /> Calendar view
          </p>
          <h3 className="mt-4 text-[24px] font-black leading-tight text-vyro-text">May training history</h3>
          <p className="mt-3 text-[15px] leading-relaxed text-vyro-mute">Tap any date to replay the exact VYRO day: recovery, sleep, strain, agility, T-control, and session note.</p>
        </div>
        <span className="rounded-xl border border-vyro-text/32 bg-vyro-text/8 px-4 py-2 font-mono text-[14px] uppercase tracking-[0.12em] text-vyro-text">May<br />7</span>
      </div>
      <div className="mt-8 grid grid-cols-7 gap-2 text-center font-mono text-[12px] text-vyro-mute">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={`${d}-${i}`}>{d}</span>)}
      </div>
      <div className="mt-5 grid grid-cols-7 gap-2">
        {calendarDays.map((day) => <CalendarDay key={day.day} {...day} />)}
      </div>
      <div className="mt-6 space-y-4">
        <CalendarMetric icon={<Activity className="h-5 w-5" />} label="Recovery" value="78%" />
        <CalendarMetric icon={<Moon className="h-5 w-5" />} label="Sleep" value="87" />
        <CalendarMetric icon={<Zap className="h-5 w-5" />} label="Strain" value="16.4" />
        <div className="rounded-[18px] border border-vyro-line bg-vyro-panel/70 p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              <p className="text-[18px] font-black text-vyro-text">League prep</p>
              <p className="mt-2 text-[14px] leading-relaxed text-vyro-mute">Peak week signal. Keep evening work light.</p>
            </div>
            <span className="rounded-xl border border-vyro-text/32 bg-vyro-text/8 px-4 py-2 font-mono text-[14px] uppercase tracking-[0.1em] text-vyro-text">T-control<br />79%</span>
          </div>
        </div>
      </div>
    </VCard>
  );
}

function MetricTrendStack() {
  return (
    <div className="space-y-5">
      {trendCards.map((card) => <MetricTrendCard key={card.label} {...card} />)}
    </div>
  );
}

function MetricTrendCard({ label, previous, value, unit, delta, progress, data }: typeof trendCards[number]) {
  return (
    <VCard className="bg-vyro-elev/75">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[18px] font-black text-vyro-text">{label}</h3>
          <p className="mt-1 font-mono text-[14px] text-vyro-mute">Previous {previous}</p>
        </div>
        <span className="rounded-lg border border-vyro-text/32 bg-vyro-text/8 px-3 py-1.5 font-mono text-[14px] text-vyro-text">↗ {delta}</span>
      </div>
      <div className="mt-7 grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)] items-end gap-4">
        <div className="min-w-0">
          <span className="text-[40px] font-black leading-none text-vyro-text">{value}</span>
          <span className="ml-2 text-[18px] font-black text-vyro-mute">{unit}</span>
        </div>
        <SmallSpark data={data} />
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-vyro-text/8">
        <span className="block h-full rounded-full bg-vyro-text" style={{ width: `${progress}%` }} />
      </div>
    </VCard>
  );
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

function BigGraph() {
  const data = [12, 24, 18, 35, 48, 54, 70, 76, 88, 82, 96, 108];
  return <GraphSvg data={data} height={170} className="mt-7 rounded-[18px] border border-vyro-line bg-vyro-panel/70" />;
}

function RecoverySpark() {
  return <GraphSvg data={[20, 34, 44, 38, 52, 62, 68]} height={130} className="mt-6" stroke="var(--vyro-mint)" fill="var(--vyro-mint)" />;
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
  const step = (width - pad * 2) / (data.length - 1);
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
  const dot = tone === "good" ? "bg-vyro-mint" : tone === "bad" ? "bg-vyro-rose" : "bg-vyro-amber";
  return (
    <button className={`relative min-h-[48px] rounded-xl border bg-vyro-panel/70 p-2 text-left ${active ? "border-vyro-text" : "border-vyro-line"}`}>
      <span className={`absolute right-3 top-3 h-2.5 w-2.5 rounded-full ${dot}`} />
      <span className="block text-[15px] font-black text-vyro-text">{day}</span>
      <span className="mt-2 block text-[22px] font-black leading-none text-vyro-text">{score}</span>
    </button>
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