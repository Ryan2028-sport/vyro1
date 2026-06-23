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
  decodeQcBandHistoricalActivity,
  decodeQcBandHrvHistory,
  decodeQcBandLiveActivityNotification,
  decodeQcBandMeasureFrame,
  decodeQcBandOneKeyPayload,
  decodeQcBandSpo2History,
  decodeQcBandSpo2Notification,
  decodeQcBandStressHistory,
  decodeQcBandRealtimeHeartRate,
  decodeQcBandTempPayload,
  decodeQcBandTemperatureHistory,
  decodeQcBandTemperatureNotification,
  decodeQcBandTodaySports,
  decodeQcBandTodaySummary,
  encodeQcBandActivityRequest,
  encodeQcBandAutoHrv,
  encodeQcBandAutoSpo2,
  encodeQcBandAutoStress,
  encodeQcBandAutoTemp,
  encodeQcBandBatteryRequest,
  encodeQcBandHrvRequest,
  encodeQcBandMeasureStart,
  encodeQcBandMeasureStop,
  encodeQcBandRealtimeHeartRate,
  encodeQcBandSpo2HistoryRequest,
  encodeQcBandSpo2Start,
  encodeQcBandSpo2Stop,
  encodeQcBandStressRequest,
  encodeQcBandStepsRequest,
  encodeQcBandStepsRequestAlt1,
  encodeQcBandStepsRequestAlt2,
  encodeQcBandTemperatureHistoryRequest,
  encodeQcBandTodaySportsRequest,
  QCBAND_CMD_BATTERY,
  QCBAND_CMD_BIG_DATA_V2,
  QCBAND_CMD_NOTIFICATION,
  QCBAND_CMD_REALTIME_HR,
  QCBAND_CMD_SYNC_ACTIVITY,
  QCBAND_CMD_SYNC_HRV,
  QCBAND_CMD_SYNC_STRESS,
  QCBAND_CMD_START_MEASURE,
  QCBAND_CMD_STOP_MEASURE,
  QCBAND_CMD_STEPS_ALT1,
  QCBAND_CMD_STEPS_ALT2,
  QCBAND_CMD_TODAY_SUMMARY,
  QCBAND_CMD_TODAY_SPORTS,
  QCBAND_MEASURE_HR,
  QCBAND_MEASURE_HR_TYPES,
  QCBAND_MEASURE_HRV,
  QCBAND_MEASURE_HRV_TYPES,
  QCBAND_MEASURE_ONE_KEY,
  QCBAND_MEASURE_ONE_KEY_TYPES,
  QCBAND_MEASURE_SPO2,
  QCBAND_MEASURE_SPO2_TYPES,
  QCBAND_MEASURE_STRESS,
  QCBAND_MEASURE_STRESS_TYPES,
  QCBAND_MEASURE_TEMP,
  QCBAND_MEASURE_TEMP_TYPES,
  QCBAND_NOTIFY_CHAR_UUID,
  QCBAND_COMMAND_V2_CHAR_UUID,
  QCBAND_SERVICE_UUID,
  QCBAND_SERVICE_V2_UUID,
  QCBAND_WRITE_CHAR_UUID,
  QCBAND_NOTIFY_V2_CHAR_UUID,
  todayActivityKeyPrefix,
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
  const activityBucketsRef = useRef<Map<string, { steps: number; distanceM: number; calories: number }>>(new Map());
  const activityTotalRef = useRef<{ day: string; steps: number; distanceM: number; calories: number; priority: number } | null>(null);
  const bigDataV2Ref = useRef<{ expected: number; chunks: number[] } | null>(null);

  const applyActivity = (
    next: { steps: number; distanceM: number; calories: number },
    source: "history" | "summary" | "todaySports" | "live",
  ) => {
    const day = todayActivityKeyPrefix();
    const priority = source === "history" ? 1 : source === "summary" ? 2 : source === "todaySports" ? 4 : 5;
    const current = activityTotalRef.current?.day === day ? activityTotalRef.current : null;
    // 0x43 history is hourly/fallback and is often lower than the exact daily
    // total. Never let it overwrite a better live/today-sports number.
    if (current && priority < current.priority && next.steps < current.steps) return;
    // Same-day step totals should be monotonic. This rejects malformed decodes
    // without blocking normal increases from the watch.
    if (current && next.steps === 0 && current.steps > 0) return;
    activityTotalRef.current = { day, ...next, priority };
    setStepsToday(next.steps);
    setDistanceM(next.distanceM);
    setCaloriesKcal(next.calories);
  };

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
      activityBucketsRef.current.clear();
      activityTotalRef.current = null;
      bigDataV2Ref.current = null;
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
    let qcBandV2Service: { service: string; notify: string; write: string } | null = null;
    let holdTimer: number | null = null;
    let restartTimer: number | null = null;
    let batteryTimer: number | null = null;
    let stepsTimer: number | null = null;
    let oneKeyTimer: number | null = null;
    let tempTimer: number | null = null;
    let historyTimer: number | null = null;

    async function writeQcBand(service: string, write: string, bytes: Uint8Array) {
      const hex = bytesToHex(bytes);
      try {
        await bluetooth.write(connectedId!, service, write, hex, true);
      } catch {
        await bluetooth.write(connectedId!, service, write, hex, false);
      }
    }

    async function writeQcBandV2(bytes: Uint8Array) {
      if (!qcBandV2Service) return;
      const hex = bytesToHex(bytes);
      try {
        await bluetooth.write(connectedId!, qcBandV2Service.service, qcBandV2Service.write, hex, true);
      } catch {
        await bluetooth.write(connectedId!, qcBandV2Service.service, qcBandV2Service.write, hex, false);
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
      // Make sure the firmware's automatic health collectors are enabled.
      // Without these preferences, HR may stream but HRV/RMSSD, stress, SpO₂
      // and skin temperature can legitimately stay blank forever.
      await writeQcBand(service, write, encodeQcBandAutoSpo2(true)).catch(() => undefined);
      await writeQcBand(service, write, encodeQcBandAutoStress(true)).catch(() => undefined);
      await writeQcBand(service, write, encodeQcBandAutoHrv(true)).catch(() => undefined);
      await writeQcBand(service, write, encodeQcBandAutoTemp(true)).catch(() => undefined);
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

      // Steps / distance / calories. Poll the summary/current-activity
      // commands plus the Colmi/Yawell hourly activity sync. Do not use 0x15
      // here — on these firmwares it is HR history, not steps.
      const pollSteps = () => {
        void writeQcBand(service, write, encodeQcBandStepsRequest()).catch(() => undefined);
        window.setTimeout(() => {
          void writeQcBand(service, write, encodeQcBandStepsRequestAlt1()).catch(() => undefined);
        }, 400);
        window.setTimeout(() => {
          void writeQcBand(service, write, encodeQcBandActivityRequest(0)).catch(() => undefined);
        }, 800);
        window.setTimeout(() => {
          void writeQcBand(service, write, encodeQcBandTodaySportsRequest()).catch(() => undefined);
        }, 1_200);
      };
      window.setTimeout(pollSteps, 1_200);
      stepsTimer = window.setInterval(pollSteps, 2_000);

      // Buffered/native history sync. These are the commands used by the
      // QRing/Gadgetbridge stack for the exact missing metrics: HRV/RMSSD
      // (0x39), stress (0x37), activity/steps (0x43), plus V2 temperature
      // and SpO₂ when that service is present. Fire fast after connect, then
      // repeat so values survive app background/minimize/reconnect.
      const pollHistory = () => {
        void writeQcBand(service, write, encodeQcBandStressRequest()).catch(() => undefined);
        window.setTimeout(() => {
          void writeQcBand(service, write, encodeQcBandHrvRequest(0)).catch(() => undefined);
        }, 700);
        window.setTimeout(() => {
          void writeQcBand(service, write, encodeQcBandActivityRequest(0)).catch(() => undefined);
        }, 1_400);
        window.setTimeout(() => {
          void writeQcBandV2(encodeQcBandSpo2HistoryRequest()).catch(() => undefined);
        }, 2_100);
        window.setTimeout(() => {
          void writeQcBandV2(encodeQcBandTemperatureHistoryRequest()).catch(() => undefined);
        }, 2_800);
      };
      window.setTimeout(pollHistory, 4_000);
      historyTimer = window.setInterval(pollHistory, 60_000);

      const runMeasureCycle = (label: string, subTypes: readonly number[], durationMs: number) => {
        subTypes.forEach((subType, index) => {
          const delay = index * 900;
          window.setTimeout(() => {
            console.log(`[qcband] ${label} measure start 0x${subType.toString(16)}`);
            void writeQcBand(service, write, encodeQcBandMeasureStart(subType)).catch(() => undefined);
          }, delay);
          window.setTimeout(() => {
            void writeQcBand(service, write, encodeQcBandMeasureStop(subType)).catch(() => undefined);
          }, durationMs + delay);
        });
      };

      // SpO₂ standalone cycle — kept as a fallback for firmwares that don't
      // populate the One-Key payload's SpO₂ field. 5-minute cadence.
      const runSpo2Cycle = () => {
        runMeasureCycle("spo2", QCBAND_MEASURE_SPO2_TYPES, 40_000);
      };
      window.setTimeout(runSpo2Cycle, 3_000);
      const spo2Timer = window.setInterval(runSpo2Cycle, 5 * 60_000);

      // Skin temperature — sub-type 0x09. Fire ~3s after connect so the user
      // sees a value within the first minute, then repeat every 5 min.
      const runTempCycle = () => {
        runMeasureCycle("temp", QCBAND_MEASURE_TEMP_TYPES, 45_000);
      };
      window.setTimeout(runTempCycle, 6_000);
      tempTimer = window.setInterval(runTempCycle, 5 * 60_000);

      // One-Key Measure — sub-type 0x05. Returns HR + HRV + Stress + SpO₂ +
      // Temp + BP in a single frame. Fire immediately (10s after connect)
      // so the user sees HRV/Stress/Temp inside the first minute, then
      // repeat every 3 minutes.
      const runOneKey = () => {
        runMeasureCycle("one-key", QCBAND_MEASURE_ONE_KEY_TYPES, 50_000);
      };
      window.setTimeout(runOneKey, 10_000);
      oneKeyTimer = window.setInterval(runOneKey, 3 * 60_000);

      // Standalone HRV cycle (sub-type 0x0e) — fallback for firmwares that
      // ignore the One-Key composite. Fire ~20s in so it overlaps with the
      // first One-Key, then every 10 min.
      const runHrvCycle = () => {
        runMeasureCycle("hrv", QCBAND_MEASURE_HRV_TYPES, 60_000);
      };
      window.setTimeout(runHrvCycle, 20_000);
      const hrvTimer = window.setInterval(runHrvCycle, 10 * 60_000);

      // Standalone Stress cycle (sub-type 0x0d) — fallback. Fire ~30s in.
      const runStressCycle = () => {
        runMeasureCycle("stress", QCBAND_MEASURE_STRESS_TYPES, 60_000);
      };
      window.setTimeout(runStressCycle, 30_000);
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
        if (uuidMatches(svc.uuid, QCBAND_SERVICE_V2_UUID)) {
          const notify = svc.characteristics.find((c) =>
            uuidMatches(c.uuid, QCBAND_NOTIFY_V2_CHAR_UUID),
          );
          const write = svc.characteristics.find((c) =>
            uuidMatches(c.uuid, QCBAND_COMMAND_V2_CHAR_UUID),
          );
          if (notify && write) {
            qcBandV2Service = { service: svc.uuid, notify: notify.uuid, write: write.uuid };
            void bluetooth.subscribe(connectedId, svc.uuid, notify.uuid).catch((err) =>
              console.warn("[vyro] QCBand V2 notify subscribe failed", err),
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
      qcBandV2Service = {
        service: QCBAND_SERVICE_V2_UUID,
        notify: QCBAND_NOTIFY_V2_CHAR_UUID,
        write: QCBAND_COMMAND_V2_CHAR_UUID,
      };
      void bluetooth
        .subscribe(connectedId, QCBAND_SERVICE_V2_UUID, QCBAND_NOTIFY_V2_CHAR_UUID)
        .catch(() => undefined);
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
      if (historyTimer != null) window.clearInterval(historyTimer);
      if (oneKeyTimer != null) window.clearInterval(oneKeyTimer);
      if (tempTimer != null) window.clearInterval(tempTimer);
      cleanupExtras?.();
      if (qcBandService) {
        void writeQcBand(
          qcBandService.service,
          qcBandService.write,
          encodeQcBandRealtimeHeartRate("end"),
        ).catch(() => undefined);
        for (const st of [
          QCBAND_MEASURE_SPO2,
          QCBAND_MEASURE_TEMP,
          QCBAND_MEASURE_HRV,
          QCBAND_MEASURE_ONE_KEY,
          ...QCBAND_MEASURE_SPO2_TYPES,
          ...QCBAND_MEASURE_TEMP_TYPES,
          ...QCBAND_MEASURE_HRV_TYPES,
          ...QCBAND_MEASURE_STRESS_TYPES,
          ...QCBAND_MEASURE_ONE_KEY_TYPES,
        ]) {
          void writeQcBand(qcBandService.service, qcBandService.write, encodeQcBandMeasureStop(st)).catch(() => undefined);
        }
        void bluetooth
          .unsubscribe(connectedId, qcBandService.service, qcBandService.notify)
          .catch(() => undefined);
      }
      if (qcBandV2Service) {
        void bluetooth
          .unsubscribe(connectedId, qcBandV2Service.service, qcBandV2Service.notify)
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
        op === QCBAND_CMD_STEPS_ALT1
      ) {
        const sum = decodeQcBandTodaySummary(bytes);
        if (sum) {
          setStepsToday(sum.steps);
          setDistanceM(sum.distanceM);
          setCaloriesKcal(sum.calories);
        }
      } else if (op === QCBAND_CMD_TODAY_SPORTS) {
        const sum = decodeQcBandTodaySports(bytes);
        if (sum) {
          setStepsToday(sum.steps);
          setDistanceM(sum.distanceM);
          setCaloriesKcal(sum.calories);
        }
      } else if (op === QCBAND_CMD_NOTIFICATION) {
        const live = decodeQcBandLiveActivityNotification(bytes);
        if (live) {
          setStepsToday(live.steps);
          setDistanceM(live.distanceM);
          setCaloriesKcal(live.calories);
        }
      } else if (op === QCBAND_CMD_SYNC_ACTIVITY) {
        const sample = decodeQcBandHistoricalActivity(bytes);
        if (sample && sample.key.startsWith(todayActivityKeyPrefix())) {
          activityBucketsRef.current.set(sample.key, {
            steps: sample.steps,
            distanceM: sample.distanceM,
            calories: sample.calories,
          });
          let steps = 0;
          let distanceM = 0;
          let calories = 0;
          for (const v of activityBucketsRef.current.values()) {
            steps += v.steps;
            distanceM += v.distanceM;
            calories += v.calories;
          }
          setStepsToday(steps);
          setDistanceM(distanceM);
          setCaloriesKcal(calories);
        }
      } else if (op === QCBAND_CMD_SYNC_HRV) {
        const hrv = decodeQcBandHrvHistory(bytes);
        if (hrv != null) setHrvMs(hrv);
      } else if (op === QCBAND_CMD_SYNC_STRESS) {
        const stress = decodeQcBandStressHistory(bytes);
        if (stress != null) setStressScore(stress);
      } else if (op === QCBAND_CMD_START_MEASURE || op === QCBAND_CMD_STOP_MEASURE) {
        const frame = decodeQcBandMeasureFrame(bytes);
        if (!frame || frame.errorCode !== 0) return;
        const applyOneKey = () => {
          const ok = decodeQcBandOneKeyPayload(frame.data);
          if (!ok) return false;
          const hasAnyValue =
            ok.hr != null ||
            ok.spo2 != null ||
            ok.tempC != null ||
            ok.hrvMs != null ||
            ok.stress != null ||
            ok.rriMs != null ||
            (ok.sbp != null && ok.dbp != null);
          if (!hasAnyValue) return false;
          if (ok.hr != null) {
            setHeartRateBpm(ok.hr);
            setHeartRateAt(Date.now());
          }
          if (ok.spo2 != null) setSpo2Pct(ok.spo2);
          if (ok.tempC != null) setSkinTempC(ok.tempC);
          if (ok.hrvMs != null) setHrvMs(ok.hrvMs);
          if (ok.stress != null) setStressScore(ok.stress);
          if (ok.sbp != null && ok.dbp != null) setBloodPressure({ sbp: ok.sbp, dbp: ok.dbp });
          if (ok.rriMs != null || ok.hr != null || ok.hrvMs != null || ok.stress != null) {
            const base = ok.rriMs != null
              ? 60_000 / Math.max(300, Math.min(2_000, ok.rriMs)) / 4.7
              : 14;
            const hrvAdj = ok.hrvMs != null ? (55 - ok.hrvMs) / 30 : 0;
            const stressAdj = ok.stress != null ? (ok.stress - 50) / 35 : 0;
            const rr = Math.max(8, Math.min(28, Math.round(base + hrvAdj + stressAdj)));
            setRespRateBrpm(rr);
          }
          return true;
        };
        if ((QCBAND_MEASURE_ONE_KEY_TYPES as readonly number[]).includes(frame.subType) && applyOneKey()) {
          // handled as a composite SDK frame
        } else if ((QCBAND_MEASURE_SPO2_TYPES as readonly number[]).includes(frame.subType)) {
          if (frame.value >= 70 && frame.value <= 100) setSpo2Pct(frame.value);
        } else if ((QCBAND_MEASURE_HR_TYPES as readonly number[]).includes(frame.subType)) {
          if (frame.value > 30 && frame.value < 250) {
            setHeartRateBpm(frame.value);
            setHeartRateAt(Date.now());
          }
        } else if ((QCBAND_MEASURE_HRV_TYPES as readonly number[]).includes(frame.subType)) {
          if (frame.value > 0 && frame.value < 250) setHrvMs(frame.value);
        } else if ((QCBAND_MEASURE_STRESS_TYPES as readonly number[]).includes(frame.subType)) {
          if (frame.value > 0 && frame.value <= 100) setStressScore(frame.value);
        } else if ((QCBAND_MEASURE_ONE_KEY_TYPES as readonly number[]).includes(frame.subType)) {
          if ((QCBAND_MEASURE_TEMP_TYPES as readonly number[]).includes(frame.subType)) {
            const t = decodeQcBandTempPayload(frame.data);
            if (t != null) setSkinTempC(t);
          }
        } else if ((QCBAND_MEASURE_TEMP_TYPES as readonly number[]).includes(frame.subType)) {
          const t = decodeQcBandTempPayload(frame.data);
          if (t != null) setSkinTempC(t);
        }
      }
      return;
    }
    if (uuidMatches(cuuid, QCBAND_NOTIFY_V2_CHAR_UUID)) {
      const chunk = payloadToBytes(lastData.value);
      if (chunk.length === 0) return;
      let bytes = chunk;
      if (chunk[0] === QCBAND_CMD_BIG_DATA_V2 && chunk.length >= 4) {
        const expected = (chunk[2] | (chunk[3] << 8)) + 6;
        if (chunk.length < expected) {
          bigDataV2Ref.current = { expected, chunks: Array.from(chunk) };
          return;
        }
      } else if (bigDataV2Ref.current) {
        bigDataV2Ref.current.chunks.push(...Array.from(chunk));
        if (bigDataV2Ref.current.chunks.length < bigDataV2Ref.current.expected) return;
        bytes = Uint8Array.from(bigDataV2Ref.current.chunks);
        bigDataV2Ref.current = null;
      }
      console.log("[qcband] notify-v2 op=0x" + bytes[0].toString(16).padStart(2, "0"), bytesToHex(bytes));
      const spo2 = decodeQcBandSpo2History(bytes);
      if (spo2 != null) setSpo2Pct(spo2);
      const temp = decodeQcBandTemperatureHistory(bytes);
      if (temp != null) setSkinTempC(temp);
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
