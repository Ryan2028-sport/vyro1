import { buildGatewayBody, parseInsight, type ClipInput, type SquashInsight } from "./video-analysis-core";

export async function runClipAnalysis(
  data: ClipInput,
): Promise<{ insight: SquashInsight | null; error: string | null }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { insight: null, error: "AI is not configured for this project." };

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(buildGatewayBody(data)),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("video analysis gateway error", res.status, body.slice(0, 500));
      if (res.status === 429) return { insight: null, error: "Analyser is rate-limited — try again in a moment." };
      if (res.status === 402) return { insight: null, error: "AI credits exhausted. Add credits to keep analysing matches." };
      if (res.status === 403) return { insight: null, error: "AI access is blocked for this workspace." };
      return { insight: null, error: `Analyser unavailable (${res.status}).` };
    }

    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const insight = parseInsight(raw);
    if (!insight) return { insight: null, error: "The analyser returned an unreadable report. Try again." };
    return { insight, error: null };
  } catch (e) {
    console.error("runClipAnalysis failed", e);
    return { insight: null, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
