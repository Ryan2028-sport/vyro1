import {
  FAMILY,
  SYNTHESIS_SYSTEM,
  VERIFY_SYSTEM,
  buildSynthesisPrompt,
  buildVerifyPrompt,
  parseInsight,
  parseSegmentLabels,
  type ClipInput,
  type FrameLabel,
  type SquashInsight,
  type VerifiedCounts,
} from "./video-analysis-core";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const VISION_MODEL = "google/gemini-2.5-pro";
const FRAMES_PER_SEGMENT = 5;

type ChatContent = Array<Record<string, unknown>>;

function gatewayError(status: number): string {
  if (status === 429) return "Analyser is rate-limited — try again in a moment.";
  if (status === 402) return "AI credits exhausted. Add credits to keep analysing matches.";
  if (status === 403) return "AI access is blocked for this workspace.";
  return `Analyser unavailable (${status}).`;
}

async function callGateway(
  key: string,
  system: string,
  content: ChatContent | string,
): Promise<{ text: string | null; error: string | null }> {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("video analysis gateway error", res.status, body.slice(0, 400));
    return { text: null, error: gatewayError(res.status) };
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return { text: json.choices?.[0]?.message?.content ?? "", error: null };
}

function emptyCounts(framesSent: number): VerifiedCounts {
  const family = FAMILY.reduce((acc, k) => ({ ...acc, [k]: 0 }), {} as Record<(typeof FAMILY)[number], number>);
  return {
    framesSent,
    framesLabelled: 0,
    playerStrikes: 0,
    opponentStrikes: 0,
    side: { forehand: 0, backhand: 0, unclear: 0 },
    depth: { front: 0, mid: 0, back: 0, unclear: 0 },
    family,
    racketPrep: { high: 0, low: 0, late: 0, unclear: 0 },
    rallyEndFrames: 0,
    scaledShotMix: null,
    notes: [],
    segmentsOk: 0,
    segmentsFailed: 0,
  };
}

/** Ask the vision model to label the real contact frames, in small batches. */
async function verifyFrames(
  key: string,
  data: ClipInput,
  onNote?: (msg: string) => void,
): Promise<VerifiedCounts> {
  const counts = emptyCounts(data.frames.length);
  const batches: Array<{ frames: string[]; times: number[]; hints: string[] }> = [];
  for (let i = 0; i < data.frames.length; i += FRAMES_PER_SEGMENT) {
    batches.push({
      frames: data.frames.slice(i, i + FRAMES_PER_SEGMENT),
      times: (data.frameTimes ?? []).slice(i, i + FRAMES_PER_SEGMENT),
      hints: (data.frameMeta ?? [])
        .slice(i, i + FRAMES_PER_SEGMENT)
        .map((meta) => (meta ? `${meta.actor === "player" ? "near player" : meta.actor === "opponent" ? "far player" : "unsure who"} striking in ${meta.zone}` : "")),
    });
  }

  // Segments run a few at a time so a long match doesn't take forever.
  const CONCURRENCY = 4;
  for (let start = 0; start < batches.length; start += CONCURRENCY) {
    const slice = batches.slice(start, start + CONCURRENCY);
    onNote?.(`segments ${start + 1}-${start + slice.length}/${batches.length}`);
    const replies = await Promise.all(
      slice.map(async (batch) => {
        const content: ChatContent = [];
        batch.frames.forEach((b64, i) => {
          content.push({ type: "text", text: `frame ${i + 1} · ${(batch.times[i] ?? 0).toFixed(1)}s` });
          content.push({ type: "image_url", image_url: { url: b64 } });
        });
        content.push({ type: "text", text: buildVerifyPrompt(batch.times, batch.hints) });
        try {
          return await callGateway(key, VERIFY_SYSTEM, content);
        } catch {
          return { text: null, error: "segment failed" };
        }
      }),
    );

    for (const { text, error } of replies) {
      if (error || !text) {
        counts.segmentsFailed += 1;
        continue;
      }
      const labels = parseSegmentLabels(text);
      if (!labels || labels.length === 0) {
        counts.segmentsFailed += 1;
        console.error("segment reply unparsable", text.slice(0, 300));
        continue;
      }
      counts.segmentsOk += 1;

      for (const label of labels as FrameLabel[]) {
        if (label.striking === "none") continue;
        if (label.striking === "near") counts.playerStrikes += 1;
        else if (label.striking === "far") counts.opponentStrikes += 1;
        if (label.striking === "unclear" && label.side === "unclear" && label.family === "unclear") continue;
        counts.framesLabelled += 1;
        counts.side[label.side] += 1;
        counts.depth[label.depth] += 1;
        counts.family[label.family] += 1;
        counts.racketPrep[label.racketPrep] += 1;
        if (label.rallyEnd) counts.rallyEndFrames += 1;
        if (label.note) counts.notes.push(`${label.frame}: ${label.note}`);
      }
    }
  }


  // Scale the verified shot mix up to the measured contact total, but only
  // when the sample is big enough to mean anything.
  const named = FAMILY.filter((f) => f !== "unclear").reduce((a, f) => a + counts.family[f], 0);
  if (named >= 6 && data.measured.contactCount > 0) {
    const factor = data.measured.contactCount / named;
    counts.scaledShotMix = FAMILY.reduce((acc, f) => {
      acc[f] = f === "unclear" ? 0 : Math.round(counts.family[f] * factor);
      return acc;
    }, {} as Record<(typeof FAMILY)[number], number>);
  }
  return counts;
}

export async function runClipAnalysis(
  data: ClipInput,
): Promise<{ insight: SquashInsight | null; verified: VerifiedCounts | null; error: string | null }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { insight: null, verified: null, error: "AI is not configured for this project." };

  let verified: VerifiedCounts | null = null;
  try {
    verified = await verifyFrames(key, data);
  } catch (e) {
    console.error("frame verification failed", e);
  }

  try {
    const { text, error } = await callGateway(key, SYNTHESIS_SYSTEM, buildSynthesisPrompt(data, verified));
    if (error) return { insight: null, verified, error };
    const insight = text ? parseInsight(text) : null;
    if (!insight) {
      return {
        insight: null,
        verified,
        error: "The coaching write-up came back unreadable — the measured numbers below are still valid.",
      };
    }
    return { insight, verified, error: null };
  } catch (e) {
    console.error("runClipAnalysis failed", e);
    return { insight: null, verified, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
