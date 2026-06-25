// Session Control writes for the VYRO band (characteristic f8a90003-...).
//
// The firmware exposes a WRITE-with-response characteristic; the v1 docs
// do not lock a payload schema for control commands yet, so we adopt a
// minimal, forward-compatible envelope mirroring the event-packet header:
//
//   Byte 0: command code (uint8)
//   Byte 1: payload length (uint8)
//   Bytes 2..: optional payload
//
// Command codes are app-defined and chosen to not collide with the
// event-packet codes (those occupy 0x10–0x13):
//
//   0x01 START      payload: 1 byte sport tag
//   0x02 PAUSE      no payload
//   0x03 END        no payload
//   0x04 SPORT_TAG  payload: 1 byte sport tag (re-tag mid-session)
//
// Sport tag values: 1 = squash, 2 = tennis. Keep small / forward-compatible.

export const SESSION_CMD = {
  START: 0x01,
  PAUSE: 0x02,
  END: 0x03,
  SPORT_TAG: 0x04,
} as const;

export type Sport = "squash" | "tennis";

export const SPORT_TAG: Record<Sport, number> = {
  squash: 1,
  tennis: 2,
};

function envelope(code: number, payload: number[] = []): Uint8Array {
  const out = new Uint8Array(2 + payload.length);
  out[0] = code;
  out[1] = payload.length;
  for (let i = 0; i < payload.length; i++) out[2 + i] = payload[i];
  return out;
}

export function encodeStartSession(sport: Sport): Uint8Array {
  return envelope(SESSION_CMD.START, [SPORT_TAG[sport]]);
}

export function encodePauseSession(): Uint8Array {
  return envelope(SESSION_CMD.PAUSE);
}

export function encodeEndSession(): Uint8Array {
  return envelope(SESSION_CMD.END);
}

export function encodeSportTag(sport: Sport): Uint8Array {
  return envelope(SESSION_CMD.SPORT_TAG, [SPORT_TAG[sport]]);
}

/** Render bytes as a hex string suitable for the Despia BLE write bridge. */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
