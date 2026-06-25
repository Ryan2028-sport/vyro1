import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Play, Upload, Zap, Activity, Target, Eye, TrendingUp, Footprints, Loader2, Sparkles, Video, Square, Circle } from "lucide-react";
import { sportProfiles } from "@/lib/vyro-data";
import { Bar, Card, PageHeader, Pill } from "./shared";
import { SportSwing } from "./SportView";
import { analyzeSquashClip, type SquashInsight } from "@/lib/video-analysis.functions";

type Tab = "overview" | "footwork" | "swing" | "tcourt" | "tactics" | "physio";

type FrameSignal = {
  t: number;
  motion: number;
  x: number;
  y: number;
  zone: string;
  brightness: number;
};

type ClipScan = {
  frames: string[];
  frameTimes: number[];
  duration: number;
  sampleEverySec: number;
  motionTimeline: FrameSignal[];
  shotCandidates: Array<{ t: number; motion: number; zone: string }>;
  derivedStats: {
    scannedFrames: number;
    activeSeconds: number;
    rallyCountEstimate: number;
    totalShotsEstimate: number;
    averageMotion: number;
    peakMotion: number;
    highIntensityWindows: number;
  };
};

const zoneFromPoint = (x: number, y: number) => {
  const side = x < 0.38 ? "left" : x > 0.62 ? "right" : "middle";
  const depth = y < 0.34 ? "front" : y > 0.68 ? "back" : "mid";
  return `${depth}-${side}`;
};

