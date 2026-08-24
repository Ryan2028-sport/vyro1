// Browser-only whole-clip scanner for the AI squash video analyser.
// Never call at module scope — only from an event handler.
//
// Everything this file returns is MEASURED from the pixels:
//   1. sample the clip ~4x/second and build a 64x64 luminance grid
//   2. keep a rolling background model so a standing player is still detected
//      and slow camera drift / crowd movement is rejected
//   3. connected-component blobs on the foreground mask → keep the two most
//      body-like blobs per checkpoint (the two players)
//   4. track both blobs with position prediction so identities survive
//      crossings; "you" = the mover that lives closer to the camera
//   5. contacts come from a strike signal (own-motion spike + direction
//      reversal / deceleration), not a bare global motion peak
//   6. court box + T are fitted to where play actually happens in THIS clip
import { ZONE_KEYS, type ClipInput, type MeasuredStats } from "@/lib/video-analysis-core";

const GRID = 64;
const TARGET_FPS = 8;
const MAX_CHECKPOINTS = 4000;
const MAX_EVIDENCE = 30;
const DIFF_THRESHOLD = 13;
const MIN_BLOB_CELLS = 5;
const COLOUR_WEIGHT = 0.9; // how much kit colour counts against position when matching
const MAX_BLOB_FRACTION = 0.22; // a blob bigger than this is a light change, not a body

// --- camera-segment detection (broadcast edits) -----------------------------
/** Mean per-cell luminance change that can only be a cut, never a rally. */
const CUT_MEAN_DIFF = 26;
/** A softer cut: most of the picture changed a lot at once. */
const CUT_FRACTION = 0.55;
const CUT_FRACTION_DIFF = 16;
/** Frames right after a cut, while the new background is still being learnt. */
const SEGMENT_WARMUP = 4;
/** A segment shorter than this can't carry a rally measurement. */
const MIN_SEGMENT_SECONDS = 1.2;
/** Median largest-blob area above this = close-up / replay, not a court view. */
const CLOSEUP_CELL_FRACTION = 0.13;
/** Median frame-to-frame change above this = pan, wipe or shaky replay. */
const UNSTABLE_MEAN_DIFF = 17;
/** Blob samples a segment needs before its court fit is trusted. */
const MIN_COURT_SAMPLES = 25;


export type ScanStage = "load" | "scan" | "track" | "frames" | "done";
export type ScanProgress = { ratio: number; label: string; stage: ScanStage; elapsedSec: number };

/** Lighting-tolerant colour signature: chroma ratios + relative luminance. */
export type ColourSig = { r: number; g: number; b: number; l: number };

/** One player the probe found in a candidate frame, for the tap UI. */
export type IdentityChoice = {
  /** normalised centre + box in the displayed frame */
  x: number;
  y: number;
  w: number;
  h: number;
  sig: ColourSig;
  /** css colour of that player's kit, for the swatch */
  swatch: string;
};

export type IdentityCandidate = {
  t: number;
  /** jpeg data URL of the full frame */
  image: string;
  players: IdentityChoice[];
};

/** What the user picked on the identify screen. */
export type IdentityPick = { sig: ColourSig; otherSig?: ColourSig; atSec: number };

type Blob = {
  x: number;
  y: number;
  mass: number;
  cells: number;
  w: number;
  h: number;
  sig: ColourSig;
};
type Frame = {
  t: number;
  motion: number;
  blobs: Blob[];
  /** which camera segment this checkpoint belongs to */
  seg: number;
  /** mean per-cell luminance change against the previous checkpoint */
  gdiff: number;
  /** area of the biggest blob, as a fraction of the picture */
  maxCellFrac: number;
  /** false for cut frames and the warm-up right after a cut */
  settled: boolean;
};
type Pos = { x: number; y: number } | null;

export type SegmentLabel = "playable" | "close-up" | "unstable" | "no-play" | "too-short";

export type SegmentInfo = {
  index: number;
  startT: number;
  endT: number;
  seconds: number;
  from: number;
  to: number;
  label: SegmentLabel;
  /** court box fitted from this segment's own play */
  courtOk: boolean;
  /** "you" resolved against the tapped kit colour inside this segment */
  identityResolved: boolean;
};


export class ScanAborted extends Error {
  constructor() {
    super("Scan cancelled.");
    this.name = "ScanAborted";
  }
}

function sigOf(r: number, g: number, b: number): ColourSig {
  const sum = Math.max(1, r + g + b);
  return { r: r / sum, g: g / sum, b: b / sum, l: Math.min(1, sum / 765) };
}

/** 0 = same kit colour, ~1 = completely different. */
function sigDist(a: ColourSig, b: ColourSig): number {
  const chroma = Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b) * 2.4;
  const lum = Math.abs(a.l - b.l) * 0.55;
  return chroma + lum;
}

function blendSig(a: ColourSig, b: ColourSig, k: number): ColourSig {
  return {
    r: a.r * (1 - k) + b.r * k,
    g: a.g * (1 - k) + b.g * k,
    b: a.b * (1 - k) + b.b * k,
    l: a.l * (1 - k) + b.l * k,
  };
}

export function sigToCss(s: ColourSig): string {
  const scale = 255 * Math.max(0.35, Math.min(1, s.l * 2.4));
  const peak = Math.max(s.r, s.g, s.b) || 1;
  return `rgb(${Math.round((s.r / peak) * scale)}, ${Math.round((s.g / peak) * scale)}, ${Math.round((s.b / peak) * scale)})`;
}

/**
 * Read the kit colour straight from a candidate frame at a tapped point.
 * Nothing about this depends on the motion detector, so a tap is always right.
 * A median over the patch keeps a stray highlight from skewing the signature.
 */
const patchCache = new Map<string, { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }>();

async function frameCanvas(image: string) {
  const hit = patchCache.get(image);
  if (hit) return hit;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not read the frame."));
    el.src = image;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.drawImage(img, 0, 0);
  const entry = { canvas, ctx };
  if (patchCache.size > 6) patchCache.clear();
  patchCache.set(image, entry);
  return entry;
}

