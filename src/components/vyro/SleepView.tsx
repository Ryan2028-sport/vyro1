import { useState, type ReactNode } from "react";
import { AlarmClock, Bed, Brain, CircleHelp, Moon, Sunrise, Waves, Zap } from "lucide-react";
import { useSleepNights, fmtSleepDuration } from "@/lib/use-sleep-nights";

type Tab = "overall" | "zones" | "wakeups" | "performance";

// Demo placeholder — overridden by real values when a night is synced.
const DEMO_NIGHT = {
  score: 87,
  asleepLabel: "6h 46m",
  inBedLabel: "7h 04m",
  bedtime: "11:14 PM",
  wake: "6:18 AM",
  wakeups: 4,
  debtLabel: "1h 24m",
  targetLabel: "8h 10m",
  recBedtime: "10:25 PM",
  recWake: "6:15 AM",
};

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function useNightView() {
  const { last } = useSleepNights();
  if (!last) return { hasData: false as const, night: DEMO_NIGHT };
  const bedtimeISO = new Date(new Date(last.endAt).getTime() - last.inBedMin * 60_000).toISOString();
  return {
    hasData: true as const,
    night: {
      score: last.score,
      asleepLabel: fmtSleepDuration(last.asleepMin),
      inBedLabel: fmtSleepDuration(last.inBedMin),
      bedtime: fmtTime(bedtimeISO),
      wake: fmtTime(last.endAt),
      wakeups: last.wakeups,
      debtLabel: last.debtMin != null ? fmtSleepDuration(Math.max(0, last.debtMin)) : "—",
      targetLabel: "8h 10m",
      recBedtime: DEMO_NIGHT.recBedtime,
      recWake: DEMO_NIGHT.recWake,
    },
  };
}

const primaryTabs: { id: Tab; label: string }[] = [
  { id: "overall", label: "Overall Sleep" },
  { id: "zones", label: "Sleep Zones" },
  { id: "wakeups", label: "Wakeups" },
];

export function SleepView() {
  const [tab, setTab] = useState<Tab>("overall");

  return (
    <div className="mx-auto max-w-[430px] space-y-7 pb-8 text-vyro-text">
      <header className="space-y-3">
        <p className="font-mono text-[13px] uppercase tracking-[0.34em] text-vyro-mute">Sleep · Recovery Input</p>
        <div className="space-y-2">
          <h2 className="text-[28px] font-black leading-none text-vyro-text">Sleep architecture</h2>
          <p className="max-w-[390px] text-[14px] leading-relaxed text-vyro-mute">
            WHOOP-style sleep breakdown for duration, zones, wakeups, and next-session readiness.
          </p>
        </div>
        <span className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-vyro-text/35 bg-vyro-text/5 px-3 font-mono text-[12px] uppercase tracking-[0.16em] text-vyro-text">
          <Moon className="h-4 w-4" />
          Last night
        </span>
      </header>

      <div>
        <div className="grid grid-cols-3 gap-3">
          {primaryTabs.map((item) => (
            <SleepTabButton key={item.id} active={tab === item.id} onClick={() => setTab(item.id)}>
              {item.label}
            </SleepTabButton>
          ))}
        </div>
        <div className="mt-7 border-b border-vyro-line">
          <button
            type="button"
            onClick={() => setTab("performance")}
            className={`relative pb-5 text-left text-[16px] font-black transition-colors ${
              tab === "performance" ? "text-vyro-text" : "text-vyro-mute hover:text-vyro-text"
            }`}
          >
            Performance
            {tab === "performance" && <span className="absolute inset-x-0 -bottom-px h-[3px] bg-vyro-text" />}
          </button>
        </div>
      </div>

      {tab === "overall" && <OverallSleep />}
      {tab === "zones" && <SleepZones />}
      {tab === "wakeups" && <Wakeups />}
      {tab === "performance" && <SleepPerformance />}
    </div>
  );
}

function SleepTabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative min-h-12 pb-4 text-left text-[15px] font-black transition-colors ${
        active ? "text-vyro-text" : "text-vyro-mute hover:text-vyro-text"
      }`}
    >
      <span className="block truncate">{children}</span>
      {active && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-vyro-text" />}
    </button>
  );
}

function OverallSleep() {
  return (
    <div className="space-y-7">
      <VCard className="border-vyro-text/42">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <p className="font-mono text-[13px] uppercase tracking-[0.34em] text-vyro-mute">Sleep score</p>
          <MiniBadge>Sleep synced</MiniBadge>
        </div>
        <h3 className="mt-5 text-[24px] font-black leading-tight text-vyro-text">Recovered, not topped off.</h3>
        <div className="mt-6 rounded-[20px] border border-vyro-text/25 bg-vyro-ink/35 p-5 text-center">
          <SleepRing value={night.score} />
        </div>
        <div className="mt-5 space-y-4">
          <MetricPanel icon={<Moon className="h-5 w-5" />} label="Asleep" value={night.asleepLabel} hint={`${night.bedtime} → ${night.wake}`} />
          <MetricPanel icon={<AlarmClock className="h-5 w-5" />} label="Wakeups" value={night.wakeups} hint={`${night.inBedLabel} in bed`} />
          <MetricPanel icon={<Zap className="h-5 w-5" />} label="Sleep debt" value={night.debtLabel} hint={`Target ${night.targetLabel}`} />
        </div>
      </VCard>

      <SleepDebtCard />
      <SleepCoachCard />
      <RecoveryInterpretation />
    </div>
  );
}

function SleepDebtCard() {
  return (
    <VCard className="bg-vyro-elev/80">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate font-mono text-[13px] uppercase tracking-[0.34em] text-vyro-mute">Sleep debt</p>
          <CircleHelp className="h-4 w-4 shrink-0 text-vyro-mute" />
        </div>
        <MiniBadge>1h 24m owed</MiniBadge>
      </div>
      <div className="mt-9 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-[54px] font-black leading-none tracking-normal text-vyro-text">1h 24m</span>
        <span className="font-mono text-[15px] tracking-[0.12em] text-vyro-mute">under a dynamic target of 8h 10m</span>
      </div>
      <p className="mt-6 text-[14px] text-vyro-mute">7-night debt trend</p>
      <DebtTrendSpark />
      <p className="mt-4 flex items-start gap-2 font-mono text-[13px] uppercase tracking-[0.12em] text-vyro-mint">
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-vyro-mint" />
        Trending down — debt fell from 2h 00m to 1h 24m
      </p>
    </VCard>
  );
}

function SleepCoachCard() {
  return (
    <VCard className="bg-vyro-elev/80">
      <div className="flex min-w-0 items-center gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-vyro-spatial/45 bg-vyro-spatial/15 text-vyro-spatial">
          <Bed className="h-6 w-6" />
        </span>
        <p className="min-w-0 font-mono text-[13px] uppercase tracking-[0.3em] text-vyro-mute">Sleep coach · tonight's plan</p>
      </div>
      <div className="mt-6 space-y-4">
        <CoachPlan label="Recommended bedtime" value={night.recBedtime} hint="~50m earlier to clear debt" icon={<Moon className="h-4 w-4" />} />
        <CoachPlan label="Recommended wake" value={night.recWake} hint="Keeps your schedule consistent" icon={<Sunrise className="h-4 w-4" />} />
        <CoachPlan label="Tonight's target" value={night.targetLabel} hint="Adjusted for today's training load" icon={<Bed className="h-4 w-4" />} />
      </div>
    </VCard>
  );
}

function RecoveryInterpretation() {
  return (
    <VCard className="bg-vyro-elev/80">
      <p className="font-mono text-[13px] uppercase tracking-[0.32em] text-vyro-mute">VYRO recovery interpretation</p>
      <div className="mt-5 space-y-4">
        <Insight tone="good">Deep sleep carried early-night muscle repair, but total sleep need is still under target by 1h 24m.</Insight>
        <Insight tone="good">REM was strong late-night, supporting reaction timing and shot selection for same-day training.</Insight>
        <Insight tone="warn">Four wake events are acceptable, but the 2:27 AM HR spike is a recovery-quality flag after high Z5 rallies.</Insight>
      </div>
    </VCard>
  );
}

function SleepZones() {
  return (
    <VCard className="border-vyro-text/42">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[13px] uppercase tracking-[0.34em] text-vyro-mute">Sleep timeline</p>
          <h3 className="mt-4 text-[23px] font-black leading-tight text-vyro-text">Zones across the night</h3>
        </div>
        <MiniBadge>96% efficiency</MiniBadge>
      </div>

      <ZoneTimeline />
      <div className="mt-5 flex items-center justify-between font-mono text-[12px] text-vyro-mute">
        <span>11:14 PM</span>
        <span>2 AM</span>
        <span>4 AM</span>
        <span>6:18 AM</span>
      </div>
      <div className="mt-5 h-px bg-vyro-line" />
      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 text-[14px] text-vyro-mute">
        <Legend swatch="deep" label="Deep" detail="Physical repair" />
        <Legend swatch="rem" label="REM" detail="Reaction + recall" />
        <Legend swatch="light" label="Light" detail="Transition" />
        <Legend swatch="awake" label="Awake" detail="Wake windows" />
      </div>
      <div className="mt-7 grid grid-cols-2 gap-4">
        <ZoneMetric label="REM" value="1h 32m" target="Target 90–110m" tone="good" />
        <ZoneMetric label="Deep" value="1h 18m" target="Target 75–95m" tone="good" />
        <ZoneMetric label="Light" value="3h 38m" target="Target 200–240m" tone="good" />
        <ZoneMetric label="Wakeups" value="4" target="Target ≤ 3" tone="warn" />
        <ZoneMetric label="Duration" value="6h 46m" target="Target 7h 30m" tone="warn" />
      </div>
    </VCard>
  );
}

function Wakeups() {
  const events = [
    { time: "12:45 AM", note: "Short movement spike", duration: "4 min" },
    { time: "2:27 AM", note: "HR +8 bpm above baseline", duration: "6 min" },
    { time: "5:01 AM", note: "Restless turn cluster", duration: "3 min" },
    { time: "6:04 AM", note: "Final wake window", duration: "5 min" },
  ];

  return (
    <VCard className="border-vyro-text/42">
      <p className="font-mono text-[13px] uppercase tracking-[0.34em] text-vyro-mute">Wake events</p>
      <div className="mt-5 space-y-4">
        {events.map((event) => (
          <div key={event.time} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-[20px] border border-vyro-line bg-vyro-panel/70 p-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-vyro-line bg-vyro-text/5 text-vyro-mute">
              <Sunrise className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[19px] font-black leading-tight text-vyro-text">{event.time}</p>
              <p className="mt-1 truncate text-[14px] text-vyro-mute">{event.note}</p>
            </div>
            <span className="font-mono text-[13px] text-vyro-mute">{event.duration}</span>
          </div>
        ))}
      </div>
    </VCard>
  );
}

function SleepPerformance() {
  const rows = [
    { icon: <Brain className="h-5 w-5" />, label: "Performance", detail: "Actual sleep vs sport-adjusted sleep need", value: 83, note: "Good — above your 80% baseline" },
    { icon: <Waves className="h-5 w-5" />, label: "Sleep schedule consistency", detail: "Bed/wake timing vs 14-day baseline", value: 91, note: "Elite — within 18 min night-to-night" },
    { icon: <Zap className="h-5 w-5" />, label: "Restorative sleep share", detail: "2h 50m REM + deep", value: 42, note: "On target — 42% restorative" },
  ];

  return (
    <VCard className="border-vyro-text/42">
      <p className="font-mono text-[13px] uppercase tracking-[0.34em] text-vyro-mute">Sleep performance</p>
      <div className="mt-7 space-y-8">
        {rows.map((row) => (
          <PerformanceRow key={row.label} {...row} />
        ))}
      </div>
    </VCard>
  );
}

function VCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[26px] border border-vyro-line bg-vyro-panel p-4 shadow-[inset_0_1px_0_color-mix(in_oklab,var(--vyro-text)_8%,transparent)] ${className}`}>
      {children}
    </section>
  );
}

function MiniBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-8 shrink-0 items-center rounded-lg border border-vyro-text/32 bg-vyro-text/8 px-3 font-mono text-[12px] uppercase tracking-[0.16em] text-vyro-text">
      {children}
    </span>
  );
}

function SleepRing({ value }: { value: number }) {
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);

  return (
    <div className="mx-auto w-full max-w-[250px]">
      <svg viewBox="0 0 190 190" className="mx-auto h-[190px] w-[190px] -rotate-90 overflow-visible" aria-label={`Sleep score ${value} out of 100`}>
        <circle cx="95" cy="95" r={radius} fill="none" stroke="var(--vyro-line)" strokeWidth="12" />
        <circle
          cx="95"
          cy="95"
          r={radius}
          fill="none"
          stroke="var(--vyro-text)"
          strokeLinecap="round"
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="pointer-events-none -mt-[118px] flex h-[118px] flex-col items-center justify-start text-center">
        <span className="text-[34px] font-black leading-none tabular-nums text-vyro-text">{value}</span>
        <span className="mt-3 font-mono text-[14px] text-vyro-mute">/ 100</span>
      </div>
      <p className="mt-2 text-center font-mono text-[12px] uppercase tracking-[0.34em] text-vyro-mute">Sleep</p>
    </div>
  );
}

