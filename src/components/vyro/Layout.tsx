import type { ReactNode } from "react";
import {
  Activity,
  Bell,
  HeartPulse,
  Home,
  Moon,
  Share2,
  TrendingUp,
  Trophy,
  Dumbbell,
} from "lucide-react";
import type { ViewId } from "@/lib/vyro-data";
import { ActionPill } from "./shared";

const bottomNav: { id: ViewId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Athlete", icon: Home },
  { id: "sport", label: "Sport", icon: Trophy },
  { id: "recovery", label: "Recovery", icon: HeartPulse },
  { id: "sleep", label: "Sleep", icon: Moon },
];

const topActions: {
  id: ViewId;
  label: string;
  color: "spatial" | "session" | "coach" | "alert";
  icon: typeof Home;
}[] = [
  { id: "trends", label: "Trends", color: "spatial", icon: TrendingUp },
  { id: "session", label: "Session", color: "session", icon: Activity },
  { id: "coach", label: "Coach", color: "coach", icon: Dumbbell },
  { id: "social", label: "Social", color: "alert", icon: Share2 },
];

function VyroMark() {
  return (
    <svg viewBox="0 0 210 70" className="h-6 w-auto text-neutral-900">
      <path d="M4 34h45l8-19 10 38 12-27 8 8h119" fill="none" stroke="currentColor" strokeWidth="4" />
      <text x="2" y="62" fill="currentColor" fontSize="22" fontFamily="monospace" letterSpacing="10">VYRO</text>
    </svg>
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
    <div className="relative min-h-screen bg-vyro-canvas text-neutral-900">
      {/* Floating glass header pill */}
      <header className="fixed inset-x-3 top-3 z-40 flex items-center justify-between gap-3 rounded-full border border-black/5 bg-white/72 px-4 py-2 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] backdrop-blur-xl backdrop-saturate-150">
        <div className="flex items-center gap-2">
          <VyroMark />
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-vyro-positive/30 bg-vyro-positive/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-vyro-positive">
            <span className="h-1.5 w-1.5 rounded-full bg-vyro-positive" />
            Watch live
          </span>
          <button className="grid h-8 w-8 place-items-center rounded-full border border-black/5 bg-vyro-surface text-neutral-700">
            <Bell className="h-4 w-4" />
          </button>
          <div className="grid h-8 w-8 place-items-center rounded-full bg-vyro-positive text-[10px] font-black text-white">RC</div>
        </div>
      </header>

      <main className="px-4 pt-20 pb-28">
        {/* Colorful action row */}
        <nav className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
          {topActions.map(({ id, label, color, icon }) => (
            <ActionPill
              key={id}
              label={label}
              color={color}
              icon={icon}
              onClick={() => setView(id)}
            />
          ))}
        </nav>

        {children}
      </main>

      {/* Floating bottom nav pill */}
      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 gap-1 rounded-full border border-black/5 bg-white/72 p-1.5 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.22)] backdrop-blur-xl backdrop-saturate-150">
        {bottomNav.map(({ id, label, icon: Icon }) => {
          const active = activeView === id;
          return (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-full py-2 text-[10px] font-semibold transition-colors ${
                active
                  ? "bg-vyro-positive/10 text-vyro-positive"
                  : "text-neutral-500"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
