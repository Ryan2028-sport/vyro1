import { PerformanceCard } from "@/components/vyro/PerformanceCard";
import { TOKENS, checkClearance } from "@/lib/vyro-tokens";
import { cn } from "@/lib/utils";

const protocols = [
  { name: "Cold Plunge", duration: "3 min", impact: "+6 recovery" },
  { name: "Mobility Flow", duration: "12 min", impact: "+4 agility" },
  { name: "Breathwork", duration: "8 min", impact: "-9 stress" },
];

export default function RecoveryLab() {
  const videoSymmetry = 0.97;
  const wearablePower = 0.94;
  const cleared = checkClearance(videoSymmetry, wearablePower);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-neutral-500">
          Double-Check Engine
        </p>
        <h1 className="text-3xl font-black tracking-tight">Recovery Lab</h1>
      </header>

      <section
        className={cn(
          TOKENS.RADIUS,
          TOKENS.SHADOW,
          "p-5",
          cleared ? "bg-vyro-recovery/10" : "bg-vyro-fatigue/10",
        )}
      >
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-neutral-500">
          Return-to-Play Gate
        </p>
        <p
          className={cn(
            "mt-1 text-2xl font-black",
            cleared ? "text-vyro-recovery" : "text-vyro-fatigue",
          )}
        >
          {cleared ? "Cleared" : "Hold"}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="font-mono uppercase tracking-widest text-neutral-500">
              Video symmetry
            </p>
            <p className="text-base font-black">{(videoSymmetry * 100).toFixed(0)}%</p>
          </div>
          <div>
            <p className="font-mono uppercase tracking-widest text-neutral-500">
              Wearable power
            </p>
            <p className="text-base font-black">{(wearablePower * 100).toFixed(0)}%</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <PerformanceCard metricType="RECOVERY" value={78} unit="/100" label="Recovery" />
        <PerformanceCard metricType="WARNING" value={62} unit="/100" label="Fatigue" />
      </div>

      <section className={cn("bg-vyro-surface", TOKENS.RADIUS, TOKENS.SHADOW, "p-5")}>
        <h2 className="text-sm font-black uppercase tracking-widest text-neutral-500 mb-3">
          Today's Protocols
        </h2>
        <ul className="flex flex-col gap-2">
          {protocols.map((p) => (
            <li
              key={p.name}
              className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm"
            >
              <div>
                <p className="text-sm font-black">{p.name}</p>
                <p className="text-[11px] font-mono uppercase tracking-widest text-neutral-500">
                  {p.duration}
                </p>
              </div>
              <span className="text-xs font-black text-vyro-recovery">{p.impact}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
