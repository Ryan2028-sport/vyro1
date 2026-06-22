import { useState } from "react";
import { Building2, Users, Trophy, Send, MessageCircle } from "lucide-react";
import { Card, Pill } from "./shared";

type Category = "school" | "club" | "group" | "squash" | "tennis";

const CATEGORIES: { id: Category; label: string; icon: typeof Building2 }[] = [
  { id: "school", label: "School vs School", icon: Building2 },
  { id: "club", label: "Club vs Club", icon: Building2 },
  { id: "group", label: "Group vs Group", icon: Users },
  { id: "squash", label: "Squash Global", icon: Trophy },
  { id: "tennis", label: "Tennis Global", icon: Trophy },
];

type Row = { r: number; n: string; v: string; pct: number };
type Challenge = {
  cadence: string;
  prize: string | null;
  title: string;
  rule: string;
  rows: Row[];
};

const CHALLENGES: Challenge[] = [
  {
    cadence: "WEEK",
    prize: null,
    title: "Most verified sessions",
    rule: "Every athlete must sync VYRO Band",
    rows: [
      { r: 1, n: "DC Pro Crew", v: "112", pct: 100 },
      { r: 2, n: "Yale 2026", v: "98", pct: 86 },
      { r: 3, n: "Northeast Open", v: "81", pct: 71 },
    ],
  },
  {
    cadence: "MONTH",
    prize: null,
    title: "Best recovery discipline",
    rule: "Average live recovery + sleep score",
    rows: [
      { r: 1, n: "Yale 2026", v: "86", pct: 100 },
      { r: 2, n: "Capital Club", v: "83", pct: 96 },
      { r: 3, n: "Princeton", v: "79", pct: 91 },
    ],
  },
  {
    cadence: "WEEKLY",
    prize: "$20",
    title: "Best % average T-control",
    rule: "Minimum 3 logged sessions",
    rows: [
      { r: 1, n: "Ryan Chen", v: "78%", pct: 100 },
      { r: 2, n: "Alex K.", v: "76%", pct: 97 },
      { r: 3, n: "Diego R.", v: "73%", pct: 93 },
    ],
  },
  {
    cadence: "MONTHLY",
    prize: "$100",
    title: "Best avg Agility score",
    rule: "Verified sessions only",
    rows: [
      { r: 1, n: "Alex K.", v: "92", pct: 100 },
      { r: 2, n: "Ryan Chen", v: "90", pct: 97 },
      { r: 3, n: "Kira J.", v: "88", pct: 95 },
    ],
  },
  {
    cadence: "SEASON",
    prize: "$1K",
    title: "Most aggregated court distance covered",
    rule: "Season-long verified match + training load",
    rows: [
      { r: 1, n: "Diego R.", v: "128 km", pct: 100 },
      { r: 2, n: "Ryan Chen", v: "121 km", pct: 94 },
      { r: 3, n: "Shiv Patel", v: "109 km", pct: 85 },
    ],
  },
  {
    cadence: "YEAR",
    prize: "$5K",
    title: "Best avg time to recover to 80% after dropping below 25%",
    rule: "Requires post-session live recovery dip below 25%",
    rows: [
      { r: 1, n: "Ryan Chen", v: "11m", pct: 100 },
      { r: 2, n: "Alex K.", v: "13m", pct: 85 },
      { r: 3, n: "Kira J.", v: "15m", pct: 73 },
    ],
  },
];

const LIVE_MATCHES: Record<Category, { title: string; subtitle: string; rows: Row[] }> = {
  school: {
    title: "Yale Squash vs Princeton",
    subtitle: "Team average agility",
    rows: [
      { r: 1, n: "Yale Squash", v: "64", pct: 100 },
      { r: 2, n: "Princeton", v: "52", pct: 81 },
      { r: 3, n: "Columbia Club", v: "49", pct: 77 },
    ],
  },
  club: {
    title: "DC Pro Crew vs Capital Club",
    subtitle: "Club average T-control",
    rows: [
      { r: 1, n: "DC Pro Crew", v: "74%", pct: 100 },
      { r: 2, n: "Capital Club", v: "69%", pct: 93 },
      { r: 3, n: "Northeast Open", v: "61%", pct: 82 },
    ],
  },
  group: {
    title: "Yale 2026 vs DC Pro Crew",
    subtitle: "Group average recovery",
    rows: [
      { r: 1, n: "Yale 2026", v: "86", pct: 100 },
      { r: 2, n: "DC Pro Crew", v: "81", pct: 94 },
      { r: 3, n: "Mid-Atlantic Lab", v: "77", pct: 89 },
    ],
  },
  squash: {
    title: "Squash Global ladder",
    subtitle: "Composite verified score",
    rows: [
      { r: 1, n: "Ryan Chen", v: "94", pct: 100 },
      { r: 2, n: "Alex K.", v: "91", pct: 96 },
      { r: 3, n: "Diego R.", v: "88", pct: 93 },
    ],
  },
  tennis: {
    title: "Tennis Global ladder",
    subtitle: "Composite verified score",
    rows: [
      { r: 1, n: "Kira J.", v: "92", pct: 100 },
      { r: 2, n: "Marcus W.", v: "87", pct: 94 },
      { r: 3, n: "Shiv Patel", v: "84", pct: 91 },
    ],
  },
};

const CHAT_THREAD_TITLES: Record<Category, string> = {
  school: "School vs School thread",
  club: "Club vs Club thread",
  group: "Group vs Group thread",
  squash: "Squash Global thread",
  tennis: "Tennis Global thread",
};