async function scanVideoClip(file: File, onProgress?: (message: string) => void): Promise<ClipScan> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    const cleanup = () => URL.revokeObjectURL(url);

    video.onloadedmetadata = async () => {
      try {
        const duration = isFinite(video.duration) ? video.duration : 0;
        const safeDur = duration > 0.5 ? duration : 1;
        const sampleEverySec = safeDur > 900 ? 3 : safeDur > 360 ? 2 : safeDur > 120 ? 1.25 : 0.75;
        const scanTimes = Array.from(
          { length: Math.max(1, Math.min(900, Math.ceil(safeDur / sampleEverySec))) },
          (_, i) => Math.min(i * sampleEverySec, safeDur - 0.05),
        );
        const scanCanvas = document.createElement("canvas");
        scanCanvas.width = 192;
        scanCanvas.height = Math.max(108, Math.round(((video.videoHeight || 360) / (video.videoWidth || 640)) * scanCanvas.width));
        const scanCtx = scanCanvas.getContext("2d", { willReadFrequently: true });
        const frameCanvas = document.createElement("canvas");
        frameCanvas.width = 512;
        frameCanvas.height = Math.max(288, Math.round(((video.videoHeight || 360) / (video.videoWidth || 640)) * frameCanvas.width));
        const frameCtx = frameCanvas.getContext("2d");
        if (!scanCtx || !frameCtx) throw new Error("Canvas unavailable for full-video scan.");

        const seekTo = (t: number) => new Promise<void>((res) => {
          let done = false;
          const finish = () => { if (done) return; done = true; video.removeEventListener("seeked", finish); res(); };
          video.addEventListener("seeked", finish);
          try { video.currentTime = Math.max(0, Math.min(t, safeDur - 0.05)); } catch { finish(); }
          window.setTimeout(finish, 1800);
        });

        const motionTimeline: FrameSignal[] = [];
        let previous: Uint8ClampedArray | null = null;
        for (let i = 0; i < scanTimes.length; i++) {
          const t = scanTimes[i];
          await seekTo(t);
          scanCtx.drawImage(video, 0, 0, scanCanvas.width, scanCanvas.height);
          const data = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height).data;
          let diffSum = 0;
          let weightSum = 0;
          let xSum = 0;
          let ySum = 0;
          let brightness = 0;
          for (let p = 0; p < data.length; p += 16) {
            const lum = (data[p] + data[p + 1] + data[p + 2]) / 3;
            brightness += lum;
            const diff = previous ? Math.abs(data[p] - previous[p]) + Math.abs(data[p + 1] - previous[p + 1]) + Math.abs(data[p + 2] - previous[p + 2]) : 0;
            diffSum += diff;
            if (diff > 26) {
              const pixel = p / 4;
              const x = pixel % scanCanvas.width;
              const y = Math.floor(pixel / scanCanvas.width);
              weightSum += diff;
              xSum += x * diff;
              ySum += y * diff;
            }
          }
          previous = new Uint8ClampedArray(data);
          const motion = Math.round(Math.min(100, diffSum / (data.length / 16) / 2.1));
          const x = weightSum ? xSum / weightSum / scanCanvas.width : 0.5;
          const y = weightSum ? ySum / weightSum / scanCanvas.height : 0.5;
          motionTimeline.push({ t: Number(t.toFixed(2)), motion, x: Number(x.toFixed(2)), y: Number(y.toFixed(2)), zone: zoneFromPoint(x, y), brightness: Math.round(brightness / (data.length / 16)) });
          if (i % 8 === 0 || i === scanTimes.length - 1) onProgress?.(`Scanning whole video ${Math.round(((i + 1) / scanTimes.length) * 100)}% · ${motionTimeline.length} checkpoints`);
        }

        const sortedMotion = motionTimeline.map((s) => s.motion).sort((a, b) => a - b);
        const median = sortedMotion[Math.floor(sortedMotion.length / 2)] || 0;
        const peakMotion = sortedMotion[sortedMotion.length - 1] || 0;
        const threshold = Math.max(12, median + Math.max(8, (peakMotion - median) * 0.32));
        const shotCandidates = motionTimeline
          .filter((s, i, arr) => s.motion >= threshold && s.motion >= (arr[i - 1]?.motion ?? 0) && s.motion >= (arr[i + 1]?.motion ?? 0))
          .reduce<Array<{ t: number; motion: number; zone: string }>>((acc, s) => {
            if (!acc.length || s.t - acc[acc.length - 1].t > 1.4) acc.push({ t: s.t, motion: s.motion, zone: s.zone });
            else if (s.motion > acc[acc.length - 1].motion) acc[acc.length - 1] = { t: s.t, motion: s.motion, zone: s.zone };
            return acc;
          }, []);
        const activeSamples = motionTimeline.filter((s) => s.motion >= Math.max(8, median + 4));
        const activeSeconds = Math.round(activeSamples.length * sampleEverySec);
        let rallyCountEstimate = 0;
        let lastActive = -Infinity;
        activeSamples.forEach((s) => { if (s.t - lastActive > 7) rallyCountEstimate += 1; lastActive = s.t; });
        const totalShotsEstimate = Math.max(shotCandidates.length, Math.round(activeSeconds / 1.65));
        const evidenceTimes = Array.from(new Set([
          ...shotCandidates.sort((a, b) => b.motion - a.motion).slice(0, 18).map((s) => s.t),
          ...Array.from({ length: 6 }, (_, i) => (safeDur * (i + 1)) / 7),
        ])).sort((a, b) => a - b).slice(0, 24);
        const frames: string[] = [];
        const frameTimes: number[] = [];
        for (let i = 0; i < evidenceTimes.length; i++) {
          const t = evidenceTimes[i];
          onProgress?.(`Capturing evidence frames ${i + 1}/${evidenceTimes.length}`);
          await seekTo(t);
          frameCtx.drawImage(video, 0, 0, frameCanvas.width, frameCanvas.height);
          frames.push(frameCanvas.toDataURL("image/jpeg", 0.58));
          frameTimes.push(Number(t.toFixed(2)));
        }

        cleanup();
        resolve({
          frames,
          frameTimes,
          duration,
          sampleEverySec,
          motionTimeline,
          shotCandidates: shotCandidates.slice(0, 240),
          derivedStats: {
            scannedFrames: motionTimeline.length,
            activeSeconds,
            rallyCountEstimate: Math.max(1, rallyCountEstimate),
            totalShotsEstimate,
            averageMotion: Math.round(motionTimeline.reduce((sum, s) => sum + s.motion, 0) / Math.max(1, motionTimeline.length)),
            peakMotion,
            highIntensityWindows: shotCandidates.filter((s) => s.motion > threshold + 10).length,
          },
        });
      } catch (e) {
        cleanup();
        reject(e);
      }
    };
    video.onerror = () => { cleanup(); reject(new Error("video load failed")); };
  });
}


