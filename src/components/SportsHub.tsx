import { useState } from "react";
import { sports, sportProfiles } from "@/lib/vyro-data";
import { TOKENS } from "@/lib/vyro-tokens";
import { cn } from "@/lib/utils";

export default function SportsHub() {
  const [selected, setSelected] = useState("Squash");
  const profile = sportProfiles[selected];

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-neutral-500">
          Sport Intelligence
        </p>
        <h1 className="text-3xl font-black tracking-tight">Sports Hub</h1>
      </header>

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex gap-2">
          {sports.map((s) => {
            const active = s === selected;
            return (
              <button
                key={s}
                onClick={() => setSelected(s)}
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest whitespace-nowrap transition-colors",
                  active
                    ? "bg-vyro-spatial text-white"
                    : "bg-vyro-surface text-neutral-500",
                )}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <section className={cn("bg-vyro-surface", TOKENS.RADIUS, TOKENS.SHADOW, "p-5")}>
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-neutral-500">
          Motion Signature
        </p>
        <p className="mt-1 text-lg font-black">{profile.motion}</p>
        <p className="mt-3 text-xs text-neutral-500">{profile.db}</p>
      </section>

      <section className={cn("bg-vyro-surface", TOKENS.RADIUS, TOKENS.SHADOW, "p-5")}>
        <h2 className="text-sm font-black uppercase tracking-widest text-neutral-500 mb-3">
          Tendencies
        </h2>
        <ul className="flex flex-col gap-2">
          {profile.tendency.map((t) => (
            <li
              key={t}
              className="text-sm leading-snug rounded-2xl bg-white px-3 py-2 shadow-sm"
            >
              {t}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
