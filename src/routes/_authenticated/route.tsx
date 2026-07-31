import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Read the locally persisted session first. This never depends on the
    // network, so a flaky connection can no longer blank the whole app.
    let session = null;
    try {
      const { data } = await supabase.auth.getSession();
      session = data.session ?? null;
    } catch (err) {
      console.warn("[auth] getSession failed, falling back to network check", err);
    }

    if (session?.user) return { user: session.user };

    // No local session: confirm with the server, but treat a network failure
    // as "unknown" rather than crashing the route.
    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) return { user: data.user };
    } catch (err) {
      console.warn("[auth] getUser failed", err);
    }

    throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center text-sm opacity-60">
      Loading…
    </div>
  ),
  errorComponent: ({ error }: { error: Error }) => {
    console.error(error);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-base font-semibold">We couldn’t load your dashboard</p>
        <p className="max-w-sm text-sm opacity-70">{error?.message ?? "Unknown error"}</p>
        <button
          type="button"
          className="rounded-lg border px-4 py-2 text-sm"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  },
});
