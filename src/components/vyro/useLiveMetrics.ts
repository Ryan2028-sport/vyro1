import { useMemo } from "react";
import { useVyroBandCtx } from "./VyroBandProvider";

export type LiveMetrics = ReturnType<typeof useLiveMetrics>;

export function useLiveMetrics() {
  const ctx = useVyroBandCtx();
  const { events, counts, connected, sessionState, ble, pairedId, pairedName, heartRateBpm, heartRateAt, batteryPct, batteryCharging, spo2Pct, skinTempC, stepsToday, distanceM, caloriesKcal, bloodPressure, restingHrBpm, hrvMs, respRateBrpm, stressScore } = ctx;
  const connecting = ble.connectionState === "connecting";

  const derived = useMemo(() => {
    let peakG = 0, peakDps = 0, peakJerk = 0;
    let swingIntMax = 0, swingDurMax = 0;
    let reactMin = Infinity;
    const swingInts: number[] = [];
    const swingDurs: number[] = [];
    const cutoff = Date.now() - 60_000;
    let eventsLastMin = 0;
    for (const e of events) {
      if (e.ts >= cutoff) eventsLastMin++;
      const ev = e.event as any;
      if (ev.accelPeakG?.value != null) peakG = Math.max(peakG, ev.accelPeakG.value);
      if (ev.gyroPeakDps?.value != null) peakDps = Math.max(peakDps, ev.gyroPeakDps.value);
      if (ev.jerkPeakGps?.value != null) peakJerk = Math.max(peakJerk, ev.jerkPeakGps.value);
      if (ev.type === "swing") {
        if (typeof ev.intensity === "number") {
          swingIntMax = Math.max(swingIntMax, ev.intensity);
          swingInts.push(ev.intensity);
        }
        if (typeof ev.durationMs === "number") {
          swingDurMax = Math.max(swingDurMax, ev.durationMs);
          swingDurs.push(ev.durationMs);
        }
      }
      if (ev.type === "direction_change" && typeof ev.gapMs === "number") {
        reactMin = Math.min(reactMin, ev.gapMs);
      }
    }
    const avg = (xs: number[]) =>
      xs.length === 0 ? null : xs.slice(-10).reduce((a, b) => a + b, 0) / Math.min(xs.length, 10);
    return {
      peakG,
      peakDps,
      peakJerk,
      swingIntMax,
      swingDurMax,
      swingIntAvg: avg(swingInts),
      swingDurAvg: avg(swingDurs),
      reactMin: reactMin === Infinity ? null : reactMin,
      eventsLastMin,
    };
  }, [events]);

  return {
    connected,
    connecting,
    sessionState,
    counts,
    events,
    pairedId,
    pairedName,
    heartRateBpm,
    heartRateAt,
    batteryPct,
    batteryCharging,
    spo2Pct,
    skinTempC,
    stepsToday,
    distanceM,
    caloriesKcal,
    bloodPressure,
    restingHrBpm,
    hrvMs,
    respRateBrpm,
    stressScore,
    ...derived,
  };
}

export function fmtNum(
  n: number | null | undefined,
  connected: boolean,
  digits = 0,
  unit = "",
): string {
  if (!connected || n == null) return "—";
  return `${n.toFixed(digits)}${unit}`;
}

// Recovery band classification.
export type RecoveryBand = "green" | "yellow" | "red" | "unknown";

export function recoveryBand(score: number | null): RecoveryBand {
  if (score == null) return "unknown";
  if (score >= 67) return "green";
  if (score >= 34) return "yellow";
  return "red";
}

