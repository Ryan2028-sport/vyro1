# Fix Watch Metrics and Base Readiness

## Confirmed problems

- **Base Readiness is not a value sent directly by the watch.** It is calculated in the app from validated watch signals. It should therefore be labeled and treated as a watch-derived score, with no score shown until enough real inputs exist.
- The measurement scheduler queues roughly **6.4 minutes of work every 3 minutes**, so cycles overlap. Heart-rate keep-alives and frequent activity requests also compete with HRV, SpO₂, temperature, stress, and blood-pressure measurements.
- Measurement subtype values overlap between firmware families. The current decoder can route one `0x69` frame through multiple decoders—for example subtype `0x04` can be treated as both temperature and stress—creating incorrect values.
- Current Fatigue, Agility, and Strain can consume “motion” synthesized from changing health-command packets (`0x69`, `0x73`, `0x87`, `0x89`). Those packets are not verified IMU samples, so the Base Readiness values shown in the screenshots are not sufficiently trustworthy.
- Respiration has state/UI but **no implemented firmware decoder or command**. Sleep opcode `0x32` is also explicitly marked as awaiting a finalized firmware layout. These must remain unavailable unless the connected firmware actually provides a documented field.

## Implementation plan

### 1. Make BLE collection deterministic

- Replace the overlapping timers with one connection-owned, cancellable command scheduler.
- Complete setup and notification subscriptions first, then execute one biometric measurement at a time.
- Pause conflicting optical HR hold/start commands while another optical measurement is active, then resume HR afterward.
- Prevent a new cycle from starting until the current cycle finishes; reduce overly frequent activity polling and prioritize missing health signals.
- Track every request by metric, subtype, start time, response, timeout, and unsupported/error result.

### 2. Decode each frame exactly once

- Add an explicit firmware/protocol profile selected from firmware revision, discovered services, and observed response layout.
- Route `0x69` frames exclusively by profile + payload shape instead of trying every overlapping subtype interpretation.
- Treat `0x87`, `0x89`, `0xee`, empty history packets, and command echoes as status/unsupported responses—not metric values or motion.
- Keep strict physiological range checks and attach source metadata to every accepted sample: opcode, subtype, characteristic, timestamp, and decoder.

### 3. Remove synthetic motion from health packets

- Stop converting generic QCBand packet byte changes into swings, jerk, acceleration, or reaction events.
- Accept motion only from the real VYRO motion characteristic or a documented raw IMU packet layout.
- Keep Fatigue, Agility, Strain, Muscle Readiness, and Load Debt unavailable when their required real motion inputs are absent rather than generating plausible-looking numbers.

### 4. Rebuild Base Readiness as an auditable watch-derived score

- Keep `VyroScoresProvider` as the single global source for Readiness, Recovery, Fatigue, Agility, Sleep, Strain, and RTP.
- Define the required inputs for each subscore and require fresh, source-verified samples.
- Publish Base Readiness only when the minimum independent signal set is present; otherwise show exactly which inputs are still missing.
- Do not count derived Resting HR as an independent sensor channel when it comes from the same live HR stream.
- Ensure the hero ring, Base Readiness rows, Recovery tab, Sport tab, Coach tab, and RTP all consume the same canonical score and confidence state.

### 5. Make unsupported vs broken metrics clear

- Keep every existing metric visible.
- Replace the generic “awaiting signal” state with precise states: `measuring`, `received`, `no response`, `unsupported by firmware`, `decoder rejected`, or `stale`.
- For respiration and sleep, only add decoding if the current firmware packets prove a real documented field; otherwise display “unsupported by connected firmware” without fabricating a value.

### 6. Upgrade Debug evidence

- Add a per-metric pipeline table: command sent → write result → response opcode/subtype → decode result → context value → score usage.
- Add active protocol profile, discovered capabilities, scheduler queue/current command, timeout reason, and unsupported response bytes.
- Reset diagnostic counters per connection and include all of this in the existing copied debug bundle.

### 7. Tests and verification

- Add packet fixtures for both legacy and new SDK layouts, ambiguous subtype collisions, unsupported/error replies, V2 chunked history, and malformed values.
- Add score tests proving HR-only or HR + derived Resting HR cannot produce Base Readiness, and proving unverified health packets cannot produce motion scores.
- Add scheduler tests proving cycles do not overlap and commands stop cleanly on disconnect.
- Verify `/app2` and the Athlete, Recovery, Sport, Coach, and Debug views with simulated valid, missing, stale, and unsupported watch traffic.

## Expected result

Heart rate will continue streaming, other supported sensors will be measured without command collisions, and Base Readiness will either reflect traceable real watch data or remain honestly unavailable with a specific reason. Metrics the connected firmware does not emit will no longer appear as misleading scores.
