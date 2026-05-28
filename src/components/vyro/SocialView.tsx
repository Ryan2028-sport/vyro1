import { Card, PageHeader, Pill } from "./shared";

type Tab = "feed" | "profile" | "group" | "compete";

type Member = {
  name: string;
  initials: string;
  handle: string;
  post: string;
  metric: string;
  likes: number;
  comments: number;
  agility: number;
  recovery: number;
};

const columbiaGroup: Member[] = [
  { name: "Yusuf Sheikh", initials: "YS", handle: "@yusufs", post: "5-game grind vs. Penn. T-control held at 73% through game 5.", metric: "Match win · 3–2", likes: 142, comments: 18, agility: 86, recovery: 81 },
  { name: "Adam Hawal", initials: "AH", handle: "@adamh", post: "Cut my return-to-T by 0.21s over two weeks. Decel quality is finally clean.", metric: "Agility +9%", likes: 98, comments: 11, agility: 88, recovery: 79 },
  { name: "Imad Athar", initials: "IA", handle: "@imada", post: "Sleep score back over 90. Rest HR dropped 3 bpm in 10 days.", metric: "Sleep 92", likes: 76, comments: 7, agility: 82, recovery: 87 },
  { name: "Sam Du", initials: "SD", handle: "@samdu", post: "Forehand consistency up 11% on the swing-path overlay. Coach is happy.", metric: "Swing 91%", likes: 121, comments: 14, agility: 84, recovery: 78 },
  { name: "Ahmad Haq", initials: "AQ", handle: "@ahmadh", post: "First 60-min hit at threshold without HR drift past 165. Aerobic base is real.", metric: "Threshold 60'", likes: 88, comments: 9, agility: 80, recovery: 83 },
  { name: "Shaurya Bawa", initials: "SB", handle: "@shauryab", post: "Boast from back-left dropped opponents to 38% retrieval. Logging it.", metric: "Tactical +14%", likes: 167, comments: 22, agility: 87, recovery: 80 },
  { name: "Thomas Soltanian", initials: "TS", handle: "@thomass", post: "PR session: 612 high-quality decels with <5% asymmetry.", metric: "Symmetry 95%", likes: 134, comments: 16, agility: 89, recovery: 82 },
  { name: "Paarth Ambani", initials: "PA", handle: "@paartha", post: "Cognitive flag cleared. Decision delay back to 38ms baseline.", metric: "Cog −176ms", likes: 64, comments: 6, agility: 81, recovery: 85 },
  { name: "Arhan Chandra", initials: "AC", handle: "@arhanc", post: "Volley kill conversion 64% on loose rails this week. Trusting the wrist.", metric: "Conv 64%", likes: 109, comments: 12, agility: 85, recovery: 77 },
  { name: "Laszlo Godde", initials: "LG", handle: "@laszlog", post: "HRV trending up 8ms over the block. Holding the deload.", metric: "HRV 81ms", likes: 73, comments: 8, agility: 78, recovery: 88 },
];

