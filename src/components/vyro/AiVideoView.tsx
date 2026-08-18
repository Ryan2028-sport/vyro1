import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Play, Loader2, Video, Target, Flame, X, ShieldCheck, Ruler } from "lucide-react";
import { Card, EmptyState, PageHeader, Pill, Stat } from "./shared";
import {
  scanSquashVideo,
  probeForIdentity,
  ScanAborted,
  type ScanProgress,
  type IdentityCandidate,
  type IdentityPick,
} from "./aiVideo/scanVideo";
import {
  ZONE_KEYS,
  type MatchReport,
  type MeasuredStats,
  type SquashInsight,
  type VerifiedCounts,
} from "@/lib/video-analysis-core";
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

/** Provenance badge — every number on this screen says where it came from. */
function Source({ kind, n }: { kind: "measured" | "verified" | "none"; n?: number }) {
  if (kind === "none") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-vyro-line px-2 py-0.5 text-[10px] uppercase tracking-wider text-vyro-mute">
        Not established
      </span>
    );
  }
  const measured = kind === "measured";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
        measured
          ? "border-vyro-mint/40 bg-vyro-mint/10 text-vyro-mint"
          : "border-vyro-line bg-vyro-text/[0.05] text-vyro-text/70"
      }`}
    >
      {measured ? <Ruler className="h-2.5 w-2.5" /> : <ShieldCheck className="h-2.5 w-2.5" />}
      {measured ? "Measured from video" : `AI-verified on ${n ?? 0} frames`}
    </span>
  );
}

/** Heat map drawn on a squash court (front wall at the top, T in the middle). */
function CourtHeatmap({
  title,
  values,
  counts,
  tone,
}: {
  title: string;
  values: number[];
  counts: number[];
  tone: "player" | "opponent";
}) {
  const max = Math.max(...values, 1);
  const total = counts.reduce((a, b) => a + b, 0);
  const hue = tone === "player" ? "16 185 129" : "244 114 182";
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-vyro-mute">{title}</div>
        <div className="text-[10px] text-vyro-mute">{total} contacts</div>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-vyro-line bg-vyro-text/[0.02] p-1.5">
        <div className="grid grid-cols-3 gap-1">
          {ZONE_KEYS.map((zone, i) => {
            const v = values[i] ?? 0;
            const alpha = Math.max(0.04, (v / max) * 0.8);
            return (
              <div
                key={zone}
                className="relative rounded-lg border border-vyro-line/70 px-1 py-3.5 text-center"
                style={{ background: `rgba(${hue} / ${alpha})` }}
              >
                <div className="text-[9px] uppercase tracking-wider text-vyro-mute">{ZONE_LABELS[zone]}</div>
                <div className="text-[13px] font-bold tabular-nums text-vyro-text">{counts[i] ?? 0}</div>
              </div>
            );
          })}
        </div>
        {/* short line + T marker, drawn over the grid */}
        <div className="pointer-events-none absolute inset-x-1.5 top-[36%] h-px bg-vyro-text/25" />
        <div className="pointer-events-none absolute left-1/2 top-[36%] h-[28%] w-px -translate-x-1/2 bg-vyro-text/25" />
      </div>
      <div className="text-[10px] text-vyro-mute">Front wall at the top · numbers are counted contacts</div>
    </div>
  );
}

function Bullets({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-1.5">
      {items.map((line, i) => (
        <li key={i} className="flex gap-2 text-[13px] leading-snug text-vyro-text/85">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-vyro-mint" />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

function MeasuredPanels({ measured: s }: { measured: MeasuredStats }) {
  return (
    <>
      <Card
        eyebrow="Scan quality"
        title="What the scan could see"
        action={<Source kind="measured" />}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Checkpoints" value={s.scannedFrames} />
          <Stat label="Sample rate" value={(1 / s.sampleEverySec).toFixed(1)} unit="/s" />
          <Stat label="Both players tracked" value={s.twoPlayerTrackPercent} unit="%" />
          <Stat label="Scan time" value={Math.round(s.scanSeconds)} unit="s" />
        </div>
        {s.twoPlayerTrackPercent < 45 && (
          <p className="mt-3 text-[12px] leading-snug text-vyro-text/70">
            Both players were only separated in {s.twoPlayerTrackPercent}% of active frames, so the
            opponent heat map and the who-struck split are less reliable for this clip. Filming from
            behind the court, higher up, fixes this.
          </p>
        )}
      </Card>

      <Card eyebrow="T discipline" title="Recovery to the T" action={<Source kind="measured" />}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Returns to T" value={s.tReturnCount} />
          <Stat label="Median to T" value={s.medianSecondsToT} unit="s" />
          <Stat label="Avg to T" value={s.avgSecondsToT} unit="s" />
          <Stat label="Time on T" value={s.tTimePercent} unit="%" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Longest off T" value={s.longestOffTSeconds} unit="s" />
          <Stat label="Your contacts" value={s.playerContacts} />
          <Stat label="Opponent contacts" value={s.opponentContacts} />
          <Stat label="Total contacts" value={s.contactCount} />
        </div>
      </Card>

      <Card eyebrow="Court coverage" title="Where the shots were struck" action={<Source kind="measured" />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <CourtHeatmap title="Your shots" values={s.playerHeatmap} counts={s.playerHeatCounts} tone="player" />
          <CourtHeatmap
            title="Opponent shots"
            values={s.opponentHeatmap}
            counts={s.opponentHeatCounts}
            tone="opponent"
          />
        </div>
      </Card>

      <Card eyebrow="Rally profile" title="Match structure" action={<Source kind="measured" />}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Rallies" value={s.rallyCount} />
          <Stat label="Shots / rally" value={s.avgShotsPerRally} />
          <Stat label="Longest rally" value={s.longestRallyShots} unit="shots" />
          <Stat label="Work:rest" value={s.workRestRatio} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Short (≤4)" value={s.rallyBuckets.short} />
          <Stat label="Medium (5-9)" value={s.rallyBuckets.medium} />
          <Stat label="Long (10+)" value={s.rallyBuckets.long} />
          <Stat label="Intensity drift" value={s.fatigueDriftPercent} unit="%" />
        </div>
      </Card>
    </>
  );
}

function VerifiedPanel({ verified: v, measured }: { verified: VerifiedCounts; measured: MeasuredStats }) {
  const mix = v.scaledShotMix;
  const sideTotal = v.side.forehand + v.side.backhand;
  return (
    <>
      <Card
        eyebrow="Shot mix"
        title="What the AI could actually see"
        action={<Source kind="verified" n={v.framesLabelled} />}
      >
        {v.framesLabelled === 0 ? (
          <p className="text-[13px] leading-snug text-vyro-text/75">
            The vision pass could not confidently read a single contact frame, so no shot mix is shown
            rather than a guessed one.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Frames read" value={`${v.framesLabelled}/${v.framesSent}`} />
              <Stat
                label="Forehand"
                value={sideTotal ? Math.round((v.side.forehand / sideTotal) * 100) : "—"}
                unit="%"
              />
              <Stat
                label="Backhand"
                value={sideTotal ? Math.round((v.side.backhand / sideTotal) * 100) : "—"}
                unit="%"
              />
              <Stat label="Unclear side" value={v.side.unclear} />
            </div>
            {mix ? (
              <>
                <div className="mt-3 text-[11px] uppercase tracking-wider text-vyro-mute">
                  Shot families, scaled from the verified sample to {measured.contactCount} measured contacts
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="Drives" value={mix.drive} />
                  <Stat label="Cross-court" value={mix["cross-court"]} />
                  <Stat label="Boasts" value={mix.boast} />
                  <Stat label="Drops" value={mix.drop} />
                  <Stat label="Lobs" value={mix.lob} />
                  <Stat label="Volleys" value={mix.volley} />
                  <Stat label="Serves" value={mix.serve} />
                  <Stat label="Sample" value={v.framesLabelled} unit="frames" />
                </div>
              </>
            ) : (
              <p className="mt-3 text-[12px] leading-snug text-vyro-text/70">
                Too few frames were readable to scale a shot-family breakdown — raw verified counts only:
                {" "}
                {Object.entries(v.family)
                  .filter(([, n]) => n > 0)
                  .map(([k, n]) => `${k} ${n}`)
                  .join(", ") || "none"}
                .
              </p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Prep high" value={v.racketPrep.high} />
              <Stat label="Prep low" value={v.racketPrep.low} />
              <Stat label="Prep late" value={v.racketPrep.late} />
              <Stat label="Segments ok" value={`${v.segmentsOk}/${v.segmentsOk + v.segmentsFailed}`} />
            </div>
          </>
        )}
      </Card>

      <Card eyebrow="Outcomes" title="Winners & errors">
        {v.rallyEndFrames > 0 ? (
          <p className="text-[13px] leading-snug text-vyro-text/85">
            {v.rallyEndFrames} of the {v.framesSent} sampled contact frames looked like a rally ending.
            That is a sample, not a full count — a complete winner / forced / unforced breakdown needs
            ball tracking this camera angle can't give.
          </p>
        ) : (
          <div className="space-y-2">
            <Source kind="none" />
            <p className="text-[13px] leading-snug text-vyro-text/75">
              No winner or error count is shown. Deciding a winner from a forced or unforced error needs
              the ball's bounce and the wall it hit, which isn't recoverable from this footage — so the
              app reports nothing instead of inventing numbers.
            </p>
          </div>
        )}
      </Card>
    </>
  );
}

export function AiVideoView() {
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [aiStage, setAiStage] = useState<string | null>(null);
  const [report, setReport] = useState<MatchReport | null>(null);
  const [probing, setProbing] = useState(false);
  const [candidates, setCandidates] = useState<IdentityCandidate[]>([]);
  const [candIdx, setCandIdx] = useState(0);
  const [identity, setIdentity] = useState<IdentityPick | null>(null);
  const analyze = useServerFn(analyzeSquashClip);
  const save = useServerFn(saveVideoAnalysis);
  const listFn = useServerFn(listVideoAnalyses);
  const qc = useQueryClient();

  const history = useQuery({
    queryKey: ["video-analyses"],
    queryFn: () => listFn(),
    retry: false,
  });

  /** Pick a video, then immediately hunt for a frame where you can tap yourself. */
  const onPickFile = async (f: File | null) => {
    setFile(f);
    setReport(null);
    setIdentity(null);
    setCandidates([]);
    setCandIdx(0);
    if (!f) return;
    setProbing(true);
    try {
      const found = await probeForIdentity(f, setProgress);
      setCandidates(found);
      if (!found.length) {
        toast.info("Could not isolate two players automatically — the scan will label players by camera depth.");
      }
    } catch {
      toast.error("Could not read frames from that video.");
    } finally {
      setProbing(false);
      setProgress(null);
    }
  };

  const run = useMutation({
    mutationFn: async (input: { f: File; identity: IdentityPick | null }): Promise<MatchReport> => {
      const { f } = input;
      const controller = new AbortController();
      abortRef.current = controller;
      setReport(null);
      setAiStage(null);

      const { payload, measured } = await scanSquashVideo(
        f,
        setProgress,
        controller.signal,
        input.identity ?? undefined,
      );
      // Measured numbers land on screen before the AI leg runs.
      const base: MatchReport = {
        measured,
        verified: null,
        insight: null,
        videoName: payload.videoName,
        durationSec: payload.durationSec,
      };
      setReport(base);
      setAiStage("Verifying contact frames with the AI, then writing your report…");

      const res = await analyze({ data: payload });
      const full: MatchReport = { ...base, verified: res.verified ?? null, insight: res.insight ?? null };
      setReport(full);
      if (res.error) toast.error(res.error);

      try {
        await save({
          data: {
            video_name: payload.videoName,
            duration_sec: payload.durationSec,
            insight: full as unknown as Record<string, unknown>,
          },
        });
        void qc.invalidateQueries({ queryKey: ["video-analyses"] });
      } catch {
        // Saving is best-effort (e.g. signed out) — the report still shows.
      }
      return full;
    },
    onSuccess: (data) => {
      setProgress(null);
      setAiStage(null);
      if (data.insight) toast.success("Match analysed");
    },
    onError: (e: Error) => {
      setProgress(null);
      setAiStage(null);
      if (e instanceof ScanAborted || e.name === "ScanAborted") toast.info("Scan cancelled");
      else toast.error(e.message);
    },
  });

  const busy = run.isPending;
  const insight: SquashInsight | null = report?.insight ?? null;
  const activeCandidate = candidates[candIdx] ?? null;

  /** Re-measure the match with the other player treated as you. */
  const swapPlayers = () => {
    if (!file || !identity?.otherSig) return;
    const next: IdentityPick = {
      sig: identity.otherSig,
      otherSig: identity.sig,
      atSec: identity.atSec,
    };
    setIdentity(next);
    run.mutate({ f: file, identity: next });
  };

  const pastItems = useMemo(
    () => (Array.isArray(history.data) ? history.data : []),
    [history.data],
  );


  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="AI video · squash"
        title="AI match analysis"
        subtitle="Your match is scanned frame by frame on this device, then the AI verifies the real contact frames. Every number is labelled measured or AI-verified — nothing is estimated."
        action={<Pill tone={report ? "live" : "off"}>{report ? "REPORT READY" : "NO CLIP"}</Pill>}
      />

      <Card eyebrow="Step 1" title="Add your match video">
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            void onPickFile(e.target.files?.[0] ?? null);
          }}
        />
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy || probing}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-vyro-line bg-vyro-text/[0.03] px-4 py-6 text-sm font-semibold text-vyro-text/90 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {file ? "Choose a different video" : "Select match video"}
          </button>
          {file && (
            <div className="flex min-w-0 items-center gap-2 text-xs text-vyro-mute">
              <Video className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{file.name}</span>
              <span className="shrink-0">· {(file.size / 1_048_576).toFixed(1)} MB</span>
            </div>
          )}
          <button
            type="button"
            disabled={!file || busy || probing}
            onClick={() => file && run.mutate({ f: file, identity })}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-vyro-mint px-4 py-3 text-sm font-bold text-black disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {busy ? "Analysing…" : identity ? "Analyse match" : "Analyse match (auto-detect players)"}
          </button>
          {!busy && !report && (
            <p className="text-[11px] leading-snug text-vyro-mute">
              A full match takes roughly 2–5 minutes: the whole clip is sampled about four times a
              second, both players are tracked, then the AI reads every detected contact frame.
            </p>
          )}

          {(progress || aiStage) && (
            <div className="space-y-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-vyro-text/10">
                <div
                  className="h-full rounded-full bg-vyro-mint transition-all"
                  style={{ width: `${Math.round((aiStage ? 0.97 : (progress?.ratio ?? 0)) * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] text-vyro-mute">
                <span className="truncate">{aiStage ?? progress?.label}</span>
                {progress && <span className="shrink-0 tabular-nums">{Math.round(progress.elapsedSec)}s</span>}
              </div>
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="flex items-center gap-1 text-[11px] font-semibold text-vyro-text/70"
              >
                <X className="h-3 w-3" /> Cancel scan
              </button>
            </div>
          )}
        </div>
      </Card>

      {(probing || activeCandidate) && !busy && (
        <Card
          eyebrow="Step 2"
          title="Which player is you?"
          right={
            identity ? (
              <Pill tone="live">YOU SELECTED</Pill>
            ) : (
              <Pill tone="off">{probing ? "FINDING FRAME" : "TAP YOURSELF"}</Pill>
            )
          }
        >
          {probing && (
            <div className="flex items-center gap-2 text-xs text-vyro-mute">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Finding a frame where both players are clearly apart…
            </div>
          )}

          {!probing && activeCandidate && (
            <div className="space-y-3">
              <p className="text-[11px] leading-snug text-vyro-mute">
                Tap yourself in the frame. Your kit colour is then used to follow you through every
                crossing, so your heat map and T stats are yours — not your opponent's.
              </p>

              <div className="relative overflow-hidden rounded-2xl border border-vyro-line">
                <img
                  src={activeCandidate.image}
                  alt={`Match frame at ${activeCandidate.t.toFixed(1)} seconds with both players visible`}
                  className="block w-full"
                />
                {activeCandidate.players.map((p, i) => {
                  const chosen =
                    identity !== null &&
                    identity.atSec === activeCandidate.t &&
                    identity.sig === p.sig;
                  return (
                    <button
                      key={`${p.x}-${p.y}-${i}`}
                      type="button"
                      onClick={() =>
                        setIdentity({
                          sig: p.sig,
                          otherSig: activeCandidate.players.find((o) => o !== p)?.sig,
                          atSec: activeCandidate.t,
                        })
                      }
                      aria-label={`That is me — player ${i + 1}`}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 transition ${
                        chosen
                          ? "border-vyro-mint bg-vyro-mint/25"
                          : "border-white/70 bg-black/20 hover:bg-black/10"
                      }`}
                      style={{
                        left: `${p.x * 100}%`,
                        top: `${p.y * 100}%`,
                        width: `${Math.max(9, p.w * 100 * 1.5)}%`,
                        height: `${Math.max(14, p.h * 100 * 1.3)}%`,
                      }}
                    >
                      <span
                        className={`absolute -top-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          chosen ? "bg-vyro-mint text-black" : "bg-black/80 text-white"
                        }`}
                      >
                        {chosen ? "ME" : i + 1}
                      </span>
                      <span
                        className="absolute bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-white/60"
                        style={{ background: p.swatch }}
                      />
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {candidates.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setCandIdx((i) => (i + 1) % candidates.length)}
                    className="rounded-xl border border-vyro-line px-3 py-1.5 text-[11px] font-semibold text-vyro-text/80"
                  >
                    Show another frame
                  </button>
                )}
                {identity && (
                  <button
                    type="button"
                    onClick={() => setIdentity(null)}
                    className="rounded-xl border border-vyro-line px-3 py-1.5 text-[11px] font-semibold text-vyro-text/80"
                  >
                    Clear selection
                  </button>
                )}
                <span className="text-[11px] text-vyro-mute">
                  {identity
                    ? `Locked at ${activeCandidate.t.toFixed(1)}s — run the scan above.`
                    : "Without a tap the scan falls back to guessing by camera depth."}
                </span>
              </div>
            </div>
          )}
        </Card>
      )}



      {!report && !busy && (
        <EmptyState
          title="No analysis yet"
          hint="Film from behind the court, as high as you can, with both players in frame — that is what lets the scanner separate you from your opponent and measure real contacts."
        />
      )}

      {report && (
        <>
          {insight && (
            <Card eyebrow={`Confidence · ${insight.confidence}`} title={insight.headline}>
              <p className="text-[13px] leading-relaxed text-vyro-text/85">{insight.summary}</p>
            </Card>
          )}

          <MeasuredPanels measured={report.measured} />
          {insight?.tNote && (
            <Card eyebrow="Coach read" title="On your T discipline">
              <p className="text-[13px] leading-snug text-vyro-text/85">{insight.tNote}</p>
              {insight.heatmapNote && (
                <p className="mt-2 text-[13px] leading-snug text-vyro-text/85">{insight.heatmapNote}</p>
              )}
              {insight.rallyNote && (
                <p className="mt-2 text-[13px] leading-snug text-vyro-text/85">{insight.rallyNote}</p>
              )}
            </Card>
          )}

          {report.verified && <VerifiedPanel verified={report.verified} measured={report.measured} />}

          {insight && insight.timeline.length > 0 && (
            <Card eyebrow="Timeline" title="Key moments">
              <div className="space-y-3">
                {insight.timeline.map((row, i) => (
                  <div key={i} className="rounded-2xl border border-vyro-line bg-vyro-text/[0.03] p-3">
                    <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wider text-vyro-mute">
                      <span className="tabular-nums">{row.time}</span>
                      <span className="truncate">{row.phase}</span>
                    </div>
                    <div className="mt-1 text-[13px] font-semibold text-vyro-text">{row.keyShot}</div>
                    <div className="text-[13px] leading-snug text-vyro-text/80">{row.observation}</div>
                    <div className="mt-1.5 flex gap-2 text-[12px] text-vyro-mint">
                      <Target className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{row.coachingCue}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {insight && (
            <>
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
        </>
      )}

      {pastItems.length > 0 && (
        <Card eyebrow="History" title="Previous analyses">
          <div className="space-y-2">
            {pastItems.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  const saved = row.insight as unknown as MatchReport | null;
                  if (saved?.measured) setReport(saved);
                  else toast.info("That report was saved by an older version and can't be reopened.");
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-vyro-line bg-vyro-text/[0.03] p-3 text-left"
              >
                <Flame className="h-4 w-4 shrink-0 text-vyro-mint" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-vyro-text">{row.video_name}</div>
                  <div className="text-[11px] text-vyro-mute">
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
