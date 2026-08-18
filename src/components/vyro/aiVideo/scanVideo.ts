// Browser-only whole-clip scanner for the AI squash video analyser.
// Never call at module scope — only from an event handler.
import { ZONE_KEYS, type ClipInput } from "@/lib/video-analysis-core";

const GRID = 24; // diff grid resolution (GRID x GRID cells)
const T_X = [0.35, 0.65] as const; // T zone box in normalised frame coords
const T_Y = [0.4, 0.72] as const;

export type ScanProgress = { ratio: number; label: string };

type Sample = {
  t: number;
  motion: number;
  x: number;
  y: number;
  zone: string;
  brightness: number;
  secondaryY: number | null;
  secondaryZone: string | null;
};

function zoneFor(x: number, y: number): string {
  const depth = y < 0.36 ? "front" : y < 0.68 ? "mid" : "back";
  const lane = x < 0.36 ? "forehand" : x < 0.64 ? "centre" : "backhand";
  return `${depth}-${lane}`;
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      video.removeEventListener("error", fail);
      resolve();
    };
    const fail = () => {
      video.removeEventListener("seeked", done);
      video.removeEventListener("error", fail);
      reject(new Error("Could not read this video."));
    };
    video.addEventListener("seeked", done);
    video.addEventListener("error", fail);
    video.currentTime = Math.max(0, time);
  });
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    video.src = url;
    const ok = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        reject(new Error("Video duration could not be read."));
        return;
      }
      resolve(video);
    };
    video.addEventListener("loadedmetadata", ok, { once: true });
    video.addEventListener("error", () => reject(new Error("This video format can't be read in the browser.")), { once: true });
  });
}