export function VideoView() {
  const [state, setState] = useState<"idle" | "ready">("idle");
  const [tab, setTab] = useState<Tab>("overview");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [insight, setInsight] = useState<SquashInsight | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string>("");
  // Recording state
  const [recordOpen, setRecordOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const livePreviewRef = useRef<HTMLVideoElement>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const runAnalyze = useServerFn(analyzeSquashClip);

  const analyzeFile = async (file: File) => {
    setAnalyzing(true);
    setAnalysisError(null);
    setInsight(null);
    setAnalysisStatus("Scanning the whole video timeline…");
    const minimumAnalyzeTime = new Promise<void>((resolve) => window.setTimeout(resolve, 15_000));
    try {
      const { frames, frameTimes, duration, motionTimeline, shotCandidates, derivedStats, sampleEverySec } = await scanVideoClip(file, setAnalysisStatus);
      if (frames.length === 0) throw new Error("Could not read frames from this clip.");
      setAnalysisStatus(`Analyzing ${derivedStats.scannedFrames} video checkpoints, ${shotCandidates.length} shot candidates, and ${Math.round(duration)} seconds of play…`);
      const analysisRequest = runAnalyze({
        data: { videoName: file.name, durationSec: duration, frames, frameTimes, motionTimeline, shotCandidates, derivedStats, sampleEverySec },
      });
      const [res] = await Promise.all([analysisRequest, minimumAnalyzeTime]);
      if (res.error || !res.insight) throw new Error(res.error ?? "Analysis failed.");
      setInsight(res.insight);
      setAnalysisStatus("");
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFile = (file: File | null | undefined) => {
    if (!file) return;
    const looksLikeVideo =
      (file.type && file.type.startsWith("video/")) ||
      /\.(mp4|mov|m4v|webm|mkv|avi|3gp|hevc)$/i.test(file.name);
    if (!looksLikeVideo) {
      setUploadError(`That file doesn't look like a video (${file.type || "unknown type"}). Try MP4, MOV, or WebM.`);
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      setUploadError("Clip is larger than 500MB. Trim it and try again.");
      return;
    }
    setUploadError(null);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(URL.createObjectURL(file));
    setVideoName(file.name);
    setState("ready");
    void analyzeFile(file);
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
  };

  const openRecorder = async () => {
    setRecordError(null);
    setRecordOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });
      streamRef.current = stream;
      if (livePreviewRef.current) {
        livePreviewRef.current.srcObject = stream;
        await livePreviewRef.current.play().catch(() => undefined);
      }
    } catch (e) {
      setRecordError(e instanceof Error ? e.message : "Camera unavailable. Allow camera access and retry.");
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    let mime = "video/webm;codecs=vp9,opus";
    if (!MediaRecorder.isTypeSupported(mime)) mime = "video/webm;codecs=vp8,opus";
    if (!MediaRecorder.isTypeSupported(mime)) mime = "video/webm";
    const rec = new MediaRecorder(streamRef.current, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
    rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      const file = new File([blob], `vyro-record-${Date.now()}.webm`, { type: mime });
      setRecording(false);
      setRecordSec(0);
      stopStream();
      setRecordOpen(false);
      handleFile(file);
    };
    recorderRef.current = rec;
    rec.start(1000);
    setRecording(true);
    setRecordSec(0);
    timerRef.current = window.setInterval(() => setRecordSec((s) => s + 1), 1000);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
  };

  const cancelRecorder = () => {
    if (recorderRef.current && recording) {
      recorderRef.current.ondataavailable = null;
      recorderRef.current.onstop = null;
      try { recorderRef.current.stop(); } catch { /* ignore */ }
      recorderRef.current = null;
    }
    setRecording(false);
    setRecordSec(0);
    stopStream();
    setRecordOpen(false);
  };

  useEffect(() => () => stopStream(), []);

  if (state === "idle") {
    return (
      <>
        <PageHeader
          eyebrow="AI Video"
          title="Video analysis"
        />
        <Card>
          <div
            className="py-12 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer.files?.[0]);
            }}
          >
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-gray-200 bg-gray-100">
              <Camera className="h-8 w-8 text-gray-600" />
            </div>
            <h3 className="mt-4 text-xl font-semibold">Upload or record</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
              MP4, MOV, or WebM up to 500MB.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <label className="relative inline-flex cursor-pointer items-center rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white">
                <input
                  type="file"
                  accept="video/*,.mp4,.mov,.m4v,.webm,.mkv,.avi,.3gp,.hevc"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    handleFile(f);
                  }}
                />
                <Upload className="mr-2 inline h-4 w-4" />
                <span>Upload clip</span>
              </label>
              <button
                onClick={openRecorder}
                className="rounded-xl bg-vyro-red px-5 py-3 text-sm font-medium text-white"
              >
                <Video className="mr-2 inline h-4 w-4" /> Record clip
              </button>
              <button
                onClick={() => {
                  if (videoUrl) URL.revokeObjectURL(videoUrl);
                  setVideoUrl(null);
                  setVideoName(null);
                  setUploadError(null);
                  setState("ready");
                }}
                className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-3 text-sm font-medium"
              >
                Use sample match
              </button>
            </div>
            {uploadError && <p className="mt-3 text-sm text-vyro-red">{uploadError}</p>}

          </div>
        </Card>
        {recordOpen && (
          <RecorderOverlay
            previewRef={livePreviewRef}
            recording={recording}
            recordSec={recordSec}
            recordError={recordError}
            onStart={startRecording}
            onStop={stopRecording}
            onCancel={cancelRecorder}
          />
        )}
      </>
    );
  }


  const tabs: [Tab, string, typeof Eye][] = [
    ["overview", "Overview", Eye],
    ["footwork", "Explosive steps", Footprints],
    ["swing", "Swing detection", Zap],
    ["tcourt", "T-court tracking", Target],
    ["tactics", "Shot selection", TrendingUp],
    ["physio", "Load & recovery", Activity],
  ];

  return (
    <>
      <PageHeader
        eyebrow="AI Video"
        title={videoName ? videoName : "Match clip"}
        action={
          <button
            onClick={() => {
              if (videoUrl) URL.revokeObjectURL(videoUrl);
              setVideoUrl(null);
              setVideoName(null);
              setInsight(null);
              setAnalysisError(null);
              setAnalysisStatus("");
              setState("idle");
            }}
            className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium"
          >
            New clip
          </button>
        }
      />


      <div className="mb-5 flex gap-2 overflow-x-auto">
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm flex items-center gap-2 ${
              tab === id ? "border-gray-300 bg-gray-100 text-gray-900" : "border-gray-200 text-gray-500"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>


      <AIInsightPanel analyzing={analyzing} error={analysisError} insight={insight} activeTab={tab} status={analysisStatus} />

      {tab === "overview" && <Overview videoUrl={videoUrl} insight={insight} />}
      {tab === "footwork" && <Footwork videoUrl={videoUrl} />}
      {tab === "swing" && <Swing />}
      {tab === "tcourt" && <TCourt />}
      {tab === "tactics" && <Tactics />}
      {tab === "physio" && <Physio />}
    </>
  );
}

