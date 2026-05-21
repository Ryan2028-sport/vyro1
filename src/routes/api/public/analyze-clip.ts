import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const InputSchema = z.object({
  videoName: z.string().min(1).max(255),
  durationSec: z.number().min(0).max(60 * 60 * 3),
  frames: z.array(z.string().min(10).max(900_000)).min(1).max(24),
  frameTimes: z.array(z.number().min(0).max(60 * 60 * 3)).max(24).optional(),
});

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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/analyze-clip")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.apivyro;
        if (!apiKey) return json({ error: "Claude API key not configured." });

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }

        const parsed = InputSchema.safeParse(body);
        if (!parsed.success) {
          return json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
        }
        const data = parsed.data;

        const content: Array<Record<string, unknown>> = [];
        data.frames.forEach((b64, i) => {
          const match = b64.match(/^data:(image\/[a-zA-Z+]+);base64,(.*)$/);
          const mediaType = match?.[1] ?? "image/jpeg";
          const raw = match?.[2] ?? b64;
          const stamp = data.frameTimes?.[i];
          content.push({
            type: "text",
            text: `Sample ${i + 1}/${data.frames.length}${typeof stamp === "number" ? ` at ${stamp.toFixed(1)}s` : ""}`,
          });
          content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: raw } });
        });

        content.push({
          type: "text",
          text:
            `Analyze this squash clip in depth: ${data.videoName}, duration ${data.durationSec.toFixed(1)} seconds, ` +
            `${data.frames.length} visual samples across the video.\n\n` +
            `You are an elite squash video analyst. Estimate squash-specific performance metrics from the sampled frames. ` +
            `Do not say you cannot count anything; provide best-estimate ranges compressed to single numbers and mark confidence. ` +
            `Focus on: number of rallies, total shots hit, winners, forced/unforced errors, shot mix (drive/boast/drop/lob/volley), ` +
            `forehand/backhand split, swing path issues, T-control, recovery, explosive first step, footwork, fatigue, and shot selection. ` +
            `Call report_squash_analysis. Make every bullet concrete and based on what is visible or inferred from the full clip samples.`,
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
            return json({ error: `Claude API ${res.status}`, details: txt.slice(0, 500) });
          }
          const response = await res.json() as { content?: Array<{ type: string; name?: string; input?: unknown }> };
          const toolUse = response.content?.find((c) => c.type === "tool_use" && c.name === TOOL.name);
          if (!toolUse?.input) return json({ error: "No analysis returned." });
          return json({ insight: toolUse.input });
        } catch (e) {
          console.error("analyze-clip failed", e);
          return json({ error: e instanceof Error ? e.message : "Unknown error" });
        }
      },
    },
  },
});
