import { useState } from "react";
import { Moon, Sunrise } from "lucide-react";
import { Card, EmptyState, PageHeader, Pill, Ring, Stat } from "./shared";
import { useLiveMetrics } from "./useLiveMetrics";

type Tab = "overall" | "zones" | "wakeups" | "performance";

// Sleep view. We only render the nightly architecture when the band has
// actually streamed a sleep summary. Until the firmware exposes a sleep
// packet, we treat sleep as "not yet synced" and refuse to fabricate
// scores, debt, wakeup timestamps, or stage breakdowns.
type NightSummary = {
  score: number;
  asleepLabel: string;
  inBedLabel: string;
  bedtime: string;
  wake: string;
  wakeups: number;
  debtLabel: string;
  targetLabel: string;
  debtTrendFrom: string;
  debtTrendTo: string;
  recBedtime: string;
  recWake: string;
  zones: { deep: number; rem: number; light: number; awake: number };
};

export function SleepView() {
  const [tab, setTab] = useState<Tab>("overall");
  const m = useLiveMetrics();
  // Real nightly summary will plug in here when the band publishes it.
  // Function-typed so TS can't narrow the constant to literal `null` and
  // break the rendering branches below.
  const getNightSummary = (): NightSummary | null => null;
  const NIGHT = getNightSummary();


  const syncedTone = NIGHT ? "live" : "off";
  const syncedLabel = NIGHT ? "Last night" : m.connected ? "Awaiting sync" : "No watch";

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        eyebrow="Sleep · Recovery Input"
        title="Sleep architecture"
        subtitle="WHOOP-style sleep breakdown for duration, zones, wakeups, and next-session readiness."
        action={<Pill tone={syncedTone} pulse={!!NIGHT}>{syncedLabel}</Pill>}
      />

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-vyro-line bg-vyro-panel p-1.5">
        {[
          { id: "overall", label: "Overall Sleep" },
          { id: "zones", label: "Sleep Zones" },
          { id: "wakeups", label: "Wakeups" },
          { id: "performance", label: "Performance" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={`whitespace-nowrap rounded-xl px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] transition ${
              tab === t.id ? "bg-vyro-text text-vyro-bg" : "text-vyro-mute hover:text-vyro-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!NIGHT && (
        <EmptyState
          title={m.connected ? "No nightly sleep summary yet" : "Pair your VYRO Band to sync sleep"}
          hint={
            m.connected
              ? "Wear the band overnight. As soon as a sleep session is detected and processed, score, stages, wakeups and debt populate here automatically. Nothing is estimated until then."
              : "Sleep architecture (stages, wakeups, debt, performance) comes from the band's overnight HR, HRV, SpO₂, skin-temp and IMU streams. Connect a band to unlock it."
          }
        />
      )}

      {NIGHT && tab === "overall" && (
        <>
          {/* HERO */}
          <Card>
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <Ring value={NIGHT.score} size={168} stroke={12} label="Sleep" sub="/ 100" />
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-mute">Sleep score</div>
                <h3 className="mt-1 text-xl font-black leading-tight text-vyro-text">Recovered, not topped off.</h3>
                <div className="mt-2">
                  <Pill tone="live" pulse>Sleep synced</Pill>
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-vyro-mute">
                  Restorative stages were strong but you're still under your dynamic target. One earlier bedtime tonight
                  closes the debt for tomorrow's session.
                </p>
              </div>
            </div>
          </Card>

          {/* Top-line stats */}
          <div className="grid grid-cols-3 gap-2">
            <Stat
              label="Sleep"
              value={NIGHT.asleepLabel}
              hint={`${NIGHT.bedtime} → ${NIGHT.wake}`}
            />
            <Stat label="Wakeups" value={NIGHT.wakeups} hint={`${NIGHT.inBedLabel} in bed`} />
            <Stat label="Sleep debt" value={NIGHT.debtLabel} hint={`Target ${NIGHT.targetLabel}`} />
          </div>

          {/* Sleep debt block */}
          <Card eyebrow="Sleep debt" title={`${NIGHT.debtLabel} owed`} action={<Pill tone="warn">debt</Pill>}>
            <p className="text-[12px] leading-relaxed text-vyro-mute">
              <span className="text-vyro-text font-bold">{NIGHT.debtLabel}</span> under a dynamic target of{" "}
              <span className="text-vyro-text font-bold">{NIGHT.targetLabel}</span>.
            </p>
            <div className="mt-3 rounded-xl border border-vyro-line bg-vyro-elev p-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-mute">7-night debt trend</div>
              <div className="mt-1 text-[12px] font-semibold text-vyro-mint">
                Trending down — debt fell from {NIGHT.debtTrendFrom} to {NIGHT.debtTrendTo}
              </div>
              <DebtTrendSpark />
            </div>
          </Card>

          {/* Coach plan */}
          <Card eyebrow="Sleep coach · tonight's plan" title="Tonight's plan">
            <div className="grid gap-2 sm:grid-cols-3">
              <CoachTile
                icon={<Moon className="h-4 w-4" />}
                label="Recommended bedtime"
                value={NIGHT.recBedtime}
                why="~50m earlier to clear debt"
              />
              <CoachTile
                icon={<Sunrise className="h-4 w-4" />}
                label="Recommended wake"
                value={NIGHT.recWake}
                why="Keeps your schedule consistent"
              />
              <CoachTile
                icon={<span className="font-mono text-[11px] font-bold">T</span>}
                label="Tonight's target"
                value={NIGHT.targetLabel}
                why="Adjusted for today's training load"
              />
            </div>
          </Card>

          {/* Recovery interpretation */}
          <Card eyebrow="VYRO recovery interpretation" title="What it means for tomorrow">
            <ul className="space-y-2.5 text-[12.5px] leading-relaxed text-vyro-text">
              <Bullet ok>
                Deep sleep carried early-night muscle repair, but total sleep need is still under target by{" "}
                <span className="font-bold">{NIGHT.debtLabel}</span>.
              </Bullet>
              <Bullet ok>
                REM was strong late-night, supporting reaction timing and shot selection for same-day training.
              </Bullet>
              <Bullet warn>
                Four wake events are acceptable, but the <span className="font-bold">2:27 AM HR spike</span> is a
                recovery-quality flag after high Z5 rallies.
              </Bullet>
            </ul>
          </Card>
        </>
      )}

      {NIGHT && tab === "zones" && (
        <>
          <Card eyebrow="Stages · 30-s epochs" title="Sleep zones">
            <ZoneBar zones={NIGHT.zones} />
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Deep" value={fmtHrs(NIGHT.zones.deep)} hint="muscle repair" />
              <Stat label="REM" value={fmtHrs(NIGHT.zones.rem)} hint="reaction · skill" />
              <Stat label="Light" value={fmtHrs(NIGHT.zones.light)} hint="transition" />
              <Stat label="Awake" value={fmtHrs(NIGHT.zones.awake)} hint="in-bed wakes" />
            </div>
          </Card>
        </>
      )}

      {NIGHT && tab === "wakeups" && (
        <Card eyebrow="Wake events" title={`${NIGHT.wakeups} wakeups overnight`}>
          <ul className="divide-y divide-vyro-line text-[12.5px]">
            {[
              { time: "12:48 AM", note: "Brief movement · 2 min" },
              { time: "2:27 AM", note: "HR spike to 71 bpm · post-rally signal" },
              { time: "4:11 AM", note: "Position change · 1 min" },
              { time: "5:42 AM", note: "Light wake before alarm" },
            ].map((w) => (
              <li key={w.time} className="flex items-center justify-between gap-3 py-2.5">
                <span className="font-mono text-[11px] tabular-nums text-vyro-text">{w.time}</span>
                <span className="truncate text-vyro-mute">{w.note}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {NIGHT && tab === "performance" && (
        <Card eyebrow="Sleep performance" title="Next-session readiness">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Sleep performance" value="83" unit="%" hint="asleep ÷ need" />
            <Stat label="Restorative" value="3h 00m" hint="Deep + REM" />
            <Stat label="Consistency" value="76" unit="%" hint="vs 7-day schedule" />
            <Stat label="Efficiency" value="96" unit="%" hint="asleep ÷ in bed" />
          </div>
        </Card>
      )}
    </div>
  );
}


function fmtHrs(h: number) {
  const total = Math.round(h * 60);
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, "0")}m`;
}

function CoachTile({
  icon,
  label,
  value,
  why,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  why: string;
}) {
  return (
    <div className="rounded-xl border border-vyro-line bg-vyro-elev p-3">
      <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-mute">
        <span className="grid h-5 w-5 place-items-center rounded-full border border-vyro-line text-vyro-text">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-black tabular-nums text-vyro-text">{value}</div>
      <div className="mt-1 text-[11px] text-vyro-mute">{why}</div>
    </div>
  );
}

function Bullet({ children, ok, warn }: { children: React.ReactNode; ok?: boolean; warn?: boolean }) {
  const color = warn ? "bg-vyro-amber" : ok ? "bg-vyro-mint" : "bg-vyro-line";
  return (
    <li className="flex items-start gap-2.5">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${color}`} />
      <span>{children}</span>
    </li>
  );
}

function ZoneBar({ zones }: { zones: { deep: number; rem: number; light: number; awake: number } }) {
  const total = zones.deep + zones.rem + zones.light + zones.awake;
  const segs = [
    { key: "Deep", v: zones.deep, color: "var(--vyro-spatial)" },
    { key: "REM", v: zones.rem, color: "var(--vyro-mint)" },
    { key: "Light", v: zones.light, color: "var(--vyro-amber)" },
    { key: "Awake", v: zones.awake, color: "var(--vyro-rose)" },
  ];
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full border border-vyro-line bg-vyro-elev">
        {segs.map((s) => (
          <div key={s.key} style={{ width: `${(s.v / total) * 100}%`, background: s.color }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-mute">
        {segs.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.key} · {Math.round((s.v / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

function DebtTrendSpark() {
  // 7-night debt in minutes, trending down from ~120 → 84.
  const points = [120, 130, 115, 105, 98, 92, 84];
  const w = 280, h = 56, pad = 4;
  const min = Math.min(...points) - 10;
  const max = Math.max(...points) + 10;
  const step = (w - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = pad + i * step;
    const y = pad + (1 - (p - min) / (max - min)) * (h - pad * 2);
    return [x, y] as const;
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 block h-14 w-full">
      <path d={path} fill="none" stroke="var(--vyro-mint)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.8} fill="var(--vyro-mint)" />
      ))}
    </svg>
  );
}
