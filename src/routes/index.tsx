import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  // Skip the marketing landing — first screen is the auth page with
  // "Create account" / "I already have an account" tabs. Authenticated
  // users go straight to the app.
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/app" });
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});

