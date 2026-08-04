// Always-on keep-alive for the VYRO band link.
//
// iOS (both the native Despia WebView and the home-screen PWA) suspends
// JavaScript timers a few seconds after the app leaves the screen, which is
// what kills the "always on" band stream even though Core Bluetooth itself is
// allowed to keep the GATT link. Two things keep the JS runtime scheduled:
//
//   1. A looping *silent* audio element. An active audio session keeps the
//      web app alive in the background on iOS/Android. It must be started
//      from a user gesture, so we arm it on the first touch/click.
//   2. Native background asserts (Despia background location + scanning
//      mode), re-fired on every visibility transition.
//
// Everything is best-effort and safe to call repeatedly.

import { isNative, location as despiaLocation, run as despiaRun } from "@/lib/despia";

// 1-second silent mono WAV (44.1kHz, 8-bit) — small enough to inline.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ4AAACAgICAgICAgICAgICAgA==";

export type KeepAliveStatus = {
  /** Keep-alive machinery has been started for this session. */
  active: boolean;
  /** Silent audio session is actually playing (background JS stays scheduled). */
  audio: boolean;
  /** Screen wake lock held (browser only). */
  wakeLock: boolean;
  /** Native background mode asserted. */
  native: boolean;
};

let audioEl: HTMLAudioElement | null = null;
let wakeLock: { release: () => Promise<void> } | null = null;
let started = false;
let listeners = new Set<(s: KeepAliveStatus) => void>();

const status: KeepAliveStatus = { active: false, audio: false, wakeLock: false, native: false };

function emit() {
  for (const l of listeners) l({ ...status });
}

export function subscribeKeepAlive(fn: (s: KeepAliveStatus) => void): () => void {
  listeners.add(fn);
  fn({ ...status });
  return () => {
    listeners.delete(fn);
  };
}

export function getKeepAliveStatus(): KeepAliveStatus {
  return { ...status };
}

function ensureAudio() {
  if (typeof window === "undefined") return;
  if (!audioEl) {
    audioEl = new Audio(SILENT_WAV);
    audioEl.loop = true;
    audioEl.preload = "auto";
    audioEl.volume = 0.0001; // effectively silent, but a real (non-muted) session
    // Keep the session in the "playback" category so iOS does not duck it.
    audioEl.setAttribute("playsinline", "true");
  }
  const el = audioEl;
  void el
    .play()
    .then(() => {
      status.audio = !el.paused;
      emit();
    })
    .catch(() => {
      status.audio = false;
      emit();
    });
}

async function ensureWakeLock() {
  const nav = navigator as Navigator & {
    wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
  };
  if (!nav.wakeLock?.request) return;
  try {
    wakeLock = await nav.wakeLock.request("screen");
    status.wakeLock = true;
    emit();
    // Wake locks are auto-released when the page hides; re-acquire on show.
    (wakeLock as unknown as EventTarget & { addEventListener?: Function }).addEventListener?.(
      "release",
      () => {
        status.wakeLock = false;
        emit();
      },
    );
  } catch {
    status.wakeLock = false;
  }
}

function assertNative() {
  if (!isNative) return;
  void despiaLocation.backgroundOn();
  void despiaRun("scanningmode://on");
  status.native = true;
  emit();
}

/** Re-assert every keep-alive channel. Cheap and idempotent. */
export function pokeKeepAlive() {
  if (!started) return;
  assertNative();
  ensureAudio();
  if (document.visibilityState === "visible" && !status.wakeLock) void ensureWakeLock();
}

/**
 * Start always-on keep-alive. Safe to call on every render/connect.
 * Returns a stop function, but callers normally never stop it — tearing it
 * down is exactly what breaks background streaming.
 */
export function startKeepAlive(): () => void {
  if (typeof window === "undefined") return () => undefined;
  if (started) {
    pokeKeepAlive();
    return () => undefined;
  }
  started = true;
  status.active = true;

  assertNative();
  void ensureWakeLock();
  ensureAudio(); // may be blocked until a gesture; armed below

  const onGesture = () => {
    ensureAudio();
    if (status.audio) {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("touchend", onGesture);
      window.removeEventListener("keydown", onGesture);
    }
  };
  window.addEventListener("pointerdown", onGesture);
  window.addEventListener("touchend", onGesture);
  window.addEventListener("keydown", onGesture);

  const onVis = () => pokeKeepAlive();
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("pageshow", onVis);
  window.addEventListener("pagehide", onVis);
  window.addEventListener("focus", onVis);

  // Watchdog: if iOS pauses the silent session, restart it.
  const watchdog = window.setInterval(() => {
    if (audioEl && audioEl.paused) ensureAudio();
    else if (audioEl && !audioEl.paused && !status.audio) {
      status.audio = true;
      emit();
    }
    assertNative();
  }, 10_000);

  emit();

  return () => {
    window.clearInterval(watchdog);
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("pageshow", onVis);
    window.removeEventListener("pagehide", onVis);
    window.removeEventListener("focus", onVis);
  };
}
