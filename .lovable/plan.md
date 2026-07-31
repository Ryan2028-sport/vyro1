## What I verified

- The dev server responds 200 and returns complete SSR HTML for `/app` and `/app2`.
- Loading both routes in a clean headless browser renders the full Athlete screen with **zero console or page errors**.
- TypeScript check passes with no errors.
- The only error in the dev log was transient, at 11:02: `Failed to resolve import "./VyroScoresProvider"` from `SportView.tsx`, logged while Vite re-optimized dependencies and force-reloaded the page. That file exists and resolves now.
- No service worker is registered, so stale SW caching is not the cause.
- One of your two open preview tabs did not respond to a liveness probe, while the other rendered the app correctly.

Conclusion: the blank screen is almost certainly one stuck browser tab that reloaded during Vite's dependency re-optimization and never recovered — not a code fault in the current tree. However, the recent large refactor (new `VyroScoresProvider`, `SportView` rewrite, `training_plan_items` wiring) has only been validated in dev, never against a production build, which is where these issues usually hide.

## Plan

1. **Force a clean preview reload** — trigger a dev-server restart so every open tab gets a fresh bundle and Vite's optimized-deps cache is rebuilt, clearing the stuck tab.
2. **Confirm in a real browser** — reload `/app` and `/app2` headlessly with an authenticated session, capture screenshots, and confirm content plus an empty console.
3. **Run the production build** — `bun run build` to catch anything the dev server hides: prerender failures, loader serialization errors (returning components/functions from a loader), or module-init throws in the new provider chain. Fix whatever it surfaces.
4. **Harden the boot path so a blank screen can't happen silently** — verify `__root.tsx` has an `errorComponent` and `notFoundComponent`, and that the router has `defaultErrorComponent`, so any future crash inside `VyroScoresProvider` / `VyroBandProvider` renders a visible error instead of a white page.
5. **Audit the new provider for SSR-unsafe access** — check `VyroScoresProvider` and its dependencies (`useLiveMetrics`, `useMetricsPersistence`, band hooks) for `window`/`localStorage`/`navigator.bluetooth` reads at module scope or during render, which would blank the page on hydration in some environments even while working in others.

## Technical notes

No schema or backend changes are involved. Work is limited to build verification, error-boundary coverage, and SSR-safety of the recently added client providers. If step 3 or 5 reveals a real fault, the fix lands in those files rather than in the UI components.
