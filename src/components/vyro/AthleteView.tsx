import { useMemo, useState } from "react";
import { Card, PageHeader, Pill, Ring, Stat } from "./shared";
import { computeReadiness, computeSubScores, recoveryBand, useLiveMetrics } from "./useLiveMetrics";

// Athlete tab — mobile-first health hub tuned for squash players.
// Reorganized into a hero + segmented sub-tabs so the screen never
// requires excessive scrolling. Live values stream from the band;
// everything else degrades gracefully to "—".

type Section = "overview" | "cardiac" | "body" | "load" | "risk";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "cardiac", label: "Cardiac" },
  { id: "body", label: "Body" },
  { id: "load", label: "Load" },
  { id: "risk", label: "Risk" },
];

export function AthleteView() {
  const m = useLiveMetrics();
  const [section, setSection] = useState<Section>("overview");
  const live = <T,>(v: T | null | undefined): T | null => (m.connected ? (v ?? null) : null);

  const subs = useMemo(
    () =>
      computeSubScores({
        connected: m.connected,
        hrvMs: m.hrvMs,
        restingHrBpm: m.restingHrBpm,
        stress: m.stressScore,
        peakJerk: m.peakJerk,
        peakG: m.peakG,
        eventsLastMin: m.eventsLastMin,
        reactMin: m.reactMin,
      }),
    [m.connected, m.hrvMs, m.restingHrBpm, m.stressScore, m.peakJerk, m.peakG, m.eventsLastMin, m.reactMin],
  );

  const readiness = useMemo(
    () =>
      computeReadiness({
        connected: m.connected,
        hrvMs: m.hrvMs,
        restingHrBpm: m.restingHrBpm,
        stress: m.stressScore,
        spo2: m.spo2Pct,
        peakJerk: m.peakJerk,
      }),
    [m.connected, m.hrvMs, m.restingHrBpm, m.stressScore, m.spo2Pct, m.peakJerk],
  );

  const sessionLoad = useMemo(() => {
    if (!m.connected) return null;
    const base = Math.min(100, m.eventsLastMin * 1.4);
    const intensity = Math.min(40, (m.peakJerk ?? 0) / 5);
    return Math.round(Math.min(100, base * 0.7 + intensity));
  }, [m.connected, m.eventsLastMin, m.peakJerk]);

  const band = recoveryBand(readiness.score);
  const bandTone = band === "green" ? "live" : band === "yellow" ? "warn" : band === "red" ? "off" : "neutral";
  const bandLabel = band === "green" ? "primed" : band === "yellow" ? "manage" : band === "red" ? "recover" : "calibrating";

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

      {/* Sticky hero — always visible no matter which section */}
      <Card eyebrow="Court readiness" title="Today's status" action={<Pill tone={bandTone}>{bandLabel}</Pill>}>
        <div className="flex items-center gap-4">
          <Ring value={readiness.score} label="Ready" sub={m.connected ? "live" : "off"} size={108} stroke={9} />
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-vyro-mute">Coach read</div>
            <p className="mt-1 text-[13px] leading-snug text-vyro-text">{guidance}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniRing value={subs.recovery} label="Recovery" />
              <MiniRing value={subs.agility} label="Agility" />
              <MiniRing value={subs.fatigue} label="Fatigue" invert />
            </div>
          </div>
        </div>
      </Card>

      {/* Segmented nav — replaces the long scroll */}
      <div className="sticky top-0 z-10 -mx-4 px-4 pb-1 pt-1 bg-gradient-to-b from-vyro-ink via-vyro-ink to-transparent">
        <div className="flex gap-1.5 overflow-x-auto rounded-full border border-vyro-line bg-vyro-panel p-1 no-scrollbar">
          {SECTIONS.map((s) => {
            const active = s.id === section;
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
                  active ? "bg-vyro-mint text-vyro-ink" : "text-vyro-mute hover:text-vyro-text"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Single shared "no watch" notice — never show fake numbers when disconnected */}
      {!m.connected && (
        <Card>
          <p className="text-[12px] leading-relaxed text-vyro-mute">
            <span className="text-vyro-text font-bold">Band offline.</span> Pair and wear your VYRO Band to stream
            HR, HRV, SpO₂, skin temp, steps and IMU load in real time. Values below stay blank until live data arrives —
            nothing is estimated.
          </p>
        </Card>
      )}

      {section === "overview" && (
        <Card eyebrow="At a glance" title="Right now">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Current HR" value={live(m.heartRateBpm) ?? "—"} unit="bpm" />
            <Stat label="HRV" value={live(m.hrvMs) ?? "—"} unit="ms" />
            <Stat label="Steps" value={live(m.stepsToday) ?? "—"} />
            <Stat label="Active kcal" value={live(m.caloriesKcal) ?? "—"} />
            <Stat label="Squash load" value={sessionLoad ?? "—"} hint="/100" />
            <Stat label="Battery" value={live(m.batteryPct) ?? "—"} unit="%" hint={m.connected && m.batteryCharging ? "charging" : undefined} />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-vyro-mute">
            Tap a tab above for cardiac, body composition, on-court load and injury risk detail.
          </p>
        </Card>
      )}

      {section === "cardiac" && (
        <Card eyebrow="Heart · every 1 s" title="Cardiac">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Current HR" value={live(m.heartRateBpm) ?? "—"} unit="bpm" hint={live(m.heartRateBpm) != null ? "live" : undefined} />
            <Stat label="Resting HR" value={live(m.restingHrBpm) ?? "—"} unit="bpm" hint={live(m.restingHrBpm) != null ? "rolling live HR" : undefined} />
            <Stat label="HRV (RMSSD)" value={live(m.hrvMs) ?? "—"} unit="ms" hint={live(m.hrvMs) != null ? "watch frame" : undefined} />
            <Stat label="Stress" value={live(m.stressScore) ?? "—"} hint={live(m.stressScore) != null ? "watch stress frame" : undefined} />
            <Stat
              label="Blood pressure"
              value={live(m.bloodPressure) ? `${live(m.bloodPressure)!.sbp}/${live(m.bloodPressure)!.dbp}` : "—"}
              unit="mmHg"
              hint={live(m.bloodPressure) ? "one-key measure" : undefined}
            />
            <Stat label="Resp rate" value={live(m.respRateBrpm) ?? "—"} unit="br/min" hint={live(m.respRateBrpm) != null ? "watch field" : undefined} />
          </div>
        </Card>
      )}

      {section === "body" && (
        <>
          <Card eyebrow="Respiration · O₂ · temp" title="Physiology">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="Resp rate" value={live(m.respRateBrpm) ?? "—"} unit="br/min" />
              <Stat label="SpO₂" value={live(m.spo2Pct) ?? "—"} unit="%" />
              <Stat label="Skin temp" value={live(m.skinTempC) != null ? live(m.skinTempC)!.toFixed(1) : "—"} unit="°C" />
            </div>
          </Card>
          <Card eyebrow="Court fueling" title="Hydration & energy">
            <p className="text-[11px] leading-relaxed text-vyro-mute">
              Hydration and energy guidance unlock once live HR, skin temp and session-load frames stream continuously.
              Nothing appears here from cached or estimated body signals.
            </p>
          </Card>
        </>
      )}

      {section === "load" && (
        <>
          <Card
            eyebrow="Squash load · live"
            title="On-court intensity"
            action={<Pill tone={(sessionLoad ?? 0) > 70 ? "warn" : "live"}>{sessionLoad == null ? "—" : `${sessionLoad}/100`}</Pill>}
          >
            <LoadBar value={sessionLoad} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Stat label="Events / min" value={m.connected ? m.eventsLastMin : "—"} hint="rolling 60 s" />
              <Stat label="Peak accel" value={m.connected ? m.peakG.toFixed(2) : "—"} unit="g" />
              <Stat label="Peak jerk" value={m.connected ? m.peakJerk.toFixed(0) : "—"} unit="g/s" />
              <Stat label="Reaction" value={m.connected && m.reactMin != null ? m.reactMin.toFixed(0) : "—"} unit="ms" />
            </div>
          </Card>
          <Card eyebrow="Activity · all-day" title="Movement">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Steps" value={live(m.stepsToday) ?? "—"} />
              <Stat label="Active kcal" value={live(m.caloriesKcal) ?? "—"} unit="kcal" />
              <Stat label="Distance" value={live(m.distanceM) != null ? (live(m.distanceM)! / 1000).toFixed(2) : "—"} unit="km" />
              <Stat label="Battery" value={live(m.batteryPct) ?? "—"} unit="%" />
            </div>
          </Card>
        </>
      )}

      {section === "risk" && (
        <>
          <Card eyebrow="Injury risk · squash" title="Hot spots">
            {m.connected ? (
              <div className="space-y-2">
                <RiskRow zone="Lunging knee" level={band === "red" ? "elevated" : "low"} note="Front-foot decel load" />
                <RiskRow zone="Achilles / calf" level={(sessionLoad ?? 0) > 70 ? "elevated" : "low"} note="Repeated push-off" />
                <RiskRow zone="Shoulder · drive" level="low" note="Swing volume nominal" />
                <RiskRow zone="Lower back" level="low" note="Twist load nominal" />
              </div>
            ) : (
              <p className="text-[11px] leading-relaxed text-vyro-mute">
                Risk flags need live IMU + HR data. Pair the band to populate.
              </p>
            )}
          </Card>
          <Card eyebrow="Data integrity" title="Signal confidence">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="HR" value={live(m.heartRateBpm) != null ? "live" : "—"} />
              <Stat label="IMU" value={m.connected ? "live" : "—"} />
              <Stat label="Battery" value={live(m.batteryPct) ?? "—"} unit="%" />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function MiniRing({ value, label, invert = false }: { value: number | null; label: string; invert?: boolean }) {
  const v = value ?? 0;
  const good = invert ? v < 50 : v >= 60;
  const stroke = good ? "var(--vyro-mint)" : v > 0 ? "var(--vyro-amber)" : "var(--vyro-line)";
  const size = 52;
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