const CHAT_MESSAGES = [
  {
    initials: "YS",
    who: "Yale Squash",
    text: "Lineup is locked. We need three verified sessions before Friday.",
  },
  {
    initials: "P",
    who: "Princeton",
    text: "Challenge accepted. Posting match clips after practice.",
  },
  {
    initials: "RC",
    who: "Ryan Chen",
    text: "Keep it clean: verified VYRO data only.",
  },
];

export function SocialView() {
  const [category, setCategory] = useState<Category>("school");
  const match = LIVE_MATCHES[category];

  return (
    <div className="space-y-4">
      <Card eyebrow="Compete" title="School, club, group & sport-global leaderboards" action={<Pill tone="live" pulse>Prizes live</Pill>}>
        <p className="text-[12px] text-vyro-mute">Every leaderboard is built from verified VYRO data.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {CATEGORIES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setCategory(id)}
              className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-[12px] font-semibold transition-colors ${
                category === id
                  ? "border-vyro-text bg-vyro-text/5 text-vyro-text"
                  : "border-vyro-line bg-vyro-panel text-vyro-mute"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </Card>

      {CHALLENGES.map((ch) => (
        <ChallengeCard key={ch.cadence + ch.title} ch={ch} />
      ))}

      <Card eyebrow={category === "school" ? "SCHOOL VS SCHOOL" : CATEGORIES.find(c => c.id === category)?.label.toUpperCase()}>
        <div className="mb-3 flex items-center justify-between">
          <Pill tone="live" pulse>LIVE</Pill>
          <Pill tone="neutral">No prize</Pill>
        </div>
        <div className="text-base font-bold text-vyro-text">{match.title}</div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-vyro-mute">{match.subtitle}</div>
        <Leaderboard rows={match.rows} />
      </Card>

      <Card eyebrow="Prize / challenge engine" title="Verified entry, prize status, and anti-cheat rules" action={<Pill tone="warn">Interface only</Pill>}>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
          <InfoTile head="Entry status" body="Eligible · 4 verified sessions this week" />
          <InfoTile head="Prize escrow" body="Weekly $20 · Monthly $100 · Season $1K · Year $5K" />
          <InfoTile head="Verification" body="Band sync + session tag + anomaly check" />
          <InfoTile head="Anti-cheat" body="Outlier review before payout" />
        </div>
      </Card>

      <ChatCard title={CHAT_THREAD_TITLES[category]} />
    </div>
  );
}

function ChallengeCard({ ch }: { ch: Challenge }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-md border border-vyro-line bg-vyro-elev px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-vyro-mute">
          {ch.cadence}
        </span>
        {ch.prize ? (
          <span className="rounded-md border border-vyro-amber/50 bg-vyro-amber/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-vyro-amber">
            Prize {ch.prize}
          </span>
        ) : (
          <span className="rounded-md border border-vyro-line bg-vyro-panel px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-vyro-mute">
            No prize
          </span>
        )}
      </div>
      <div className="text-base font-bold leading-tight text-vyro-text">{ch.title}</div>
      <div className="mt-1 text-[12px] text-vyro-mute">{ch.rule}</div>
      <Leaderboard rows={ch.rows} />
    </Card>
  );
}

function Leaderboard({ rows }: { rows: Row[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {rows.map((row) => (
        <li key={row.r} className="flex items-center gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-vyro-elev font-mono text-[11px] font-bold text-vyro-text">
            {row.r}
          </span>
          <span className="w-[28%] shrink-0 truncate text-sm font-semibold text-vyro-text">{row.n}</span>
          <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-vyro-elev">
            <div
              className="h-full rounded-full bg-vyro-text/85"
              style={{ width: `${row.pct}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-right font-mono text-sm font-black tabular-nums text-vyro-text">{row.v}</span>
        </li>
      ))}
    </ul>
  );
}

function InfoTile({ head, body }: { head: string; body: string }) {
  return (
    <div className="rounded-xl border border-vyro-line bg-vyro-elev p-2.5">
      <div className="font-mono text-[9px] uppercase tracking-wider text-vyro-mute">{head}</div>
      <div className="mt-0.5 text-[12px] font-semibold text-vyro-text">{body}</div>
    </div>
  );
}

function ChatCard({ title }: { title: string }) {
  const [draft, setDraft] = useState("");
  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-vyro-mute">
            <MessageCircle className="h-3 w-3" />
            Competition chat
          </div>
          <div className="mt-1 text-base font-bold text-vyro-text">{title}</div>
        </div>
        <span className="rounded-md border border-vyro-line bg-vyro-panel px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-vyro-text">
          Live channel
        </span>
      </div>
      <p className="text-[12px] text-vyro-mute">
        Private group chat for the active competition. No prize pool; just verified leaderboard pressure.
      </p>
      <ul className="mt-3 space-y-2">
        {CHAT_MESSAGES.map((m, i) => (
          <li key={i} className="flex gap-2.5 rounded-2xl border border-vyro-line bg-vyro-elev p-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-vyro-panel font-mono text-[10px] font-bold text-vyro-text">
              {m.initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-vyro-text">{m.who}</div>
              <div className="text-[12px] text-vyro-mute">{m.text}</div>
            </div>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setDraft("");
        }}
        className="mt-3 flex items-center gap-2 rounded-full border border-vyro-line bg-vyro-panel px-3 py-1.5"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message school vs school…"
          className="flex-1 bg-transparent text-[12px] text-vyro-text outline-none placeholder:text-vyro-mute"
        />
        <button
          type="submit"
          className="grid h-7 w-7 place-items-center rounded-full border border-vyro-line text-vyro-text"
          aria-label="Send message"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </Card>
  );
}