/** x/y are normalised (0-1) coordinates inside the displayed frame. */
export async function sampleSigAt(image: string, x: number, y: number): Promise<ColourSig> {
  const { canvas, ctx } = await frameCanvas(image);
  const size = Math.max(6, Math.round(canvas.width * 0.04));
  const px = Math.round(Math.min(canvas.width - 1, Math.max(0, x * canvas.width)));
  const py = Math.round(Math.min(canvas.height - 1, Math.max(0, y * canvas.height)));
  const sx = Math.max(0, Math.min(canvas.width - size, px - Math.round(size / 2)));
  const sy = Math.max(0, Math.min(canvas.height - size, py - Math.round(size / 2)));
  const data = ctx.getImageData(sx, sy, Math.min(size, canvas.width), Math.min(size, canvas.height)).data;
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    rs.push(data[i]!);
    gs.push(data[i + 1]!);
    bs.push(data[i + 2]!);
  }
  const med = (list: number[]) => {
    list.sort((a, b) => a - b);
    return list[Math.floor(list.length / 2)] ?? 0;
  };
  return sigOf(med(rs), med(gs), med(bs));
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

/**
 * 4-neighbour connected components over the foreground mask. `px` is the RGBA
 * data of the same downscaled frame, so every blob also carries the kit-colour
 * signature of the pixels that make it up — that is what keeps "you" as you
 * when the two players cross.
 */
function extractBlobs(mask: Uint8Array, weight: Uint8ClampedArray, px: Uint8ClampedArray): Blob[] {
  const seen = new Uint8Array(GRID * GRID);
  const stack: number[] = [];
  const blobs: Blob[] = [];
  const limit = GRID * GRID * MAX_BLOB_FRACTION;

  for (let start = 0; start < GRID * GRID; start++) {
    if (!mask[start] || seen[start]) continue;
    stack.length = 0;
    stack.push(start);
    seen[start] = 1;
    let cells = 0;
    let mass = 0;
    let sx = 0;
    let sy = 0;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let minX = GRID, maxX = 0, minY = GRID, maxY = 0;

    while (stack.length) {
      const idx = stack.pop()!;
      const gx = idx % GRID;
      const gy = (idx - gx) / GRID;
      const w = weight[idx]! || 1;
      cells += 1;
      mass += w;
      sx += gx * w;
      sy += gy * w;
      sr += px[idx * 4]! * w;
      sg += px[idx * 4 + 1]! * w;
      sb += px[idx * 4 + 2]! * w;
      if (gx < minX) minX = gx;
      if (gx > maxX) maxX = gx;
      if (gy < minY) minY = gy;
      if (gy > maxY) maxY = gy;

      if (gx > 0 && mask[idx - 1] && !seen[idx - 1]) { seen[idx - 1] = 1; stack.push(idx - 1); }
      if (gx < GRID - 1 && mask[idx + 1] && !seen[idx + 1]) { seen[idx + 1] = 1; stack.push(idx + 1); }
      if (gy > 0 && mask[idx - GRID] && !seen[idx - GRID]) { seen[idx - GRID] = 1; stack.push(idx - GRID); }
      if (gy < GRID - 1 && mask[idx + GRID] && !seen[idx + GRID]) { seen[idx + GRID] = 1; stack.push(idx + GRID); }
    }

    if (cells < MIN_BLOB_CELLS || cells > limit || mass <= 0) continue;
    const w = (maxX - minX + 1) / GRID;
    const h = (maxY - minY + 1) / GRID;
    blobs.push({
      x: (sx / mass + 0.5) / GRID,
      y: (sy / mass + 0.5) / GRID,
      mass,
      cells,
      w,
      h,
      sig: sigOf(sr / mass, sg / mass, sb / mass),
    });
  }


  // Body-like: reasonably tall and compact. Score by mass with a shape bonus.
  const score = (b: Blob) => {
    const aspect = b.h / Math.max(0.02, b.w);
    const shape = aspect >= 0.8 && aspect <= 4 ? 1.35 : aspect >= 0.5 ? 1 : 0.7;
    const fill = b.cells / Math.max(1, (b.w * GRID) * (b.h * GRID));
    const solid = fill > 0.25 ? 1.15 : 1;
    return b.mass * shape * solid;
  };
  blobs.sort((a, b) => score(b) - score(a));

  // Keep the two strongest blobs that are actually apart from each other.
  const kept: Blob[] = [];
  for (const b of blobs) {
    if (kept.length >= 2) break;
    if (kept.some((k) => Math.hypot(k.x - b.x, k.y - b.y) < 0.12)) continue;
    kept.push(b);
  }
  return kept;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return p;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[i]!;
}

function mean(list: number[]): number {
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;
}

/**
 * Fast pre-pass (a few seconds) whose only job is to find a frame where both
 * players are clearly visible and well apart, so the user can tap themselves.
 * No metrics come out of this — it never guesses who is who.
 */
