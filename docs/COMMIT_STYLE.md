# Commit message style

A commit message is a permanent note to the next engineer. Write it so that
someone reading `git log` in six months understands **what changed and why**
without opening the diff. No message is too small to be written well — a
one-line copy change gets the same care as a protocol rewrite.

## Shape

```text
<type>(<scope>): <imperative summary, ≤72 chars, lower-case, no period>

<body: why the change exists, what it does at a high level, any trade-offs.
Wrap at ~80 chars. Skip the body only when the summary truly says it all.>
```

- **Imperative mood** — "restart HR stream", not "restarted" or "restarts".
- **Why over what** — the diff already shows what; the body explains intent.
- **One concern per commit** — if you need "and" in the summary, split it.

## Types and scopes

| Type       | Use for                                            |
| ---------- | -------------------------------------------------- |
| `feat`     | User-visible capability                            |
| `fix`      | Correcting wrong behaviour                         |
| `perf`     | Measurably faster / lighter                        |
| `refactor` | Same behaviour, better structure                   |
| `docs`     | Documentation only                                 |
| `test`     | Tests only                                         |
| `build`    | Build system, tooling                              |
| `ci`       | CI workflows                                       |
| `chore`    | Housekeeping that doesn't change shipped behaviour |
| `revert`   | Reverting a prior commit                           |

Scopes: `band`, `ble`, `ota`, `readiness`, `sleep`, `sport`, `video`, `ui`,
`auth`, `db`, `deps`, `repo`.

## Examples at every size

**Tiny UI change:**

```text
fix(ui): align readiness dial label to baseline grid
```

**Copy change:**

```text
fix(ui): remove duplicate VYRO wordmark from athlete header
```

**Small behaviour fix:**

```text
fix(ble): restart heart-rate stream after app resumes

WebKit drops the HR notification silently when the page is backgrounded,
leaving the pipeline idle until re-pair. Re-subscribe on visibilitychange
and re-issue the measurement start command.
```

**Feature:**

```text
feat(video): detect camera cuts before player tracking

Broadcast replays and zooms invalidated the static-camera background
model, producing phantom trajectories. Detect cuts via histogram delta,
reset the background frame, and re-identify kit colours per segment.
```

**Performance:**

```text
perf(readiness): memoize score ring arcs across re-renders
```

**Chore / docs:**

```text
docs(ble): document 0x1e measurement-frame layout
chore(deps): bump @tanstack/react-router to 1.121
```

## Never

- `update code`, `fixes`, `changes`, `wip`, `final`, `asdf`
- "Lovable changes" or any tool-attribution message — commits describe the
  change, never the tool that produced it
- Vague plural summaries ("various improvements") — split the commit
- Referencing chat context ("as discussed") — the commit must stand alone

## Enforcement

CI lints every commit and PR title against these rules
(`.github/workflows/commit-quality.yml`). Squash-merge PRs so the polished
PR title becomes the main-branch commit.
