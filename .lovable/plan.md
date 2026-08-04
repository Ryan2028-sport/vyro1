# Fix: connected watch shows dashes for HR, Resting HR, Strain, SpO2, Skin Temp, BP, Resp Rate

## What's actually going wrong

Heart rate is the one metric this firmware reliably streams, and everything else you listed depends on it (Resting HR is computed from a rolling HR buffer, Strain needs live HR plus motion, Readiness needs HR). In the current code the measurement scheduler starts only 3 seconds after connecting and, to free the optical sensor, **stops the realtime heart-rate stream for the whole cycle** (`use-vyro-band.ts`, `runAllMeasures`). That cycle walks SpO2 -> Skin Temp -> HRV -> Stress -> Blood Pressure, and each metric tries several sub-types with 8-20s measure windows, so the HR stream can stay off for minutes. Meanwhile HR is only treated as "fresh" for 30 seconds, so the HR tile blanks, Resting HR blanks with it, Strain blanks, and the readiness gates fail — which is exactly the all-dashes state you see.

The optical metrics themselves (SpO2 / temp / HRV / BP) are separately blocked because this firmware answers those sub-type requests with keep-alive / unsupported status bytes rather than real values, and Respiration Rate has no decoder wired at all.

## The fix

1. **Heart rate never goes dark.**
   - Delay the first measurement cycle to ~60s after connect so HR, Resting HR and Strain establish first.
   - Restart the realtime HR stream immediately after *each* metric instead of only at the end of the whole cycle, and cap a single cycle's total sensor-hold time (~45s) so HR is never suspended for long.
   - While a measurement holds the sensor, keep showing the last HR value and label it "measuring" instead of dropping to a dash (widen the HR freshness window to cover the hold, using the same gate config).

2. **Resting HR, Strain, Readiness stop collapsing.**
   - Keep the HR ring buffer across the measurement hold rather than resetting on a gap, so Resting HR persists.
   - Strain keeps its last computed value with a "holding" label during the hold instead of going null.

3. **Stop wasting the sensor on sub-types this firmware refuses.**
   - After a metric answers only `0x87` / `0x89` unsupported bytes on all its sub-types for two consecutive cycles, mark it `unsupported` and back off to once every ~30 minutes instead of every cycle. That frees the PPG for HR and the metrics that do work (stress via history, steps).

4. **Honest labels instead of a uniform "awaiting signal".**
   - Per-metric text driven by the existing pipeline state: "measuring", "no response from watch", "not supported by this firmware", "awaiting firmware field" (Respiration Rate).
   - Debug tab pipeline table shows requested/responded timestamps and the last raw reply byte per metric, so it's clear which are firmware limits vs app bugs.

5. **Score gates made consistent** (from the audit): Fatigue and Agility currently publish from a single loose signal while Recovery requires two independent channels; Fatigue/Agility get the same 2-evidence rule and a recency window, and the Recovery/Sleep legend stops being gated on `readiness` being non-null.

## Technical details

- `src/hooks/use-vyro-band.ts` — restructure `runAllMeasures` / `measureMetric`: deferred first run, per-metric HR restart, cycle time budget, `unsupported` classification + backoff, keep HR buffer and last-value across holds.
- `src/components/vyro/useLiveMetrics.ts` — single per-channel freshness config; HR/strain hold-aware freshness; time-boxed `peakG` / `reactMin`; evidence gate for Fatigue/Agility.
- `src/components/vyro/VyroScoresProvider.tsx` — remove the unused duplicate `subs.recovery` so there's one Recovery number.
- `src/components/vyro/App2ReferenceShell.tsx` — vitals rows render pipeline-specific status text; legend gating fixed.
- `src/components/vyro/DebugView.tsx` — pipeline table with request/response times and last raw reply.

## Note on limits

SpO2, Skin Temp, Blood Pressure and HRV will only show real numbers if the connected firmware actually returns payloads for those sub-types. This plan makes the app request them correctly, prove per-metric whether the watch replied, and never let those attempts break HR/Resting HR/Strain. If the Debug table then says "not supported by this firmware" for a metric, that's a watch-side gap, not an app bug — and you'll be able to see it clearly.
