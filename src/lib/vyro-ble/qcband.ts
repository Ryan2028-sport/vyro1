// QCBand/Oudmon watch SDK BLE protocol helpers.
// Source: uploaded QCBandSDK iOS guide/framework + community reverse engineering
// of the Oudmon protocol (atc1441/ATC_RF03_Ring, tahnok/colmi_r02_client).
// All commands share the same 16-byte frame:
//   [opcode, ...payload(up to 14), checksum=sum(bytes 0..14) & 0xFF]
// served over the FFF0 Nordic-UART-style service.

export const QCBAND_SERVICE_UUID = "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e";
export const QCBAND_WRITE_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
export const QCBAND_NOTIFY_CHAR_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

// Newer Colmi/Yawell/QCBand firmwares expose a second "big data" service for
// buffered SpO₂ / skin-temperature history. It must be subscribed separately;
// otherwise temperature can be present on the watch but never reach the app.
export const QCBAND_SERVICE_V2_UUID = "de5bf728-d711-4e47-af26-65e3012a5dc7";
export const QCBAND_COMMAND_V2_CHAR_UUID = "de5bf72a-d711-4e47-af26-65e3012a5dc7";
export const QCBAND_NOTIFY_V2_CHAR_UUID = "de5bf729-d711-4e47-af26-65e3012a5dc7";

// Opcodes (selected — see Oudmon protocol).
export const QCBAND_CMD_SET_TIME = 0x01;         // 1 — required setup on some H59/QC firmwares
export const QCBAND_CMD_BATTERY = 0x03;          // 3
export const QCBAND_CMD_TODAY_SUMMARY = 0x09;    // 9 — steps/distance/calories
export const QCBAND_CMD_HEART_RATE_HISTORY = 0x15; // 21 — 5-min HR history
export const QCBAND_CMD_HEART_RATE_LOG = 0x16;   // 22 — automatic HR logging preference
export const QCBAND_CMD_SYNC_STRESS = 0x37;      // 55 — 30-min stress history
export const QCBAND_CMD_SYNC_HRV = 0x39;         // 57 — 30-min HRV/RMSSD history
export const QCBAND_CMD_SYNC_ACTIVITY = 0x43;    // 67 — hourly steps/activity history
export const QCBAND_CMD_TODAY_SPORTS = 0x48;     // 72 — total steps/running/cal/distance
export const QCBAND_CMD_REALTIME_HR = 0x1e;      // 30 — start/end/hold poll
export const QCBAND_CMD_START_MEASURE = 0x69;    // 105 — start HR/SpO2/temp/one-key
export const QCBAND_CMD_STOP_MEASURE = 0x6a;     // 106 — stop measurement
export const QCBAND_CMD_NOTIFICATION = 0x73;      // 115 — live activity/battery notifications
export const QCBAND_CMD_BIG_DATA_V2 = 0xbc;       // 188 — V2 history payloads

export const QCBAND_CMD_AUTO_SPO2_PREF = 0x2c;
export const QCBAND_CMD_AUTO_STRESS_PREF = 0x36;
export const QCBAND_CMD_AUTO_HRV_PREF = 0x38;
export const QCBAND_CMD_AUTO_TEMP_PREF = 0x3a;
export const QCBAND_PREF_READ = 0x01;
export const QCBAND_PREF_WRITE = 0x02;

export const QCBAND_NOTIFICATION_BATTERY = 0x0c;
export const QCBAND_NOTIFICATION_LIVE_ACTIVITY = 0x12;
export const QCBAND_NOTIFICATION_HEART_RATE = 0x01;
export const QCBAND_NOTIFICATION_BLOOD_OXYGEN = 0x03;
export const QCBAND_NOTIFICATION_STEPS = 0x04;
export const QCBAND_NOTIFICATION_TEMPERATURE = 0x05;
export const QCBAND_NOTIFICATION_ACTIVITY = 0x07;

export const QCBAND_BIG_DATA_TYPE_TEMPERATURE = 0x25;
export const QCBAND_BIG_DATA_TYPE_TEMPERATURE_MANUAL = 0x26;
export const QCBAND_BIG_DATA_TYPE_SPO2 = 0x2a;
export const QCBAND_BIG_DATA_TYPE_SPO2_INTERVAL = 0x5f;
export const QCBAND_BIG_DATA_TYPE_TEMPERATURE_INTERVAL = 0x74;

