# VYRO Band — BLE integration notes

> This documents the **app side** of the protocol. Watch firmware source lives in the
> firmware repository; only the wire format is described here.

## Modules

| File | Role |
| --- | --- |
| `uuids.ts` | Service and characteristic UUIDs |
| `web-transport.ts` | Web Bluetooth transport (Chromium, native shell) |
| `packets.ts` | Frame build/parse + unit tests (`packets.test.ts`) |
| `qcband.ts` | Opcode dispatch, measurement frames, history decoding |
| `session-control.ts` | Measurement start/stop sequencing |
| `respiration.ts` | Respiration estimation from HR/IMU (`respiration.test.ts`) |
| `smp.ts`, `cbor.ts`, `ota.ts` | MCUmgr/SMP OTA firmware update |
| `decoder-tap.ts` | Diagnostic tap feeding the Debug tab |

## Connection lifecycle

1. Pair and connect → subscribe to notifications.
2. `setTime` handshake, then a serialised command queue (one in flight at a time).
3. Deterministic scheduler cycles measurements; HR resumes between single-metric cycles.
4. Silence watchdog re-issues starts; visibility changes re-subscribe after iOS suspension.
5. Unsupported opcodes are recorded and backed off, not retried in a tight loop.

## Freshness rules

Each channel carries a timestamp. History packets are deduplicated and never presented as
live. A metric renders only while its sample is fresh; readiness needs HR plus enough
independent fresh channels, otherwise the UI stays in calibration.

## Platform constraints

- **iOS** — Web Bluetooth is unavailable in Safari and Home Screen PWAs. Pairing requires
  the native TestFlight/App Store build.
- **Android** — Chromium Web Bluetooth works; the native shell routes through the Capacitor
  BLE plugin.
- **Background** — silent-audio + Wake Lock keep-alive maintain decoding while backgrounded;
  streams are restored on resume.

## Debugging

The admin-only Debug tab shows opcode counters, pipeline state, firmware version and raw
events, and can copy a full diagnostic bundle. Snapshots also sync to the backend while the
band is connected.
