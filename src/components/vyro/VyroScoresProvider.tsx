// =============================================================================
// SINGLE SOURCE OF TRUTH for every derived score in the app.
//
// Before this provider existed each screen recomputed recovery/readiness on
// its own (Recovery view used `computeLiveRecovery`, the Sport lens averaged
// recovery with muscle readiness, the Athlete tab used `computeSubScores`),
// which is why the same metric could read 31 on one tab and 87 on another.
//
// Everything is computed ONCE here and consumed via `useVyroScores()`.
// Nothing in this file fabricates data: when the watch has not delivered a
// channel the value stays `null` and the UI must render "—".
// =============================================================================
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/profile.functions";
import { listRecentMetrics, recordMetricSamples } from "@/lib/metrics.functions";
import { useSleepNights } from "@/lib/use-sleep-nights";
import {
  computeLiveRecovery,
  computeReadiness,
  computeSubScores,
  recoveryBand,
  useLiveMetrics,
  type LiveMetrics,
  type LiveRecoveryParts,
  type RecoveryBand,
} from "./useLiveMetrics";

export type SportId = "squash" | "tennis";

export type Baselines = {
  readiness: number | null;
  recovery: number | null;
  restingHr: number | null;
  hrv: number | null;
  reactMs: number | null;
  days: number;
};

export type VyroScores = {
  m: LiveMetrics;
  /** Canonical LIVE Recovery composite — the ONLY recovery number in the app. */
  recovery: number | null;
  parts: LiveRecoveryParts;
  /** Composite readiness (HR + independent live channels). */
  readiness: number | null;
  fatigue: number | null;
  /** How fatigue was derived: motion load or autonomic (HRV/RHR/stress). */
  fatigueSource: "motion" | "autonomic" | null;
  agility: number | null;
  /** Why agility is unavailable, when it is. */
  agilityReason: string | null;
  sleep: number | null;
  strain: number | null;
  sessionLoad: number | null;
  timeToReady: number | null;
  band: RecoveryBand;
  bandTone: "live" | "warn" | "off" | "neutral";
  /** "Ready" / "Manage" / "Recover" / "Calibrating" — derived from `recovery`. */
  statusLabel: string;
  bandLabel: string;
  coachRead: string;
  baselines: Baselines;
  /** RTP validator, computed against the DB readiness baseline. */
  rtp: {
    wearablePower: number | null;
    baseline: number | null;
    deviationPct: number | null;
    withinBaseline: boolean;
    clearance: number | null;
  };
  sport: SportId;
  setSport: (s: SportId) => void;
};

const Ctx = createContext<VyroScores | null>(null);

export function useVyroScores(): VyroScores {
  const v = useContext(Ctx);
  if (!v) throw new Error("useVyroScores must be used inside <VyroScoresProvider />");
  return v;
}

const REACT_KEY = "vyro.reaction.samples.v1";
const SPORT_KEY = "vyro.sport.selected.v1";

