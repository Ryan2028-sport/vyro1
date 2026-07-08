## What the latest debug bundle proves

From your connect (81 notifs, 29 writes, all OK):

**Working (ctx has real values):**
- HRV = 40, Stress = 37, Steps = 2744, Cal = 9184, Distance = 2173, Battery = 63

**Broken (ctx = null):**
- Heart rate, SpO₂, Skin temperature, Blood pressure

**Opcode traffic received:**
- `0x1e` × 11 — realtime HR responses, but payload is `1e 00 00 ...` → **bpm byte = 0** every time. Watch is ACKing "started" but never sending a real HR reading.
- `0x43` × 30, `0x48` × 4 — activity/today-sports (steps/cal/dist land here ✓)
- `0x03` × 1 — battery ✓
- `0x87` × 4, `0x89` × 4 — payload `ee` (238). Currently in "known opcodes" list but I need to confirm they're what's populating HRV/stress, or they're something else and HRV/stress are coming from `0x1e`/handshake side-effects.
- **No `0x69` responses at all** — the SDK "start measure" channel that HR/SpO₂/Temp/BP live on is never returning data.
- Unknown opcodes (`0x2f 0x01 0x16 0x2c 0x36 0x38 0x3a`, one each) are just write-ACKs from the connect-time preference commands; harmless.

**Verdict:** The firmware is not producing HR/SpO₂/Skin Temp/BP because either (a) the app never sends a `0x69` start-measure for those sub-types after connect, or (b) it sends it but the watch's response opcode differs on this firmware line. `0x1e` HR is being started but the watch keeps returning bpm=0 — likely because HR must first be armed via `0x69` with the SDK's HR sub-type before `0x1e` returns non-zero.

## What to change (all inside `/app2` shell)

### 1. Wire the Decoder Tap into HRV/Stress/Battery paths (missing today)
`decoder-tap.ts` already exists. Confirm every metric setter in `use-vyro-band.ts` calls `tapDecoded(...)` — right now HRV/stress/steps values arrive but the decoder-tap section of Debug is empty because the tap isn't invoked on those paths. Without it we cannot tell whether `0x87`/`0x89` are the HRV/stress source or noise.

### 2. Send a full `0x69` start-measure sweep on connect
In `use-vyro-band.ts` connect sequence, add sequential `encodeQcBandMeasureStart(subType)` writes with ~500ms spacing for:
- HR (both `0x01` and SDK `0x00`)
- SpO₂ (both `0x03` and SDK `0x02`)
- Skin Temp (`0x07` SDK, `0x09` legacy, `0x04` legacy)
- BP (`0x02`)
- HRV (`0x06` SDK, `0x0e` legacy)
- Stress (`0x04` SDK, `0x0d` legacy)

Both variants are needed because your firmware line hasn't declared which mapping it uses. Log every write into the existing write log so Debug shows them.

### 3. Add decoders / taps for `0x87` and `0x89`
They arrive on this firmware but currently only bump the "known" counter without producing a stored value. Add parsers in `packets.ts` (single-byte value at byte 1 is `0xee` → 238; likely a raw HRV/stress sample or a session marker) and route to the correct setter with `tapDecoded()`. If they turn out to be junk, at least the Debug tap will show that unambiguously.

### 4. Auto re-arm on silence
If any of HR/SpO₂/Temp/BP produces 0 decoded values within 20s of connect, re-send its `0x69` start-measure once. Log both attempts.

### 5. Extend Debug tab: per-metric verdict row
One row per metric with: `requested ✓ (write hex) / ✗`, `notified ✓ ×N (last opcode) / ✗`, `decoded ✓ ×N (last value) / null`, `stored ✓ (age) / null`, `ui ✓ / grey (reason)`. Reading top-to-bottom pinpoints the exact broken layer.

## What we're deliberately not doing
- No UI redesign of tiles.
- No firmware changes — we adapt to what Armand's firmware emits.
- No edits outside `src/lib/vyro-ble/`, `src/hooks/use-vyro-band.ts`, and `src/components/vyro/{DebugView,use-ble-inspector,useLiveMetrics,VyroBandProvider}`.
- No touching `src/integrations/supabase/*` (auto-generated).

## How we verify
1. Reconnect the watch, wait 60s.
2. Paste new debug bundle. Debug tab should show per-metric rows.
3. Expected: HR row goes `requested ✓ (69 01 01…) → notified ✓ (0x69) → decoded ✓ → stored ✓`; if it stops at `notified ✗`, the firmware is refusing that sub-type and we try the SDK variant next.
