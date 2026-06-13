// QCBand/Oudmon watch SDK BLE protocol helpers.
// Source: uploaded QCBandSDK iOS guide/framework. These watches do not expose
// live HR through the Bluetooth SIG Heart Rate service; the SDK starts the
// optical sensor by writing a 16-byte command to the proprietary service.

export const QCBAND_SERVICE_UUID = "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e";
export const QCBAND_WRITE_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
export const QCBAND_NOTIFY_CHAR_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

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

export function encodeQcBandRealtimeHeartRate(type: QcBandRealtimeHrCommand): Uint8Array {
  return sdkCommand([0x1e, REALTIME_HR_COMMAND[type]]);
}

export function decodeQcBandRealtimeHeartRate(bytes: Uint8Array): number | null {
  if (bytes.length < 2) return null;
  if (bytes[0] !== 0x1e) return null;
  const bpm = bytes[1];
  return bpm > 0 && bpm < 250 ? bpm : null;
}