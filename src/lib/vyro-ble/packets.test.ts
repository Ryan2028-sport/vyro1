import { describe, expect, it } from "vitest";
import { hexToBytes } from "./packets";

describe("hexToBytes", () => {
  it("tolerates the separators BLE sniffers emit", () => {
    expect(Array.from(hexToBytes("10 0D:59"))).toEqual([0x10, 0x0d, 0x59]);
  });

  it("rejects an odd nibble count rather than guessing", () => {
    expect(() => hexToBytes("10 0")).toThrow();
  });
});
