// Browser-only whole-clip scanner for the AI squash video analyser.
// Never call at module scope — only from an event handler.
//
// Pipeline:
//   1. sample the clip on a fixed cadence and build a coarse frame-difference grid
//   2. cluster the moving pixels into up to TWO movers per frame (k-means, k=2)
//      so the two players are separated instead of averaged into one centroid
//   3. fit the court box from where motion actually happens in THIS clip, then
//      map every position into normalised court coordinates
//   4. track the two movers across frames so "you" and "your opponent" keep
//      their identity, and derive shots, zones and recovery-to-T per player
import { ZONE_KEYS, type ClipInput } from "@/lib/video-analysis-core";

const GRID = 24; // diff grid resolution (GRID x GRID cells)
const MAX_CHECKPOINTS = 420;
// T box in normalised COURT coordinates (not raw frame coordinates).
const T_X = [0.33, 0.67] as const;
const T_Y = [0.3, 0.72] as const;

export type ScanProgress = { ratio: number; label: string };

type Det = { x: number; y: number; mass: number };

type Frame = {
  t: number;
  motion: number;
  brightness: number;
  dets: Det[]; // 0, 1 or 2 movers, strongest first (raw frame coords)
};

type Pos = { x: number; y: number } | null;

function zoneFor(x: number, y: number): string {
  const depth = y < 1 / 3 ? "front" : y < 2 / 3 ? "mid" : "back";
  const lane = x < 1 / 3 ? "forehand" : x < 2 / 3 ? "centre" : "backhand";
  return `${depth}-${lane}`;
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error("Could not read this video."));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", done);
      video.removeEventListener("error", fail);
      clearTimeout(timer);
    };
    // Some browsers silently drop a seek near the end of a clip — don't hang.
    const timer = setTimeout(done, 4000);
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
    video.addEventListener(
      "error",
      () => reject(new Error("This video format can't be read in this browser. Try an MP4 (H.264) export.")),
      { once: true },
    );
  });
}

