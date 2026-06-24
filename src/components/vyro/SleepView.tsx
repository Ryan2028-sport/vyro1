// Sleep view — STRICT real-data-only mode.
// The firmware does NOT emit a sleep frame, so we cannot show staged
// hypnograms, wakeup events or sleep-debt. Instead we derive a basic sleep
// score from overnight HR / HRV / skin-temp samples streamed via BLE, using
// a rolling localStorage buffer. Every value falls back to "—" when there
// isn't a real source for it.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Heart, Moon, Thermometer, Activity } from "lucide-react";
import { useLiveMetrics } from "./useLiveMetrics";

type Sample = { t: number; hr?: number; hrv?: number; tempC?: number };
const BUF_KEY = "vyro.sleep.samples.v1";
const BUF_MAX = 2880; // ~24h at one sample / 30s
const WINDOW_MS = 12 * 60 * 60_000; // last 12h
const NIGHT_HOURS = new Set([22, 23, 0, 1, 2, 3, 4, 5, 6, 7]);

function loadBuf(): Sample[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BUF_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function saveBuf(b: Sample[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(BUF_KEY, JSON.stringify(b.slice(-BUF_MAX))); } catch { /* quota */ }
}

function avg(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function min(xs: number[]): number | null { return xs.length ? Math.min(...xs) : null; }

// Sleep score 0-100 derived from overnight vitals.
//   Cardiac calm: lower min HR = better. 40 bpm → 100, 75 bpm → 0.
//   Recovery:     higher avg HRV = better. 20 ms → 0, 80 ms → 100.
//   Thermal:      lower temp variance = better. SD <0.3°C → 100, >2°C → 0.
// Weights renormalised over present inputs so a missing channel doesn't
// unfairly drag the score. Returns null when no overnight samples at all.
function computeSleepScore(samples: Sample[]): { score: number | null; cardiac: number | null; recovery: number | null; thermal: number | null } {
  const hrs = samples.map((s) => s.hr).filter((v): v is number => typeof v === "number");
  const hrvs = samples.map((s) => s.hrv).filter((v): v is number => typeof v === "number");
  const temps = samples.map((s) => s.tempC).filter((v): v is number => typeof v === "number");

  const clamp = (x: number) => Math.max(0, Math.min(100, x));

  const cardiac = hrs.length >= 3 && min(hrs) != null
    ? Math.round(clamp(((75 - (min(hrs) as number)) / 35) * 100))
    : null;
  const recovery = hrvs.length >= 3 && avg(hrvs) != null
    ? Math.round(clamp((((avg(hrvs) as number) - 20) / 60) * 100))
    : null;
  let thermal: number | null = null;
  if (temps.length >= 3) {
    const mean = (avg(temps) as number);
    const sd = Math.sqrt(temps.reduce((a, b) => a + (b - mean) ** 2, 0) / temps.length);
    thermal = Math.round(clamp((1 - Math.min(sd, 2) / 2) * 100));
  }

  const parts = [
    { v: cardiac, w: 0.45 },
    { v: recovery, w: 0.4 },
    { v: thermal, w: 0.15 },
  ].filter((p) => p.v != null) as { v: number; w: number }[];
  if (!parts.length) return { score: null, cardiac, recovery, thermal };
  const totalW = parts.reduce((a, b) => a + b.w, 0);
  const score = Math.round(parts.reduce((a, b) => a + b.v * b.w, 0) / totalW);
  return { score, cardiac, recovery, thermal };
}

function useOvernightSamples() {
  const m = useLiveMetrics();
  const [buf, setBuf] = useState<Sample[]>(() => loadBuf());
  const lastWriteRef = useRef(0);

  // Capture one sample per ~30s while connected. Throttled writes to LS.
  useEffect(() => {
    if (!m.connected) return;
    const id = window.setInterval(() => {
      const s: Sample = {
        t: Date.now(),
        hr: m.heartRateBpm ?? undefined,
        hrv: m.hrvMs ?? undefined,
        tempC: m.skinTempC ?? undefined,
      };
      if (s.hr == null && s.hrv == null && s.tempC == null) return;
      setBuf((prev) => {
        const next = [...prev, s].slice(-BUF_MAX);
        const now = Date.now();
        if (now - lastWriteRef.current > 10_000) {
          lastWriteRef.current = now;
          saveBuf(next);
        }
        return next;
      });
    }, 30_000);
    return () => window.clearInterval(id);
  }, [m.connected, m.heartRateBpm, m.hrvMs, m.skinTempC]);

  // Filter to overnight samples in the last 12h.
  const overnight = useMemo(() => {
    const cutoff = Date.now() - WINDOW_MS;
    return buf.filter((s) => s.t >= cutoff && NIGHT_HOURS.has(new Date(s.t).getHours()));
  }, [buf]);

  return { samples: overnight, bufSize: buf.length, connected: m.connected };
}

function fmt(n: number | null | undefined, digits = 0, unit = ""): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}${unit}`;
}

export function SleepView() {
  const { samples, bufSize, connected } = useOvernightSamples();
  const { score, cardiac, recovery, thermal } = useMemo(() => computeSleepScore(samples), [samples]);

  const hrs = samples.map((s) => s.hr).filter((v): v is number => typeof v === "number");
  const hrvs = samples.map((s) => s.hrv).filter((v): v is number => typeof v === "number");
  const temps = samples.map((s) => s.tempC).filter((v): v is number => typeof v === "number");

  const minHr = hrs.length ? Math.min(...hrs) : null;
  const avgHr = hrs.length ? hrs.reduce((a, b) => a + b, 0) / hrs.length : null;
  const avgHrv = hrvs.length ? hrvs.reduce((a, b) => a + b, 0) / hrvs.length : null;
  const avgTemp = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null;

  const firstT = samples.length ? samples[0].t : null;
  const lastT = samples.length ? samples[samples.length - 1].t : null;
  const windowLabel = firstT && lastT
    ? `${new Date(firstT).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} → ${new Date(lastT).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : "—";

  return (
    <div className="mx-auto max-w-[430px] space-y-5 pb-8 text-vyro-text">
      <header className="space-y-2">
        <p className="font-mono text-[13px] uppercase tracking-[0.34em] text-vyro-mute">Sleep · Overnight vitals</p>
        <h2 className="text-[26px] font-black leading-tight text-vyro-text">Live sleep score</h2>
        <p className="max-w-[390px] text-[13px] leading-relaxed text-vyro-mute">
          Derived only from BLE heart-rate, HRV and skin-temperature samples
          collected between 10pm and 8am. The firmware does not emit sleep
          stages, so no hypnogram, no wakeups, no debt curves are shown.
        </p>
        <span className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-vyro-text/35 bg-vyro-text/5 px-3 font-mono text-[12px] uppercase tracking-[0.16em] text-vyro-text">
          <Moon className="h-4 w-4" />
          {connected ? "Band live · sampling" : samples.length ? "Last overnight window" : "Awaiting overnight data"}
        </span>
      </header>

      <ScoreCard score={score} cardiac={cardiac} recovery={recovery} thermal={thermal} samples={samples.length} bufSize={bufSize} />

      <VCard>
        <div className="flex items-center justify-between">
          <p className="font-mono text-[12px] uppercase tracking-[0.28em] text-vyro-mute">Overnight window</p>
          <span className="font-mono text-[11px] text-vyro-mute">{windowLabel}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Metric icon={<Heart className="h-4 w-4" />} label="Min HR" value={fmt(minHr, 0)} unit="bpm" />
          <Metric icon={<Heart className="h-4 w-4" />} label="Avg HR" value={fmt(avgHr, 0)} unit="bpm" />
          <Metric icon={<Activity className="h-4 w-4" />} label="Avg HRV" value={fmt(avgHrv, 0)} unit="ms" />
          <Metric icon={<Thermometer className="h-4 w-4" />} label="Avg skin temp" value={fmt(avgTemp, 1)} unit="°C" />
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-vyro-mute">
          Sample count in window: <span className="font-mono text-vyro-text">{samples.length}</span> · Rolling buffer: <span className="font-mono text-vyro-text">{bufSize}</span>
        </p>
      </VCard>

      <VCard>
        <p className="font-mono text-[12px] uppercase tracking-[0.28em] text-vyro-mute">How the score is computed</p>
        <ul className="mt-3 space-y-2 text-[12px] leading-relaxed text-vyro-mute">
          <li><span className="text-vyro-text">Cardiac calm (45%):</span> lower min HR overnight scores higher.</li>
          <li><span className="text-vyro-text">Recovery (40%):</span> higher average HRV scores higher.</li>
          <li><span className="text-vyro-text">Thermal stability (15%):</span> lower skin-temp variance scores higher.</li>
          <li>Weights renormalise over whichever channels actually have data — missing channels are skipped, not invented.</li>
        </ul>
      </VCard>
    </div>
  );
}

function ScoreCard({ score, cardiac, recovery, thermal, samples, bufSize }: {
  score: number | null; cardiac: number | null; recovery: number | null; thermal: number | null;
  samples: number; bufSize: number;
}) {
  return (
    <VCard className="border-vyro-text/42">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <p className="font-mono text-[13px] uppercase tracking-[0.34em] text-vyro-mute">Sleep score</p>
        <MiniBadge>{score != null ? "Live" : "—"}</MiniBadge>
      </div>
      <div className="mt-6 rounded-[20px] border border-vyro-text/25 bg-vyro-ink/35 p-5 text-center">
        <SleepRing value={score} />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        <Sub label="Cardiac" value={cardiac} />
        <Sub label="Recovery" value={recovery} />
        <Sub label="Thermal" value={thermal} />
      </div>
      {samples < 3 && (
        <p className="mt-4 text-[11px] leading-relaxed text-vyro-mute">
          Need at least 3 overnight samples (HR/HRV/temp) to compute a score. Currently have <span className="font-mono text-vyro-text">{samples}</span> in the overnight window
          {bufSize > 0 ? <> (rolling buffer holds {bufSize}).</> : null}
        </p>
      )}
    </VCard>
  );
}

function Sub({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-[14px] border border-vyro-line bg-vyro-panel/70 p-3 text-center">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-vyro-mute">{label}</div>
      <div className="mt-1 text-[20px] font-black tabular-nums text-vyro-text">{value != null ? value : "—"}</div>
    </div>
  );
}

function Metric({ icon, label, value, unit }: { icon: ReactNode; label: string; value: string; unit: string }) {
  return (
    <div className="rounded-[14px] border border-vyro-line bg-vyro-panel/70 p-3">
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-vyro-mute">
        <span className="text-vyro-mute">{icon}</span>
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-[20px] font-black tabular-nums text-vyro-text">{value}</span>
        <span className="text-[11px] font-semibold text-vyro-mute">{unit}</span>
      </div>
    </div>
  );
}

function VCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[22px] border border-vyro-line bg-vyro-panel p-4 ${className}`}>{children}</section>
  );
}

function MiniBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-8 shrink-0 items-center rounded-lg border border-vyro-text/32 bg-vyro-text/8 px-3 font-mono text-[12px] uppercase tracking-[0.16em] text-vyro-text">
      {children}
    </span>
  );
}

function SleepRing({ value }: { value: number | null }) {
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value)) / 100;
  return (
    <div className="mx-auto w-full max-w-[250px]">
      <svg viewBox="0 0 190 190" className="mx-auto h-[190px] w-[190px] -rotate-90 overflow-visible" aria-label={`Sleep score ${value ?? "unknown"} out of 100`}>
        <circle cx="95" cy="95" r={radius} fill="none" stroke="var(--vyro-line)" strokeWidth="12" />
        <circle
          cx="95" cy="95" r={radius}
          fill="none" stroke="var(--vyro-text)" strokeLinecap="round" strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
        />
      </svg>
      <div className="pointer-events-none -mt-[118px] flex h-[118px] flex-col items-center justify-start text-center">
        <span className="text-[34px] font-black leading-none tabular-nums text-vyro-text">{value ?? "—"}</span>
        <span className="mt-3 font-mono text-[14px] text-vyro-mute">/ 100</span>
      </div>
      <p className="mt-2 text-center font-mono text-[12px] uppercase tracking-[0.34em] text-vyro-mute">Sleep</p>
    </div>
  );
}
