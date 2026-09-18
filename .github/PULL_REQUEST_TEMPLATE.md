## What

<!-- One or two sentences. What does this change do? -->

## Why

<!-- The problem, bug, or requirement behind it. Link issues: Refs #123 -->

## How

<!-- Key implementation decisions and anything a reviewer should look at first. -->

## Screenshots / recordings

<!-- UI changes: before & after at 390x844 and desktop. Delete if not applicable. -->

## Verification

- [ ] `bun run lint`
- [ ] `bunx tsgo --noEmit`
- [ ] `bunx vitest run`
- [ ] `bun run build`
- [ ] Manually exercised the affected screens
- [ ] Band/BLE change tested against firmware: `______`

## Risk

- [ ] Database migration included (additive, with GRANT + RLS policies)
- [ ] Touches auth, roles or RLS
- [ ] Touches BLE/OTA
- [ ] Behind a role gate or feature flag

## Checklist

- [ ] Single concern; no unrelated changes
- [ ] No secrets or generated files committed
- [ ] Loading, empty and error states handled
- [ ] Accessible: 44pt targets, focus states, reduced motion, dark-mode contrast
- [ ] Docs/README updated if behaviour or setup changed
