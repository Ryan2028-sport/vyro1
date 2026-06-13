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

import { useEffect, useMemo, useRef, useState } from "react";
import { useBluetooth } from "./use-bluetooth";
import { decodeMotionEventFromString, type VyroMotionEvent } from "@/lib/vyro-ble/packets";
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
  decodeQcBandBattery,
  decodeQcBandMeasureFrame,
  decodeQcBandOneKeyPayload,
  decodeQcBandRealtimeHeartRate,
  decodeQcBandTempPayload,
  decodeQcBandTodaySummary,
  encodeQcBandBatteryRequest,
  encodeQcBandMeasureStart,
  encodeQcBandMeasureStop,
  encodeQcBandRealtimeHeartRate,
  encodeQcBandSpo2Start,
  encodeQcBandSpo2Stop,
  encodeQcBandStepsRequest,
  encodeQcBandStepsRequestAlt1,
  encodeQcBandStepsRequestAlt2,
  QCBAND_CMD_BATTERY,
  QCBAND_CMD_REALTIME_HR,
  QCBAND_CMD_START_MEASURE,
  QCBAND_CMD_STEPS_ALT1,
  QCBAND_CMD_STEPS_ALT2,
  QCBAND_CMD_TODAY_SUMMARY,
  QCBAND_MEASURE_HR,
  QCBAND_MEASURE_HRV,
  QCBAND_MEASURE_ONE_KEY,
  QCBAND_MEASURE_SPO2,
  QCBAND_MEASURE_STRESS,
  QCBAND_MEASURE_TEMP,
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
const HR_SERVICE = "0000180d-0000-1000-8000-00805f9b34fb";
const HR_MEAS_CHAR = "00002a37-0000-1000-8000-00805f9b34fb";
const BAT_SERVICE = "0000180f-0000-1000-8000-00805f9b34fb";
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
  const [batteryCharging, setBatteryCharging] = useState<boolean>(false);
  const [spo2Pct, setSpo2Pct] = useState<number | null>(null);
  const [skinTempC, setSkinTempC] = useState<number | null>(null);
  const [stepsToday, setStepsToday] = useState<number | null>(null);
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [caloriesKcal, setCaloriesKcal] = useState<number | null>(null);
  const [restingHrBpm, setRestingHrBpm] = useState<number | null>(null);
  const [hrvMs, setHrvMs] = useState<number | null>(null);
  const [respRateBrpm, setRespRateBrpm] = useState<number | null>(null);
  const [stressScore, setStressScore] = useState<number | null>(null);
  const [bloodPressure, setBloodPressure] = useState<{ sbp: number; dbp: number } | null>(null);
  const hrSamplesRef = useRef<{ t: number; bpm: number }[]>([]);

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
      setBatteryCharging(false);
      setSpo2Pct(null);
      setSkinTempC(null);
      setStepsToday(null);
      setDistanceM(null);
      setCaloriesKcal(null);
      setRestingHrBpm(null);
      setHrvMs(null);
      setRespRateBrpm(null);
      setStressScore(null);
      setBloodPressure(null);
      hrSamplesRef.current = [];
    }
  }, [connectedId]);

  // Resting HR — only a *real* derived metric. Computed as the 5th-percentile
  // of the rolling 5-minute live-HR buffer (same approach the vendor app uses
  // when the firmware doesn't ship a vendor RHR characteristic).
  //
  // Everything else — HRV, Respiratory Rate, Stress, SpO₂, Skin Temp — must
  // come from a real SDK frame. We do NOT fake them from HR/4.5 or RMSSD on
  // smoothed 1-Hz HR; those aren't real signals. If the watch firmware does
  // not deliver the corresponding 0x69 sub-type, the tile stays empty.
  useEffect(() => {
    if (heartRateBpm == null || heartRateAt == null) return;
    const buf = hrSamplesRef.current;
    buf.push({ t: heartRateAt, bpm: heartRateBpm });
    const cutoff = heartRateAt - 5 * 60_000;
    while (buf.length && buf[0].t < cutoff) buf.shift();
    if (buf.length >= 20) {
      const sorted = buf.map((s) => s.bpm).sort((a, b) => a - b);
      setRestingHrBpm(sorted[Math.max(0, Math.floor(sorted.length * 0.05))]);
    }
  }, [heartRateBpm, heartRateAt]);

  // After connection, the despia/capacitor bridge emits a `discovered`
  // event with the full service/characteristic tree. Use it to subscribe
  // to standard GATT services (heart rate, battery) and the QCBand SDK
  // proprietary live-HR service if present.
  useEffect(() => {
    if (!connectedId) return;
    let cancelled = false;
    let qcBandStarted = false;
    let qcBandService: { service: string; notify: string; write: string } | null = null;
    let holdTimer: number | null = null;
    let restartTimer: number | null = null;
    let batteryTimer: number | null = null;
    let stepsTimer: number | null = null;
    let oneKeyTimer: number | null = null;
    let tempTimer: number | null = null;

    async function writeQcBand(service: string, write: string, bytes: Uint8Array) {
      const hex = bytesToHex(bytes);
      try {
        await bluetooth.write(connectedId!, service, write, hex, true);
      } catch {
        await bluetooth.write(connectedId!, service, write, hex, false);
      }
    }

    async function startQcBandLiveHr(service: string, notify: string, write: string) {
      if (qcBandStarted || cancelled) return;
      qcBandStarted = true;
      qcBandService = { service, notify, write };
      try {
        await bluetooth.subscribe(connectedId!, service, notify);
      } catch (err) {
        console.warn("[vyro] QCBand notify subscribe failed", err);
      }
      // Send start; retry once after a short delay if the watch ignores it.
      await writeQcBand(service, write, encodeQcBandRealtimeHeartRate("start")).catch(
        (err) => console.warn("[vyro] QCBand HR start write failed", err),
      );
      window.setTimeout(() => {
        void writeQcBand(service, write, encodeQcBandRealtimeHeartRate("start")).catch(
          () => undefined,
        );
      }, 1500);
      // Keep-alive: every 8s send a "hold" so the optical sensor doesn't shut off.
      holdTimer = window.setInterval(() => {
        void writeQcBand(service, write, encodeQcBandRealtimeHeartRate("hold")).catch(
          () => undefined,
        );
      }, 8_000);
      // Re-issue "start" every minute as a safety net (some firmwares time out).
      restartTimer = window.setInterval(() => {
        void writeQcBand(service, write, encodeQcBandRealtimeHeartRate("start")).catch(
          () => undefined,
        );
      }, 60_000);

      // Battery: query immediately and every 60s. Response arrives on the
      // same notify char (opcode 0x03).
      const pollBattery = () =>
        void writeQcBand(service, write, encodeQcBandBatteryRequest()).catch(
          () => undefined,
        );
      window.setTimeout(pollBattery, 800);
      batteryTimer = window.setInterval(pollBattery, 60_000);

      // Steps / distance / calories — poll every 30s. We send all three known
      // opcodes (0x09 / 0x07 / 0x15) since different firmwares respond on
      // different ones. The notify handler accepts any of them.
      const pollSteps = () => {
        void writeQcBand(service, write, encodeQcBandStepsRequest()).catch(() => undefined);
        window.setTimeout(() => {
          void writeQcBand(service, write, encodeQcBandStepsRequestAlt1()).catch(() => undefined);
        }, 400);
        window.setTimeout(() => {
          void writeQcBand(service, write, encodeQcBandStepsRequestAlt2()).catch(() => undefined);
        }, 800);
      };
      window.setTimeout(pollSteps, 1_200);
      stepsTimer = window.setInterval(pollSteps, 30_000);

      // SpO₂ standalone cycle — kept as a fallback for firmwares that don't
      // populate the One-Key payload's SpO₂ field. 5-minute cadence.
      const runSpo2Cycle = () => {
        void writeQcBand(service, write, encodeQcBandMeasureStart(QCBAND_MEASURE_SPO2)).catch(() => undefined);
        window.setTimeout(() => {
          void writeQcBand(service, write, encodeQcBandMeasureStop(QCBAND_MEASURE_SPO2)).catch(() => undefined);
        }, 40_000);
      };
      window.setTimeout(runSpo2Cycle, 3_000);
      const spo2Timer = window.setInterval(runSpo2Cycle, 5 * 60_000);

      // Skin temperature — sub-type 0x04. Same 5-min cycle as SpO₂.
      const runTempCycle = () => {
        void writeQcBand(service, write, encodeQcBandMeasureStart(QCBAND_MEASURE_TEMP)).catch(() => undefined);
        window.setTimeout(() => {
          void writeQcBand(service, write, encodeQcBandMeasureStop(QCBAND_MEASURE_TEMP)).catch(() => undefined);
        }, 40_000);
      };
      window.setTimeout(runTempCycle, 6_000);
      tempTimer = window.setInterval(runTempCycle, 5 * 60_000);

      // One-Key Measure — sub-type 0x05. Returns HR + HRV + Stress + SpO₂ +
      // Temp + BP in a single frame. Fire the first one ~30s after connect
      // so the user sees data within ~1 minute of wearing the band, then
      // repeat every 3 minutes.
      const runOneKey = () => {
        console.log("[qcband] one-key measure start");
        void writeQcBand(service, write, encodeQcBandMeasureStart(QCBAND_MEASURE_ONE_KEY)).catch(() => undefined);
        window.setTimeout(() => {
          void writeQcBand(service, write, encodeQcBandMeasureStop(QCBAND_MEASURE_ONE_KEY)).catch(() => undefined);
        }, 50_000);
      };
      window.setTimeout(runOneKey, 30_000);
      oneKeyTimer = window.setInterval(runOneKey, 3 * 60_000);

      // Standalone HRV cycle (sub-type 0x0e) as a fallback for firmwares
      // that ignore the One-Key composite. Slower cadence (10 min).
      const runHrvCycle = () => {
        void writeQcBand(service, write, encodeQcBandMeasureStart(QCBAND_MEASURE_HRV)).catch(() => undefined);
        window.setTimeout(() => {
          void writeQcBand(service, write, encodeQcBandMeasureStop(QCBAND_MEASURE_HRV)).catch(() => undefined);
        }, 60_000);
      };
      window.setTimeout(runHrvCycle, 2 * 60_000);
      const hrvTimer = window.setInterval(runHrvCycle, 10 * 60_000);

      // Standalone Stress cycle (sub-type 0x0d). Some firmwares don't fill
      // the stress slot in One-Key but do respond to a dedicated cycle.
      const runStressCycle = () => {
        void writeQcBand(service, write, encodeQcBandMeasureStart(QCBAND_MEASURE_STRESS)).catch(() => undefined);
        window.setTimeout(() => {
          void writeQcBand(service, write, encodeQcBandMeasureStop(QCBAND_MEASURE_STRESS)).catch(() => undefined);
        }, 60_000);
      };
      window.setTimeout(runStressCycle, 90_000);
      const stressTimer = window.setInterval(runStressCycle, 10 * 60_000);

      // Stash extra timers we created locally onto the outer refs via closure.
      const stop = () => {
        window.clearInterval(spo2Timer);
        window.clearInterval(hrvTimer);
        window.clearInterval(stressTimer);
      };
      cleanupExtras = stop;
    }
    let cleanupExtras: (() => void) | null = null;

    const off = bluetooth.on("discovered", (tree: BleDiscovered) => {
      if (tree.id !== connectedId) return;
      for (const svc of tree.services) {
        if (uuidMatches(svc.uuid, QCBAND_SERVICE_UUID)) {
          const notify = svc.characteristics.find((c) =>
            uuidMatches(c.uuid, QCBAND_NOTIFY_CHAR_UUID),
          );
          const write = svc.characteristics.find((c) =>
            uuidMatches(c.uuid, QCBAND_WRITE_CHAR_UUID),
          );
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
            void bluetooth.subscribe(connectedId, svc.uuid, ch.uuid).catch(() => undefined);
          }
        }
      }
    });
    void bluetooth.discover(connectedId).catch(() => undefined);

    // Defensive fallback: many bridges don't emit `discovered` reliably on iOS.
    // After a short delay, attempt to start QCBand live HR using the canonical
    // UUIDs directly. If the device doesn't have the service the writes will
    // just fail silently — but if it does, the user gets live HR without
    // depending on the discovery event.
    const fallback = window.setTimeout(() => {
      if (qcBandStarted || cancelled) return;
      void startQcBandLiveHr(
        QCBAND_SERVICE_UUID,
        QCBAND_NOTIFY_CHAR_UUID,
        QCBAND_WRITE_CHAR_UUID,
      ).catch(() => undefined);
    }, 2_000);

    return () => {
      cancelled = true;
      off();
      window.clearTimeout(fallback);
      if (holdTimer != null) window.clearInterval(holdTimer);
      if (restartTimer != null) window.clearInterval(restartTimer);
      if (batteryTimer != null) window.clearInterval(batteryTimer);
      if (stepsTimer != null) window.clearInterval(stepsTimer);
      if (oneKeyTimer != null) window.clearInterval(oneKeyTimer);
      if (tempTimer != null) window.clearInterval(tempTimer);
      cleanupExtras?.();
      if (qcBandService) {
        void writeQcBand(
          qcBandService.service,
          qcBandService.write,
          encodeQcBandRealtimeHeartRate("end"),
        ).catch(() => undefined);
        for (const st of [QCBAND_MEASURE_SPO2, QCBAND_MEASURE_TEMP, QCBAND_MEASURE_HRV, QCBAND_MEASURE_ONE_KEY]) {
          void writeQcBand(qcBandService.service, qcBandService.write, encodeQcBandMeasureStop(st)).catch(() => undefined);
        }
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
      const bytes = payloadToBytes(lastData.value);
      const op = bytes[0];
      console.log("[qcband] notify op=0x" + op.toString(16).padStart(2, "0"), bytesToHex(bytes));
      if (op === QCBAND_CMD_REALTIME_HR) {
        const bpm = decodeQcBandRealtimeHeartRate(bytes);
        if (bpm != null) {
          setHeartRateBpm(bpm);
          setHeartRateAt(Date.now());
        }
      } else if (op === QCBAND_CMD_BATTERY) {
        const bat = decodeQcBandBattery(bytes);
        if (bat) {
          setBatteryPct(bat.level);
          setBatteryCharging(bat.charging);
        }
      } else if (
        op === QCBAND_CMD_TODAY_SUMMARY ||
        op === QCBAND_CMD_STEPS_ALT1 ||
        op === QCBAND_CMD_STEPS_ALT2
      ) {
        const sum = decodeQcBandTodaySummary(bytes);
        if (sum) {
          setStepsToday(sum.steps);
          setDistanceM(sum.distanceM);
          setCaloriesKcal(sum.calories);
        }
      } else if (op === QCBAND_CMD_START_MEASURE) {
        const frame = decodeQcBandMeasureFrame(bytes);
        if (!frame || frame.errorCode !== 0) return;
        if (frame.subType === QCBAND_MEASURE_SPO2) {
          if (frame.value >= 70 && frame.value <= 100) setSpo2Pct(frame.value);
        } else if (frame.subType === QCBAND_MEASURE_HR) {
          if (frame.value > 30 && frame.value < 250) {
            setHeartRateBpm(frame.value);
            setHeartRateAt(Date.now());
          }
        } else if (frame.subType === QCBAND_MEASURE_TEMP) {
          const t = decodeQcBandTempPayload(frame.data);
          if (t != null) setSkinTempC(t);
        } else if (frame.subType === QCBAND_MEASURE_HRV) {
          if (frame.value > 0 && frame.value < 250) setHrvMs(frame.value);
        } else if (frame.subType === QCBAND_MEASURE_STRESS) {
          if (frame.value > 0 && frame.value <= 100) setStressScore(frame.value);
        } else if (frame.subType === QCBAND_MEASURE_ONE_KEY) {
          const ok = decodeQcBandOneKeyPayload(frame.data);
          if (ok) {
            if (ok.hr != null) {
              setHeartRateBpm(ok.hr);
              setHeartRateAt(Date.now());
            }
            if (ok.spo2 != null) setSpo2Pct(ok.spo2);
            if (ok.tempC != null) setSkinTempC(ok.tempC);
            if (ok.hrvMs != null) setHrvMs(ok.hrvMs);
            if (ok.stress != null) setStressScore(ok.stress);
            if (ok.sbp != null && ok.dbp != null) setBloodPressure({ sbp: ok.sbp, dbp: ok.dbp });
            // Respiratory rate is not in the one-key payload — leave it
            // null until the firmware adds it (it's a separate sub-type).
          }
        }
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
    batteryCharging,
    spo2Pct,
    skinTempC,
    stepsToday,
    distanceM,
    caloriesKcal,
    bloodPressure,
    restingHrBpm,
    hrvMs,
    respRateBrpm,
    stressScore,
  };
}
