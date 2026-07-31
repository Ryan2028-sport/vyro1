Rules accepted — zero feature deletion, componentize rather than rewrite, styling upgrade, and every static number replaced with live state.

## What's actually there today

Both `/app` (signed-in) and `/app2` (public mirror) render the same `App2ReferenceShell`. The shell and all sub-views are already React components (`AthleteView`, `SportView`, `RecoveryView`, `SleepView`, `DebugView`, `TrendsView`, `SessionView`, `CoachView`, `SocialView`, `CourtDbView`, `TendencyView`, `SwingView`, `DietView`, `HistoryView`, `ProfileView`, `MoreView`, `BandPanel`). Styling comes from two places that fight each other:

- `app2-reference.css` — hand-written CSS with its own `--app2-*` variables (the "static HTML" look: flat cards, hairline borders, monospace labels)
- `shared.tsx` Tailwind primitives (`Card`, `Stat`, `Pill`) using `vyro-*` tokens

That split is why styling edits appear not to land: a view restyled with Tailwind still sits inside `.app2-*` containers whose CSS wins. The fix is one design system that both paths read from.

## The design direction

Dark, Apple-grade, restrained — matching the existing Apple-minimal direction:

- **Surfaces**: layered near-black (`#08090B` base → `#101215` card → `#16191D` elevated), 1px hairline borders at 8% white, large radii (16/20/28px), soft ambient shadow instead of hard outlines
- **Accent**: a single cool signal color for live/ready states, amber for manage, rose for recover — no rainbow, no purple gradients
- **Typography**: Satoshi display for numbers/headings with tight tracking and true optical scale (metric hero 44px, card title 15px, label 11px), JetBrains Mono reserved only for unit/uppercase labels
- **Motion**: 150–250ms ease-out on tab switch, card press scale, number tick transitions, ring/bar fills animate from 0 on mount

## Plan

**1. Unify the token layer**
Move every `--app2-*` value into semantic tokens in `src/styles.css` (`--surface`, `--surface-2`, `--hairline`, `--ready`, `--manage`, `--recover`, radii, shadows). Rewrite `app2-reference.css` to consume those same tokens so CSS-styled and Tailwind-styled parts render identically.

**2. Upgrade the shared primitives** (`shared.tsx`)
Rebuild `Card`, `Stat`, `Pill` plus new `MetricTile`, `Ring`, `SectionHeader`, `Sparkline`, `SegmentedTabs`, `EmptyState`, `SkeletonTile`. Every existing view keeps its current imports, so upgrading these lifts all screens at once.

**3. Shell chrome** (`App2ReferenceShell.tsx`)
Restyle the status bar, top bar, the top scrollable tab rail (Trends / Session / Coach / Social / etc.) as a proper segmented control with an animated indicator, and the 4-item bottom bar with glass blur, safe-area padding, and active-state weight. Same tabs, same order, same routing.

**4. Tab-by-tab pass — every top and bottom tab, nothing skipped**

| Tab | Work |
|---|---|
| Athlete (home) | Hero readiness ring, vitals grid incl. Steps + Resting HR, Today's Plan blocks |
| Sport | Sport switcher, Overview, Court DB (heat maps), Movement, Motion, Tendencies |
| Recovery | Recovery hero, RTP validator, muscle readiness, recovery environment |
| Sleep | Nightly summary, stages, sleep debt, history rows |
| Debug | Keep every counter/log verbatim; restyle into collapsible instrumented panels + monospace log surface |
| Trends / Session / Coach / Social / Swing / Diet / History / Profile / More / Band panel | Same treatment: header, card rhythm, tiles, charts, states |

Each pass is styling + state binding only: no metric, chart area, button, or label removed.

**5. Bind every number to live state**
Audit each view for literals. Anything hardcoded gets replaced by `useVyroScores()` / `useLiveMetrics()` / `useSleepNights()` / the training-plan query. Where a value genuinely has no live source yet, render a dimmed `—` with a "no signal" hint through `EmptyState`/`SkeletonTile` rather than a fake number — the metric stays visible.

**6. Verify**
Typecheck, production build, and a scripted browser pass that visits all 4 bottom tabs and every top tab at 390px and 862px, capturing screenshots to confirm nothing is missing or clipped, with console clean.

## Technical notes

- No layout, navigation, or data-flow restructuring; component boundaries stay as they are.
- Tailwind v4 here means tokens live in `src/styles.css` under `@theme inline` — no `tailwind.config.js`.
- Responsive rule for every header row: `grid-cols-[minmax(0,1fr)_auto]` + `min-w-0` + `shrink-0` so nothing clips at 390px.
- Work order: tokens → primitives → shell → tabs, so each stage is visible in preview as it lands.