// Measurement sub-types under 0x69 / 0x6A. QCBand/Oudmon ships more than one
// firmware line. The old protocol uses 0x01/0x03/0x05/0x09/0x0d/0x0e; the newer
// SDK enum exposes HeartRate=0, BloodOxygen=2, OneKey=3, Stress=4, HRV=6,
// BodyTemperature=7 and OneKeyMeasureHeartRate=9. We send/accept both families
// so the live tiles do not stay blank on watches using the newer SDK mapping.
export const QCBAND_MEASURE_HR = 0x01;
export const QCBAND_MEASURE_HR_SDK = 0x00;
export const QCBAND_MEASURE_BP = 0x02;
export const QCBAND_MEASURE_SPO2 = 0x03;
export const QCBAND_MEASURE_SPO2_SDK = 0x02;
export const QCBAND_MEASURE_TEMP_LEGACY = 0x04;
export const QCBAND_MEASURE_ONE_KEY = 0x05; // legacy composite
export const QCBAND_MEASURE_ONE_KEY_SDK = 0x03;
export const QCBAND_MEASURE_STRESS_SDK = 0x04;
export const QCBAND_MEASURE_HRV_SDK = 0x06;
export const QCBAND_MEASURE_TEMP_SDK = 0x07;
export const QCBAND_MEASURE_PRESSURE_SDK = 0x08;
export const QCBAND_MEASURE_TEMP = 0x09;
export const QCBAND_MEASURE_ONE_KEY_HR = 0x09; // SDK real one-key HR stream
export const QCBAND_MEASURE_HRV_DATA_REQUEST = 0x0a;
export const QCBAND_MEASURE_STRESS = 0x0d;
export const QCBAND_MEASURE_HRV = 0x0e;

export const QCBAND_MEASURE_HR_TYPES = [QCBAND_MEASURE_HR, QCBAND_MEASURE_HR_SDK] as const;
export const QCBAND_MEASURE_BP_TYPES = [QCBAND_MEASURE_BP] as const;
export const QCBAND_MEASURE_SPO2_TYPES = [QCBAND_MEASURE_SPO2, QCBAND_MEASURE_SPO2_SDK] as const;
export const QCBAND_MEASURE_ONE_KEY_TYPES = [QCBAND_MEASURE_ONE_KEY_HR, QCBAND_MEASURE_ONE_KEY, QCBAND_MEASURE_ONE_KEY_SDK] as const;
export const QCBAND_MEASURE_TEMP_TYPES = [QCBAND_MEASURE_TEMP_SDK, QCBAND_MEASURE_TEMP, QCBAND_MEASURE_TEMP_LEGACY] as const;
export const QCBAND_MEASURE_STRESS_TYPES = [QCBAND_MEASURE_PRESSURE_SDK, QCBAND_MEASURE_STRESS, QCBAND_MEASURE_STRESS_SDK] as const;
export const QCBAND_MEASURE_HRV_TYPES = [QCBAND_MEASURE_HRV_DATA_REQUEST, QCBAND_MEASURE_HRV, QCBAND_MEASURE_HRV_SDK] as const;

export type QcBandRealtimeHrCommand = "start" | "end" | "hold";

const REALTIME_HR_COMMAND: Record<QcBandRealtimeHrCommand, number> = {
  start: 0x01,
  end: 0x02,
  hold: 0x03,
};

function sdkCommand(bytes: number[]): Uint8Array {
  const out = new Uint8Array(16);
  let checksum = 0;
  for (let i = 0; i < bytes.length && i < 15; i++) {
    const b = bytes[i] & 0xff;
    out[i] = b;
    checksum = (checksum + b) & 0xff;
  }
  out[15] = checksum;
  return out;
}

function decToBcd(v: number): number {
  const n = Math.max(0, Math.min(99, Math.trunc(v)));
  return (((Math.floor(n / 10) << 4) | (n % 10)) & 0xff);
}

// ---- Setup / feature enabling --------------------------------------------
export function encodeQcBandSetTime(date = new Date()): Uint8Array {
  return sdkCommand([
    QCBAND_CMD_SET_TIME,
    decToBcd(date.getFullYear() % 100),
    decToBcd(date.getMonth() + 1),
    decToBcd(date.getDate()),
    decToBcd(date.getHours()),
    decToBcd(date.getMinutes()),
    decToBcd(date.getSeconds()),
    0x01,
  ]);
}

export function encodeQcBandHeartRateLogging(enabled = true, intervalMin = 5): Uint8Array {
  return sdkCommand([
    QCBAND_CMD_HEART_RATE_LOG,
    0x02,
    enabled ? 0x01 : 0x02,
    Math.max(1, Math.min(60, Math.trunc(intervalMin))),
  ]);
}

export function encodeQcBandBindingAlert(): Uint8Array {
  return sdkCommand([0x10]);
}

// ---- Real-time heart rate (0x1E) -----------------------------------------
export function encodeQcBandRealtimeHeartRate(type: QcBandRealtimeHrCommand): Uint8Array {
  return sdkCommand([QCBAND_CMD_REALTIME_HR, REALTIME_HR_COMMAND[type]]);
}

export function decodeQcBandRealtimeHeartRate(bytes: Uint8Array): number | null {
  if (bytes.length < 2) return null;
  if (bytes[0] !== QCBAND_CMD_REALTIME_HR) return null;
  const bpm = bytes[1];
  return bpm > 0 && bpm < 250 ? bpm : null;
}

// ---- Battery (0x03) ------------------------------------------------------
export function encodeQcBandBatteryRequest(): Uint8Array {
  return sdkCommand([QCBAND_CMD_BATTERY]);
}

