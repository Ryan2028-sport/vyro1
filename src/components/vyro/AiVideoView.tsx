import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Play, Loader2, Video, Target, Flame } from "lucide-react";
import { Card, EmptyState, PageHeader, Pill, Stat } from "./shared";
import { scanSquashVideo, type ScanProgress } from "./aiVideo/scanVideo";
import { ZONE_KEYS, type SquashInsight } from "@/lib/video-analysis-core";
import {
  analyzeSquashClip,
  listVideoAnalyses,
  saveVideoAnalysis,
} from "@/lib/video-analysis.functions";
import { toast } from "sonner";

const ZONE_LABELS: Record<string, string> = {
  "front-forehand": "Front FH",
  "front-centre": "Front mid",
  "front-backhand": "Front BH",
  "mid-forehand": "Mid FH",
  "mid-centre": "The T",
  "mid-backhand": "Mid BH",
  "back-forehand": "Back FH",
  "back-centre": "Back mid",
  "back-backhand": "Back BH",
};

function HeatmapGrid({ title, values, tone }: { title: string; values: number[]; tone: "player" | "opponent" }) {
  const max = Math.max(...values, 1);
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</div>
      <div className="grid grid-cols-3 gap-1.5">
        {ZONE_KEYS.map((zone, i) => {
          const v = values[i] ?? 0;
          const alpha = Math.max(0.06, (v / max) * 0.85);
          const hue = tone === "player" ? "16 185 129" : "244 114 182";
          return (
            <div
              key={zone}
              className="rounded-xl border border-border/40 px-2 py-3 text-center"
              style={{ background: `rgba(${hue} / ${alpha})` }}
            >
              <div className="text-[10px] uppercase tracking-wider text-foreground/70">{ZONE_LABELS[zone]}</div>
              <div className="text-sm font-bold tabular-nums text-foreground">{v}</div>
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-muted-foreground">Front of court at the top · 100 = busiest zone</div>
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-1.5">
      {items.map((line, i) => (
        <li key={i} className="flex gap-2 text-[13px] leading-snug text-foreground/85">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

export function AiVideoView() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [insight, setInsight] = useState<SquashInsight | null>(null);
  const analyze = useServerFn(analyzeSquashClip);
  const save = useServerFn(saveVideoAnalysis);
  const listFn = useServerFn(listVideoAnalyses);
  const qc = useQueryClient();

  const history = useQuery({
    queryKey: ["video-analyses"],
    queryFn: () => listFn(),
    retry: false,
  });

  const run = useMutation({
    mutationFn: async (f: File) => {
      const payload = await scanSquashVideo(f, setProgress);
      if (!payload.frames.length) throw new Error("No readable frames in this video.");
      const res = await analyze({ data: payload });
      if (res.error || !res.insight) throw new Error(res.error ?? "Analysis failed.");
      try {
        await save({
          data: {
            video_name: payload.videoName,
            duration_sec: payload.durationSec,
            insight: res.insight as unknown as Record<string, unknown>,
          },
        });
        void qc.invalidateQueries({ queryKey: ["video-analyses"] });
      } catch {
        // Saving is best-effort (e.g. signed out) — the report still shows.
      }
      return res.insight;
    },
    onSuccess: (data) => {
      setInsight(data);
      setProgress(null);
      toast.success("Match analysed");
    },
    onError: (e: Error) => {
      setProgress(null);
      toast.error(e.message);
    },
  });

  const m = insight?.metrics ?? {};
  const t = insight?.tDiscipline ?? {};
  const rally = insight?.rallyProfile ?? {};
  const busy = run.isPending;

  const pastItems = useMemo(
    () => (Array.isArray(history.data) ? history.data : []),
    [history.data],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="AI video · squash"
        title="AI match analysis"
        subtitle="Upload a match clip. The whole video is scanned on-device, then the AI returns T discipline, shot heat maps and a coaching plan."
        action={<Pill tone={insight ? "live" : "off"}>{insight ? "REPORT READY" : "NO CLIP"}</Pill>}
      />

      <Card eyebrow="Step 1" title="Add your match video">
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setInsight(null);
          }}
        />
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card/40 px-4 py-6 text-sm font-semibold text-foreground/90 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {file ? "Choose a different video" : "Select match video"}
          </button>
          {file && (
            <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              <Video className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{file.name}</span>
              <span className="shrink-0">· {(file.size / 1_048_576).toFixed(1)} MB</span>
            </div>
          )}
          <button
            type="button"
            disabled={!file || busy}
            onClick={() => file && run.mutate(file)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {busy ? "Analysing…" : "Analyse match"}
          </button>
          {progress && (
            <div className="space-y-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.round(progress.ratio * 100)}%` }}
                />
              </div>
              <div className="text-[11px] text-muted-foreground">{progress.label}</div>
            </div>
          )}
        </div>
      </Card>

      {!insight && !busy && (
        <EmptyState
          title="No analysis yet"
          hint="Film from behind the court for the best results — the scanner tracks both players' movement, contact points and how fast you recover to the T."
        />
      )}

      {insight && (
        <>
          <Card eyebrow={`Confidence · ${insight.confidence}`} title={insight.headline}>
            <p className="text-[13px] leading-relaxed text-foreground/85">{insight.summary}</p>
          </Card>

          <Card eyebrow="T discipline" title="Recovery to the T">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Returns to T" value={t.returnsToT ?? "—"} />
              <Stat label="Avg to T" value={t.avgSecondsToT ?? "—"} unit="s" />
              <Stat label="Time on T" value={t.tTimePercent ?? "—"} unit="%" />
              <Stat label="Longest off T" value={t.longestOffTSeconds ?? "—"} unit="s" />
            </div>
            {t.note && <p className="mt-3 text-[13px] leading-snug text-foreground/80">{t.note}</p>}
          </Card>

          <Card eyebrow="Court coverage" title="Shot heat maps">
            <div className="grid gap-4 sm:grid-cols-2">
              <HeatmapGrid title="Your shots" values={insight.playerHeatmap} tone="player" />
              <HeatmapGrid title="Opponent shots" values={insight.opponentHeatmap} tone="opponent" />
            </div>
            {insight.heatmapNote && (
              <p className="mt-3 text-[13px] leading-snug text-foreground/80">{insight.heatmapNote}</p>
            )}
          </Card>

          <Card eyebrow="Rally profile" title="Match structure">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Rallies" value={rally.rallyCount ?? m.rallyCountEstimate ?? "—"} />
              <Stat label="Shots / rally" value={rally.avgShotsPerRally ?? "—"} />
              <Stat label="Longest rally" value={rally.longestRallyShots ?? "—"} unit="shots" />
              <Stat label="Work:rest" value={rally.workRestRatio ?? "—"} />
            </div>
            {rally.fatigueDrift && (
              <p className="mt-3 text-[13px] leading-snug text-foreground/80">{rally.fatigueDrift}</p>
            )}
          </Card>

          <Card eyebrow="Shot mix" title="What you hit">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Total shots" value={m.totalShotsEstimate ?? "—"} />
              <Stat label="Forehand" value={m.forehandEstimate ?? "—"} />
              <Stat label="Backhand" value={m.backhandEstimate ?? "—"} />
              <Stat label="Volleys" value={m.volleyEstimate ?? "—"} />
              <Stat label="Drives" value={m.driveEstimate ?? "—"} />
              <Stat label="Boasts" value={m.boastEstimate ?? "—"} />
              <Stat label="Drops" value={m.dropEstimate ?? "—"} />
              <Stat label="Lobs" value={m.lobEstimate ?? "—"} />
            </div>
          </Card>

          <Card eyebrow="Outcomes" title="Winners & errors">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="Winners" value={m.winnersEstimate ?? "—"} />
              <Stat label="Forced errors" value={m.forcedErrorsEstimate ?? "—"} />
              <Stat label="Unforced errors" value={m.unforcedErrorsEstimate ?? "—"} />
              <Stat label="Swing path" value={m.swingPathScore ?? "—"} unit="/100" />
              <Stat label="Footwork" value={m.footworkScore ?? "—"} unit="/100" />
              <Stat label="Shot quality" value={m.shotQualityScore ?? "—"} unit="/100" />
            </div>
          </Card>

          {insight.timeline.length > 0 && (
            <Card eyebrow="Timeline" title="Key moments">
              <div className="space-y-3">
                {insight.timeline.map((row, i) => (
                  <div key={i} className="rounded-2xl border border-border/40 bg-card/40 p-3">
                    <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <span className="tabular-nums">{row.time}</span>
                      <span className="truncate">{row.phase}</span>
                    </div>
                    <div className="mt-1 text-[13px] font-semibold text-foreground">{row.keyShot}</div>
                    <div className="text-[13px] leading-snug text-foreground/80">{row.observation}</div>
                    <div className="mt-1.5 flex gap-2 text-[12px] text-primary">
                      <Target className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{row.coachingCue}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card eyebrow="Diagnosis" title="Shots & swing path">
            <div className="space-y-3">
              <Bullets items={insight.shotBreakdown} />
              <Bullets items={insight.swingPath} />
            </div>
          </Card>

          <Card eyebrow="Movement" title="Footwork & T control">
            <div className="space-y-3">
              <Bullets items={insight.explosiveSteps} />
              <Bullets items={insight.tCourt} />
            </div>
          </Card>

          <Card eyebrow="Tactics" title="Shot selection & load">
            <div className="space-y-3">
              <Bullets items={insight.shotSelection} />
              <Bullets items={insight.loadRecovery} />
            </div>
          </Card>

          <Card eyebrow="Coach" title="What to train next">
            <div className="space-y-3">
              <Bullets items={insight.coachNotes} />
              <Bullets items={insight.developmentPlan} />
            </div>
          </Card>

          {insight.videoEvidence.length > 0 && (
            <Card eyebrow="Evidence" title="Seen in the video">
              <Bullets items={insight.videoEvidence} />
            </Card>
          )}

          {insight.limitations.length > 0 && (
            <Card eyebrow="Honest limits" title="What the camera couldn't confirm">
              <Bullets items={insight.limitations} />
            </Card>
          )}
        </>
      )}

      {pastItems.length > 0 && (
        <Card eyebrow="History" title="Previous analyses">
          <div className="space-y-2">
            {pastItems.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setInsight(row.insight as unknown as SquashInsight)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border/40 bg-card/40 p-3 text-left"
              >
                <Flame className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-foreground">{row.video_name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()} · {Math.round(row.duration_sec)}s
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
