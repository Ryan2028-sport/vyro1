import { useState } from "react";
import { Card, PageHeader, Pill, Stat } from "./shared";

type Tab = "feed" | "profile" | "groups" | "scout" | "compete";

const TABS: { id: Tab; label: string }[] = [
  { id: "feed", label: "Feed" },
  { id: "profile", label: "Profile" },
  { id: "groups", label: "Groups" },
  { id: "scout", label: "Scout" },
  { id: "compete", label: "Compete" },
];

interface Post {
  id: string;
  initials: string;
  name: string;
  time: string;
  body: string;
  sport: string;
  duration: string;
  media: string;
  mediaKind: "VIDEO" | "PHOTO";
  recovery: number;
  fatigue: number;
  likes: number;
  comments: { who: string; text: string }[];
}

const POSTS: Post[] = [
  {
    id: "p1", initials: "AK", name: "Alex K.", time: "2h",
    body: "47-min match · T-control 71% · best decel quality of the month.",
    sport: "Squash", duration: "47m", media: "Back-right rally clip", mediaKind: "VIDEO",
    recovery: 88, fatigue: 41, likes: 24,
    comments: [
      { who: "Coach", text: "That back-right recovery looked sharp." },
      { who: "Teammate", text: "Send the drill." },
    ],
  },
  {
    id: "p2", initials: "KJ", name: "Kira J.", time: "5h",
    body: "Forehand consistency up 9% over 14 days. Swing-path overlay is clean.",
    sport: "Tennis", duration: "1h 12m", media: "Forehand overlay", mediaKind: "PHOTO",
    recovery: 82, fatigue: 49, likes: 38,
    comments: [{ who: "Coach", text: "Clean contact window." }],
  },
  {
    id: "p3", initials: "DR", name: "Diego R.", time: "1d",
    body: "First sub-1.4s return-to-T. Cut 0.18s in two weeks.",
    sport: "Squash", duration: "38m", media: "Return-to-T proof", mediaKind: "VIDEO",
    recovery: 71, fatigue: 58, likes: 56,
    comments: [
      { who: "Coach", text: "Huge jump." },
      { who: "Teammate", text: "Need this program." },
    ],
  },
];

const GROUPS = [
  { id: "g1", name: "Yale Squash · 2026", members: 18, verified: true, posts: 142 },
  { id: "g2", name: "DC Pro Squash Crew", members: 26, verified: true, posts: 318 },
  { id: "g3", name: "Northeast Tennis Open", members: 64, verified: false, posts: 71 },
];

const SCOUT_RANKINGS = [
  { rank: 1, name: "Alex K.", sport: "Squash", region: "Princeton", grade: "A+", percentile: 96 },
  { rank: 2, name: "Kira J.", sport: "Tennis", region: "Florida", grade: "A", percentile: 92 },
  { rank: 3, name: "Ryan Chen", sport: "Squash", region: "Yale 2026", grade: "A−", percentile: 87 },
  { rank: 4, name: "Diego R.", sport: "Squash", region: "Yale 2026", grade: "B+", percentile: 82 },
  { rank: 5, name: "Shiv Patel", sport: "Squash", region: "Imperial", grade: "B+", percentile: 79 },
];

const COMPETE_CATEGORIES = ["School vs School", "Club vs Club", "Group vs Group", "Squash Global", "Tennis Global"];
const LEADERS_SLEEP = [
  { rank: 1, name: "Alex K.", v: 92 },
  { rank: 2, name: "Kira J.", v: 89 },
  { rank: 3, name: "Ryan Chen", v: 87 },
];
const LEADERS_SESSIONS = [
  { rank: 1, name: "Ryan Chen", v: 28 },
  { rank: 2, name: "Alex K.", v: 26 },
  { rank: 3, name: "Shiv Patel", v: 24 },
];