export function encodeQcBandAutoSpo2(enabled = true): Uint8Array {
  return sdkCommand([QCBAND_CMD_AUTO_SPO2_PREF, QCBAND_PREF_WRITE, enabled ? 0x01 : 0x00]);
}

export function encodeQcBandAutoStress(enabled = true): Uint8Array {
  return sdkCommand([QCBAND_CMD_AUTO_STRESS_PREF, QCBAND_PREF_WRITE, enabled ? 0x01 : 0x00]);
}

export function encodeQcBandAutoHrv(enabled = true): Uint8Array {
  return sdkCommand([QCBAND_CMD_AUTO_HRV_PREF, QCBAND_PREF_WRITE, enabled ? 0x01 : 0x00]);
}

export function encodeQcBandAutoTemp(enabled = true): Uint8Array {
  // Temperature settings use an extra channel byte (0x03) on this firmware line.
  return sdkCommand([QCBAND_CMD_AUTO_TEMP_PREF, 0x03, QCBAND_PREF_WRITE, enabled ? 0x01 : 0x00]);
}

export function decodeQcBandBattery(
  bytes: Uint8Array,
): { level: number; charging: boolean } | null {
  if (bytes.length < 3) return null;
  if (bytes[0] !== QCBAND_CMD_BATTERY) return null;
  const level = bytes[1];
  if (level > 100) return null;
  return { level, charging: bytes[2] !== 0 };
}

// ---- Today summary / steps -----------------------------------------------
// Different Oudmon/QCBand firmwares respond on different opcodes:
//   0x09 — newest QCBand SDK ("today summary")
//   0x07 — older Oudmon devices ("step counter")
//   0x43 — Colmi/Yawell activity history (handled below)
// Request format is always [opcode | 0x00 ...], with the day index optionally
// at byte 1 (0 = today). We send all three on each poll; only the supported
// one will respond.
export const QCBAND_CMD_STEPS_ALT1 = 0x07;
// 0x15 is heart-rate history on Colmi/Yawell firmwares, not steps. Do not
// decode it as activity or it can turn HR-history bytes into bogus step counts.
export const QCBAND_CMD_STEPS_ALT2 = 0x15;

export function encodeQcBandStepsRequest(): Uint8Array {
  return sdkCommand([QCBAND_CMD_TODAY_SUMMARY, 0x00]);
}
export function encodeQcBandStepsRequestAlt1(): Uint8Array {
  return sdkCommand([QCBAND_CMD_STEPS_ALT1, 0x00]);
}
export function encodeQcBandStepsRequestAlt2(): Uint8Array {
  return sdkCommand([QCBAND_CMD_STEPS_ALT2, 0x00]);
}

export function encodeQcBandActivityRequest(daysAgo = 0): Uint8Array {
  // Gadgetbridge/QRing request: [0x43, daysAgo, 0x0f, 0x00, 0x5f, 0x01].
  return sdkCommand([QCBAND_CMD_SYNC_ACTIVITY, daysAgo & 0xff, 0x0f, 0x00, 0x5f, 0x01]);
}

export function encodeQcBandTodaySportsRequest(): Uint8Array {
  return sdkCommand([QCBAND_CMD_TODAY_SPORTS]);
}

export function encodeQcBandStressRequest(daysAgo = 0): Uint8Array {
  // QCBand/Oudmon history commands expect a one-byte day index. Sending only
  // the opcode can be ignored by the firmware, leaving stress grey forever.
  return sdkCommand([QCBAND_CMD_SYNC_STRESS, daysAgo & 0xff]);
}

export function encodeQcBandHrvRequest(daysAgo = 0): Uint8Array {
  // Same one-byte day-index layout as stress history.
  return sdkCommand([QCBAND_CMD_SYNC_HRV, daysAgo & 0xff]);
}

function bigDataV2Request(type: number, payload: number[] = []): Uint8Array {
  // Big-data V2 frames are sent directly to the V2 command characteristic:
  // [0xbc, type, payloadLenLE, crc16/unused=0xffff, ...payload]. The uploaded
  // QCBand iOS SDK exposes interval temperature as request/response 0x74 with
  // payload [dayIndex, pocketIndex], while older firmwares use 0x25/0x26.
  return new Uint8Array([
    QCBAND_CMD_BIG_DATA_V2,
    type & 0xff,
    payload.length & 0xff,
    (payload.length >> 8) & 0xff,
    0xff,
    0xff,
    ...payload.map((b) => b & 0xff),
  ]);
}

export function encodeQcBandSpo2HistoryRequest(): Uint8Array {
  // Manual SpO₂ history (SDK request/response 0x2a).
  return bigDataV2Request(QCBAND_BIG_DATA_TYPE_SPO2);
}

export function encodeQcBandTemperatureHistoryRequest(): Uint8Array {
  // Preferred by the uploaded SDK: interval temperature request 0x74 with
  // [dayIndex=0, pocketIndex=0]. This returns exact sensor values in 0.1°C.
  return bigDataV2Request(QCBAND_BIG_DATA_TYPE_TEMPERATURE_INTERVAL, [0x00, 0x00]);
}

