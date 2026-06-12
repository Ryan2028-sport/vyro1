import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listMySessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sessions")
      .select("*")
      .eq("user_id", context.userId)
      .order("started_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    return data ?? [];
  });

const StartInput = z.object({ sport: z.string().min(1).max(40) });
export const startSessionRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => StartInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("sessions")
      .insert({ user_id: context.userId, sport: data.sport })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

const EndInput = z.object({
  id: z.string().uuid(),
  swing_count: z.number().int().min(0).max(1_000_000),
  rapid_count: z.number().int().min(0).max(1_000_000),
  burst_count: z.number().int().min(0).max(1_000_000),
  dir_change_count: z.number().int().min(0).max(1_000_000),
});
export const endSessionRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => EndInput.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sessions")
      .update({
        ended_at: new Date().toISOString(),
        swing_count: data.swing_count,
        rapid_count: data.rapid_count,
        burst_count: data.burst_count,
        dir_change_count: data.dir_change_count,
      })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
