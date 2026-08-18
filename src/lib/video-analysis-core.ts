// Shared (browser-safe) schema + prompt builder for the AI squash video
// analyser. Both the server function and the public HTTP route import this so
// there is exactly one contract.
import { z } from "zod";

export const ZONE_KEYS = [
  "front-forehand", "front-centre", "front-backhand",
  "mid-forehand", "mid-centre", "mid-backhand",
  "back-forehand", "back-centre", "back-backhand",
] as const;

export const ClipInputSchema = z.object({
  videoName: z.string().min(1).max(255),
  durationSec: z.number().min(0).max(60 * 60 * 3),
  frames: z.array(z.string().min(10).max(900_000)).min(1).max(16),
  frameTimes: z.array(z.number().min(0).max(60 * 60 * 3)).max(16).optional(),
  sampleEverySec: z.number().min(0.1).max(10).optional(),
  motionTimeline: z.array(z.object({
    t: z.number().min(0).max(60 * 60 * 3),
    motion: z.number().min(0).max(100),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    zone: z.string().min(3).max(32),
    brightness: z.number().min(0).max(255),
  })).max(900).optional(),
  shotCandidates: z.array(z.object({
    t: z.number().min(0).max(60 * 60 * 3),
    motion: z.number().min(0).max(100),
    zone: z.string().min(3).max(32),
    actor: z.enum(["player", "opponent", "unknown"]).optional(),
  })).max(400).optional(),
  tReturnEvents: z.array(z.object({
    t: z.number().min(0).max(60 * 60 * 3),
    secondsToT: z.number().min(0).max(120),
  })).max(400).optional(),
  playerZoneHistogram: z.array(z.number().min(0).max(100_000)).length(9).optional(),
  opponentZoneHistogram: z.array(z.number().min(0).max(100_000)).length(9).optional(),
  derivedStats: z.object({
    scannedFrames: z.number().min(1).max(2000),
    activeSeconds: z.number().min(0).max(60 * 60 * 3),
    rallyCountEstimate: z.number().min(0).max(1000),
    totalShotsEstimate: z.number().min(0).max(5000),
    averageMotion: z.number().min(0).max(100),
    peakMotion: z.number().min(0).max(100),
    highIntensityWindows: z.number().min(0).max(2000),
    tReturnCount: z.number().min(0).max(2000).optional(),
    avgSecondsToT: z.number().min(0).max(120).optional(),
    tTimePercent: z.number().min(0).max(100).optional(),
    longestOffTSeconds: z.number().min(0).max(600).optional(),
    workRestRatio: z.number().min(0).max(50).optional(),
  }).optional(),
});

export type ClipInput = z.infer<typeof ClipInputSchema>;

const Str = z.string().max(400);
const List = (min = 3, max = 8) => z.array(Str).min(min).max(max).catch([]);
const Num = z.number().catch(0);
const Heat = z.array(z.number()).length(9).catch([0, 0, 0, 0, 0, 0, 0, 0, 0]);