export function encodeQcBandTemperatureLegacyHistoryRequest(daysAgo = 0): Uint8Array {
  return bigDataV2Request(QCBAND_BIG_DATA_TYPE_TEMPERATURE, [daysAgo & 0xff]);
}

export function encodeQcBandTemperatureManualHistoryRequest(daysAgo = 0): Uint8Array {
  return bigDataV2Request(QCBAND_BIG_DATA_TYPE_TEMPERATURE_MANUAL, [daysAgo & 0xff]);
}

export function encodeQcBandSpo2IntervalHistoryRequest(daysAgo = 0, pocketIndex = 0): Uint8Array {
  return bigDataV2Request(QCBAND_BIG_DATA_TYPE_SPO2_INTERVAL, [daysAgo & 0xff, pocketIndex & 0xff]);
}

function bcdByte(v: number): number {
  return ((v >> 4) & 0x0f) * 10 + (v & 0x0f);
}

export function decodeQcBandTodaySummary(
  bytes: Uint8Array,
): { steps: number; distanceM: number; calories: number } | null {
  if (bytes.length < 8) return null;
  const op = bytes[0];
  if (
    op !== QCBAND_CMD_TODAY_SUMMARY &&
    op !== QCBAND_CMD_STEPS_ALT1
  )
    return null;
  const u16le = (i: number) => bytes[i] | (bytes[i + 1] << 8);
  const u16be = (i: number) => (bytes[i] << 8) | bytes[i + 1];
  const u24le = (i: number) => bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16);
  const u24be = (i: number) => ((bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]) >>> 0;
  const u32 = (i: number) => (bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24)) >>> 0;
  const candidates: Array<{ steps: number; distanceM: number; calories: number; score: number }> = [];

  const push = (steps: number, distanceM: number, calories: number, score = 0) => {
    if (!Number.isFinite(steps) || steps < 0 || steps > 200_000) return;
    if (!Number.isFinite(distanceM) || distanceM < 0 || distanceM > 250_000) return;
    if (!Number.isFinite(calories) || calories < 0 || calories > 25_000) return;
    // A single 0xff status byte can otherwise decode as a bogus stuck 255
    // steps value. Reject it here; live/activity-history packets will provide
    // the real total when the watch has data.
    if (steps === 255 && bytes[1] === 0xff) return;
    candidates.push({ steps, distanceM, calories, score });
  };

  if (op === QCBAND_CMD_STEPS_ALT1) {
    // Uploaded QCBandSDK `OdmBandGetDayTotalSport` decoder, stage 0:
    // [0x07, 0x00, ..., totalSteps(3 BE)@6, runSteps(3 BE)@9,
    // calories(3 BE)@12]. This is the exact daily total; decoding it as LE is
    // what made steps look stuck / inaccurate.
    if (bytes[1] === 0x00 && bytes.length >= 15) {
      push(u24be(6), 0, u24be(12), 12);
    }
    if (candidates.length === 0 && bytes.length >= 15) {
      push(u24be(6), 0, u24be(12), 8);
      push(u24le(6), 0, u24le(12), 2);
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score || b.steps - a.steps);
    const { steps, distanceM, calories } = candidates[0];
    return { steps, distanceM, calories };
  }

  // Canonical layout: [op, steps(3), dist(2), cal(2)].
  push(u24be(1), u16be(4), u16be(6), 6);
  push(u24le(1), u16le(4), u16le(6), 4);
  // SDK/day-index layout: [op, day/status, steps(3), dist(2), cal(2)].
  if (bytes.length >= 9) push(u24be(2), u16be(5), u16be(7), 8);
  if (bytes.length >= 9) push(u24le(2), u16le(5), u16le(7), 5);
  // Several watches use 32-bit counters after one status/day byte.
  if (bytes.length >= 11) push(u32(2), u16le(6), u16le(8), 3);
  // Alternate current-sport layouts seen in QCSportModel dumps.
  if (bytes.length >= 13) push(u32(1), u32(9), u32(5), 5);
  if (bytes.length >= 13) push(u32(2), u32(10), u32(6), 7);

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score || b.steps - a.steps);
  const { steps, distanceM, calories } = candidates[0];
  return { steps, distanceM, calories };
}

export function decodeQcBandTodaySports(
  bytes: Uint8Array,
): { steps: number; runningSteps: number; distanceM: number; calories: number } | null {
  if (bytes.length < 14 || bytes[0] !== QCBAND_CMD_TODAY_SPORTS) return null;
  // Uploaded QCBandSDK `OdmBandGetCurrentSportInfo` decodes all counters as
  // big-endian 24-bit integers: total steps @1, running steps @4, calories @7,
  // distance @10, active time @13. Using little-endian here was the main source
  // of wrong live step totals.
  const u24be = (i: number) => ((bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]) >>> 0;
  const u24le = (i: number) => (bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16)) >>> 0;
  let steps = u24be(1);
  let runningSteps = u24be(4);
  let calories = u24be(7);
  let distanceM = u24be(10);
  if (steps > 200_000 || distanceM > 250_000 || calories > 25_000) {
    steps = u24le(1);
    runningSteps = u24le(4);
    calories = u24le(7);
    distanceM = u24le(10);
  }
  if (steps < 0 || steps > 200_000 || distanceM < 0 || distanceM > 250_000 || calories > 25_000) return null;
  return { steps, runningSteps, distanceM, calories };
}

