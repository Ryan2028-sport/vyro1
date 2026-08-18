# Tell the analyser which player is you

## Today's behaviour

Nothing asks you who you are. The scanner tracks two movers, then labels whichever one averaged closer to the bottom of the frame across the whole clip as "you" (`scanVideo.ts`, average-depth comparison). On a behind-the-court camera that is usually right; on a side-on or corner angle — which you said varies — it can be inverted, and then the "your shots" heat map, T-time, recovery-to-T and your contact count all actually describe your opponent.

## The fix: you tap yourself, once

New step between selecting the video and the full analysis.

1. **Pick your video** (unchanged).
2. **Quick look pass (~5-10s):** the app samples a handful of spread-out moments and picks the frame where the two players are furthest apart and both clearly visible.
3. **Identify screen:** that frame is shown large with two numbered markers over the detected players (a coloured ring on each, plus a small colour swatch of each player's kit). Prompt: "Which one is you?" You tap a marker (or the player directly).
   - "Neither / can't tell" shows the next-best frame; up to 3 tries.
   - If only one player can be detected in every candidate frame, the screen says so and offers "analyse anyway" with a warning that the you-vs-opponent split will be unreliable.
4. **Full scan runs** with your choice locked in.
5. **Report** shows a small "You: tapped in frame at 42.5s" line, and a **"That's not me — swap"** action that re-labels the whole report instantly without re-scanning or re-calling the AI.

## Making the choice stick for the whole match

A tap identifies you in one frame; the rest of the clip still needs to keep hold of that identity — especially at the varied angles you use.

- At the tap, the app records that player's **kit colour signature** (average colour of their body region, in a lighting-tolerant colour space) and their court position.
- Through the scan, each tracked player is matched to those signatures every checkpoint, so identity survives the players crossing each other and occlusions — the current position-prediction tracker alone loses identity there.
- Colour similarity, position continuity and (as a last tiebreak) court depth are combined; the strongest match wins.
- The scan measures how often your identity was confident and reports it as **"Identity confidence: N% of active frames"** next to the existing "both players tracked" figure. Low confidence (e.g. both players in similar kit) is stated plainly rather than hidden.

The camera-angle question disappears entirely — with a tapped identity plus colour matching, no assumption about where the camera sits is needed, so side-on and corner footage work the same as behind-the-court.

## Technical notes

- `scanVideo.ts` splits into: a fast `probeForIdentity(file)` that returns candidate frames with detected blob boxes + colour signatures, and the main `scanSquashVideo(file, { identity })` that takes the chosen signature.
- Colour signatures come from the existing full-size canvas already used for evidence frames; matching runs in normalised RGB-ratio space so it tolerates the exposure swing between the front and back of a court.
- `depth-only` labelling stays as the fallback path when identity is unavailable, so nothing breaks for saved reports.
- `AiVideoView.tsx` gains the identify step (frame + tap targets) and the swap action; the swap is a pure re-label of the measured report already in state — no re-scan, no extra AI call, no extra credits.
- `MeasuredStats` gains `identitySource` ("tapped" | "auto") and `identityConfidencePercent`; the AI prompt in `video-analysis-core.ts` is told which, so it never claims certainty about who did what when identity was auto-guessed.
- Backend: none. No schema change; the identity fields ride inside the existing report JSON.
