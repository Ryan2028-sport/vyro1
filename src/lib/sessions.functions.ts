import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SaveSession = z.object({
  sport: z.string().min(1).max(40),
  started_at: z.string(),
  ended_at: z.string(),
  swing_count: z.number().int().min(0),
  rapid_count: z.number().int().min(0),
  burst_count: z.number().int().min(0),
  dir_change_count: z.number().int().min(0),
  summary: z.record(z.string(), z.any()).optional().nullable(),
});

export const saveSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveSession.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("sessions")
      .insert({ ...data, user_id: context.userId })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const getMySessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sessions")
      .select("*")
      .eq("user_id", context.userId)
      .order("started_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  });
