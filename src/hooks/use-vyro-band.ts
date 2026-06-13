// High-level VYRO band hook. Wraps `useBluetooth` and decodes motion event
// packets into typed events the rest of the app can consume.
//
// In addition to the proprietary VYRO motion service, this hook also
// auto-subscribes to the standard Bluetooth SIG services that most fitness
// watches expose so we can show real live metrics even on a non-VYRO device:
//
//   - Heart Rate Service (0x180D) → Heart Rate Measurement (0x2A37)
//   - Battery Service     (0x180F) → Battery Level         (0x2A19)
//
// When the connected device advertises these, the live heart-rate (bpm) and
// battery level get pushed into context and rendered by the rest of the app
// (HomeView pill, Recovery view, etc).

import { useEffect, useMemo, useState } from "react";
import { useBluetooth } from "./use-bluetooth";
import {
  decodeMotionEventFromString,
  type VyroMotionEvent,
} from "@/lib/vyro-ble/packets";
import {
  VYRO_CONTROL_CHAR_UUID,
  VYRO_EVENT_CHAR_UUID,
  VYRO_SERVICE_UUID,
} from "@/lib/vyro-ble/uuids";
import {
  bytesToHex,
  encodeEndSession,
  encodePauseSession,
  encodeStartSession,
  type Sport,
} from "@/lib/vyro-ble/session-control";
import {
  decodeQcBandRealtimeHeartRate,
  encodeQcBandBindingAlert,
  encodeQcBandRealtimeHeartRate,
  QCBAND_NOTIFY_CHAR_UUID,
  QCBAND_SERVICE_UUID,
  QCBAND_WRITE_CHAR_UUID,
} from "@/lib/vyro-ble/qcband";
import { bluetooth, type BleDiscovered } from "@/lib/despia";

export type SessionState = "idle" | "live" | "paused";

export interface VyroEventEntry {
  ts: number;
  event: VyroMotionEvent;
}

const MAX_EVENTS = 120;

// Standard Bluetooth SIG UUIDs (128-bit form). Lowercase so substring
// matches work against whatever case the platform reports.
const HR_SERVICE   = "0000180d-0000-1000-8000-00805f9b34fb";
const HR_MEAS_CHAR = "00002a37-0000-1000-8000-00805f9b34fb";
const BAT_SERVICE  = "0000180f-0000-1000-8000-00805f9b34fb";
const BAT_LVL_CHAR = "00002a19-0000-1000-8000-00805f9b34fb";

function uuidMatches(a: string, b: string): boolean {
  if (!a) return false;
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la === lb) return true;
  // Short-form (e.g. "180d" or "0x180d") vs 128-bit canonical form.
  const short = la.replace(/^0x/, "");
  return lb.includes(short) && short.length >= 4;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "").replace(/[^0-9a-fA-F]/g, "");
  const out = new Uint8Array(clean.length >> 1);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

function payloadToBytes(value: string): Uint8Array {
  const hex = value.replace(/^0x/, "").replace(/[^0-9a-fA-F]/g, "");
  if (hex.length >= 2 && hex.length % 2 === 0 && hex.length >= value.trim().length - 2) {
    return hexToBytes(hex);
  }
  try {
    const raw = atob(value);
    return Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
  } catch {
    return hexToBytes(value);
  }
}

/** Heart Rate Measurement (GATT 0x2A37) decoder. */
function decodeHeartRate(bytes: Uint8Array): number | null {
  if (bytes.length < 2) return null;
  const flags = bytes[0];
  const wide = (flags & 0x01) === 0x01;
  if (wide) {
    if (bytes.length < 3) return null;
    return bytes[1] | (bytes[2] << 8);
  }
  return bytes[1];
}

