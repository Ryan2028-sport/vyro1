import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in · VYRO" },
      { name: "description", content: "Sign in or create your VYRO athlete account." },
    ],
  }),
});

// Supabase requires an email. We synthesize a stable pseudo-email from the
// username so the user only ever sees username + password.
const USERNAME_DOMAIN = "vyro.local";
const usernameToEmail = (u: string) => `${u.trim().toLowerCase()}@${USERNAME_DOMAIN}`;
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,24}$/;

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/app" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (!USERNAME_RE.test(username)) {
        throw new Error("Username must be 3–24 chars: letters, numbers, . _ -");
      }
      const email = usernameToEmail(username);
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/app",
            data: { full_name: username, username },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/app" });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-svh bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),transparent_28%),linear-gradient(180deg,#080808,#000)] text-white">
      <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-5 py-10">
        <Link to="/" className="mb-8 self-start font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">
          ← VYRO
        </Link>
        <h1 className="text-3xl font-black">{mode === "signin" ? "Sign in" : "Create account"}</h1>
        <p className="mt-1 text-sm text-white/55">
          {mode === "signin" ? "Welcome back, athlete." : "Pick a username to build your athlete profile."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            required
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-sm outline-none focus:border-white/40"
          />
          <input
            required
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-sm outline-none focus:border-white/40"
          />
          {err && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-xs text-red-200">
              {err}
            </div>
          )}
          <button
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-black disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => {
            setErr(null);
            setMode(mode === "signin" ? "signup" : "signin");
          }}
          className="mt-5 text-center text-xs text-white/55 hover:text-white"
        >
          {mode === "signin" ? "Don't have an account? Create one" : "Already registered? Sign in"}
        </button>
      </div>
    </div>
  );
}