/** Split moving cells into up to two movers with a tiny weighted k-means. */
function clusterMovers(cells: Array<{ x: number; y: number; v: number }>, total: number): Det[] {
  if (!cells.length || total <= 0) return [];
  // Single centroid fallback.
  const cx = cells.reduce((a, c) => a + c.x * c.v, 0) / total;
  const cy = cells.reduce((a, c) => a + c.y * c.v, 0) / total;
  if (cells.length < 4) return [{ x: cx, y: cy, mass: total }];

  // Seed the two centres at the two most distant heavy cells.
  let seedA = cells[0]!;
  for (const c of cells) if (c.v > seedA.v) seedA = c;
  let seedB = cells[0]!;
  let bestScore = -1;
  for (const c of cells) {
    const score = Math.hypot(c.x - seedA.x, c.y - seedA.y) * c.v;
    if (score > bestScore) {
      bestScore = score;
      seedB = c;
    }
  }
  let ax = seedA.x;
  let ay = seedA.y;
  let bx = seedB.x;
  let by = seedB.y;

  let massA = 0;
  let massB = 0;
  for (let iter = 0; iter < 5; iter++) {
    let sax = 0, say = 0, sbx = 0, sby = 0;
    massA = 0;
    massB = 0;
    for (const c of cells) {
      const da = Math.hypot(c.x - ax, c.y - ay);
      const db = Math.hypot(c.x - bx, c.y - by);
      if (da <= db) {
        massA += c.v;
        sax += c.x * c.v;
        say += c.y * c.v;
      } else {
        massB += c.v;
        sbx += c.x * c.v;
        sby += c.y * c.v;
      }
    }
    if (massA > 0) {
      ax = sax / massA;
      ay = say / massA;
    }
    if (massB > 0) {
      bx = sbx / massB;
      by = sby / massB;
    }
  }

  const separation = Math.hypot(ax - bx, ay - by);
  const weaker = Math.min(massA, massB);
  // One blob (or two overlapping bodies) → report a single mover.
  if (separation < 0.14 || weaker < total * 0.14) return [{ x: cx, y: cy, mass: total }];

  const out: Det[] = [
    { x: ax, y: ay, mass: massA },
    { x: bx, y: by, mass: massB },
  ];
  out.sort((p, q) => q.mass - p.mass);
  return out;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return p;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[i]!;
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

    // Fixed budget of checkpoints so a 3s clip and a 60min match both stay responsive.
    const step = Math.max(0.35, duration / MAX_CHECKPOINTS);
    const times: number[] = [];
    for (let t = 0.05; t < duration - 0.05 && times.length < MAX_CHECKPOINTS; t += step) times.push(t);
    if (times.length === 0) times.push(0);

    const small = document.createElement("canvas");
    small.width = GRID;
    small.height = GRID;
    const sctx = small.getContext("2d", { willReadFrequently: true });
    const big = document.createElement("canvas");
    const bctx = big.getContext("2d");
    if (!sctx || !bctx) throw new Error("Canvas is unavailable in this browser.");

    // ---- pass 1: motion + movers ------------------------------------------
    const frames: Frame[] = [];
    let prev: Uint8ClampedArray | null = null;

    for (let i = 0; i < times.length; i++) {
      await seek(video, times[i]!);
      sctx.drawImage(video, 0, 0, GRID, GRID);
      const px = sctx.getImageData(0, 0, GRID, GRID).data;
      const gray = new Uint8ClampedArray(GRID * GRID);
      let bright = 0;
      for (let p = 0; p < GRID * GRID; p++) {
        const g = (px[p * 4]! * 0.299 + px[p * 4 + 1]! * 0.587 + px[p * 4 + 2]! * 0.114) | 0;
        gray[p] = g;
        bright += g;
      }
      const brightness = bright / (GRID * GRID);

      if (prev) {
        let total = 0;
        const cells: Array<{ x: number; y: number; v: number }> = [];
        for (let gy = 0; gy < GRID; gy++) {
          for (let gx = 0; gx < GRID; gx++) {
            const idx = gy * GRID + gx;
            const d = Math.abs(gray[idx]! - prev[idx]!);
            if (d > 14) {
              total += d;
              cells.push({ x: (gx + 0.5) / GRID, y: (gy + 0.5) / GRID, v: d });
            }
          }
        }
        const motion = Math.max(0, Math.min(100, Math.round((total / (GRID * GRID * 40)) * 100)));
        frames.push({
          t: times[i]!,
          motion,
          brightness: Math.round(brightness),
          dets: clusterMovers(cells, total),
        });
      }
      prev = gray;

      if (i % 4 === 0) {
        onProgress({
          ratio: 0.05 + 0.7 * (i / times.length),
          label: `Scanning court motion ${Math.round((i / times.length) * 100)}% · ${Math.round(times[i]!)}s of ${Math.round(duration)}s`,
        });
      }
    }

    onProgress({ ratio: 0.76, label: "Fitting the court and tracking both players…" });

    // ---- fit the court box from observed motion ---------------------------
    const xs: number[] = [];
    const ys: number[] = [];
    for (const f of frames) {
      if (f.motion < 4) continue;
      for (const d of f.dets) {
        xs.push(d.x);
        ys.push(d.y);
      }
    }
    xs.sort((a, b) => a - b);
    ys.sort((a, b) => a - b);
    const x0 = xs.length > 20 ? percentile(xs, 0.03) : 0;
    const x1 = xs.length > 20 ? percentile(xs, 0.97) : 1;
    const y0 = ys.length > 20 ? percentile(ys, 0.03) : 0;
    const y1 = ys.length > 20 ? percentile(ys, 0.97) : 1;
    const spanX = Math.max(0.15, x1 - x0);
    const spanY = Math.max(0.15, y1 - y0);
    const courtX = (x: number) => Math.max(0, Math.min(1, (x - x0) / spanX));
    const courtY = (y: number) => Math.max(0, Math.min(1, (y - y0) / spanY));

    // ---- track the two movers so identities persist -----------------------
    let trackA: Pos = null; // "you"
    let trackB: Pos = null; // opponent
    const playerPos: Pos[] = [];
    const opponentPos: Pos[] = [];
    const playerMass: number[] = [];
    const opponentMass: number[] = [];

    const dist = (p: Pos, d: Det) => (p ? Math.hypot(p.x - d.x, p.y - d.y) : Number.POSITIVE_INFINITY);

    for (const f of frames) {
      const dets = f.dets;
      let assignA: Det | null = null;
      let assignB: Det | null = null;

      if (dets.length >= 2) {
        const [d1, d2] = [dets[0]!, dets[1]!];
        if (!trackA && !trackB) {
          // Seed: the mover nearer the bottom of the frame is closest to the
          // camera, which is filmed from behind the player.
          if (d1.y >= d2.y) {
            assignA = d1;
            assignB = d2;
          } else {
            assignA = d2;
            assignB = d1;
          }
        } else {
          const straight = dist(trackA, d1) + dist(trackB, d2);
          const swapped = dist(trackA, d2) + dist(trackB, d1);
          if (straight <= swapped) {
            assignA = d1;
            assignB = d2;
          } else {
            assignA = d2;
            assignB = d1;
          }
        }
      } else if (dets.length === 1) {
        const d = dets[0]!;
        // Give the single blob to whichever track it is closer to.
        assignA = dist(trackA, d) <= dist(trackB, d) ? d : null;
        assignB = assignA ? null : d;
      }

      if (assignA) trackA = { x: assignA.x, y: assignA.y };
      if (assignB) trackB = { x: assignB.x, y: assignB.y };

      playerPos.push(assignA ? { x: courtX(assignA.x), y: courtY(assignA.y) } : null);
      opponentPos.push(assignB ? { x: courtX(assignB.x), y: courtY(assignB.y) } : null);
      playerMass.push(assignA?.mass ?? 0);
      opponentMass.push(assignB?.mass ?? 0);
    }

    // ---- anchor the court grid on the real T ------------------------------
    // Both players hover around the T, so the centre of the occupancy
    // distribution IS the T for this camera angle. Zones are then court
    // relative (mid-centre == the T) instead of arbitrary frame thirds.
    const occX: number[] = [];
    const occY: number[] = [];
    for (const p of [...playerPos, ...opponentPos]) {
      if (!p) continue;
      occX.push(p.x);
      occY.push(p.y);
    }
    occX.sort((a, b) => a - b);
    occY.sort((a, b) => a - b);
    const tcx = occX.length > 20 ? percentile(occX, 0.5) : 0.5;
    const tcy = occY.length > 20 ? percentile(occY, 0.5) : 0.5;
    const LANE = 0.15; // half-width of the centre lane, court units
    const DEPTH = 0.17; // half-depth of the mid band, court units
    const zoneOf = (p: { x: number; y: number }) => {
      const depth = p.y < tcy - DEPTH ? "front" : p.y <= tcy + DEPTH ? "mid" : "back";
      const lane = p.x < tcx - LANE ? "forehand" : p.x <= tcx + LANE ? "centre" : "backhand";
      return `${depth}-${lane}`;
    };

    // ---- derived stats ----------------------------------------------------
    const motions = frames.map((f) => f.motion);
    const averageMotion = motions.length ? motions.reduce((a, b) => a + b, 0) / motions.length : 0;
    const peakMotion = motions.length ? Math.max(...motions) : 0;
    const activeFloor = Math.max(6, averageMotion * 0.85);
    const shotFloor = Math.max(12, averageMotion + (peakMotion - averageMotion) * 0.35);

    const activeSeconds = frames.filter((f) => f.motion >= activeFloor).length * step;

    let rallyCount = 0;
    let inRally = false;
    let quiet = 0;
    const rallyShotCounts: number[] = [];
    let currentShots = 0;
    const shotCandidates: NonNullable<ClipInput["shotCandidates"]> = [];
    const playerHist = new Array(9).fill(0);
    const opponentHist = new Array(9).fill(0);
    const tReturnEvents: NonNullable<ClipInput["tReturnEvents"]> = [];

    const inT = (p: Pos) => !!p && zoneOf(p) === "mid-centre";
    let tSamples = 0;
    let playerSeen = 0;
    let offTRun = 0;
    let longestOffTSeconds = 0;

    const bump = (hist: number[], p: Pos) => {
      if (!p) return;
      const idx = ZONE_KEYS.indexOf(zoneFor(p.x, p.y) as (typeof ZONE_KEYS)[number]);
      if (idx >= 0) hist[idx] += 1;
    };

    for (let i = 0; i < frames.length; i++) {
      const f = frames[i]!;
      const isActive = f.motion >= activeFloor;
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

      const prevM = frames[i - 1]?.motion ?? 0;
      const nextM = frames[i + 1]?.motion ?? 0;
      if (f.motion >= shotFloor && f.motion >= prevM && f.motion >= nextM) {
        const me = playerPos[i]!;
        const them = opponentPos[i]!;
        // The mover producing the most motion at the contact frame struck the ball.
        const playerStruck = (playerMass[i] ?? 0) >= (opponentMass[i] ?? 0);
        const striker = playerStruck ? me : them;
        const actor: "player" | "opponent" | "unknown" = striker
          ? playerStruck
            ? "player"
            : "opponent"
          : "unknown";
        const zone = striker ? zoneFor(striker.x, striker.y) : "mid-centre";
        shotCandidates.push({ t: Number(f.t.toFixed(2)), motion: f.motion, zone, actor });
        if (inRally) currentShots += 1;

        // Each contact records BOTH players' court positions so the two heat
        // maps describe different areas of the court.
        bump(playerHist, me);
        bump(opponentHist, them);

        // Time from this contact until you are back inside the T box.
        for (let j = i + 1; j < Math.min(frames.length, i + Math.ceil(8 / step)); j++) {
          if (inT(playerPos[j]!)) {
            tReturnEvents.push({
              t: Number(f.t.toFixed(2)),
              secondsToT: Number(((j - i) * step).toFixed(2)),
            });
            break;
          }
        }
      }

      const me = playerPos[i]!;
      if (me) {
        playerSeen += 1;
        if (inT(me)) {
          tSamples += 1;
          longestOffTSeconds = Math.max(longestOffTSeconds, offTRun);
          offTRun = 0;
        } else if (isActive) {
          offTRun += step;
        }
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

    onProgress({ ratio: 0.82, label: "Choosing evidence frames…" });

    // ---- evidence frames --------------------------------------------------
    const bucketCount = 8;
    const picks: number[] = [];
    for (let b = 0; b < bucketCount; b++) {
      const lo = (duration * b) / bucketCount;
      const hi = (duration * (b + 1)) / bucketCount;
      const inBucket = frames.filter((f) => f.t >= lo && f.t < hi);
      if (!inBucket.length) continue;
      const best = inBucket.reduce((a, f) => (f.motion > a.motion ? f : a), inBucket[0]!);
      picks.push(best.t);
    }
    const targetW = 560;
    const scale = video.videoWidth ? Math.min(1, targetW / video.videoWidth) : 1;
    big.width = Math.max(160, Math.round((video.videoWidth || targetW) * scale));
    big.height = Math.max(90, Math.round((video.videoHeight || 360) * scale));

    const evidence: string[] = [];
    const frameTimes: number[] = [];
    for (let i = 0; i < picks.length; i++) {
      await seek(video, picks[i]!);
      bctx.drawImage(video, 0, 0, big.width, big.height);
      evidence.push(big.toDataURL("image/jpeg", 0.55));
      frameTimes.push(Number(picks[i]!.toFixed(2)));
      onProgress({ ratio: 0.85 + 0.1 * ((i + 1) / picks.length), label: "Capturing evidence frames…" });
    }

    const stride = Math.max(1, Math.ceil(frames.length / 600));
    const motionTimeline = frames
      .filter((_, i) => i % stride === 0)
      .map((f, k) => {
        const i = k * stride;
        const me = playerPos[i] ?? null;
        const x = me ? me.x : f.dets[0] ? courtX(f.dets[0]!.x) : 0.5;
        const y = me ? me.y : f.dets[0] ? courtY(f.dets[0]!.y) : 0.5;
        return {
          t: Number(f.t.toFixed(2)),
          motion: f.motion,
          x: Number(x.toFixed(3)),
          y: Number(y.toFixed(3)),
          zone: zoneFor(x, y),
          brightness: f.brightness,
        };
      });

    onProgress({ ratio: 0.97, label: "Sending to the analyser…" });

    return {
      videoName: file.name.slice(0, 200) || "match.mp4",
      durationSec: Number(duration.toFixed(2)),
      frames: evidence.slice(0, 12),
      frameTimes: frameTimes.slice(0, 12),
      sampleEverySec: Number(step.toFixed(2)),
      motionTimeline,
      shotCandidates: shotCandidates.slice(0, 400),
      tReturnEvents: tReturnEvents.slice(0, 400),
      playerZoneHistogram: normalise(playerHist),
      opponentZoneHistogram: normalise(opponentHist),
      derivedStats: {
        scannedFrames: Math.max(1, frames.length),
        activeSeconds: Number(activeSeconds.toFixed(1)),
        rallyCountEstimate: rallyCount,
        totalShotsEstimate: shotCandidates.length,
        averageMotion: Number(averageMotion.toFixed(1)),
        peakMotion,
        highIntensityWindows: frames.filter((f) => f.motion >= shotFloor).length,
        tReturnCount: tReturnEvents.length,
        avgSecondsToT: Number(avgSecondsToT.toFixed(2)),
        tTimePercent: playerSeen ? Number(((tSamples / playerSeen) * 100).toFixed(1)) : 0,
        longestOffTSeconds: Number(Math.min(600, longestOffTSeconds).toFixed(1)),
        workRestRatio: Number(Math.min(50, activeSeconds / restSeconds).toFixed(2)),
      },
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
