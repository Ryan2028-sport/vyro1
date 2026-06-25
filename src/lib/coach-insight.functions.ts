import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Inputs: snapshot of whatever the band currently exposes. Any field can
// be null — the prompt is built dynamically so the model only reasons over
// signals that actually exist.
const InsightInput = z.object({
  sport: z.string().min(1).max(32).default("squash"),
  readiness: z.number().min(0).max(100).nullable().optional(),
  recovery: z.number().min(0).max(100).nullable().optional(),
  sleepScore: z.number().min(0).max(100).nullable().optional(),
  fatigue: z.number().min(0).max(100).nullable().optional(),
  agility: z.number().min(0).max(100).nullable().optional(),
  hrvMs: z.number().min(0).max(300).nullable().optional(),
  restingHrBpm: z.number().min(0).max(200).nullable().optional(),
  currentHrBpm: z.number().min(0).max(220).nullable().optional(),
  stress: z.number().min(0).max(100).nullable().optional(),
  spo2: z.number().min(0).max(100).nullable().optional(),
  skinTempC: z.number().min(20).max(45).nullable().optional(),
  steps: z.number().min(0).max(200_000).nullable().optional(),
  eventsLastMin: z.number().min(0).max(10_000).nullable().optional(),
  peakG: z.number().min(0).max(30).nullable().optional(),
  peakJerk: z.number().min(0).max(2000).nullable().optional(),
  recentSessionLoad: z.number().min(0).max(500).nullable().optional(),
});

export type CoachInsight = {
  headline: string;
  opportunity: string;
  risk: string;
};

const FallbackInsight: CoachInsight = {
  headline: "Waiting on band signals…",
  opportunity: "Once HRV, sleep and load stream from the band, your top opportunity for the day will appear here.",
  risk: "Risk callouts unlock as soon as the band reports recovery, stress and accumulated load.",
};

function buildPrompt(d: z.infer<typeof InsightInput>): string {
  const lines: string[] = [];
  const push = (label: string, v: unknown, unit = "") => {
    if (v == null) return;
    lines.push(`- ${label}: ${v}${unit}`);
  };
  push("Sport", d.sport);
  push("Readiness", d.readiness, "/100");
  push("Recovery", d.recovery, "/100");
  push("Sleep score", d.sleepScore, "/100");
  push("Fatigue", d.fatigue, "/100");
  push("Agility", d.agility, "/100");
  push("HRV (RMSSD)", d.hrvMs, " ms");
  push("Resting HR", d.restingHrBpm, " bpm");
  push("Current HR", d.currentHrBpm, " bpm");
  push("Stress", d.stress, "/100");
  push("SpO₂", d.spo2, "%");
  push("Skin temp", d.skinTempC, "°C");
  push("Steps", d.steps);
  push("Events / min", d.eventsLastMin);
  push("Peak accel", d.peakG, " g");
  push("Peak jerk", d.peakJerk, " g/s");
  push("Recent session load", d.recentSessionLoad);
  return lines.join("\n");
}

export const getCoachInsight = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => InsightInput.parse(i))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    const metricBlock = buildPrompt(data);
    // If we have neither key nor any metrics, return the neutral fallback.
    if (!key || metricBlock.trim().length === 0) return FallbackInsight;

    const system =
      "You are VYRO, a performance coach for racket-sport athletes (default sport: squash). " +
      "Given a snapshot of wearable + recent-session metrics, return a SHORT readiness brief. " +
      "Only reason over the metrics provided — never invent values. " +
      "Tone: confident, specific, plain English, no hedging, no emojis. " +
      "Each field is one sentence (≤ 22 words). " +
      "Output strict JSON: {\"headline\": string, \"opportunity\": string, \"risk\": string}.";

    const user =
      `Athlete metrics right now:\n${metricBlock}\n\n` +
      "Write the brief now. Headline: 6–9 words summarizing today's state. " +
      "Opportunity: the single highest-leverage thing to push today, tied to a metric above. " +
      "Risk: the single biggest thing to protect against, tied to a metric above.";

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (res.status === 429) throw new Error("Coach is rate-limited. Try again in a moment.");
        if (res.status === 402) throw new Error("AI credits exhausted. Add credits to keep using the coach.");
        throw new Error(`Coach unavailable (${res.status}): ${body.slice(0, 160)}`);
      }

      const json = await res.json();
      const raw: string = json?.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(raw);
      return {
        headline: String(parsed.headline ?? FallbackInsight.headline).slice(0, 140),
        opportunity: String(parsed.opportunity ?? FallbackInsight.opportunity).slice(0, 280),
        risk: String(parsed.risk ?? FallbackInsight.risk).slice(0, 280),
      } satisfies CoachInsight;
    } catch (err) {
      console.error("getCoachInsight failed", err);
      return FallbackInsight;
    }
  });
