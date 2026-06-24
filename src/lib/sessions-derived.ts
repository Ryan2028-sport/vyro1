// Pure helpers that turn raw `sessions` rows from Supabase into the trend
// cards / coach insights surfaced by TrendsView and CoachView. Kept
// isomorphic + dependency-free so it can be unit-tested without a band.

export type RawSession = {
  id: string;
  sport: string | null;
  started_at: string;
  ended_at: string | null;
  swing_count: number | null;
  rapid_count: number | null;
  burst_count: number | null;
  dir_change_count: number | null;
  summary: Record<string, unknown> | null;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function summaryNumber(s: RawSession["summary"], key: string): number | null {
  if (!s) return null;
  return num((s as Record<string, unknown>)[key]);
}

export function durationMin(s: RawSession): number {
  if (!s.ended_at) return 0;
  return Math.max(0, (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60_000);
}

// Single-session "agility score" 0–100: blend of event density and reaction.
// More events per minute and lower min-reaction = higher score.
export function agilityScore(s: RawSession): number | null {
  const dur = durationMin(s);
  if (dur <= 0) return null;
  const events =
    (s.swing_count ?? 0) + (s.burst_count ?? 0) + (s.dir_change_count ?? 0) + (s.rapid_count ?? 0);
  const density = events / dur; // events/min
  const react = summaryNumber(s.summary, "reactMin");
  const densityPart = Math.min(100, density * 6); // 16+ ev/min ≈ 96
  const reactPart = react == null ? 50 : Math.max(0, Math.min(100, 100 - (react - 120) / 4));
  return Math.round(densityPart * 0.6 + reactPart * 0.4);
}

// Swing force consistency 0–100: inverse of coefficient of variation of peakG.
export function swingConsistency(sessions: RawSession[]): number | null {
  const peaks = sessions
    .map((s) => summaryNumber(s.summary, "peakG"))
    .filter((v): v is number => v != null && v > 0);
  if (peaks.length < 3) return null;
  const mean = peaks.reduce((a, b) => a + b, 0) / peaks.length;
  const variance = peaks.reduce((a, b) => a + (b - mean) ** 2, 0) / peaks.length;
  const cv = Math.sqrt(variance) / (mean || 1);
  return Math.round(Math.max(0, Math.min(100, (1 - cv) * 100)));
}

// Average T-control across sessions (already 0–100 in summary).
export function avgTControl(sessions: RawSession[]): number | null {
  const xs = sessions
    .map((s) => summaryNumber(s.summary, "tControlPct"))
    .filter((v): v is number => v != null);
  if (!xs.length) return null;
  return Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
}

// Average min reaction across sessions in ms.
export function avgReactMs(sessions: RawSession[]): number | null {
  const xs = sessions
    .map((s) => summaryNumber(s.summary, "reactMin"))
    .filter((v): v is number => v != null);
  if (!xs.length) return null;
  return Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
}

export function withinDays(s: RawSession, days: number, ref = Date.now()): boolean {
  const t = new Date(s.started_at).getTime();
  return ref - t <= days * 86_400_000;
}

// Build a generic trend card: current window vs previous window.
export type TrendCard = {
  label: string;
  unit: string;
  current: number | null;
  previous: number | null;
  deltaPct: number | null;
  progress: number; // 0..100 for the bar
  spark: number[]; // last N daily points
  higherIsBetter: boolean;
};

function dailyAverage(
  sessions: RawSession[],
  days: number,
  reduce: (s: RawSession) => number | null,
  ref = Date.now(),
): number[] {
  const buckets: number[][] = Array.from({ length: days }, () => []);
  for (const s of sessions) {
    const age = Math.floor((ref - new Date(s.started_at).getTime()) / 86_400_000);
    if (age < 0 || age >= days) continue;
    const v = reduce(s);
    if (v != null) buckets[days - 1 - age].push(v);
  }
  let last = 0;
  return buckets.map((b) => {
    if (!b.length) return last;
    last = b.reduce((a, x) => a + x, 0) / b.length;
    return Math.round(last);
  });
}

function pickAvg(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function buildTrendCards(
  sessions: RawSession[],
  baselines: { hrvMs?: number | null; restingHrBpm?: number | null; reactMs?: number | null } | null,
  sleepScores: number[], // most-recent-first list of nightly sleep scores
): TrendCard[] {
  const ref = Date.now();
  const last14 = sessions.filter((s) => withinDays(s, 14, ref));
  const prev14 = sessions.filter((s) => !withinDays(s, 14, ref) && withinDays(s, 28, ref));

  // Agility
  const agilityCur = pickAvg(last14.map(agilityScore).filter((v): v is number => v != null));
  const agilityPrev = pickAvg(prev14.map(agilityScore).filter((v): v is number => v != null));

  // Resting HR — use baseline number if present, otherwise null
  const rhrCur = baselines?.restingHrBpm ?? null;

  // T-control
  const tCur = avgTControl(last14);
  const tPrev = avgTControl(prev14);

  // Swing consistency
  const swCur = swingConsistency(last14);
  const swPrev = swingConsistency(prev14);

  // Sleep
  const sleepCur = pickAvg(sleepScores.slice(0, 7));
  const sleepPrev = pickAvg(sleepScores.slice(7, 14));

  const mkPct = (cur: number | null, prev: number | null) => {
    if (cur == null || prev == null || prev === 0) return null;
    return ((cur - prev) / prev) * 100;
  };

  return [
    {
      label: "Agility score",
      unit: "/100",
      current: agilityCur != null ? Math.round(agilityCur) : null,
      previous: agilityPrev != null ? Math.round(agilityPrev) : null,
      deltaPct: mkPct(agilityCur, agilityPrev),
      progress: agilityCur ?? 0,
      spark: dailyAverage(sessions, 12, agilityScore, ref),
      higherIsBetter: true,
    },
    {
      label: "Resting HR",
      unit: "bpm",
      current: rhrCur,
      previous: null,
      deltaPct: null,
      progress: rhrCur != null ? Math.max(0, Math.min(100, 100 - (rhrCur - 40))) : 0,
      spark: [],
      higherIsBetter: false,
    },
    {
      label: "T-control",
      unit: "%",
      current: tCur,
      previous: tPrev,
      deltaPct: mkPct(tCur, tPrev),
      progress: tCur ?? 0,
      spark: dailyAverage(sessions, 12, (s) => summaryNumber(s.summary, "tControlPct"), ref),
      higherIsBetter: true,
    },
    {
      label: "Swing force consistency",
      unit: "%",
      current: swCur,
      previous: swPrev,
      deltaPct: mkPct(swCur, swPrev),
      progress: swCur ?? 0,
      spark: [],
      higherIsBetter: true,
    },
    {
      label: "Sleep score",
      unit: "/100",
      current: sleepCur != null ? Math.round(sleepCur) : null,
      previous: sleepPrev != null ? Math.round(sleepPrev) : null,
      deltaPct: mkPct(sleepCur, sleepPrev),
      progress: sleepCur ?? 0,
      spark: sleepScores.slice(0, 12).reverse(),
      higherIsBetter: true,
    },
  ];
}

// Build a single training-load score 0..100 from recent sessions for the
// "today's load target" widget. Higher = more accumulated load.
export function trainingLoad7d(sessions: RawSession[]): number {
  const ref = Date.now();
  let load = 0;
  for (const s of sessions) {
    if (!withinDays(s, 7, ref)) continue;
    const dur = durationMin(s);
    const events =
      (s.swing_count ?? 0) + (s.burst_count ?? 0) + (s.dir_change_count ?? 0) + (s.rapid_count ?? 0);
    load += dur * 0.6 + events * 0.4;
  }
  return Math.min(100, Math.round(load / 4));
}
