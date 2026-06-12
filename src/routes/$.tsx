import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/$")({
  component: CatchAllRedirect,
  ssr: false,
  head: () => ({
    meta: [
      { title: "VYRO" },
      { name: "description", content: "Sign in or create your VYRO athlete account." },
    ],
  }),
});

function CatchAllRedirect() {
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