# AI Video Analysis tab for squash matches

Add a new tab next to Debug where a player uploads a squash match video and gets a full AI breakdown: T-return behaviour, shot-location heat maps for the player and the opponent, rally structure and coaching actions.

Why nothing appeared before: the analysis code that already exists in the project (`src/lib/video-analysis.functions.ts` and the public API route) is never imported by any screen, and there is no `ai-video` entry in the app's tab list. So the feature exists on the server but has no UI.

## What the user will see

1. New bottom tab **AI Video** (next to Debug).
2. Upload / pick a match video (stays on device; no upload to storage).
3. In-browser scan of the whole clip with a live progress bar: samples frames every ~1s, measures motion, court zone, player-vs-opponent side of court, and picks evidence frames.
4. "Analyze match" sends the compact motion data + evidence frames to the AI and returns a report:
   - **T discipline**: number of returns to the T, average seconds to recover to the T, % of rally time in the T zone, longest time off the T.
   - **Heat maps**: two 3x3 (front/mid/back x forehand/centre/backhand) court grids rendered as colour-graded cells — one for the player's shot locations, one for the opponent's.
   - **Shot mix**: drives, boasts, drops, lobs, volleys, forehand/backhand split.
   - **Rally profile**: rally count, shots per rally, rally length distribution, work/rest ratio, fatigue drift across the match.
   - **Winners / forced / unforced errors** estimates with a confidence label.
   - **Timeline** of key moments with a coaching cue each.
   - **Coach notes + development plan**, and an honest **limitations** list when the camera angle prevents exact calls.
5. Results are saved to the backend so the report is still there after a reload, with a list of previous analyses.

## Technical outline

- **Client scanner** (`src/components/vyro/aiVideo/scanVideo.ts`): plays the video off-screen into a canvas, frame-diffs downscaled frames to get motion, centroid, court zone, and a two-player split (upper/lower court half heuristics + centroid clustering) → produces `motionTimeline`, `shotCandidates`, `tReturnEvents`, `playerZoneHistogram`, `opponentZoneHistogram`, `derivedStats`. Runs in the browser only (called from an event handler, never at module scope).
- **Server function** (`src/lib/video-analysis.functions.ts`): extend the Zod input with the T-return and heat-map histograms, and extend the AI tool schema with `tDiscipline`, `playerHeatmap` (9 numbers), `opponentHeatmap` (9 numbers), `rallyProfile`, keeping the existing fields. Model call goes through Lovable AI Gateway (google/gemini-3-pro-preview for vision); if the project's existing Anthropic secret is present it is still honoured as a fallback. Env read stays inside `.handler()`.
- **View** (`src/components/vyro/AiVideoView.tsx` + small `HeatmapGrid`, `TDisciplineCard`, `RallyProfileCard` components): uses existing `GlassCard`/`Stat` primitives and the app's dark tokens, no hardcoded colours.
- **Persistence**: new `public.video_analyses` table (user_id, video_name, duration_sec, insight jsonb, created_at) with RLS scoped to `auth.uid()` and explicit GRANTs; read/write via server functions under the authenticated path.
- **Wiring**: add `"ai-video"` to the `App2View` union, a render branch, and a tab entry with a video icon in `src/components/vyro/App2ReferenceShell.tsx`. No existing tab or feature is removed.
- The stale duplicate logic in `src/routes/api/public/analyze-clip.ts` is kept as the external HTTP entry point and updated to share the same schema.