function RecorderOverlay({
  previewRef, recording, recordSec, recordError, onStart, onStop, onCancel,
}: {
  previewRef: React.RefObject<HTMLVideoElement | null>;
  recording: boolean;
  recordSec: number;
  recordError: string | null;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
}) {
  const mm = String(Math.floor(recordSec / 60)).padStart(2, "0");
  const ss = String(recordSec % 60).padStart(2, "0");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-3xl border border-gray-200 bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            <h3 className="font-semibold">Record clip</h3>
            {recording && (
              <span className="ml-2 inline-flex items-center gap-2 rounded-full bg-vyro-red/20 px-2 py-0.5 text-xs font-medium text-vyro-red">
                <span className="h-2 w-2 animate-pulse rounded-full bg-vyro-red" /> REC {mm}:{ss}
              </span>
            )}
          </div>
          <button onClick={onCancel} className="rounded-full border border-gray-200 px-3 py-1 text-xs">Close</button>
        </div>
        <div className="mt-3 aspect-video overflow-hidden rounded-2xl border border-gray-200 bg-black">
          <video ref={previewRef} className="h-full w-full object-cover" muted playsInline />
        </div>
        {recordError && <p className="mt-3 text-sm text-vyro-red">{recordError}</p>}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {!recording ? (
            <button
              onClick={onStart}
              disabled={!!recordError}
              className="inline-flex items-center gap-2 rounded-xl bg-vyro-red px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              <Circle className="h-4 w-4 fill-current" /> Start recording
            </button>
          ) : (
            <button
              onClick={onStop}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white"
            >
              <Square className="h-4 w-4 fill-current" /> Stop &amp; analyze
            </button>
          )}
        </div>
        <p className="mt-3 text-center text-xs text-gray-500">
          Tip: prop the phone behind the back wall at T-height for best court coverage. Claude will analyze footwork, swing, and shot selection automatically.
        </p>
      </div>
    </div>
  );
}

