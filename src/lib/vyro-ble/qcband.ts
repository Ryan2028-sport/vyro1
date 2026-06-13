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
export const QCBAND_CMD_REALTIME_HR = 0x1e;      // 30 — start/end/hold poll
export const QCBAND_CMD_START_MEASURE = 0x69;    // 105 — start HR or SpO2
export const QCBAND_CMD_STOP_MEASURE = 0x6a;     // 106 — stop HR or SpO2

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

// ---- SpO2 (cmd 0x69 / 0x6A, sub-type 0x03) -------------------------------
// Same start/stop opcodes used for HR (sub-type 0x01) but with sub-type 0x03
// to put the optical sensor in SpO₂ mode. Response arrives as 0x69 frames
// shaped as: [0x69, type, error_code, value, ...].
export function encodeQcBandSpo2Start(): Uint8Array {
  // payload [0x03, 0x25] — sub-type=SpO2, duration marker (matches vendor app).
  return sdkCommand([QCBAND_CMD_START_MEASURE, 0x03, 0x25]);
}

export function encodeQcBandSpo2Stop(): Uint8Array {
  return sdkCommand([QCBAND_CMD_STOP_MEASURE, 0x03, 0x00, 0x00]);
}

export function decodeQcBandMeasureFrame(
  bytes: Uint8Array,
): { subType: number; errorCode: number; value: number } | null {
  if (bytes.length < 4) return null;
  if (bytes[0] !== QCBAND_CMD_START_MEASURE) return null;
  return { subType: bytes[1], errorCode: bytes[2], value: bytes[3] };
}
