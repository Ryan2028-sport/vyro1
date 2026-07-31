## What I found (verified in code)

- **Three different recovery formulas exist.** `RecoveryView` and the Sport tab's Readiness lens both call `computeLiveRecovery()`, but the Sport lens *headline* is the average of `rec.score` and `rec.parts.muscle` (`SportView.tsx:310, 318`), so the tile can read far below the Recovery hero. Meanwhile the Athlete home and `AthleteView` show a completely different number from `computeSubScores().recovery` (`App2ReferenceShell.tsx:451`, `AthleteView.tsx:27`). That's the 31 vs 87 split.
- **Readiness label bug:** `AthleteView` hardcodes the ring label `"Ready"` regardless of score (`AthleteView.tsx:90`), and the Athlete-home pill thresholds (`>=70 Ready`) are applied to *readiness*, not the recovery band, so a low recovery can still sit next to a green tag.
- **RTP Validator / Muscle Readiness / Recovery Environment** are computed from `localStorage` baselines (`BASELINE_KEY` in `App2ReferenceShell.tsx:43`) and `computeLiveRecovery` parts — never from the `daily_metrics` / `metric_samples` tables that already exist.
- **Hardcoded Today's Plan:** three literal training blocks in `useState` (`App2ReferenceShell.tsx:416-420`), including "Match practice vs. Alex K.". No plan table exists.
- **Sport tab has only the overview.** `CourtDbView.tsx`, `SwingView.tsx`, `TendencyView.tsx` exist but are not referenced anywhere — the old `Layout.tsx` shell used them; the current `App2ReferenceShell` renders only `SportView`.
- **Athlete tab does not render `AthleteView`** at all (it renders the shell's inline `AthleteHome`), so Steps and Resting HR never appear.
- **Sport bleed:** `SportView` labels are literally "Squash snapshot" and "Six lenses on squash" and no sport-specific filtering is applied to the metric derivations; `SPORT_PROFILES` carries static demo values.
- **Social tab** is already placeholder-free empty states — but there is **no social/leaderboard schema** in the database, so "connect to the real social database" needs tables created first.
- **Sleep tab** still derives from a `localStorage` sample buffer (`vyro.sleep.samples.v1`) even though a `sleep_nights` table exists.

## Plan

### 1. Single source of truth for recovery + readiness
- Add a `VyroScoresProvider` (inside `VyroBandProvider`) that computes **once**: `recovery` (from `computeLiveRecovery`), its `parts` (cardio, muscle, loadDebt, environment, confidence), `readiness`, `strain`, `fatigue`, `agility`, `sleep`, and the band classification.
- Expose `useVyroScores()`. Replace every local computation in `App2ReferenceShell`, `RecoveryView`, `SportView`, `AthleteView`, `CoachView`, `HomeView`, `TrendsView` with reads from this hook. Delete the per-view `computeLiveRecovery` / `computeSubScores` calls so divergence is structurally impossible.
- Sport tab's Readiness lens shows `recovery` directly as the headline (no averaging with muscle).

### 2. Readiness / status labels
- Derive every status tag from one helper in the provider (`recoveryBand(recovery)` → Ready / Manage / Recover / Calibrating) and use it in the Athlete pill, `AthleteView` ring label (remove the hardcoded "Ready"), Recovery hero, and Coach read. Score below 67 can never render a green "Ready".

### 3. Real data sources
- Extend the metrics server functions to read `daily_metrics` / `metric_samples` for 7-day rolling baselines (readiness, resting HR, HRV, reaction).
- Rewire **RTP Validator** to compare live wearable power against the DB baseline (fall back to "building baseline" when there aren't enough days) instead of `localStorage`.
- Surface **Muscle Readiness** and **Recovery Environment** as the provider's `parts.muscle` / `parts.environment`, with an explicit source line ("IMU load", "SpO₂ + skin temp + HRV") and "—" when the channel is silent.

### 4. Remove placeholder data
- **Today's Plan:** new `training_plan_items` table (user-scoped, RLS + grants) + server functions; the card fetches and mutates real rows. No seeded blocks.
- **Sport tabs:** strip static `SPORT_PROFILES` numbers from anything rendered; every card shows live-derived values or "—".
- **Sleep tab:** read/write through `sleep_nights` via the existing `use-sleep-nights` hook; localStorage becomes only a write-behind buffer, and all fabricated stage/debt values are removed when absent.
- **Social tab:** create minimal schema (`groups`, `group_members`, `leaderboard_entries` computed from `sessions`) and wire the categories to it. If you'd rather defer social, I'll leave the current empty states untouched.

### 5. Restore missing views
- Add sub-tab navigation inside the Sport tab: **Overview | Court DB | Movement | Motion | Tendencies**, mounting the existing `CourtDbView` (heat-map/route tables), a Movement panel (motion peaks + route agility), `SwingView` for Motion, and `TendencyView`.
- Mount `AthleteView` in the Athlete tab (or merge its sections into `AthleteHome`), ensuring **Steps** and **Resting HR** tiles read `stepsToday` / `restingHrBpm` from live context.
- Audit `CoachView` bindings against the scores provider so its assessment reflects live values.

### 6. Sport selection correctness
- Lift selected sport into the provider (seeded from `profiles.sport`), persisted on change.
- Make all labels and derivations sport-aware: squash-specific text ("Squash snapshot", "six lenses on squash", squash route names) becomes driven by the selected sport, and Tennis renders tennis routes/labels and tennis-tuned thresholds. Session/history queries filter by `sessions.sport`.

## Technical notes
- New tables (`training_plan_items`, and social tables if in scope) get `GRANT`s + RLS scoped to `auth.uid()` in the same migration.
- The scores provider lives in the client (BLE data is browser-side); baselines come from server functions under `_authenticated`.
- No change to the BLE decode layer — this work is state wiring and UI.

## One open question
The social leaderboards have no backing schema yet. Do you want me to create the group/leaderboard tables in this pass, or leave Social as empty states for now?
