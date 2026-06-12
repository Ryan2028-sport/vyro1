// VYRO motion event packet decoder.
// Wire format: VYRO_BLE_Packet_Reference v1.
//   Byte 0: packet_type (uint8)
//   Byte 1: payload_length (uint8)
//   Bytes 2..N: little-endian payload (see per-type layout below).
//
// Fixed-point scales (locked v1):
//   accel / direction:  int16  -> g  = value / 100
//   gyro:               int16  -> dps
//   jerk:               int16  -> g/s
//   duration / gap:     uint16 -> ms
//   intensity:          uint8  -> 0..100

export const PACKET_TYPE = {
  SWING: 0x10,
  RAPID_START: 0x11,
  BURST: 0x12,
  DIR_CHANGE: 0x13,
} as const;

export type PacketTypeCode = (typeof PACKET_TYPE)[keyof typeof PACKET_TYPE];

/** A scalar that may have hit the int16 rail (saturated reading). */
export interface SatValue {
  value: number;
  saturated: boolean;
}

const SAT_MIN = -32768;
const SAT_MAX = 32767;

function sat(int16: number, scale = 1): SatValue {
  return {
    value: int16 / scale,
    saturated: int16 === SAT_MIN || int16 === SAT_MAX,
  };
}

export interface SwingEvent {
  type: "swing";
  code: 0x10;
  intensity: number;
  accelPeakG: SatValue;
  gyroPeakDps: SatValue;
  durationMs: number;
  refFwdG: SatValue;
  refLrG: SatValue;
  refUdG: SatValue;
}

export interface RapidStartEvent {
  type: "rapid_start";
  code: 0x11;
  accelPeakG: SatValue;
  jerkPeakGps: SatValue;
  gyroPeakDps: SatValue;
  durationMs: number;
  refFwdG: SatValue;
  refLrG: SatValue;
}

export interface BurstEvent {
  type: "burst";
  code: 0x12;
  accelPeakG: SatValue;
  jerkPeakGps: SatValue;
  gyroPeakDps: SatValue;
  durationMs: number;
  refFwdG: SatValue;
  refLrG: SatValue;
}

export interface DirectionChangeEvent {
  type: "direction_change";
  code: 0x13;
  accelPeakG: SatValue;
  gyroPeakDps: SatValue;
  gapMs: number;
  prevFwdG: SatValue;
  prevLrG: SatValue;
  currFwdG: SatValue;
  currLrG: SatValue;
}

export type VyroMotionEvent =
  | SwingEvent
  | RapidStartEvent
  | BurstEvent
  | DirectionChangeEvent;

export class DecodeError extends Error {}

function asBytes(input: ArrayBuffer | Uint8Array | DataView): Uint8Array {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
}

/** Decode a single motion event packet. Throws DecodeError on bad input. */
export function decodeMotionEvent(
  input: ArrayBuffer | Uint8Array | DataView,
): VyroMotionEvent {
  const bytes = asBytes(input);
  if (bytes.length < 2) throw new DecodeError("packet too short");
  const type = bytes[0];
  const payloadLen = bytes[1];
  if (bytes.length < 2 + payloadLen) {
    throw new DecodeError(
      `truncated: header says ${payloadLen} payload bytes, got ${bytes.length - 2}`,
    );
  }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const i16 = (off: number) => dv.getInt16(off, true);
  const u16 = (off: number) => dv.getUint16(off, true);

  switch (type) {
    case PACKET_TYPE.SWING: {
      if (payloadLen !== 13) throw new DecodeError("swing: bad length");
      return {
        type: "swing",
        code: 0x10,
        intensity: bytes[2],
        accelPeakG: sat(i16(3), 100),
        gyroPeakDps: sat(i16(5)),
        durationMs: u16(7),
        refFwdG: sat(i16(9), 100),
        refLrG: sat(i16(11), 100),
        refUdG: sat(i16(13), 100),
      };
    }
    case PACKET_TYPE.RAPID_START:
    case PACKET_TYPE.BURST: {
      if (payloadLen !== 12) throw new DecodeError("rapid/burst: bad length");
      const base = {
        accelPeakG: sat(i16(2), 100),
        jerkPeakGps: sat(i16(4)),
        gyroPeakDps: sat(i16(6)),
        durationMs: u16(8),
        refFwdG: sat(i16(10), 100),
        refLrG: sat(i16(12), 100),
      };
      return type === PACKET_TYPE.RAPID_START
        ? { type: "rapid_start", code: 0x11, ...base }
        : { type: "burst", code: 0x12, ...base };
    }
    case PACKET_TYPE.DIR_CHANGE: {
      if (payloadLen !== 14) throw new DecodeError("dir_change: bad length");
      return {
        type: "direction_change",
        code: 0x13,
        accelPeakG: sat(i16(2), 100),
        gyroPeakDps: sat(i16(4)),
        gapMs: u16(6),
        prevFwdG: sat(i16(8), 100),
        prevLrG: sat(i16(10), 100),
        currFwdG: sat(i16(12), 100),
        currLrG: sat(i16(14), 100),
      };
    }
    default:
      throw new DecodeError(`unknown packet type 0x${type.toString(16)}`);
  }
}

/** Parse a hex string ("10 0D 59 ...") into bytes. Tolerates colons/spaces. */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  if (clean.length % 2) throw new DecodeError("odd hex length");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++)
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

/** Decode a base64 (Despia native delivery format) string into bytes. */
export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Auto-detect hex vs base64 delivery. */
export function decodeMotionEventFromString(value: string): VyroMotionEvent {
  // Hex if it only contains hex chars/whitespace/colons and has even nibble count.
  const isHex =
    /^[0-9a-fA-F\s:]+$/.test(value) &&
    value.replace(/[^0-9a-fA-F]/g, "").length % 2 === 0;
  return decodeMotionEvent(isHex ? hexToBytes(value) : base64ToBytes(value));
}
