import { describe, expect, it } from "vitest";
import {
  bytesToHex,
  encodeEndSession,
  encodePauseSession,
  encodeSportTag,
  encodeStartSession,
} from "./session-control";

describe("session control encoding", () => {
  it("frames START with the sport tag payload", () => {
    expect(Array.from(encodeStartSession("squash"))).toEqual([0x01, 0x01, 0x01]);
    expect(Array.from(encodeStartSession("tennis"))).toEqual([0x01, 0x01, 0x02]);
  });

  it("frames payload-free commands with a zero length byte", () => {
    expect(Array.from(encodePauseSession())).toEqual([0x02, 0x00]);
    expect(Array.from(encodeEndSession())).toEqual([0x03, 0x00]);
  });

  it("re-tags sport mid-session without restarting", () => {
    expect(Array.from(encodeSportTag("tennis"))).toEqual([0x04, 0x01, 0x02]);
  });

  it("renders bytes as zero-padded hex for the native bridge", () => {
    expect(bytesToHex(new Uint8Array([0x00, 0x0f, 0xff]))).toMatch(/000fff/i);
  });
});
