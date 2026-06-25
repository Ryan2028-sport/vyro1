import type { ReactNode } from "react";
import {
  Activity,
  Apple,
  Bell,
  Circle,
  Dumbbell,
  HeartPulse,
  Home,
  MessageCircle,
  Moon,
  Settings,
  TrendingUp,
  Trophy,
  Video,
} from "lucide-react";

export type ViewId =
  | "home"
  | "trends"
  | "session"
  | "sport"
  | "recovery"
  | "sleep"
  | "coach"
  | "social"
  | "video"
  | "diet"
  | "profile"
  | "debug"
  | "history"
  | "athlete"
  | "court"
  | "swing"
  | "tendency"
  | "more"
  | "band";

export const viewTitles: Record<ViewId, string> = {
  home: "Home",
  trends: "Trends",
  session: "Session",
  sport: "Sport",
  recovery: "Recovery",
  sleep: "Sleep",
  coach: "Coach",
  social: "Social",
  video: "AI Video",
  diet: "Diet Coach",
  profile: "Profile",
  debug: "Debug",
  history: "History",
  athlete: "Athlete",
  court: "Court DB",
  swing: "Swing",
  tendency: "Tendencies",
  more: "More",
  band: "Band",
};

const navItems: { id: ViewId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "trends", label: "Trends", icon: TrendingUp },
  { id: "session", label: "Session", icon: Activity },
  { id: "sport", label: "Sport", icon: Trophy },
  { id: "recovery", label: "Recovery", icon: HeartPulse },
  { id: "sleep", label: "Sleep", icon: Moon },
  { id: "coach", label: "Coach", icon: Dumbbell },
  { id: "social", label: "Social", icon: MessageCircle },
  { id: "video", label: "AI Video", icon: Video },
  { id: "diet", label: "Diet Coach", icon: Apple },
];

const bottomMobile: ViewId[] = ["home", "sport", "session", "recovery", "social"];

function Logo({ className = "h-16" }: { className?: string }) {
  return (
    <div className={`${className} flex flex-col justify-center`}>
      <svg viewBox="0 0 210 70" className="h-full w-[150px] text-gray-900">
        <path d="M4 34h45l8-19 10 38 12-27 8 8h119" fill="none" stroke="currentColor" strokeWidth="4" />
        <text x="2" y="62" fill="currentColor" fontSize="24" fontFamily="monospace" letterSpacing="12">VYRO</text>
        <text x="76" y="69" fill="currentColor" fontSize="8" fontFamily="monospace" letterSpacing="2">OWN THE EDGE</text>
      </svg>
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
    <div className="min-h-screen bg-vyro-canvas text-gray-900">
      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col lg:flex-row">
        <aside className="hidden w-[260px] shrink-0 border-r border-gray-200 bg-white p-5 lg:flex lg:flex-col">
          <Logo />
          <div className="mt-8 space-y-1">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                  activeView === id
                    ? "border-gray-200 bg-gray-100 text-gray-900 font-semibold"
                    : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="mt-auto rounded-2xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full border border-gray-200 bg-gray-100 text-xs font-semibold">RC</div>
              <div>
                <div className="text-sm font-medium">Ryan Chen</div>
                <div className="font-mono text-[10px] text-gray-400">Squash · D1 / National</div>
              </div>
            </div>
          </div>
        </aside>

        <main className="relative flex min-h-screen flex-1 flex-col pb-24 lg:pb-0">
          <header className="sticky top-0 z-30 bg-white/80 px-4 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] backdrop-blur-xl lg:px-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 bg-gray-100 text-xs font-semibold lg:hidden">RC</div>
                <div className="hidden lg:block">
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500">VYRO</div>
                  <h1 className="text-3xl font-bold tracking-tight leading-tight text-gray-900">{viewTitles[activeView]}</h1>
                </div>
              </div>
              <span className="text-sm font-semibold text-gray-900 lg:hidden">{viewTitles[activeView]}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setView("profile")}
                  className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 bg-gray-50 transition-colors hover:bg-gray-100"
                >
                  <Settings className="h-4 w-4 text-gray-600" />
                </button>
                <button className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 bg-gray-50 transition-colors hover:bg-gray-100">
                  <Bell className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 pt-6 pb-6 lg:px-8">{children}</div>

          <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 gap-1 border-t-0 bg-white/85 px-4 pt-2 shadow-[0_-1px_3px_rgba(0,0,0,0.04)] backdrop-blur-xl lg:hidden" style={{ paddingBottom: "max(env(safe-area-inset-bottom, 12px), 12px)" }}>
            {bottomMobile.map((id) => {
              const item = navItems.find((n) => n.id === id)!;
              const Icon = item.icon;
              const isActive = activeView === id;
              const isRecord = id === "session";
              return (
                <button
                  key={id}
                  onClick={() => setView(id)}
                  className={`flex flex-col items-center gap-0.5 rounded-2xl py-2 text-center transition-all duration-200 ${
                    isActive ? "text-gray-900" : "text-gray-400"
                  }`}
                >
                  <div className={`mx-auto mb-0.5 h-[2px] w-5 rounded-full transition-all duration-200 ${isActive ? "bg-gray-900" : "bg-transparent"}`} />
                  {isRecord ? (
                    <>
                      <div className="relative h-5 w-5">
                        <Circle className="h-5 w-5" />
                        <Circle className="absolute inset-0 m-auto h-2.5 w-2.5 fill-current" />
                      </div>
                      <span className="text-[11px] font-medium">Record</span>
                    </>
                  ) : (
                    <>
                      <Icon className="h-5 w-5" />
                      <span className="text-[11px] font-medium">{item.label}</span>
                    </>
                  )}
                </button>
              );
            })}
          </nav>
        </main>
      </div>
    </div>
  );
}
