// LocalStorage-backed sleep night history. Once the firmware emits a sleep
// frame, the parser in `use-vyro-band.ts` should call `recordSleepNight()`
// to push a new entry; this hook exposes the list to any view (SleepView,
// TrendsView, AthleteView).
//
// The decoder hook for QCBand sleep frames is not implemented yet — the
// device opcode + byte layout is not in our packet spec. Until it lands,
// `useSleepNights()` returns an empty array and the UI renders an empty
// state ("No sleep data synced yet").

import { useEffect, useState } from "react";

export type SleepStage = "awake" | "light" | "deep" | "rem";

export interface SleepNight {
  // ISO timestamp of when the night ended (wake time).
  endAt: string;
  // Computed overall score 0..100.
  score: number;
  // Minutes asleep.
  asleepMin: number;
  // Minutes in bed.
  inBedMin: number;
  // Number of wake events > 60s.
  wakeups: number;
  // Per-stage minutes.
  stages: Record<SleepStage, number>;
  // Optional sleep debt vs target minutes (positive = behind).
  debtMin?: number;
  // Per-minute hypnogram stage values (oldest → newest); optional.
  hypnogram?: SleepStage[];
}

const KEY = "vyro.sleep.nights.v1";
const MAX = 60;

function read(): SleepNight[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SleepNight[]) : [];
  } catch {
    return [];
  }
}

function write(list: SleepNight[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
    window.dispatchEvent(new CustomEvent("vyro:sleep-nights"));
  } catch {
    /* quota / blocked */
  }
}

/** Append a new sleep night. Called by the band hook once a sleep frame is
 *  decoded. Safe to call from anywhere. */
export function recordSleepNight(night: SleepNight) {
  const list = read();
  // De-dupe by endAt date (one entry per night).
  const day = night.endAt.slice(0, 10);
  const filtered = list.filter((n) => n.endAt.slice(0, 10) !== day);
  filtered.push(night);
  filtered.sort((a, b) => a.endAt.localeCompare(b.endAt));
  write(filtered);
}

export function useSleepNights() {
  const [nights, setNights] = useState<SleepNight[]>(() => read());

  useEffect(() => {
    function refresh() {
      setNights(read());
    }
    window.addEventListener("vyro:sleep-nights", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("vyro:sleep-nights", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const last = nights.length ? nights[nights.length - 1] : null;
  return { nights, last, scores: nights.slice().reverse().map((n) => n.score) };
}

/** Format minutes as `Xh YYm`. */
export function fmtSleepDuration(min: number): string {
  if (!Number.isFinite(min) || min < 0) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
