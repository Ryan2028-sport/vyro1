import { describe, expect, it } from "vitest";
import {
  decodeMotionEvent,
  decodeMotionEventFromString,
  hexToBytes,
} from "./packets";
import {
  decodeQcBandTemperatureHistory,
  decodeQcBandTodaySports,
  decodeQcBandTodaySummary,
  encodeQcBandTemperatureHistoryRequest,
  QCBAND_BIG_DATA_TYPE_TEMPERATURE_INTERVAL,
  QCBAND_CMD_BIG_DATA_V2,
} from "./qcband";

describe("decodeMotionEvent — swing reference vector", () => {
  // From VYRO_BLE_Packet_Reference v1 "Worked Example":
  // intensity 89, 2.62 g, 1346 dps, 447 ms, fwd -1.76, lr +1.73, ud +0.89
  const HEX = "10 0D 59 06 01 42 05 BF 01 50 FF AD 00 59 00";
  it("decodes the reference swing packet", () => {
    const ev = decodeMotionEvent(hexToBytes(HEX));
    expect(ev.type).toBe("swing");
    if (ev.type !== "swing") return;
    expect(ev.intensity).toBe(89);
    expect(ev.accelPeakG.value).toBeCloseTo(2.62, 2);
    expect(ev.gyroPeakDps.value).toBe(1346);
    expect(ev.durationMs).toBe(447);
    expect(ev.refFwdG.value).toBeCloseTo(-1.76, 2);
    expect(ev.refLrG.value).toBeCloseTo(1.73, 2);
    expect(ev.refUdG.value).toBeCloseTo(0.89, 2);
    expect(ev.accelPeakG.saturated).toBe(false);
  });

  it("accepts hex via decodeMotionEventFromString", () => {
    const ev = decodeMotionEventFromString(HEX);
    expect(ev.type).toBe("swing");
  });

  it("flags saturated values", () => {
    // accel peak = +32767 (saturated)
    const bytes = hexToBytes("10 0D 00 FF 7F 00 00 00 00 00 00 00 00 00 00");
    const ev = decodeMotionEvent(bytes);
    if (ev.type !== "swing") throw new Error("wrong type");
    expect(ev.accelPeakG.saturated).toBe(true);
  });
});

describe("decodeMotionEvent — rapid/burst/dir_change shapes", () => {
  it("rapid_start has type code 0x11", () => {
    const bytes = hexToBytes(
      "11 0C 64 00 0A 00 00 04 64 00 32 00 00 00",
    );
    const ev = decodeMotionEvent(bytes);
    expect(ev.type).toBe("rapid_start");
  });
  it("burst has type code 0x12", () => {
    const bytes = hexToBytes(
      "12 0C 64 00 0A 00 00 04 64 00 32 00 00 00",
    );
    const ev = decodeMotionEvent(bytes);
    expect(ev.type).toBe("burst");
  });
  it("direction_change has type code 0x13 and 14 byte payload", () => {
    const bytes = hexToBytes(
      "13 0E 50 00 00 04 C8 00 64 00 00 00 00 00 64 00",
    );
    const ev = decodeMotionEvent(bytes);
    expect(ev.type).toBe("direction_change");
    if (ev.type !== "direction_change") return;
    expect(ev.gapMs).toBe(200);
  });
});

describe("decodeMotionEvent — error cases", () => {
  it("rejects unknown type codes", () => {
    expect(() => decodeMotionEvent(hexToBytes("99 00"))).toThrow();
  });
  it("rejects truncated packets", () => {
    expect(() => decodeMotionEvent(hexToBytes("10 0D 59"))).toThrow();
  });
});

describe("QCBand SDK metric decoders", () => {
  it("decodes current sport/steps as SDK big-endian 24-bit counters", () => {
    const packet = hexToBytes("48 00 04 D2 00 00 2A 00 01 2C 00 03 E8 00 00 00");
    expect(decodeQcBandTodaySports(packet)).toMatchObject({
      steps: 1234,
      runningSteps: 42,
      calories: 300,
      distanceM: 1000,
    });
  });

  it("decodes legacy day-total steps from the SDK 0x07 layout", () => {
    const packet = hexToBytes("07 00 00 00 00 00 00 04 D2 00 00 2A 00 01 2C 00");
    expect(decodeQcBandTodaySummary(packet)).toMatchObject({
      steps: 1234,
      calories: 300,
    });
  });

  it("requests and decodes interval skin temperature using SDK opcode 0x74", () => {
    expect(Array.from(encodeQcBandTemperatureHistoryRequest())).toEqual([
      QCBAND_CMD_BIG_DATA_V2,
      QCBAND_BIG_DATA_TYPE_TEMPERATURE_INTERVAL,
      2,
      0,
      255,
      255,
      0,
      0,
    ]);
    // V2 wrapper + unpacked 0x74 payload header + one 6-byte record:
    // temp1=36.5, temp2=36.6, temp3=36.7 in 0.1°C little-endian units.
    const packet = hexToBytes("BC 74 0A 00 FF FF 74 01 01 00 6D 01 6E 01 6F 01");
    expect(decodeQcBandTemperatureHistory(packet)).toBeCloseTo(36.7, 1);
  });
});
