import { describe, expect, it } from "vitest";
import { estimateRespirationFromHeartRate } from "./respiration";

describe("PPG respiration estimator", () => {
  it("recovers a clear 15 brpm respiratory modulation", () => {
    const start = 1_700_000_000_000;
    const samples = Array.from({ length: 100 }, (_, index) => ({
      t: start + index * 1_000,
      bpm: 62 + 3 * Math.sin(2 * Math.PI * 0.25 * index),
    }));
    const estimate = estimateRespirationFromHeartRate(samples);
    expect(estimate?.brpm).toBeCloseTo(15, 0);
    expect(estimate?.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("rejects short or flat HR windows", () => {
    const start = 1_700_000_000_000;
    expect(estimateRespirationFromHeartRate(Array.from({ length: 30 }, (_, index) => ({ t: start + index * 1_000, bpm: 62 })))).toBeNull();
    expect(estimateRespirationFromHeartRate(Array.from({ length: 70 }, (_, index) => ({ t: start + index * 1_000, bpm: 62 })))).toBeNull();
  });

  it("rejects a window with a long sensor dropout", () => {
    const start = 1_700_000_000_000;
    const samples = Array.from({ length: 80 }, (_, index) => ({
      t: start + index * 1_000 + (index > 40 ? 20_000 : 0),
      bpm: 64 + 2 * Math.sin(2 * Math.PI * 0.2 * index),
    }));
    expect(estimateRespirationFromHeartRate(samples)).toBeNull();
  });
});