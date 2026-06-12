## Goal

Stop using the static `vyro-app.html` iframe + popup overlay. Build a real Whoop-style React app where every screen is wired to live BLE data from the VYRO band — metrics shown as inline widgets, not a floating panel.

## What's wrong today

- `/app` loads `public/vyro-app.html` in an iframe — a frozen design template with hardcoded names, matches, leaderboards. None of it reacts to the watch.
- Live data only exists in a small overlay popup floating on top.
- The React views I already built (`HomeView`, `SessionView`, `RecoveryView`, etc.) are sitting unused.

## Plan

### 1. Kill the iframe
- `src/routes/_authenticated/app.tsx` renders the React `Layout` + view-switcher directly. No more iframe, no more overlay popup.
- Delete `public/vyro-app.html` and the `restored_*.html` artifacts.

### 2. Light/white visual theme to match what you liked
- Move the existing dark components to a light surface: white background, soft gray cards, black text, single accent (teal/emerald for "live"). Keep the original Whoop-like density.
- Update `src/lib/vyro-tokens.ts` + `src/components/vyro/shared.tsx` so every view picks up the new tokens automatically.

### 3. Real-data widgets on the Home dashboard
Top of `HomeView`:
- Greeting uses signed-in user's `display_name` ("Good morning, {firstName}").
- Connection chip: `LIVE` (green, pulsing) / `CONNECTING` / `OFFLINE — pair your band`.

Widget grid (each is a real component reading `useVyroBandCtx()`):
- **Session control** — Start / Pause / End buttons + sport selector, current session timer.
- **Event counts** — Swings, Rapid starts, Bursts, Direction changes (live counters).
- **Peak motion** — Peak accel (g), Peak gyro (dps), Peak jerk (g/s).
- **Swing quality** — Max intensity (0–100), Max duration (ms), avg over last 10 swings.
- **Reaction** — Fastest direction-change gap (ms).
- **Event stream** — Last 20 motion events with timestamp and type.
- **Throughput** — Events / min (rolling 60s), total this session.

When the watch is offline, every widget shows `—` and a "Pair your band" CTA in the empty state — never fake numbers.

### 4. Other tabs rewired or removed
- **Session** tab → full session log: timeline of events, per-swing detail rows, end-of-session summary written to the `sessions` table on End.
- **Profile** tab → existing `ProfileView` (band pairing, profile fields). Keep as-is.
- Remove tabs that have no data source the watch can feed: **Sleep**, **Diet**, **Coach**, **Social**, **Video**, **Trends** (the watch is IMU-only — no HR/HRV/SpO₂, no sleep staging, no nutrition). Bottom nav becomes: **Home · Session · History · Profile**.
- **History** = list of saved `sessions` rows for the user (already in DB), each opens the recorded summary.

### 5. Persist sessions
- On `End session`, write a row to the existing `sessions` table with the live counts and a `summary` JSON of peak/avg metrics. Already has RLS scoped to `auth.uid()`.
- History tab reads via a `getMySessions` server fn.

### 6. Cleanup
Delete unused fake-data files: `src/lib/vyro-data.ts` (mock arrays), `SleepView`, `DietView`, `CoachView`, `SocialView`, `VideoView`, `TrendsView`, `SportView` (or fold its sport picker into Session control), `LiveMetrics.tsx` (replaced by widgets), `PerformanceCard.tsx` (if only used by removed views).

## Technical details

- All widgets subscribe via `useVyroBandCtx()` — single BLE subscription stays alive across navigation thanks to the existing provider + auto-reconnect.
- New components under `src/components/vyro/widgets/` (one file per widget) so each is small and testable.
- New server fns in `src/lib/sessions.functions.ts`: `saveSession`, `getMySessions`, `getSession(id)`.
- Greeting + initials read from `profile.display_name` via existing `getMyProfile` server fn.

## Out of scope (call out for you)

- Backgrounding the BLE link when the browser tab is closed — Web Bluetooth tears down GATT on tab close; only the native iOS bridge keeps it alive. App auto-reconnects on tab reopen.
- HR / HRV / SpO₂ / sleep / nutrition widgets — the band does not produce these signals.

## Approve?

If yes I'll execute. If you want any tabs kept (e.g. keep "Coach" as a placeholder), tell me before I delete them.
