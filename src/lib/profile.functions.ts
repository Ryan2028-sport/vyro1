import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

const ProfileUpdate = z.object({
  display_name: z.string().min(1).max(80).optional(),
  sport: z.enum(["squash", "tennis"]).optional(),
  handedness: z.enum(["left", "right"]).optional(),
  paired_band_id: z.string().max(120).nullable().optional(),
  paired_band_name: z.string().max(120).nullable().optional(),
  avatar_url: z.string().url().max(500).nullable().optional(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProfileUpdate.parse(input))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("profiles")
      .update(data)
      .eq("id", context.userId)
      .select()
      .maybeSingle();
    if (error) throw error;
    return row;
  });
