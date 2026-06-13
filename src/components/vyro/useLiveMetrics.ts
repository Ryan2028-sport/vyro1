import { useMemo } from "react";
import { useVyroBandCtx } from "./VyroBandProvider";

export type LiveMetrics = ReturnType<typeof useLiveMetrics>;

export function useLiveMetrics() {
  const ctx = useVyroBandCtx();
  const { events, counts, connected, sessionState, ble, pairedId, pairedName } = ctx;
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

// Recovery band classification. Until the band emits HRV/sleep, this stays at
// "unknown" — UI shows it as a yellow caution chip rather than fake green.
export type RecoveryBand = "green" | "yellow" | "red" | "unknown";

export function recoveryBand(score: number | null): RecoveryBand {
  if (score == null) return "unknown";
  if (score >= 67) return "green";
  if (score >= 34) return "yellow";
  return "red";
}
