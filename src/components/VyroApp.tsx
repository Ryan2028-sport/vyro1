import React, { useState, type ReactElement } from "react";
import {
  Bell,
  Activity,
  TrendingUp,
  Users,
  MessageSquare,
  Heart,
  Moon,
  Trophy,
} from "lucide-react";

const VyroApp = () => {
  const [activeTab, setActiveTab] = useState("athlete");

  return (
    <div className="fixed inset-0 bg-white text-gray-900 font-sans selection:bg-[#007AFF]/10 overflow-hidden select-none">
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-6 pt-[env(safe-area-inset-top)] flex justify-between items-center h-[calc(56px+env(safe-area-inset-top))]">
        <button className="p-1.5 hover:bg-gray-50 rounded-full transition-colors text-gray-900">
          <Bell size={18} strokeWidth={2.5} />
        </button>
        <div className="flex items-center gap-3">
          <div className="bg-[#34C759]/10 pl-2 pr-3 py-1 rounded-full flex items-center gap-1.5 border border-[#34C759]/20">
            <div className="w-1.5 h-1.5 rounded-full bg-[#34C759] animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-widest text-[#34C759]">
              Watch Live
            </span>
          </div>
          <div className="w-8 h-8 bg-[#34C759] rounded-full flex items-center justify-center font-black text-white text-[10px] border-2 border-white shadow-sm shrink-0">
            RC
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="h-full overflow-y-auto overscroll-contain pt-[calc(64px+env(safe-area-inset-top))] pb-[calc(100px+env(safe-area-inset-bottom))] px-6 max-w-lg mx-auto space-y-8 no-scrollbar">
        <div className="flex gap-3 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
          <ActionPill icon={<TrendingUp size={16} />} label="Trends" />
          <ActionPill icon={<Activity size={16} />} label="Session" />
          <ActionPill icon={<Users size={16} />} label="Coach" />
          <ActionPill icon={<MessageSquare size={16} />} label="Social" />
        </div>

        <section className="space-y-4">
          <div className="space-y-1">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
              ATHLETE DASHBOARD
            </p>
            <h2 className="text-3xl font-black tracking-tighter text-black leading-tight">
              Good morning, Ryan.
            </h2>
            <p className="text-xs font-medium text-gray-500">
              Tactical performance intelligence — synced from your VYRO watch.
            </p>
          </div>

          <div className="flex justify-between items-center">
            <div className="bg-[#34C759]/10 border border-[#34C759]/20 px-3 py-1.5 rounded-full flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
              <span className="text-[9px] font-black text-[#34C759] uppercase tracking-widest">
                Watch Connected • 94%
              </span>
            </div>
            <span className="text-[10px] font-bold text-gray-300 uppercase">
              Synced 18s ago
            </span>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <ScoreCard label="Fatigue" value={62} color="#FF9500" />
          <ScoreCard label="Recovery" value={78} color="#34C759" />
          <ScoreCard label="Agility" value={84} color="#34C759" />
          <ScoreCard label="Sleep" value={87} color="#34C759" />
        </section>

        <div className="pt-2">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] leading-none mb-1">
            Vitals — Live from Goodix GH3026 + ST 6-Axis IMU
          </p>
        </div>

        <div className="bg-[#F5F5F7] p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Diet Coach
            </p>
            <span className="bg-[#FF9500]/10 px-2.5 py-1 rounded-full text-[9px] font-black text-[#FF9500] uppercase tracking-widest border border-[#FF9500]/20">
              Live
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-6xl font-black text-black tracking-tighter">
              2,600
            </span>
            <span className="text-sm font-bold text-gray-400">kcal</span>
          </div>
          <div className="mt-8 h-1 w-full bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-black w-[25%]" />
          </div>
        </div>
      </main>

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-2xl border-t border-gray-100 pb-[env(safe-area-inset-bottom)] px-6 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
        <div className="h-20 flex justify-between items-center max-w-sm mx-auto">
          <NavIcon
            icon={<Activity />}
            label="Athlete"
            active={activeTab === "athlete"}
            onClick={() => setActiveTab("athlete")}
          />
          <NavIcon
            icon={<Trophy />}
            label="Sport"
            active={activeTab === "sport"}
            onClick={() => setActiveTab("sport")}
          />
          <NavIcon
            icon={<Heart />}
            label="Recovery"
            active={activeTab === "recovery"}
            onClick={() => setActiveTab("recovery")}
          />
          <NavIcon
            icon={<Moon />}
            label="Sleep"
            active={activeTab === "sleep"}
            onClick={() => setActiveTab("sleep")}
          />
        </div>
      </nav>
    </div>
  );
};

const ActionPill = ({
  icon,
  label,
}: {
  icon: ReactElement;
  label: string;
}) => (
  <button className="flex items-center gap-2.5 bg-white border border-gray-100 pl-3 pr-5 py-2.5 rounded-2xl shadow-sm active:bg-gray-50 active:scale-95 transition-all flex-shrink-0">
    <div className="text-gray-500">{icon}</div>
    <span className="text-[11px] font-black uppercase tracking-widest text-black">
      {label}
    </span>
  </button>
);

const ScoreCard = ({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) => (
  <div className="bg-[#F5F5F7] p-6 rounded-[2.2rem] flex flex-col items-center justify-center border border-transparent active:border-gray-200 transition-all">
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg className="absolute w-full h-full -rotate-90">
        <circle
          cx="32"
          cy="32"
          r="28"
          stroke="#E5E7EB"
          strokeWidth="5"
          fill="transparent"
        />
        <circle
          cx="32"
          cy="32"
          r="28"
          stroke={color}
          strokeWidth="5"
          fill="transparent"
          strokeDasharray="175.9"
          strokeDashoffset={175.9 - (175.9 * value) / 100}
          strokeLinecap="round"
        />
      </svg>
      <div className="text-center">
        <p className="text-lg font-black text-black leading-none">{value}</p>
        <p className="text-[7px] font-bold text-gray-400 uppercase">/ 100</p>
      </div>
    </div>
    <p className="mt-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">
      {label}
    </p>
  </div>
);

const NavIcon = ({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactElement<{ size?: number; strokeWidth?: number }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-1 transition-all active:scale-90 px-4"
  >
    <div
      className={`transition-colors duration-300 ${
        active ? "text-[#34C759]" : "text-gray-300"
      }`}
    >
      {React.cloneElement(icon, { size: 20, strokeWidth: active ? 3 : 2 })}
    </div>
    <span
      className={`text-[8px] font-black uppercase tracking-widest ${
        active ? "text-[#34C759]" : "text-gray-300"
      }`}
    >
      {label}
    </span>
  </button>
);

export default VyroApp;
