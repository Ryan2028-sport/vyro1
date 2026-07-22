// Persists live watch metrics into the database on a schedule while the
// band is connected. Batches ~30s of samples so we don't spam the API,
// and only sends values that actually changed since the last flush.
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { recordMetricSamples } from "@/lib/metrics.functions";
import { useVyroBandCtx } from "./VyroBandProvider";

type Sample = {
  metric: string;
  value: number;
  unit?: string | null;
  recorded_at: string;
  extra?: Record<string, unknown> | null;
};

const FLUSH_MS = 30_000;

export function useMetricsPersistence() {
  const ctx = useVyroBandCtx();
  const flush = useServerFn(recordMetricSamples);
  const queueRef = useRef<Sample[]>([]);
  const lastRef = useRef<Record<string, { value: number; at: number }>>({});

  // Sampler — every 5s snapshot current context values.
  useEffect(() => {
    if (!ctx.connected) return;
    const sample = () => {
      const now = Date.now();
      const push = (metric: string, value: number | null | undefined, unit: string | null, at: number | null | undefined, minGapMs = 60_000, minDelta = 0) => {
        if (value == null || !Number.isFinite(value)) return;
        const stamp = at ?? now;
        const prev = lastRef.current[metric];
        if (prev && stamp - prev.at < minGapMs && Math.abs(prev.value - value) <= minDelta) return;
        lastRef.current[metric] = { value, at: stamp };
        queueRef.current.push({
          metric,
          value,
          unit,
          recorded_at: new Date(stamp).toISOString(),
        });
      };
      push("heart_rate", ctx.heartRateBpm, "bpm", ctx.heartRateAt, 20_000, 1);
      push("hrv", ctx.hrvMs, "ms", ctx.signalAt.hrvAt, 5 * 60_000, 1);
      push("spo2", ctx.spo2Pct, "%", ctx.signalAt.spo2At, 5 * 60_000, 0.5);
      push("skin_temp", ctx.skinTempC, "C", ctx.signalAt.skinTempAt, 5 * 60_000, 0.1);
      push("stress", ctx.stressScore, "score", ctx.signalAt.stressAt, 5 * 60_000, 2);
      push("resting_hr", ctx.restingHrBpm, "bpm", ctx.signalAt.restingHrAt, 15 * 60_000, 1);
      push("steps", ctx.stepsToday, "count", ctx.signalAt.stepsAt, 5 * 60_000, 50);
      push("distance", ctx.distanceM, "m", ctx.signalAt.distanceAt, 5 * 60_000, 20);
      push("calories", ctx.caloriesKcal, "kcal", ctx.signalAt.caloriesAt, 5 * 60_000, 5);
      push("respiration", ctx.respRateBrpm, "brpm", null, 5 * 60_000, 1);
      if (ctx.bloodPressure && ctx.signalAt.bloodPressureAt) {
        const bp = ctx.bloodPressure as { systolic?: number; diastolic?: number };
        push("bp_systolic", bp.systolic ?? null, "mmHg", ctx.signalAt.bloodPressureAt, 5 * 60_000, 1);
        push("bp_diastolic", bp.diastolic ?? null, "mmHg", ctx.signalAt.bloodPressureAt, 5 * 60_000, 1);
      }
      if (ctx.batteryPct != null) {
        push("battery", ctx.batteryPct, "%", ctx.signalAt.batteryAt, 15 * 60_000, 2);
      }
    };
    sample();
    const id = window.setInterval(sample, 5_000);
    return () => window.clearInterval(id);
  }, [ctx]);

  // Flusher — every 30s send the queue.
  useEffect(() => {
    const send = async () => {
      const batch = queueRef.current.splice(0, queueRef.current.length);
      if (batch.length === 0) return;
      try {
        await flush({ data: { samples: batch } });
      } catch {
        // On error, re-queue so we retry next tick (cap to avoid unbounded growth).
        queueRef.current = [...batch, ...queueRef.current].slice(-1000);
      }
    };
    const id = window.setInterval(send, FLUSH_MS);
    const onHide = () => { void send(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      void send();
    };
  }, [flush]);
}
