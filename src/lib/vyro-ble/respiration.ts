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

  // Search 0.12–0.5 Hz (7.2–30 brpm). The band edges are excluded from peak
  // selection: a peak pinned to the lowest bin is residual HR drift, not
  // breathing, which is what produced the bogus flat 6.0 brpm reading.
  const FREQ_MIN = 0.12;
  const FREQ_MAX = 0.5;
  const FREQ_STEP = 0.0025;
  const powers: Array<{ frequency: number; power: number }> = [];
  for (let frequency = FREQ_MIN; frequency <= FREQ_MAX; frequency += FREQ_STEP) {
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
  // Only accept interior peaks — at least one bin-width away from either edge.
  const interior = powers.filter(
    (entry) => entry.frequency > FREQ_MIN + FREQ_STEP * 2 && entry.frequency < FREQ_MAX - FREQ_STEP * 2,
  );
  const sortedInterior = [...interior].sort((a, b) => b.power - a.power);
  const peak = sortedInterior[0];
  if (!peak) return null;
  // A genuine respiratory peak also needs at least one Nyquist-safe sample per
  // half breath; reject frequencies the sampling rate cannot resolve.
  if (peak.frequency > 0.5 / Math.max(medianGap, 0.001)) return null;
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
  if (peakRatio >= 1.8 && explained >= 0.05 && confidence >= 0.2) {

    return {
      brpm: Math.round(peak.frequency * 600) / 10,
      confidence: Math.round(confidence * 100) / 100,
      sampleCount: recent.length,
      windowSeconds: Math.round(spanSeconds),
    };
  }

  // Time-domain fallback. When the PPG stream is noisy or coarsely quantised
  // the spectrum smears, but the respiratory oscillation is still visible as
  // slow zero crossings of the smoothed, detrended HR signal. Count them and
  // report with reduced confidence rather than showing nothing.
  const smoothed: number[] = [];
  for (let i = 0; i < residuals.length; i++) {
    const window = residuals.slice(Math.max(0, i - 2), i + 3);
    smoothed.push(window.reduce((sum, value) => sum + value, 0) / window.length);
  }
  let crossings = 0;
  let lastCrossingTime: number | null = null;
  const intervals: number[] = [];
  for (let i = 1; i < smoothed.length; i++) {
    const a = smoothed[i - 1];
    const b = smoothed[i];
    if ((a <= 0 && b > 0) || (a >= 0 && b < 0)) {
      crossings++;
      const t = times[i];
      if (lastCrossingTime != null) intervals.push(t - lastCrossingTime);
      lastCrossingTime = t;
    }
  }
  if (crossings < 6 || intervals.length < 4) return null;
  const meanHalfPeriod = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  if (meanHalfPeriod <= 0) return null;
  const brpm = 60 / (meanHalfPeriod * 2);
  if (brpm < 6 || brpm > 30) return null;
  // Regularity of the half-periods is the confidence proxy here.
  const spread =
    Math.sqrt(
      intervals.reduce((sum, value) => sum + (value - meanHalfPeriod) ** 2, 0) / intervals.length,
    ) / meanHalfPeriod;
  const fallbackConfidence = Math.max(0.15, Math.min(0.55, 0.6 - spread));
  if (spread > 0.85) return null;

  return {
    brpm: Math.round(brpm * 10) / 10,
    confidence: Math.round(fallbackConfidence * 100) / 100,
    sampleCount: recent.length,
    windowSeconds: Math.round(spanSeconds),
  };
}
