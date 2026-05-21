import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  videoName: z.string().min(1).max(255),
  durationSec: z.number().min(0).max(60 * 60 * 3),
  frames: z.array(z.string().min(10).max(900_000)).min(1).max(24),
  frameTimes: z.array(z.number().min(0).max(60 * 60 * 3)).max(24).optional(),
  sampleEverySec: z.number().min(0.25).max(10).optional(),
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
  })).max(240).optional(),
  derivedStats: z.object({
    scannedFrames: z.number().min(1).max(1000),
    activeSeconds: z.number().min(0).max(60 * 60 * 3),
    rallyCountEstimate: z.number().min(0).max(1000),
    totalShotsEstimate: z.number().min(0).max(5000),
    averageMotion: z.number().min(0).max(100),
    peakMotion: z.number().min(0).max(100),
    highIntensityWindows: z.number().min(0).max(1000),
  }).optional(),
});

export type SquashInsight = {
  headline: string;
  summary: string;
  confidence: "low" | "medium" | "high";
  metrics: {
    rallyCountEstimate: number;
    totalShotsEstimate: number;
    forehandEstimate: number;
    backhandEstimate: number;
    volleyEstimate: number;
    driveEstimate: number;
    boastEstimate: number;
    dropEstimate: number;
    lobEstimate: number;
    winnersEstimate: number;
    forcedErrorsEstimate: number;
    unforcedErrorsEstimate: number;
    avgReturnToTSeconds: number;
    tControlPercent: number;
    swingPathScore: number;
    footworkScore: number;
    shotQualityScore: number;
  };
  timeline: Array<{
    time: string;
    phase: string;
    observation: string;
    keyShot: string;
    coachingCue: string;
  }>;
  shotBreakdown: string[];
  swingPath: string[];
  explosiveSteps: string[];
  tCourt: string[];
  shotSelection: string[];
  loadRecovery: string[];
  coachNotes: string[];
  developmentPlan?: string[];
  videoEvidence?: string[];
  limitations?: string[];
};

const TOOL = {
  name: "report_squash_analysis",
  description: "Return a detailed squash performance report from sampled video frames across the full clip.",
  input_schema: {
    type: "object",
    properties: {
      headline: { type: "string" },
      summary: { type: "string" },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      metrics: {
        type: "object",
        properties: {
          rallyCountEstimate: { type: "number" },
          totalShotsEstimate: { type: "number" },
          forehandEstimate: { type: "number" },
          backhandEstimate: { type: "number" },
          volleyEstimate: { type: "number" },
          driveEstimate: { type: "number" },
          boastEstimate: { type: "number" },
          dropEstimate: { type: "number" },
          lobEstimate: { type: "number" },
          winnersEstimate: { type: "number" },
          forcedErrorsEstimate: { type: "number" },
          unforcedErrorsEstimate: { type: "number" },
          avgReturnToTSeconds: { type: "number" },
          tControlPercent: { type: "number" },
          swingPathScore: { type: "number" },
          footworkScore: { type: "number" },
          shotQualityScore: { type: "number" },
        },
        required: ["rallyCountEstimate", "totalShotsEstimate", "forehandEstimate", "backhandEstimate", "volleyEstimate", "driveEstimate", "boastEstimate", "dropEstimate", "lobEstimate", "winnersEstimate", "forcedErrorsEstimate", "unforcedErrorsEstimate", "avgReturnToTSeconds", "tControlPercent", "swingPathScore", "footworkScore", "shotQualityScore"],
      },
      timeline: {
        type: "array",
        minItems: 4,
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            time: { type: "string" },
            phase: { type: "string" },
            observation: { type: "string" },
            keyShot: { type: "string" },
            coachingCue: { type: "string" },
          },
          required: ["time", "phase", "observation", "keyShot", "coachingCue"],
        },
      },
      shotBreakdown: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 8 },
      swingPath: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 8 },
      explosiveSteps: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 8 },
      tCourt: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 8 },
      shotSelection: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 8 },
      loadRecovery: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 8 },
      coachNotes: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 6 },
    },
    required: ["headline", "summary", "confidence", "metrics", "timeline", "shotBreakdown", "swingPath", "explosiveSteps", "tCourt", "shotSelection", "loadRecovery", "coachNotes"],
  },
};

export const analyzeSquashClip = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<{ insight: SquashInsight | null; error: string | null }> => {
    const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.apivyro;
    if (!apiKey) return { insight: null, error: "Claude API key not configured." };

    const content: Array<Record<string, unknown>> = [];
    data.frames.forEach((b64, i) => {
      const match = b64.match(/^data:(image\/[a-zA-Z+]+);base64,(.*)$/);
      const mediaType = match?.[1] ?? "image/jpeg";
      const raw = match?.[2] ?? b64;
      const stamp = data.frameTimes?.[i];
      content.push({ type: "text", text: `Sample ${i + 1}/${data.frames.length}${typeof stamp === "number" ? ` at ${stamp.toFixed(1)}s` : ""}` });
      content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: raw } });
    });
    content.push({
      type: "text",
      text:
        `Analyze this squash clip in depth: ${data.videoName}, duration ${data.durationSec.toFixed(1)} seconds, ${data.frames.length} visual samples across the video.\n\n` +
        `You are an elite squash video analyst. Estimate rallies, total shots hit, winners, errors, shot mix, forehand/backhand split, swing path, T-control, recovery, and footwork. ` +
        `Provide concrete numbers and coaching observations. Call report_squash_analysis.`,
    });

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 3000,
          tools: [TOOL],
          tool_choice: { type: "tool", name: TOOL.name },
          messages: [{ role: "user", content }],
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error("Claude error", res.status, txt);
        return { insight: null, error: `Claude API ${res.status}` };
      }
      const json = await res.json() as { content?: Array<{ type: string; name?: string; input?: SquashInsight }> };
      const toolUse = json.content?.find((c) => c.type === "tool_use" && c.name === TOOL.name);
      if (!toolUse?.input) return { insight: null, error: "No analysis returned." };
      return { insight: toolUse.input, error: null };
    } catch (e) {
      console.error("analyzeSquashClip failed", e);
      return { insight: null, error: e instanceof Error ? e.message : "Unknown error" };
    }
  });
