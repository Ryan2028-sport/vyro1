export const athlete = {
  name: "Ryan Chen",
  first: "Ryan",
  sport: "Squash",
  level: "D1 / National",
  avatar: "RC",
  handle: "@ryanchen",
};

export type HeroMetric = {
  id: string;
  label: string;
  value: number;
  color: "amber" | "teal";
  target: ViewId;
  tab?: string;
};

export const heroMetrics: HeroMetric[] = [
  { id: "fatigue", label: "Fatigue", value: 62, color: "amber", target: "recovery", tab: "fatigue" },
  { id: "recovery", label: "Recovery", value: 78, color: "teal", target: "recovery", tab: "live" },
  { id: "agility", label: "Agility", value: 84, color: "teal", target: "sport", tab: "agility" },
  { id: "sleep", label: "Sleep", value: 87, color: "teal", target: "sleep", tab: "overall" },
];

// NOTE: VYRO band is an IMU-only wearable (per VYRO_BLE_Packet_Reference v1).
// It does NOT measure HR, HRV, SpO2, respiration, skin temp, stress, or steps.
// Live IMU-derived metrics are computed in <LiveMetrics /> from the actual
// event stream — no static vitals array.

export const trendMetrics: [string, string, string, string, string][] = [
  ["Agility Score", "84", "/100", "+10.5%", "Agility score is up 10.5% over the last 12 sessions. Cleaner deceleration back to the T is the biggest driver."],
  ["Resting HR", "48", "bpm", "-5 bpm", "Resting heart rate has dropped by 5 bpm versus the prior month, suggesting improved aerobic fitness."],
  ["T-Control", "82", "%", "+20.6%", "You are winning more middle-court positioning after deep back-right retrievals."],
  ["Swing Force Consistency", "88", "%", "+8.6%", "Swing force consistency is improving late in rallies."],
  ["Sleep Score", "87", "/100", "+7 pts", "The next unlock is reducing wake events after high-load match days."],
];

export const liveSports = ["Squash", "Tennis"];
export const comingSoonSports = ["Baseball", "Basketball", "Football", "Golf", "Hockey", "Soccer"];
export const sports = [...comingSoonSports, ...liveSports];

export type SportProfile = {
  heatmap: boolean;
  motion: string;
  db: string;
  tendency: string[];
};

export const sportProfiles: Record<string, SportProfile> = {
  Squash: { heatmap: true, motion: "Racket swing path", db: "Court coverage + player match database", tendency: ["Back left: straight drive 72% on critical points", "Back right: straight drive 57% on critical points", "Left middle volley: volley kill 48% under pressure", "Right front: counter drop 58% under pressure"] },
  Tennis: { heatmap: true, motion: "Tennis stroke path", db: "Court coverage + rally tendency database", tendency: ["Wide forehand: cross-court 54%", "Backhand corner: slice reset 38%", "Serve + one: forehand inside-out 41%", "Break point: first-serve body 47%"] },
  Golf: { heatmap: false, motion: "Golf club path", db: "Course tendency database", tendency: ["Approach over water: tempo speeds up 8%", "Holes 15-18: low-point control drifts", "Par save: grip tension spike predicts thin contact"] },
  Baseball: { heatmap: false, motion: "Bat path + throwing arm slot", db: "Pitch, batter, and throw tendency database", tendency: ["0 outs: fastball up/in 48%", "1 out: changeup usage rises to 31%", "2 outs late: slider away jumps to 44%", "RISP: fastball rate drops 18%"] },
  Football: { heatmap: false, motion: "QB throw shape", db: "Route and coverage tendency database", tendency: ["Third down: quick out rises 38%", "Red zone: slant/flat combination 44%", "Late game: release speed drops under pressure"] },
  Basketball: { heatmap: false, motion: "Jump shot + change-of-direction", db: "Shot and substitution tendency database", tendency: ["Left wing: catch-shoot 42%", "Late clock: high ball screen 51%", "Fatigue: closeout speed decays 14%"] },
  Hockey: { heatmap: false, motion: "Shot release + goalie reaction", db: "Shot location and goalie tendency database", tendency: ["Power play: one-timer left circle 46%", "Breakaway: glove-side high 34%", "Late period: rebound control drops 11%"] },
  Soccer: { heatmap: false, motion: "Kick mechanics + goalie reaction", db: "Shot and keeper tendency database", tendency: ["Right channel: far-post shot 39%", "Penalty pressure: keeper dives left 58%", "Late game: sprint recovery drops 13%"] },
};

export type ViewId =
  | "home"
  | "trends"
  | "session"
  | "sport"
  | "recovery"
  | "sleep"
  | "coach"
  | "social"
  | "video"
  | "diet"
  | "profile";

export const viewTitles: Record<ViewId, string> = {
  home: "Athlete",
  trends: "Trends",
  session: "Session",
  sport: "Sport",
  recovery: "Recovery",
  sleep: "Sleep",
  coach: "Coach",
  social: "Social",
  video: "AI Video Analyzer",
  diet: "Diet Coach",
  profile: "Profile & Band",
};
