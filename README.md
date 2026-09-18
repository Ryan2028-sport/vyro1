# VYRO

Wearable-native performance platform for racket-sport athletes. VYRO pairs the VYRO Band
(BLE wearable) with a mobile-first web app that turns raw sensor streams into readiness,
recovery, sleep and match-intelligence insight — plus AI video analysis of squash matches.

<p align="left">
  <img alt="stack" src="https://img.shields.io/badge/TanStack%20Start-v1-0f172a" />
  <img alt="react" src="https://img.shields.io/badge/React-19-0f172a" />
  <img alt="tailwind" src="https://img.shields.io/badge/Tailwind-v4-0f172a" />
  <img alt="runtime" src="https://img.shields.io/badge/Runtime-Cloudflare%20Workers-0f172a" />
</p>

---

## Table of contents

- [Features](#features)
- [Quick start](#quick-start)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Architecture](#architecture)
- [Environment](#environment)
- [Contributing](#contributing)
- [Security](#security)

## Features

| Area | What it does |
| --- | --- |
| **Readiness** | Composite score from HRV, resting HR, sleep, strain and skin temperature — gated on live, trusted band signals only. |
| **Vitals** | Heart rate, SpO₂, respiration, skin temperature, blood pressure, stress, HRV. |
| **Sleep & Recovery** | Nightly stage data, recovery trend, return-to-play validation. |
| **Sport** | Sport-specific profiles, session capture, training blocks and cognitive load. |
| **AI Video Analysis** | Frame-by-frame squash match scanning: T-discipline, shot heat maps, rally profiles, AI tactical insight. |
| **Band tooling** | BLE pairing, live packet inspection, OTA firmware update, diagnostic snapshots (admin-only). |

## Quick start

```bash
bun install
bun run dev          # http://localhost:8080
```

Requirements: [Bun](https://bun.sh) 1.1+ and Node 20+. A Chromium-based browser is needed for
Web Bluetooth; iOS pairing requires the native TestFlight/App Store build (Home Screen PWAs
have no Bluetooth access).

## Scripts

| Script | Purpose |
| --- | --- |
| `bun run dev` | Dev server with HMR |
| `bun run build` | Production build (Workers target) |
| `bun run preview` | Serve the production build locally |
| `bun run lint` | ESLint |
| `bun run format` | Prettier write |
| `bunx tsgo --noEmit` | Type check |
| `bunx vitest run` | Unit tests |

## Project structure

```text
src/
├── routes/                # File-based routes (TanStack Router)
│   ├── __root.tsx         # Shell, head metadata, providers
│   ├── _authenticated/    # Auth-gated subtree
│   └── api/               # Server routes (webhooks, public endpoints)
├── components/
│   ├── vyro/              # Product surfaces (Athlete, Sport, Sleep, AI Video, Debug…)
│   └── ui/                # shadcn primitives
├── hooks/                 # use-vyro-band, use-roles, use-bluetooth…
├── lib/
│   ├── vyro-ble/          # BLE protocol: packets, decoders, OTA (SMP/CBOR), transport
│   ├── *.functions.ts     # createServerFn RPC (client-callable)
│   └── *.server.ts        # Server-only helpers
├── integrations/supabase/ # Generated backend clients & types
└── styles.css             # Tailwind v4 theme tokens
supabase/migrations/       # Versioned SQL (schema, RLS, grants)
```

## Architecture

- **Framework** — TanStack Start v1 (React 19, Vite 7), SSR on Cloudflare Workers.
- **Data flow** — route loaders `ensureQueryData` → components `useSuspenseQuery`. No ad-hoc
  `useEffect` fetching.
- **Server boundary** — app-internal logic is `createServerFn` in `*.functions.ts`; raw HTTP
  (webhooks, cron) lives in `src/routes/api/`.
- **Scores** — `VyroScoresProvider` is the single source of truth for readiness and
  sub-scores; `VyroBandProvider` owns the BLE connection and the metric pipeline.
- **Design system** — semantic tokens in `src/styles.css` + `vyro-tokens.ts`. Never hardcode
  colour utilities; the app follows Apple HIG (safe areas, 44pt targets, reduced motion).
- **Access control** — roles live in a dedicated `user_roles` table with a security-definer
  `has_role()` function. Debug and firmware tooling is admin-only.

More detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and
[`docs/BLE.md`](docs/BLE.md).

## Environment

Backend credentials and connector secrets are injected by the platform. Client-visible values
use the `VITE_` prefix; everything else is read inside server handlers via `process.env`.
`.env` is generated — never commit secrets or edit generated integration files.

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) for branch naming, Conventional Commits, PR
expectations and the review checklist.

## Security

Report vulnerabilities privately — see [`SECURITY.md`](SECURITY.md).
