// Global BLE inspector. Subscribes once to the despia BLE event bus and
// keeps rolling per-characteristic counters, the last raw payload (as hex),
// the last-seen timestamp, plus the most recent GATT discovery tree.
//
// Used by DebugView so any "metric not updating" issue can be diagnosed
// against actual wire traffic instead of UI state.

import { useEffect, useState } from "react";
import { bluetooth, type BleDataEvent, type BleDiscovered } from "@/lib/despia";
import { base64ToBytes, hexToBytes } from "@/lib/vyro-ble/packets";

export type CharStat = {
  service: string;
  characteristic: string;
  count: number;
  lastAt: number;
  lastHex: string;
  lastOpcode: number | null;
};

export type OpStat = {
  opcode: number;
  count: number;
  lastAt: number;
  lastHex: string;
  service: string;
  characteristic: string;
};

export type BleInspectorState = {
  perChar: Record<string, CharStat>;
  perOpcode: Record<string, OpStat>;
  recent: Array<{
    ts: number;
    service: string;
    characteristic: string;
    hex: string;
    opcode: number | null;
  }>;
  discovered: BleDiscovered | null;
  totalNotifications: number;
  writes: {
    total: number;
    ok: number;
    failed: number;
    lastAt: number | null;
    lastCharacteristic: string | null;
    lastError: string | null;
  };
};

const MAX_RECENT = 40;

const emptyWrites = () => ({
  total: 0,
  ok: 0,
  failed: 0,
  lastAt: null,
  lastCharacteristic: null,
  lastError: null,
});

const emptyState = (): BleInspectorState => ({
  perChar: {},
  perOpcode: {},
  recent: [],
  discovered: null,
  totalNotifications: 0,
  writes: emptyWrites(),
});

let singleton: {
  state: BleInspectorState;
  subs: Set<(s: BleInspectorState) => void>;
  initialized: boolean;
} | null = null;

function getStore(): {
  state: BleInspectorState;
  subs: Set<(s: BleInspectorState) => void>;
  initialized: boolean;
} {
  if (!singleton) {
    singleton = {
      state: emptyState(),
      subs: new Set(),
      initialized: false,
    };
  }
  return singleton;
}

function toBytes(value: string): Uint8Array {
  try {
    const trimmed = value.trim();
    const isHex =
      /^[0-9a-fA-F\s:,-]+$/.test(trimmed.replace(/^0x/i, "")) &&
      trimmed.replace(/^0x/i, "").replace(/[^0-9a-fA-F]/g, "").length % 2 === 0;
    return isHex ? hexToBytes(trimmed) : base64ToBytes(value);
  } catch {
    return new Uint8Array(0);
  }
}

function bytesToHex(b: Uint8Array, max = 32): string {
  const slice = b.length > max ? b.subarray(0, max) : b;
  let out = "";
  for (let i = 0; i < slice.length; i++) {
    out += slice[i].toString(16).padStart(2, "0");
    if (i < slice.length - 1) out += " ";
  }
  if (b.length > max) out += ` …(+${b.length - max}B)`;
  return out;
}

function notify(s: ReturnType<typeof getStore>) {
  for (const fn of s.subs) {
    try { fn(s.state); } catch { /* ignore */ }
  }
}

function ensureInitialized() {
  const s = getStore();
  if (s.initialized) return;
  s.initialized = true;

  bluetooth.on("data", (e: BleDataEvent) => {
    const key = `${e.service}::${e.characteristic}`.toLowerCase();
    const bytes = toBytes(e.value);
    const opcode = bytes.length > 0 ? bytes[0] : null;
    const hex = bytesToHex(bytes);
    const now = Date.now();
    const prev = s.state.perChar[key];
    const stat: CharStat = {
      service: e.service,
      characteristic: e.characteristic,
      count: (prev?.count ?? 0) + 1,
      lastAt: now,
      lastHex: hex,
      lastOpcode: opcode,
    };
    const recent = [
      { ts: now, service: e.service, characteristic: e.characteristic, hex, opcode },
      ...s.state.recent,
    ].slice(0, MAX_RECENT);
    const opcodeKey = opcode == null ? null : `0x${opcode.toString(16).padStart(2, "0")}`;
    const prevOp = opcodeKey ? s.state.perOpcode[opcodeKey] : undefined;
    s.state = {
      ...s.state,
      perChar: { ...s.state.perChar, [key]: stat },
      perOpcode: opcodeKey
        ? {
            ...s.state.perOpcode,
            [opcodeKey]: {
              opcode: opcode!,
              count: (prevOp?.count ?? 0) + 1,
              lastAt: now,
              lastHex: hex,
              service: e.service,
              characteristic: e.characteristic,
            },
          }
        : s.state.perOpcode,
      recent,
      totalNotifications: s.state.totalNotifications + 1,
    };
    notify(s);
  });

  bluetooth.on("discovered", (tree: BleDiscovered) => {
    s.state = { ...s.state, discovered: tree };
    notify(s);
  });

  bluetooth.on("writeComplete", (e) => {
    const now = Date.now();
    s.state = {
      ...s.state,
      writes: {
        total: s.state.writes.total + 1,
        ok: s.state.writes.ok + (e.success ? 1 : 0),
        failed: s.state.writes.failed + (e.success ? 0 : 1),
        lastAt: now,
        lastCharacteristic: e.characteristic,
        lastError: e.error || null,
      },
    };
    notify(s);
  });

  bluetooth.on("connect", (e) => {
    if (e.state === "disconnected" || e.state === "failed") {
      // Keep counters across reconnects, but tag a marker in the recent log.
      const now = Date.now();
      const recent = [
        {
          ts: now,
          service: "—",
          characteristic: `[${e.state}${e.error ? `: ${e.error}` : ""}]`,
          hex: "",
          opcode: null,
        },
        ...s.state.recent,
      ].slice(0, MAX_RECENT);
      s.state = { ...s.state, recent };
      notify(s);
    }
  });
}

export function useBleInspector(): BleInspectorState {
  ensureInitialized();
  const s = getStore();
  const [state, setState] = useState<BleInspectorState>(s.state);
  useEffect(() => {
    s.subs.add(setState);
    setState(s.state);
    return () => { s.subs.delete(setState); };
  }, [s]);
  return state;
}

export function shortUuid(uuid: string): string {
  // Pull the 16-bit alias when present, otherwise the last 4 hex chars.
  const lower = (uuid || "").toLowerCase();
  const m = lower.match(/^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/);
  if (m) return `0x${m[1]}`;
  const compact = lower.replace(/-/g, "");
  return compact.length >= 8 ? `…${compact.slice(-6)}` : lower || "—";
}

export function ageLabel(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1500) return "just now";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  return `${Math.round(ms / 3_600_000)}h ago`;
}