export const InsightSchema = z.object({
  headline: Str.catch("Match analysed"),
  summary: z.string().max(1600).catch(""),
  confidence: z.enum(["low", "medium", "high"]).catch("low"),
  metrics: z.object({
    rallyCountEstimate: Num,
    totalShotsEstimate: Num,
    forehandEstimate: Num,
    backhandEstimate: Num,
    volleyEstimate: Num,
    driveEstimate: Num,
    boastEstimate: Num,
    dropEstimate: Num,
    lobEstimate: Num,
    winnersEstimate: Num,
    forcedErrorsEstimate: Num,
    unforcedErrorsEstimate: Num,
    swingPathScore: Num,
    footworkScore: Num,
    shotQualityScore: Num,
  }).partial().catch({}),
  tDiscipline: z.object({
    returnsToT: Num,
    avgSecondsToT: Num,
    tTimePercent: Num,
    longestOffTSeconds: Num,
    note: z.string().max(600).catch(""),
  }).partial().catch({}),
  playerHeatmap: Heat,
  opponentHeatmap: Heat,
  heatmapNote: z.string().max(600).catch(""),
  rallyProfile: z.object({
    rallyCount: Num,
    avgShotsPerRally: Num,
    longestRallyShots: Num,
    workRestRatio: Num,
    fatigueDrift: z.string().max(600).catch(""),
  }).partial().catch({}),
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

export function summarizeMotion(data: ClipInput) {
  const timeline = data.motionTimeline ?? [];
  const floor = Math.max(8, (data.derivedStats?.averageMotion ?? 0) + 4);
  const zoneCounts = timeline.reduce<Record<string, number>>((acc, s) => {
    if (s.motion >= floor) acc[s.zone] = (acc[s.zone] ?? 0) + 1;
    return acc;
  }, {});
  const zones = Object.entries(zoneCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 9)
    .map(([zone, count]) => `${zone}:${count}`)
    .join(", ");
  const shots = (data.shotCandidates ?? [])
    .slice(0, 160)
    .map((s) => `${s.t.toFixed(1)}s/${s.zone}/${s.actor ?? "unknown"}/${s.motion}`)
    .join(" | ");
  const stride = Math.max(1, Math.ceil(timeline.length / 180));
  const compressedTimeline = timeline
    .filter((_, i) => i % stride === 0)
    .map((s) => `${s.t.toFixed(1)}:${s.motion}:${s.zone}`)
    .join(" | ");
  const tReturns = (data.tReturnEvents ?? [])
    .slice(0, 120)
    .map((e) => `${e.t.toFixed(1)}s→${e.secondsToT.toFixed(1)}s`)
    .join(" | ");
  const heat = (h?: number[]) =>
    h ? ZONE_KEYS.map((k, i) => `${k}:${h[i] ?? 0}`).join(", ") : "not measured";
  return {
    zones,
    shots,
    compressedTimeline,
    tReturns,
    playerHeat: heat(data.playerZoneHistogram),
    opponentHeat: heat(data.opponentZoneHistogram),
  };
}

export const SYSTEM_PROMPT =
  "You are an elite squash coach and match analyst. You receive whole-video motion telemetry " +
  "computed in the browser (every checkpoint of the clip) plus a handful of evidence frames. " +
  "Use the telemetry as the primary source for counts, court occupancy and rhythm; use the frames " +
  "to verify posture, racket preparation, court position and swing path. Never invent precision you " +
  "do not have — state limitations instead. Reply with STRICT JSON only, no markdown.";

export function buildUserPrompt(data: ClipInput): string {
  const m = summarizeMotion(data);
  const zoneList = ZONE_KEYS.join(", ");
  return (
    `Squash match video: ${data.videoName}, duration ${data.durationSec.toFixed(1)}s.\n` +
    `The browser scanned ${data.derivedStats?.scannedFrames ?? data.motionTimeline?.length ?? data.frames.length} checkpoints every ${data.sampleEverySec ?? "?"}s and selected ${data.frames.length} evidence frames near key moments.\n\n` +
    `Whole-video derived stats: ${JSON.stringify(data.derivedStats ?? {})}\n` +
    `Active court zones: ${m.zones || "not enough signal"}\n` +
    `Shot/contact candidates (time/zone/actor/motion): ${m.shots || "none detected"}\n` +
    `Recovery-to-T events (shot time → seconds to reach the T): ${m.tReturns || "none detected"}\n` +
    `Measured player shot-location mass per zone: ${m.playerHeat}\n` +
    `Measured opponent shot-location mass per zone: ${m.opponentHeat}\n` +
    `Compressed motion timeline (time:motion:zone): ${m.compressedTimeline}\n\n` +
    `Return JSON with EXACTLY these keys:\n` +
    `headline (string), summary (3-5 sentences), confidence ("low"|"medium"|"high"),\n` +
    `metrics: { rallyCountEstimate, totalShotsEstimate, forehandEstimate, backhandEstimate, volleyEstimate, driveEstimate, boastEstimate, dropEstimate, lobEstimate, winnersEstimate, forcedErrorsEstimate, unforcedErrorsEstimate, swingPathScore (0-100), footworkScore (0-100), shotQualityScore (0-100) },\n` +
    `tDiscipline: { returnsToT, avgSecondsToT, tTimePercent, longestOffTSeconds, note },\n` +
    `playerHeatmap: array of 9 numbers 0-100 in this exact zone order [${zoneList}],\n` +
    `opponentHeatmap: same 9-zone order for the opponent, heatmapNote (string),\n` +
    `rallyProfile: { rallyCount, avgShotsPerRally, longestRallyShots, workRestRatio, fatigueDrift },\n` +
    `timeline: 4-8 items { time, phase, observation, keyShot, coachingCue },\n` +
    `shotBreakdown, swingPath, explosiveSteps, tCourt, shotSelection, loadRecovery, coachNotes, developmentPlan, videoEvidence: arrays of 4-6 short strings each,\n` +
    `limitations: 2-4 strings naming what the camera angle prevented.\n` +
    `Normalise both heatmaps so the busiest zone is 100. Ground T-discipline numbers in the recovery-to-T events above.`
  );
}

export function parseInsight(raw: string): SquashInsight | null {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    const parsed = InsightSchema.safeParse(obj);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function buildGatewayBody(data: ClipInput) {
  const content: Array<Record<string, unknown>> = [];
  data.frames.forEach((b64, i) => {
    const stamp = data.frameTimes?.[i];
    content.push({
      type: "text",
      text: `Evidence frame ${i + 1}/${data.frames.length}${typeof stamp === "number" ? ` at ${stamp.toFixed(1)}s` : ""}`,
    });
    content.push({ type: "image_url", image_url: { url: b64 } });
  });
  content.push({ type: "text", text: buildUserPrompt(data) });
  return {
    model: "google/gemini-2.5-pro",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content },
    ],
    response_format: { type: "json_object" },
  };
}
