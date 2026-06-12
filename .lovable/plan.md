## Goal

Replace the frozen `public/vyro-app.html` export with a real, route-based TanStack app so auth, profile, and watch pairing all live in one place — and the existing `src/components/vyro/*` views become the actual UI users see.

## What changes

### 1. Auth (Lovable Cloud)
- Add `/auth` route: email + password sign-up / sign-in, plus Google (managed via `lovable.auth.signInWithOAuth`).
- Create `profiles` table (id → auth.users, display_name, avatar_url, sport, handedness, paired_band_id, paired_band_name, updated_at) with RLS scoped to `auth.uid()` and an auto-create trigger on signup.
- Add the integration-managed `_authenticated` layout gate so every protected route redirects to `/auth` when there's no session.

### 2. Real routing
- Delete the redirect in `src/routes/index.tsx`.
- Move the existing `src/components/vyro/*` views under `_authenticated`:
  - `/` → HomeView (landing for signed-in users)
  - `/session`, `/sport`, `/recovery`, `/sleep`, `/diet`, `/trends`, `/coach`, `/video`, `/social` → the matching view components.
  - Wire the bottom nav in `Layout.tsx` to TanStack `<Link>` instead of internal tab state.
- Public landing at `/welcome` (or keep `/` public + redirect signed-in users to `/home`) — confirm later; default plan: `/` is public marketing + Sign in CTA, `/home` etc. are protected.
- Delete `public/vyro-app.html` and `public/watch-test.html`. Keep `calibration.html` etc. for now.

### 3. Profile + Watch (the core ask)
- New `/profile` route under `_authenticated`:
  - Profile fields (name, sport, handedness, avatar).
  - **Band section** — pulls the full pairing + live event feed + OTA firmware uploader out of `/watch` and into a `<BandPanel />` component used here. Persists `paired_band_id` / `paired_band_name` on the profile row.
- Delete the standalone `/watch` route. Add a small "Manage band" entry in the profile dropdown / settings.
- Remove all "demo mode" stubs from the views — they read live data from the `useVyroBand` hook (already built) plus Cloud-backed session history.

### 4. Sessions persistence (so it isn't demo data)
- `sessions` table (user_id, sport, started_at, ended_at, swing_count, rapid_count, burst_count, dir_change_count, summary jsonb) with RLS.
- `useVyroBand` start/end now writes a row via a `createServerFn`.
- HomeView, TrendsView, SportView read recent sessions via `ensureQueryData` + `useSuspenseQuery`.

### 5. Cleanup
- Remove orphan routes/files: `watch.tsx`, `bluetooth.tsx` (folded into BandPanel), `vyro-app.html`, `watch-test.html`, `vyro-native.js` references that targeted the static bundle.

## Technical notes

- All new server reads/writes go through `createServerFn` + `requireSupabaseAuth`; `attachSupabaseAuth` is already wired in `src/start.ts`.
- BLE code (`src/lib/vyro-ble/*` + `useVyroBand`) is unchanged — only its host UI moves from `/watch` to `<BandPanel />` inside `/profile`.
- iOS Despia bridge: pairing/notify/write work today; OTA still needs binary-write support in the bridge — surfaced in BandPanel as a "Desktop Chrome required for firmware updates on iOS until bridge update" notice.
- Google OAuth: I'll call `supabase--configure_social_auth` for `google` in the same turn it's added.

## Order of execution

1. Migration: `profiles` + `sessions` tables + signup trigger + RLS + grants.
2. Enable Google provider, build `/auth` route, build managed `_authenticated/route.tsx`.
3. Port each Vyro view into a real route under `_authenticated`; rewrite `Layout.tsx` nav to use `<Link>`.
4. Build `/profile` with `<BandPanel />` (lifted from `watch.tsx`).
5. Delete `watch.tsx`, `bluetooth.tsx`, `vyro-app.html`, `watch-test.html`, redirect from `index.tsx`.
6. Wire session persistence + replace demo data reads.

## Open questions before I start

1. **Landing page**: should `/` stay a public marketing page with a Sign-in CTA (signed-in users get redirected to `/home`), or should `/` itself be the signed-in home and unauth users get bounced to `/auth`?
2. **Demo data**: OK to remove all hard-coded mock data from HomeView/TrendsView/SportView/etc., so empty states show until the user actually records a session? (Recommended — otherwise it still feels like demo mode.)
3. **Google sign-in**: enable alongside email+password (recommended default), or email-only?
