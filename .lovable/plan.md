## Goal
Metrics stay grey/stale in the app even after the Armand firmware update. We need to prove exactly where each metric dies (firmware → BLE notify → decoder → context → freshness gate → UI) and fix the broken link for every metric individually — not just HR/SpO₂.

## Investigation (before any fix)

1. Read the decoder + context wiring to map every metric to its opcode and setter:
   - `src/lib/vyro-ble/packets.ts` (frame parsing, opcode → field mapping)
   - `src/lib/vyro-ble/qcband.ts` (command requests sent to watch)
   - `src/hooks/use-vyro-band.ts` (context setters, rehydrate logic, signalAt timestamps)
   - `src/components/vyro/VyroBandProvider.tsx` (context shape)
   - `src/components/vyro/useLiveMetrics.ts` (freshness gate — already relaxed)
   - `src/components/vyro/use-ble-inspector.ts` (current debug counters)

2. Build a per-metric truth table from the code:
   | Metric | Request opcode | Response opcode | Decoder field | Context setter | signalAt key |
   Any row with a `—` is a broken link we must fix.

## Fixes (scoped to what the investigation proves)

### A. Force every metric to be requested on connect
In `use-vyro-band.ts` connect sequence, send the full opcode sweep the new firmware supports (HR, SpO₂, HRV, stress, skin temp, BP, steps/cal/distance, battery, resting HR, respiration) with correct spacing. Log each request into the write log.

### B. Decoder: handle every response opcode the firmware now emits
In `packets.ts`, add/repair parsers for any opcode the Debug bundle shows as "unknown" but the firmware advertises. Emit a normalized `{field, value, ts}` for each.

### C. Context: setter + timestamp for every field
In `use-vyro-band.ts`, ensure each decoded field calls `setX(value)` AND `setSignalAt(prev => ({...prev, xAt: Date.now()}))` in the same tick. Remove any code path that sets the value without the timestamp (this was the root cause of the earlier freshness race).

### D. Rehydration policy
Keep push-only metrics unrehydrated (already done). Rehydrate only battery + steps/cal/distance which the firmware repeats on a schedule.

### E. Debug tab: per-metric verdict row
Extend `DebugView.tsx` to render one row per metric with a live verdict:
- `requested ✓ / ✗` (from write log)
- `notified ✓ ×N / ✗` (from decoder counters, per opcode)
- `parsed ✓ / unknown-opcode / bad-length` (new decoder outcome per opcode)
- `stored ✓ (age Xs) / null` (from context)
- `ui ✓ / grey (reason)` (freshness gate result)

This turns the Debug bundle into a self-diagnosing report — one glance shows whether the break is firmware, decoder, context, or gate.

### F. Auto re-request on silence
If a metric was requested but produced 0 notifications within 20s, resend the request once. Log both attempts.

## Verification
1. Reconnect watch, wait 60s.
2. Debug tab: every metric row should reach at least `stored ✓`. Any row still red points at a specific layer (firmware vs decoder vs gate) — no more guessing.
3. Home / Recovery / Sport tiles: every metric with `stored ✓` must be non-grey.
4. Paste new debug bundle to confirm.

## Out of scope
- UI redesign of tiles.
- Changes outside `/app2` shell.
- Firmware-side changes (we adapt to what Armand's firmware now emits).

## Technical notes
- Do not touch `src/integrations/supabase/*` (auto-generated).
- Keep all edits inside `src/lib/vyro-ble/`, `src/hooks/use-vyro-band.ts`, and `src/components/vyro/` (DebugView, use-ble-inspector, useLiveMetrics, VyroBandProvider).
- Preserve the existing relaxed freshness gate.
