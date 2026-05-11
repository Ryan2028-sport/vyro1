import { PerformanceCard } from "@/components/vyro/PerformanceCard";
import { TOKENS, checkClearance } from "@/lib/vyro-tokens";
import { athlete, vitals } from "@/lib/vyro-data";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const cleared = checkClearance(0.97, 0.96);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-neutral-500">
            {athlete.level}
          </p>
          <h1 className="text-3xl font-black tracking-tight">Hi, {athlete.first}</h1>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-full bg-vyro-surface text-sm font-black">
          {athlete.avatar}
        </div>
      </header>

      <div
        className={cn(
          TOKENS.RADIUS,
          TOKENS.SHADOW,
          "p-4 flex items-center justify-between",
          cleared ? "bg-vyro-recovery/10" : "bg-vyro-fatigue/10",
        )}
      >
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-neutral-500">
            Return-to-Play
          </p>
          <p
            className={cn(
              "text-lg font-black",
              cleared ? "text-vyro-recovery" : "text-vyro-fatigue",
            )}
          >
            {cleared ? "Cleared for play" : "Hold — baseline mismatch"}
          </p>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
          Video × Wearable
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <PerformanceCard metricType="RECOVERY" value={78} unit="/100" label="Recovery" />
        <PerformanceCard metricType="WARNING" value={62} unit="/100" label="Fatigue" />
        <PerformanceCard metricType="SPATIAL" value={84} unit="/100" label="Agility" />
        <PerformanceCard metricType="SPATIAL" value={87} unit="/100" label="Sleep" />
      </div>

      <section className={cn("bg-vyro-surface", TOKENS.RADIUS, TOKENS.SHADOW, "p-5")}>
        <h2 className="text-sm font-black uppercase tracking-widest text-neutral-500 mb-3">
          Live Vitals
        </h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {vitals.map(([label, value, unit, delta]) => (
            <div key={label} className="flex flex-col">
              <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                {label}
              </span>
              <span className="text-lg font-black tabular-nums">
                {value}
                <span className="ml-1 text-xs font-medium text-neutral-500">{unit}</span>
              </span>
              <span className="text-[10px] font-mono text-neutral-400">{delta}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
