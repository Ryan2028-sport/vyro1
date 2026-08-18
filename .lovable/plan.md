# Fix the player selector — tap anywhere, not just the two boxes

## What's wrong today

The identify step only offers two tap targets, and both come from the motion detector:

- Boxes are drawn from motion blobs on a 64x64 grid, so they are coarse and often land on the crowd, the scoreboard overlay, or a camera-pan artefact instead of a body (in your screenshot marker 2 sits on empty floor near the score bar).
- Box geometry is then inflated (width x1.4, height x1.2) and floor-clamped to at least 8% x 12%, and the centre is clamped 8-92% / 12-88%, so even a correct detection is pushed off the player.
- If both boxes are wrong, there is no way to select yourself at all — the only escape is "Show another frame".

## The fix

Stop depending on blob accuracy for the tap.

1. **Tap anywhere on the frame.** The whole frame becomes the tap target. Wherever you tap, the app reads the kit colour straight from that frame's real pixels (a small patch around the tap, median-filtered so a stray bright pixel can't skew it) and uses that as your signature. No detection needed for the choice to be right.
2. **Markers become hints, not the only option.** Detected players still show as small unobtrusive rings you can tap, but they no longer block a manual tap and are no longer inflated or clamped — a marker sits exactly on the detected centroid, at the detected size.
3. **Confirmation before locking in.** After a tap, a ring plus a colour swatch appears at the exact spot with "That's me" / "Try again", so a mis-tap is visible and fixable before the scan starts.
4. **Cleaner candidate frames.** Detection ignores the regions that cause the false markers: the crowd/banner band above the court and the score-bar strip at the bottom, plus blobs too small or too wide to be a body. Frames where the two detections are far apart *and* differently coloured are still preferred.
5. **Opponent signature.** The other player is taken from the strongest remaining detection, or (if none is trustworthy) sampled from the same frame at the position furthest from your tap, so the you-vs-opponent split still has a second reference.

Everything downstream is unchanged: your tapped colour still seeds the tracker, the report still shows how you were identified, and "That's not me — swap" still works.

## Technical notes

- `probeForIdentity` in `src/components/vyro/aiVideo/scanVideo.ts` returns, in addition to the current candidates, the full-size frame `ImageData`-backed sampling ability: it keeps each candidate's rendered canvas dimensions so a tap in normalised coords maps to the correct pixel patch.
- Add `sampleSigAt(candidate, x, y)`: draws the candidate frame to an offscreen canvas once (cached), reads a patch of ~4% of the frame width, computes the median RGB then feeds the existing `sigOf` so the signature is in the same normalised chroma space the tracker uses.
- Blob filtering: exclude cells outside a vertical band fitted from where motion actually concentrates, drop blobs with aspect ratio < 0.5 (wide banners/score bars) and cells below the body threshold; keep the existing two-strongest-and-apart rule.
- `AiVideoView.tsx` identify step: the image wrapper becomes a click/tap surface using `getBoundingClientRect` to convert to normalised coords; markers render at exact `p.x`/`p.y` with `p.w`/`p.h` and no min-size clamps; a pending-tap state renders the confirm/retry controls before `setIdentity` locks.
- No backend change; identity still rides inside the existing report JSON.
