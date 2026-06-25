import { useEffect, useMemo, useState } from "react";
import { useVyroBandCtx } from "./VyroBandProvider";

export type LiveMetrics = ReturnType<typeof useLiveMetrics>;

export function useLiveMetrics() {
  const ctx = useVyroBandCtx();
  const { events, counts, connected, sessionState, ble, pairedId, pairedName, heartRateBpm, heartRateAt, batteryPct, batteryCharging, spo2Pct, skinTempC, stepsToday, distanceM, caloriesKcal, bloodPressure, restingHrBpm, hrvMs, respRateBrpm, stressScore, signalAt } = ctx;
  const connecting = ble.connectionState === "connecting";
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!connected) return;
    const id = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(id);
  }, [connected]);

  const currentTime = Math.max(now, Date.now());
  const isFresh = (at: number | null | undefined, maxAgeMs: number) =>
    connected && at != null && currentTime - at >= 0 && currentTime - at <= maxAgeMs;

  const liveHeartRateBpm = isFresh(heartRateAt, 15_000) ? heartRateBpm : null;
  const liveHeartRateAt = liveHeartRateBpm == null ? null : heartRateAt;
  const liveBatteryPct = isFresh(signalAt.batteryAt, 5 * 60_000) ? batteryPct : null;
  const liveBatteryCharging = liveBatteryPct != null && batteryCharging;
  const liveSpo2Pct = isFresh(signalAt.spo2At, 20 * 60_000) ? spo2Pct : null;
  const liveSkinTempC = isFresh(signalAt.skinTempAt, 20 * 60_000) ? skinTempC : null;
  const liveStepsToday = isFresh(signalAt.stepsAt, 2 * 60_000) ? stepsToday : null;
  const liveDistanceM = isFresh(signalAt.distanceAt, 2 * 60_000) ? distanceM : null;
  const liveCaloriesKcal = isFresh(signalAt.caloriesAt, 2 * 60_000) ? caloriesKcal : null;
  const liveBloodPressure = isFresh(signalAt.bloodPressureAt, 20 * 60_000) ? bloodPressure : null;
  const liveRestingHrBpm = isFresh(signalAt.restingHrAt, 5 * 60_000) ? restingHrBpm : null;
  const liveHrvMs = isFresh(signalAt.hrvAt, 20 * 60_000) ? hrvMs : null;
  const liveStressScore = isFresh(signalAt.stressAt, 20 * 60_000) ? stressScore : null;

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
    heartRateBpm: liveHeartRateBpm,
    heartRateAt: liveHeartRateAt,
    batteryPct: liveBatteryPct,
    batteryCharging: liveBatteryCharging,
    spo2Pct: liveSpo2Pct,
    skinTempC: liveSkinTempC,
    stepsToday: liveStepsToday,
    distanceM: liveDistanceM,
    caloriesKcal: liveCaloriesKcal,
    bloodPressure: liveBloodPressure,
    restingHrBpm: liveRestingHrBpm,
    hrvMs: liveHrvMs,
    respRateBrpm,
    stressScore: liveStressScore,
    signalAt,
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
  if (!i.connected) {
    return {
      score: null,
      parts: { cardio: null, muscle: null, loadDebt: null, environment: null, confidence: null },
    };
  }

  // Cardio Recovery — current HR vs resting headroom. Lower headroom = better.
  // Require both HR and resting HR; a hardcoded fallback RHR creates nonsense
  // scores for real athletes.
  const cardio = i.heartRateBpm == null || i.restingHrBpm == null ? null : (() => {
    const headroom = Math.max(0, (i.heartRateBpm as number) - i.restingHrBpm!);
    return Math.round(Math.max(0, Math.min(100, 100 - (headroom / 60) * 100)));
  })();

  // Muscle Readiness — IMU jerk + recent event load.
  const hasImuLoad = i.peakJerk != null || (i.eventsLastMin ?? 0) > 0;
  const muscle = !hasImuLoad ? null : (() => {
    const jerkPenalty = Math.min(60, (i.peakJerk ?? 0) / 4);
    const eventPenalty = Math.min(40, (i.eventsLastMin ?? 0) * 0.6);
    return Math.round(Math.max(0, 100 - jerkPenalty - eventPenalty));
  })();

  // Load Debt — accumulated session load. Higher load = lower readiness.
  const loadDebt = !hasImuLoad ? null : (() => {
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
  heartRateBpm?: number | null;
  hrvMs?: number | null;
  restingHrBpm?: number | null;
  sleepScore?: number | null;
  recoveryScore?: number | null;
  stress?: number | null;
  spo2?: number | null;
  peakJerk?: number | null;
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const clamp100 = (x: number) => Math.max(0, Math.min(100, x));

function hrvReadinessScore(hrvMs: number): number {
  if (hrvMs < 20) return clamp100((hrvMs / 20) * 30);
  if (hrvMs < 40) return clamp100(30 + (hrvMs - 20) * 1.75);
  if (hrvMs < 80) return clamp100(65 + (hrvMs - 40) * 0.75);
  return clamp100(95 + Math.min(5, (hrvMs - 80) * 0.1));
}

function restingHrReadinessScore(restingHrBpm: number): number {
  if (restingHrBpm <= 45) return 95;
  if (restingHrBpm <= 65) return clamp100(95 - (restingHrBpm - 45) * 1.25);
  if (restingHrBpm <= 85) return clamp100(70 - (restingHrBpm - 65) * 1.8);
  return clamp100(34 - (restingHrBpm - 85) * 2.2);
}

function stressReadinessScore(stress: number): number {
  if (stress <= 30) return clamp100(95 - stress * 0.4);
  if (stress <= 70) return clamp100(83 - (stress - 30) * 0.9);
  return clamp100(47 - (stress - 70) * 1.25);
}

function spo2ReadinessScore(spo2: number): number {
  if (spo2 >= 98) return 100;
  if (spo2 >= 95) return clamp100(78 + (spo2 - 95) * 7);
  if (spo2 >= 92) return clamp100(42 + (spo2 - 92) * 12);
  return clamp100((spo2 - 85) * 6);
}

function heartLoadReadinessScore(heartRateBpm: number, restingHrBpm: number): number {
  const headroom = Math.max(0, heartRateBpm - restingHrBpm);
  if (headroom <= 15) return clamp100(96 - headroom * 1.2);
  if (headroom <= 45) return clamp100(78 - (headroom - 15) * 1.55);
  return clamp100(32 - (headroom - 45) * 1.1);
}

export function computeReadiness(i: ReadinessInputs): { score: number | null; parts: Record<string, number> } {
  if (!i.connected || i.heartRateBpm == null) return { score: null, parts: {} };
  const parts: Record<string, number> = {};
  const w: Record<string, number> = {};
  if (i.hrvMs != null) { parts.hrv = hrvReadinessScore(i.hrvMs) / 100; w.hrv = 0.24; }
  if (i.restingHrBpm != null) { parts.rhr = restingHrReadinessScore(i.restingHrBpm) / 100; w.rhr = 0.14; }
  if (i.heartRateBpm != null && i.restingHrBpm != null) { parts.hrLoad = heartLoadReadinessScore(i.heartRateBpm, i.restingHrBpm) / 100; w.hrLoad = 0.16; }
  if (i.sleepScore != null) { parts.sleep = clamp01(i.sleepScore / 100); w.sleep = 0.18; }
  if (i.recoveryScore != null) { parts.recovery = clamp01(i.recoveryScore / 100); w.recovery = 0.12; }
  if (i.stress != null) { parts.stress = stressReadinessScore(i.stress) / 100; w.stress = 0.12; }
  if (i.spo2 != null) { parts.spo2 = spo2ReadinessScore(i.spo2) / 100; w.spo2 = 0.06; }
  if (i.peakJerk != null && i.peakJerk > 0) {
    parts.load = clamp01(1 - Math.min(i.peakJerk, 200) / 200);
    w.load = 0.08;
  }
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  // Do not publish a readiness score from sparse / stale inputs (for example
  // HRV + stress only → a convincing but meaningless number). A real readiness
  // number needs live HR plus multiple current hardware factors; HR-derived
  // RHR and HR-load alone do not count as enough independent evidence.
  const independentSignals = [
    i.hrvMs != null,
    i.stress != null,
    i.spo2 != null,
    i.sleepScore != null,
    i.recoveryScore != null,
    i.peakJerk != null && i.peakJerk > 0,
  ].filter(Boolean).length;
  if (Object.keys(w).length < 4 || independentSignals < 3 || total === 0) return { score: null, parts };
  let sum = 0;
  for (const k in w) sum += parts[k] * w[k];
  return { score: Math.round((sum / total) * 100), parts };
}

// Live "base readiness" subscores derived only from the current live band
// connection. Cached/persisted readings must never publish a score.
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