export function SocialView({ socialTab, setSocialTab }: { socialTab: Tab; setSocialTab: (t: Tab) => void }) {
  const tabs: [Tab, string][] = [
    ["feed", "Feed"],
    ["profile", "Profile"],
    ["group", "VYRO Group"],
    ["compete", "VYRO Compete"],
  ];
  return (
    <>
      <PageHeader
        eyebrow="VYRO Social"
        title="Community · Group · Compete"
        subtitle="Shared receipts. Earned in the corners, not on the timeline."
      />
      <div className="mb-5 flex gap-2 overflow-x-auto">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSocialTab(id)}
            className={`rounded-full border px-4 py-2 text-sm ${
              socialTab === id ? "border-white/25 bg-white/15" : "border-white/10 text-white/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {socialTab === "feed" && <Feed />}
      {socialTab === "profile" && <Profile />}
      {socialTab === "group" && <ColumbiaGroup />}
      {socialTab === "compete" && <Compete />}
    </>
  );
}

function Feed() {
  const posts = columbiaGroup.slice(0, 6);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {posts.map((m) => (
          <Card key={m.name}>
            <div className="flex gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xs font-black">
                {m.initials}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold">{m.name}</div>
                    <div className="font-mono text-[10px] text-white/45">{m.handle} · Columbia</div>
                  </div>
                  <Pill>{m.metric}</Pill>
                </div>
                <p className="mt-2 text-sm text-white/70">{m.post}</p>
                <div className="mt-3 grid aspect-video place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/45">
                  Match clip · swing-path overlay
                </div>
                <div className="mt-3 flex gap-4 text-xs text-white/45">
                  ♡ {m.likes} · {m.comments} comments
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Card>
        <h3 className="font-black">Crowd-Sourced Scout</h3>
        <p className="mt-2 text-sm text-white/55">
          Blind-ranks athletes by normalized Power-to-Fatigue ratio to create a verified performance resume.
        </p>
        <div className="mt-4 space-y-2 text-sm">
          {[...columbiaGroup]
            .sort((a, b) => b.agility + b.recovery - (a.agility + a.recovery))
            .slice(0, 6)
            .map((m, i) => (
              <div key={m.name} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2">
                <span>
                  {i + 1}. {m.name}
                </span>
                <span className="tabular-nums text-white/55">{Math.round((m.agility + m.recovery) / 2)}</span>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}

function ColumbiaGroup() {
  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">Group · invite-only</div>
            <h3 className="mt-1 text-xl font-black">Columbia Squash</h3>
            <p className="mt-1 text-sm text-white/55">10 members · 247 sessions logged this month · 86% avg recovery</p>
          </div>
          <Pill color="amber">live</Pill>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center sm:grid-cols-5">
          <Stat label="Members" value="10" />
          <Stat label="Sessions / 30d" value="247" />
          <Stat label="Avg agility" value="84" />
          <Stat label="Avg recovery" value="82" />
          <Stat label="Win rate" value="71%" />
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {columbiaGroup.map((m) => (
          <Card key={m.name}>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-xs font-black">
                {m.initials}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold">{m.name}</div>
                <div className="font-mono text-[10px] text-white/45">{m.handle}</div>
              </div>
              <Pill>{m.metric}</Pill>
            </div>
            <p className="mt-3 text-xs text-white/65">{m.post}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
              <div className="rounded-lg bg-white/5 py-1.5">
                <b className="text-sm">{m.agility}</b>
                <div className="text-white/45">Agility</div>
              </div>
              <div className="rounded-lg bg-white/5 py-1.5">
                <b className="text-sm">{m.recovery}</b>
                <div className="text-white/45">Recovery</div>
              </div>
              <div className="rounded-lg bg-white/5 py-1.5">
                <b className="text-sm">{m.likes}</b>
                <div className="text-white/45">Likes</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Compete() {
  const ranked = [...columbiaGroup].sort((a, b) => b.agility - a.agility);
  return (
    <Card>
      <h3 className="font-black">VYRO Compete · Columbia leaderboard</h3>
      <p className="mt-2 text-sm text-white/55">
        Leaderboards by sport, sleep score, recovery, sessions, agility, and verified performance receipts.
      </p>
      <div className="mt-5 space-y-2">
        {ranked.map((m, i) => (
          <div key={m.name} className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-3">
            <div className="w-6 text-center font-mono text-xs text-white/45">{i + 1}</div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-[11px] font-black">
              {m.initials}
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold">{m.name}</div>
              <div className="font-mono text-[10px] text-white/45">{m.handle}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-black tabular-nums">{m.agility}</div>
              <div className="text-[10px] text-white/45">Agility</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-black tabular-nums">{m.recovery}</div>
              <div className="text-[10px] text-white/45">Recovery</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] py-2">
      <div className="text-xl font-black tabular-nums">{value}</div>
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">{label}</div>
    </div>
  );
}

function Profile() {
  return (
    <Card>
      <div className="text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-white/20 bg-white/10 text-2xl font-black">
          RC
        </div>
        <h3 className="mt-3 text-xl font-black">Ryan Chen</h3>
        <p className="font-mono text-xs text-white/45">@ryanchen · Squash · Columbia</p>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div><b className="text-2xl">28</b><br /><span className="text-xs text-white/45">Posts</span></div>
          <div><b className="text-2xl">412</b><br /><span className="text-xs text-white/45">Followers</span></div>
          <div><b className="text-2xl">86</b><br /><span className="text-xs text-white/45">Following</span></div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-white/[0.06] border border-white/10" />
          ))}
        </div>
      </div>
    </Card>
  );
}
