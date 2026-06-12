import type { ReactNode } from "react";
import {
  Activity,
  Apple,
  Bell,
  Dumbbell,
  HeartPulse,
  Home,
  Moon,
  Share2,
  TrendingUp,
  Trophy,
  User,
  Video,
} from "lucide-react";
import type { ViewId } from "@/lib/vyro-data";
import { viewTitles } from "@/lib/vyro-data";
import { Pill } from "./shared";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/profile.functions";

const navItems: { id: ViewId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Athlete", icon: Home },
  { id: "trends", label: "Trends", icon: TrendingUp },
  { id: "session", label: "Session", icon: Activity },
  { id: "sport", label: "Sport", icon: Trophy },
  { id: "recovery", label: "Recovery", icon: HeartPulse },
  { id: "sleep", label: "Sleep", icon: Moon },
  { id: "coach", label: "Coach", icon: Dumbbell },
  { id: "social", label: "Social", icon: Share2 },
  { id: "video", label: "AI Video", icon: Video },
  { id: "diet", label: "Diet Coach", icon: Apple },
  { id: "profile", label: "Profile & Band", icon: User },
];

const topMobile: ViewId[] = ["trends", "session", "coach", "profile"];
const bottomMobile: ViewId[] = ["home", "sport", "recovery", "sleep"];

function Logo({ className = "h-16" }: { className?: string }) {
  return (
    <div className={`${className} flex flex-col justify-center`}>
      <svg viewBox="0 0 210 70" className="h-full w-[150px] text-white">
        <path d="M4 34h45l8-19 10 38 12-27 8 8h119" fill="none" stroke="currentColor" strokeWidth="4" />
        <text x="2" y="62" fill="currentColor" fontSize="24" fontFamily="monospace" letterSpacing="12">VYRO</text>
        <text x="76" y="69" fill="currentColor" fontSize="8" fontFamily="monospace" letterSpacing="2">OWN THE EDGE</text>
      </svg>
    </div>
  );
}

function ProfileChip({ onClick }: { onClick: () => void }) {
  const fetchProfile = useServerFn(getMyProfile);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const name = profile?.display_name || "Athlete";
  const initials = name.split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase() || "VY";
  const sport = profile?.sport ? profile.sport[0].toUpperCase() + profile.sport.slice(1) : "—";
  return (
    <button onClick={onClick} className="mt-auto w-full rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-left hover:bg-white/[0.08]">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/10 text-xs font-black">{initials}</div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{name}</div>
          <div className="font-mono text-[10px] text-white/45">{sport} · {profile?.paired_band_name || "no band"}</div>
        </div>
      </div>
    </button>
  );
}

export function Layout({
  activeView,
  setView,
  children,
}: {
  activeView: ViewId;
  setView: (v: ViewId) => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),transparent_28%),linear-gradient(180deg,#080808,#000)] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col lg:flex-row">
        <aside className="hidden w-[260px] shrink-0 border-r border-white/10 bg-white/[0.035] p-5 lg:flex lg:flex-col">
          <Logo />
          <div className="mt-8 space-y-1">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                  activeView === id
                    ? "border-white/25 bg-white/15 text-white"
                    : "border-transparent text-white/55 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <ProfileChip onClick={() => setView("profile")} />
        </aside>

        <main className="relative flex min-h-screen flex-1 flex-col pb-24 lg:pb-0">
          <header className="relative z-30 border-b border-white/10 bg-black/75 px-4 py-3 backdrop-blur-xl lg:px-8">
            <div className="flex items-center justify-between gap-3">
              <div className="lg:hidden">
                <Logo className="h-14" />
              </div>
              <div className="hidden lg:block">
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">VYRO Performance OS</div>
                <h1 className="text-2xl font-black">{viewTitles[activeView]}</h1>
              </div>
              <div className="flex items-center gap-2">
                <Pill>watch live</Pill>
                <button className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.06]">
                  <Bell className="h-4 w-4" />
                </button>
                <button onClick={() => setView("profile")} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.08] text-xs font-black">
                  <User className="h-4 w-4" />
                </button>
              </div>
            </div>
            <nav className="mt-3 flex justify-center gap-2 overflow-x-auto lg:hidden">
              {topMobile.map((id) => (
                <button
                  key={id}
                  onClick={() => setView(id)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold ${
                    activeView === id ? "border-white/25 bg-white/15" : "border-white/10 bg-white/[0.04] text-white/70"
                  }`}
                >
                  {viewTitles[id]}
                </button>
              ))}
            </nav>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-5 lg:px-8">{children}</div>

          <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-4 gap-2 border-t border-white/10 bg-black/85 p-3 backdrop-blur-xl lg:hidden">
            {bottomMobile.map((id) => {
              const item = navItems.find((n) => n.id === id)!;
              const Icon = item.icon;
              return (
                <button
                  key={id}
                  onClick={() => setView(id)}
                  className={`rounded-2xl border py-2 text-center text-xs ${
                    activeView === id ? "border-white/30 bg-white/15 text-white" : "border-transparent text-white/55"
                  }`}
                >
                  <div className="mx-auto mb-1 w-fit">
                    <Icon className="h-4 w-4" />
                  </div>
                  {item.label}
                </button>
              );
            })}
          </nav>
        </main>
      </div>
    </div>
  );
}