export function decodeQcBandLiveActivityNotification(
  bytes: Uint8Array,
): { steps: number; distanceM: number; calories: number } | null {
  if (bytes.length < 5) return null;
  if (
    bytes[0] !== QCBAND_CMD_NOTIFICATION ||
    (bytes[1] !== QCBAND_NOTIFICATION_LIVE_ACTIVITY &&
      bytes[1] !== QCBAND_NOTIFICATION_STEPS &&
      bytes[1] !== QCBAND_NOTIFICATION_ACTIVITY)
  ) return null;
  // Live notification is cumulative for today. Gadgetbridge decodes the 24-bit
  // fields as [high, mid, low] from bytes 2..4 / 5..7 / 8..10.
  const u24be = (i: number) => ((bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]) >>> 0;
  const u24le = (i: number) => (bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16)) >>> 0;
  const u32le = (i: number) => (i + 3 < bytes.length ? (bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24)) >>> 0 : NaN);
  const u32be = (i: number) => (i + 3 < bytes.length ? ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0 : NaN);
  const candidates: Array<{ steps: number; distanceM: number; calories: number; score: number }> = [];
  const push = (steps: number, distanceM = 0, calories = 0, score = 0) => {
    if (!Number.isFinite(steps) || steps < 0 || steps > 200_000) return;
    if (!Number.isFinite(distanceM) || distanceM < 0 || distanceM > 250_000) return;
    if (!Number.isFinite(calories) || calories < 0 || calories > 25_000) return;
    candidates.push({ steps, distanceM, calories, score });
  };
  if (bytes.length >= 11) {
    push(u24be(2), u24be(8), Math.round(u24be(5) / 10), bytes[1] === QCBAND_NOTIFICATION_LIVE_ACTIVITY ? 8 : 6);
    push(u24le(2), u24le(8), Math.round(u24le(5) / 10), 5);
  }
  if (bytes.length >= 6) {
    push(u24le(2), 0, 0, 4);
    push(u24be(2), 0, 0, 3);
  }
  if (bytes.length >= 7) {
    push(u32le(2), 0, 0, 2);
    push(u32be(2), 0, 0, 1);
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score || b.steps - a.steps);
  const { steps, distanceM, calories } = candidates[0];
  return { steps, distanceM, calories };
}

export function decodeQcBandTemperatureNotification(bytes: Uint8Array): number | null {
  if (bytes.length < 4 || bytes[0] !== QCBAND_CMD_NOTIFICATION || bytes[1] !== QCBAND_NOTIFICATION_TEMPERATURE) return null;
  return decodeQcBandTempPayload(bytes.slice(2));
}

export function decodeQcBandSpo2Notification(bytes: Uint8Array): number | null {
  if (bytes.length < 3 || bytes[0] !== QCBAND_CMD_NOTIFICATION || bytes[1] !== QCBAND_NOTIFICATION_BLOOD_OXYGEN) return null;
  const v = bytes[2] & 0xff;
  return v >= 70 && v <= 100 ? v : null;
}

export function decodeQcBandHistoricalActivity(
  bytes: Uint8Array,
): { key: string; steps: number; distanceM: number; calories: number; hour: number } | null {
  if (bytes.length < 13 || bytes[0] !== QCBAND_CMD_SYNC_ACTIVITY) return null;
  const marker = bytes[1] & 0xff;
  if (marker === 0xff || marker === 0xf0) return null;
  const currentYear = new Date().getFullYear() - 2000;
  const bestYear = (raw: number) => {
    const bin = raw & 0xff;
    const bcd = bcdByte(raw);
    return Math.abs(bin - currentYear) <= Math.abs(bcd - currentYear) ? bin : bcd;
  };
  const bestDateByte = (raw: number, max: number) => {
    const bin = raw & 0xff;
    const bcd = bcdByte(raw);
    if (bin >= 1 && bin <= max && !(bcd >= 1 && bcd <= max)) return bin;
    if (bcd >= 1 && bcd <= max && !(bin >= 1 && bin <= max)) return bcd;
    return bin;
  };
  const year = 2000 + bestYear(bytes[1]);
  const month = bestDateByte(bytes[2], 12);
  const day = bestDateByte(bytes[3], 31);
  const hour = Math.floor((bytes[4] & 0xff) / 4);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23) return null;
  const u16 = (i: number) => bytes[i] | (bytes[i + 1] << 8);
  const calories = u16(7);
  const steps = u16(9);
  const distanceM = u16(11);
  if (steps > 100_000 || distanceM > 100_000 || calories > 10_000) return null;
  const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}-${String(hour).padStart(2, "0")}`;
  return { key, steps, distanceM, calories, hour };
}

export function todayActivityKeyPrefix(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}-`;
}