export function useVyroBand() {
  const ble = useBluetooth();
  const { connectedId, lastData } = ble;
  const [events, setEvents] = useState<VyroEventEntry[]>([]);
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [sport, setSport] = useState<Sport>("squash");
  const [heartRateBpm, setHeartRateBpm] = useState<number | null>(null);
  const [heartRateAt, setHeartRateAt] = useState<number | null>(null);
  const [batteryPct, setBatteryPct] = useState<number | null>(null);

  // When connected, always subscribe to the VYRO motion event characteristic
  // (cheap if the remote watch doesn't expose it — the platform just errors
  // out and we move on).
  useEffect(() => {
    if (!connectedId) return;
    void bluetooth
      .subscribe(connectedId, VYRO_SERVICE_UUID, VYRO_EVENT_CHAR_UUID)
      .catch(() => undefined);
    return () => {
      void bluetooth
        .unsubscribe(connectedId, VYRO_SERVICE_UUID, VYRO_EVENT_CHAR_UUID)
        .catch(() => undefined);
    };
  }, [connectedId]);

  // Reset metrics when the connected device changes.
  useEffect(() => {
    if (!connectedId) {
      setHeartRateBpm(null);
      setHeartRateAt(null);
      setBatteryPct(null);
    }
  }, [connectedId]);

  // After connection, the despia/capacitor bridge emits a `discovered`
  // event with the full service/characteristic tree. Use it to subscribe
  // to standard GATT services (heart rate, battery) and the QCBand SDK
  // proprietary live-HR service if present.
  useEffect(() => {
    if (!connectedId) return;
    let qcBandStarted = false;
    let qcBandService: { service: string; notify: string; write: string } | null = null;
    let holdTimer: number | null = null;

    async function writeQcBand(service: string, write: string, bytes: Uint8Array) {
      const hex = bytesToHex(bytes);
      try {
        await bluetooth.write(connectedId!, service, write, hex, true);
      } catch {
        await bluetooth.write(connectedId!, service, write, hex, false);
      }
    }

    async function startQcBandLiveHr(service: string, notify: string, write: string) {
      if (qcBandStarted) return;
      qcBandStarted = true;
      qcBandService = { service, notify, write };
      await bluetooth.subscribe(connectedId!, service, notify);
      await writeQcBand(service, write, encodeQcBandBindingAlert()).catch(() => undefined);
      await writeQcBand(service, write, encodeQcBandRealtimeHeartRate("start"));
      holdTimer = window.setInterval(() => {
        void writeQcBand(service, write, encodeQcBandRealtimeHeartRate("hold")).catch(
          () => undefined,
        );
      }, 20_000);
    }

    const off = bluetooth.on("discovered", (tree: BleDiscovered) => {
      if (tree.id !== connectedId) return;
      for (const svc of tree.services) {
        if (uuidMatches(svc.uuid, QCBAND_SERVICE_UUID)) {
          const notify = svc.characteristics.find((c) => uuidMatches(c.uuid, QCBAND_NOTIFY_CHAR_UUID));
          const write = svc.characteristics.find((c) => uuidMatches(c.uuid, QCBAND_WRITE_CHAR_UUID));
          if (notify && write) {
            void startQcBandLiveHr(svc.uuid, notify.uuid, write.uuid).catch((err) =>
              console.warn("[vyro] QCBand live HR start failed", err),
            );
          }
        }
        if (uuidMatches(svc.uuid, HR_SERVICE)) {
          const ch = svc.characteristics.find((c) => uuidMatches(c.uuid, HR_MEAS_CHAR));
          if (ch) {
            void bluetooth
              .subscribe(connectedId, svc.uuid, ch.uuid)
              .catch((err) => console.warn("[vyro] HR subscribe failed", err));
          }
        }
        if (uuidMatches(svc.uuid, BAT_SERVICE)) {
          const ch = svc.characteristics.find((c) => uuidMatches(c.uuid, BAT_LVL_CHAR));
          if (ch) {
            void bluetooth
              .read(connectedId, svc.uuid, ch.uuid)
              .catch((err) => console.warn("[vyro] battery read failed", err));
            void bluetooth
              .subscribe(connectedId, svc.uuid, ch.uuid)
              .catch(() => undefined);
          }
        }
      }
    });
    void bluetooth.discover(connectedId).catch(() => undefined);
    return () => {
      off();
      if (holdTimer != null) window.clearInterval(holdTimer);
      if (qcBandService) {
        void writeQcBand(
          qcBandService.service,
          qcBandService.write,
          encodeQcBandRealtimeHeartRate("end"),
        ).catch(() => undefined);
        void bluetooth
          .unsubscribe(connectedId, qcBandService.service, qcBandService.notify)
          .catch(() => undefined);
      }
    };
  }, [connectedId]);

  // Decode incoming notifications. Routes by characteristic UUID.
  useEffect(() => {
    if (!lastData) return;
    const cuuid = lastData.characteristic.toLowerCase();
    if (uuidMatches(cuuid, VYRO_EVENT_CHAR_UUID)) {
      try {
        const ev = decodeMotionEventFromString(lastData.value);
        setEvents((prev) => {
          const next = [...prev, { ts: Date.now(), event: ev }];
          return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
        });
      } catch (err) {
        console.warn("[vyro] motion decode failed", err);
      }
      return;
    }
    if (uuidMatches(cuuid, HR_MEAS_CHAR)) {
      const bpm = decodeHeartRate(payloadToBytes(lastData.value));
      if (bpm != null && bpm > 0 && bpm < 250) {
        setHeartRateBpm(bpm);
        setHeartRateAt(Date.now());
      }
      return;
    }
    if (uuidMatches(cuuid, QCBAND_NOTIFY_CHAR_UUID)) {
      const bpm = decodeQcBandRealtimeHeartRate(payloadToBytes(lastData.value));
      if (bpm != null) {
        setHeartRateBpm(bpm);
        setHeartRateAt(Date.now());
      }
      return;
    }
    if (uuidMatches(cuuid, BAT_LVL_CHAR)) {
      const bytes = payloadToBytes(lastData.value);
      if (bytes.length >= 1) setBatteryPct(bytes[0]);
      return;
    }
  }, [lastData]);

  const counts = useMemo(() => {
    const c = { swing: 0, rapid_start: 0, burst: 0, direction_change: 0 };
    for (const e of events) c[e.event.type] += 1;
    return c;
  }, [events]);

  async function writeControl(bytes: Uint8Array) {
    if (!connectedId) return;
    await bluetooth.write(
      connectedId,
      VYRO_SERVICE_UUID,
      VYRO_CONTROL_CHAR_UUID,
      bytesToHex(bytes),
      true,
    );
  }

  async function startSession(s: Sport = sport) {
    setSport(s);
    await writeControl(encodeStartSession(s));
    setSessionState("live");
    setEvents([]);
  }
  async function pauseSession() {
    await writeControl(encodePauseSession());
    setSessionState("paused");
  }
  async function endSession() {
    await writeControl(encodeEndSession());
    setSessionState("idle");
  }

  return {
    ble,
    connected: !!connectedId,
    events,
    counts,
    sessionState,
    sport,
    setSport,
    startSession,
    pauseSession,
    endSession,
    heartRateBpm,
    heartRateAt,
    batteryPct,
  };
}
