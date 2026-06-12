import type { ReactNode } from "react";
import { Activity, Home as HomeIcon, History, LayoutGrid, User } from "lucide-react";

export type ViewId =
  | "home"
  | "session"
  | "history"
  | "more"
  | "profile"
  | "sleep"
  | "recovery"
  | "trends"
  | "diet"
  | "coach"
  | "video"
  | "social"
  | "sport"
  | "activity";

const navItems: { id: ViewId; label: string; icon: typeof HomeIcon }[] = [
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "session", label: "Session", icon: Activity },
  { id: "history", label: "History", icon: History },
  { id: "more", label: "More", icon: LayoutGrid },
  { id: "profile", label: "Profile", icon: User },
];

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="h-6 w-6 text-emerald-600">
        <path d="M2 16h6l4-10 6 20 4-14 4 8h4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <span className="font-mono text-sm font-black tracking-[0.18em] text-black">VYRO</span>
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
    <div className="flex min-h-svh flex-col bg-[#f7f7f8] text-black">
      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <button
            onClick={() => setView("profile")}
            className="rounded-full border border-black/10 bg-black px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-black/85"
          >
            <span className="sm:hidden">Band</span>
            <span className="hidden sm:inline">Profile & Band</span>
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-28 pt-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.07] bg-white/95 backdrop-blur">
        <div className="mx-auto grid max-w-[640px] grid-cols-5">
          {navItems.map(({ id, label, icon: Icon }) => {
            const active =
              activeView === id ||
              (id === "more" &&
                ["sleep", "recovery", "trends", "diet", "coach", "video", "social", "sport", "activity"].includes(
                  activeView,
                ));
            return (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors ${
                  active ? "text-emerald-600" : "text-black/55 hover:text-black"
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
