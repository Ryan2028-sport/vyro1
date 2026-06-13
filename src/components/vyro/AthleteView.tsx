import { useMemo } from "react";
import { Card, PageHeader, Pill, Ring, Stat } from "./shared";
import { computeReadiness, computeSubScores, recoveryBand, useLiveMetrics } from "./useLiveMetrics";

// Athlete tab — mobile-first health hub tuned for squash players.
// Live values stream from the band; everything else degrades gracefully
// to "—" so the layout is always populated and readable on a phone.
export function AthleteView() {
  const m = useLiveMetrics();

  // Derived squash-specific metrics. These are computed from whatever the
  // band currently exposes; missing inputs collapse to null.
  const subs = useMemo(
    () =>
      computeSubScores({
        connected: m.connected,
        peakJerk: m.peakJerk,
        peakG: m.peakG,
        eventsLastMin: m.eventsLastMin,
        reactMin: m.reactMin,
      }),
    [m.connected, m.peakJerk, m.peakG, m.eventsLastMin, m.reactMin],
  );

  const readiness = useMemo(
    () =>
      computeReadiness({
        connected: m.connected,
        peakJerk: m.peakJerk,
      }),
    [m.connected, m.peakJerk],
  );

  // Session load proxy: events/min weighted by peak jerk. Capped 0-100.
  const sessionLoad = useMemo(() => {
    if (!m.connected) return null;
    const base = Math.min(100, m.eventsLastMin * 1.4);
    const intensity = Math.min(40, (m.peakJerk ?? 0) / 5);
    return Math.round(Math.min(100, base * 0.7 + intensity));
  }, [m.connected, m.eventsLastMin, m.peakJerk]);

  const band = recoveryBand(readiness.score);
  const bandTone = band === "green" ? "live" : band === "yellow" ? "warn" : band === "red" ? "off" : "neutral";
  const bandLabel = band === "green" ? "primed" : band === "yellow" ? "manage" : band === "red" ? "recover" : "calibrating";

  // Court-readiness suggestion derived from the live numbers. Pure
  // presentational logic — no network calls, no flicker.
  const guidance = useMemo(() => {
    if (!m.connected) return "Connect the band to unlock court-ready guidance.";
    if (band === "red") return "Recovery is low. Skip ghosting drills, choose mobility + light hitting.";
    if (band === "yellow") return "Moderate readiness — technique work and 2 short interval blocks max.";
    if (sessionLoad != null && sessionLoad > 70) return "You're already deep in load. Cool down and rehydrate.";
    return "Green light: full interval ghosting, court sprints and pressure drills are on the table.";
  }, [m.connected, band, sessionLoad]);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Athlete · 24/7"
        title="Athlete health"
        subtitle="Live squash-tuned health and load from your VYRO Band."
        action={
          <Pill tone={m.connected ? "live" : "off"} pulse={m.connected}>
            {m.connected ? "live" : "no watch"}
          </Pill>
        }
      />

      {/* Hero — readiness + court guidance, mobile-stacked */}
      <Card eyebrow="Court readiness" title="Today's status" action={<Pill tone={bandTone}>{bandLabel}</Pill>}>
        <div className="flex items-center gap-4">
          <Ring value={readiness.score} label="Ready" sub={m.connected ? "live" : "off"} />
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-mute">Coach read</div>
            <p className="mt-1 text-[13px] leading-relaxed text-vyro-text">{guidance}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniRing value={subs.recovery} label="Recovery" />
              <MiniRing value={subs.agility} label="Agility" />
              <MiniRing value={subs.fatigue} label="Fatigue" invert />
            </div>
          </div>
        </div>
      </Card>

      {/* Squash load — what most fitness apps miss */}
      <Card
        eyebrow="Squash load · live"
        title="On-court intensity"
        action={<Pill tone={(sessionLoad ?? 0) > 70 ? "warn" : "live"}>{sessionLoad == null ? "—" : `${sessionLoad}/100`}</Pill>}
      >
        <LoadBar value={sessionLoad} />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Events / min" value={m.connected ? m.eventsLastMin : "—"} hint="rolling 60 s" />
          <Stat label="Peak accel" value={m.connected ? m.peakG.toFixed(2) : "—"} unit="g" />
          <Stat label="Peak jerk" value={m.connected ? m.peakJerk.toFixed(0) : "—"} unit="g/s" hint="explosiveness" />
          <Stat label="Reaction" value={m.connected && m.reactMin != null ? m.reactMin.toFixed(0) : "—"} unit="ms" hint="fastest cut" />
        </div>
      </Card>

      {/* Cardiac */}
      <Card eyebrow="Heart · every 1 s" title="Cardiac">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Current HR" value="—" unit="bpm" hint="live" />
          <Stat label="Resting HR" value="—" unit="bpm" hint="nightly" />
          <Stat label="HRV (RMSSD)" value="—" unit="ms" hint="every 5 min" />
          <Stat label="Stress" value="—" hint="HR · HRV · RR" />
        </div>
      </Card>

      {/* Hydration & fueling — squash-specific */}
      <Card eyebrow="Court fueling" title="Hydration & energy">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Sweat loss" value="—" unit="ml" hint="est. per hour" />
          <Stat label="Water target" value="—" unit="ml" hint="next 60 min" />
          <Stat label="Sodium" value="—" unit="mg" hint="est. loss" />
          <Stat label="Carb need" value="—" unit="g" hint="match window" />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-vyro-mute">
          Sip 150–250 ml every 15 minutes between games. Add 300–700 mg sodium per hour of high-tempo play.
        </p>
      </Card>

      {/* Physiology */}
      <Card eyebrow="Respiration · O₂ · temp" title="Physiology">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Resp rate" value="—" unit="br/min" hint="every 3 min" />
          <Stat label="SpO₂" value="—" unit="%" hint="every 3 min" />
          <Stat label="Skin temp" value="—" unit="°C" hint="every 3 min" />
        </div>
      </Card>

      {/* Movement */}
      <Card eyebrow="Activity · all-day" title="Movement">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Steps" value="—" hint="every 1 s" />
          <Stat label="Active kcal" value="—" unit="kcal" hint="every 60 s" />
          <Stat label="Resting kcal" value="—" unit="kcal" hint="BMR" />
          <Stat label="Total kcal" value="—" unit="kcal" />
        </div>
      </Card>

      {/* Injury risk — squash hot spots */}
      <Card eyebrow="Injury risk · squash" title="Hot spots">
        <div className="space-y-2">
          <RiskRow zone="Lunging knee" level={band === "red" ? "elevated" : "low"} note="Front-foot decel load" />
          <RiskRow zone="Achilles / calf" level={(sessionLoad ?? 0) > 70 ? "elevated" : "low"} note="Repeated push-off" />
          <RiskRow zone="Shoulder · drive" level="low" note="Swing volume nominal" />
          <RiskRow zone="Lower back" level="low" note="Twist load nominal" />
        </div>
      </Card>

      {/* Data integrity */}
      <Card eyebrow="Data integrity" title="Confidence">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Wear time" value="—" unit="h" hint="every 60 s" />
          <Stat label="Signal" value="—" unit="%" hint="every 60 s" />
          <Stat label="Battery" value="—" unit="%" hint="every 60 s" />
        </div>
      </Card>
    </div>
  );
}

