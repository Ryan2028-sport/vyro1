import { describe, expect, it } from "vitest";
import { cborDecode, cborEncode } from "./cbor";

describe("cbor", () => {
  it("round-trips the SMP payload shapes the OTA updater sends", () => {
    const value = {
      image: 0,
      len: 262144,
      sha: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
      upgrade: false,
    };
    expect(cborDecode(cborEncode(value))).toEqual(value);
  });

  it("round-trips nested containers", () => {
    const value = { images: [{ slot: 0, version: "1.0.21" }, { slot: 1, version: "1.0.20" }] };
    expect(cborDecode(cborEncode(value))).toEqual(value);
  });

  it("encodes small integers in a single byte", () => {
    expect(Array.from(cborEncode(0))).toEqual([0x00]);
    expect(Array.from(cborEncode(23))).toEqual([0x17]);
  });

  it("throws instead of silently truncating a short read", () => {
    expect(() => cborDecode(new Uint8Array([0x18]))).toThrow();
  });
});
