// Uploads Debug-tab diagnostic snapshots to the backend so the state of the
// BLE pipeline can be inspected without the user copy/pasting bundles.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SnapshotInput = z.object({
  kind: z.enum(["full", "live"]).default("full"),
  payload: z.unknown(),
});

export const saveDebugSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SnapshotInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("band_debug_snapshots").insert({
      user_id: context.userId,
      kind: data.kind,
      payload: data.payload as never,
    });
    if (error) throw error;

    // Keep only the most recent 40 snapshots per user.
    const { data: old } = await context.supabase
      .from("band_debug_snapshots")
      .select("id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .range(40, 200);
    const ids = (old ?? []).map((r) => r.id);
    if (ids.length) {
      await context.supabase.from("band_debug_snapshots").delete().in("id", ids);
    }
    return { ok: true };
  });