export function SocialView() {
  const [tab, setTab] = useState<Tab>("feed");
  const [composer, setComposer] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PHOTO" | "VIDEO">("PUBLIC");

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="VYRO Social"
        title="Feed · Profile · Groups · Scout · Compete"
        subtitle="Verified athlete network. Posts, groups, scouting, and competitions are backed by VYRO session data."
        action={<Pill tone="live" pulse>Verified</Pill>}
      />

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
              tab === t.id ? "border-vyro-mint bg-vyro-mint text-vyro-ink" : "border-vyro-line bg-vyro-panel text-vyro-mute"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "feed" && (
        <>
          <Card eyebrow="Compose" title="Share a session, a stat, or a win…">
            <div className="mb-3 flex items-start gap-2">
              <Avatar initials="RC" />
              <textarea
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                placeholder="Share a session, a stat, or a win…"
                rows={2}
                className="flex-1 rounded-xl border border-vyro-line bg-vyro-panel px-3 py-2 text-sm text-vyro-text outline-none focus:border-vyro-text/40"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(["PUBLIC", "PHOTO", "VIDEO"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setVisibility(v)}
                  className={`rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] ${
                    visibility === v ? "border-vyro-mint bg-vyro-mint/10 text-vyro-mint" : "border-vyro-line bg-vyro-panel text-vyro-mute"
                  }`}
                >{v}</button>
              ))}
              <button className="ml-auto rounded-full bg-vyro-mint px-3 py-1.5 text-[11px] font-bold text-vyro-ink">Publish</button>
            </div>
          </Card>

          {POSTS.map((p) => <PostCard key={p.id} p={p} />)}
        </>
      )}

      {tab === "profile" && (
        <>
          <Card eyebrow="Public profile" title="Ryan Chen">
            <div className="flex items-center gap-3">
              <Avatar initials="RC" size={56} />
              <div>
                <div className="text-base font-bold text-vyro-text">Ryan Chen</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-vyro-mute">@ryanchen · Squash</div>
              </div>
              <button className="ml-auto rounded-full border border-vyro-line bg-vyro-panel px-3 py-1.5 text-[11px] font-semibold text-vyro-mute">Edit profile</button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat label="Posts" value="28" />
              <Stat label="Followers" value="412" />
              <Stat label="Following" value="86" />
            </div>
          </Card>

          <Card eyebrow="Profile stats" title="Crowd-Sourced Scout">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="Recruiter grade" value="A−" />
              <Stat label="Global percentile" value="87" />
              <Stat label="Verified sessions" value="28" />
              <Stat label="Avg recovery" value="79" unit="%" />
              <Stat label="Avg sleep" value="87" unit="/100" />
              <Stat label="Reliability" value="High" />
            </div>
          </Card>

          <Card eyebrow="My posts" title="Recent">
            {POSTS.slice(0, 1).map((p) => <PostCard key={p.id} p={{ ...p, initials: "RC", name: "Ryan Chen" }} />)}
          </Card>
        </>
      )}

      {tab === "groups" && (
        <>
          <Card eyebrow="Find groups" title="Discover">
            <input placeholder="Search clubs, schools, regions…" className="w-full rounded-xl border border-vyro-line bg-vyro-panel px-3 py-2 text-sm text-vyro-text outline-none focus:border-vyro-text/40" />
          </Card>
          {GROUPS.map((g) => (
            <Card key={g.id} eyebrow={g.verified ? "Verified group" : "Group"} title={g.name}>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Members" value={g.members} />
                <Stat label="Posts" value={g.posts} />
                <Stat label="Rank" value="Top 5" />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Pill tone="live">Group chat</Pill>
                <Pill tone="neutral">Ranked stats</Pill>
                {g.verified && <Pill tone="warn">Post enabled · verified</Pill>}
              </div>
            </Card>
          ))}
        </>
      )}

      {tab === "scout" && (
        <>
          <Card eyebrow="Sport-specific Talent ID" title="Ranks athletes against users in the same sport only.">
            <p className="text-[12px] text-vyro-mute">Rank everyone by the metric coaches care about. Use the filters to narrow by sport, region, or grade.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Pill tone="live">Reliability filters · On</Pill>
              <Pill tone="neutral">Same sport only</Pill>
              <Pill tone="neutral">Coach scout view</Pill>
            </div>
          </Card>
          <Card eyebrow="Scout filters · Squash" title="Top 5 this week">
            <ul className="divide-y divide-vyro-line/60">
              {SCOUT_RANKINGS.map((r) => (
                <li key={r.rank} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-vyro-mint/15 font-mono text-[11px] font-bold text-vyro-mint">{r.rank}</span>
                    <div>
                      <div className="text-sm font-bold text-vyro-text">{r.name}</div>
                      <div className="font-mono text-[10px] uppercase tracking-wider text-vyro-mute">{r.sport} · {r.region}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black tabular-nums text-vyro-text">{r.grade}</div>
                    <div className="font-mono text-[9px] text-vyro-mute">pct {r.percentile}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {tab === "compete" && (
        <>
          <Card eyebrow="Prize / challenge engine" title="Verified entry, prize status, and anti-cheat rules">
            <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
              {COMPETE_CATEGORIES.map((c) => (
                <button key={c} className="whitespace-nowrap rounded-full border border-vyro-line bg-vyro-panel px-2.5 py-1 text-[10px] font-semibold text-vyro-mute">{c}</button>
              ))}
            </div>
          </Card>

          <Card eyebrow="Trending leaderboards" title="Sleep score">
            <ul className="divide-y divide-vyro-line/60">
              {LEADERS_SLEEP.map((l) => (
                <li key={l.rank} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-vyro-mint/15 font-mono text-[10px] font-bold text-vyro-mint">{l.rank}</span>
                    <span className="text-sm text-vyro-text">{l.name}</span>
                  </div>
                  <span className="font-mono text-sm font-black tabular-nums text-vyro-text">{l.v}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card eyebrow="Trending leaderboards" title="Sessions">
            <ul className="divide-y divide-vyro-line/60">
              {LEADERS_SESSIONS.map((l) => (
                <li key={l.rank} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-vyro-mint/15 font-mono text-[10px] font-bold text-vyro-mint">{l.rank}</span>
                    <span className="text-sm text-vyro-text">{l.name}</span>
                  </div>
                  <span className="font-mono text-sm font-black tabular-nums text-vyro-text">{l.v}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card eyebrow="Group Compete" title="No prize · interface only">
            <p className="text-[12px] text-vyro-mute">Private group chat for the active competition. Verified-only entries; anti-cheat enforced by VYRO session receipts.</p>
          </Card>
        </>
      )}
    </div>
  );
}

function Avatar({ initials, size = 32 }: { initials: string; size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full bg-vyro-mint/15 font-mono font-bold text-vyro-mint"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >{initials}</div>
  );
}

function PostCard({ p }: { p: Post }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <Avatar initials={p.initials} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-vyro-text">{p.name}</span>
            <span className="font-mono text-[10px] text-vyro-mute">· {p.time}</span>
          </div>
          <p className="mt-1 text-sm text-vyro-text">{p.body}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Pill tone="live">Verified by VYRO</Pill>
            <Pill tone="neutral">{p.sport} · {p.duration}</Pill>
          </div>

          {/* Verified media receipt */}
          <div className="mt-3 overflow-hidden rounded-xl border border-vyro-line">
            <div className="grid aspect-video place-items-center bg-vyro-elev text-[11px] text-vyro-mute">
              {p.media}
            </div>
            <div className="flex items-center justify-between border-t border-vyro-line bg-vyro-panel px-3 py-1.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-mute">
                {p.mediaKind} · Verified VYRO receipt
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-vyro-mint">Receipt #{p.id.toUpperCase()}</span>
            </div>
          </div>

          {/* Stat receipts */}
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <ReceiptTile label="Recovery" value={p.recovery} tone="live" />
            <ReceiptTile label="Fatigue" value={p.fatigue} tone="warn" />
            <ReceiptTile label="Session" value={`${p.sport.charAt(0)} · ${p.duration}`} tone="neutral" />
          </div>

          {/* Reactions */}
          <div className="mt-3 flex items-center gap-3 text-[12px] text-vyro-mute">
            <button className="font-mono">♥ {p.likes}</button>
            <button className="font-mono">💬 {p.comments.length}</button>
          </div>

          {/* Comments */}
          <ul className="mt-2 space-y-1 text-[12px]">
            {p.comments.map((c, i) => (
              <li key={i}>
                <span className="font-semibold text-vyro-text">{c.who}</span>{" "}
                <span className="text-vyro-mute">{c.text}</span>
              </li>
            ))}
          </ul>

          {/* Add comment */}
          <div className="mt-2 flex gap-1.5">
            <input placeholder="Add a comment" className="flex-1 rounded-full border border-vyro-line bg-vyro-panel px-3 py-1.5 text-[12px] text-vyro-text outline-none focus:border-vyro-text/40" />
            <button className="rounded-full bg-vyro-mint px-3 py-1.5 text-[11px] font-bold text-vyro-ink">Post</button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ReceiptTile({ label, value, tone }: { label: string; value: any; tone: "live" | "warn" | "neutral" }) {
  const cls = tone === "live" ? "border-vyro-mint/40 bg-vyro-mint/10 text-vyro-mint"
    : tone === "warn" ? "border-vyro-amber/40 bg-vyro-amber/10 text-vyro-amber"
    : "border-vyro-line bg-vyro-elev text-vyro-mute";
  return (
    <div className={`rounded-lg border px-2 py-1.5 text-center ${cls}`}>
      <div className="font-mono text-[8px] uppercase tracking-[0.18em] opacity-80">{label}</div>
      <div className="text-sm font-black tabular-nums">{value}</div>
    </div>
  );
}
