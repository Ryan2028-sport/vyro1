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
const TARGET_FPS = 4;
const MAX_CHECKPOINTS = 2400;
const MAX_EVIDENCE = 30;
const DIFF_THRESHOLD = 13;
const MIN_BLOB_CELLS = 5;
const MAX_BLOB_FRACTION = 0.22; // a blob bigger than this is a light change, not a body

export type ScanStage = "load" | "scan" | "track" | "frames" | "done";
export type ScanProgress = { ratio: number; label: string; stage: ScanStage; elapsedSec: number };

type Blob = { x: number; y: number; mass: number; cells: number; w: number; h: number };
type Frame = { t: number; motion: number; blobs: Blob[] };
type Pos = { x: number; y: number } | null;

export class ScanAborted extends Error {
  constructor() {
    super("Scan cancelled.");
    this.name = "ScanAborted";
  }
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

/** 4-neighbour connected components over the foreground mask. */
function extractBlobs(mask: Uint8Array, weight: Uint8ClampedArray): Blob[] {
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
    blobs.push({ x: (sx / mass + 0.5) / GRID, y: (sy / mass + 0.5) / GRID, mass, cells, w, h });
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

export type ScanResult = {
  payload: ClipInput;
  measured: MeasuredStats;
};

export async function scanSquashVideo(
  file: File,
  onProgress: (p: ScanProgress) => void,
  signal?: AbortSignal,
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

    // ---- pass 1: background model + blobs ---------------------------------
    const frames: Frame[] = [];
    const bg = new Float32Array(GRID * GRID);
    let prev: Uint8ClampedArray | null = null;
    let bgReady = false;
    const mask = new Uint8Array(GRID * GRID);
    const weight = new Uint8ClampedArray(GRID * GRID);

    for (let i = 0; i < times.length; i++) {
      abortIfNeeded();
      await seek(video, times[i]!);
      sctx.drawImage(video, 0, 0, GRID, GRID);
      const px = sctx.getImageData(0, 0, GRID, GRID).data;
      const gray = new Uint8ClampedArray(GRID * GRID);
      for (let p = 0; p < GRID * GRID; p++) {
        gray[p] = (px[p * 4]! * 0.299 + px[p * 4 + 1]! * 0.587 + px[p * 4 + 2]! * 0.114) | 0;
      }

      if (!bgReady) {
        for (let p = 0; p < GRID * GRID; p++) bg[p] = gray[p]!;
        bgReady = true;
      }

      if (prev) {
        let motionTotal = 0;
        let fgCells = 0;
        for (let p = 0; p < GRID * GRID; p++) {
          const g = gray[p]!;
          const dFrame = Math.abs(g - prev[p]!);
          const dBg = Math.abs(g - bg[p]!);
          // Foreground = differs from the learned background AND is not a
          // whole-scene brightness shift (frame diff corroborates movement).
          const fg = dBg > DIFF_THRESHOLD + 4 && (dFrame > 6 || dBg > DIFF_THRESHOLD + 14);
          mask[p] = fg ? 1 : 0;
          weight[p] = fg ? Math.min(255, dBg) : 0;
          if (fg) fgCells += 1;
          if (dFrame > DIFF_THRESHOLD) motionTotal += dFrame;
        }
        // A huge foreground means the camera moved or the scene cut — skip it.
        const usable = fgCells < GRID * GRID * 0.5;
        const motion = Math.max(0, Math.min(100, Math.round((motionTotal / (GRID * GRID * 26)) * 100)));
        frames.push({ t: times[i]!, motion, blobs: usable ? extractBlobs(mask, weight) : [] });
      }

      // Slow background update: fast enough for lighting drift, slow enough
      // that a player standing still stays foreground for a few seconds.
      for (let p = 0; p < GRID * GRID; p++) bg[p] = bg[p]! * 0.965 + gray[p]! * 0.035;
      prev = gray;

      if (i % 8 === 0) {
        onProgress({
          ratio: 0.02 + 0.66 * (i / times.length),
          label: `Scanning court motion ${Math.round((i / times.length) * 100)}% · ${Math.round(times[i]!)}s of ${Math.round(duration)}s`,
          stage: "scan",
          elapsedSec: elapsed(),
        });
        // Let the UI paint between chunks.
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    abortIfNeeded();
    onProgress({ ratio: 0.7, label: "Fitting the court and tracking both players…", stage: "track", elapsedSec: elapsed() });

    // ---- fit the court box from observed play -----------------------------
    const xs: number[] = [];
    const ys: number[] = [];
    for (const f of frames) for (const b of f.blobs) { xs.push(b.x); ys.push(b.y); }
    xs.sort((a, b) => a - b);
    ys.sort((a, b) => a - b);
    const enough = xs.length > 40;
    const x0 = enough ? percentile(xs, 0.03) : 0;
    const x1 = enough ? percentile(xs, 0.97) : 1;
    const y0 = enough ? percentile(ys, 0.03) : 0;
    const y1 = enough ? percentile(ys, 0.97) : 1;
    const spanX = Math.max(0.15, x1 - x0);
    const spanY = Math.max(0.15, y1 - y0);
    const courtX = (x: number) => Math.max(0, Math.min(1, (x - x0) / spanX));
    const courtY = (y: number) => Math.max(0, Math.min(1, (y - y0) / spanY));

    // ---- track two movers with position prediction ------------------------
    type Track = { pos: { x: number; y: number }; vel: { x: number; y: number }; miss: number };
    let A: Track | null = null;
    let B: Track | null = null;
    const rawA: Pos[] = [];
    const rawB: Pos[] = [];
    const massA: number[] = [];
    const massB: number[] = [];
    let twoBlobFrames = 0;
    let activeFrames = 0;

    const predict = (tr: Track | null): Pos =>
      tr ? { x: tr.pos.x + tr.vel.x, y: tr.pos.y + tr.vel.y } : null;
    const gap = (p: Pos, b: Blob) => (p ? Math.hypot(p.x - b.x, p.y - b.y) : 1.5);
    const update = (tr: Track | null, b: Blob): Track => {
      if (!tr) return { pos: { x: b.x, y: b.y }, vel: { x: 0, y: 0 }, miss: 0 };
      return {
        pos: { x: b.x, y: b.y },
        vel: { x: (b.x - tr.pos.x) * 0.6 + tr.vel.x * 0.4, y: (b.y - tr.pos.y) * 0.6 + tr.vel.y * 0.4 },
        miss: 0,
      };
    };

    for (const f of frames) {
      const blobs = f.blobs;
      let pickA: Blob | null = null;
      let pickB: Blob | null = null;
      const pa = predict(A);
      const pb = predict(B);

      if (blobs.length >= 2) {
        twoBlobFrames += 1;
        const [b1, b2] = [blobs[0]!, blobs[1]!];
        if (!A || !B) {
          // Seed: camera sits behind the court, so the lower blob is nearer.
          if (b1.y >= b2.y) { pickA = b1; pickB = b2; } else { pickA = b2; pickB = b1; }
        } else {
          const straight = gap(pa, b1) + gap(pb, b2);
          const swapped = gap(pa, b2) + gap(pb, b1);
          if (straight <= swapped) { pickA = b1; pickB = b2; } else { pickA = b2; pickB = b1; }
        }
      } else if (blobs.length === 1) {
        const b = blobs[0]!;
        const da = gap(pa, b);
        const db = gap(pb, b);
        // A single blob only claims a track when it is plausibly that track.
        if (da <= db && da < 0.3) pickA = b;
        else if (db < da && db < 0.3) pickB = b;
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

      rawA.push(pickA ? { x: pickA.x, y: pickA.y } : null);
      rawB.push(pickB ? { x: pickB.x, y: pickB.y } : null);
      massA.push(pickA?.mass ?? 0);
      massB.push(pickB?.mass ?? 0);
      if (f.motion > 0) activeFrames += 1;
    }

    // "You" is the mover living closer to the camera across the WHOLE clip,
    // not whichever blob happened to seed the tracker first.
    const depthA = mean(rawA.filter(Boolean).map((p) => p!.y));
    const depthB = mean(rawB.filter(Boolean).map((p) => p!.y));
    const flip = depthB > depthA + 0.02;
    const rawPlayer = flip ? rawB : rawA;
    const rawOpp = flip ? rawA : rawB;
    const playerMass = flip ? massB : massA;
    const opponentMass = flip ? massA : massB;

    const playerPos: Pos[] = rawPlayer.map((p) => (p ? { x: courtX(p.x), y: courtY(p.y) } : null));
    const opponentPos: Pos[] = rawOpp.map((p) => (p ? { x: courtX(p.x), y: courtY(p.y) } : null));

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

    // ---- rallies -----------------------------------------------------------
    const motions = frames.map((f) => f.motion);
    const sortedMotion = [...motions].sort((a, b) => a - b);
    const averageMotion = mean(motions);
    const peakMotion = motions.length ? Math.max(...motions) : 0;
    const quietLevel = percentile(sortedMotion, 0.3);
    const activeFloor = Math.max(4, quietLevel + Math.max(3, (peakMotion - quietLevel) * 0.16));

    const active = motions.map((m) => m >= activeFloor);
    const activeSeconds = active.filter(Boolean).length * step;
    const restSeconds = Math.max(0.1, duration - activeSeconds);

    // ---- contacts: per-player strike signal -------------------------------
    const speed = (list: Pos[], i: number) => {
      const a = list[i - 1];
      const b = list[i];
      return a && b ? Math.hypot(b.x - a.x, b.y - a.y) / step : 0;
    };
    const reversal = (list: Pos[], i: number) => {
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
      if (!active[i]) continue;
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

      // Recovery to the T after your own strike only.
      if (c.actor === "player") {
        const horizon = Math.min(frames.length, c.i + Math.ceil(8 / step));
        for (let j = c.i + 1; j < horizon; j++) {
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

    const third = Math.max(1, Math.floor(frames.length / 3));
    const firstThird = mean(motions.slice(0, third));
    const lastThird = mean(motions.slice(-third));
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
    // few high-motion frames so the AI leg has something real to look at.
    if (!evidence.length) {
      const busiest = [...frames].sort((a, b) => b.motion - a.motion).slice(0, 6).sort((a, b) => a.t - b.t);
      for (const f of busiest) {
        abortIfNeeded();
        await seek(video, f.t);
        bctx.drawImage(video, 0, 0, big.width, big.height);
        evidence.push(big.toDataURL("image/jpeg", 0.6));
        frameTimes.push(Number(f.t.toFixed(2)));
        frameMeta.push({ t: Number(f.t.toFixed(2)), actor: "unknown", zone: "mid-centre" });
      }
    }

    const stride = Math.max(1, Math.ceil(frames.length / 500));
    const motionTimeline = frames
      .filter((_, i) => i % stride === 0)
      .map((f, k) => {
        const i = k * stride;
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
    };

    onProgress({ ratio: 0.93, label: "Verifying frames with the AI…", stage: "done", elapsedSec: elapsed() });

    return {
      measured,
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
