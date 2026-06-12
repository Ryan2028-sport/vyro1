// High-level VYRO band hook. Wraps `useBluetooth` and decodes motion event
// packets into typed events the rest of the app can consume.

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
import { bluetooth } from "@/lib/despia";

export type SessionState = "idle" | "live" | "paused";

export interface VyroEventEntry {
  ts: number;
  event: VyroMotionEvent;
}

const MAX_EVENTS = 120;

export function useVyroBand() {
  const ble = useBluetooth();
  const { connectedId, lastData } = ble;
  const [events, setEvents] = useState<VyroEventEntry[]>([]);
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [sport, setSport] = useState<Sport>("squash");

  // When connected, subscribe to the motion event characteristic.
  useEffect(() => {
    if (!connectedId) return;
    void bluetooth.subscribe(
      connectedId,
      VYRO_SERVICE_UUID,
      VYRO_EVENT_CHAR_UUID,
    );
    return () => {
      void bluetooth.unsubscribe(
        connectedId,
        VYRO_SERVICE_UUID,
        VYRO_EVENT_CHAR_UUID,
      );
    };
  }, [connectedId]);

  // Decode raw notifications from the event characteristic.
  useEffect(() => {
    if (!lastData) return;
    if (lastData.characteristic.toLowerCase() !== VYRO_EVENT_CHAR_UUID)
      return;
    try {
      const ev = decodeMotionEventFromString(lastData.value);
      setEvents((prev) => {
        const next = [...prev, { ts: Date.now(), event: ev }];
        return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
      });
    } catch (err) {
      console.warn("[vyro] decode failed", err);
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
  };
}