export function decodeQcBandHrvHistory(bytes: Uint8Array): number | null {
  if (bytes.length < 4 || bytes[0] !== QCBAND_CMD_SYNC_HRV) return null;
  const packetNr = bytes[1] & 0xff;
  if (packetNr === 0xff) return null;
  const start = packetNr === 0 || packetNr === 1 ? 3 : 2;
  let latest: number | null = null;
  for (let i = start; i < bytes.length - 1; i++) {
    const v = bytes[i] & 0xff;
    // RMSSD values of 1–4 ms are not real HRV on these watches; they are
    // usually packet indexes / action echoes leaking through the SDK frame.
    if (v >= 5 && v < 250) latest = v;
  }
  return latest;
}

export function decodeQcBandStressHistory(bytes: Uint8Array): number | null {
  if (bytes.length < 4 || bytes[0] !== QCBAND_CMD_SYNC_STRESS) return null;
  const packetNr = bytes[1] & 0xff;
  if (packetNr === 0xff) return null;
  const start = packetNr === 0 || packetNr === 1 ? 3 : 2;
  let latest: number | null = null;
  for (let i = start; i < bytes.length - 1; i++) {
    const v = bytes[i] & 0xff;
    if (v > 0 && v <= 100) latest = v;
  }
  return latest;
}

function latestPlausibleTemperature(bytes: Uint8Array, start = 0): number | null {
  let latest: number | null = null;
  const accept = (t: number) => {
    if (Number.isFinite(t) && t >= 30 && t <= 42) latest = Math.round(t * 10) / 10;
  };
  for (let i = Math.max(0, start); i < bytes.length; i++) {
    const b = bytes[i] & 0xff;
    if (b > 0) accept(b / 10 + 20);
    if (i + 1 < bytes.length) {
      const le = b | (bytes[i + 1] << 8);
      const be = (b << 8) | bytes[i + 1];
      accept(le / 10);
      accept(le / 100);
      accept(be / 10);
      accept(be / 100);
    }
  }
  return latest;
}

export function decodeQcBandTemperatureHistory(bytes: Uint8Array): number | null {
  const tempTypes = [
    QCBAND_BIG_DATA_TYPE_TEMPERATURE,
    QCBAND_BIG_DATA_TYPE_TEMPERATURE_MANUAL,
    QCBAND_BIG_DATA_TYPE_TEMPERATURE_INTERVAL,
  ];
  if (bytes.length >= 5 && tempTypes.includes(bytes[0])) {
    // Some bridges deliver the SDK-unpacked payload directly, e.g. 0x74
    // interval temperature: [op, interval, pocketCount, pocketIndex, records...].
    return latestPlausibleTemperature(bytes, bytes[0] === QCBAND_BIG_DATA_TYPE_TEMPERATURE_INTERVAL ? 4 : 1);
  }
  if (bytes.length < 8 || bytes[0] !== QCBAND_CMD_BIG_DATA_V2 || !tempTypes.includes(bytes[1])) return null;
  const length = bytes[2] | (bytes[3] << 8);
  if (length <= 0) return null;
  if (bytes[1] === QCBAND_BIG_DATA_TYPE_TEMPERATURE_INTERVAL || bytes[1] === QCBAND_BIG_DATA_TYPE_TEMPERATURE_MANUAL) {
    return latestPlausibleTemperature(bytes.slice(6), bytes[1] === QCBAND_BIG_DATA_TYPE_TEMPERATURE_INTERVAL ? 4 : 0);
  }
  let idx = 6;
  let latestToday: number | null = null;
  let latestAny: number | null = null;
  while (idx - 6 < length && idx < bytes.length) {
    const daysAgo = bytes[idx++] & 0xff;
    if (idx >= bytes.length) break;
    idx++; // observed constant 0x1e / interval marker
    for (let hour = 0; hour < 24 && idx - 6 < length && idx < bytes.length; hour++) {
      for (let half = 0; half < 2 && idx - 6 < length && idx < bytes.length; half++) {
        const raw = bytes[idx++] & 0xff;
        if (raw > 0) {
          const temp = raw / 10 + 20;
          if (temp >= 30 && temp <= 42) {
            latestAny = temp;
            if (daysAgo === 0) latestToday = temp;
          }
        }
      }
    }
    if (daysAgo === 0) break;
  }
  return latestToday ?? latestAny ?? latestPlausibleTemperature(bytes.slice(6));
}

