// Shared (browser-safe) contract for the AI squash video analyser.
//
// Design rule: numbers are either MEASURED in the browser from the video, or
// VERIFIED by the AI against real frames (with the sample size carried along).
// Nothing in this contract lets the model invent a count.
import { z } from "zod";

export const ZONE_KEYS = [
  "front-forehand", "front-centre", "front-backhand",
  "mid-forehand", "mid-centre", "mid-backhand",
  "back-forehand", "back-centre", "back-backhand",
] as const;

export type ZoneKey = (typeof ZONE_KEYS)[number];

const Heat9 = z.array(z.number().min(0).max(100_000)).length(9);

/** Everything the browser measured from the pixels. Never model output. */
export const MeasuredSchema = z.object({
  scannedFrames: z.number().min(1).max(6000),
  sampleEverySec: z.number().min(0.05).max(10),
  scanSeconds: z.number().min(0).max(60 * 60),
  activeSeconds: z.number().min(0).max(60 * 60 * 3),
  restSeconds: z.number().min(0).max(60 * 60 * 3),
  workRestRatio: z.number().min(0).max(50),
  rallyCount: z.number().min(0).max(2000),
  avgShotsPerRally: z.number().min(0).max(200),
  longestRallyShots: z.number().min(0).max(500),
  rallyBuckets: z.object({
    short: z.number().min(0).max(2000),
    medium: z.number().min(0).max(2000),
    long: z.number().min(0).max(2000),
  }),
  contactCount: z.number().min(0).max(5000),
  playerContacts: z.number().min(0).max(5000),
  opponentContacts: z.number().min(0).max(5000),
  tReturnCount: z.number().min(0).max(5000),
  avgSecondsToT: z.number().min(0).max(120),
  medianSecondsToT: z.number().min(0).max(120),
  tTimePercent: z.number().min(0).max(100),
  longestOffTSeconds: z.number().min(0).max(600),
  playerHeatmap: Heat9,
  opponentHeatmap: Heat9,
  playerHeatCounts: Heat9,
  opponentHeatCounts: Heat9,
  twoPlayerTrackPercent: z.number().min(0).max(100),
  averageMotion: z.number().min(0).max(100),
  peakMotion: z.number().min(0).max(100),
  fatigueDriftPercent: z.number().min(-100).max(100),
  /** "tapped" = the user pointed at themselves; "auto" = camera-depth guess. */
  identitySource: z.enum(["tapped", "auto"]).default("auto"),
  /** How often the two players stayed clearly separable, 0-100. */
  identityConfidencePercent: z.number().min(0).max(100).default(0),
});


export type MeasuredStats = z.infer<typeof MeasuredSchema>;

export const FrameMetaSchema = z.object({
  t: z.number().min(0).max(60 * 60 * 3),
  actor: z.enum(["player", "opponent", "unknown"]),
  zone: z.string().min(3).max(32),
  opponentZone: z.string().min(3).max(32).optional(),
});

export const ClipInputSchema = z.object({
  videoName: z.string().min(1).max(255),
  durationSec: z.number().min(0).max(60 * 60 * 3),
  sampleEverySec: z.number().min(0.05).max(10),
  frames: z.array(z.string().min(10).max(900_000)).min(1).max(40),
  frameTimes: z.array(z.number().min(0).max(60 * 60 * 3)).max(40).optional(),
  frameMeta: z.array(FrameMetaSchema).max(40).optional(),
  motionTimeline: z.array(z.object({
    t: z.number().min(0).max(60 * 60 * 3),
    motion: z.number().min(0).max(100),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    zone: z.string().min(3).max(32),
  })).max(600).optional(),
  contacts: z.array(z.object({
    t: z.number().min(0).max(60 * 60 * 3),
    actor: z.enum(["player", "opponent", "unknown"]),
    zone: z.string().min(3).max(32),
    opponentZone: z.string().min(3).max(32).optional(),
    motion: z.number().min(0).max(100),
  })).max(600).optional(),
  tReturnEvents: z.array(z.object({
    t: z.number().min(0).max(60 * 60 * 3),
    secondsToT: z.number().min(0).max(120),
  })).max(600).optional(),
  measured: MeasuredSchema,
});

export type ClipInput = z.infer<typeof ClipInputSchema>;

// ---------------------------------------------------------------------------
// Per-frame AI verification (segment calls)
// ---------------------------------------------------------------------------

export const SIDE = ["forehand", "backhand", "unclear"] as const;
export const DEPTH = ["front", "mid", "back", "unclear"] as const;
export const FAMILY = ["drive", "cross-court", "boast", "drop", "lob", "volley", "serve", "unclear"] as const;

