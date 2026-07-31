// Real, user-owned training plan blocks. Replaces the hardcoded demo
// "Today's plan" rows that used to live in App2ReferenceShell.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ToneEnum = z.enum(["green", "amber", "red"]);

export const listTrainingPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const day = new Date().toISOString().slice(0, 10);
    const { data, error } = await context.supabase
      .from("training_plan_items")
      .select("id, day, time_label, title, load_label, tone, sport")
      .eq("user_id", context.userId)
      .eq("day", day)
      .order("time_label", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const addTrainingPlanItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        time_label: z.string().max(20).default("TBD"),
        title: z.string().min(1).max(120),
        load_label: z.string().max(80).default(""),
        tone: ToneEnum.default("green"),
        sport: z.string().max(20).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("training_plan_items")
      .insert({
        user_id: context.userId,
        day: new Date().toISOString().slice(0, 10),
        time_label: data.time_label || "TBD",
        title: data.title,
        load_label: data.load_label,
        tone: data.tone,
        sport: data.sport ?? null,
      })
      .select("id, day, time_label, title, load_label, tone, sport")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteTrainingPlanItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("training_plan_items")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
