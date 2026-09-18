# Releasing

VYRO releases are cut from `main`. Every change reaches `main` through a squash-merged pull
request, so `main`'s history is one clean Conventional Commit per change.

## 1. Verify

```bash
bun install --frozen-lockfile
bun run lint && bun run typecheck && bun run test && bun run build
```

CI enforces the same four gates. Do not tag a commit that is red.

## 2. Choose the version

Semantic versioning, driven by what landed since the last tag:

| Change                                 | Bump  |
| -------------------------------------- | ----- |
| Breaking BLE protocol or schema change | major |
| New user-visible capability            | minor |
| Fixes, performance, docs, internals    | patch |

A firmware-coupled change (new opcode, changed packet layout) is a **minor at minimum**, and
the release notes must state the minimum firmware version required.

## 3. Update the changelog

Move entries out of `## [Unreleased]` in `CHANGELOG.md` into a dated version heading. Keep the
Keep-a-Changelog sections: Added, Changed, Fixed, Removed, Security.

## 4. Tag

```bash
git tag -a v1.4.0 -m "vyro v1.4.0"
git push origin v1.4.0
```

Then draft the GitHub release from the tag. `.github/release.yml` groups the generated notes by
category automatically; edit the summary into plain language an athlete could read.

## 5. Ship the clients

- **Web** — published from the Lovable project; the tag records what was published.
- **iOS** — TestFlight build; note the build number in the release.
- **Firmware** — if the release depends on new firmware, link the `.hex` and the minimum
  version in the release notes, and gate the feature in-app rather than assuming the update.

## Hotfixes

Branch from the tag (`hotfix/<slug>`), open a pull request into `main`, squash-merge, tag a
patch release. Never push directly to `main`.
