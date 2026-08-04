export type HeartRateSample = { t: number; bpm: number };

export type RespirationEstimate = {
  brpm: number;
  confidence: number;
  sampleCount: number;
  windowSeconds: number;
};

/**
 * Estimates respiratory rate from respiratory sinus arrhythmia in the band's
 * live PPG heart-rate stream. This is a sensor-derived value: it is only
 * returned when there is enough recent, evenly covered PPG data and a clear
 * spectral peak in the physiological breathing range (6–30 breaths/min).
 */
export function estimateRespirationFromHeartRate(
  samples: readonly HeartRateSample[],
): RespirationEstimate | null {
  if (samples.length < 30) return null;
  const end = samples[samples.length - 1]?.t;
  if (end == null) return null;
  const windowed = samples
    .filter((sample) => end - sample.t <= 3 * 60_000 && sample.bpm >= 35 && sample.bpm <= 220)
    .sort((a, b) => a.t - b.t);
  if (windowed.length < 30) return null;

  // The optical HR stream is paused whenever another measurement owns the
  // sensor, which leaves multi-second holes. Analyse the longest continuous
  // run instead of discarding the whole window because of a hold.
  const segments: HeartRateSample[][] = [];
  let current: HeartRateSample[] = [];
  for (const sample of windowed) {
    const prev = current[current.length - 1];
    if (prev && sample.t - prev.t > 12_000) {
      segments.push(current);
      current = [];
    }
    current.push(sample);
  }
  if (current.length) segments.push(current);
  const recent = segments
    .slice()
    .sort((a, b) => (b[b.length - 1].t - b[0].t) - (a[a.length - 1].t - a[0].t))[0];
  if (!recent || recent.length < 30) return null;
  const start = recent[0]?.t;
  const segmentEnd = recent[recent.length - 1]?.t;
  if (start == null || segmentEnd == null) return null;
  const spanSeconds = (segmentEnd - start) / 1000;
  if (spanSeconds < 45) return null;

  const gaps: number[] = [];
  for (let i = 1; i < recent.length; i++) gaps.push((recent[i].t - recent[i - 1].t) / 1000);
  gaps.sort((a, b) => a - b);
  const medianGap = gaps[Math.floor(gaps.length / 2)] ?? Infinity;
  if (medianGap > 6) return null;


  // Remove the linear HR trend before testing respiratory frequencies. A
  // Lomb-style projection works directly on the bridge's irregular timestamps.
  const times = recent.map((sample) => (sample.t - start) / 1000);
  const values = recent.map((sample) => sample.bpm);
  const meanT = times.reduce((sum, value) => sum + value, 0) / times.length;
  const meanY = values.reduce((sum, value) => sum + value, 0) / values.length;
  let covariance = 0;
  let timeVariance = 0;
  for (let i = 0; i < times.length; i++) {
    covariance += (times[i] - meanT) * (values[i] - meanY);
    timeVariance += (times[i] - meanT) ** 2;
  }
  const slope = timeVariance > 0 ? covariance / timeVariance : 0;
  const residuals = values.map((value, index) => value - (meanY + slope * (times[index] - meanT)));
  const residualVariance = residuals.reduce((sum, value) => sum + value * value, 0) / residuals.length;
  if (residualVariance < 0.02) return null;

  const powers: Array<{ frequency: number; power: number }> = [];
  for (let frequency = 0.1; frequency <= 0.5; frequency += 0.0025) {
    let sinProjection = 0;
    let cosProjection = 0;
    let sinNorm = 0;
    let cosNorm = 0;
    for (let i = 0; i < times.length; i++) {
      const phase = 2 * Math.PI * frequency * times[i];
      const sin = Math.sin(phase);
      const cos = Math.cos(phase);
      sinProjection += residuals[i] * sin;
      cosProjection += residuals[i] * cos;
      sinNorm += sin * sin;
      cosNorm += cos * cos;
    }
    const power =
      (sinNorm > 0 ? (sinProjection * sinProjection) / sinNorm : 0) +
      (cosNorm > 0 ? (cosProjection * cosProjection) / cosNorm : 0);
    powers.push({ frequency, power });
  }
  powers.sort((a, b) => b.power - a.power);
  const peak = powers[0];
  if (!peak) return null;
  // Compare the peak to the median spectral floor, excluding neighbouring
  // bins. Motion and quantisation produce broad/noisy spectra rather than one
  // stable respiratory peak.
  const floorPowers = powers
    .filter((entry) => Math.abs(entry.frequency - peak.frequency) > 0.025)
    .map((entry) => entry.power)
    .sort((a, b) => a - b);
  const floor = floorPowers[Math.floor(floorPowers.length / 2)] ?? 0;
  const peakRatio = peak.power / Math.max(floor, 0.0001);
  const explained = peak.power / Math.max(residualVariance * recent.length, 0.0001);
  const confidence = Math.min(1, Math.min(peakRatio / 4, explained / 0.25));
  if (peakRatio < 2.2 || explained < 0.07 || confidence < 0.28) return null;

  return {
    brpm: Math.round(peak.frequency * 600) / 10,
    confidence: Math.round(confidence * 100) / 100,
    sampleCount: recent.length,
    windowSeconds: Math.round(spanSeconds),
  };
}