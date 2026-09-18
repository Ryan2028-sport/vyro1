# Contributing to VYRO

Every change — human or AI-authored — ships in the same shape: small, reviewable, tested,
and described in a commit message a stranger can read in six months.

## Local setup

```bash
bun install
bun run dev
```

## Branches

```text
feat/readiness-hero-arcs
fix/ble-hr-restart-on-resume
chore/deps-tanstack-router
docs/ble-protocol
refactor/vyro-scores-provider
```

`<type>/<short-kebab-summary>`. No personal names, no `wip`, no dates.

## Commits — Conventional Commits

```text
<type>(<scope>): <imperative summary, ≤72 chars>

<why the change exists; what changed at a high level; trade-offs>

Refs: #123
```

Types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `revert`.
Scopes used here: `band`, `ble`, `ota`, `readiness`, `sleep`, `sport`, `video`, `ui`, `auth`,
`db`, `deps`.

Good:

```text
fix(ble): restart HR stream after iOS background resume

Backgrounded WebKit drops the HR notification without emitting a
disconnect, so the pipeline went silent until manual re-pair. Re-subscribe
on visibilitychange and re-issue the measurement start.
```

Bad: `update code`, `fixes`, `asdf`, `final v2`.

## Pull requests

- One concern per PR. Split refactors from behaviour changes.
- Fill in the PR template: what, why, how verified, screenshots for UI.
- Green CI is required: lint, types, tests, build.
- UI changes need before/after screenshots at 390×844 (iPhone) and desktop.
- Band/BLE changes state the firmware version tested against.

## Code standards

- **TypeScript strict.** No `any` to silence a compiler error — model the type.
- **Styling.** Semantic design tokens only. No `text-white`, `bg-black`, `bg-[#hex]`.
- **Accessibility.** 44pt touch targets, visible focus, labelled controls, reduced-motion
  variants, contrast checked in dark mode.
- **Data.** Loader + `useSuspenseQuery`. No `useEffect` fetch waterfalls.
- **Server code.** `*.functions.ts` for client-callable RPC, `*.server.ts` for server-only.
  Read `process.env` inside handlers. Protected functions never run in a public loader.
- **Database.** Every new public table ships `CREATE TABLE` → `GRANT` → `ENABLE RLS` →
  policies in the same migration. Roles never live on a profile table.
- **No dead placeholders.** Ship real data paths or an explicit empty state.

## Verification before you push

```bash
bun run lint
bunx tsgo --noEmit
bunx vitest run
bun run build
```

## Review checklist

- [ ] Scope matches the title; no drive-by changes
- [ ] No secrets, tokens or generated files committed
- [ ] Loading, empty and error states handled
- [ ] Works at 390px width and with reduced motion
- [ ] Migrations are additive and reversible in practice
- [ ] Docs/README updated when behaviour or setup changed