export const FrameLabelSchema = z.object({
  frame: z.number().int().min(1).max(40),
  striking: z.enum(["near", "far", "none", "unclear"]).catch("unclear"),
  side: z.enum(SIDE).catch("unclear"),
  depth: z.enum(DEPTH).catch("unclear"),
  family: z.enum(FAMILY).catch("unclear"),
  racketPrep: z.enum(["high", "low", "late", "unclear"]).catch("unclear"),
  rallyEnd: z.boolean().catch(false),
  note: z.string().max(220).catch(""),
});

export type FrameLabel = z.infer<typeof FrameLabelSchema>;

export const SegmentReplySchema = z.object({
  labels: z.array(FrameLabelSchema).max(40),
});

/** Counts fused from the AI-verified frames — always carries its sample size. */
export type VerifiedCounts = {
  framesSent: number;
  framesLabelled: number;
  playerStrikes: number;
  opponentStrikes: number;
  side: { forehand: number; backhand: number; unclear: number };
  depth: { front: number; mid: number; back: number; unclear: number };
  family: Record<(typeof FAMILY)[number], number>;
  racketPrep: { high: number; low: number; late: number; unclear: number };
  rallyEndFrames: number;
  scaledShotMix: Record<(typeof FAMILY)[number], number> | null;
  notes: string[];
  segmentsOk: number;
  segmentsFailed: number;
};

// ---------------------------------------------------------------------------
// Synthesis output (coaching text only — no invented numbers)
// ---------------------------------------------------------------------------

const Str = z.string().max(400);
const List = (min = 3, max = 8) => z.array(Str).min(min).max(max).catch([]);

export const InsightSchema = z.object({
  headline: Str.catch("Match analysed"),
  summary: z.string().max(1800).catch(""),
  confidence: z.enum(["low", "medium", "high"]).catch("low"),
  tNote: z.string().max(600).catch(""),
  heatmapNote: z.string().max(600).catch(""),
  rallyNote: z.string().max(600).catch(""),
  timeline: z.array(z.object({
    time: Str.catch(""),
    phase: Str.catch(""),
    observation: Str.catch(""),
    keyShot: Str.catch(""),
    coachingCue: Str.catch(""),
  })).max(10).catch([]),
  shotBreakdown: List(),
  swingPath: List(),
  explosiveSteps: List(),
  tCourt: List(),
  shotSelection: List(),
  loadRecovery: List(),
  coachNotes: List(),
  developmentPlan: List(),
  videoEvidence: List(),
  limitations: z.array(Str).max(6).catch([]),
});

export type SquashInsight = z.infer<typeof InsightSchema>;

/** What the UI renders and what gets persisted. */
export type MatchReport = {
  measured: MeasuredStats;
  verified: VerifiedCounts | null;
  insight: SquashInsight | null;
  videoName: string;
  durationSec: number;
};

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

export const VERIFY_SYSTEM =
  "You are a squash video annotator. You look at still frames captured at detected ball-contact moments " +
  "of a squash match and report ONLY what is literally visible in each frame. The camera is behind the " +
  "court, so 'near' means the player closer to the camera (lower in the frame) and 'far' means the player " +
  "further up the court. If you cannot see a strike, or cannot tell a detail, answer 'none' or 'unclear' — " +
  "never guess. Reply with STRICT JSON only, no markdown, no commentary.";

export function buildVerifyPrompt(times: number[], hints: string[]): string {
  const rows = times
    .map((t, i) => `frame ${i + 1}: ${t.toFixed(1)}s${hints[i] ? ` (motion tracker thinks: ${hints[i]})` : ""}`)
    .join("\n");
  return (
    `Annotate these ${times.length} frames from one squash match.\n${rows}\n\n` +
    `Return JSON exactly: {"labels":[{"frame":1,"striking":"near"|"far"|"none"|"unclear",` +
    `"side":"forehand"|"backhand"|"unclear","depth":"front"|"mid"|"back"|"unclear",` +
    `"family":"drive"|"cross-court"|"boast"|"drop"|"lob"|"volley"|"serve"|"unclear",` +
    `"racketPrep":"high"|"low"|"late"|"unclear","rallyEnd":true|false,"note":"<=20 words"}]}\n` +
    `One object per frame, in order. The tracker hint may be wrong — trust the image. ` +
    `Set striking to "none" when no player is mid-swing in that frame. Use "unclear" freely; ` +
    `an honest "unclear" is far more useful than a guess.`
  );
}

