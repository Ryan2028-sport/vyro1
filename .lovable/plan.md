## Goal

Make the in-app UI match the VYRO spec: 8 metric domains (Athlete Health, Recovery & Fatigue, Sleep, Session, Court/Heat Map, Swing, Tendency/Coach, Diet Coach) — each as a real screen wired to the existing BLE band hook, with live data where the band provides it and clearly-labeled placeholders where it doesn't yet.

Keep everything already working: TanStack Start routing, Supabase auth, `VyroBandProvider`, `useVyroBand` hook, BLE/Capacitor pairing, OTA, session start/pause/end.

## Scope (this turn — Phase 1)

Rebuild navigation + the 4 highest-value screens end-to-end so the new structure is in place. Remaining screens get stub views with the correct metric layout but "—" values, ready to wire next turns.

### Files to add / change

1. `src/components/vyro/featureSpecs.ts` — replace the current feature list with the 8 canonical domains from the spec (id, label, icon, blurb, route).
2. `src/components/vyro/Layout.tsx` — bottom-tab nav becomes: **Home · Session · Recovery · Sleep · More**. "More" opens a grid of the remaining domains (Court DB, Swing, Coach, Diet).
3. `src/components/vyro/HomeView.tsx` — Athlete dashboard from the spec: Current HR, Resting HR, HRV, Respiratory rate, SpO₂, Skin temp, Stress, Steps, Calories, Wear time, Signal confidence, plus a LIVE Recovery hero card and quick "Start Session" CTA.
4. **NEW** `src/components/vyro/RecoveryView.tsx` — LIVE Recovery score, status band (green/yellow/red), Total fatigue + subcomponents (court coverage, cardio, muscle load debt, HRV suppression, sleep debt), Time-to-ready, Return-to-Play validator.
5. **NEW** `src/components/vyro/SleepView.tsx` — Sleep score, time in bed, asleep duration, efficiency, stage breakdown (Deep/REM/Light/Awake), bedtime/wake, latency, debt, 7-night trend, wake events list.
6. `src/components/vyro/SessionView.tsx` — extend existing console: live HR, avg/max HR, HR-zone bars, Z4/Z5 time, between-point HR drop, movement intensity, burst count, T-control %, T-recoveries, session load.
7. **NEW** stubs (correct layout, "—" values): `CourtDbView.tsx`, `SwingView.tsx`, `CoachView.tsx`, `DietView.tsx`, `TendencyView.tsx`.
8. `src/routes/_authenticated/app.tsx` — register the new view ids in the switch.
9. `src/components/vyro/useLiveMetrics.ts` — extend with derived placeholders (RecoveryScore, FatigueScore, HR zone bucketer) so views stay reactive when real values are missing.

### Out of scope this turn

- Heat-map canvas rendering (Phase 2 — needs a position model the band doesn't yet emit).
- AI Video overlays (Phase 2).
- Coach roster multi-athlete data (needs DB schema work — Phase 3).
- Pixel-matching the minified HTML's exact colors/typography. We keep the existing Tailwind theme; visual polish pass comes after structure is right.

## Technical notes

- All new views use the existing `Card`, `Stat`, `Pill`, `PageHeader` primitives from `src/components/vyro/shared.tsx`.
- BLE stays untouched: `VyroBandProvider`, `use-vyro-band.ts`, `use-bluetooth.ts`, `vyro-ble/*`, `despia.ts` are not modified.
- All "real" metrics read from `useLiveMetrics()`; missing-sensor metrics render `—` with a small "needs firmware" hint so the UI stays honest.
- No DB schema changes this turn.

## After Phase 1

Confirm the new structure looks right in preview, then I'll wire heat-map canvas, route DB tables, and per-swing event detail in Phase 2.
