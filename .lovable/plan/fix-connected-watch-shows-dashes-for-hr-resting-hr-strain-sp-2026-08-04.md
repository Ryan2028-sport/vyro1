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

This is the debug bundle: {

  "capturedAt": "2026-08-04T18:33:51.993Z",

  "connected": true,

  "pairedId": "0975AACE-E58E-7B60-42D8-F38782E625B5",

  "connectedId": "0975AACE-E58E-7B60-42D8-F38782E625B5",

  "powerState": "on",

  "lastError": null,

  "totalNotifications": 288,

  "writes": {

    "total": 87,

    "ok": 87,

    "failed": 0,

    "lastAt": 1785868427022,

    "lastCharacteristic": "6e400002-b5a3-f393-e0a9-e50e24dcca9e",

    "lastError": null

  },

  "decoder": {

    "known": 288,

    "unknown": 0,

    "unknownOpcodes": {}

  },

  "perOpcode": {

    "0x1e": {

      "count": 95,

      "lastAt": 1785868384807,

      "lastHex": "1e 00 00 00 00 00 00 00 00 00 00 00 00 00 00 1e"

    },

    "0x03": {

      "count": 4,

      "lastAt": 1785868422473,

      "lastHex": "03 5e 00 00 00 00 00 00 00 00 00 00 00 00 00 61"

    },

    "0x37": {

      "count": 20,

      "lastAt": 1785868422788,

      "lastHex": "37 04 00 00 00 00 00 00 00 00 00 00 00 00 00 3b"

    },

    "0x89": {

      "count": 6,

      "lastAt": 1785868423142,

      "lastHex": "89 ee 00 00 00 00 00 00 00 00 00 00 00 00 00 77"

    },

    "0x87": {

      "count": 6,

      "lastAt": 1785868423464,

      "lastHex": "87 ee 00 00 00 00 00 00 00 00 00 00 00 00 00 75"

    },

    "0x39": {

      "count": 20,

      "lastAt": 1785868423739,

      "lastHex": "39 04 00 00 00 00 00 00 00 00 00 00 00 00 00 3d"

    },

    "0x43": {

      "count": 25,

      "lastAt": 1785868424727,

      "lastHex": "43 26 08 04 38 01 02 28 00 0f 00 09 00 00 00 f0"

    },

    "0x48": {

      "count": 6,

      "lastAt": 1785868424455,

      "lastHex": "48 00 01 ce 00 00 00 00 3b 47 00 01 66 00 0a 0a"

    },

    "0xbc": {

      "count": 20,

      "lastAt": 1785868426704,

      "lastHex": "bc 26 01 00 3e 81 02"

    },

    "0x73": {

      "count": 2,

      "lastAt": 1785868379416,

      "lastHex": "73 3e 00 00 00 00 00 00 00 00 00 00 00 00 00 b1"

    },

    "0x69": {

      "count": 84,

      "lastAt": 1785868431519,

      "lastHex": "69 0a 00 00 00 00 00 00 00 00 00 00 00 00 00 73"

    }

  },

  "perChar": {

    "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e::6e400003-b5a3-f393-e0a9-e50e24dcca9e": {

      "count": 268,

      "lastAt": 1785868431519,

      "lastOpcode": 105,

      "lastHex": "69 0a 00 00 00 00 00 00 00 00 00 00 00 00 00 73"

    },

    "de5bf728-d711-4e47-af26-65e3012a5dc7::de5bf729-d711-4e47-af26-65e3012a5dc7": {

      "count": 20,

      "lastAt": 1785868426704,

      "lastOpcode": 188,

      "lastHex": "bc 26 01 00 3e 81 02"

    }

  },

  "pipeline": [

    {

      "metric": "Heart rate",

      "value": "56 bpm",

      "ok": false,

      "stages": "cmd ✗ → notif ✓ ×95 → stale ⚠",

      "note": "last value 4m ago — watch silent"

    },

    {

      "metric": "SpO₂",

      "value": "98 %",

      "ok": true,

      "stages": "push-only → notif ✓ ×106 → live ✓",

      "note": "live 6s ago"

    },

    {

      "metric": "Skin temp",

      "value": "—",

      "ok": false,

      "stages": "push-only → notif ✓ ×112 → no data ✗",

      "note": "frames arrive but decoder gets no value (firmware empty payload)"

    },

    {

      "metric": "HRV",

      "value": "43 ms",

      "ok": true,

      "stages": "push-only → notif ✓ ×104 → live ✓",

      "note": "live 7s ago"

    },

    {

      "metric": "Stress",

      "value": "44",

      "ok": true,

      "stages": "push-only → notif ✓ ×104 → live ✓",

      "note": "live 8s ago"

    },

    {

      "metric": "Blood pressure",

      "value": "—",

      "ok": false,

      "stages": "push-only → notif ✓ ×90 → no data ✗",

      "note": "frames arrive but decoder gets no value (firmware empty payload)"

    },

    {

      "metric": "Steps",

      "value": "462",

      "ok": true,

      "stages": "cmd ✓ → notif ✓ ×33 → live ✓",

      "note": "live 6s ago"

    },

    {

      "metric": "Battery",

      "value": "94 %",

      "ok": true,

      "stages": "cmd ✓ → notif ✓ ×4 → live ✓",

      "note": "live 9s ago"

    },

    {

      "metric": "Motion (IMU)",

      "value": "—",

      "ok": false,

      "stages": "push-only → notif ✓ ×98 → no data ✗",

      "note": "frames arrive but decoder gets no value (firmware empty payload)"

    },

    {

      "metric": "Sleep",

      "value": "—",

      "ok": false,

      "stages": "cmd ✗ → notif ✗ → no data ✗",

      "note": "command never sent"

    }

  ],

  "decoderOutput": {

    "motion": {

      "count": 36,

      "lastAt": 1785868423464,

      "lastValue": "op=0x87 b1=0xee",

      "lastRaw": "87 ee 00 00 00 00 00 00 00 00 00 00 00 00 00 75"

    },

    "battery": {

      "count": 8,

      "lastAt": 1785868422473,

      "lastValue": "94",

      "lastRaw": "03 5e 00 00 00 00 00 00 00 00 00 00 00 00 00 61"

    },

    "steps": {

      "count": 15,

      "lastAt": 1785868424455,

      "lastValue": "462",

      "lastRaw": ""

    },

    "distance": {

      "count": 15,

      "lastAt": 1785868424455,

      "lastValue": "358",

      "lastRaw": ""

    },

    "calories": {

      "count": 15,

      "lastAt": 1785868424455,

      "lastValue": "15175",

      "lastRaw": ""

    },

    "stress": {

      "count": 18,

      "lastAt": 1785868422749,

      "lastValue": "44",

      "lastRaw": "37 03 00 00 00 00 2c 00 00 00 00 00 00 00 00 66"

    },

    "hrv": {

      "count": 16,

      "lastAt": 1785868423739,

      "lastValue": "43",

      "lastRaw": "39 02 00 00 00 00 00 00 00 00 00 00 2b 00 00 66"

    },

    "hr": {

      "count": 170,

      "lastAt": 1785868177623,

      "lastValue": "56",

      "lastRaw": "1e 38 00 00 00 00 00 00 00 00 00 00 00 00 00 56"

    },

    "restingHr": {

      "count": 151,

      "lastAt": 1785868177626,

      "lastValue": "51",

      "lastRaw": ""

    },

    "spo2": {

      "count": 2,

      "lastAt": 1785868425411,

      "lastValue": "98",

      "lastRaw": "bc 2a 31 00 28 c5 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00"

    }

  },

  "recentNotifications": [

    {

      "ts": 1785868431519,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 0a 00 00 00 00 00 00 00 00 00 00 00 00 00 73",

      "opcode": 105

    },

    {

      "ts": 1785868430984,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 0a 00 00 00 00 00 00 00 00 00 00 00 00 00 73",

      "opcode": 105

    },

    {

      "ts": 1785868430483,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 0a 00 00 00 00 00 00 00 00 00 00 00 00 00 73",

      "opcode": 105

    },

    {

      "ts": 1785868429988,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 0a 00 00 00 00 00 00 00 00 00 00 00 00 00 73",

      "opcode": 105

    },

    {

      "ts": 1785868429494,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 0a 00 00 00 00 00 00 00 00 00 00 00 00 00 73",

      "opcode": 105

    },

    {

      "ts": 1785868428998,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 0a 00 00 00 00 00 00 00 00 00 00 00 00 00 73",

      "opcode": 105

    },

    {

      "ts": 1785868428503,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 0a 00 00 00 00 00 00 00 00 00 00 00 00 00 73",

      "opcode": 105

    },

    {

      "ts": 1785868428009,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 0a 00 00 00 00 00 00 00 00 00 00 00 00 00 73",

      "opcode": 105

    },

    {

      "ts": 1785868427514,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 0a 00 00 00 00 00 00 00 00 00 00 00 00 00 73",

      "opcode": 105

    },

    {

      "ts": 1785868427023,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 0a 00 00 00 00 00 00 00 00 00 00 00 00 00 73",

      "opcode": 105

    },

    {

      "ts": 1785868426704,

      "service": "de5bf728-d711-4e47-af26-65e3012a5dc7",

      "characteristic": "de5bf729-d711-4e47-af26-65e3012a5dc7",

      "hex": "bc 26 01 00 3e 81 02",

      "opcode": 188

    },

    {

      "ts": 1785868426388,

      "service": "de5bf728-d711-4e47-af26-65e3012a5dc7",

      "characteristic": "de5bf729-d711-4e47-af26-65e3012a5dc7",

      "hex": "bc 25 01 00 3e 81 02",

      "opcode": 188

    },

    {

      "ts": 1785868426075,

      "service": "de5bf728-d711-4e47-af26-65e3012a5dc7",

      "characteristic": "de5bf729-d711-4e47-af26-65e3012a5dc7",

      "hex": "bc 74 01 00 3e 81 02",

      "opcode": 188

    },

    {

      "ts": 1785868425760,

      "service": "de5bf728-d711-4e47-af26-65e3012a5dc7",

      "characteristic": "de5bf729-d711-4e47-af26-65e3012a5dc7",

      "hex": "bc 5f 01 00 3e 81 02",

      "opcode": 188

    },

    {

      "ts": 1785868425411,

      "service": "de5bf728-d711-4e47-af26-65e3012a5dc7",

      "characteristic": "de5bf729-d711-4e47-af26-65e3012a5dc7",

      "hex": "bc 2a 31 00 28 c5 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 …(+23B)",

      "opcode": 188

    },

    {

      "ts": 1785868424727,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "43 26 08 04 38 01 02 28 00 0f 00 09 00 00 00 f0",

      "opcode": 67

    },

    {

      "ts": 1785868424727,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "43 26 08 04 24 00 02 c5 05 bf 01 5d 01 00 00 83",

      "opcode": 67

    },

    {

      "ts": 1785868424723,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "43 f0 02 01 00 00 00 00 00 00 00 00 00 00 00 36",

      "opcode": 67

    },

    {

      "ts": 1785868424678,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 04 00 00 00 00 00 00 00 00 00 00 00 00 00 6d",

      "opcode": 105

    },

    {

      "ts": 1785868424455,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "48 00 01 ce 00 00 00 00 3b 47 00 01 66 00 0a 0a",

      "opcode": 72

    },

    {

      "ts": 1785868424138,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 04 00 00 00 00 00 00 00 00 00 00 00 00 00 6d",

      "opcode": 105

    },

    {

      "ts": 1785868424097,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "43 26 08 04 38 01 02 28 00 0f 00 09 00 00 00 f0",

      "opcode": 67

    },

    {

      "ts": 1785868424097,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "43 26 08 04 24 00 02 c5 05 bf 01 5d 01 00 00 83",

      "opcode": 67

    },

    {

      "ts": 1785868424096,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "43 f0 02 01 00 00 00 00 00 00 00 00 00 00 00 36",

      "opcode": 67

    },

    {

      "ts": 1785868423739,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "39 04 00 00 00 00 00 00 00 00 00 00 00 00 00 3d",

      "opcode": 57

    },

    {

      "ts": 1785868423739,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "39 03 00 00 00 00 00 00 00 00 00 00 00 00 00 3c",

      "opcode": 57

    },

    {

      "ts": 1785868423739,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "39 02 00 00 00 00 00 00 00 00 00 00 2b 00 00 66",

      "opcode": 57

    },

    {

      "ts": 1785868423738,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "39 01 00 00 00 00 00 00 00 00 00 00 00 00 00 3a",

      "opcode": 57

    },

    {

      "ts": 1785868423738,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "39 00 05 1e 00 00 00 00 00 00 00 00 00 00 00 5c",

      "opcode": 57

    },

    {

      "ts": 1785868423644,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 04 00 00 00 00 00 00 00 00 00 00 00 00 00 6d",

      "opcode": 105

    },

    {

      "ts": 1785868423464,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "87 ee 00 00 00 00 00 00 00 00 00 00 00 00 00 75",

      "opcode": 135

    },

    {

      "ts": 1785868423149,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 04 00 00 00 00 00 00 00 00 00 00 00 00 00 6d",

      "opcode": 105

    },

    {

      "ts": 1785868423142,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "89 ee 00 00 00 00 00 00 00 00 00 00 00 00 00 77",

      "opcode": 137

    },

    {

      "ts": 1785868422788,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "37 04 00 00 00 00 00 00 00 00 00 00 00 00 00 3b",

      "opcode": 55

    },

    {

      "ts": 1785868422749,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "37 03 00 00 00 00 2c 00 00 00 00 00 00 00 00 66",

      "opcode": 55

    },

    {

      "ts": 1785868422749,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "37 02 00 00 00 00 00 00 00 00 00 00 15 00 00 4e",

      "opcode": 55

    },

    {

      "ts": 1785868422749,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "37 01 00 00 00 00 00 00 00 00 00 00 00 00 00 38",

      "opcode": 55

    },

    {

      "ts": 1785868422748,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "37 00 05 1e 00 00 00 00 00 00 00 00 00 00 00 5a",

      "opcode": 55

    },

    {

      "ts": 1785868422653,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 04 00 00 00 00 00 00 00 00 00 00 00 00 00 6d",

      "opcode": 105

    },

    {

      "ts": 1785868422473,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "03 5e 00 00 00 00 00 00 00 00 00 00 00 00 00 61",

      "opcode": 3

    },

    {

      "ts": 1785868422158,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 04 00 00 00 00 00 00 00 00 00 00 00 00 00 6d",

      "opcode": 105

    },

    {

      "ts": 1785868421664,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 04 00 00 00 00 00 00 00 00 00 00 00 00 00 6d",

      "opcode": 105

    },

    {

      "ts": 1785868421170,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 04 00 00 00 00 00 00 00 00 00 00 00 00 00 6d",

      "opcode": 105

    },

    {

      "ts": 1785868420673,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 04 00 00 00 00 00 00 00 00 00 00 00 00 00 6d",

      "opcode": 105

    },

    {

      "ts": 1785868420178,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 04 00 00 00 00 00 00 00 00 00 00 00 00 00 6d",

      "opcode": 105

    },

    {

      "ts": 1785868419638,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 04 00 00 00 00 00 00 00 00 00 00 00 00 00 6d",

      "opcode": 105

    },

    {

      "ts": 1785868419191,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 04 00 00 00 00 00 00 00 00 00 00 00 00 00 6d",

      "opcode": 105

    },

    {

      "ts": 1785868418648,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 04 00 00 00 00 00 00 00 00 00 00 00 00 00 6d",

      "opcode": 105

    },

    {

      "ts": 1785868418153,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 04 00 00 00 00 00 00 00 00 00 00 00 00 00 6d",

      "opcode": 105

    },

    {

      "ts": 1785868417664,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 04 00 00 00 00 00 00 00 00 00 00 00 00 00 6d",

      "opcode": 105

    },

    {

      "ts": 1785868417164,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 04 00 00 00 00 00 00 00 00 00 00 00 00 00 6d",

      "opcode": 105

    },

    {

      "ts": 1785868416668,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 04 00 00 00 00 00 00 00 00 00 00 00 00 00 6d",

      "opcode": 105

    },

    {

      "ts": 1785868416173,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 04 00 00 00 00 00 00 00 00 00 00 00 00 00 6d",

      "opcode": 105

    },

    {

      "ts": 1785868415680,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 04 00 00 00 00 00 00 00 00 00 00 00 00 00 6d",

      "opcode": 105

    },

    {

      "ts": 1785868414148,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 09 00 00 00 00 00 00 00 00 00 00 00 00 00 72",

      "opcode": 105

    },

    {

      "ts": 1785868413653,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 09 00 00 00 00 00 00 00 00 00 00 00 00 00 72",

      "opcode": 105

    },

    {

      "ts": 1785868413160,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 09 00 00 00 00 00 00 00 00 00 00 00 00 00 72",

      "opcode": 105

    },

    {

      "ts": 1785868412663,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 09 00 00 00 00 00 00 00 00 00 00 00 00 00 72",

      "opcode": 105

    },

    {

      "ts": 1785868412169,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 09 00 00 00 00 00 00 00 00 00 00 00 00 00 72",

      "opcode": 105

    },

    {

      "ts": 1785868411673,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400003-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 09 00 00 00 00 00 00 00 00 00 00 00 00 00 72",

      "opcode": 105

    }

  ],

  "writeLog": [

    {

      "ts": 1785868427022,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400002-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 0a 01 00 00 00 00 00 00 00 00 00 00 00 00 74",

      "opcode": 105,

      "success": true,

      "error": null

    },

    {

      "ts": 1785868426703,

      "service": "de5bf728-d711-4e47-af26-65e3012a5dc7",

      "characteristic": "de5bf72a-d711-4e47-af26-65e3012a5dc7",

      "hex": "bc 26 01 00 ff ff 00",

      "opcode": 188,

      "success": true,

      "error": null

    },

    {

      "ts": 1785868426388,

      "service": "de5bf728-d711-4e47-af26-65e3012a5dc7",

      "characteristic": "de5bf72a-d711-4e47-af26-65e3012a5dc7",

      "hex": "bc 25 01 00 ff ff 00",

      "opcode": 188,

      "success": true,

      "error": null

    },

    {

      "ts": 1785868426074,

      "service": "de5bf728-d711-4e47-af26-65e3012a5dc7",

      "characteristic": "de5bf72a-d711-4e47-af26-65e3012a5dc7",

      "hex": "bc 74 02 00 ff ff 00 00",

      "opcode": 188,

      "success": true,

      "error": null

    },

    {

      "ts": 1785868425760,

      "service": "de5bf728-d711-4e47-af26-65e3012a5dc7",

      "characteristic": "de5bf72a-d711-4e47-af26-65e3012a5dc7",

      "hex": "bc 5f 02 00 ff ff 00 00",

      "opcode": 188,

      "success": true,

      "error": null

    },

    {

      "ts": 1785868425398,

      "service": "de5bf728-d711-4e47-af26-65e3012a5dc7",

      "characteristic": "de5bf72a-d711-4e47-af26-65e3012a5dc7",

      "hex": "bc 2a 00 00 ff ff",

      "opcode": 188,

      "success": true,

      "error": null

    },

    {

      "ts": 1785868425082,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400002-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "6a 04 00 00 00 00 00 00 00 00 00 00 00 00 00 6e",

      "opcode": 106,

      "success": true,

      "error": null

    },

    {

      "ts": 1785868424722,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400002-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "43 00 0f 00 5f 01 00 00 00 00 00 00 00 00 00 b2",

      "opcode": 67,

      "success": true,

      "error": null

    },

    {

      "ts": 1785868424453,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400002-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "48 00 00 00 00 00 00 00 00 00 00 00 00 00 00 48",

      "opcode": 72,

      "success": true,

      "error": null

    },

    {

      "ts": 1785868424093,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400002-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "43 00 0f 00 5f 01 00 00 00 00 00 00 00 00 00 b2",

      "opcode": 67,

      "success": true,

      "error": null

    },

    {

      "ts": 1785868423733,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400002-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "39 00 00 00 00 00 00 00 00 00 00 00 00 00 00 39",

      "opcode": 57,

      "success": true,

      "error": null

    },

    {

      "ts": 1785868423463,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400002-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "07 00 00 00 00 00 00 00 00 00 00 00 00 00 00 07",

      "opcode": 7,

      "success": true,

      "error": null

    },

    {

      "ts": 1785868423141,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400002-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "09 00 00 00 00 00 00 00 00 00 00 00 00 00 00 09",

      "opcode": 9,

      "success": true,

      "error": null

    },

    {

      "ts": 1785868422744,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400002-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "37 00 00 00 00 00 00 00 00 00 00 00 00 00 00 37",

      "opcode": 55,

      "success": true,

      "error": null

    },

    {

      "ts": 1785868422473,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400002-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "03 00 00 00 00 00 00 00 00 00 00 00 00 00 00 03",

      "opcode": 3,

      "success": true,

      "error": null

    },

    {

      "ts": 1785868415678,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400002-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 04 01 00 00 00 00 00 00 00 00 00 00 00 00 6e",

      "opcode": 105,

      "success": true,

      "error": null

    },

    {

      "ts": 1785868414464,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400002-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "6a 09 00 00 00 00 00 00 00 00 00 00 00 00 00 73",

      "opcode": 106,

      "success": true,

      "error": null

    },

    {

      "ts": 1785868406184,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400002-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 09 01 00 00 00 00 00 00 00 00 00 00 00 00 73",

      "opcode": 105,

      "success": true,

      "error": null

    },

    {

      "ts": 1785868404967,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400002-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "6a 07 00 00 00 00 00 00 00 00 00 00 00 00 00 71",

      "opcode": 106,

      "success": true,

      "error": null

    },

    {

      "ts": 1785868396688,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400002-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "69 07 01 00 00 00 00 00 00 00 00 00 00 00 00 71",

      "opcode": 105,

      "success": true,

      "error": null

    },

    {

      "ts": 1785868395471,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400002-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "6a 03 00 00 00 00 00 00 00 00 00 00 00 00 00 6d",

      "opcode": 106,

      "success": true,

      "error": null

    },

    {

      "ts": 1785868393584,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400002-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "48 00 00 00 00 00 00 00 00 00 00 00 00 00 00 48",

      "opcode": 72,

      "success": true,

      "error": null

    },

    {

      "ts": 1785868393179,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400002-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "43 00 0f 00 5f 01 00 00 00 00 00 00 00 00 00 b2",

      "opcode": 67,

      "success": true,

      "error": null

    },

    {

      "ts": 1785868392730,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400002-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "07 00 00 00 00 00 00 00 00 00 00 00 00 00 00 07",

      "opcode": 7,

      "success": true,

      "error": null

    },

    {

      "ts": 1785868392458,

      "service": "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",

      "characteristic": "6e400002-b5a3-f393-e0a9-e50e24dcca9e",

      "hex": "09 00 00 00 00 00 00 00 00 00 00 00 00 00 00 09",

      "opcode": 9,

      "success": true,

      "error": null

    }

  ],

  "gatt": [],

  "ctx": {

    "heartRateBpm": 56,

    "spo2Pct": 98,

    "skinTempC": null,

    "hrvMs": 43,

    "stressScore": 44,

    "bloodPressure": null,

    "stepsToday": 462,

    "caloriesKcal": 15175,

    "distanceM": 358,

    "batteryPct": 94

  },

  "motion": {

    "peakG": 0,

    "peakDps": 0,

    "peakJerk": 0,

    "eventsLastMin": 0,

    "sessionState": "idle"

  }

}

&nbsp;

Also have a way where you can debug the problem after i connect the watch so have the abiltity to get he debug and etc once watch is connected to the app

&nbsp;