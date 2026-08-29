import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns the signed-in user's roles. Also self-heals: if the account's email
 * (or its local part) is on the debug allowlist, the admin role is granted once.
 * Roles live in public.user_roles and are never writable from the client.
 */
export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = String((context.claims as { email?: string } | null)?.email ?? "").toLowerCase();
    const localPart = email.includes("@") ? email.split("@")[0] : email;

    let roles: string[] = [];
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      if (email) {
        const { data: allow } = await supabaseAdmin
          .from("debug_access_allowlist")
          .select("identifier")
          .in("identifier", [email, localPart].filter(Boolean));
        if (allow && allow.length > 0) {
          await supabaseAdmin
            .from("user_roles")
            .upsert({ user_id: context.userId, role: "admin" }, { onConflict: "user_id,role" });
        }
      }

      const { data } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId);
      roles = (data ?? []).map((r) => String(r.role));
    } catch {
      const { data } = await context.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId);
      roles = (data ?? []).map((r) => String(r.role));
    }

    return { roles, isAdmin: roles.includes("admin") };
  });