function readReactSamples(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(window.localStorage.getItem(REACT_KEY) || "[]");
    return Array.isArray(v) ? v.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function avgOf(rows: { metric: string; avg_value: number | null }[], metric: string): number | null {
  const xs = rows
    .filter((r) => r.metric === metric && r.avg_value != null && Number.isFinite(Number(r.avg_value)))
    .map((r) => Number(r.avg_value));
  if (!xs.length) return null;
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
}

export function VyroScoresProvider({ children }: { children: ReactNode }) {
  const m = useLiveMetrics();
  const { last: lastNight } = useSleepNights();

  // ---- Profile-seeded sport selection (single global source of truth) ------
  const fetchProfile = useServerFn(getMyProfile);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const [sportOverride, setSportOverride] = useState<SportId | null>(() => {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem(SPORT_KEY);
    return v === "squash" || v === "tennis" ? v : null;
  });
  const profileSport: SportId = profile?.sport === "tennis" ? "tennis" : "squash";
  const sport = sportOverride ?? profileSport;
  const setSport = (s: SportId) => {
    setSportOverride(s);
    try {
      window.localStorage.setItem(SPORT_KEY, s);
    } catch {
      /* ignore */
    }
  };

  // ---- Baselines from the database (real 7-day rolling history) -----------
  const fetchRecent = useServerFn(listRecentMetrics);
  const { data: recentRows } = useQuery({
    queryKey: ["recent-metrics", 7],
    queryFn: () => fetchRecent({ data: { days: 7 } }),
    staleTime: 5 * 60_000,
  });
  const rows = (recentRows ?? []) as { day: string; metric: string; avg_value: number | null }[];

  const [reactSamples, setReactSamples] = useState<number[]>(() => readReactSamples());
  useEffect(() => {
    if (!m.connected || m.reactMin == null) return;
    setReactSamples((prev) => {
      const next = [...prev, m.reactMin as number].slice(-50);
      try {
        window.localStorage.setItem(REACT_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [m.connected, m.reactMin]);

  const baselines: Baselines = useMemo(
    () => ({
      readiness: avgOf(rows, "readiness"),
      recovery: avgOf(rows, "recovery"),
      restingHr: avgOf(rows, "resting_hr"),
      hrv: avgOf(rows, "hrv"),
      reactMs: median(reactSamples),
      days: new Set(rows.map((r) => r.day)).size,
    }),
    [rows, reactSamples],
  );

  // ---- Canonical recovery composite --------------------------------------
  const { score: recovery, parts } = useMemo(
    () =>
      computeLiveRecovery({
        connected: m.connected,
        heartRateBpm: m.heartRateBpm,
        restingHrBpm: m.restingHrBpm,
        hrvMs: m.hrvMs,
        spo2Pct: m.spo2Pct,
        skinTempC: m.skinTempC,
        stepsToday: m.stepsToday,
        batteryPct: m.batteryPct,
        peakJerk: m.peakJerk ?? null,
        eventsLastMin: m.eventsLastMin,
        sleepScore: lastNight?.score ?? null,
      }),
    [
      m.connected,
      m.heartRateBpm,
      m.restingHrBpm,
      m.hrvMs,
      m.spo2Pct,
      m.skinTempC,
      m.stepsToday,
      m.batteryPct,
      m.peakJerk,
      m.eventsLastMin,
      lastNight?.score,
    ],
  );

  const readiness = useMemo(
    () =>
      computeReadiness({
        connected: m.connected,
        heartRateBpm: m.heartRateBpm,
        hrvMs: m.hrvMs,
        restingHrBpm: m.restingHrBpm,
        stress: m.stressScore,
        spo2: m.spo2Pct,
        peakJerk: m.peakJerk ?? null,
        sleepScore: lastNight?.score ?? null,
      }).score,
    [
      m.connected,
      m.heartRateBpm,
      m.hrvMs,
      m.restingHrBpm,
      m.stressScore,
      m.spo2Pct,
      m.peakJerk,
      lastNight?.score,
    ],
  );

  const subs = useMemo(
    () =>
      computeSubScores({
        connected: m.connected,
        hrvMs: m.hrvMs,
        restingHrBpm: m.restingHrBpm,
        heartRateBpm: m.heartRateBpm,
        stress: m.stressScore,
        peakJerk: m.peakJerk ?? null,
        peakG: m.peakG ?? null,
        eventsLastMin: m.eventsLastMin,
        reactMin: m.reactMin,
        sleepScore: lastNight?.score ?? null,
        hrvBaselineMs: baselines.hrv,
        restingHrBaseline: baselines.restingHr,
      }),
    [
      m.connected,
      m.hrvMs,
      m.restingHrBpm,
      m.heartRateBpm,
      m.stressScore,
      m.peakJerk,
      m.peakG,
      m.eventsLastMin,
      m.reactMin,
      lastNight?.score,
      baselines.hrv,
      baselines.restingHr,
    ],
  );


  // ---- Strain (accumulated cardiovascular load, TRIMP-style) --------------
  // Instantaneous HR margin made the tile read ~8/100 while resting and whip
  // around with every beat. Strain is a *load* metric: integrate heart-rate
  // reserve over time so it climbs while you're elevated, holds while you rest,
  // and only resets on disconnect.
  const strainAccRef = useRef<{ acc: number; at: number } | null>(null);
  const strainNonce = `${m.heartRateBpm ?? ""}|${m.restingHrBpm ?? ""}|${m.peakJerk ?? ""}|${m.eventsLastMin ?? ""}`;
  const strain = useMemo(() => {
    if (!m.connected) {
      strainAccRef.current = null;
      return null;
    }
    const hr = m.heartRateBpm;
    const rhr = m.restingHrBpm;
    if (hr == null || rhr == null) return strainAccRef.current ? Math.round(strainAccRef.current.acc) : null;
    const maxHr = Math.max(rhr + 60, 190);
    const reserve = Math.min(1, Math.max(0, (hr - rhr) / (maxHr - rhr)));
    const now = Date.now();
    const prev = strainAccRef.current;
    const dtMin = prev ? Math.min(2, Math.max(0, (now - prev.at) / 60_000)) : 0;
    // Banister TRIMP weighting: higher zones cost disproportionately more.
    const trimp = dtMin * reserve * 0.64 * Math.exp(1.92 * reserve);
    // Motion frames, when the firmware provides them, add session intensity.
    const motionBoost =
      (m.peakJerk ?? 0) > 0 || (m.eventsLastMin ?? 0) > 0
        ? dtMin * Math.min(1, (m.eventsLastMin ?? 0) / 80 + (m.peakJerk ?? 0) / 220) * 0.4
        : 0;
    const acc = Math.min(100, (prev?.acc ?? 0) + (trimp + motionBoost) * (100 / 120));
    strainAccRef.current = { acc, at: now };
    return Math.round(acc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.connected, strainNonce]);


  const sessionLoad = useMemo(() => {
    if (!m.connected) return null;
    if ((m.eventsLastMin ?? 0) <= 0 && (m.peakJerk ?? 0) <= 0) return null;
    const base = Math.min(100, (m.eventsLastMin ?? 0) * 1.4);
    const intensity = Math.min(40, (m.peakJerk ?? 0) / 5);
    return Math.round(Math.min(100, base * 0.7 + intensity));
  }, [m.connected, m.eventsLastMin, m.peakJerk]);

  const timeToReady = useMemo(() => {
    if (parts.cardio == null || parts.muscle == null) return null;
    const deficit = (100 - parts.cardio) * 0.4 + (100 - parts.muscle) * 0.6;
    return Math.round(deficit * 0.6);
  }, [parts.cardio, parts.muscle]);

  // ---- One classification used by EVERY status tag in the app -------------
  const band = recoveryBand(recovery);
  const bandTone = band === "green" ? "live" : band === "yellow" ? "warn" : band === "red" ? "off" : "neutral";
  const statusLabel =
    band === "green" ? "Ready" : band === "yellow" ? "Manage" : band === "red" ? "Recover" : "Calibrating";
  const bandLabel =
    band === "green"
      ? "Green — Ready"
      : band === "yellow"
        ? "Yellow — Caution"
        : band === "red"
          ? "Red — Hold"
          : "Calibrating";
  const coachRead =
    band === "green"
      ? "Cleared for a hard session."
      : band === "yellow"
        ? "Train, but manage load."
        : band === "red"
          ? "Hold today. Mobility, breath work, light hitting only."
          : "Wear the band a few more minutes to lock in a reading.";

  // ---- RTP validator against the DB readiness baseline -------------------
  const rtpBaseline = baselines.readiness ?? baselines.recovery;
  const wearablePower = readiness ?? recovery;
  const deviationPct =
    wearablePower != null && rtpBaseline != null && rtpBaseline > 0
      ? ((wearablePower - rtpBaseline) / rtpBaseline) * 100
      : null;
  const rtp = {
    wearablePower,
    baseline: rtpBaseline != null ? Math.round(rtpBaseline) : null,
    deviationPct,
    withinBaseline: deviationPct != null && Math.abs(deviationPct) <= 5,
    clearance: deviationPct != null ? Math.round(Math.max(0, 100 - Math.abs(deviationPct) * 4)) : null,
  };

  // ---- Persist the composites so tomorrow has a real baseline ------------
  const flush = useServerFn(recordMetricSamples);
  const lastPersistRef = useRef(0);
  useEffect(() => {
    if (!m.connected) return;
    if (recovery == null && readiness == null) return;
    const now = Date.now();
    if (now - lastPersistRef.current < 5 * 60_000) return;
    lastPersistRef.current = now;
    const samples: { metric: string; value: number; unit: string; recorded_at: string }[] = [];
    const at = new Date(now).toISOString();
    if (recovery != null) samples.push({ metric: "recovery", value: recovery, unit: "score", recorded_at: at });
    if (readiness != null) samples.push({ metric: "readiness", value: readiness, unit: "score", recorded_at: at });
    if (strain != null) samples.push({ metric: "strain", value: strain, unit: "score", recorded_at: at });
    if (!samples.length) return;
    void flush({ data: { samples } }).catch(() => undefined);
  }, [m.connected, recovery, readiness, strain, flush]);

  const value: VyroScores = {
    m,
    recovery,
    parts,
    readiness,
    fatigue: subs.fatigue,
    fatigueSource: subs.fatigueSource,
    agility: subs.agility,
    agilityReason: subs.agilityReason,
    sleep: lastNight?.score ?? subs.sleep,
    strain,
    sessionLoad,
    timeToReady,
    band,
    bandTone,
    statusLabel,
    bandLabel,
    coachRead,
    baselines,
    rtp,
    sport,
    setSport,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
