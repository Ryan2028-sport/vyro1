// QCBand/Oudmon watch SDK BLE protocol helpers.
// Source: uploaded QCBandSDK iOS guide/framework + community reverse engineering
// of the Oudmon protocol (atc1441/ATC_RF03_Ring, tahnok/colmi_r02_client).
// All commands share the same 16-byte frame:
//   [opcode, ...payload(up to 14), checksum=sum(bytes 0..14) & 0xFF]
// served over the FFF0 Nordic-UART-style service.

export const QCBAND_SERVICE_UUID = "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e";
export const QCBAND_WRITE_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
export const QCBAND_NOTIFY_CHAR_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

// Opcodes (selected — see Oudmon protocol).
export const QCBAND_CMD_BATTERY = 0x03;          // 3
export const QCBAND_CMD_TODAY_SUMMARY = 0x09;    // 9 — steps/distance/calories
export const QCBAND_CMD_REALTIME_HR = 0x1e;      // 30 — start/end/hold poll
export const QCBAND_CMD_START_MEASURE = 0x69;    // 105 — start HR/SpO2/temp/one-key
export const QCBAND_CMD_STOP_MEASURE = 0x6a;     // 106 — stop measurement

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
export const QCBAND_MEASURE_ONE_KEY = 0x05; // legacy composite
export const QCBAND_MEASURE_ONE_KEY_SDK = 0x03;
export const QCBAND_MEASURE_STRESS_SDK = 0x04;
export const QCBAND_MEASURE_HRV_SDK = 0x06;
export const QCBAND_MEASURE_TEMP_SDK = 0x07;
export const QCBAND_MEASURE_TEMP = 0x09;
export const QCBAND_MEASURE_ONE_KEY_HR = 0x09; // SDK real one-key HR stream
export const QCBAND_MEASURE_STRESS = 0x0d;
export const QCBAND_MEASURE_HRV = 0x0e;

export const QCBAND_MEASURE_HR_TYPES = [QCBAND_MEASURE_HR, QCBAND_MEASURE_HR_SDK] as const;
export const QCBAND_MEASURE_SPO2_TYPES = [QCBAND_MEASURE_SPO2, QCBAND_MEASURE_SPO2_SDK] as const;
export const QCBAND_MEASURE_ONE_KEY_TYPES = [QCBAND_MEASURE_ONE_KEY_HR, QCBAND_MEASURE_ONE_KEY, QCBAND_MEASURE_ONE_KEY_SDK] as const;
export const QCBAND_MEASURE_TEMP_TYPES = [QCBAND_MEASURE_TEMP_SDK, QCBAND_MEASURE_TEMP] as const;
export const QCBAND_MEASURE_STRESS_TYPES = [QCBAND_MEASURE_STRESS, QCBAND_MEASURE_STRESS_SDK] as const;
export const QCBAND_MEASURE_HRV_TYPES = [QCBAND_MEASURE_HRV, QCBAND_MEASURE_HRV_SDK] as const;

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
//   0x15 — Colmi R02 family ("activity totals")
// Request format is always [opcode | 0x00 ...], with the day index optionally
// at byte 1 (0 = today). We send all three on each poll; only the supported
// one will respond.
export const QCBAND_CMD_STEPS_ALT1 = 0x07;
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

export function decodeQcBandTodaySummary(
  bytes: Uint8Array,
): { steps: number; distanceM: number; calories: number } | null {
  if (bytes.length < 8) return null;
  const op = bytes[0];
  if (
    op !== QCBAND_CMD_TODAY_SUMMARY &&
    op !== QCBAND_CMD_STEPS_ALT1 &&
    op !== QCBAND_CMD_STEPS_ALT2
  )
    return null;
  const u16 = (i: number) => bytes[i] | (bytes[i + 1] << 8);
  const u24 = (i: number) => bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16);
  const u32 = (i: number) => (bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24)) >>> 0;
  const candidates: Array<{ steps: number; distanceM: number; calories: number; score: number }> = [];

  const push = (steps: number, distanceM: number, calories: number, score = 0) => {
    if (!Number.isFinite(steps) || steps < 0 || steps > 200_000) return;
    if (!Number.isFinite(distanceM) || distanceM < 0 || distanceM > 250_000) return;
    if (!Number.isFinite(calories) || calories < 0 || calories > 25_000) return;
    // A single 0xff status byte can otherwise decode as a bogus stuck 255
    // steps value. Prefer richer layouts when they exist.
    if (steps === 255 && bytes[1] === 0xff && bytes.slice(2).some((b) => b !== 0)) score -= 10;
    candidates.push({ steps, distanceM, calories, score });
  };

  // Canonical layout: [op, steps(3), dist(2), cal(2)].
  push(u24(1), u16(4), u16(6), 4);
  // SDK/day-index layout: [op, day/status, steps(3), dist(2), cal(2)].
  if (bytes.length >= 9) push(u24(2), u16(5), u16(7), 6);
  // Several watches use 32-bit counters after one status/day byte.
  if (bytes.length >= 11) push(u32(2), u16(6), u16(8), 8);
  // Alternate current-sport layouts seen in QCSportModel dumps.
  if (bytes.length >= 13) push(u32(1), u32(9), u32(5), 5);
  if (bytes.length >= 13) push(u32(2), u32(10), u32(6), 7);

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score || b.steps - a.steps);
  const { steps, distanceM, calories } = candidates[0];
  return { steps, distanceM, calories };
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
export function encodeQcBandMeasureStart(subType: number, duration = 0x25): Uint8Array {
  return sdkCommand([QCBAND_CMD_START_MEASURE, subType, duration]);
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
  const validHrv = (v: number) => (v > 0 && v < 250 ? v : null);
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
    const legacy = {
      hr: validHr(data[0]),
      sbp: validSbp(data[1]),
      dbp: validDbp(data[2]),
      spo2: validSpo2(data[3]),
      tempC: legacyTemp,
      hrvMs: validHrv(data[6]),
      stress: validStress(data[7]),
      rriMs: null as number | null,
    };
    const populated = Object.values(legacy).filter((v) => v != null).length;
    if (populated >= 3) return legacy;
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

/** Decode a temperature payload. Handles both `[int, frac]` and
 *  `[frac, int]` byte orders seen across QCBand firmwares, and also a
 *  little-endian fixed-point 16-bit value (×100). */
export function decodeQcBandTempPayload(data: Uint8Array): number | null {
  if (data.length < 2) return null;
  const candidates = [
    data[0] + data[1] / 100,
    data[1] + data[0] / 100,
    (data[0] | (data[1] << 8)) / 100,
  ];
  for (const t of candidates) {
    if (t >= 30 && t <= 42) return t;
  }
  return null;
}
