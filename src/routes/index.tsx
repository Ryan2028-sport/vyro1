import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Bluetooth, HeartPulse } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  ssr: false,
  head: () => ({
    meta: [
      { title: "VYRO · Athlete Intelligence for Racket Sports" },
      { name: "description", content: "VYRO — tactical performance intelligence for squash and tennis. Pair your band, capture motion, train smarter." },
    ],
  }),
});

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/app", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),transparent_28%),linear-gradient(180deg,#080808,#000)] text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
        <header className="flex items-center justify-between">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-white/70">VYRO</div>
          <Link to="/auth" className="rounded-full border border-white/20 bg-white/[0.06] px-4 py-2 text-xs font-semibold hover:bg-white/[0.12]">
            Sign in
          </Link>
        </header>

        <main className="my-auto py-20">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-emerald-300/80">
            Tactical performance OS · Squash · Tennis
          </p>
          <h1 className="max-w-3xl text-5xl font-black leading-[1.05] sm:text-6xl">
            Own the edge.<br />
            Pair the band. Train smarter.
          </h1>
          <p className="mt-5 max-w-xl text-base text-white/65">
            VYRO turns the nRF54-powered band on your wrist into a live coach — motion events, agility, recovery, and OTA firmware updates, all in one place.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth" className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-black">
              Create your account
            </Link>
            <Link to="/auth" className="rounded-xl border border-white/20 bg-white/[0.04] px-5 py-3 text-sm font-semibold">
              I already have an account
            </Link>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            {[
              { Icon: Bluetooth, t: "Pair in seconds", d: "Pair the band from your profile. Live motion events stream directly into the app." },
              { Icon: Activity, t: "Real metrics", d: "Swing, burst, rapid-start and direction-change events decoded from the band — not demo data." },
              { Icon: HeartPulse, t: "OTA updates", d: "Push signed MCUboot firmware over BLE without leaving the app." },
            ].map(({ Icon, t, d }) => (
              <div key={t} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <Icon className="mb-3 h-5 w-5 text-emerald-300" />
                <div className="text-sm font-semibold">{t}</div>
                <p className="mt-1 text-xs text-white/55">{d}</p>
              </div>
            ))}
          </div>
        </main>

        <footer className="font-mono text-[10px] uppercase tracking-widest text-white/35">
          © VYRO · Athlete Intelligence
        </footer>
      </div>
    </div>
  );
}
