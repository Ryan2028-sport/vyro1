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

// Measurement sub-types under 0x69 / 0x6A.
export const QCBAND_MEASURE_HR = 0x01;
export const QCBAND_MEASURE_BP = 0x02;
export const QCBAND_MEASURE_SPO2 = 0x03;
export const QCBAND_MEASURE_TEMP = 0x04;
export const QCBAND_MEASURE_HRV = 0x05;
export const QCBAND_MEASURE_ONE_KEY = 0x06; // returns HR + HRV + SpO2 + Temp + Stress

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

// ---- Today summary / steps (0x09) ----------------------------------------
// Response payload (after opcode): steps_lo, steps_hi, steps_hi2, distance_lo,
// distance_hi, cal_lo, cal_hi (units: steps, meters, kcal). Some firmwares
// pad the high byte — we mask defensively and only emit when the value is
// plausible (< 200000 steps/day).
export function encodeQcBandStepsRequest(): Uint8Array {
  return sdkCommand([QCBAND_CMD_TODAY_SUMMARY]);
}

export function decodeQcBandTodaySummary(
  bytes: Uint8Array,
): { steps: number; distanceM: number; calories: number } | null {
  if (bytes.length < 8) return null;
  if (bytes[0] !== QCBAND_CMD_TODAY_SUMMARY) return null;
  const steps = bytes[1] | (bytes[2] << 8) | (bytes[3] << 16);
  const distanceM = bytes[4] | (bytes[5] << 8);
  const calories = bytes[6] | (bytes[7] << 8);
  if (steps < 0 || steps > 200_000) return null;
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
  if (bytes.length < 4) return null;
  if (bytes[0] !== QCBAND_CMD_START_MEASURE) return null;
  return {
    subType: bytes[1],
    errorCode: bytes[2],
    value: bytes[3],
    data: bytes.slice(3),
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
} | null {
  if (data.length < 8) return null;
  const hr = data[0];
  const sbp = data[1];
  const dbp = data[2];
  const spo2 = data[3];
  const tempInt = data[4];
  const tempFrac = data[5];
  const hrv = data[6];
  const stress = data[7];
  const tempC = tempInt > 0 ? tempInt + tempFrac / 100 : 0;
  return {
    hr: hr > 30 && hr < 220 ? hr : null,
    sbp: sbp > 60 && sbp < 220 ? sbp : null,
    dbp: dbp > 30 && dbp < 160 ? dbp : null,
    spo2: spo2 >= 70 && spo2 <= 100 ? spo2 : null,
    tempC: tempC >= 30 && tempC <= 42 ? tempC : null,
    hrvMs: hrv > 0 && hrv < 250 ? hrv : null,
    stress: stress > 0 && stress <= 100 ? stress : null,
  };
}

/** Decode a temperature (sub_type 0x04) payload. */
export function decodeQcBandTempPayload(data: Uint8Array): number | null {
  if (data.length < 2) return null;
  const tempC = data[0] + data[1] / 100;
  return tempC >= 30 && tempC <= 42 ? tempC : null;
}
