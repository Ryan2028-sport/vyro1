// Decoder tap — records every value the QCBand/GATT decoders successfully
// extract from raw BLE frames, keyed by metric name. This is the single
// source of truth used by the Debug tab's "Decoder output" section so we
// can tell — with no ambiguity — whether a grey tile is caused by:
//
//   (a) no frames arriving at all             (opcode counter = 0)
//   (b) frames arriving but decoder returning null  (opcode > 0, decoder = 0)
//   (c) value stored but freshness gate hides it    (decoder > 0, ctx null)
//
// It is intentionally standalone: no React, no context. Callers just invoke
// `tapDecoded('hr', 62)` after they set state. Subscribers (DebugView) get
// notified with a fresh snapshot.

export type MetricKey =
  | "hr"
  | "restingHr"
  | "spo2"
  | "skinTemp"
  | "hrv"
  | "stress"
  | "bp"
  | "battery"
  | "steps"
  | "distance"
  | "calories"
  | "motion";

export type DecodedEntry = {
  count: number;
  lastAt: number;
  lastValue: string;
  lastRaw: string;
};

export type DecodedSnapshot = Record<MetricKey, DecodedEntry | undefined>;

type Listener = (s: DecodedSnapshot) => void;

const state: DecodedSnapshot = {} as DecodedSnapshot;
const listeners = new Set<Listener>();

function fmt(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "number") return String(Math.round(value * 100) / 100);
  if (typeof value === "object") {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

export function tapDecoded(metric: MetricKey, value: unknown, raw?: Uint8Array | string): void {
  const prev = state[metric];
  const rawHex = raw
    ? typeof raw === "string"
      ? raw
      : Array.from(raw.subarray(0, 24))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(" ")
    : "";
  state[metric] = {
    count: (prev?.count ?? 0) + 1,
    lastAt: Date.now(),
    lastValue: fmt(value),
    lastRaw: rawHex,
  };
  for (const fn of listeners) {
    try { fn({ ...state }); } catch { /* ignore */ }
  }
}

export function getDecodedSnapshot(): DecodedSnapshot {
  return { ...state };
}

export function subscribeDecoded(fn: Listener): () => void {
  listeners.add(fn);
  fn({ ...state });
  return () => { listeners.delete(fn); };
}