function MetricPanel({ icon, label, value, hint }: { icon: ReactNode; label: string; value: ReactNode; hint: string }) {
  return (
    <div className="rounded-[18px] border border-vyro-line bg-vyro-panel/70 p-4">
      <div className="flex items-center gap-3 font-mono text-[13px] uppercase tracking-[0.24em] text-vyro-mute">
        <span className="text-vyro-mute">{icon}</span>
        {label}
      </div>
      <p className="mt-3 text-[24px] font-black leading-none text-vyro-text">{value}</p>
      <p className="mt-2 text-[13px] text-vyro-mute">{hint}</p>
    </div>
  );
}

function DebtTrendSpark() {
  const coords = [
    [2, 28],
    [75, 46],
    [150, 38],
    [225, 64],
    [298, 52],
  ] as const;
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");

  return (
    <svg viewBox="0 0 300 82" className="mt-3 h-[82px] w-full overflow-visible" aria-label="7 night sleep debt trend">
      <path d={`${path} L298 82 L2 82 Z`} fill="var(--vyro-amber)" opacity="0.13" />
      <path d={path} fill="none" stroke="var(--vyro-amber)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      {coords.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3" fill="var(--vyro-amber)" />
      ))}
    </svg>
  );
}

function CoachPlan({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[18px] border border-vyro-line bg-vyro-panel/70 p-4">
      <div className="flex items-center gap-2 font-mono text-[13px] uppercase tracking-[0.2em] text-vyro-mute">
        <span className="text-vyro-mute">{icon}</span>
        {label}
      </div>
      <p className="mt-4 text-[32px] font-black leading-none text-vyro-text">{value}</p>
      <p className="mt-3 text-[14px] text-vyro-mute">{hint}</p>
    </div>
  );
}