// Composite readiness (0-100) computed from whatever signals the band
// currently provides. Weights are renormalized over present inputs so
// missing channels don't unfairly drag the score. Returns null until
// at least one weighted input is available.
export type ReadinessInputs = {
  connected: boolean;
  hrvMs?: number | null;
  restingHrBpm?: number | null;
  sleepScore?: number | null;
  recoveryScore?: number | null;
  stress?: number | null;
  spo2?: number | null;
  peakJerk?: number | null;
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function computeReadiness(i: ReadinessInputs): { score: number | null; parts: Record<string, number> } {
  if (!i.connected) return { score: null, parts: {} };
  const parts: Record<string, number> = {};
  const w: Record<string, number> = {};
  if (i.hrvMs != null) { parts.hrv = clamp01((i.hrvMs - 20) / 70); w.hrv = 0.30; }
  if (i.restingHrBpm != null) { parts.rhr = clamp01((70 - i.restingHrBpm) / 25); w.rhr = 0.15; }
  if (i.sleepScore != null) { parts.sleep = clamp01(i.sleepScore / 100); w.sleep = 0.25; }
  if (i.recoveryScore != null) { parts.recovery = clamp01(i.recoveryScore / 100); w.recovery = 0.15; }
  if (i.stress != null) { parts.stress = clamp01(1 - i.stress / 100); w.stress = 0.08; }
  if (i.spo2 != null) { parts.spo2 = clamp01((i.spo2 - 92) / 7); w.spo2 = 0.04; }
  if (i.peakJerk != null && i.peakJerk > 0) {
    parts.load = clamp01(1 - Math.min(i.peakJerk, 200) / 200);
    w.load = 0.03;
  }
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  if (total === 0) return { score: null, parts: {} };
  let sum = 0;
  for (const k in w) sum += parts[k] * w[k];
  return { score: Math.round((sum / total) * 100), parts };
}

// Live "base readiness" subscores derived from whatever the band is
// streaming right now. Each one is null until at least one underlying
// signal is available; HomeView falls back to demo values when null so
// the UI stays populated, then swaps to live as soon as data arrives.
export type SubScores = {
  fatigue: number | null;   // 0-100, higher = MORE fatigued
  recovery: number | null;  // 0-100
  agility: number | null;   // 0-100
  sleep: number | null;     // 0-100
};

export type SubScoreInputs = {
  connected: boolean;
  hrvMs?: number | null;
  restingHrBpm?: number | null;
  sleepScore?: number | null;
  stress?: number | null;
  peakJerk?: number | null;
  peakG?: number | null;
  eventsLastMin?: number | null;
  reactMin?: number | null;       // ms — lower = sharper
  recentSessionLoad?: number | null; // 0-200
};

export function computeSubScores(i: SubScoreInputs): SubScores {
  if (!i.connected) return { fatigue: null, recovery: null, agility: null, sleep: null };

  // Fatigue — accumulated load + stress, capped so a single big spike
  // doesn't pin the bar.
  const loadParts: number[] = [];
  if (i.peakJerk != null) loadParts.push(clamp01(i.peakJerk / 200));
  if (i.eventsLastMin != null) loadParts.push(clamp01(i.eventsLastMin / 90));
  if (i.recentSessionLoad != null) loadParts.push(clamp01(i.recentSessionLoad / 120));
  if (i.stress != null) loadParts.push(clamp01(i.stress / 100));
  const fatigue = loadParts.length
    ? Math.round((loadParts.reduce((a, b) => a + b, 0) / loadParts.length) * 100)
    : null;

  // Recovery — HRV + resting HR + (1 - stress). Sleep folds into its own
  // ring rather than double-counting here.
  const recParts: { v: number; w: number }[] = [];
  if (i.hrvMs != null) recParts.push({ v: clamp01((i.hrvMs - 20) / 70), w: 0.5 });
  if (i.restingHrBpm != null) recParts.push({ v: clamp01((70 - i.restingHrBpm) / 25), w: 0.3 });
  if (i.stress != null) recParts.push({ v: clamp01(1 - i.stress / 100), w: 0.2 });
  const recW = recParts.reduce((a, b) => a + b.w, 0);
  const recovery = recW > 0
    ? Math.round((recParts.reduce((a, b) => a + b.v * b.w, 0) / recW) * 100)
    : null;

  // Agility — IMU explosiveness (peak g) + reaction speed.
  const agParts: number[] = [];
  if (i.peakG != null && i.peakG > 0) agParts.push(clamp01(i.peakG / 6));
  if (i.reactMin != null) agParts.push(clamp01(1 - Math.min(i.reactMin, 400) / 400));
  const agility = agParts.length
    ? Math.round((agParts.reduce((a, b) => a + b, 0) / agParts.length) * 100)
    : null;

  // Sleep — passed through from the sleep engine when present.
  const sleep = i.sleepScore != null ? Math.round(clamp01(i.sleepScore / 100) * 100) : null;

  return { fatigue, recovery, agility, sleep };
}
