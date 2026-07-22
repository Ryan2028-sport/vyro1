import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Sample = z.object({
  metric: z.string().min(1).max(40),
  value: z.number().finite(),
  unit: z.string().max(20).optional().nullable(),
  recorded_at: z.string().datetime().optional(),
  extra: z.record(z.string(), z.any()).optional().nullable(),
});

const SampleBatch = z.object({
  samples: z.array(Sample).min(1).max(500),
});

export const recordMetricSamples = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SampleBatch.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const rows = data.samples.map((s) => ({
      user_id: userId,
      metric: s.metric,
      value: s.value,
      unit: s.unit ?? null,
      extra: s.extra ?? null,
      recorded_at: s.recorded_at ?? new Date().toISOString(),
    }));
    const { error: insErr } = await supabase.from("metric_samples").insert(rows);
    if (insErr) throw insErr;

    // Recompute daily aggregates per (metric, day) that were touched.
    const buckets = new Map<string, { metric: string; day: string }>();
    for (const r of rows) {
      const day = r.recorded_at.slice(0, 10);
      buckets.set(`${r.metric}|${day}`, { metric: r.metric, day });
    }
    for (const { metric, day } of buckets.values()) {
      const dayStart = `${day}T00:00:00.000Z`;
      const nextDay = new Date(new Date(dayStart).getTime() + 86_400_000).toISOString();
      const { data: agg, error: aggErr } = await supabase
        .from("metric_samples")
        .select("value, recorded_at")
        .eq("user_id", userId)
        .eq("metric", metric)
        .gte("recorded_at", dayStart)
        .lt("recorded_at", nextDay)
        .order("recorded_at", { ascending: false })
        .limit(2000);
      if (aggErr) throw aggErr;
      if (!agg || agg.length === 0) continue;
      let min = Infinity, max = -Infinity, sum = 0;
      for (const r of agg) {
        const v = Number(r.value);
        if (v < min) min = v;
        if (v > max) max = v;
        sum += v;
      }
      const avg = sum / agg.length;
      const last = Number(agg[0].value);
      const lastAt = agg[0].recorded_at as string;
      const { error: upErr } = await supabase.from("daily_metrics").upsert(
        {
          user_id: userId,
          day,
          metric,
          min_value: min,
          avg_value: avg,
          max_value: max,
          last_value: last,
          sample_count: agg.length,
          last_recorded_at: lastAt,
        },
        { onConflict: "user_id,day,metric" },
      );
      if (upErr) throw upErr;
    }
    return { ok: true, inserted: rows.length };
  });

export const listRecentMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ days: z.number().int().min(1).max(90).default(14) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString().slice(0, 10);
    const { data: rows, error } = await context.supabase
      .from("daily_metrics")
      .select("day, metric, min_value, avg_value, max_value, last_value, sample_count, last_recorded_at")
      .eq("user_id", context.userId)
      .gte("day", since)
      .order("day", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

const SleepNight = z.object({
  end_at: z.string().datetime(),
  score: z.number().int().min(0).max(100),
  asleep_min: z.number().int().min(0),
  in_bed_min: z.number().int().min(0),
  wakeups: z.number().int().min(0).default(0),
  stages: z.record(z.string(), z.number()).optional().nullable(),
  debt_min: z.number().int().optional().nullable(),
  hypnogram: z.array(z.string()).optional().nullable(),
});

export const saveSleepNight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SleepNight.parse(input))
  .handler(async ({ data, context }) => {
    const day = data.end_at.slice(0, 10);
    const { error } = await context.supabase.from("sleep_nights").upsert(
      {
        user_id: context.userId,
        end_at: data.end_at,
        day,
        score: data.score,
        asleep_min: data.asleep_min,
        in_bed_min: data.in_bed_min,
        wakeups: data.wakeups,
        stages: data.stages ?? null,
        debt_min: data.debt_min ?? null,
        hypnogram: data.hypnogram ?? null,
      },
      { onConflict: "user_id,day" },
    );
    if (error) throw error;
    return { ok: true };
  });

export const listSleepNights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sleep_nights")
      .select("*")
      .eq("user_id", context.userId)
      .order("end_at", { ascending: false })
      .limit(60);
    if (error) throw error;
    return data ?? [];
  });
