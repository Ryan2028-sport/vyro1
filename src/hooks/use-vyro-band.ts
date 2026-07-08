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
  decodeQcBandBloodPressurePayload,
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
  encodeQcBandHeartRateLogging,
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
  encodeQcBandSetTime,
  encodeQcBandSpo2HistoryRequest,
  encodeQcBandSpo2IntervalHistoryRequest,
  encodeQcBandSpo2Start,
  encodeQcBandSpo2Stop,
  encodeQcBandStressRequest,
  encodeQcBandStepsRequest,
  encodeQcBandStepsRequestAlt1,
  encodeQcBandStepsRequestAlt2,
  encodeQcBandTemperatureHistoryRequest,
  encodeQcBandTemperatureLegacyHistoryRequest,
  encodeQcBandTemperatureManualHistoryRequest,
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
  QCBAND_MEASURE_BP_TYPES,
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
import { recordSleepNight, type SleepNight } from "@/lib/use-sleep-nights";
import { tapDecoded, getDecodedSnapshot } from "@/lib/vyro-ble/decoder-tap";

import { bluetooth, isNative, type BleDataEvent, type BleDiscovered } from "@/lib/despia";

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
// Standard Device Information Service (DIS). We read these to surface the
// current firmware/hardware/serial on the Debug + Band panels and drive the
// "firmware update available" check in BandPanel.
const DIS_SERVICE = "0000180a-0000-1000-8000-00805f9b34fb";
const DIS_FIRMWARE_REV_CHAR = "00002a26-0000-1000-8000-00805f9b34fb";
const DIS_HARDWARE_REV_CHAR = "00002a27-0000-1000-8000-00805f9b34fb";
const DIS_SERIAL_NUM_CHAR = "00002a25-0000-1000-8000-00805f9b34fb";

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
  const trimmed = value.trim();
  const withoutPrefix = trimmed.replace(/^0x/i, "");
  const looksHex =
    withoutPrefix.length >= 2 &&
    /^[0-9a-fA-F\s:,-]+$/.test(withoutPrefix) &&
    withoutPrefix.replace(/[^0-9a-fA-F]/g, "").length % 2 === 0;
  if (looksHex) return hexToBytes(withoutPrefix);
  try {
    const raw = atob(value);
    return Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
  } catch {
    return hexToBytes(value);
  }
}

const PERSISTED_METRICS_KEY = "vyro.band.liveMetrics.v1";
const PERSISTED_METRICS_MAX_AGE_MS = 24 * 60 * 60_000;

type PersistedBandMetrics = {
  savedAt: number;
  day: string;
  heartRateBpm: number | null;
  heartRateAt: number | null;
  batteryPct: number | null;
  batteryCharging: boolean;
  spo2Pct: number | null;
  skinTempC: number | null;
  stepsToday: number | null;
  distanceM: number | null;
  caloriesKcal: number | null;
  restingHrBpm: number | null;
  hrvMs: number | null;
  respRateBrpm: number | null;
  stressScore: number | null;
  bloodPressure: { sbp: number; dbp: number } | null;
};

export type VyroBandSignalTimestamps = {
  batteryAt: number | null;
  spo2At: number | null;
  skinTempAt: number | null;
  stepsAt: number | null;
  distanceAt: number | null;
  caloriesAt: number | null;
  restingHrAt: number | null;
  hrvAt: number | null;
  stressAt: number | null;
  bloodPressureAt: number | null;
};

const emptySignalTimestamps = (): VyroBandSignalTimestamps => ({
  batteryAt: null,
  spo2At: null,
  skinTempAt: null,
  stepsAt: null,
  distanceAt: null,
  caloriesAt: null,
  restingHrAt: null,
  hrvAt: null,
  stressAt: null,
  bloodPressureAt: null,
});

