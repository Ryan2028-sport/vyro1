import React, { useState, type ReactElement } from 'react';
import {
  Bell, Activity, TrendingUp, Users, MessageSquare,
  Heart, Moon, Trophy,
} from 'lucide-react';

export function HomeView() {
  const [activeTab, setActiveTab] = useState('athlete');

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-[#007AFF]/10 overflow-x-hidden">

      {/* 1. SLIM FLOATING HEADER */}
      <header className="fixed top-4 left-4 right-4 z-50">
        <div className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-full px-4 py-2 flex justify-between items-center shadow-sm">
          <button className="p-2 hover:bg-gray-50 rounded-full transition-colors">
            <Bell size={20} className="text-gray-900" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-900 whitespace-nowrap">Athlete Dashboard | VYRO iOS</span>
          </div>
          <div className="bg-[#F5F5F7] pl-2 pr-3 py-1 rounded-full flex items-center gap-2 border border-gray-50">
            <div className="w-1.5 h-1.5 rounded-full bg-[#34C759] animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-900">Watch Live</span>
          </div>
        </div>
      </header>

      <main className="px-6 pt-24 pb-32 max-w-lg mx-auto space-y-8">

        {/* 2. ATHLETE IDENTITY */}
        <section className="space-y-1">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">VYRO IOS</p>
          <h1 className="text-4xl font-black tracking-tighter text-black">Athlete</h1>
        </section>

        {/* 3. QUICK ACTION PILLS */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          <ActionPill icon={<TrendingUp size={16} />} label="Trends" />
          <ActionPill icon={<Activity size={16} />} label="Session" />
          <ActionPill icon={<Users size={16} />} label="Coach" />
          <ActionPill icon={<MessageSquare size={16} />} label="Social" />
        </div>

        {/* 4. DASHBOARD GREETING */}
        <section className="space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">ATHLETE DASHBOARD</p>
              <h2 className="text-3xl font-black tracking-tighter text-black">Good morning, Ryan.</h2>
              <p className="text-xs font-medium text-gray-500 max-w-[280px]">
                Tactical performance intelligence — synced from your VYRO watch.
              </p>
            </div>
            <div className="w-10 h-10 bg-[#34C759] rounded-full flex items-center justify-center font-black text-white text-xs border-2 border-white shadow-sm">
              RC
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="bg-[#34C759]/10 border border-[#34C759]/20 px-3 py-1.5 rounded-full flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
              <span className="text-[9px] font-black text-[#34C759] uppercase">Watch Connected • 94%</span>
            </div>
            <span className="text-[10px] font-bold text-gray-300 uppercase">Synced 18s ago</span>
          </div>
        </section>

        {/* 5. PERFORMANCE BENTO GRID */}
        <section className="grid grid-cols-2 gap-3">
          <ScoreCard label="Fatigue" value={62} color="#FF9500" />
          <ScoreCard label="Recovery" value={78} color="#34C759" />
          <ScoreCard label="Agility" value={84} color="#34C759" />
          <ScoreCard label="Sleep" value={87} color="#34C759" />
        </section>

        {/* 6. VITALS LEGEND */}
        <div className="pt-2">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] leading-none mb-1">
            Vitals — Live from Goodix GH3026 + ST 6-Axis IMU
          </p>
        </div>

        {/* 7. DIET COACH */}
        <div className="bg-[#F5F5F7] p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="flex justify-between items-center mb-6">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Diet Coach</p>
            <span className="bg-[#FF9500]/10 px-2.5 py-1 rounded-full text-[9px] font-black text-[#FF9500] uppercase tracking-widest border border-[#FF9500]/20">
              Live
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-6xl font-black text-black tracking-tighter">2,600</span>
            <span className="text-sm font-bold text-gray-400">kcal</span>
          </div>
          <div className="mt-8 h-1 w-full bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-black w-[25%]" />
          </div>
        </div>
      </main>

      {/* 8. SLIM BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 p-6 z-50">
        <div className="bg-white/80 backdrop-blur-2xl border border-gray-100 rounded-full h-16 flex justify-between items-center px-8 shadow-[0_10px_30px_rgba(0,0,0,0.05)] max-w-sm mx-auto">
          <NavIcon icon={<Activity />} label="Athlete" active={activeTab === 'athlete'} onClick={() => setActiveTab('athlete')} />
          <NavIcon icon={<Trophy />} label="Sport" active={activeTab === 'sport'} onClick={() => setActiveTab('sport')} />
          <NavIcon icon={<Heart />} label="Recovery" active={activeTab === 'recovery'} onClick={() => setActiveTab('recovery')} />
          <NavIcon icon={<Moon />} label="Sleep" active={activeTab === 'sleep'} onClick={() => setActiveTab('sleep')} />
        </div>
      </nav>
    </div>
  );
}

// UI ATOMS
type ActionPillProps = { icon: ReactElement; label: string };
const ActionPill = ({ icon, label }: ActionPillProps) => (
  <button className="flex items-center gap-2.5 bg-white border border-gray-100 pl-3 pr-5 py-2.5 rounded-2xl shadow-sm hover:bg-gray-50 active:scale-95 transition-all flex-shrink-0">
    <div className="text-gray-500">{icon}</div>
    <span className="text-[11px] font-black uppercase tracking-widest text-black">{label}</span>
  </button>
);

type ScoreCardProps = { label: string; value: number; color: string };
const ScoreCard = ({ label, value, color }: ScoreCardProps) => (
  <div className="bg-[#F5F5F7] p-6 rounded-[2.2rem] flex flex-col items-center justify-center border border-transparent hover:border-gray-200 transition-all">
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg className="absolute w-full h-full -rotate-90">
        <circle cx="40" cy="40" r="34" stroke="#E5E7EB" strokeWidth="6" fill="transparent" />
        <circle
          cx="40" cy="40" r="34" stroke={color} strokeWidth="6" fill="transparent"
          strokeDasharray="213.6" strokeDashoffset={213.6 - (213.6 * value / 100)}
          strokeLinecap="round"
        />
      </svg>
      <div className="text-center">
        <p className="text-xl font-black text-black leading-none">{value}</p>
        <p className="text-[8px] font-bold text-gray-400 uppercase mt-0.5">/ 100</p>
      </div>
    </div>
    <p className="mt-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
  </div>
);

type NavIconProps = { icon: ReactElement<{ size?: number; strokeWidth?: number }>; label: string; active: boolean; onClick: () => void };
const NavIcon = ({ icon, label, active, onClick }: NavIconProps) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-1 transition-all active:scale-90"
  >
    <div className={`transition-colors duration-300 ${active ? 'text-[#34C759]' : 'text-gray-300'}`}>
      {React.cloneElement(icon, { size: 22, strokeWidth: active ? 3 : 2 })}
    </div>
    <span className={`text-[8px] font-black uppercase tracking-widest ${active ? 'text-[#34C759]' : 'text-gray-300'}`}>
      {label}
    </span>
  </button>
);

export default HomeView;
