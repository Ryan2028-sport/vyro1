import { Card, PageHeader } from "./shared";

type Tab = "feed" | "profile" | "group" | "compete";

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
      {socialTab === "group" && (
        <Card>
          <h3 className="font-black">VYRO Group</h3>
          <p className="mt-2 text-white/55">Team chat, training circles, private squads, and coach announcements.</p>
        </Card>
      )}
      {socialTab === "compete" && (
        <Card>
          <h3 className="font-black">VYRO Compete</h3>
          <p className="mt-2 text-white/55">
            Leaderboards by sport, sleep score, recovery, sessions, agility, and verified performance receipts.
          </p>
        </Card>
      )}
    </>
  );
}

function Feed() {
  const posts = [
    "47-min match · T-control 71% · best decel quality of the month.",
    "Forehand consistency up 9% over 14 days. Swing-path overlay is clean.",
    "First sub-1.4s return-to-T. Cut 0.18s in two weeks.",
  ];
  const initials = ["AK", "KJ", "DR"];
  const names = ["Alex K.", "Kira J.", "Diego R."];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {posts.map((x, i) => (
          <Card key={x}>
            <div className="flex gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xs font-black">
                {initials[i]}
              </div>
              <div className="flex-1">
                <div className="font-bold">{names[i]}</div>
                <p className="mt-2 text-sm text-white/70">{x}</p>
                <div className="mt-3 grid aspect-video place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/45">
                  Photo / Video placeholder
                </div>
                <div className="mt-3 flex gap-4 text-xs text-white/45">
                  ♡ {24 + i * 12} · comments {2 + i}
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
          <div>1. Small-town pitcher · 94</div>
          <div>2. Florida winger · 91</div>
          <div>3. NYC goalie · 88</div>
        </div>
      </Card>
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
        <p className="font-mono text-xs text-white/45">@ryanchen · Squash</p>
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
