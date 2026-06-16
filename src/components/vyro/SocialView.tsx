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
  { id: "g1", name: "Yale Squash · 2026", sport: "Squash", members: 14, online: 3, joined: true },
  { id: "g2", name: "DC Pro Squash Crew", sport: "Squash", members: 22, online: 5, joined: true },
  { id: "g3", name: "Northeast Tennis Open", sport: "Tennis", members: 38, online: 0, joined: false },
  { id: "g4", name: "Mid-Atlantic Baseball Lab", sport: "Baseball", members: 41, online: 6, joined: false },
];

const GROUP_MEMBERS = [
  { name: "Ryan Chen", role: "ACTIVE" },
  { name: "Alex K.", role: "ACTIVE" },
  { name: "Diego R.", role: "ACTIVE" },
  { name: "Shiv Patel", role: "COACH" },
  { name: "Coach M.", role: "COACH" },
];

const GROUP_RANKED = [
  { rank: 1, name: "Alex K.", metric: "Agility", v: 92 },
  { rank: 2, name: "Ryan Chen", metric: "T-control", v: 78 },
  { rank: 3, name: "Diego R.", metric: "Ghosting reps", v: 4280 },
];

const GROUP_CHAT = [
  { who: "Coach M.", text: "Practice 4pm. Bring watches charged." },
  { who: "Alex K.", text: "Recovery 88 today. Locked in." },
  { who: "Ryan C.", text: "I'm pushing back-left coverage first." },
];

const SCOUT_SPORTS = ["Squash", "Tennis", "Baseball", "Basketball", "Football", "Golf", "Hockey", "Soccer"];
const SCOUT_METRICS = [
  "Overall avg", "Sleep", "Recovery", "Sub-25% → 80%", "T-control", "Agility",
  "Cardio fitness", "Court distance", "Heat-map speed", "Overnight recovery", "Readiness / sleep",
];
const SCOUT_RANKINGS = [
  { rank: 1, name: "Ryan Chen", org: "Columbia / VYRO", region: "Northeast", sessions: 28, avg: 94 },
  { rank: 2, name: "Alex K.", org: "Yale Squash · 2026", region: "Northeast", sessions: 26, avg: 91 },
  { rank: 3, name: "Diego R.", org: "DC Pro Squash Crew", region: "Mid-Atlantic", sessions: 19, avg: 88 },
  { rank: 4, name: "Shiv Patel", org: "VYRO", region: "Northeast", sessions: 24, avg: 84 },
  { rank: 5, name: "Marcus W.", org: "Princeton", region: "Northeast", sessions: 22, avg: 81 },
];
const SCOUT_PROFILE_AXES = [
  { label: "Sleep reliability", tag: "off-court" },
  { label: "Live recovery", tag: "body care" },
  { label: "Heat-map load", tag: "court work" },
  { label: "T-control", tag: "sport skill" },
];
const SCOUT_RELIABILITY = [
  "Verified sessions", "Same sport only", "Sleep discipline", "Overnight recovery", "Readiness consistency",
];

const COMPETE_CATEGORIES = ["School vs School", "Club vs Club", "Group vs Group", "Squash Global", "Tennis Global"];
const CHALLENGES = [
  {
    cadence: "WEEKLY", prize: "$20",
    title: "Best % average T-control",
    rule: "Minimum 3 logged sessions",
    rows: [{ r: 1, n: "Ryan Chen", v: "78%" }, { r: 2, n: "Alex K.", v: "76%" }, { r: 3, n: "Diego R.", v: "73%" }],
  },
  {
    cadence: "MONTHLY", prize: "$100",
    title: "Best avg Agility score",
    rule: "Verified sessions only",
    rows: [{ r: 1, n: "Alex K.", v: "92" }, { r: 2, n: "Ryan Chen", v: "90" }, { r: 3, n: "Kira J.", v: "88" }],
  },
  {
    cadence: "SEASON", prize: "$1K",
    title: "Most aggregated court distance covered",
    rule: "Season-long verified match + training load",
    rows: [{ r: 1, n: "Diego R.", v: "128 km" }, { r: 2, n: "Ryan Chen", v: "121 km" }, { r: 3, n: "Shiv Patel", v: "109 km" }],
  },
  {
    cadence: "YEAR", prize: "$5K",
    title: "Best avg time to recover to 80% after dropping below 25%",
    rule: "Requires post-session live recovery dip below 25%",
    rows: [{ r: 1, n: "Ryan Chen", v: "11m" }, { r: 2, n: "Alex K.", v: "13m" }, { r: 3, n: "Kira J.", v: "15m" }],
  },
];

