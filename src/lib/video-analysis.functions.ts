import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  videoName: z.string().min(1).max(255),
  durationSec: z.number().min(0).max(60 * 60 * 3),
  frames: z.array(z.string().min(10).max(2_500_000)).min(1).max(6),
});

export type SquashInsight = {
  headline: string;
  summary: string;
  explosiveSteps: string[];
  swingDetection: string[];
  tCourt: string[];
  shotSelection: string[];
  loadRecovery: string[];
  coachNotes: string[];
};

const TOOL = {
  name: "report_squash_analysis",
  description: "Return a structured squash performance breakdown derived from the video frames.",
  input_schema: {
    type: "object",
    properties: {
      headline: { type: "string" },
      summary: { type: "string" },
      explosiveSteps: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6 },
      swingDetection: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6 },
      tCourt: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6 },
      shotSelection: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6 },
      loadRecovery: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6 },
      coachNotes: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
    },
    required: [
      "headline","summary","explosiveSteps","swingDetection",
      "tCourt","shotSelection","loadRecovery","coachNotes",
    ],
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
      content.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data: raw },
      });
      content.push({ type: "text", text: `Frame ${i + 1} of ${data.frames.length}` });
    });
    content.push({
      type: "text",
      text:
        `Clip: ${data.videoName} (${data.durationSec.toFixed(1)}s).\n` +
        `You are an elite squash performance coach. From these frames, infer rally dynamics ` +
        `and produce a squash-specific breakdown. Use concrete, observable detail (lunge depth, ` +
        `swing path, T-recovery, shot choice, fatigue signals). If frames are limited, give ` +
        `well-reasoned coaching hypotheses and label them as such. Call report_squash_analysis.`,
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
          max_tokens: 1500,
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