function Insight({ tone, children }: { tone: "good" | "warn"; children: ReactNode }) {
  const good = tone === "good";
  return (
    <div className={`flex items-start gap-4 rounded-[14px] border p-4 text-[16px] leading-relaxed ${good ? "border-vyro-mint/40 bg-vyro-mint/10 text-vyro-text" : "border-vyro-amber/45 bg-vyro-amber/10 text-vyro-text"}`}>
      <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${good ? "bg-vyro-mint" : "bg-vyro-amber"}`} />
      <span>{children}</span>
    </div>
  );
}

function ZoneTimeline() {
  const segments = [
    { width: 11, color: "var(--vyro-mute)" },
    { width: 10, color: "var(--vyro-text)" },
    { width: 1, stripe: true },
    { width: 17, color: "var(--vyro-mute)" },
    { width: 8, color: "var(--vyro-spatial)" },
    { width: 1.5, stripe: true },
    { width: 10, color: "var(--vyro-text)" },
    { width: 18, color: "var(--vyro-mute)" },
    { width: 9, color: "var(--vyro-spatial)" },
    { width: 1, stripe: true },
    { width: 9, color: "var(--vyro-mute)" },
    { width: 6.5, color: "var(--vyro-spatial)" },
  ];

  return (
    <div className="mt-7 flex h-[42px] overflow-hidden rounded-full border border-vyro-line bg-vyro-elev">
      {segments.map((segment, index) => (
        <span
          key={index}
          className="h-full"
          style={{
            width: `${segment.width}%`,
            background: segment.stripe
              ? "repeating-linear-gradient(45deg, var(--vyro-amber) 0 7px, color-mix(in oklab, var(--vyro-amber) 30%, transparent) 7px 14px)"
              : segment.color,
          }}
        />
      ))}
    </div>
  );
}

function Legend({ swatch, label, detail }: { swatch: "deep" | "rem" | "light" | "awake"; label: string; detail: string }) {
  const style =
    swatch === "deep"
      ? { background: "var(--vyro-text)" }
      : swatch === "rem"
        ? { background: "var(--vyro-spatial)" }
        : swatch === "light"
          ? { background: "var(--vyro-mute)" }
          : { background: "repeating-linear-gradient(45deg, var(--vyro-amber) 0 7px, color-mix(in oklab, var(--vyro-amber) 35%, transparent) 7px 14px)" };

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="h-4 w-4 shrink-0 rounded-md" style={style} />
      <span className="min-w-0 truncate">
        <span className="font-black text-vyro-text">{label}</span> <span>{detail}</span>
      </span>
    </div>
  );
}

function ZoneMetric({ label, value, target, tone }: { label: string; value: string; target: string; tone: "good" | "warn" }) {
  return (
    <div className="min-h-[112px] rounded-[18px] border border-vyro-line bg-vyro-panel/70 p-4">
      <p className="font-mono text-[13px] uppercase tracking-[0.14em] text-vyro-mute">{label}</p>
      <p className="mt-3 text-[28px] font-black leading-none text-vyro-text">{value}</p>
      <p className={`mt-5 flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.1em] ${tone === "good" ? "text-vyro-mint" : "text-vyro-amber"}`}>
        <span className={`h-2 w-2 rounded-full ${tone === "good" ? "bg-vyro-mint" : "bg-vyro-amber"}`} />
        {target}
      </p>
    </div>
  );
}

function PerformanceRow({ icon, label, detail, value, note }: { icon: ReactNode; label: string; detail: string; value: number; note: string }) {
  return (
    <div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <span className="mt-0.5 text-vyro-mute">{icon}</span>
        <div className="min-w-0">
          <p className="truncate text-[18px] font-black leading-tight text-vyro-text">{label}</p>
          <p className="mt-1 text-[13px] leading-snug text-vyro-mute">{detail}</p>
        </div>
        <span className="text-[18px] font-black tabular-nums text-vyro-text">{value}</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-vyro-text/8">
        <span className="block h-full rounded-full bg-vyro-text" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-5 flex items-start gap-2 font-mono text-[13px] uppercase tracking-[0.12em] text-vyro-mint">
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-vyro-mint" />
        {note}
      </p>
    </div>
  );
}