export function decodeQcBandSpo2History(bytes: Uint8Array): number | null {
  const spo2Types = [QCBAND_BIG_DATA_TYPE_SPO2, QCBAND_BIG_DATA_TYPE_SPO2_INTERVAL];
  if (bytes.length >= 5 && spo2Types.includes(bytes[0])) {
    let latest: number | null = null;
    for (let i = bytes[0] === QCBAND_BIG_DATA_TYPE_SPO2_INTERVAL ? 4 : 1; i < bytes.length; i++) {
      const v = bytes[i] & 0xff;
      if (v >= 70 && v <= 100) latest = v;
    }
    return latest;
  }
  if (bytes.length < 8 || bytes[0] !== QCBAND_CMD_BIG_DATA_V2 || !spo2Types.includes(bytes[1])) return null;
  if (bytes[1] === QCBAND_BIG_DATA_TYPE_SPO2_INTERVAL) {
    let latest: number | null = null;
    for (let i = 10; i < bytes.length; i++) {
      const v = bytes[i] & 0xff;
      if (v >= 70 && v <= 100) latest = v;
    }
    return latest;
  }
  const length = bytes[2] | (bytes[3] << 8);
  if (length <= 0) return null;
  let idx = 6;
  let latestToday: number | null = null;
  let latestAny: number | null = null;
  while (idx - 6 < length && idx < bytes.length) {
    const daysAgo = bytes[idx++] & 0xff;
    for (let hour = 0; hour < 24 && idx + 1 < bytes.length && idx - 6 < length; hour++) {
      const min = bytes[idx++] & 0xff;
      const max = bytes[idx++] & 0xff;
      if (min > 0 && max > 0) {
        const pct = Math.round((min + max) / 2);
        if (pct >= 70 && pct <= 100) {
          latestAny = pct;
          if (daysAgo === 0) latestToday = pct;
        }
      }
    }
    if (daysAgo === 0) break;
  }
  return latestToday ?? latestAny;
}

// ---- Measurement channel (0x69 / 0x6A) -----------------------------------
// All optical-sensor measurements share the same start/stop opcodes with a
// sub-type byte selecting which biometric to run. Response frames arrive as:
//   [0x69, sub_type, error_code, ...values]
// with shape per sub-type:
//   HR    (0x01): [op, st, err, bpm]
//   SpO2  (0x03): [op, st, err, percent]
//   Temp  (0x04): [op, st, err, temp_int, temp_frac]   (°C = int + frac/100)
//   HRV   (0x05): [op, st, err, rmssd_ms]
//   1-Key (0x06): [op, st, err, hr, sbp, dbp, spo2, temp_int, temp_frac, hrv, stress]
export function encodeQcBandMeasureStart(subType: number, action = 0x01): Uint8Array {
  // Command 0x69 is a DataRequest. Byte 2 is an action enum (Start=1), not a
  // duration. Sending 0x25 here makes newer QCBand/Colmi firmware ignore the
  // request, so manual skin-temp/HRV/stress reads never complete.
  return sdkCommand([QCBAND_CMD_START_MEASURE, subType, action]);
}
export function encodeQcBandMeasureStop(subType: number): Uint8Array {
  return sdkCommand([QCBAND_CMD_STOP_MEASURE, subType, 0x00, 0x00]);
}

// Back-compat wrappers used elsewhere.
export function encodeQcBandSpo2Start(): Uint8Array {
  return encodeQcBandMeasureStart(QCBAND_MEASURE_SPO2);
}
export function encodeQcBandSpo2Stop(): Uint8Array {
  return encodeQcBandMeasureStop(QCBAND_MEASURE_SPO2);
}

export type QcBandMeasureFrame = {
  subType: number;
  errorCode: number;
  /** First scalar value — bpm/%/etc. — kept for back-compat. */
  value: number;
  /** Full payload after [op, sub, err], for richer decoders. */
  data: Uint8Array;
};

export function decodeQcBandMeasureFrame(bytes: Uint8Array): QcBandMeasureFrame | null {
  if (bytes.length < 3) return null;
  if (bytes[0] !== QCBAND_CMD_START_MEASURE && bytes[0] !== QCBAND_CMD_STOP_MEASURE) return null;
  const newSdkNoErrorByte = ([
    QCBAND_MEASURE_HR_SDK,
    QCBAND_MEASURE_SPO2_SDK,
    QCBAND_MEASURE_ONE_KEY_SDK,
    QCBAND_MEASURE_STRESS_SDK,
    QCBAND_MEASURE_HRV_SDK,
    QCBAND_MEASURE_PRESSURE_SDK,
    QCBAND_MEASURE_TEMP_SDK,
    QCBAND_MEASURE_ONE_KEY_HR,
  ] as readonly number[]).includes(bytes[1]);
  if (newSdkNoErrorByte && bytes[2] !== 0) {
    return {
      subType: bytes[1],
      errorCode: 0,
      value: bytes[2],
      data: bytes.slice(2),
    };
  }
  return {
    subType: bytes[1],
    errorCode: bytes.length >= 4 ? bytes[2] : 0,
    value: bytes.length >= 4 ? bytes[3] : bytes[2],
    data: bytes.length >= 4 ? bytes.slice(3) : bytes.slice(2),
  };
}

/** Decode a one-key (sub_type 0x06) payload. Returns nulls for fields the
 *  firmware reports as 0 (means "not measured / not supported"). */
