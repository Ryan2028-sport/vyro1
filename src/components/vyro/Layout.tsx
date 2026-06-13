import type { ReactNode } from "react";
import { Activity, Bell, HeartPulse, Home as HomeIcon, LayoutGrid, Moon } from "lucide-react";
import { useVyroBandCtx } from "./VyroBandProvider";

export type ViewId =
  | "home"
  | "session"
  | "history"
  | "more"
  | "profile"
  | "athlete"
  | "sleep"
  | "recovery"
  | "trends"
  | "diet"
  | "coach"
  | "video"
  | "social"
  | "sport"
  | "activity"
  | "court"
  | "swing"
  | "tendency";

const navItems: { id: ViewId; label: string; icon: typeof HomeIcon }[] = [
  { id: "home", label: "Athlete", icon: HomeIcon },
  { id: "session", label: "Session", icon: Activity },
  { id: "recovery", label: "Recovery", icon: HeartPulse },
  { id: "sleep", label: "Sleep", icon: Moon },
  { id: "more", label: "More", icon: LayoutGrid },
];

const MORE_IDS: ViewId[] = [
  "athlete",
  "trends",
  "diet",
  "coach",
  "video",
  "social",
  "sport",
  "activity",
  "court",
  "swing",
  "tendency",
  "history",
  "profile",
];

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="h-6 w-6 text-vyro-mint">
        <path d="M3 6 L16 26 L29 6" stroke="currentColor" strokeWidth="3" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="flex flex-col leading-none">
        <span className="font-mono text-[13px] font-black tracking-[0.22em] text-vyro-text">VYRO</span>
        <span className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.3em] text-vyro-mute">Own the edge</span>
      </div>
    </div>
  );
}

function SyncPill() {
  const ctx = useVyroBandCtx();
  const live = ctx.connected;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] ${
      live
        ? "border-vyro-mint/40 bg-vyro-mint/10 text-vyro-mint"
        : "border-vyro-text/15 bg-vyro-text/5 text-vyro-mute"
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-vyro-mint shadow-[0_0_8px_currentColor]" : "bg-vyro-mute"}`} />
      {live ? "Sync · live" : "Sync · idle"}
    </span>
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
    <div className="flex min-h-svh flex-col bg-vyro-ink text-vyro-text">
      {/* Pseudo status bar — mirrors the reference */}
      <div className="px-4 pt-[env(safe-area-inset-top,8px)]">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between py-1 font-mono text-[10px] tracking-[0.18em] text-vyro-mute">
          <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          <span className="flex items-center gap-2">
            <span>LIVE</span>
            <span>94%</span>
          </span>
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-vyro-line bg-vyro-ink/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <div className="flex items-center gap-2">
            <SyncPill />
            <button
              onClick={() => setView("profile")}
              aria-label="Profile"
              className="grid h-9 w-9 place-items-center rounded-full border border-vyro-line bg-vyro-panel text-vyro-text/80 hover:text-vyro-text"
            >
              <Bell className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-28 pt-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-vyro-line bg-vyro-ink/95 backdrop-blur">
        <div className="mx-auto grid max-w-[640px] grid-cols-5">
          {navItems.map(({ id, label, icon: Icon }) => {
            const active =
              activeView === id || (id === "more" && MORE_IDS.includes(activeView));
            return (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`relative flex flex-col items-center gap-1 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                  active ? "text-vyro-mint" : "text-vyro-mute hover:text-vyro-text"
                }`}
              >
                {active && (
                  <span className="absolute inset-x-6 top-0 h-px bg-vyro-mint shadow-[0_0_12px_var(--vyro-mint)]" />
                )}
                <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
                {label}
              </button>
            );
          })}
        </div>
        <div className="h-[env(safe-area-inset-bottom,0)]" />
      </nav>
    </div>
  );
}
