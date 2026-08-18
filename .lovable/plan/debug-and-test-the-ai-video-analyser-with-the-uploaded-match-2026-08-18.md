# Debug and test the AI Video analyser with the uploaded match

## What I checked already

- The uploaded clip is a real 3-minute squash match video: H.264, 1280x720, 25 fps, 180.5s, ~440 kbps — readable in the browser.
- The scanner (`aiVideo/scanVideo.ts`) will sample this clip every 0.43s, i.e. ~420 seek-and-diff passes, then capture 8 evidence frames.
- The report table for saved analyses already exists in the backend, so saving should work when signed in.

## How I'll test it

1. Drive the app in a headless browser: open the AI Video tab in app 2, select this exact video through the file input, and watch the full run end to end.
2. Capture what actually happens at each stage — scan progress, console errors, the request to the analyser, the returned report — instead of guessing.
3. Verify the numbers the scanner produces from this clip are sane before the AI ever sees them: number of checkpoints, rally count, shot candidates, returns-to-T, T-time percent, and both 3x3 heat maps (a heat map of all zeros or all one zone means the motion/actor split is wrong on this camera angle).
4. Verify the AI leg separately by sending the scanner's real telemetry from this clip to the analyser and reading the raw response, so a gateway error, a schema mismatch, or an unparsable reply is distinguishable from a scanner problem.
5. Confirm the report renders: T discipline, heat maps, rally profile, timeline, coaching lists — no blank sections, no NaN, no "0" tiles where a value exists.
6. Confirm the finished report saves and appears in history.

## Expected problem areas, and the fixes if they show up

- **Scan too slow / stalls on long clips.** ~420 sequential seeks on a phone can take minutes or hang on iOS. Fix: cap the checkpoint count for clips this long (coarser step past ~2 min), and keep the progress label moving so it never looks frozen.
- **Analyser rejects or truncates the payload.** 8 JPEG frames plus telemetry may exceed comfortable request size. Fix: shrink frame width/quality and thin the motion timeline before sending.
- **Player vs opponent split wrong for this camera angle.** The current rule assumes the camera is behind the court and treats the lower mover as the player. If this clip is filmed from the side or above, both heat maps collapse. Fix: derive the split from each mover's average court depth across the whole clip rather than a fixed frame-half rule.
- **Empty or nonsense T stats.** If the T box doesn't line up with this footage, returns-to-T come out as zero. Fix: fit the T box to where court motion actually concentrates in the clip instead of hardcoded coordinates.
- **AI report unreadable.** If the model returns prose or a partial object, the run currently fails with a generic message. Fix: surface the real reason and keep the measured (non-AI) stats visible so the screen is never empty.

## Technical notes

- Test harness: Playwright against the running dev server, script and screenshots under `/tmp/browser/`, using `set_input_files` on the AI Video file input.
- Files likely touched by fixes: `src/components/vyro/aiVideo/scanVideo.ts` (sampling, actor split, T box), `src/lib/video-analysis-core.ts` (payload/prompt limits), `src/lib/video-analysis.server.ts` (error surfacing), `src/components/vyro/AiVideoView.tsx` (empty/error states).
- No backend schema changes needed.
