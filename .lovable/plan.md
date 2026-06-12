# VYRO Band BLE Integration — Metrics + OTA Firmware

Based on the uploaded firmware source, `VYRO_BLE_Packet_Reference.docx`, the nRF54 build config, and the OTA testing logs, the band exposes two BLE surfaces:

1. **Custom Motion Service** `f8a90001-9b6a-4c7e-9e1a-7c1f2d4e5f00`
   - `f8a90002…` — Event characteristic (NOTIFY)
   - `f8a90003…` — Session Control characteristic (WRITE)
2. **Nordic MCUmgr SMP service** (`8d53dc1d-1db7-4cd3-868b-8a527460aa84`) — already enabled in firmware (`CONFIG_NCS_SAMPLE_MCUMGR_BT_OTA_DFU=y`, MCUboot sysbuild). This is what OTA must speak; the testing logs show a real swap from v1.0.0 → v2.0.0.

The current `useBluetooth` hook + `/bluetooth` page only scans, connects, and dumps raw GATT. It does not decode VYRO event packets and it has no SMP/OTA path. This plan adds both.

## Scope

- Decode all 4 event packet types (`0x10` Swing, `0x11` Rapid Start, `0x12` Burst, `0x13` Direction Change) using the locked v1 wire format.
- Drive Session Control (start/pause/end) writes from the Session screen.
- Implement Nordic SMP (MCUmgr) image upload over BLE for OTA, with progress, hash, test, confirm, reset.
- Surface live metrics across Athlete / Session / Sport / Recovery views per `vyro-band-metric-tracking-spec.md` (motion-derived only; PPG-driven values like HR/HRV/SpO₂ are stubbed until that GATT spec lands — flagged in the plan).
- Add a Watch settings page with pair/forget, battery, firmware version, "Update firmware" button.

Note on QCBandSDK (iOS): the uploaded `SDK_IOS.zip` is an Objective-C framework for the QC health band. It cannot run inside the web app. We will not wire it in this round; the Lovable build will speak the nRF54 custom GATT directly via Web Bluetooth in browsers and the existing Despia native bridge on iOS.

## Files

New:
- `src/lib/vyro-ble/uuids.ts` — service + characteristic constants, SMP UUIDs.
- `src/lib/vyro-ble/packets.ts` — pure decoders for `0x10–0x13` (LE int16, fixed-point scales) with TypeScript types `SwingEvent`, `RapidStartEvent`, `BurstEvent`, `DirectionChangeEvent`, and a tagged union `VyroMotionEvent`. Unit-safe converters (g, dps, ms).
- `src/lib/vyro-ble/session-control.ts` — encoders for Start / Pause / End / sport-tag writes to `f8a90003…`.
- `src/lib/vyro-ble/smp.ts` — minimal SMP client: CBOR encode/decode, op codes for Image Upload (group 1, id 1), Image State (group 1, id 0), Reset (group 0, id 5). Chunks firmware bin into MTU-sized frames, tracks offset, computes SHA-256, handles `rc` errors.
- `src/lib/vyro-ble/ota.ts` — orchestrates: parse `.bin` (or extract from MCUboot signed image), upload → set test → reset → wait for swap → confirm.
- `src/hooks/use-vyro-band.ts` — high-level hook above `use-bluetooth`: auto-subscribes to the event characteristic, exposes `lastEvent`, `recentEvents`, `sessionState`, `startSession(sport)`, `pauseSession()`, `endSession()`, `startOta(file, onProgress)`.
- `src/lib/vyro-store.ts` (or extend `src/lib/app-store.ts`) — global Zustand-style store fed by `useVyroBand`, consumed by views.
- `src/routes/watch.tsx` — pairing, battery, firmware version, "Update firmware" file picker, OTA progress bar, swap status.

