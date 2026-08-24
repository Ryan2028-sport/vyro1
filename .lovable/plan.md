# Make the AI squash analyser work on real footage (broadcast edits and own recordings)

## What the frame-by-frame check found on your clip

`Untitled.mp4` is a PSA broadcast highlight edit (Elshorbagy vs Willstrop), 180.5s, 1280x720, 25fps:

- **31+ hard camera cuts** (8.1s, 9.4s, 28.7s, 31.0s, 36.2s, 42.1s … 173.7s).
- **Several different framings**: wide behind-court at 5s, tighter mid-court at 30s and 150s, an extreme close-up at 120s where two bodies fill the frame.
- A permanent animated score bar across the bottom-centre.

The scanner assumes one static camera for the whole file, so on this clip:

- The background model is one global average that needs roughly 7 seconds to re-settle after every cut, so a large share of frames are scored as full-frame movement — inflating motion, activity time and rally splits.
- The court box and the T anchor are fitted once from every blob in the file, mixing wide shots, tight shots and close-ups into one coordinate frame. Heat maps and returns-to-T are therefore measuring the edit, not the match.
- Both player tracks get yanked across every cut and carry the wrong velocity afterwards, which fabricates contacts.
- Replays, close-ups and the score bar feed the same statistics as live play.
- The frame-verification prompt tells the vision model the camera is always behind the court, which is false for most frames of an edited clip.

## The fix

### 1. Split the video into camera segments (new stage before anything else)

A first cheap pass compares consecutive sampled frames globally and marks a cut whenever the whole picture changes at once. The clip becomes a list of segments, each with its own camera. Nothing is measured across a segment boundary any more: no motion value, no track continuity, no rally, no contact.

### 2. Classify every segment and only measure playable ones

Per segment, from its own frames: how much of the picture the movers occupy, how many distinct movers there are, how stable the framing is, and whether court lines are visible in the expected geometry. Segments are labelled:

- **playable** — wide or mid framing with the court visible, two separable movers: used for all numbers.
- **close-up / replay / graphic / crowd** — discarded from the statistics, but counted so the report can say how much of the clip was usable.

The score-bar strip is masked out of every frame before analysis.

### 3. Calibrate court and T per segment

Each playable segment fits its own court box and its own T centre from its own occupancy, then reports positions in normalised court coordinates. Segment results are merged in court space, not pixel space, so a wide shot and a tight shot contribute to the same heat map correctly. Segments whose fit is too weak to trust are downgraded to unusable rather than merged.

### 4. Re-acquire who is who in every segment

Your tapped kit colour becomes a persistent signature. At the start of each playable segment both movers are matched to that signature (with white-balance normalisation, since venues and shots differ), instead of relying on track continuity that a cut destroys. When a segment cannot be resolved confidently, it is measured as anonymous and excluded from the "you vs opponent" splits while still counting toward rally and work/rest numbers.

### 5. Denser sampling and cleaner contact detection

Since scan time is not a constraint: sample at 8-10 fps inside playable segments, detect contacts as motion reversal plus deceleration peaks per player within a segment, and drop the first and last frames next to each cut so boundary artefacts cannot become shots.

### 6. Honest reporting

The report gains a coverage line: usable minutes out of total, number of camera segments used, and how much was rejected as replay or close-up. Anything the footage could not support (for example, no T stats when no segment gave a trustworthy court fit) is shown as "not measurable from this footage" rather than as a zero. The AI verification prompt is rewritten to stop asserting a fixed camera angle and instead receive each frame's segment framing, and evidence frames are only drawn from playable segments.

### 7. Verification, frame by frame

Before this is called done, the clip is run end to end in a real browser against the dev server with per-segment diagnostics printed: cut list, segment labels, usable coverage, per-segment court fit, identity confidence, contact and rally counts, T stats and both heat maps — then checked against the actual frames at those timestamps. The same run is repeated on a single-camera clip to confirm fixed-camera footage still behaves. The pass criteria: no heat map that is all zeros or one hot zone, rally and contact counts within reason for the usable minutes, and no statistic sourced from a rejected segment.

## Technical notes

- `src/components/vyro/aiVideo/scanVideo.ts`: new segmentation and segment-classification passes; background model, court fit, T anchor, tracking and contact detection all become per-segment; score-bar mask; higher `TARGET_FPS`; merge step in court space.
- `src/lib/video-analysis-core.ts`: measured schema gains coverage fields (usable seconds, segment counts, rejected reasons, per-segment court-fit confidence); verify prompt no longer hardcodes a behind-court camera and carries per-frame framing; synthesis prompt receives coverage so the write-up cannot overstate what was seen.
- `src/lib/video-analysis.server.ts`: unchanged transport; only the prompt inputs and the "not measurable" pass-through change.
- `src/components/vyro/AiVideoView.tsx`: coverage strip, "not measurable from this footage" states, and progress labels that name the current stage (cut detection, segment triage, per-segment tracking, AI verification).
- No backend schema changes.
