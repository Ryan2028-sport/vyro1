# Testing

## Commands

```bash
bun run test           # single run (what CI runs)
bun run test:watch     # watch mode while developing
bun run test:coverage  # text + lcov coverage over src/lib
bun run typecheck      # tsc --noEmit
bun run lint           # eslint
bun run format:check   # prettier, verify only
```

Tests live next to the code they cover as `*.test.ts`. `vitest.config.ts` is deliberately
separate from `vite.config.ts`: the app config loads the TanStack Start and Cloudflare
plugin chain, which is irrelevant to a Node-based unit run and slows it down.

## What is worth testing here

This codebase is mostly a live-hardware UI, so the tests target the parts that are pure,
deterministic and expensive to get wrong:

| Area | Why it is tested |
| --- | --- |
| `src/lib/vyro-ble/cbor.ts` | Encodes SMP/OTA payloads. A silent bug bricks firmware updates. |
| `src/lib/vyro-ble/session-control.ts` | Byte-exact command envelopes the firmware parses. |
| `src/lib/vyro-ble/packets.ts` | Hex/base64 ingestion from two different transport bridges. |
| `src/lib/vyro-ble/respiration.ts` | Signal processing that must refuse to guess when data is thin. |
| `src/lib/video-analysis-core.ts` | Parses untrusted model output in several shapes. |

## Rules

- **Never assert a fabricated physiological value.** Metric code must return `null` when the
  signal is not trustworthy; assert that refusal explicitly.
- **No network, no BLE, no Supabase in unit tests.** If a module needs them, extract the pure
  logic and test that.
- **Byte-level assertions for protocol code.** Compare `Array.from(bytes)` against literals so
  a diff shows the exact packet change.
- **Every bug fix ships with a regression test** when the failure is reachable without hardware.

## Hardware paths

Band pairing, notification subscription and OTA cannot be unit tested. Verify those manually
against the iOS TestFlight build and record what you observed in the pull request, including a
Debug-tab bundle when metrics are involved.
