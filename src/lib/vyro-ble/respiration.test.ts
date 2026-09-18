import { describe, expect, it } from "vitest";
import { estimateRespirationFromHeartRate } from "./respiration";

function stream(
  count: number,
  stepMs: number,
  bpm: (i: number) => number,
  startedAt = 1_700_000_000_000,
) {
  return Array.from({ length: count }, (_, i) => ({ t: startedAt + i * stepMs, bpm: bpm(i) }));
}

describe("estimateRespirationFromHeartRate", () => {
  it("returns null before there is enough PPG data to trust", () => {
    expect(estimateRespirationFromHeartRate([])).toBeNull();
    expect(estimateRespirationFromHeartRate(stream(10, 1000, () => 60))).toBeNull();
  });

  it("returns null when the sensor stream is too sparse", () => {
    // 30s gaps: enough samples, no usable respiratory band.
    expect(estimateRespirationFromHeartRate(stream(40, 30_000, () => 62))).toBeNull();
  });

  it("recovers a plausible rate from respiratory sinus arrhythmia", () => {
    // 12 breaths/min modulation (0.2 Hz) on a 1 Hz HR stream over 2 minutes.
    const samples = stream(120, 1000, (i) => 62 + 4 * Math.sin(2 * Math.PI * 0.2 * i));
    const result = estimateRespirationFromHeartRate(samples);
    expect(result).not.toBeNull();
    expect(result!.brpm).toBeGreaterThanOrEqual(6);
    expect(result!.brpm).toBeLessThanOrEqual(30);
    expect(result!.sampleCount).toBeGreaterThan(30);
  });

  it("discards non-physiological heart rates before analysing", () => {
    const samples = stream(120, 1000, (i) => (i % 2 ? 400 : 5));
    expect(estimateRespirationFromHeartRate(samples)).toBeNull();
  });
});