function numericInRange(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

function loadPersistedBandMetrics(): Partial<PersistedBandMetrics> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(PERSISTED_METRICS_KEY);
    if (!raw) return {};
    const saved = JSON.parse(raw) as Partial<PersistedBandMetrics>;
    const savedAt = numericInRange(saved.savedAt, 1, Date.now() + 60_000);
    if (!savedAt || Date.now() - savedAt > PERSISTED_METRICS_MAX_AGE_MS) return {};
    const sameDay = saved.day === todayActivityKeyPrefix();
    // Push-only metrics (skinTemp, HRV, stress, BP) are intentionally NOT
    // rehydrated from localStorage. If the watch firmware does not actively
    // emit a real frame for them, the tile must stay grey rather than
    // showing a stale value from a previous session and making the debug
    // pipeline lie about "stored ✓". HR / SpO₂ / steps / battery are still
    // rehydrated because they have proven dedicated decoder paths.
    void saved.bloodPressure;
    return {
      savedAt,
      day: sameDay ? todayActivityKeyPrefix() : saved.day,
      heartRateBpm: numericInRange(saved.heartRateBpm, 30, 250),
      heartRateAt: numericInRange(saved.heartRateAt, Date.now() - PERSISTED_METRICS_MAX_AGE_MS, Date.now() + 60_000),
      batteryPct: numericInRange(saved.batteryPct, 0, 100),
      batteryCharging: saved.batteryCharging === true,
      spo2Pct: numericInRange(saved.spo2Pct, 70, 100),
      skinTempC: null,
      stepsToday: sameDay ? numericInRange(saved.stepsToday, 0, 200_000) : null,
      distanceM: sameDay ? numericInRange(saved.distanceM, 0, 250_000) : null,
      caloriesKcal: sameDay ? numericInRange(saved.caloriesKcal, 0, 20_000) : null,
      restingHrBpm: numericInRange(saved.restingHrBpm, 30, 120),
      hrvMs: null,
      respRateBrpm: null,
      stressScore: null,
      bloodPressure: null,
    };
  } catch {
    return {};
  }
}

function persistBandMetrics(metrics: PersistedBandMetrics) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PERSISTED_METRICS_KEY, JSON.stringify(metrics));
  } catch {
    // Storage can be unavailable in private mode or during native app suspend.
  }
}

