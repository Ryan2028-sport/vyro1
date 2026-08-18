# Make the AI video analysis actually measure the match

Goal: a squash match video goes in, and every number on screen is either **measured from the video** or **verified by the AI against real frames** — nothing invented. Trade speed for accuracy: a 2–5 minute analysis is fine.

## What's wrong today

The scan is deliberately cheap: 24x24 motion grid, at most 420 checkpoints (~0.43s apart on a 3-minute clip), 8 evidence frames, one AI call. Consequences:

- Shot mix (drives, boasts, drops, lobs, forehand/backhand) and winners / forced / unforced errors have **no measured basis at all** — the model guesses them from 8 stills. These are the hallucinated numbers.
- 24x24 cells are ~53px on a 720p frame, so a player's limbs and the ball are the same blob; contacts are inferred purely from motion peaks.
- Both players' identities can swap mid-rally, which smears the two heat maps.
- The report shows AI estimates and measured values in the same style, so the user can't tell which is which.

## The new pipeline

**1. Much denser scan (the bulk of the 2–5 minutes)**
- Sample at a fixed ~4 checkpoints/second (cap ~2,400 for long clips) instead of a flat 420 budget.
- Raise the diff grid to 64x64 and add a rolling background model, so a still player is still detected and camera shake / crowd movement is rejected.
- Two-stage detection per checkpoint: background subtraction → connected blobs → keep the two most body-like blobs (size + aspect + persistence), instead of k-means over raw diff cells.
- Track both players with a small motion-predicting tracker (predicted position + mass continuity) so identities survive occlusions and crossings; assign "you" vs "opponent" from average court depth over the whole clip, not one seed frame.
- Detect contacts from a combination of arm-region motion spike, player stop-and-turn, and direction reversal of the moving mass — not a bare motion maximum.

**2. Real vision verification, not one stills call**
- Capture 24–36 evidence frames, chosen at detected contacts spread evenly across the match (not just motion peaks).
- Run the AI in segments (e.g. 6 chunks of the match, ~5 frames each) and ask it, per segment, only what a frame can answer: which player is striking, forehand or backhand, front/mid/back position, shot family, and whether the rally ended.
- Fuse the per-segment verified labels with the measured timeline, then make one final synthesis call for coaching text using the fused facts as input.
- Shot mix and forehand/backhand counts become counts of **verified** contacts, scaled to the measured contact total, with the verified sample size shown.

**3. Honesty rules in the report**
- Every tile is labelled `Measured`, `Verified by AI on N frames`, or `Estimate` — and anything the pipeline cannot support is dropped rather than filled in.
- Winners / forced / unforced errors are only shown when the AI actually identified rally-ending frames; otherwise the card says the camera angle doesn't allow it.
- Heat maps stay measured-only (no AI-generated grids), with the contact count behind each grid.
- Confidence per section, derived from how much of the match had a clean two-player track.

**4. Better AI Video tab**
- Progress becomes staged and honest: "Scanning motion 41% · 74s of 180s" → "Tracking players" → "Verifying 30 frames with AI (segment 3/6)" → "Writing your report", with elapsed time and a cancel button.
- Court view: heat maps drawn as an actual squash court (T, service boxes, short line) rather than a bare 3x3 grid.
- A measured-stats panel renders as soon as the scan finishes, before the AI leg — so the screen is never empty if the AI call fails.
- Keeps the existing dark theme tokens; history and saving unchanged.

## Testing

Run the pipeline against the uploaded 3-minute match (`Untitled.mp4`, 1280x720, 25fps) end to end in a real browser and check, in order: checkpoint count and scan wall-time, per-player track continuity, contact count vs a manual count on a sampled 30s window, both heat maps being genuinely different and non-degenerate, T stats, then the AI segment calls' raw responses. Fix from what the run shows rather than assuming. Note: the sandbox browser can't decode H.264, so the harness runs a WebM transcode of the same clip; the code path is identical.

## Technical notes

- `src/components/vyro/aiVideo/scanVideo.ts`: rewritten detection/tracking/contact logic, new sampling budget, contact-anchored frame picks, staged progress + `AbortSignal`.
- `src/lib/video-analysis-core.ts`: schema gains verified-label input, per-field provenance and sample counts; drops fields the model may not invent.
- `src/lib/video-analysis.server.ts`: segmented vision calls plus a synthesis call through the Lovable AI Gateway (`google/gemini-2.5-pro` for vision), with per-segment failure tolerated.
- `src/components/vyro/AiVideoView.tsx`: provenance badges, court-shaped heat maps, measured-first rendering, cancel.
- `src/routes/api/public/analyze-clip.ts` kept in sync with the shared schema.
- No database changes; `video_analyses.insight` is jsonb and absorbs the richer report.
