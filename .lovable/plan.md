## Heads up: the debug bundle you pasted is the OLD one
Timestamp is `2026-07-08T03:36:52` — same as the previous turn, taken BEFORE my last changes (compressed measure sweep + 25s watchdog + 0x87/0x89 tap). So it doesn't show whether HR/SpO₂/Temp/BP work now. I'll plan the firmware work AND flag what to look for once you paste a fresh bundle.

## What the (old) bundle proves about firmware capability

The `gatt` section shows exactly three services on Armand's watch:

| Service UUID | What it is |
|---|---|
| `6e40fff0-…` (write `…0002`, notify `…0003`) | QCBand Nordic-UART command channel |
| `de5bf728-…` (write `…72a`, notify `…729`) | QCBand V2 big-data channel |
| `0000180a-…` Device Information (`2a23` SystemID, `2a25` SerialNumber, `2a26` **FirmwareRevision**, `2a27` HardwareRevision) | Standard BLE DIS |

**Missing:** the MCUmgr/SMP service (`8d53dc1d-1db7-4cd3-868b-8a527460aa84`). That's the transport `src/lib/vyro-ble/ota.ts` uses. **On Armand's firmware there is no SMP endpoint → the existing "Start update" button physically cannot flash this watch.** Any auto-OTA plan has to acknowledge this.

## What we can actually build for firmware

### 1. Read + display the current firmware version
Add a `getFirmwareRevision(connectedId)` helper that reads GATT `0x180a / 0x2a26` on connect and stores it in `useVyroBand`'s context. Surface it in:
- Debug tab, top section: `Firmware: <string> · Hardware: <string> · Serial: <string>`.
- Band panel, next to Connected status.

### 2. Fetch a firmware manifest from a URL
- Add a `VITE_FIRMWARE_MANIFEST_URL` env variable (you provide the URL). Manifest shape:
  ```json
  { "latestVersion": "1.2.3", "downloadUrl": "https://…/qcband_1.2.3.bin", "sha256": "…", "notes": "…" }
  ```
- On connect, fetch the manifest, compare `latestVersion` to the DIS reading.
- If newer, show a banner in Band panel: *"Firmware update available: 1.2.3 (you have 1.2.1)"* + a **Download & Install** button.

### 3. About actually flashing it — needs your input
The uploaded firmware image can be handed to `runOtaUpload`, but **only if the watch exposes SMP**. Since Armand's build does not, we have two honest paths:

- **(a)** Armand adds the SMP service to the firmware (standard MCUmgr — a few kB and one call to `smp_bt_register`) and we ship it as-is. Auto-OTA then Just Works after this plan.
- **(b)** Armand documents the QCBand-proprietary OTA opcode(s) (some QCBand firmwares use `0xF0`/`0xF1` on the 6e40fff0 write char with 16-byte framed image chunks). We implement a `runQcBandOtaUpload` next to `runOtaUpload`. This can't be done from the debug bundle alone — I need the spec.

I'll build (1) + (2) now so you always see the version and get a "new firmware available" nudge; (3) can only be finished when you tell me which of (a)/(b) applies. **Do not tell the user auto-flash is working yet — it isn't, and it can't without the SMP service on the watch side.**

## What to check for remaining metrics (needs a fresh debug bundle)
Reconnect, wait 60s, paste the NEW bundle. Look at the Debug tab's new sections:

- **Decoder output per metric** — `hr`, `spo2`, `skinTemp`, `bp` rows.
  - If `count > 0` here but tile grey → freshness gate issue (already relaxed once, would relax again).
  - If `count = 0` but `0x69` count > 0 in per-opcode → decoder sub-type mismatch; the plan's step 4 handles it below.
  - If both are 0 → firmware still refuses the sub-type after my compressed sweep + watchdog re-arm. Then it's a firmware-side issue.
- **Motion tap** — should now show `op=0x87 b1=0xee` / `op=0x89 b1=0xee` traffic. Those are the watch replying "feature unsupported / keep-alive" to one-key measure attempts. If we ONLY see 0xee replies for HR/SpO₂/Temp/BP even after all sub-types tried, then Armand's firmware isn't emitting those metrics regardless of app — it's a firmware build issue and we escalate to him.

### 4. If a fresh bundle shows `0x69` frames arriving but decoder = 0 for a specific metric
Extend `decodeQcBandMeasureFrame` / add sub-type-specific parsers in `src/lib/vyro-ble/packets.ts` for whatever sub-types the watch is actually replying on (visible in the fresh bundle's `perOpcode.0x69.lastHex` byte 1). Route each to `setX + markSignal + tapDecoded`.

### 5. If nothing new arrives, add one more nudge on connect
Some QCBand firmwares need `0x69 <sub> 0x03` (mode=hold) after `0x69 <sub> 0x01` (mode=start) to keep the sensor on. If step (4) shows the frame stops after ~2s, I'll add a `hold` write per sub-type in the measure loop.

## Files touched (build phase)
- `src/hooks/use-vyro-band.ts` — read DIS 0x2a26 on connect, expose `firmwareRevision`.
- `src/lib/vyro-ble/firmware-manifest.ts` (new) — fetch + version-compare helpers.
- `src/components/vyro/BandPanel.tsx` — show current version + "update available" banner + wire manifest.
- `src/components/vyro/DebugView.tsx` — new "Device info" section with firmware/hardware/serial.
- `.env` — add `VITE_FIRMWARE_MANIFEST_URL` placeholder (you fill it in).
- No touching `src/integrations/supabase/*` (auto-generated), no changes outside `/app2`.

## Out of scope
- Actually flashing the new firmware end-to-end — blocked on choice (a) or (b) above.
- UI redesign of tiles.
- Fake "firmware updated ✓" success states.