export async function scanSquashVideo(
  file: File,
  onProgress: (p: ScanProgress) => void,
): Promise<ClipInput> {
  const url = URL.createObjectURL(file);
  try {
    onProgress({ ratio: 0.02, label: "Loading video…" });
    const video = await loadVideo(url);
    const duration = video.duration;

    const step = Math.min(2, Math.max(0.4, duration / 420));
    const times: number[] = [];
    for (let t = 0.05; t < duration - 0.05 && times.length < 850; t += step) times.push(t);
    if (times.length === 0) times.push(0);

    const small = document.createElement("canvas");
    small.width = GRID;
    small.height = GRID;
    const sctx = small.getContext("2d", { willReadFrequently: true });
    const big = document.createElement("canvas");
    const bctx = big.getContext("2d");
    if (!sctx || !bctx) throw new Error("Canvas is unavailable in this browser.");

    const samples: Sample[] = [];
    let prev: Uint8ClampedArray | null = null;

    for (let i = 0; i < times.length; i++) {
      await seek(video, times[i]!);
      sctx.drawImage(video, 0, 0, GRID, GRID);
      const frame = sctx.getImageData(0, 0, GRID, GRID).data;
      const gray = new Uint8ClampedArray(GRID * GRID);
      let bright = 0;
      for (let p = 0; p < GRID * GRID; p++) {
        const g = (frame[p * 4]! * 0.299 + frame[p * 4 + 1]! * 0.587 + frame[p * 4 + 2]! * 0.114) | 0;
        gray[p] = g;
        bright += g;
      }
      const brightness = bright / (GRID * GRID);

      if (prev) {
        let total = 0;
        let sx = 0;
        let sy = 0;
        const cells: Array<{ x: number; y: number; v: number }> = [];
        for (let gy = 0; gy < GRID; gy++) {
          for (let gx = 0; gx < GRID; gx++) {
            const idx = gy * GRID + gx;
            const d = Math.abs(gray[idx]! - prev[idx]!);
            if (d > 14) {
              const nx = (gx + 0.5) / GRID;
              const ny = (gy + 0.5) / GRID;
              total += d;
              sx += nx * d;
              sy += ny * d;
              cells.push({ x: nx, y: ny, v: d });
            }
          }
        }
        const motion = Math.max(0, Math.min(100, Math.round((total / (GRID * GRID * 40)) * 100)));
        const x = total > 0 ? sx / total : 0.5;
        const y = total > 0 ? sy / total : 0.5;

        // Second mover: diff mass far from the primary centroid.
        let s2 = 0;
        let s2x = 0;
        let s2y = 0;
        for (const c of cells) {
          if (Math.hypot(c.x - x, c.y - y) > 0.22) {
            s2 += c.v;
            s2x += c.x * c.v;
            s2y += c.y * c.v;
          }
        }
        const hasSecondary = s2 > total * 0.18 && s2 > 0;
        const secX = hasSecondary ? s2x / s2 : null;
        const secY = hasSecondary ? s2y / s2 : null;

        samples.push({
          t: times[i]!,
          motion,
          x: Number(x.toFixed(3)),
          y: Number(y.toFixed(3)),
          zone: zoneFor(x, y),
          brightness: Math.round(brightness),
          secondaryY: secY,
          secondaryZone: secX != null && secY != null ? zoneFor(secX, secY) : null,
        });
      }
      prev = gray;

      if (i % 4 === 0) {
        onProgress({
          ratio: 0.05 + 0.75 * (i / times.length),
          label: `Scanning court motion ${Math.round((i / times.length) * 100)}%`,
        });
      }
    }

    // --- derived stats -----------------------------------------------------
    const motions = samples.map((s) => s.motion);
    const averageMotion = motions.length ? motions.reduce((a, b) => a + b, 0) / motions.length : 0;
    const peakMotion = motions.length ? Math.max(...motions) : 0;
    const activeFloor = Math.max(6, averageMotion * 0.85);
    const shotFloor = Math.max(12, averageMotion + (peakMotion - averageMotion) * 0.35);

    const activeSamples = samples.filter((s) => s.motion >= activeFloor);
    const activeSeconds = activeSamples.length * step;

    // Rallies = contiguous active runs separated by >= 3s of quiet.
    let rallyCount = 0;
    let inRally = false;
    let quiet = 0;
    const rallyShotCounts: number[] = [];
    let currentShots = 0;
    const shotCandidates: NonNullable<ClipInput["shotCandidates"]> = [];
    const playerHist = new Array(9).fill(0);
    const opponentHist = new Array(9).fill(0);
    const tReturnEvents: NonNullable<ClipInput["tReturnEvents"]> = [];

    const inT = (s: Sample) => s.x >= T_X[0] && s.x <= T_X[1] && s.y >= T_Y[0] && s.y <= T_Y[1];
    let tSamples = 0;
    let offTRun = 0;
    let longestOffTSeconds = 0;

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i]!;
      const isActive = s.motion >= activeFloor;
      if (isActive) {
        if (!inRally) {
          inRally = true;
          rallyCount += 1;
          currentShots = 0;
        }
        quiet = 0;
      } else {
        quiet += step;
        if (inRally && quiet >= 3) {
          inRally = false;
          rallyShotCounts.push(currentShots);
        }
      }

      // Local motion maximum above the shot floor = contact candidate.
      const prevM = samples[i - 1]?.motion ?? 0;
      const nextM = samples[i + 1]?.motion ?? 0;
      if (s.motion >= shotFloor && s.motion >= prevM && s.motion >= nextM) {
        // Nearer the bottom of the frame = the player (camera behind court).
        const actor: "player" | "opponent" =
          s.secondaryY != null ? (s.y >= s.secondaryY ? "player" : "opponent") : s.y >= 0.5 ? "player" : "opponent";
        shotCandidates.push({ t: Number(s.t.toFixed(2)), motion: s.motion, zone: s.zone, actor });
        if (inRally) currentShots += 1;

        const own = ZONE_KEYS.indexOf(s.zone as (typeof ZONE_KEYS)[number]);
        const other = s.secondaryZone ? ZONE_KEYS.indexOf(s.secondaryZone as (typeof ZONE_KEYS)[number]) : -1;
        if (actor === "player") {
          if (own >= 0) playerHist[own] += 1;
          if (other >= 0) opponentHist[other] += 1;
        } else {
          if (own >= 0) opponentHist[own] += 1;
          if (other >= 0) playerHist[other] += 1;
        }

        // Time from this contact until the player is back inside the T box.
        for (let j = i + 1; j < Math.min(samples.length, i + Math.ceil(8 / step)); j++) {
          if (inT(samples[j]!)) {
            tReturnEvents.push({
              t: Number(s.t.toFixed(2)),
              secondsToT: Number(((j - i) * step).toFixed(2)),
            });
            break;
          }
        }
      }

      if (inT(s)) {
        tSamples += 1;
        longestOffTSeconds = Math.max(longestOffTSeconds, offTRun);
        offTRun = 0;
      } else if (isActive) {
        offTRun += step;
      }
    }
    if (inRally) rallyShotCounts.push(currentShots);
    longestOffTSeconds = Math.max(longestOffTSeconds, offTRun);

    const normalise = (h: number[]) => {
      const max = Math.max(...h, 0);
      return max > 0 ? h.map((v) => Math.round((v / max) * 100)) : h.map(() => 0);
    };

    const avgSecondsToT = tReturnEvents.length
      ? tReturnEvents.reduce((a, e) => a + e.secondsToT, 0) / tReturnEvents.length
      : 0;
    const restSeconds = Math.max(0.1, duration - activeSeconds);

    onProgress({ ratio: 0.84, label: "Choosing evidence frames…" });

    // --- evidence frames ---------------------------------------------------
    const bucketCount = 8;
    const picks: number[] = [];
    for (let b = 0; b < bucketCount; b++) {
      const lo = (duration * b) / bucketCount;
      const hi = (duration * (b + 1)) / bucketCount;
      const inBucket = samples.filter((s) => s.t >= lo && s.t < hi);
      if (!inBucket.length) continue;
      const best = inBucket.reduce((a, s) => (s.motion > a.motion ? s : a), inBucket[0]!);
      picks.push(best.t);
    }
    const targetW = 640;
    const scale = video.videoWidth ? targetW / video.videoWidth : 1;
    big.width = Math.max(160, Math.round((video.videoWidth || targetW) * Math.min(1, scale)));
    big.height = Math.max(90, Math.round((video.videoHeight || 360) * Math.min(1, scale)));

    const frames: string[] = [];
    const frameTimes: number[] = [];
    for (let i = 0; i < picks.length; i++) {
      await seek(video, picks[i]!);
      bctx.drawImage(video, 0, 0, big.width, big.height);
      frames.push(big.toDataURL("image/jpeg", 0.6));
      frameTimes.push(Number(picks[i]!.toFixed(2)));
      onProgress({ ratio: 0.85 + 0.1 * ((i + 1) / picks.length), label: "Capturing evidence frames…" });
    }

    const stride = Math.max(1, Math.ceil(samples.length / 800));
    const motionTimeline = samples
      .filter((_, i) => i % stride === 0)
      .map((s) => ({ t: Number(s.t.toFixed(2)), motion: s.motion, x: s.x, y: s.y, zone: s.zone, brightness: s.brightness }));

    onProgress({ ratio: 0.97, label: "Sending to the analyser…" });

    return {
      videoName: file.name.slice(0, 200) || "match.mp4",
      durationSec: Number(duration.toFixed(2)),
      frames: frames.length ? frames.slice(0, 12) : [],
      frameTimes: frameTimes.slice(0, 12),
      sampleEverySec: Number(step.toFixed(2)),
      motionTimeline,
      shotCandidates: shotCandidates.slice(0, 400),
      tReturnEvents: tReturnEvents.slice(0, 400),
      playerZoneHistogram: normalise(playerHist),
      opponentZoneHistogram: normalise(opponentHist),
      derivedStats: {
        scannedFrames: Math.max(1, samples.length),
        activeSeconds: Number(activeSeconds.toFixed(1)),
        rallyCountEstimate: rallyCount,
        totalShotsEstimate: shotCandidates.length,
        averageMotion: Number(averageMotion.toFixed(1)),
        peakMotion,
        highIntensityWindows: samples.filter((s) => s.motion >= shotFloor).length,
        tReturnCount: tReturnEvents.length,
        avgSecondsToT: Number(avgSecondsToT.toFixed(2)),
        tTimePercent: samples.length ? Number(((tSamples / samples.length) * 100).toFixed(1)) : 0,
        longestOffTSeconds: Number(Math.min(600, longestOffTSeconds).toFixed(1)),
        workRestRatio: Number(Math.min(50, activeSeconds / restSeconds).toFixed(2)),
      },
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
