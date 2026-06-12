import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
  ssr: false,
  head: () => ({
    meta: [
      { title: "VYRO" },
      { name: "description", content: "Sign in or create your VYRO athlete account." },
    ],
  }),
});

// Root URL is a thin redirect to /auth (or /app if signed in). We do it from
// the component with a visible loader so users never see a blank shell or a
// 404 flash while the auth check runs.
function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      navigate({ to: data.user ? "/app" : "/auth", replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-vyro-canvas text-gray-600">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}