export async function probeForIdentity(
  file: File,
  onProgress?: (p: ScanProgress) => void,
  signal?: AbortSignal,
): Promise<IdentityCandidate[]> {
  const started = Date.now();
  const elapsed = () => Number(((Date.now() - started) / 1000).toFixed(1));
  const url = URL.createObjectURL(file);

  try {
    onProgress?.({ ratio: 0.05, label: "Looking for a frame with both players…", stage: "load", elapsedSec: elapsed() });
    const video = await loadVideo(url);
    const duration = video.duration;

    const SAMPLES = 22;
    const times: number[] = [];
    for (let k = 0; k < SAMPLES; k++) {
      const t = 0.08 + (duration - 0.3) * ((k + 0.5) / SAMPLES);
      if (t > 0 && t < duration) times.push(t);
    }

    const small = document.createElement("canvas");
    small.width = GRID;
    small.height = GRID;
    const sctx = small.getContext("2d", { willReadFrequently: true });
    const big = document.createElement("canvas");
    const bctx = big.getContext("2d");
    if (!sctx || !bctx) throw new Error("Canvas is unavailable in this browser.");

    const targetW = 760;
    const scale = video.videoWidth ? Math.min(1, targetW / video.videoWidth) : 1;
    big.width = Math.max(240, Math.round((video.videoWidth || targetW) * scale));
    big.height = Math.max(135, Math.round((video.videoHeight || 428) * scale));

    // First pass: learn a background from the samples themselves so a player
    // standing still is still foreground.
    const grays: Uint8ClampedArray[] = [];
    const colours: Uint8ClampedArray[] = [];
    for (const t of times) {
      if (signal?.aborted) throw new ScanAborted();
      await seek(video, t);
      sctx.drawImage(video, 0, 0, GRID, GRID);
      const px = sctx.getImageData(0, 0, GRID, GRID).data;
      const gray = new Uint8ClampedArray(GRID * GRID);
      for (let p = 0; p < GRID * GRID; p++) {
        gray[p] = (px[p * 4]! * 0.299 + px[p * 4 + 1]! * 0.587 + px[p * 4 + 2]! * 0.114) | 0;
      }
      grays.push(gray);
      colours.push(new Uint8ClampedArray(px));
    }
    if (!grays.length) throw new Error("Could not read any frame from this video.");

    // Per-pixel median across samples = empty court.
    const bg = new Uint8ClampedArray(GRID * GRID);
    const column: number[] = [];
    for (let p = 0; p < GRID * GRID; p++) {
      column.length = 0;
      for (const g of grays) column.push(g[p]!);
      column.sort((a, b) => a - b);
      bg[p] = column[Math.floor(column.length / 2)]!;
    }

    const mask = new Uint8Array(GRID * GRID);
    const weight = new Uint8ClampedArray(GRID * GRID);
    type Scored = { t: number; index: number; blobs: Blob[]; score: number };
    const scored: Scored[] = [];

    for (let i = 0; i < grays.length; i++) {
      const gray = grays[i]!;
      let fg = 0;
      for (let p = 0; p < GRID * GRID; p++) {
        const d = Math.abs(gray[p]! - bg[p]!);
        const on = d > DIFF_THRESHOLD + 2;
        mask[p] = on ? 1 : 0;
        weight[p] = on ? Math.min(255, d) : 0;
        if (on) fg += 1;
      }
      if (fg > GRID * GRID * 0.5) continue;
      // Body-shaped only: drop wide banners / score bars and anything sitting in
      // the crowd band above the court or the graphics strip at the very bottom.
      const blobs = extractBlobs(mask, weight, colours[i]!).filter(
        (b) => b.h / Math.max(0.02, b.w) >= 0.5 && b.y > 0.12 && b.y < 0.95,
      );
      if (blobs.length < 2) continue;
      const [a, b] = [blobs[0]!, blobs[1]!];
      const apart = Math.hypot(a.x - b.x, a.y - b.y);
      const colourGap = sigDist(a.sig, b.sig);
      if (apart < 0.18) continue;
      scored.push({ t: times[i]!, index: i, blobs, score: apart * 2 + colourGap + Math.min(1, (a.mass + b.mass) / 8000) });
    }

    scored.sort((x, y) => y.score - x.score);
    const chosen = scored.slice(0, 3);
    const candidates: IdentityCandidate[] = [];
    for (const s of chosen) {
      if (signal?.aborted) throw new ScanAborted();
      await seek(video, s.t);
      bctx.drawImage(video, 0, 0, big.width, big.height);
      candidates.push({
        t: Number(s.t.toFixed(2)),
        image: big.toDataURL("image/jpeg", 0.72),
        players: s.blobs.slice(0, 2).map((b) => ({
          x: Number(b.x.toFixed(4)),
          y: Number(b.y.toFixed(4)),
          w: Number(b.w.toFixed(4)),
          h: Number(b.h.toFixed(4)),
          sig: b.sig,
          swatch: sigToCss(b.sig),
        })),
      });
    }

    // Even with no confident detection the user can still tap themselves, so
    // always hand back some frames to tap on.
    if (!candidates.length) {
      const fallbackTimes = times.filter((_, i) => i % Math.max(1, Math.floor(times.length / 3)) === 0).slice(0, 3);
      for (const t of fallbackTimes) {
        if (signal?.aborted) throw new ScanAborted();
        await seek(video, t);
        bctx.drawImage(video, 0, 0, big.width, big.height);
        candidates.push({ t: Number(t.toFixed(2)), image: big.toDataURL("image/jpeg", 0.72), players: [] });
      }
    }


    onProgress?.({ ratio: 1, label: "Ready to identify players", stage: "done", elapsedSec: elapsed() });
    return candidates;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type ScanResult = {
  payload: ClipInput;
  measured: MeasuredStats;
  /** Every camera shot the clip was split into, and why each was used or not. */
  segments: SegmentInfo[];
};


export async function scanSquashVideo(
  file: File,
  onProgress: (p: ScanProgress) => void,
  signal?: AbortSignal,
  identity?: IdentityPick,
): Promise<ScanResult> {

  const started = Date.now();
  const elapsed = () => Number(((Date.now() - started) / 1000).toFixed(1));
  const abortIfNeeded = () => {
    if (signal?.aborted) throw new ScanAborted();
  };
  const url = URL.createObjectURL(file);

  try {
    onProgress({ ratio: 0.01, label: "Loading video…", stage: "load", elapsedSec: elapsed() });
    const video = await loadVideo(url);
    const duration = video.duration;

    const step = Math.max(1 / TARGET_FPS, duration / MAX_CHECKPOINTS);
    const times: number[] = [];
    for (let t = 0.05; t < duration - 0.03 && times.length < MAX_CHECKPOINTS; t += step) times.push(t);
    if (!times.length) times.push(0);

    const small = document.createElement("canvas");
    small.width = GRID;
    small.height = GRID;
    const sctx = small.getContext("2d", { willReadFrequently: true });
    const big = document.createElement("canvas");
    const bctx = big.getContext("2d");
    if (!sctx || !bctx) throw new Error("Canvas is unavailable in this browser.");

    // ---- pass 1: camera cuts + per-segment background model ---------------
    // A broadcast edit is not one camera. Every cut restarts the background
    // model, so a shot change can never masquerade as court motion.
    const frames: Frame[] = [];
    const bg = new Float32Array(GRID * GRID);
    let prev: Uint8ClampedArray | null = null;
    const mask = new Uint8Array(GRID * GRID);
    const weight = new Uint8ClampedArray(GRID * GRID);

    // Score bar / broadcast graphics strip: never counted as movement.
    const ignore = new Uint8Array(GRID * GRID);
    let liveCells = 0;
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const nx = (gx + 0.5) / GRID;
        const ny = (gy + 0.5) / GRID;
        const off = ny > 0.86 && nx > 0.18 && nx < 0.82;
        ignore[gy * GRID + gx] = off ? 1 : 0;
        if (!off) liveCells += 1;
      }
    }

    let segIndex = 0;
    let sinceCut = 0;
    let cutCount = 0;

    for (let i = 0; i < times.length; i++) {
      abortIfNeeded();
      await seek(video, times[i]!);
      sctx.drawImage(video, 0, 0, GRID, GRID);
      const px = sctx.getImageData(0, 0, GRID, GRID).data;
      const gray = new Uint8ClampedArray(GRID * GRID);
      for (let p = 0; p < GRID * GRID; p++) {
        gray[p] = (px[p * 4]! * 0.299 + px[p * 4 + 1]! * 0.587 + px[p * 4 + 2]! * 0.114) | 0;
      }

      // --- cut detection against the previous checkpoint -------------------
      let gdiff = 0;
      let changedCells = 0;
      if (prev) {
        for (let p = 0; p < GRID * GRID; p++) {
          if (ignore[p]) continue;
          const d = Math.abs(gray[p]! - prev[p]!);
          gdiff += d;
          if (d > 30) changedCells += 1;
        }
        gdiff /= Math.max(1, liveCells);
      }
      const changedFrac = prev ? changedCells / Math.max(1, liveCells) : 0;
      const cut =
        !!prev &&
        (gdiff > CUT_MEAN_DIFF || (changedFrac > CUT_FRACTION && gdiff > CUT_FRACTION_DIFF));
      if (cut) {
        segIndex += 1;
        sinceCut = 0;
        cutCount += 1;
      }

      const warm = sinceCut < SEGMENT_WARMUP;
      const settled = !!prev && !cut && !warm;

      let motion = 0;
      let blobs: Blob[] = [];
      let maxCellFrac = 0;

      if (settled && prev) {
        let motionTotal = 0;
        let fgCells = 0;
        for (let p = 0; p < GRID * GRID; p++) {
          if (ignore[p]) { mask[p] = 0; weight[p] = 0; continue; }
          const g = gray[p]!;
          const dFrame = Math.abs(g - prev[p]!);
          const dBg = Math.abs(g - bg[p]!);
          const fg = dBg > DIFF_THRESHOLD + 4 && (dFrame > 6 || dBg > DIFF_THRESHOLD + 14);
          mask[p] = fg ? 1 : 0;
          weight[p] = fg ? Math.min(255, dBg) : 0;
          if (fg) fgCells += 1;
          if (dFrame > DIFF_THRESHOLD) motionTotal += dFrame;
        }
        const readable = fgCells < liveCells * 0.5;
        motion = Math.max(0, Math.min(100, Math.round((motionTotal / (liveCells * 26)) * 100)));
        blobs = readable ? extractBlobs(mask, weight, px) : [];
        maxCellFrac = blobs.length
          ? Math.max(...blobs.map((b) => b.cells)) / Math.max(1, liveCells)
          : fgCells / Math.max(1, liveCells);
      }

      frames.push({ t: times[i]!, motion, blobs, seg: segIndex, gdiff, maxCellFrac, settled });

      // Background: hard reset at a cut, learn fast through the warm-up, then
      // slow enough that a player standing still stays foreground.
      if (!prev || cut) {
        for (let p = 0; p < GRID * GRID; p++) bg[p] = gray[p]!;
      } else {
        const k = warm ? 0.45 : 0.035;
        for (let p = 0; p < GRID * GRID; p++) bg[p] = bg[p]! * (1 - k) + gray[p]! * k;
      }
      prev = gray;
      sinceCut += 1;

      if (i % 8 === 0) {
        onProgress({
          ratio: 0.02 + 0.6 * (i / times.length),
          label: `Scanning court motion ${Math.round((i / times.length) * 100)}% · ${Math.round(times[i]!)}s of ${Math.round(duration)}s · ${cutCount} camera cut${cutCount === 1 ? "" : "s"}`,
          stage: "scan",
          elapsedSec: elapsed(),
        });
        // Let the UI paint between chunks.
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    abortIfNeeded();
    onProgress({ ratio: 0.62, label: "Splitting the clip into camera shots…", stage: "track", elapsedSec: elapsed() });

    // ---- segment triage ----------------------------------------------------
    const segments: SegmentInfo[] = [];
    const segCount = frames.length ? frames[frames.length - 1]!.seg + 1 : 0;
    for (let s = 0; s < segCount; s++) {
      let from = -1;
      let to = -1;
      for (let i = 0; i < frames.length; i++) {
        if (frames[i]!.seg !== s) continue;
        if (from < 0) from = i;
        to = i;
      }
      if (from < 0) continue;
      const own = frames.slice(from, to + 1);
      const settledFrames = own.filter((f) => f.settled);
      const seconds = own.length * step;
      const fracs = settledFrames.map((f) => f.maxCellFrac).sort((a, b) => a - b);
      const diffs = settledFrames.map((f) => f.gdiff).sort((a, b) => a - b);
      const withOne = settledFrames.filter((f) => f.blobs.length >= 1).length;
      const withTwo = settledFrames.filter((f) => f.blobs.length >= 2).length;

      let label: SegmentLabel = "playable";
      if (seconds < MIN_SEGMENT_SECONDS || settledFrames.length < 3) label = "too-short";
      else if (percentile(fracs, 0.5) > CLOSEUP_CELL_FRACTION) label = "close-up";
      else if (percentile(diffs, 0.5) > UNSTABLE_MEAN_DIFF) label = "unstable";
      else if (withOne < settledFrames.length * 0.4 || withTwo < settledFrames.length * 0.15) label = "no-play";

      segments.push({
        index: s,
        startT: Number(frames[from]!.t.toFixed(2)),
        endT: Number(frames[to]!.t.toFixed(2)),
        seconds: Number(seconds.toFixed(1)),
        from,
        to,
        label,
        courtOk: false,
        identityResolved: false,
      });
    }

    const playable = segments.filter((s) => s.label === "playable");

    // Colour reference for the whole clip: lets a kit signature be corrected
    // for the white balance of each camera before it is matched.
    const meanSig = (list: ColourSig[]): ColourSig | null => {
      if (!list.length) return null;
      const n = list.length;
      return {
        r: list.reduce((a, s) => a + s.r, 0) / n,
        g: list.reduce((a, s) => a + s.g, 0) / n,
        b: list.reduce((a, s) => a + s.b, 0) / n,
        l: list.reduce((a, s) => a + s.l, 0) / n,
      };
    };
    const allSigs: ColourSig[] = [];
    for (const s of playable) for (let i = s.from; i <= s.to; i++) for (const b of frames[i]!.blobs) allSigs.push(b.sig);
    const refMean = meanSig(allSigs);

    /** Re-balance a kit signature from one camera's colour cast to another's. */
    const wbShift = (sig: ColourSig, from: ColourSig | null, to: ColourSig | null): ColourSig => {
      if (!from || !to) return sig;
      const r = Math.max(0, sig.r - from.r + to.r);
      const g = Math.max(0, sig.g - from.g + to.g);
      const b = Math.max(0, sig.b - from.b + to.b);
      const sum = Math.max(1e-4, r + g + b);
      return { r: r / sum, g: g / sum, b: b / sum, l: Math.max(0, Math.min(1, sig.l - from.l + to.l)) };
    };

    // ---- per-segment court fit + identity tracking ------------------------
    onProgress({
      ratio: 0.66,
      label: `Fitting the court in ${playable.length} usable shot${playable.length === 1 ? "" : "s"}…`,
      stage: "track",
      elapsedSec: elapsed(),
    });

    type Track = {
      pos: { x: number; y: number };
      vel: { x: number; y: number };
      miss: number;
      sig: ColourSig;
    };

    const playerPos: Pos[] = new Array(frames.length).fill(null);
    const opponentPos: Pos[] = new Array(frames.length).fill(null);
    const playerMass: number[] = new Array(frames.length).fill(0);
    const opponentMass: number[] = new Array(frames.length).fill(0);
    const usable: boolean[] = new Array(frames.length).fill(false);
    let twoBlobFrames = 0;
    let activeFrames = 0;
    let identityFrames = 0;
    let identityConfidentFrames = 0;

    const predict = (tr: Track | null): Pos => (tr ? { x: tr.pos.x + tr.vel.x, y: tr.pos.y + tr.vel.y } : null);
    const gap = (p: Pos, b: Blob) => (p ? Math.hypot(p.x - b.x, p.y - b.y) : 1.5);
    const update = (tr: Track | null, b: Blob): Track => {
      if (!tr) return { pos: { x: b.x, y: b.y }, vel: { x: 0, y: 0 }, miss: 0, sig: b.sig };
      return {
        pos: { x: b.x, y: b.y },
        vel: { x: (b.x - tr.pos.x) * 0.6 + tr.vel.x * 0.4, y: (b.y - tr.pos.y) * 0.6 + tr.vel.y * 0.4 },
        miss: 0,
        sig: blendSig(tr.sig, b.sig, 0.12),
      };
    };
    const colourCost = (ref: ColourSig | null, b: Blob) => (ref ? sigDist(ref, b.sig) : 0);

    for (const s of playable) {
      // Court box from this camera's own play, so every position is stored in
      // one shared court space no matter how the shot was framed.
      const xs: number[] = [];
      const ys: number[] = [];
      const segSigs: ColourSig[] = [];
      for (let i = s.from; i <= s.to; i++) {
        for (const b of frames[i]!.blobs) { xs.push(b.x); ys.push(b.y); segSigs.push(b.sig); }
      }
      xs.sort((a, b) => a - b);
      ys.sort((a, b) => a - b);
      s.courtOk = xs.length >= MIN_COURT_SAMPLES;
      const x0 = s.courtOk ? percentile(xs, 0.04) : 0;
      const x1 = s.courtOk ? percentile(xs, 0.96) : 1;
      const y0 = s.courtOk ? percentile(ys, 0.04) : 0;
      const y1 = s.courtOk ? percentile(ys, 0.96) : 1;
      const spanX = Math.max(0.15, x1 - x0);
      const spanY = Math.max(0.15, y1 - y0);
      const courtX = (x: number) => Math.max(0, Math.min(1, (x - x0) / spanX));
      const courtY = (y: number) => Math.max(0, Math.min(1, (y - y0) / spanY));

      // Kit signatures corrected for this camera's colour cast.
      const segMean = meanSig(segSigs);
      const seedSelf = identity ? wbShift(identity.sig, refMean, segMean) : null;
      let seedOther = identity?.otherSig ? wbShift(identity.otherSig, refMean, segMean) : null;

      let A: Track | null = null;
      let B: Track | null = null;
      const localA: Pos[] = [];
      const localB: Pos[] = [];
      const localMassA: number[] = [];
      const localMassB: number[] = [];
      const localIndex: number[] = [];
      let acquired = false;

      const refSig = (tr: Track | null, seed: ColourSig | null): ColourSig | null =>
        seed ? (tr ? blendSig(seed, tr.sig, 0.35) : seed) : tr ? tr.sig : null;

      for (let i = s.from; i <= s.to; i++) {
        const f = frames[i]!;
        if (!f.settled) continue;
        usable[i] = true;
        if (f.motion > 0) activeFrames += 1;
        localIndex.push(i);

        const blobs = f.blobs;
        let pickA: Blob | null = null;
        let pickB: Blob | null = null;
        const pa = predict(A);
        const pb = predict(B);
        const ra = refSig(A, seedSelf);
        const rb = refSig(B, seedOther);

        if (blobs.length >= 2) {
          twoBlobFrames += 1;
          const [b1, b2] = [blobs[0]!, blobs[1]!];
          if (!A || !B) {
            if (seedSelf) {
              // Re-acquire "you" inside every shot: the tracker never has to
              // survive a cut, it just picks you up again on the far side.
              const d1 = sigDist(seedSelf, b1.sig);
              const d2 = sigDist(seedSelf, b2.sig);
              if (d1 <= d2) { pickA = b1; pickB = b2; } else { pickA = b2; pickB = b1; }
              if (Math.abs(d1 - d2) > 0.045) acquired = true;
              if (!seedOther) seedOther = pickB.sig;
            } else {
              // No tap: the camera sits behind the court, so lower = nearer.
              if (b1.y >= b2.y) { pickA = b1; pickB = b2; } else { pickA = b2; pickB = b1; }
            }
          } else {
            const straight = gap(pa, b1) + gap(pb, b2) + (colourCost(ra, b1) + colourCost(rb, b2)) * COLOUR_WEIGHT;
            const swapped = gap(pa, b2) + gap(pb, b1) + (colourCost(ra, b2) + colourCost(rb, b1)) * COLOUR_WEIGHT;
            if (straight <= swapped) { pickA = b1; pickB = b2; } else { pickA = b2; pickB = b1; }
            if (identity) {
              identityFrames += 1;
              if (Math.abs(straight - swapped) > 0.06) identityConfidentFrames += 1;
            }
          }
        } else if (blobs.length === 1) {
          const b = blobs[0]!;
          const da = gap(pa, b) + colourCost(ra, b) * COLOUR_WEIGHT;
          const db = gap(pb, b) + colourCost(rb, b) * COLOUR_WEIGHT;
          if (da <= db && da < 0.35) pickA = b;
          else if (db < da && db < 0.35) pickB = b;
          else if (!A) pickA = b;
          else if (!B) pickB = b;
          else if (da <= db) pickA = b;
          else pickB = b;
        }

        if (pickA) A = update(A, pickA);
        else if (A !== null) A.miss += 1;
        if (pickB) B = update(B, pickB);
        else if (B !== null) B.miss += 1;
        if (A && A.miss > 12) A = null;
        if (B && B.miss > 12) B = null;

        localA.push(pickA ? { x: pickA.x, y: pickA.y } : null);
        localB.push(pickB ? { x: pickB.x, y: pickB.y } : null);
        localMassA.push(pickA?.mass ?? 0);
        localMassB.push(pickB?.mass ?? 0);
      }

      // Which local track is "you" in this shot.
      let flip = false;
      if (!identity) {
        const depthA = mean(localA.filter(Boolean).map((p) => p!.y));
        const depthB = mean(localB.filter(Boolean).map((p) => p!.y));
        flip = depthB > depthA + 0.02;
      }
      s.identityResolved = identity ? acquired : true;

      const mePos = flip ? localB : localA;
      const themPos = flip ? localA : localB;
      const meMass = flip ? localMassB : localMassA;
      const themMass = flip ? localMassA : localMassB;

      // A shot whose court could not be fitted, or where "you" was never
      // recognised, still counts for work/rest — but it contributes no
      // positions, so it can never corrupt heat maps or T discipline.
      if (!s.courtOk || !s.identityResolved) continue;

      for (let k = 0; k < localIndex.length; k++) {
        const i = localIndex[k]!;
        const me = mePos[k] ?? null;
        const them = themPos[k] ?? null;
        playerPos[i] = me ? { x: courtX(me.x), y: courtY(me.y) } : null;
        opponentPos[i] = them ? { x: courtX(them.x), y: courtY(them.y) } : null;
        playerMass[i] = meMass[k] ?? 0;
        opponentMass[i] = themMass[k] ?? 0;
      }
    }

    const identitySource: MeasuredStats["identitySource"] = identity ? "tapped" : "auto";
    const identityConfidencePercent = identity
      ? identityFrames
        ? Number(((identityConfidentFrames / identityFrames) * 100).toFixed(1))
        : 0
      : 0;

    // ---- coverage ----------------------------------------------------------
    const secondsWhere = (label: SegmentLabel) =>
      segments.filter((s) => s.label === label).reduce((a, s) => a + s.seconds, 0);
    const usableFrameCount = usable.filter(Boolean).length;
    const usableSeconds = usableFrameCount * step;
    const measurableSeconds = playable
      .filter((s) => s.courtOk && s.identityResolved)
      .reduce((a, s) => a + s.seconds, 0);

    // ---- anchor the court grid on the real T ------------------------------
    const occX: number[] = [];
    const occY: number[] = [];
    for (const p of [...playerPos, ...opponentPos]) {
      if (!p) continue;
      occX.push(p.x);
      occY.push(p.y);
    }
    occX.sort((a, b) => a - b);
    occY.sort((a, b) => a - b);
    const tcx = occX.length > 40 ? percentile(occX, 0.5) : 0.5;
    const tcy = occY.length > 40 ? percentile(occY, 0.5) : 0.5;
    const LANE = 0.15;
    const BAND = 0.17;
    const zoneOf = (p: { x: number; y: number }) => {
      const depth = p.y < tcy - BAND ? "front" : p.y <= tcy + BAND ? "mid" : "back";
      const lane = p.x < tcx - LANE ? "forehand" : p.x <= tcx + LANE ? "centre" : "backhand";
      return `${depth}-${lane}`;
    };
    const inT = (p: Pos) => !!p && zoneOf(p) === "mid-centre";

    /** Two checkpoints only relate to each other inside the same camera shot. */
    const linked = (i: number, j: number) =>
      !!frames[i] && !!frames[j] && frames[i]!.seg === frames[j]!.seg && !!usable[i] && !!usable[j];

    // ---- rallies -----------------------------------------------------------
    const motions = frames.map((f, i) => (usable[i] ? f.motion : 0));
    const usableMotions = frames.filter((_, i) => usable[i]).map((f) => f.motion);
    const sortedMotion = [...usableMotions].sort((a, b) => a - b);
    const averageMotion = mean(usableMotions);
    const peakMotion = usableMotions.length ? Math.max(...usableMotions) : 0;
    const quietLevel = percentile(sortedMotion, 0.3);
    const activeFloor = Math.max(4, quietLevel + Math.max(3, (peakMotion - quietLevel) * 0.16));

    const active = frames.map((f, i) => !!usable[i] && f.motion >= activeFloor);
    const activeSeconds = active.filter(Boolean).length * step;
    // Rest is measured inside the footage we could actually read — not against
    // the whole broadcast, which includes replays and crowd shots.
    const restSeconds = Math.max(0.1, usableSeconds - activeSeconds);


    // ---- contacts: per-player strike signal -------------------------------
    const speed = (list: Pos[], i: number) => {
      if (!linked(i - 1, i)) return 0;
      const a = list[i - 1];
      const b = list[i];
      return a && b ? Math.hypot(b.x - a.x, b.y - a.y) / step : 0;
    };
    const reversal = (list: Pos[], i: number) => {
      if (!linked(i - 2, i) || !linked(i, i + 1)) return 0;
      const p0 = list[i - 2];
      const p1 = list[i - 1];
      const p2 = list[i];
      const p3 = list[i + 1];
      if (!p0 || !p1 || !p2 || !p3) return 0;

      const v1 = { x: p1.x - p0.x, y: p1.y - p0.y };
      const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
      const n1 = Math.hypot(v1.x, v1.y);
      const n2 = Math.hypot(v2.x, v2.y);
      if (n1 < 1e-4 || n2 < 1e-4) return 0;
      const cos = (v1.x * v2.x + v1.y * v2.y) / (n1 * n2);
      return Math.max(0, -cos); // 1 = full direction reversal
    };

    const massFloor = (list: number[]) => {
      const nz = list.filter((v) => v > 0).sort((a, b) => a - b);
      return nz.length ? percentile(nz, 0.62) : Number.POSITIVE_INFINITY;
    };
    const playerFloor = massFloor(playerMass);
    const opponentFloor = massFloor(opponentMass);

    type RawContact = { i: number; t: number; actor: "player" | "opponent"; score: number; motion: number };
    const raw: RawContact[] = [];
    const strikeSignal = (
      m: number[],
      pos: Pos[],
      floor: number,
      i: number,
    ): number => {
      const v = m[i] ?? 0;
      if (!Number.isFinite(floor) || v < floor) return 0;
      const prevV = m[i - 1] ?? 0;
      const nextV = m[i + 1] ?? 0;
      if (v < prevV || v < nextV) return 0; // must be a local peak of own motion
      const rev = reversal(pos, i);
      const decel = Math.max(0, speed(pos, i - 1) - speed(pos, i + 1));
      return v / floor + rev * 1.4 + Math.min(1.2, decel * 2.2);
    };

    for (let i = 2; i < frames.length - 2; i++) {
      // A contact is only claimed where the shot is readable and its
      // neighbours belong to the same camera take.
      if (!active[i] || !linked(i - 1, i) || !linked(i, i + 1)) continue;

      const ps = strikeSignal(playerMass, playerPos, playerFloor, i);
      const os = strikeSignal(opponentMass, opponentPos, opponentFloor, i);
      if (ps >= 1.35 && ps >= os) raw.push({ i, t: frames[i]!.t, actor: "player", score: ps, motion: frames[i]!.motion });
      else if (os >= 1.35) raw.push({ i, t: frames[i]!.t, actor: "opponent", score: os, motion: frames[i]!.motion });
    }

    // Suppress duplicates: a real squash contact rate is < ~2/s per player,
    // and consecutive contacts should alternate players.
    const MIN_GAP = 0.55;
    const contactsRaw: RawContact[] = [];
    for (const c of raw.sort((a, b) => a.t - b.t)) {
      const last = contactsRaw[contactsRaw.length - 1];
      if (!last) { contactsRaw.push(c); continue; }
      const dt = c.t - last.t;
      if (dt < MIN_GAP) {
        if (c.score > last.score) contactsRaw[contactsRaw.length - 1] = c;
        continue;
      }
      if (c.actor === last.actor && dt < 1.1 && c.score < last.score) continue;
      contactsRaw.push(c);
    }

    const contacts: NonNullable<ClipInput["contacts"]> = [];
    const playerHist = new Array(9).fill(0);
    const opponentHist = new Array(9).fill(0);
    const tReturnEvents: NonNullable<ClipInput["tReturnEvents"]> = [];

    const bump = (hist: number[], p: Pos) => {
      if (!p) return;
      const idx = ZONE_KEYS.indexOf(zoneOf(p) as (typeof ZONE_KEYS)[number]);
      if (idx >= 0) hist[idx] += 1;
    };

    for (const c of contactsRaw) {
      const me = playerPos[c.i] ?? null;
      const them = opponentPos[c.i] ?? null;
      const striker = c.actor === "player" ? me : them;
      contacts.push({
        t: Number(c.t.toFixed(2)),
        actor: striker ? c.actor : "unknown",
        zone: striker ? zoneOf(striker) : "mid-centre",
        opponentZone: c.actor === "player" ? (them ? zoneOf(them) : undefined) : me ? zoneOf(me) : undefined,
        motion: c.motion,
      });
      // Heat maps count where each player STRUCK, not where they stood.
      if (c.actor === "player") bump(playerHist, me);
      else bump(opponentHist, them);

      // Recovery to the T after your own strike only, and only while the same
      // camera take is still running.
      if (c.actor === "player") {
        const horizon = Math.min(frames.length, c.i + Math.ceil(8 / step));
        for (let j = c.i + 1; j < horizon; j++) {
          if (!linked(c.i, j)) break;
          if (inT(playerPos[j] ?? null)) {
            tReturnEvents.push({ t: Number(c.t.toFixed(2)), secondsToT: Number(((j - c.i) * step).toFixed(2)) });
            break;
          }
        }
      }

    }

    // ---- rally segmentation with shot counts ------------------------------
    let rallyCount = 0;
    let inRally = false;
    let quiet = 0;
    let rallyStart = 0;
    const rallyShots: number[] = [];
    for (let i = 0; i < frames.length; i++) {
      if (active[i]) {
        if (!inRally) {
          inRally = true;
          rallyCount += 1;
          rallyStart = frames[i]!.t;
        }
        quiet = 0;
      } else {
        quiet += step;
        if (inRally && quiet >= 2) {
          inRally = false;
          const end = frames[i]!.t;
          rallyShots.push(contacts.filter((c) => c.t >= rallyStart && c.t <= end).length);
        }
      }
    }
    if (inRally) {
      const end = frames[frames.length - 1]?.t ?? duration;
      rallyShots.push(contacts.filter((c) => c.t >= rallyStart && c.t <= end).length);
    }
    const scoredRallies = rallyShots.filter((n) => n > 0);

    // ---- T occupancy -------------------------------------------------------
    let tSamples = 0;
    let playerSeen = 0;
    let offTRun = 0;
    let longestOffT = 0;
    for (let i = 0; i < frames.length; i++) {
      const me = playerPos[i] ?? null;
      if (!me) continue;
      playerSeen += 1;
      if (inT(me)) {
        tSamples += 1;
        longestOffT = Math.max(longestOffT, offTRun);
        offTRun = 0;

      } else if (active[i]) {
        offTRun += step;
      }
    }
    longestOffT = Math.max(longestOffT, offTRun);

    const toSeconds = tReturnEvents.map((e) => e.secondsToT).sort((a, b) => a - b);
    const normalise = (h: number[]) => {
      const max = Math.max(...h, 0);
      return max > 0 ? h.map((v) => Math.round((v / max) * 100)) : h.map(() => 0);
    };

    const third = Math.max(1, Math.floor(usableMotions.length / 3));
    const firstThird = mean(usableMotions.slice(0, third));
    const lastThird = mean(usableMotions.slice(-third));
    const fatigueDrift = firstThird > 0 ? ((lastThird - firstThird) / firstThird) * 100 : 0;


    // ---- evidence frames at real detected contacts ------------------------
    onProgress({ ratio: 0.76, label: "Capturing evidence frames at detected contacts…", stage: "frames", elapsedSec: elapsed() });

    const pickContacts = (() => {
      if (contacts.length <= MAX_EVIDENCE) return contacts.slice();
      const out: typeof contacts = [];
      const stride = contacts.length / MAX_EVIDENCE;
      for (let k = 0; k < MAX_EVIDENCE; k++) out.push(contacts[Math.floor(k * stride)]!);
      return out;
    })();

    const targetW = 640;
    const scale = video.videoWidth ? Math.min(1, targetW / video.videoWidth) : 1;
    big.width = Math.max(160, Math.round((video.videoWidth || targetW) * scale));
    big.height = Math.max(90, Math.round((video.videoHeight || 360) * scale));

    const evidence: string[] = [];
    const frameTimes: number[] = [];
    const frameMeta: NonNullable<ClipInput["frameMeta"]> = [];
    for (let i = 0; i < pickContacts.length; i++) {
      abortIfNeeded();
      const c = pickContacts[i]!;
      await seek(video, c.t);
      bctx.drawImage(video, 0, 0, big.width, big.height);
      evidence.push(big.toDataURL("image/jpeg", 0.6));
      frameTimes.push(c.t);
      frameMeta.push({ t: c.t, actor: c.actor, zone: c.zone, opponentZone: c.opponentZone });
      onProgress({
        ratio: 0.76 + 0.16 * ((i + 1) / pickContacts.length),
        label: `Capturing evidence frames ${i + 1}/${pickContacts.length}…`,
        stage: "frames",
        elapsedSec: elapsed(),
      });
    }

    // Fallback for a clip where no contact was detected at all: still send a
    // few high-motion frames from readable shots so the AI leg has something
    // real to look at.
    if (!evidence.length) {
      const busiest = frames
        .filter((_, i) => usable[i])
        .sort((a, b) => b.motion - a.motion)
        .slice(0, 6)
        .sort((a, b) => a.t - b.t);
      for (const f of busiest) {
        abortIfNeeded();
        await seek(video, f.t);
        bctx.drawImage(video, 0, 0, big.width, big.height);
        evidence.push(big.toDataURL("image/jpeg", 0.6));
        frameTimes.push(Number(f.t.toFixed(2)));
        frameMeta.push({ t: Number(f.t.toFixed(2)), actor: "unknown", zone: "mid-centre" });
      }
    }

    const usableIdx = frames.map((_, i) => i).filter((i) => usable[i]);
    const stride = Math.max(1, Math.ceil(usableIdx.length / 500));
    const motionTimeline = usableIdx
      .filter((_, k) => k % stride === 0)
      .map((i) => {
        const f = frames[i]!;
        const me = playerPos[i] ?? null;
        const x = me ? me.x : 0.5;
        const y = me ? me.y : 0.5;
        return {
          t: Number(f.t.toFixed(2)),
          motion: f.motion,
          x: Number(x.toFixed(3)),
          y: Number(y.toFixed(3)),
          zone: zoneOf({ x, y }),
        };
      });

    const measured: MeasuredStats = {
      scannedFrames: Math.max(1, frames.length),
      sampleEverySec: Number(step.toFixed(3)),
      scanSeconds: elapsed(),
      activeSeconds: Number(activeSeconds.toFixed(1)),
      restSeconds: Number(restSeconds.toFixed(1)),
      workRestRatio: Number(Math.min(50, activeSeconds / restSeconds).toFixed(2)),
      rallyCount,
      avgShotsPerRally: scoredRallies.length ? Number(mean(scoredRallies).toFixed(1)) : 0,
      longestRallyShots: scoredRallies.length ? Math.max(...scoredRallies) : 0,
      rallyBuckets: {
        short: scoredRallies.filter((n) => n <= 4).length,
        medium: scoredRallies.filter((n) => n > 4 && n <= 9).length,
        long: scoredRallies.filter((n) => n > 9).length,
      },
      contactCount: contacts.length,
      playerContacts: contacts.filter((c) => c.actor === "player").length,
      opponentContacts: contacts.filter((c) => c.actor === "opponent").length,
      tReturnCount: tReturnEvents.length,
      avgSecondsToT: toSeconds.length ? Number(mean(toSeconds).toFixed(2)) : 0,
      medianSecondsToT: toSeconds.length ? Number(percentile(toSeconds, 0.5).toFixed(2)) : 0,
      tTimePercent: playerSeen ? Number(((tSamples || countT(playerPos, inT)) / playerSeen * 100).toFixed(1)) : 0,
      longestOffTSeconds: Number(Math.min(600, longestOffT).toFixed(1)),
      playerHeatmap: normalise(playerHist),
      opponentHeatmap: normalise(opponentHist),
      playerHeatCounts: playerHist,
      opponentHeatCounts: opponentHist,
      twoPlayerTrackPercent: activeFrames ? Number(((twoBlobFrames / activeFrames) * 100).toFixed(1)) : 0,
      averageMotion: Number(averageMotion.toFixed(1)),
      peakMotion,
      fatigueDriftPercent: Number(Math.max(-100, Math.min(100, fatigueDrift)).toFixed(1)),
      identitySource,
      identityConfidencePercent,
      cameraCuts: cutCount,
      segmentCount: segments.length,
      playableSegments: playable.length,
      usableSeconds: Number(usableSeconds.toFixed(1)),
      measurableSeconds: Number(measurableSeconds.toFixed(1)),
      coveragePercent: Number(Math.min(100, (usableSeconds / Math.max(0.1, duration)) * 100).toFixed(1)),
      rejectedSeconds: {
        closeUp: Number(secondsWhere("close-up").toFixed(1)),
        unstable: Number(secondsWhere("unstable").toFixed(1)),
        noPlay: Number(secondsWhere("no-play").toFixed(1)),
        tooShort: Number(secondsWhere("too-short").toFixed(1)),
      },
    };



    onProgress({ ratio: 0.93, label: "Verifying frames with the AI…", stage: "done", elapsedSec: elapsed() });

    return {
      measured,
      segments,

      payload: {
        videoName: file.name.slice(0, 200) || "match.mp4",
        durationSec: Number(duration.toFixed(2)),
        sampleEverySec: Number(step.toFixed(3)),
        frames: evidence.slice(0, MAX_EVIDENCE),
        frameTimes: frameTimes.slice(0, MAX_EVIDENCE),
        frameMeta: frameMeta.slice(0, MAX_EVIDENCE),
        motionTimeline,
        contacts: contacts.slice(0, 600),
        tReturnEvents: tReturnEvents.slice(0, 600),
        measured,
      },
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function countT(list: Pos[], inT: (p: Pos) => boolean): number {
  let n = 0;
  for (const p of list) if (inT(p)) n += 1;
  return n;
}