const PROFILE_POSTS = [
  { title: "Back-left pressure rally", meta: "T-control 78%" },
  { title: "Recovery day receipt", meta: "Recovery 82" },
  { title: "Swing path overlay", meta: "Racket speed +7%" },
  { title: "League match win", meta: "W 3-1" },
  { title: "Ghosting block", meta: "1.38s return" },
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
          <Card>
            <div className="flex items-center gap-3">
              <Avatar initials="RC" size={56} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold text-vyro-text">Ryan Chen</span>
                  <Pill tone="live">Verified athlete</Pill>
                </div>
                <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-vyro-mute">@ryanchen · Squash · Columbia squash</div>
              </div>
              <button className="ml-auto rounded-full border border-vyro-line bg-vyro-panel px-3 py-1.5 text-[11px] font-semibold text-vyro-mute">Edit profile</button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat label="Posts" value="28" />
              <Stat label="Followers" value="412" />
              <Stat label="Following" value="86" />
            </div>
          </Card>

          <Card eyebrow="Profile stats" title="Verified averages">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Best T-control" value="82" unit="%" />
              <Stat label="Avg recovery" value="78" />
              <Stat label="Agility rank" value="#3" unit="squash" />
              <Stat label="Live recovery PR" value="11m" unit="to 80%" />
            </div>
          </Card>

          <Card eyebrow="Posts" title="Recent receipts">
            <ul className="divide-y divide-vyro-line/60">
              {PROFILE_POSTS.map((p) => (
                <li key={p.title} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-vyro-text">{p.title}</div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-vyro-mute">{p.meta}</div>
                  </div>
                  <Pill tone="live">Verified</Pill>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {tab === "groups" && (
        <>
          <Card eyebrow="Find groups" title={`${GROUPS.length} shown`}>
            <input placeholder="Search clubs, schools, regions…" className="w-full rounded-xl border border-vyro-line bg-vyro-panel px-3 py-2 text-sm text-vyro-text outline-none focus:border-vyro-text/40" />
            <ul className="mt-3 divide-y divide-vyro-line/60">
              {GROUPS.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Pill tone={g.joined ? "live" : "neutral"}>{g.joined ? "Joined" : "Discover"}</Pill>
                      <span className="text-sm font-bold text-vyro-text">{g.name}</span>
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-vyro-mute">
                      {g.sport} · {g.members} members · {g.online} online
                    </div>
                  </div>
                  <button className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                    g.joined ? "border border-vyro-line bg-vyro-panel text-vyro-mute" : "bg-vyro-mint text-vyro-ink"
                  }`}>{g.joined ? "Leave" : "Join"}</button>
                </li>
              ))}
            </ul>
            <button className="mt-3 w-full rounded-xl border border-dashed border-vyro-line bg-vyro-panel px-3 py-2 text-[12px] font-semibold text-vyro-mute">+ Create group</button>
          </Card>

          <Card eyebrow="Group details" title="Yale Squash · 2026">
            <div className="font-mono text-[10px] uppercase tracking-wider text-vyro-mute">Squash · 14 members · 3 online</div>

            <div className="mt-3 font-mono text-[10px] uppercase tracking-wider text-vyro-mute">Members</div>
            <ul className="mt-1 divide-y divide-vyro-line/60">
              {GROUP_MEMBERS.map((m) => (
                <li key={m.name} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-vyro-text">{m.name}</span>
                  <Pill tone={m.role === "COACH" ? "warn" : "live"}>{m.role}</Pill>
                </li>
              ))}
            </ul>

            <div className="mt-3 font-mono text-[10px] uppercase tracking-wider text-vyro-mute">Ranked group statistics</div>
            <ul className="mt-1 divide-y divide-vyro-line/60">
              {GROUP_RANKED.map((r) => (
                <li key={r.rank} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-vyro-mint/15 font-mono text-[10px] font-bold text-vyro-mint">{r.rank}</span>
                    <span className="text-sm text-vyro-text">{r.name}</span>
                    <span className="font-mono text-[10px] text-vyro-mute">· {r.metric}</span>
                  </div>
                  <span className="font-mono text-sm font-black tabular-nums text-vyro-text">{r.v}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card eyebrow="Group chat" title="Live thread">
            <ul className="space-y-1.5">
              {GROUP_CHAT.map((c, i) => (
                <li key={i} className="rounded-xl border border-vyro-line bg-vyro-elev p-2.5">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-vyro-mute">{c.who}</div>
                  <div className="text-[12px] text-vyro-text">{c.text}</div>
                </li>
              ))}
            </ul>
          </Card>

          <Card eyebrow="Group posts" title="Verified receipts only" action={<Pill tone="live">Post enabled</Pill>}>
            <ul className="space-y-1.5">
              {["T-control challenge clip", "Recovery receipt", "Coach drill breakdown"].map((t) => (
                <li key={t} className="flex items-center justify-between rounded-xl border border-vyro-line bg-vyro-elev px-3 py-2">
                  <span className="text-[12px] text-vyro-text">{t}</span>
                  <Pill tone="live">Verified group post</Pill>
                </li>
              ))}
            </ul>
            <button className="mt-3 w-full rounded-full bg-vyro-mint px-3 py-1.5 text-[11px] font-bold text-vyro-ink">Post</button>
          </Card>

          <Card eyebrow="Group compete" title="In-group leaderboards">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <ReceiptTile label="Best avg T-control · Ryan Chen" value="78%" tone="live" />
              <ReceiptTile label="Most sessions · Alex K." value="26" tone="neutral" />
              <ReceiptTile label="Fastest live recovery · Diego R." value="9m 44s" tone="warn" />
            </div>
          </Card>
        </>
      )}

      {tab === "scout" && (
        <>
          <Card eyebrow="Crowd-Sourced Scout" title="Sport-specific Talent ID">
            <p className="text-[12px] text-vyro-mute">Click a global ranking category to see everyone in that sport. Click any athlete to open a detailed average-metrics coach breakdown.</p>
            <div className="-mx-1 mt-3 flex gap-1 overflow-x-auto px-1">
              {SCOUT_SPORTS.map((s, i) => (
                <button key={s} className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                  i === 0 ? "border-vyro-mint bg-vyro-mint text-vyro-ink" : "border-vyro-line bg-vyro-panel text-vyro-mute"
                }`}>{s}</button>
              ))}
            </div>
          </Card>

          <Card eyebrow="Squash global rankings" title="Rank everyone by the metric coaches care about.">
            <div className="font-mono text-[10px] uppercase tracking-wider text-vyro-mute">Verified averages</div>
            <div className="-mx-1 mt-1.5 flex gap-1 overflow-x-auto px-1">
              {SCOUT_METRICS.map((m, i) => (
                <button key={m} className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                  i === 0 ? "border-vyro-mint bg-vyro-mint text-vyro-ink" : "border-vyro-line bg-vyro-panel text-vyro-mute"
                }`}>{m}</button>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-vyro-mute">Composite score across court, recovery, sleep, cardio, and reliability.</p>
          </Card>

          <Card eyebrow={`Full squash ranking · Overall avg`} title={`${SCOUT_RANKINGS.length} global athletes`}>
            <ul className="divide-y divide-vyro-line/60">
              {SCOUT_RANKINGS.map((r) => (
                <li key={r.rank} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-vyro-mint/15 font-mono text-[11px] font-bold text-vyro-mint">{r.rank}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-vyro-text">{r.name}</div>
                      <div className="font-mono text-[9px] uppercase tracking-wider text-vyro-mute">{r.org} · {r.region} · {r.sessions} verified sessions</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[9px] uppercase tracking-wider text-vyro-mute">avg</div>
                    <div className="text-base font-black tabular-nums text-vyro-text">{r.avg}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card eyebrow="Coach scout view" title="Click any athlete for full metrics.">
            <p className="text-[12px] text-vyro-mute">The profile shows average sleep, recovery, live-recovery speed, T-control, agility, cardiovascular fitness, heat-map distance/speed, overnight recovery, and readiness/sleep reliability.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {SCOUT_PROFILE_AXES.map((a) => (
                <div key={a.label} className="rounded-xl border border-vyro-line bg-vyro-elev p-2.5">
                  <div className="text-sm font-semibold text-vyro-text">{a.label}</div>
                  <div className="font-mono text-[9px] uppercase tracking-wider text-vyro-mute">{a.tag}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card eyebrow="Reliability filters" title="Quality gates">
            <ul className="space-y-1.5">
              {SCOUT_RELIABILITY.map((f) => (
                <li key={f} className="flex items-center justify-between rounded-xl border border-vyro-line bg-vyro-elev px-3 py-2">
                  <span className="text-[12px] text-vyro-text">{f}</span>
                  <Pill tone="live">ON</Pill>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {tab === "compete" && (
        <>
          <Card eyebrow="Compete" title="School, club, group, and sport-global competitions." action={<Pill tone="live" pulse>Prizes live</Pill>}>
            <p className="text-[12px] text-vyro-mute">Every leaderboard is built from verified VYRO data.</p>
            <div className="-mx-1 mt-3 flex gap-1 overflow-x-auto px-1">
              {COMPETE_CATEGORIES.map((c, i) => (
                <button key={c} className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                  i === 3 ? "border-vyro-mint bg-vyro-mint text-vyro-ink" : "border-vyro-line bg-vyro-panel text-vyro-mute"
                }`}>{c}</button>
              ))}
            </div>
          </Card>

          <div className="font-mono text-[10px] uppercase tracking-wider text-vyro-mute px-1">Squash global challenges</div>

          {CHALLENGES.map((ch) => (
            <Card
              key={ch.cadence}
              eyebrow={`${ch.cadence} · Prize ${ch.prize}`}
              title={ch.title}
              action={<Pill tone="warn">{ch.prize}</Pill>}
            >
              <p className="text-[11px] text-vyro-mute">{ch.rule}</p>
              <ul className="mt-2 divide-y divide-vyro-line/60">
                {ch.rows.map((row) => (
                  <li key={row.r} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-vyro-mint/15 font-mono text-[10px] font-bold text-vyro-mint">{row.r}</span>
                      <span className="text-sm text-vyro-text">{row.n}</span>
                    </div>
                    <span className="font-mono text-sm font-black tabular-nums text-vyro-text">{row.v}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}

          <Card eyebrow="Prize / challenge engine" title="Verified entry, prize status, and anti-cheat rules" action={<Pill tone="neutral">Interface only</Pill>}>
            <ul className="space-y-1.5 text-[12px]">
              <li className="rounded-xl border border-vyro-line bg-vyro-elev p-2.5">
                <div className="font-mono text-[9px] uppercase tracking-wider text-vyro-mute">Entry status</div>
                <div className="text-vyro-text">Eligible · 4 verified sessions this week</div>
              </li>
              <li className="rounded-xl border border-vyro-line bg-vyro-elev p-2.5">
                <div className="font-mono text-[9px] uppercase tracking-wider text-vyro-mute">Prize escrow</div>
                <div className="text-vyro-text">Weekly $20 · Monthly $100 · Season $1K · Year $5K</div>
              </li>
              <li className="rounded-xl border border-vyro-line bg-vyro-elev p-2.5">
                <div className="font-mono text-[9px] uppercase tracking-wider text-vyro-mute">Verification</div>
                <div className="text-vyro-text">Band sync + session tag + anomaly check</div>
              </li>
              <li className="rounded-xl border border-vyro-line bg-vyro-elev p-2.5">
                <div className="font-mono text-[9px] uppercase tracking-wider text-vyro-mute">Anti-cheat</div>
                <div className="text-vyro-text">Outlier review before payout</div>
              </li>
            </ul>
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