export function decodeQcBandOneKeyPayload(data: Uint8Array): {
  hr: number | null;
  sbp: number | null;
  dbp: number | null;
  spo2: number | null;
  tempC: number | null;
  hrvMs: number | null;
  stress: number | null;
  rriMs: number | null;
} | null {
  if (data.length < 4) return null;
  const validHr = (v: number) => (v > 30 && v < 220 ? v : null);
  const validSpo2 = (v: number) => (v >= 70 && v <= 100 ? v : null);
  const validHrv = (v: number) => (v >= 5 && v < 250 ? v : null);
  const validStress = (v: number) => (v > 0 && v <= 100 ? v : null);
  const validSbp = (v: number) => (v > 60 && v < 220 ? v : null);
  const validDbp = (v: number) => (v > 30 && v < 160 ? v : null);
  const u16 = (i: number) => (i + 1 < data.length ? data[i] | (data[i + 1] << 8) : 0);
  const tempFrom = (...values: number[]) => {
    for (const t of values) if (t >= 30 && t <= 42) return t;
    return null;
  };

  // Legacy composite: [hr, sbp, dbp, spo2, temp_int, temp_frac, hrv, stress].
  if (data.length >= 8) {
    const legacyTemp = tempFrom(data[4] + data[5] / 100, u16(4) / 10, u16(4) / 100);
    const legacySpo2 = validSpo2(data[3]);
    const legacyHrv = validHrv(data[6]);
    const legacyStress = validStress(data[7]);
    const legacy = {
      hr: validHr(data[0]),
      sbp: validSbp(data[1]),
      dbp: validDbp(data[2]),
      spo2: legacySpo2,
      tempC: legacyTemp,
      hrvMs: legacyHrv,
      stress: legacyStress,
      rriMs: null as number | null,
    };
    if (legacySpo2 != null || (legacyTemp != null && legacyHrv != null && legacyStress != null)) return legacy;
  }

  // New SDK real one-key HR model:
  // heartRateValue, heartRateHRV, stress, rri(ms), temp(0.1°C), sbp, dbp.
  const rriA = u16(3);
  const rriB = data[3] >= 300 && data[3] <= 2000 ? data[3] : null;
  const tempU16A = u16(5);
  const tempU16B = u16(4);
  const sdkTemp = tempFrom(tempU16A / 10, tempU16A / 100, tempU16B / 10, tempU16B / 100, data[4] / 10, data[5] / 10);
  return {
    hr: validHr(data[0]),
    sbp: data.length >= 9 ? validSbp(data[7]) : data.length >= 7 ? validSbp(data[5]) : null,
    dbp: data.length >= 9 ? validDbp(data[8]) : data.length >= 8 ? validDbp(data[6]) : null,
    spo2: data.length >= 4 ? validSpo2(data[3]) : null,
    tempC: sdkTemp,
    hrvMs: validHrv(data[1]),
    stress: validStress(data[2]),
    rriMs: rriA >= 300 && rriA <= 2000 ? rriA : rriB,
  };
}

export function decodeQcBandBloodPressurePayload(data: Uint8Array): {
  sbp: number;
  dbp: number;
  hr: number | null;
} | null {
  if (data.length < 3) return null;
  const validHr = (v: number) => (v > 30 && v < 220 ? v : null);
  const validSbp = (v: number) => (v > 60 && v < 220 ? v : null);
  const validDbp = (v: number) => (v > 30 && v < 160 ? v : null);

  // Direct BP measure frame from Oudmon/QCBand:
  // [0x69, 0x02, 0x00, heartRate, systolic, diastolic, ...]
  const direct = {
    hr: validHr(data[0]),
    sbp: validSbp(data[1]),
    dbp: validDbp(data[2]),
  };
  if (direct.sbp != null && direct.dbp != null) {
    return { sbp: direct.sbp, dbp: direct.dbp, hr: direct.hr };
  }

  // Some firmwares omit HR and only send [systolic, diastolic].
  const compact = {
    sbp: validSbp(data[0]),
    dbp: validDbp(data[1]),
  };
  if (compact.sbp != null && compact.dbp != null) {
    return { sbp: compact.sbp, dbp: compact.dbp, hr: null };
  }

  return null;
}

/** Decode a temperature payload. Handles both `[int, frac]` and
 *  `[frac, int]` byte orders seen across QCBand firmwares, and also a
 *  little-endian fixed-point 16-bit value (×100). */
export function decodeQcBandTempPayload(data: Uint8Array): number | null {
  if (data.length < 1) return null;
  const u16le = data.length >= 2 ? data[0] | (data[1] << 8) : NaN;
  const u16be = data.length >= 2 ? (data[0] << 8) | data[1] : NaN;
  const candidates = [
    data[0],
    data[0] / 10,
    data[0] / 10 + 20,
    data.length >= 2 ? data[0] + data[1] / 100 : NaN,
    data.length >= 2 ? data[1] + data[0] / 100 : NaN,
    u16le / 10,
    u16le / 100,
    u16be / 10,
    u16be / 100,
  ];
  for (const t of candidates) {
    if (t >= 30 && t <= 42) return t;
  }
  return null;
}