function AIInsightPanel({
  analyzing, error, insight, activeTab, status,
}: {
  analyzing: boolean;
  error: string | null;
  insight: SquashInsight | null;
  activeTab: Tab;
  status: string;
}) {
  if (!analyzing && !error && !insight) return null;
  const bullets =
    !insight ? [] :
    activeTab === "footwork" ? insight.explosiveSteps :
    activeTab === "swing" ? insight.swingPath :
    activeTab === "tcourt" ? insight.tCourt :
    activeTab === "tactics" ? insight.shotSelection :
    activeTab === "physio" ? insight.loadRecovery :
    insight.coachNotes;

  return (
    <Card className="mb-5 border-vyro-red/20 bg-gradient-to-br from-vyro-red/5 to-transparent">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-vyro-red" />
        <h3 className="font-semibold">Claude analysis</h3>
        {analyzing && (
          <span className="ml-2 inline-flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="h-3 w-3 animate-spin" /> {status || "Scanning whole video…"}
          </span>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-vyro-red">{error}</p>}
      {insight && (
        <>
          <p className="mt-2 text-sm font-medium">{insight.headline}</p>
          <p className="mt-1 text-sm text-gray-600">{insight.summary}</p>
          <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Shots", insight.metrics.totalShotsEstimate],
              ["Rallies", insight.metrics.rallyCountEstimate],
              ["Winners", insight.metrics.winnersEstimate],
              ["Forced", insight.metrics.forcedErrorsEstimate],
              ["Unforced", insight.metrics.unforcedErrorsEstimate],
              ["T-control", `${insight.metrics.tControlPercent}%`],
              ["Swing", `${insight.metrics.swingPathScore}/100`],
              ["Footwork", `${insight.metrics.footworkScore}/100`],
              ["Return T", `${insight.metrics.avgReturnToTSeconds}s`],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl border border-gray-200 bg-gray-50 p-2">
                <span className="block text-gray-400">{label}</span>
                <b className="text-base tabular-nums">{value}</b>
              </div>
            ))}
          </div>
          {bullets.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm">
              {bullets.map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-vyro-red" />
                  <span className="text-gray-700">{b}</span>
                </li>
              ))}
            </ul>
          )}
          <InsightList title="What the video showed" items={insight.videoEvidence} />
          <InsightList title="4-week development plan" items={insight.developmentPlan} />
          <InsightList title="Analyzer limits" items={insight.limitations} muted />
        </>
      )}
    </Card>
  );
}

function InsightList({ title, items, muted = false }: { title: string; items?: string[]; muted?: boolean }) {
  if (!items?.length) return null;
  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{title}</h4>
      <ul className="mt-2 space-y-1.5 text-sm">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-vyro-red" />
            <span className={muted ? "text-gray-500" : "text-gray-700"}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}


function VideoPanel({ caption, videoUrl }: { caption: string; videoUrl?: string | null }) {
  return (
    <Card>
      <div className="relative grid aspect-video place-items-center overflow-hidden rounded-2xl border border-gray-300 bg-black">
        {videoUrl ? (
          <video src={videoUrl} controls className="h-full w-full object-contain" />
        ) : (
          <div className="grid h-16 w-16 place-items-center rounded-full border border-white/20 bg-white/10">
            <Play className="h-8 w-8 text-white" />
          </div>
        )}
        <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
          <Pill color="red">LIVE TAG</Pill>
          <Pill>30 fps · 4K</Pill>
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.18em] text-white/70">
          <span>{caption}</span>
        </div>
      </div>

    </Card>
  );
}

