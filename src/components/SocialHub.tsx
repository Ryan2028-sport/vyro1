import { TOKENS } from "@/lib/vyro-tokens";
import { cn } from "@/lib/utils";

const feed = [
  { who: "Maya P.", sport: "Tennis", note: "PR: 84 agility — first time in zone 4 all month.", delta: "+6" },
  { who: "Diego A.", sport: "Squash", note: "Cleared for play after 11-day RTP gate.", delta: "RTP" },
  { who: "Coach Lin", sport: "Squash", note: "Posted new T-control drill set for the squad.", delta: "NEW" },
];

const leaderboard = [
  { rank: 1, name: "Ryan C.", score: 92 },
  { rank: 2, name: "Maya P.", score: 88 },
  { rank: 3, name: "Diego A.", score: 84 },
];

export default function SocialHub() {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-neutral-500">
          Squad
        </p>
        <h1 className="text-3xl font-black tracking-tight">Social Hub</h1>
      </header>

      <section className={cn("bg-vyro-surface", TOKENS.RADIUS, TOKENS.SHADOW, "p-5")}>
        <h2 className="text-sm font-black uppercase tracking-widest text-neutral-500 mb-3">
          This Week
        </h2>
        <ul className="flex flex-col gap-2">
          {leaderboard.map((row) => (
            <li
              key={row.rank}
              className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-vyro-spatial/10 text-xs font-black text-vyro-spatial">
                  {row.rank}
                </span>
                <span className="text-sm font-black">{row.name}</span>
              </div>
              <span className="tabular-nums text-base font-black">{row.score}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-black uppercase tracking-widest text-neutral-500">
          Activity
        </h2>
        {feed.map((f, i) => (
          <article
            key={i}
            className={cn("bg-vyro-surface", TOKENS.RADIUS, TOKENS.SHADOW, "p-4")}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-black">
                {f.who}{" "}
                <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-500">
                  · {f.sport}
                </span>
              </p>
              <span className="text-[11px] font-black text-vyro-spatial">{f.delta}</span>
            </div>
            <p className="mt-1 text-sm text-neutral-700 leading-snug">{f.note}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
