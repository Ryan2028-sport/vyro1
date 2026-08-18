import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ClipInputSchema, type SquashInsight, type VerifiedCounts } from "./video-analysis-core";
import { runClipAnalysis } from "./video-analysis.server";

export type { SquashInsight } from "./video-analysis-core";

export const analyzeSquashClip = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ClipInputSchema.parse(d))
  .handler(
    async ({
      data,
    }): Promise<{ insight: SquashInsight | null; verified: VerifiedCounts | null; error: string | null }> =>
      runClipAnalysis(data),
  );


export const saveVideoAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        video_name: z.string().min(1).max(255),
        duration_sec: z.number().min(0).max(60 * 60 * 3),
        insight: z.record(z.string(), z.any()),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("video_analyses")
      .insert({ ...data, user_id: context.userId })
      .select("id, video_name, duration_sec, insight, created_at")
      .single();
    if (error) throw error;
    return row;
  });

export const listVideoAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("video_analyses")
      .select("id, video_name, duration_sec, insight, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw error;
    return data ?? [];
  });
