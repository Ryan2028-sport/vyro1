import type { ReactNode } from "react";
import { Activity, HeartPulse, Home as HomeIcon, LayoutGrid, Moon } from "lucide-react";

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
  { id: "home", label: "Home", icon: HomeIcon },
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
        <path d="M2 16h6l4-10 6 20 4-14 4 8h4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <span className="font-mono text-sm font-black tracking-[0.18em] text-vyro-text">VYRO</span>
    </div>
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
      <header className="sticky top-0 z-30 border-b border-vyro-text/[0.06] bg-vyro-panel/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <button
            onClick={() => setView("profile")}
            className="rounded-full border border-vyro-text/10 bg-vyro-mint px-3 py-1.5 text-[11px] font-semibold text-vyro-ink hover:bg-vyro-text/85"
          >
            <span className="sm:hidden">Band</span>
            <span className="hidden sm:inline">Profile & Band</span>
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-28 pt-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-vyro-text/[0.07] bg-vyro-panel/95 backdrop-blur">
        <div className="mx-auto grid max-w-[640px] grid-cols-5">
          {navItems.map(({ id, label, icon: Icon }) => {
            const active =
              activeView === id || (id === "more" && MORE_IDS.includes(activeView));
            return (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors ${
                  active ? "text-vyro-mint" : "text-vyro-text/55 hover:text-vyro-text"
                }`}
              >
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