export const SYNTHESIS_SYSTEM =
  "You are an elite squash coach writing a match report. You are given (a) numbers MEASURED from the video " +
  "by a computer-vision scan and (b) labels VERIFIED by a vision model on a sample of contact frames. " +
  "You must not invent or restate any number that is not in the data given to you: never produce shot " +
  "counts, winner/error counts or percentages of your own. Quote the given numbers when useful and " +
  "otherwise write qualitative coaching. Name honestly what the camera angle could not confirm. " +
  "Reply with STRICT JSON only, no markdown.";

export function buildSynthesisPrompt(data: ClipInput, verified: VerifiedCounts | null): string {
  const m = data.measured;
  const zone = (h: number[]) => ZONE_KEYS.map((k, i) => `${k}:${h[i] ?? 0}`).join(", ");
  const contacts = (data.contacts ?? [])
    .slice(0, 140)
    .map((c) => `${c.t.toFixed(1)}s/${c.actor}/${c.zone}`)
    .join(" | ");
  const tReturns = (data.tReturnEvents ?? [])
    .slice(0, 100)
    .map((e) => `${e.t.toFixed(1)}→${e.secondsToT.toFixed(1)}s`)
    .join(" | ");

  const verifiedBlock = verified
    ? `VERIFIED BY VISION on ${verified.framesLabelled}/${verified.framesSent} contact frames:\n` +
      `  strikes seen: player(near) ${verified.playerStrikes}, opponent(far) ${verified.opponentStrikes}\n` +
      `  side: ${JSON.stringify(verified.side)}\n  court depth: ${JSON.stringify(verified.depth)}\n` +
      `  shot families: ${JSON.stringify(verified.family)}\n  racket prep: ${JSON.stringify(verified.racketPrep)}\n` +
      `  frames that looked like a rally ending: ${verified.rallyEndFrames}\n` +
      `  annotator notes: ${verified.notes.slice(0, 24).join(" · ")}\n`
    : "VERIFIED BY VISION: none — the frame verification pass did not return usable labels.\n";

  return (
    `Squash match "${data.videoName}", ${data.durationSec.toFixed(1)}s long.\n\n` +
    `MEASURED BY THE SCAN (trust these, they come from the pixels):\n` +
    `  checkpoints ${m.scannedFrames} every ${m.sampleEverySec}s; both players tracked cleanly in ${m.twoPlayerTrackPercent}% of active frames\n` +
    `  contacts detected ${m.contactCount} (you ${m.playerContacts}, opponent ${m.opponentContacts})\n` +
    `  rallies ${m.rallyCount}, avg ${m.avgShotsPerRally} shots/rally, longest ${m.longestRallyShots} shots, buckets ${JSON.stringify(m.rallyBuckets)}\n` +
    `  work ${m.activeSeconds}s vs rest ${m.restSeconds}s (ratio ${m.workRestRatio})\n` +
    `  T discipline: ${m.tReturnCount} returns to the T, avg ${m.avgSecondsToT}s, median ${m.medianSecondsToT}s, ${m.tTimePercent}% of tracked time on the T, longest ${m.longestOffTSeconds}s away\n` +
    `  your shot-location heat map (0-100): ${zone(m.playerHeatmap)}\n` +
    `  opponent heat map (0-100): ${zone(m.opponentHeatmap)}\n` +
    `  motion drift first third vs last third: ${m.fatigueDriftPercent}%\n\n` +
    verifiedBlock +
    `\nContact log (time/who/zone): ${contacts || "none"}\n` +
    `Recovery-to-T events: ${tReturns || "none"}\n\n` +
    `Return JSON with EXACTLY these keys:\n` +
    `headline (string), summary (4-6 sentences), confidence ("low"|"medium"|"high" — base it on track quality and how many frames were verified),\n` +
    `tNote, heatmapNote, rallyNote (1-3 sentences each, interpreting the measured numbers above),\n` +
    `timeline: 4-8 items { time, phase, observation, keyShot, coachingCue } anchored to real timestamps from the contact log,\n` +
    `shotBreakdown, swingPath, explosiveSteps, tCourt, shotSelection, loadRecovery, coachNotes, developmentPlan, videoEvidence: arrays of 4-6 short strings,\n` +
    `limitations: 2-4 strings naming exactly what this camera angle and sample size could NOT establish.\n` +
    `Do NOT output any metric object and do NOT state a count that is absent from the data above.`
  );
}

export function parseJsonObject(raw: string): unknown | null {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function parseInsight(raw: string): SquashInsight | null {
  const obj = parseJsonObject(raw);
  if (!obj) return null;
  const parsed = InsightSchema.safeParse(obj);
  return parsed.success ? parsed.data : null;
}