function Overview({ videoUrl, insight }: { videoUrl?: string | null; insight?: SquashInsight | null }) {
  const summaryRows = insight ? [
    ["Swings detected", String(insight.metrics.totalShotsEstimate)],
    ["Rallies", String(insight.metrics.rallyCountEstimate)],
    ["Winners", String(insight.metrics.winnersEstimate)],
    ["Forced errors", String(insight.metrics.forcedErrorsEstimate)],
    ["Unforced errors", String(insight.metrics.unforcedErrorsEstimate)],
    ["Avg return-to-T", `${insight.metrics.avgReturnToTSeconds}s`],
    ["T-control", `${insight.metrics.tControlPercent}%`],
    ["Shot quality", `${insight.metrics.shotQualityScore}/100`],
  ] : [
    ["Swings detected", "312"],
    ["Lunges (≥45°)", "84"],
    ["Avg return-to-T", "1.31s"],
    ["Avg first-step burst", "2.6 ft"],
    ["Court coverage", "71%"],
    ["Right-shot calls", "78%"],
    ["Avg HR in rally", "168 bpm"],
    ["Peak HR", "192 bpm"],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <VideoPanel caption="Game 3 · Rally 14 · Back-left retrieval" videoUrl={videoUrl} />
      </div>
      <Card>
        <h3 className="font-semibold">Match summary</h3>
        <div className="mt-3 space-y-3 text-sm">
          {summaryRows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">{k}</span>
              <b className="tabular-nums">{v}</b>
            </div>
          ))}
        </div>
      </Card>
      <Card className="lg:col-span-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Rally timeline</h3>
          <Pill color="amber">{insight ? `${insight.confidence} confidence · uploaded video` : "red zones = fatigue swing decay"}</Pill>
        </div>
        {insight?.timeline?.length ? (
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {insight.timeline.map((event, i) => (
              <div key={`${event.time}-${i}`} className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500">{event.time} · {event.phase}</div>
                <b className="mt-1 block">{event.keyShot}</b>
                <p className="mt-1 text-gray-600">{event.observation}</p>
                <p className="mt-2 text-vyro-amber">{event.coachingCue}</p>
              </div>
            ))}
          </div>
        ) : (
        <>
        <div className="mt-4 flex h-10 w-full overflow-hidden rounded-xl border border-gray-200">
          {Array.from({ length: 38 }).map((_, i) => {
            const intensity = 0.25 + ((i * 37) % 100) / 130;
            const fatigue = i > 26 && i % 3 === 0;
            return (
              <div
                key={i}
                className="flex-1 border-r border-gray-100"
                style={{
                  background: fatigue
                    ? `rgba(255,43,43,${0.4 + intensity / 2})`
                    : `rgba(0,0,0,${0.04 + intensity / 4})`,
                }}
                title={`Rally ${i + 1}`}
              />
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-mono uppercase tracking-[0.18em] text-gray-400">
          <span>R1</span>
          <span>R19</span>
          <span>R38</span>
        </div>
        </>
        )}
      </Card>
    </div>
  );
}

function Footwork({ videoUrl }: { videoUrl?: string | null }) {
  const steps = [
    ["First-step burst", 88, "2.6 ft avg push-off from T"],
    ["Acceleration", 86, "0–4 ft in 0.41s"],
    ["Deceleration control", 79, "stop into lunge inside 2 strides"],
    ["Lunge depth", 84, "front-knee 112° avg · trail-leg 168°"],
    ["Split-step timing", 81, "fires 0.18s before opponent contact"],
    ["Recovery push", 77, "back-to-T 1.31s avg"],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <VideoPanel caption="Explosive step → front-right lunge · pose overlay" videoUrl={videoUrl} />
      </div>
      <Card>
        <h3 className="font-semibold">Explosive step breakdown</h3>
        <div className="mt-4 space-y-3 text-sm">
          {steps.map(([k, v, sub]) => (
            <div key={k as string}>
              <div className="flex items-center justify-between">
                <span>{k}</span>
                <b className="tabular-nums">{v}</b>
              </div>
              <Bar value={v as number} color={(v as number) < 80 ? "amber" : "white"} />
              <div className="mt-1 text-[11px] text-gray-400">{sub}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="lg:col-span-3">
        <h3 className="font-semibold">Step pattern from the T</h3>
        <div className="mt-4 aspect-[2/1] rounded-2xl border border-gray-300 bg-black p-4">
          <svg viewBox="0 0 600 300" className="h-full w-full">
            <rect x="20" y="20" width="560" height="260" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
            <line x1="300" y1="20" x2="300" y2="280" stroke="rgba(255,255,255,0.3)" />
            <line x1="20" y1="180" x2="580" y2="180" stroke="rgba(255,255,255,0.3)" />
            <circle cx="300" cy="180" r="14" fill="none" stroke="white" strokeWidth="2" />
            <text x="310" y="176" fill="white" fontSize="11" fontFamily="monospace">T</text>
            {[
              [300, 180, 90, 70, "#ff2b2b"],
              [220, 90, 60, 60, "#ffb020"],
              [120, 80, 40, 50, "#ffb020"],
              [300, 180, 90, 70, "#ff2b2b"],
              [440, 110, 70, 60, "#ffb020"],
              [510, 60, 35, 55, "#fff"],
              [300, 180, 90, 70, "#ff2b2b"],
              [180, 240, 45, 65, "#ffb020"],
              [110, 260, 30, 70, "#fff"],
            ].map(([x, y, r, , c], i, arr) => (
              <g key={i}>
                {i > 0 && (
                  <line
                    x1={arr[i - 1][0] as number}
                    y1={arr[i - 1][1] as number}
                    x2={x as number}
                    y2={y as number}
                    stroke="rgba(255,255,255,0.25)"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                )}
                <circle cx={x as number} cy={y as number} r={(r as number) / 12} fill={c as string} opacity="0.85" />
              </g>
            ))}
          </svg>
        </div>
      </Card>
    </div>
  );
}

function Swing() {
  const profile = sportProfiles.Squash;
  const counts = [
    ["Straight drive", 112, "white"],
    ["Cross-court", 58, "white"],
    ["Boast", 31, "amber"],
    ["Volley drive", 47, "white"],
    ["Volley kill", 19, "white"],
    ["Drop", 28, "amber"],
    ["Lob", 17, "white"],
  ] as const;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SportSwing profile={profile} />
      <Card>
        <h3 className="font-semibold">Swing detection · 312 swings</h3>
        <div className="mt-4 space-y-2 text-sm">
          {counts.map(([k, v, c]) => (
            <div key={k} className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <b>{k}</b>
                <span className="tabular-nums text-gray-600">{v}</span>
              </div>
              <Bar value={(v / 112) * 100} color={c} />
            </div>
          ))}
        </div>
      </Card>
      <Card className="lg:col-span-2">
        <h3 className="font-semibold">Biomechanics</h3>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          {[
            ["Racket head speed", "82 mph"],
            ["Wrist snap angle", "47°"],
            ["Shoulder rotation", "94°"],
            ["Hip-shoulder separation", "38°"],
            ["Contact height", "1.18 m"],
            ["Contact in front of body", "+22 cm"],
            ["Follow-through length", "42 in"],
            ["Late-rally speed decay", "−7% after R20"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-gray-50 p-3">
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-400">{k}</div>
              <b className="text-base">{v}</b>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function TCourt() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="font-semibold">T-occupancy heat map</h3>
        <p className="mt-2 text-sm text-gray-500">71% of rally time within 0.9 m of the T.</p>
        <div className="mt-4 aspect-[3/4] rounded-2xl border border-gray-300 bg-black p-4">
          <div className="relative h-full w-full rounded-xl border-2 border-white/60">
            <div className="absolute left-0 right-0 top-[14%] border-t border-white/50" />
            <div className="absolute left-0 right-0 top-[38%] border-t border-white/50" />
            <div className="absolute left-1/2 top-[38%] h-[62%] border-l border-white/50" />
            <div className="absolute inset-0 grid grid-cols-6 grid-rows-8 gap-1 p-2">
              {Array.from({ length: 48 }, (_, i) => {
                const tZone = i === 21 || i === 22 || i === 27 || i === 28;
                const intensity = tZone ? 0.95 : 0.08 + (i % 9) / 14;
                return (
                  <div
                    key={i}
                    className="rounded"
                    style={{ background: `rgba(255,43,43,${intensity})` }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </Card>
      <Card>
        <h3 className="font-semibold">Return-to-T metrics</h3>
        <div className="mt-4 space-y-3 text-sm">
          {[
            ["Avg return-to-T", "1.31s", 82],
            ["Fastest return", "0.94s", 96],
            ["Slowest return", "2.18s", 38],
            ["After back-left retrieval", "1.62s", 64],
            ["After front-right drop chase", "1.47s", 71],
            ["Late-game decay", "+0.21s", 55],
          ].map(([k, v, n]) => (
            <div key={k as string}>
              <div className="flex items-center justify-between">
                <span>{k}</span>
                <b className="tabular-nums">{v}</b>
              </div>
              <Bar value={n as number} color={(n as number) < 70 ? "amber" : "white"} />
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-400">Coach note</div>
          You concede the T 0.21s slower in games 3–5. Crossover-step out of the back-left lunge is the unlock.
        </div>
      </Card>
    </div>
  );
}

function Tactics() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="font-semibold">Shot selection</h3>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[
            ["Right call", "78%", "white"],
            ["Forced error", "9%", "amber"],
            ["Wrong call", "13%", "red"],
          ].map(([k, v, c]) => (
            <div key={k as string} className="rounded-2xl bg-gray-50 p-3">
              <div className={`text-2xl font-semibold tabular-nums ${c === "red" ? "text-vyro-red" : c === "amber" ? "text-vyro-amber" : ""}`}>{v}</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500">{k}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2 text-sm">
          {[
            "Back-left under pressure → straight drive 72% (optimal)",
            "Front-right loose ball → counter-drop chosen 58% (kill was open 41%)",
            "Mid-court volley → boast 22% (low-percentage, opponent reads it)",
          ].map((x) => (
            <div key={x} className="rounded-2xl border border-gray-200 bg-gray-50 p-3">{x}</div>
          ))}
        </div>
      </Card>
      <Card>
        <h3 className="font-semibold">Opponent tendency</h3>
        <div className="mt-4 space-y-3 text-sm">
          {[
            ["Back-right: straight drive on critical points", 71],
            ["Front-left: counter-drop under pressure", 64],
            ["Serve return: cross-court 58%", 58],
            ["Tin risk on stretched forehand drop", 44],
            ["Boast frequency rises in game 4–5", 49],
          ].map(([k, v]) => (
            <div key={k as string}>
              <div className="flex items-center justify-between">
                <span>{k}</span>
                <b className="tabular-nums">{v}%</b>
              </div>
              <Bar value={v as number} color={(v as number) > 60 ? "red" : "amber"} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Physio() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="font-semibold">Rally load · HR + stride</h3>
        <div className="mt-4 aspect-[2/1] rounded-2xl border border-gray-300 bg-black p-4">
          <svg viewBox="0 0 600 240" className="h-full w-full">
            <path
              d="M0 200 C 60 140, 120 60, 180 80 S 300 200, 360 110 S 480 40, 540 90 L600 70 L600 240 L0 240 Z"
              fill="rgba(255,43,43,0.18)"
              stroke="#ff2b2b"
              strokeWidth="3"
            />
            <path
              d="M0 180 C 80 150, 160 120, 240 130 S 400 180, 480 130 L600 110"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeDasharray="5 4"
            />
            <text x="10" y="20" fill="#ff2b2b" fontSize="11" fontFamily="monospace">HR (bpm)</text>
            <text x="10" y="36" fill="white" fontSize="11" fontFamily="monospace">stride freq</text>
          </svg>
        </div>
      </Card>
      <Card>
        <h3 className="font-semibold">Per-rally load</h3>
        <div className="mt-4 space-y-3 text-sm">
          {[
            ["Avg rally length", "11.4 shots"],
            ["Longest rally", "38 shots · 47s"],
            ["Time above 180 bpm", "6:12"],
            ["HRV drop in-match", "−18ms"],
            ["Estimated calories", "612 kcal"],
            ["Post-match recovery target", "62 min @ 110 bpm"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">{k}</span>
              <b className="tabular-nums">{v}</b>
            </div>
          ))}
        </div>
      </Card>
      <Card className="lg:col-span-2">
        <h3 className="font-semibold">Injury & overload flags</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["Front-knee landing angle", "112° → 104° in G5", "amber"],
            ["Trail-leg drag on lunge", "+8% late game", "amber"],
            ["Asymmetry (L/R push-off)", "11% L-dominant", "red"],
          ].map(([k, v, c]) => (
            <div key={k} className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <b className="text-sm">{k}</b>
                <Pill color={c as "amber" | "red"}>flag</Pill>
              </div>
              <div className="mt-1 text-xs text-gray-500">{v}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
