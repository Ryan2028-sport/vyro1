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

// =============================================================================
// Canonical LIVE Recovery composite — SINGLE source of truth used by both the
// Recovery view (big ring) and the Sport view (Readiness lens). Returns null
// when there isn't enough real signal from the watch; callers MUST render "—"
// in that case rather than substituting demo data.
// =============================================================================
export type LiveRecoveryInputs = {
  connected: boolean;
  heartRateBpm?: number | null;
  restingHrBpm?: number | null;
  hrvMs?: number | null;
  spo2Pct?: number | null;
  skinTempC?: number | null;
  stepsToday?: number | null;
  batteryPct?: number | null;
  peakJerk?: number | null;
  eventsLastMin?: number | null;
  sleepScore?: number | null;
  wearTimeOk?: boolean | null;
};

export type LiveRecoveryParts = {
  cardio: number | null;
  muscle: number | null;
  loadDebt: number | null;
  environment: number | null;
  confidence: number | null;
};

// LIVE Recovery — weighted composite per spec:
//   Cardio Recovery (25%)
//   Muscle Readiness (25%)
//   Load Debt (20%)
//   Recovery Environment (15%)
//   Signal Confidence (15%)
// Signal Confidence is the trust layer (HR/HRV, IMU load, skin temp,
// sleep, wear-time). It widens the caution band; it is NOT another
// fatigue source. Weights renormalise over present subscores so a
// missing channel doesn't unfairly drag the score.
export function computeLiveRecovery(i: LiveRecoveryInputs): {
  score: number | null;
  parts: LiveRecoveryParts;
} {
  // Cardio Recovery — current HR vs resting headroom. Lower headroom = better.
  const cardio = i.heartRateBpm == null ? null : (() => {
    const rhr = i.restingHrBpm ?? 60;
    const headroom = Math.max(0, (i.heartRateBpm as number) - rhr);
    return Math.round(Math.max(0, Math.min(100, 100 - (headroom / 60) * 100)));
  })();

  // Muscle Readiness — IMU jerk + recent event load.
  const muscle = !i.connected ? null : (() => {
    const jerkPenalty = Math.min(60, (i.peakJerk ?? 0) / 4);
    const eventPenalty = Math.min(40, (i.eventsLastMin ?? 0) * 0.6);
    return Math.round(Math.max(0, 100 - jerkPenalty - eventPenalty));
  })();

  // Load Debt — accumulated session load. Higher load = lower readiness.
  const loadDebt = !i.connected ? null : (() => {
    const base = Math.min(100, (i.eventsLastMin ?? 0) * 1.5);
    const intensity = Math.min(30, (i.peakJerk ?? 0) / 6);
    return Math.round(Math.max(0, 100 - Math.min(100, base * 0.7 + intensity)));
  })();

  // Recovery Environment — SpO₂, skin temp deviation, HRV.
  const envParts: number[] = [];
  if (i.spo2Pct != null) envParts.push(Math.max(0, Math.min(100, ((i.spo2Pct - 92) / 7) * 100)));
  if (i.skinTempC != null) {
    const dev = Math.abs(i.skinTempC - 33.5);
    envParts.push(Math.max(0, 100 - dev * 25));
  }
  if (i.hrvMs != null) envParts.push(Math.max(0, Math.min(100, ((i.hrvMs - 20) / 70) * 100)));
  const environment = envParts.length === 0
    ? null
    : Math.round(envParts.reduce((a, b) => a + b, 0) / envParts.length);

  // Signal Confidence — trust layer over the 5 named channels:
  //   HR/HRV · IMU load · skin temp · sleep · wear-time.
  // Each channel contributes equally (20%). Wear-time defaults to TRUE
  // whenever the band is currently connected and streaming.
  const channels = [
    i.heartRateBpm != null || i.hrvMs != null,            // HR / HRV
    i.connected && (i.peakJerk != null || (i.eventsLastMin ?? 0) > 0), // IMU load
    i.skinTempC != null,                                   // skin temp
    i.sleepScore != null,                                  // sleep
    i.wearTimeOk ?? i.connected,                           // wear-time
  ];
  const present = channels.filter(Boolean).length;
  // No channels → confidence is unknown, NOT zero. A "0" confidence reading
  // would otherwise pollute the composite when the band is offline.
  const confidence = present === 0 ? null : Math.round((present / channels.length) * 100);

  const parts: LiveRecoveryParts = { cardio, muscle, loadDebt, environment, confidence };

  // Per-spec weights. Renormalised over present subscores.
  const weighted: { v: number | null; w: number }[] = [
    { v: cardio, w: 0.25 },
    { v: muscle, w: 0.25 },
    { v: loadDebt, w: 0.20 },
    { v: environment, w: 0.15 },
    { v: confidence, w: 0.15 },
  ];
  // Confidence is the trust layer — it must NOT drive the score on its own.
  // Require at least one real fatigue subscore (cardio / muscle / loadDebt /
  // environment) before publishing a number; otherwise the ring shows "—".
  const fatigueScores = [cardio, muscle, loadDebt, environment].filter((v) => v != null);
  if (fatigueScores.length === 0) return { score: null, parts };
  const presentScores = weighted.filter((p) => p.v != null);
  const totalW = presentScores.reduce((a, b) => a + b.w, 0);
  const sum = presentScores.reduce((a, b) => a + (b.v as number) * b.w, 0);
  return { score: Math.round(sum / totalW), parts };
}

export function liveRecoveryFromMetrics(m: {
  connected: boolean;
  heartRateBpm?: number | null;
  restingHrBpm?: number | null;
  hrvMs?: number | null;
  spo2Pct?: number | null;
  skinTempC?: number | null;
  stepsToday?: number | null;
  batteryPct?: number | null;
  peakJerk?: number | null;
  eventsLastMin?: number | null;
}) {
  return computeLiveRecovery({
    connected: m.connected,
    heartRateBpm: m.heartRateBpm,
    restingHrBpm: m.restingHrBpm,
    hrvMs: m.hrvMs,
    spo2Pct: m.spo2Pct,
    skinTempC: m.skinTempC,
    stepsToday: m.stepsToday,
    batteryPct: m.batteryPct,
    peakJerk: m.peakJerk,
    eventsLastMin: m.eventsLastMin,
  });
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
  const hasCachedHealthSignal =
    i.hrvMs != null ||
    i.restingHrBpm != null ||
    i.sleepScore != null ||
    i.stress != null;
  if (!i.connected && !hasCachedHealthSignal) return { fatigue: null, recovery: null, agility: null, sleep: null };

  // Fatigue — accumulated load + stress, capped so a single big spike
  // doesn't pin the bar.
  const loadParts: number[] = [];
  if (i.connected && i.peakJerk != null) loadParts.push(clamp01(i.peakJerk / 200));
  if (i.connected && i.eventsLastMin != null) loadParts.push(clamp01(i.eventsLastMin / 90));
  if (i.connected && i.recentSessionLoad != null) loadParts.push(clamp01(i.recentSessionLoad / 120));
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
  if (i.connected && i.peakG != null && i.peakG > 0) agParts.push(clamp01(i.peakG / 6));
  if (i.connected && i.reactMin != null) agParts.push(clamp01(1 - Math.min(i.reactMin, 400) / 400));
  const agility = agParts.length
    ? Math.round((agParts.reduce((a, b) => a + b, 0) / agParts.length) * 100)
    : null;

  // Sleep — passed through from the sleep engine when present.
  const sleep = i.sleepScore != null ? Math.round(clamp01(i.sleepScore / 100) * 100) : null;

  return { fatigue, recovery, agility, sleep };
}