function MiniRing({ value, label, invert = false }: { value: number | null; label: string; invert?: boolean }) {
  // Invert = higher value is worse (fatigue). Color the ring accordingly.
  const v = value ?? 0;
  const good = invert ? v < 50 : v >= 60;
  const stroke = good ? "var(--vyro-mint)" : v > 0 ? "var(--vyro-amber)" : "var(--vyro-line)";
  const size = 56;
  const sw = 6;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const pct = value == null ? 0 : Math.max(0, Math.min(1, v / 100));
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-vyro-line bg-vyro-elev p-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 block" style={{ overflow: "visible" }}>
          <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--vyro-line)" strokeWidth={sw} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={stroke}
            strokeWidth={sw}
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            strokeLinecap="round"
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-[11px] font-black tabular-nums text-vyro-text">
          {value ?? "—"}
        </div>
      </div>
      <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-vyro-mute">{label}</div>
    </div>
  );
}

function LoadBar({ value }: { value: number | null }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const zone = pct < 40 ? "easy" : pct < 70 ? "tempo" : "redline";
  const color = zone === "easy" ? "var(--vyro-mint)" : zone === "tempo" ? "var(--vyro-amber)" : "var(--vyro-rose)";
  return (
    <div>
      <div className="relative h-3 w-full overflow-hidden rounded-full border border-vyro-line bg-vyro-elev">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-mute">
        <span>Easy</span>
        <span>Tempo</span>
        <span>Redline</span>
      </div>
    </div>
  );
}

function RiskRow({ zone, level, note }: { zone: string; level: "low" | "elevated" | "high"; note: string }) {
  const tone = level === "high" ? "off" : level === "elevated" ? "warn" : "live";
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-vyro-line bg-vyro-elev px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-[12px] font-bold text-vyro-text">{zone}</div>
        <div className="truncate text-[10px] text-vyro-mute">{note}</div>
      </div>
      <Pill tone={tone}>{level}</Pill>
    </div>
  );
}