Edited:
- `src/hooks/use-bluetooth.ts` — request the VYRO service UUID + SMP service UUID in `scan()` so iOS reliably whitelists them; add a typed `notifications` channel keyed by characteristic so the new hook can subscribe without scanning the GATT tree.
- `src/components/vyro/SessionView.tsx` — replace mock start/end buttons with real `useVyroBand` calls; render live event feed and counters (swings, bursts, direction changes per sport).
- `src/components/vyro/SportView.tsx` (squash + tennis branches) — feed motion counters and intensity histogram from `recentEvents`.
- `src/components/vyro/HomeView.tsx` — connection chip + last sync.
- `public/vyro-app.html` — replace the hard-coded "watch test" simulator with a thin bridge that posts to the React layer (or just route the existing button to `/watch`).
- `src/routes/bluetooth.tsx` — keep as raw GATT inspector for debugging; add a banner linking to `/watch` for the real flow.

## Packet decoder (technical details)

All multi-byte fields little-endian. Common envelope: `type:u8`, `len:u8`, then payload. Fixed-point: accel/direction `int16 × 100 = g`, gyro `int16 = dps`, jerk `int16 = g/s`, duration/gap `uint16 ms`, intensity `uint8 0–100`. Saturation at `±32767` is surfaced as `{ value, saturated: true }` so UI can show "≥ Xg". Payload sizes per spec: Swing 13, Rapid 12, Burst 12, DirChange 14.

## OTA (technical details)

- Transport: SMP over BLE GATT, service `8d53…aa84`, characteristic `da2e7828-fbce-4e01-ae9e-261174997c48`, NOTIFY + WRITE WITHOUT RESPONSE. Negotiate the largest MTU the platform allows (247 on most centrals; iOS caps at 185).
- Upload flow: `IMG_UPLOAD` requests with `{ image: 0, off, len, data, sha (first req only), upgrade: true }` CBOR-encoded. Track `off` echoed in response; retry on `rc != 0`. Compute SHA-256 of the full image on the client (Web Crypto / `crypto.subtle`).
- After upload: `IMG_STATE` write with `{ hash, confirm: false }` to mark test, then `RESET` (group 0 cmd 5). After the device boots the new image and reconnects, write `IMG_STATE` with `{ confirm: true }` so MCUboot makes it permanent. If the device never reconnects within 60 s, mark the OTA failed (band will auto-revert on next reboot — this matches the testing log behaviour).
- File input: accept the signed `app_update.bin` produced by `west build` (the same artefact Nordic's nRF Connect mobile app uploads). The plan does **not** include parsing `.hex` — if the user only has hex files we'll add an `intel-hex → bin` step.

## Health metrics gap (call out)

`vyro-band-metric-tracking-spec.md` covers HR, HRV, SpO₂, temp, steps, sleep. The nRF54 firmware in this upload only emits the 4 motion packets. None of the standard BLE Heart Rate / Battery services are advertised by `app_ble.c`. To light up the rest of the spec we need either:
- new packet types added to the band (e.g. `0x20` HR stream, `0x21` HRV window, `0x22` SpO₂…), or
- standard BLE services (`0x180D` HRS, `0x180F` BAS) added to the firmware advertisement.

The plan stubs those metric panels with a "Waiting on band firmware" badge instead of fabricating numbers, and keeps the wire format in `packets.ts` open for new type codes.

## Build & verify

- Decode `packets.ts` against the worked example in the docx (Swing `10 0D 59 06 01 42 05 BF 01 50 FF AD 00 59 00` → intensity 89, 2.62 g, 1346 dps, 447 ms, fwd −1.76, lr +1.73, ud +0.89) as a Vitest unit test.
- SMP CBOR encoder verified against fixtures from the nRF Connect SMP spec (known-good byte strings for `IMG_UPLOAD` and `IMG_STATE`).
- Manual: on desktop Chrome, pair the band → observe motion events streaming into Session view → trigger OTA with a known v2 bin → confirm version chip flips from v1.0.0 to v2.0.0 after reconnect.

## Out of scope (flagged for next round)

- PPG-derived health metrics (need firmware changes).
- iOS QCBandSDK integration (Obj-C framework, not usable from web; would require a native shell).
- Multi-device pairing / coach roster sync.
