# Architecture

## Runtime

```text
Browser / native shell
   │  React 19 + TanStack Router (file-based routes)
   │  Web Bluetooth  ──►  VYRO Band (nRF54, RFH59Pro firmware)
   ▼
TanStack Start SSR  (Cloudflare Workers, nodejs_compat)
   │  createServerFn RPC   ·   src/routes/api/* HTTP routes
   ▼
Lovable Cloud (Postgres + Auth + Storage, RLS enforced)
```

The Worker runtime has no OS process: no `child_process`, `sharp`, `puppeteer`, or native
addons in server code. Prefer pure JS, Web APIs, or WASM builds.

## Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Routes | `src/routes` | URL surface, head metadata, loaders, auth gate |
| Surfaces | `src/components/vyro` | Product screens and the app shell |
| Primitives | `src/components/ui` | shadcn components, styling-only |
| State | `VyroBandProvider`, `VyroScoresProvider` | Connection + metric pipeline; derived scores |
| Domain | `src/lib` | Scoring, sessions, video analysis, server functions |
| Protocol | `src/lib/vyro-ble` | Packet framing, decoders, OTA, transport |
| Data | `supabase/migrations` | Schema, grants, RLS policies |

## Score pipeline

1. **Transport** — `web-transport.ts` (browser) or the Capacitor BLE bridge subscribes to
   band notifications.
2. **Decode** — `qcband.ts` frames packets by opcode and emits typed samples; unsupported
   opcodes are held back with a backoff so they cannot starve the scheduler.
3. **Pipeline** — `use-vyro-band.ts` runs a deterministic measurement scheduler (HR always
   returns between single-metric cycles), tracks freshness per channel, and records
   diagnostics.
4. **Derive** — `useLiveMetrics.ts` normalises channels; `VyroScoresProvider` computes
   readiness only when HR plus enough independent fresh channels exist. Otherwise the UI
   shows a calibrating state rather than a fabricated number.
5. **Persist** — `useMetricsPersistence.ts` and `metrics.functions.ts` write to the backend,
   scoped to the signed-in user by RLS.

## AI video analysis

`scanVideo` decodes frames in-browser: camera-cut detection, background reset, kit-colour
re-identification, scoreboard masking and playable-shot triage. Aggregates go to
`video-analysis.server.ts` for tactical verification, then to `AiVideoView` for heat maps,
T-discipline and rally profiles. `video-analysis-core.ts` parses both `{"labels":[…]}` and
bare-array model responses.

## Access control

`user_roles` (separate table) + `has_role(uuid, app_role)` security-definer function. Admin
gates Debug, live-motion and firmware tooling. Never derive admin from client storage.

## Conventions that keep this stack healthy

- Route files exist for every link target; `routeTree.gen.ts` is generated — never edited.
- Browser-only libraries are imported dynamically behind `ClientOnly`; SSR evaluates imports.
- No `react-router-dom`, no `src/pages`, no `App.tsx` page switcher.
- Every content route defines its own `head()` with a unique title and description.