function shouldKeepNativeBleAliveOnCleanup(): boolean {
  return isNative && typeof document !== "undefined" && document.visibilityState === "hidden";
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

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

type SleepDerivedSample = { t: number; hr?: number; hrv?: number; tempC?: number };

const SLEEP_SAMPLE_KEY = "vyro.sleep.samples.v1";
const SLEEP_SAMPLE_MAX = 2880;
const SLEEP_WINDOW_MS = 12 * 60 * 60_000;
const SLEEP_NIGHT_HOURS = new Set([22, 23, 0, 1, 2, 3, 4, 5, 6, 7]);

function loadSleepSamples(): SleepDerivedSample[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SLEEP_SAMPLE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSleepSamples(samples: SleepDerivedSample[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SLEEP_SAMPLE_KEY, JSON.stringify(samples.slice(-SLEEP_SAMPLE_MAX)));
  } catch {
    /* storage unavailable */
  }
}

function avg(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function buildSleepNightFromSamples(samples: SleepDerivedSample[], now = Date.now()): SleepNight | null {
  const cutoff = now - SLEEP_WINDOW_MS;
  const overnight = samples.filter((s) => s.t >= cutoff && SLEEP_NIGHT_HOURS.has(new Date(s.t).getHours()));
  if (overnight.length < 3) return null;

  const hrs = overnight.map((s) => s.hr).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const hrvs = overnight.map((s) => s.hrv).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const temps = overnight.map((s) => s.tempC).filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const parts: Array<{ v: number; w: number }> = [];
  if (hrs.length >= 3) {
    parts.push({ v: clampScore(((75 - Math.min(...hrs)) / 35) * 100), w: 0.45 });
  }
  if (hrvs.length >= 3) {
    parts.push({ v: clampScore((((avg(hrvs) as number) - 20) / 60) * 100), w: 0.4 });
  }
  if (temps.length >= 3) {
    const mean = avg(temps) as number;
    const sd = Math.sqrt(temps.reduce((a, b) => a + (b - mean) ** 2, 0) / temps.length);
    parts.push({ v: clampScore((1 - Math.min(sd, 2) / 2) * 100), w: 0.15 });
  }
  if (!parts.length) return null;

  const score = clampScore(parts.reduce((a, b) => a + b.v * b.w, 0) / parts.reduce((a, b) => a + b.w, 0));
  const first = overnight[0].t;
  const last = overnight[overnight.length - 1].t;
  const spanMin = Math.max(0, Math.round((last - first) / 60_000));
  const sampledMin = Math.round(overnight.length * 0.5);
  const asleepMin = Math.max(1, Math.min(10 * 60, spanMin > 20 ? spanMin : sampledMin));
  const awake = Math.max(0, Math.round(asleepMin * (score < 55 ? 0.12 : 0.05)));
  const deep = Math.round(asleepMin * (score >= 75 ? 0.26 : 0.18));
  const rem = Math.round(asleepMin * (score >= 70 ? 0.22 : 0.16));
  const light = Math.max(0, asleepMin - deep - rem);

  return {
    endAt: new Date(last).toISOString(),
    score,
    asleepMin,
    inBedMin: asleepMin + awake,
    wakeups: awake > 0 ? Math.max(1, Math.round(awake / 8)) : 0,
    stages: { awake, light, deep, rem },
    debtMin: Math.max(0, 8 * 60 - asleepMin),
  };
}

export function useVyroBand() {
  const ble = useBluetooth();
  const { connectedId } = ble;
  const [events, setEvents] = useState<VyroEventEntry[]>([]);
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [sport, setSport] = useState<Sport>("squash");
  // Never hydrate UI-facing live body signals from localStorage. Persisted
  // values are kept only as a debug/reconnect cache; tiles must repopulate
  // from fresh watch frames after connect.
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
  const [signalAt, setSignalAt] = useState<VyroBandSignalTimestamps>(() => emptySignalTimestamps());
  const hrSamplesRef = useRef<{ t: number; bpm: number }[]>([]);
  const activeConnectionRef = useRef<string | null>(null);
  const activityBucketsRef = useRef<Map<string, { steps: number; distanceM: number; calories: number }>>(new Map());
  const activityTotalRef = useRef<{ day: string; steps: number; distanceM: number; calories: number; priority: number } | null>(null);
  const bigDataV2Ref = useRef<{ expected: number; chunks: number[] } | null>(null);
  const rawMotionByOpRef = useRef<Map<number, Uint8Array>>(new Map());
  const rawMotionLastEventAtRef = useRef(0);
  const sleepSamplesRef = useRef<SleepDerivedSample[]>(loadSleepSamples());
  const lastSleepSampleAtRef = useRef(0);

  const markSignal = (key: keyof VyroBandSignalTimestamps, at = Date.now()) => {
    setSignalAt((prev) => ({ ...prev, [key]: at }));
  };

  const applyActivity = (
    next: { steps: number; distanceM: number; calories: number },
    source: "history" | "summary" | "todaySports" | "live",
  ) => {
    const day = todayActivityKeyPrefix();
    const priority = source === "history" ? 1 : source === "summary" ? 2 : source === "live" ? 5 : 6;
    const current = activityTotalRef.current?.day === day ? activityTotalRef.current : null;
    // 0x43 history is hourly/fallback and is often lower than the exact daily
    // total. Never let it overwrite a better live/today-sports number.
    if (current && priority < current.priority) {
      const now = Date.now();
      markSignal("stepsAt", now);
      markSignal("distanceAt", now);
      markSignal("caloriesAt", now);
      return;
    }
    // Same-day step totals should be monotonic. This rejects malformed decodes
    // without blocking normal increases from the watch.
    if (current && next.steps < current.steps) {
      const now = Date.now();
      markSignal("stepsAt", now);
      markSignal("distanceAt", now);
      markSignal("caloriesAt", now);
      return;
    }
    if (current && next.steps === 0 && current.steps > 0) {
      const now = Date.now();
      markSignal("stepsAt", now);
      markSignal("distanceAt", now);
      markSignal("caloriesAt", now);
      return;
    }
    const merged = {
      steps: next.steps,
      distanceM: next.distanceM > 0 ? next.distanceM : current?.distanceM ?? 0,
      calories: next.calories > 0 ? next.calories : current?.calories ?? 0,
    };
    activityTotalRef.current = { day, ...merged, priority };
    setStepsToday(merged.steps);
    setDistanceM(merged.distanceM);
    setCaloriesKcal(merged.calories);
    const now = Date.now();
    markSignal("stepsAt", now);
    markSignal("distanceAt", now);
    markSignal("caloriesAt", now);
    tapDecoded("steps", merged.steps);
    tapDecoded("distance", merged.distanceM);
    tapDecoded("calories", merged.calories);
  };

  const ingestRawMotionSignal = (bytes: Uint8Array) => {
    const op = bytes[0] & 0xff;
    // Some firmware builds do not expose the VYRO IMU characteristic. The
    // calibration tool already uses raw QCBand 0x69/0x73/0x87/0x89 packet
    // movement as the fallback motion source; mirror that here so sport/load
    // tiles are driven by real watch traffic instead of staying grey forever.
    if (op !== 0x69 && op !== 0x73 && op !== 0x87 && op !== 0x89) return;
    if (bytes.length < 6) return;
    const body = bytes.slice(1, Math.max(1, bytes.length - 1));
    const prev = rawMotionByOpRef.current.get(op);
    rawMotionByOpRef.current.set(op, body);
    if (!prev) return;
    const len = Math.max(prev.length, body.length);
    let delta = Math.abs(prev.length - body.length) * 8;
    for (let i = 0; i < len; i++) delta += Math.abs((body[i] ?? 0) - (prev[i] ?? 0));
    if (delta < 18) return;
    const now = Date.now();
    const since = now - rawMotionLastEventAtRef.current;
    if (since < 650) return;

    const intensity = Math.max(1, Math.min(100, Math.round(delta / 3)));
    const accelPeakG = { value: Math.max(0.1, Math.min(16, delta / 45)), saturated: false };
    const gyroPeakDps = { value: Math.round(Math.min(2200, delta * 9)), saturated: false };
    const jerkPeakGps = { value: Math.round(Math.min(600, delta * 2.5)), saturated: false };
    const durationMs = Math.max(80, Math.min(1200, since || 250));
    let event: VyroMotionEvent;
    if (delta > 130) {
      event = {
        type: "swing",
        code: 0x10,
        intensity,
        accelPeakG,
        gyroPeakDps,
        durationMs,
        refFwdG: { value: 0, saturated: false },
        refLrG: { value: 0, saturated: false },
        refUdG: { value: 0, saturated: false },
      };
    } else if (since > 0 && since < 2400) {
      event = {
        type: "direction_change",
        code: 0x13,
        accelPeakG,
        gyroPeakDps,
        gapMs: durationMs,
        prevFwdG: { value: 0, saturated: false },
        prevLrG: { value: 0, saturated: false },
        currFwdG: { value: 0, saturated: false },
        currLrG: { value: 0, saturated: false },
      };
    } else {
      event = delta > 60
        ? {
            type: "burst",
            code: 0x12,
            accelPeakG,
            jerkPeakGps,
            gyroPeakDps,
            durationMs,
            refFwdG: { value: 0, saturated: false },
            refLrG: { value: 0, saturated: false },
          }
        : {
            type: "rapid_start",
            code: 0x11,
            accelPeakG,
            jerkPeakGps,
            gyroPeakDps,
            durationMs,
            refFwdG: { value: 0, saturated: false },
            refLrG: { value: 0, saturated: false },
          };
    }
    rawMotionLastEventAtRef.current = now;
    setEvents((prevEvents) => {
      const next = [...prevEvents, { ts: now, event }];
      return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
    });
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
      if (shouldKeepNativeBleAliveOnCleanup()) return;
      void bluetooth
        .unsubscribe(connectedId, VYRO_SERVICE_UUID, VYRO_EVENT_CHAR_UUID)
        .catch(() => undefined);
    };
  }, [connectedId]);

  // Cached readings are useful for persistence, but they must never appear as
  // fresh live body signals after a new BLE connection starts. Clear every
  // metric on a fresh connection; each tile repopulates only from a new watch
  // frame received during this session.
  useEffect(() => {
    if (!connectedId) {
      bigDataV2Ref.current = null;
      activeConnectionRef.current = null;
      return;
    }
    if (activeConnectionRef.current === connectedId) return;
    activeConnectionRef.current = connectedId;
    bigDataV2Ref.current = null;
    hrSamplesRef.current = [];
    activityBucketsRef.current.clear();
    activityTotalRef.current = null;
      rawMotionByOpRef.current.clear();
      rawMotionLastEventAtRef.current = 0;
    setEvents([]);
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
    setSignalAt(emptySignalTimestamps());
  }, [connectedId]);

  useEffect(() => {
    persistBandMetrics({
      savedAt: Date.now(),
      day: todayActivityKeyPrefix(),
      heartRateBpm,
      heartRateAt,
      batteryPct,
      batteryCharging,
      spo2Pct,
      skinTempC,
      stepsToday,
      distanceM,
      caloriesKcal,
      restingHrBpm,
      hrvMs,
      respRateBrpm,
      stressScore,
      bloodPressure,
    });
  }, [
    heartRateBpm,
    heartRateAt,
    batteryPct,
    batteryCharging,
    spo2Pct,
    skinTempC,
    stepsToday,
    distanceM,
    caloriesKcal,
    restingHrBpm,
    hrvMs,
    respRateBrpm,
    stressScore,
    bloodPressure,
  ]);

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
      const rhr = sorted[Math.max(0, Math.floor(sorted.length * 0.05))];
      setRestingHrBpm(rhr);
      markSignal("restingHrAt", heartRateAt);
      tapDecoded("restingHr", rhr);
    }
  }, [heartRateBpm, heartRateAt]);

  // Sleep pipeline: when the firmware does not expose a finalized sleep-stage
  // opcode, still persist a real-data nightly sleep summary from overnight HR,
  // HRV and skin-temp samples. This feeds the Sleep tab and the app2 Sleep ring.
  useEffect(() => {
    if (!connectedId) return;
    const capture = () => {
      const now = Date.now();
      if (now - lastSleepSampleAtRef.current < 28_000) return;
      const sample: SleepDerivedSample = {
        t: now,
        hr: heartRateBpm ?? undefined,
        hrv: hrvMs ?? undefined,
        tempC: skinTempC ?? undefined,
      };
      if (sample.hr == null && sample.hrv == null && sample.tempC == null) return;
      lastSleepSampleAtRef.current = now;
      const next = [...sleepSamplesRef.current, sample]
        .filter((s) => now - s.t <= 36 * 60 * 60_000)
        .slice(-SLEEP_SAMPLE_MAX);
      sleepSamplesRef.current = next;
      saveSleepSamples(next);
      const night = buildSleepNightFromSamples(next, now);
      if (night) recordSleepNight(night);
    };
    capture();
    const id = window.setInterval(capture, 30_000);
    return () => window.clearInterval(id);
  }, [connectedId, heartRateBpm, hrvMs, skinTempC]);

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
    let writeChain = Promise.resolve();
    let measureChain = Promise.resolve();
    const pendingMeasures = new Set<string>();

    function enqueueWrite(task: () => Promise<void>) {
      const run = writeChain
        .catch(() => undefined)
        .then(async () => {
          if (cancelled) return;
          await task();
          // CoreBluetooth / Nordic-UART firmwares drop bursts of back-to-back
          // writes. Pace every command through one queue so setup, polling and
          // measurement starts cannot overrun the watch.
          await wait(180);
        });
      writeChain = run;
      return run;
    }

    async function writeQcBand(service: string, write: string, bytes: Uint8Array) {
      const hex = bytesToHex(bytes);
      return enqueueWrite(async () => {
        try {
          await bluetooth.write(connectedId!, service, write, hex, true);
        } catch {
          await bluetooth.write(connectedId!, service, write, hex, false);
        }
      });
    }

    async function writeQcBandV2(bytes: Uint8Array) {
      if (!qcBandV2Service) return;
      const hex = bytesToHex(bytes);
      return enqueueWrite(async () => {
        if (!qcBandV2Service) return;
        try {
          await bluetooth.write(connectedId!, qcBandV2Service.service, qcBandV2Service.write, hex, true);
        } catch {
          await bluetooth.write(connectedId!, qcBandV2Service.service, qcBandV2Service.write, hex, false);
        }
      });
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
      // Some Colmi/H59/QC firmwares don't unlock historical/body metrics until
      // the app first performs the normal SDK setup handshake: set the band time
      // and enable periodic HR logging. Without this, real-time HR works but
      // steps, HRV, stress, SpO₂ and temp requests can be ignored.
      await writeQcBand(service, write, encodeQcBandSetTime()).catch(() => undefined);
      await writeQcBand(service, write, encodeQcBandHeartRateLogging(true, 5)).catch(() => undefined);
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
          void writeQcBandV2(encodeQcBandSpo2IntervalHistoryRequest()).catch(() => undefined);
        }, 2_450);
        window.setTimeout(() => {
          void writeQcBandV2(encodeQcBandTemperatureHistoryRequest()).catch(() => undefined);
        }, 2_800);
        window.setTimeout(() => {
          void writeQcBandV2(encodeQcBandTemperatureLegacyHistoryRequest()).catch(() => undefined);
        }, 3_150);
        window.setTimeout(() => {
          void writeQcBandV2(encodeQcBandTemperatureManualHistoryRequest()).catch(() => undefined);
        }, 3_500);
      };
      window.setTimeout(pollHistory, 6_000);
      historyTimer = window.setInterval(pollHistory, 60_000);

      const enqueueMeasure = (label: string, subType: number, durationMs: number) => {
        const key = `${label}:0x${subType.toString(16)}`;
        if (pendingMeasures.has(key)) return;
        pendingMeasures.add(key);
        measureChain = measureChain
          .catch(() => undefined)
          .then(async () => {
            try {
              if (cancelled) return;
              console.log(`[qcband] ${label} measure start 0x${subType.toString(16)}`);
              await writeQcBand(service, write, encodeQcBandMeasureStart(subType));
              await wait(durationMs);
              if (cancelled) return;
              await writeQcBand(service, write, encodeQcBandMeasureStop(subType));
              await wait(1500);
            } finally {
              pendingMeasures.delete(key);
            }
          });
      };

      const runMeasureCycle = (label: string, subTypes: readonly number[], durationMs: number) => {
        subTypes.forEach((subType, index) => {
          window.setTimeout(() => {
            enqueueMeasure(label, subType, durationMs);
          }, index * 250);
        });
      };

      // ---- MEASUREMENT SCHEDULE ---------------------------------------
      // Armand's firmware only responds with 0x87/0x89 (keep-alive /
      // feature-unsupported) to the one-key composite. So we can't rely on
      // one-key; we must fire EVERY sub-type individually and quickly, in
      // both the legacy (0x01..0x0e) and SDK (0x00..0x08) mappings, so at
      // least one variant gets an actual 0x69 reply per metric. All bursts
      // happen inside the first ~30s of connect so the Debug bundle shows
      // a real per-metric verdict without waiting 5 minutes.
      const runAllMeasures = () => {
        // Order matters: HR must arm first on QCBand firmwares before other
        // sub-types respond. Space them so writes never overlap in flight.
        runMeasureCycle("hr", QCBAND_MEASURE_HR_TYPES, 15_000);
        window.setTimeout(() => runMeasureCycle("spo2", QCBAND_MEASURE_SPO2_TYPES, 15_000), 2_000);
        window.setTimeout(() => runMeasureCycle("temp", QCBAND_MEASURE_TEMP_TYPES, 15_000), 4_500);
        window.setTimeout(() => runMeasureCycle("hrv", QCBAND_MEASURE_HRV_TYPES, 20_000), 7_000);
        window.setTimeout(() => runMeasureCycle("stress", QCBAND_MEASURE_STRESS_TYPES, 20_000), 9_500);
        window.setTimeout(() => runMeasureCycle("blood-pressure", QCBAND_MEASURE_BP_TYPES, 45_000), 12_000);
        window.setTimeout(() => runMeasureCycle("one-key", QCBAND_MEASURE_ONE_KEY_TYPES, 30_000), 14_500);
      };
      window.setTimeout(runAllMeasures, 2_000);
      oneKeyTimer = window.setInterval(runAllMeasures, 3 * 60_000);

      // Silence watchdog: if 25s after connect a metric has produced zero
      // decoded values, re-arm it once with the SAME sub-types. This catches
      // the case where the first arming write raced the notify subscription
      // or the firmware dropped it. Every re-arm attempt is logged into the
      // write log so the Debug tab shows the retry.
      const watchdog = window.setTimeout(() => {
        if (cancelled) return;
        try {
          const snap = getDecodedSnapshot();
          const need: Array<[string, readonly number[]]> = [];
          if (!snap.hr || snap.hr.count === 0) need.push(["hr", QCBAND_MEASURE_HR_TYPES]);
          if (!snap.spo2 || snap.spo2.count === 0) need.push(["spo2", QCBAND_MEASURE_SPO2_TYPES]);
          if (!snap.skinTemp || snap.skinTemp.count === 0) need.push(["temp", QCBAND_MEASURE_TEMP_TYPES]);
          if (!snap.hrv || snap.hrv.count === 0) need.push(["hrv", QCBAND_MEASURE_HRV_TYPES]);
          if (!snap.stress || snap.stress.count === 0) need.push(["stress", QCBAND_MEASURE_STRESS_TYPES]);
          if (!snap.bp || snap.bp.count === 0) need.push(["blood-pressure", QCBAND_MEASURE_BP_TYPES]);
          need.forEach(([label, subs], i) => {
            window.setTimeout(() => {
              console.log(`[qcband] watchdog re-arm ${label}`);
              runMeasureCycle(`${label}-retry`, subs, 20_000);
            }, i * 2_000);
          });
        } catch (err) {
          console.warn("[qcband] watchdog failed", err);
        }
      }, 25_000);

      // Stash extra timers so cleanup can clear them.
      const stop = () => {
        window.clearTimeout(watchdog);
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
      if (shouldKeepNativeBleAliveOnCleanup()) return;
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


  // Decode incoming notifications directly from the BLE event bus. Do not
  // depend on `useBluetooth().lastData`: React state batching can coalesce a
  // burst of HR + metric packets down to only the last packet, which makes the
  // Debug tab show traffic while tiles remain grey.
  useEffect(() => {
    const handleBleData = (data: BleDataEvent) => {
    if (connectedId && data.id && data.id !== connectedId) return;
    const cuuid = data.characteristic.toLowerCase();
    if (uuidMatches(cuuid, VYRO_EVENT_CHAR_UUID)) {
      try {
        const ev = decodeMotionEventFromString(data.value);
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
      const bpm = decodeHeartRate(payloadToBytes(data.value));
      if (bpm != null && bpm > 0 && bpm < 250) {
        setHeartRateBpm(bpm);
        setHeartRateAt(Date.now());
        tapDecoded("hr", bpm, payloadToBytes(data.value));
      }
      return;
    }
    if (uuidMatches(cuuid, QCBAND_NOTIFY_CHAR_UUID)) {
      const bytes = payloadToBytes(data.value);
      if (bytes.length === 0) return;
      const op = bytes[0];
      console.log("[qcband] notify op=0x" + op.toString(16).padStart(2, "0"), bytesToHex(bytes));
      ingestRawMotionSignal(bytes);
      // Tap 0x87 / 0x89 / 0x73 raw — Armand's firmware answers one-key/measure
      // attempts on these opcodes with status bytes (0xee = feature unsupported
      // / keep-alive). Recording them here means the Debug "Decoder output"
      // section shows exactly what the watch is echoing.
      if (op === 0x87 || op === 0x89 || op === 0x73) {
        tapDecoded("motion", `op=0x${op.toString(16)} b1=0x${(bytes[1] ?? 0).toString(16)}`, bytes);
      }

      if (op === QCBAND_CMD_REALTIME_HR) {
        const bpm = decodeQcBandRealtimeHeartRate(bytes);
        if (bpm != null) {
          setHeartRateBpm(bpm);
          setHeartRateAt(Date.now());
          tapDecoded("hr", bpm, bytes);
        }
      } else if (op === QCBAND_CMD_BATTERY) {
        const bat = decodeQcBandBattery(bytes);
        if (bat) {
          setBatteryPct(bat.level);
          setBatteryCharging(bat.charging);
          markSignal("batteryAt");
          tapDecoded("battery", bat.level, bytes);
        }
      } else if (
        op === QCBAND_CMD_TODAY_SUMMARY ||
        op === QCBAND_CMD_STEPS_ALT1
      ) {
        const sum = decodeQcBandTodaySummary(bytes);
        if (sum) {
          applyActivity(sum, "summary");
        }
      } else if (op === QCBAND_CMD_TODAY_SPORTS) {
        const sum = decodeQcBandTodaySports(bytes);
        if (sum) {
          applyActivity(sum, "todaySports");
        }
      } else if (op === QCBAND_CMD_NOTIFICATION) {
        const live = decodeQcBandLiveActivityNotification(bytes);
        if (live) {
          applyActivity(live, "live");
        }
        const temp = decodeQcBandTemperatureNotification(bytes);
        if (temp != null) {
          setSkinTempC(temp);
          markSignal("skinTempAt");
          tapDecoded("skinTemp", temp, bytes);
        }
        const spo2 = decodeQcBandSpo2Notification(bytes);
        if (spo2 != null) {
          setSpo2Pct(spo2);
          markSignal("spo2At");
          tapDecoded("spo2", spo2, bytes);
        }
        if (bytes[1] === 0x01 && bytes[2] > 30 && bytes[2] < 250) {
          setHeartRateBpm(bytes[2]);
          setHeartRateAt(Date.now());
          tapDecoded("hr", bytes[2], bytes);
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
          applyActivity({ steps, distanceM, calories }, "history");
        }
      } else if (op === QCBAND_CMD_SYNC_HRV) {
        const hrv = decodeQcBandHrvHistory(bytes);
        if (hrv != null) {
          setHrvMs(hrv);
          markSignal("hrvAt");
          tapDecoded("hrv", hrv, bytes);
        }
      } else if (op === QCBAND_CMD_SYNC_STRESS) {
        const stress = decodeQcBandStressHistory(bytes);
        if (stress != null) {
          setStressScore(stress);
          markSignal("stressAt");
          tapDecoded("stress", stress, bytes);
        }
      } else if (op === QCBAND_CMD_START_MEASURE || op === QCBAND_CMD_STOP_MEASURE) {
        const frame = decodeQcBandMeasureFrame(bytes);
        if (!frame) return;
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
            tapDecoded("hr", ok.hr, bytes);
          }
          if (ok.spo2 != null) {
            setSpo2Pct(ok.spo2);
            markSignal("spo2At");
            tapDecoded("spo2", ok.spo2, bytes);
          }
          if (ok.tempC != null) {
            setSkinTempC(ok.tempC);
            markSignal("skinTempAt");
            tapDecoded("skinTemp", ok.tempC, bytes);
          }
          if (ok.hrvMs != null && ok.hrvMs >= 5) {
            setHrvMs(ok.hrvMs);
            markSignal("hrvAt");
            tapDecoded("hrv", ok.hrvMs, bytes);
          }
          if (ok.stress != null) {
            setStressScore(ok.stress);
            markSignal("stressAt");
            tapDecoded("stress", ok.stress, bytes);
          }
          if (ok.sbp != null && ok.dbp != null) {
            setBloodPressure({ sbp: ok.sbp, dbp: ok.dbp });
            markSignal("bloodPressureAt");
            tapDecoded("bp", `${ok.sbp}/${ok.dbp}`, bytes);
          }
          return true;
        };
        const applyBloodPressure = () => {
          const bp = decodeQcBandBloodPressurePayload(frame.data);
          if (!bp) return false;
          setBloodPressure({ sbp: bp.sbp, dbp: bp.dbp });
          markSignal("bloodPressureAt");
          tapDecoded("bp", `${bp.sbp}/${bp.dbp}`, bytes);
          if (bp.hr != null) {
            setHeartRateBpm(bp.hr);
            setHeartRateAt(Date.now());
            tapDecoded("hr", bp.hr, bytes);
          }
          return true;
        };
        const applyTemperature = () => {
          const t = decodeQcBandTempPayload(frame.data);
          if (t == null) return false;
          setSkinTempC(t);
          markSignal("skinTempAt");
          tapDecoded("skinTemp", t, bytes);
          return true;
        };
        const applySpo2Scalar = () => {
          if (frame.value < 70 || frame.value > 100) return false;
          setSpo2Pct(frame.value);
          markSignal("spo2At");
          tapDecoded("spo2", frame.value, bytes);
          return true;
        };
        const applyHeartRateScalar = () => {
          if (frame.value <= 30 || frame.value >= 250) return false;
          setHeartRateBpm(frame.value);
          setHeartRateAt(Date.now());
          tapDecoded("hr", frame.value, bytes);
          return true;
        };
        const applyHrvScalar = () => {
          if (frame.value < 5 || frame.value >= 250) return false;
          setHrvMs(frame.value);
          markSignal("hrvAt");
          tapDecoded("hrv", frame.value, bytes);
          return true;
        };
        const applyStressScalar = () => {
          if (frame.value <= 0 || frame.value > 100) return false;
          setStressScore(frame.value);
          markSignal("stressAt");
          tapDecoded("stress", frame.value, bytes);
          return true;
        };
        let handled = false;
        if ((QCBAND_MEASURE_BP_TYPES as readonly number[]).includes(frame.subType)) {
          handled = applyBloodPressure() || handled;
        }
        if ((QCBAND_MEASURE_SPO2_TYPES as readonly number[]).includes(frame.subType)) {
          handled = applySpo2Scalar() || handled;
        }
        if ((QCBAND_MEASURE_HR_TYPES as readonly number[]).includes(frame.subType)) {
          handled = applyHeartRateScalar() || handled;
        }
        if ((QCBAND_MEASURE_HRV_TYPES as readonly number[]).includes(frame.subType)) {
          handled = applyHrvScalar() || handled;
        }
        if (
          frame.subType === 0x04 &&
          frame.data.length >= 2 &&
          applyTemperature()
        ) {
          handled = true;
        }
        if ((QCBAND_MEASURE_STRESS_TYPES as readonly number[]).includes(frame.subType)) {
          handled = applyStressScalar() || handled;
        }
        if ((QCBAND_MEASURE_TEMP_TYPES as readonly number[]).includes(frame.subType)) {
          handled = applyTemperature() || handled;
        }
        if ((QCBAND_MEASURE_ONE_KEY_TYPES as readonly number[]).includes(frame.subType) && applyOneKey()) {
          handled = true;
        }
        void handled;
      }
      return;
    }
    if (uuidMatches(cuuid, QCBAND_NOTIFY_V2_CHAR_UUID)) {
      const chunk = payloadToBytes(data.value);
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
      if (spo2 != null) {
        setSpo2Pct(spo2);
        markSignal("spo2At");
        tapDecoded("spo2", spo2, bytes);
      }
      const temp = decodeQcBandTemperatureHistory(bytes);
      if (temp != null) {
        setSkinTempC(temp);
        markSignal("skinTempAt");
        tapDecoded("skinTemp", temp, bytes);
      }
      return;
    }
    if (uuidMatches(cuuid, BAT_LVL_CHAR)) {
      const bytes = payloadToBytes(data.value);
      if (bytes.length >= 1) {
        setBatteryPct(bytes[0]);
        markSignal("batteryAt");
        tapDecoded("battery", bytes[0], bytes);
      }
      return;
    }
    };
    const off = bluetooth.on("data", handleBleData);
    return off;
  }, [connectedId]);

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
    signalAt,
  };
}
